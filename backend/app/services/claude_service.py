"""
Claude API 服务（支持 Anthropic 直连 & OpenRouter）
- 自动检测 Key 类型：sk-or-* → OpenRouter，sk-ant-* → Anthropic
- 流式输出（SSE）
- 输出后合规审查 + 强制免责声明
"""
import httpx
import json
import asyncio
import logging
from typing import AsyncGenerator, List, Optional

from ..core.config import settings
from ..models.schemas import Message, MessageRole
from .compliance_filter import compliance_filter

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# 合规 System Prompt
# ──────────────────────────────────────────────
COMPLIANCE_SYSTEM_PROMPT = """你是一个健康科普助手，由AI驱动，**不是医生，没有医疗执照，不具备任何医疗资质**。

## 你的服务边界（严格遵守）

### ✅ 你可以做的事：
1. **健康科普**：解释医学术语、讲解疾病基本知识、介绍身体结构和功能
2. **症状整理**：帮助用户梳理和描述症状，以便更好地与医生沟通
3. **就医指引**：根据症状描述，建议可能适合挂号的科室
4. **生活方式建议**：提供饮食、运动、作息的一般性健康建议
5. **用药提醒**：提醒用药时间和基本注意事项（不涉及具体用药推荐）
6. **健康教育**：分享疾病预防知识、健康筛查建议

### ❌ 你绝对不能做的事：
1. **不能诊断疾病**：不能说"你患有XX病"、"确诊为XX"
2. **不能开处方**：不能推荐具体药物、剂量、用药方案
3. **不能解读报告**：不能解读化验单、影像学报告、病理报告
4. **不能评估严重性**：不能告知病情是否严重、是否需要手术
5. **不能替代心理治疗**：不能为情绪危机或心理疾病提供治疗性干预

## 回复结构（六段式，严格遵守）

每次正常回复（非紧急/非拦截情况）必须按以下六段式结构组织，标题加粗：

**🤝 共情**
1-2句理解用户感受，表示关心，体现温度。

**📚 原因解析**
2-3句科普相关健康知识背景、常见成因，使用通俗易懂的语言。

**💡 实用建议**
3-5条具体可执行的生活方式建议（饮食、运动、作息、环境等），用列表呈现。

**🚩 红旗信号**
2-3个需要立即就医的警示信号，格式：「若出现以下情况，请立即就诊或拨打120：」

**🏥 行动指引**
1-2句：推荐适合就诊的科室，以及建议就医的时机。

**⚠️ 免责声明**（固定格式，不可省略）：
---
**⚠️ 重要提示（AIGC生成内容）**
本回复由人工智能生成，**仅供健康科普参考**，不构成医疗诊断、治疗建议或处方依据。
如有健康问题，请及时就诊，由执业医师提供专业诊疗。
🤖 *本内容由AI自动生成 | 生成式人工智能服务*

## 遇到紧急情况立即引导急救

如用户描述剧烈胸痛、呼吸困难、意识丧失、大量出血、中毒、自杀念头，
立即停止科普，告知拨打120，不使用六段式结构。

用简体中文回复，专业但易于理解，语气温和关怀，避免引起恐慌。"""


def _is_openrouter_key(key: str) -> bool:
    return key.startswith("sk-or-")


def _build_messages(messages: List[Message], rag_context: Optional[str] = None) -> List[dict]:
    result = []
    for i, msg in enumerate(messages):
        content = msg.content
        if rag_context and i == len(messages) - 1 and msg.role == MessageRole.USER:
            content = f"【相关健康知识参考】\n{rag_context}\n\n【用户问题】\n{content}"
        result.append({"role": msg.role.value, "content": content})
    return result


