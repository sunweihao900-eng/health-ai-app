"""
核心对话接口
处理链（顺序不可变）：
JWT认证 → 限流(10次/分钟) → 多轮绕过检测 → 紧急检测 → 意图分类
→ PII脱敏 → RAG检索 → Claude流式生成 → 输出审查 → 脱敏存储
"""
import uuid
import logging
import json
from datetime import datetime
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt as pyjwt

from ...core.config import settings
from ...models.schemas import ChatRequest, Message, MessageRole, TokenPayload
from ...services.compliance_filter import compliance_filter
from ...services.claude_service import claude_service
from ...services.rag_service import rag_service
from ...services.pii_service import pii_service

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer()

# ──────────────────────────────────────────────
# 内存限流存储（生产环境应使用Redis）
# ──────────────────────────────────────────────
from collections import defaultdict
import time

_rate_limit_store: dict = defaultdict(list)


def check_rate_limit(user_id: str) -> bool:
    """10次/分钟限流检查，返回True表示允许"""
    now = time.time()
    window = 60  # 秒
    limit = settings.RATE_LIMIT_PER_MINUTE

    # 清理过期记录
    _rate_limit_store[user_id] = [
        t for t in _rate_limit_store[user_id] if now - t < window
    ]

    if len(_rate_limit_store[user_id]) >= limit:
        return False

    _rate_limit_store[user_id].append(now)
    return True


# ──────────────────────────────────────────────
# JWT认证依赖
# ──────────────────────────────────────────────
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> TokenPayload:
    try:
        payload = pyjwt.decode(
            credentials.credentials,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return TokenPayload(**payload)
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token已过期，请重新登录",
        )
    except pyjwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的认证令牌",
        )


# ──────────────────────────────────────────────
# 对话存储（生产环境应使用数据库）
# ──────────────────────────────────────────────
_chat_logs: list = []


def store_log(log: dict):
    """异步存储脱敏日志（生产环境替换为数据库写入）"""
    _chat_logs.append(log)
    # 保留最近1000条
    if len(_chat_logs) > 1000:
        _chat_logs.pop(0)


async def generate_sse_stream(
    request: ChatRequest,
    user_id: str,
    message_id: str,
    session_id: str,
) -> AsyncGenerator[str, None]:
    """SSE流式生成器，包含完整合规处理链"""

    # ── Step 1: 多轮绕过检测 ──
    if compliance_filter.check_history_for_bypass(
        [m.dict() for m in request.messages]
    ):
        yield _sse_event(
            {
                "type": "error",
                "message": "检测到不当请求，已被系统拦截。请正常使用健康科普服务。",
                "message_id": message_id,
            }
        )
        return

    # ── Step 2: 紧急症状 & 意图检测（针对最新用户消息）──
    last_user_msg = next(
        (m for m in reversed(request.messages) if m.role == "user"), None
    )
    if not last_user_msg:
        yield _sse_event({"type": "error", "message": "消息格式错误"})
        return

    compliance_result = compliance_filter.check_input(last_user_msg.content)

    if compliance_result.is_emergency:
        yield _sse_event(
            {
                "type": "emergency",
                "message": compliance_result.emergency_message,
                "message_id": message_id,
                "aigc": True,
            }
        )
        _log_interaction(
            message_id, session_id, user_id,
            last_user_msg.content, compliance_result.emergency_message or "",
            {"intent": "emergency", "intercepted": True},
        )
        return

    if compliance_result.needs_redirect:
        yield _sse_event(
            {
                "type": "redirect",
                "message": compliance_result.redirect_message,
                "intent": compliance_result.intent,
                "message_id": message_id,
                "aigc": True,
            }
        )
        _log_interaction(
            message_id, session_id, user_id,
            last_user_msg.content, compliance_result.redirect_message or "",
            {"intent": compliance_result.intent, "intercepted": True},
        )
        return

    # ── Step 3: PII脱敏 ──
    cleaned_messages = []
    for msg in request.messages:
        content, pii_types = pii_service.anonymize(msg.content)
        if pii_types:
            logger.info(f"PII脱敏 [session={session_id}]: {pii_types}")
        cleaned_messages.append(Message(role=msg.role, content=content))

    # ── Step 4: RAG检索 ──
    rag_context_str = None
    try:
        rag_result = rag_service.retrieve(last_user_msg.content)
        if rag_result.documents:
            rag_context_str = rag_service.format_context(rag_result)
            logger.info(
                f"RAG命中 [session={session_id}]: {len(rag_result.documents)}条, "
                f"scores={rag_result.similarity_scores}"
            )
    except Exception as e:
        logger.warning(f"RAG检索失败，降级处理: {e}")

    # ── Step 5: Claude流式生成 + 输出审查 ──
    yield _sse_event({"type": "start", "message_id": message_id})

    full_response_parts = []
    try:
        async for chunk in claude_service.stream_chat(cleaned_messages, rag_context_str):
            full_response_parts.append(chunk)
            yield _sse_event({"type": "chunk", "content": chunk})
    except Exception as e:
        logger.error(f"Claude生成失败: {e}")
        yield _sse_event({"type": "error", "message": "AI服务暂时不可用，请稍后再试"})
        return

    full_response = "".join(full_response_parts)

    # ── Step 6: 输出审查 ──
    cleaned_response, was_modified = compliance_filter.check_output(full_response)
    if was_modified:
        logger.warning(f"输出被合规过滤 [session={session_id}]")

    # ── Step 7: 脱敏日志存储 ──
    _log_interaction(
        message_id, session_id, user_id,
        pii_service.anonymize(last_user_msg.content)[0],
        cleaned_response,
        {"intent": "general", "rag_used": rag_context_str is not None, "intercepted": False},
    )

    yield _sse_event(
        {
            "type": "done",
            "message_id": message_id,
            "aigc": True,
            "has_disclaimer": "本回复由人工智能生成" in full_response,
        }
    )


