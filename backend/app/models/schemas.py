from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum
from datetime import datetime


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"


class Message(BaseModel):
    role: MessageRole
    content: str


class ChatRequest(BaseModel):
    messages: List[Message] = Field(..., min_length=1)
    session_id: Optional[str] = None
    stream: bool = True


class ChatResponse(BaseModel):
    message_id: str
    content: str
    session_id: str
    has_disclaimer: bool = True
    aigc_labeled: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ComplianceCheckResult(BaseModel):
    is_emergency: bool = False
    emergency_message: Optional[str] = None
    needs_redirect: bool = False
    redirect_message: Optional[str] = None
    intent: str = "general"  # general / diagnosis / prescription / emergency


class RAGContext(BaseModel):
    documents: List[str] = []
    sources: List[str] = []
    similarity_scores: List[float] = []


class ChatLog(BaseModel):
    message_id: str
    session_id: str
    user_message: str  # PII-stripped
    assistant_message: str
    compliance_flags: dict
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TokenPayload(BaseModel):
    sub: str
    exp: Optional[int] = None


class UserLogin(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
