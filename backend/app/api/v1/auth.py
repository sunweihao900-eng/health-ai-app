"""
认证接口（演示用，生产环境需接入真实用户系统）
"""
import jwt
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, status
from ...core.config import settings
from ...models.schemas import UserLogin, TokenResponse

router = APIRouter()

# 演示用户（生产环境替换为数据库查询）
DEMO_USERS = {
    "demo": "demo123",
    "test": "test123",
}


@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    """用户登录，获取JWT Token"""
    if (
        credentials.username not in DEMO_USERS
        or DEMO_USERS[credentials.username] != credentials.password
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
        )

    expire = datetime.utcnow() + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {
        "sub": credentials.username,
        "exp": expire,
        "iat": datetime.utcnow(),
    }
    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    return TokenResponse(access_token=token)


@router.post("/demo-token", response_model=TokenResponse)
async def get_demo_token():
    """获取演示Token（无需登录，仅用于开发测试）"""
    expire = datetime.utcnow() + timedelta(hours=1)
    payload = {
        "sub": "demo_user",
        "exp": expire,
        "iat": datetime.utcnow(),
    }
    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return TokenResponse(access_token=token)