class ClaudeService:
    """统一 Claude 调用服务（支持 OpenRouter 和 Anthropic）"""

    def __init__(self):
        self.api_key = settings.ANTHROPIC_API_KEY
        self.use_openrouter = _is_openrouter_key(self.api_key)

        if self.use_openrouter:
            self.base_url = "https://openrouter.ai/api/v1"
            # OpenRouter 的 Claude 模型名
            self.model = "anthropic/claude-sonnet-4-5"
            logger.info("使用 OpenRouter 调用 Claude")
        else:
            self.base_url = "https://api.anthropic.com/v1"
            self.model = settings.CLAUDE_MODEL
            logger.info("使用 Anthropic 直连调用 Claude")

    async def stream_chat(
        self,
        messages: List[Message],
        rag_context: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """流式生成回复，结束后检查免责声明"""
        built = _build_messages(messages, rag_context)
        full_response: List[str] = []

        if self.use_openrouter:
            async for chunk in self._openrouter_stream(built):
                full_response.append(chunk)
                yield chunk
        else:
            async for chunk in self._anthropic_stream(built):
                full_response.append(chunk)
                yield chunk

        # 补注免责声明
        complete = "".join(full_response)
        if "本回复由人工智能生成" not in complete:
            disclaimer = (
                "\n\n---\n"
                "**⚠️ 重要提示（AIGC生成内容）**\n"
                "本回复由人工智能生成，**仅供健康科普参考**，不构成医疗诊断、治疗建议或处方依据。\n"
                "如有健康问题，请及时就诊，由执业医师提供专业诊疗。\n"
                "🤖 *本内容由AI自动生成 | 生成式人工智能服务*"
            )
            yield disclaimer

    async def _openrouter_stream(self, messages: List[dict]) -> AsyncGenerator[str, None]:
        """OpenRouter SSE 流式请求"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://health-ai-app.local",
            "X-Title": "健康AI咨询助手",
        }
        payload = {
            "model": self.model,
            "messages": [{"role": "system", "content": COMPLIANCE_SYSTEM_PROMPT}] + messages,
            "stream": True,
            "max_tokens": 2048,
            "temperature": 0.7,
        }

        try:
            async with httpx.AsyncClient(timeout=120) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                ) as resp:
                    if resp.status_code != 200:
                        body = await resp.aread()
                        logger.error(f"OpenRouter 错误 {resp.status_code}: {body.decode()}")
                        yield f"\n\n[服务错误：{resp.status_code}，请稍后再试]"
                        return

                    async for line in resp.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        data = line[6:]
                        if data.strip() == "[DONE]":
                            break
                        try:
                            obj = json.loads(data)
                            delta = obj["choices"][0].get("delta", {})
                            text = delta.get("content", "")
                            if text:
                                yield text
                        except (json.JSONDecodeError, KeyError):
                            continue

        except httpx.ConnectError:
            yield "\n\n[网络连接失败，请检查网络后重试]"
        except httpx.TimeoutException:
            yield "\n\n[请求超时，请稍后再试]"
        except Exception as e:
            logger.error(f"OpenRouter 调用异常: {e}")
            yield "\n\n[AI服务暂时不可用，请稍后再试]"

    async def _anthropic_stream(self, messages: List[dict]) -> AsyncGenerator[str, None]:
        """Anthropic 直连流式请求"""
        try:
            import anthropic as ant
            client = ant.AsyncAnthropic(api_key=self.api_key)
            async with client.messages.stream(
                model=self.model,
                max_tokens=2048,
                system=COMPLIANCE_SYSTEM_PROMPT,
                messages=messages,
            ) as stream:
                async for text in stream.text_stream:
                    yield text
        except Exception as e:
            logger.error(f"Anthropic 调用异常: {e}")
            yield "\n\n[AI服务暂时不可用，请稍后再试]"

    async def chat(self, messages: List[Message], rag_context: Optional[str] = None) -> str:
        """非流式完整回复"""
        parts = []
        async for chunk in self.stream_chat(messages, rag_context):
            parts.append(chunk)
        text = "".join(parts)
        text, _ = compliance_filter.check_output(text)
        return compliance_filter.inject_disclaimer(text)


claude_service = ClaudeService()