def _sse_event(data: dict) -> str:
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


def _log_interaction(
    message_id: str,
    session_id: str,
    user_id: str,
    user_message: str,
    assistant_message: str,
    flags: dict,
):
    store_log(
        {
            "message_id": message_id,
            "session_id": session_id,
            "user_id": user_id,
            "user_message": user_message,  # 已脱敏
            "assistant_message": assistant_message,
            "compliance_flags": flags,
            "created_at": datetime.utcnow().isoformat(),
        }
    )


# ──────────────────────────────────────────────
# 路由
# ──────────────────────────────────────────────
@router.post("/chat")
async def chat(
    request: ChatRequest,
    current_user: TokenPayload = Depends(get_current_user),
):
    """
    健康咨询对话接口（SSE流式）

    完整处理链：
    JWT认证 → 限流 → 绕过检测 → 紧急检测 → 意图分类
    → PII脱敏 → RAG → Claude生成 → 输出审查 → 日志存储
    """
    user_id = current_user.sub

    # 限流检查
    if not check_rate_limit(user_id):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="请求过于频繁（每分钟最多10次），请稍后再试",
            headers={"Retry-After": "60"},
        )

    message_id = str(uuid.uuid4())
    session_id = request.session_id or str(uuid.uuid4())

    if request.stream:
        return StreamingResponse(
            generate_sse_stream(request, user_id, message_id, session_id),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
                "X-Message-ID": message_id,
                "X-Session-ID": session_id,
            },
        )
    else:
        # 非流式（用于测试）
        last_user_msg = next(
            (m for m in reversed(request.messages) if m.role == MessageRole.USER), None
        )
        if not last_user_msg:
            raise HTTPException(status_code=400, detail="消息格式错误")

        compliance_result = compliance_filter.check_input(last_user_msg.content)
        if compliance_result.is_emergency:
            return {"message": compliance_result.emergency_message, "type": "emergency"}
        if compliance_result.needs_redirect:
            return {"message": compliance_result.redirect_message, "type": "redirect"}

        cleaned_messages = []
        for msg in request.messages:
            content, _ = pii_service.anonymize(msg.content)
            cleaned_messages.append(Message(role=msg.role, content=content))

        response = await claude_service.chat(cleaned_messages)
        return {
            "message": response,
            "message_id": message_id,
            "session_id": session_id,
            "aigc": True,
        }
