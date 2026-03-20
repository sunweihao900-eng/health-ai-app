from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # App
    APP_NAME: str = "健康AI咨询助手"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Claude API
    ANTHROPIC_API_KEY: str = ""
    CLAUDE_MODEL: str = "claude-sonnet-4-6"

    # JWT
    JWT_SECRET_KEY: str = "change-this-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = 10

    # ChromaDB
    CHROMA_PERSIST_DIR: str = "./chroma_db"
    CHROMA_COLLECTION_NAME: str = "health_knowledge"

    # Embedding model
    EMBEDDING_MODEL: str = "BAAI/bge-base-zh-v1.5"
    RAG_SIMILARITY_THRESHOLD: float = 0.7
    RAG_TOP_K: int = 3

    # Knowledge base
    KNOWLEDGE_BASE_DIR: str = "./app/knowledge_base/data"

    # Logging
    LOG_RETENTION_DAYS: int = 90

    # Deployment
    ALLOWED_ORIGINS: str = ""   # Comma-separated extra origins (e.g. https://xxx.vercel.app)
    ENABLE_RAG: bool = True     # Set false on Railway free tier to save memory

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
