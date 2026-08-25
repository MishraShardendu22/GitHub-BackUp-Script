from __future__ import annotations

from typing import Any
from config import settings
from jose import JWTError, jwt
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone
from fastapi.security import OAuth2PasswordBearer
from fastapi import Depends, HTTPException, status

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

class TokenData(BaseModel):
    username: str | None = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

def authenticate_user(username: str, password: str) -> bool:
    return (
        username == settings.CHAT_USERNAME
        and password == settings.CHAT_PASSWORD
    )


def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    if not settings.JWT_SECRET:
        raise RuntimeError("JWT_SECRET is not configured in settings")

    to_encode = data.copy()
    expires_minutes = settings.JWT_EXPIRES_MINUTES
    if not isinstance(expires_minutes, int) or expires_minutes <= 0:
        expires_minutes = 60

    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=expires_minutes))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm="HS256")


async def get_current_user(token: str = Depends(oauth2_scheme)) -> str:
    if not settings.JWT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="JWT_SECRET is not configured on server",
        )

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        username: str | None = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception

    if not token_data.username or token_data.username != settings.CHAT_USERNAME:
        raise credentials_exception

    return token_data.username
