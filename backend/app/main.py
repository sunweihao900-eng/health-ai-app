"""
健康AI咨询App - FastAPI主应用
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .api.v1 import chat as chat_router
from .api.v1 import auth as auth_router
from .services.rag_service import rag_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期：启动时可选初始化RAG服务"""
    if settings.ENABLE_RAG:
        logger.info("初始化RAG服务和知识库...")
        rag_service.initialize()
        count = rag_service.load_knowledge_base()
        logger.info(f"知识库加载完成，导入文档块: {count}")
    else:
        logger.info("RAG已禁用（ENABLE_RAG=false），跳过知识库加载，节省内存")
    yield
    logger.info("应用关闭")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "合规医疗AI健康咨询服务 - 健康科普工具，非医疗诊断工具\n\n"
        "⚠️ 本服务由AI驱动，所有内容仅供健康科普参考，不构成医疗建议。"
    ),
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

# ──────────────────────────────────────────────
# CORS（开发默认 + 生产通过 ALLOWED_ORIGINS 注入）
# ──────────────────────────────────────────────
_dev_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
]
_extra_origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
_all_origins = list(set(_dev_origins + _extra_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_all_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

# ──────────────────────────────────────────────
# 路由
# ──────────────────────────────────────────────
app.include_router(auth_router.router, prefix="/api/v1/auth", tags=["认证"])
app.include_router(chat_router.router, prefix="/api/v1",      tags=["对话"])


@app.get("/", tags=["状态"])
async def root():
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "aigc_labeled": True,
        "rag_enabled": settings.ENABLE_RAG,
        "disclaimer": "本服务由AI驱动，所有内容仅供健康科普参考，不构成医疗诊断或治疗建议",
    }


@app.get("/health", tags=["状态"])
async def health_check():
    return {"status": "healthy"}
