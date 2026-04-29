from __future__ import annotations

import uuid
from dataclasses import dataclass

import redis.asyncio as redis_lib

from app.config import settings
from app.domain.exceptions import UnauthorizedError
from app.domain.repositories.user_repository import IUserRepository
from app.infrastructure.security.jwt import create_access_token
from app.infrastructure.security.password import verify_password

_REFRESH_TTL = settings.refresh_token_expire_days * 86400


@dataclass
class LoginResult:
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginUseCase:
    def __init__(self, user_repo: IUserRepository, redis: redis_lib.Redis) -> None:
        self._user_repo = user_repo
        self._redis = redis

    async def execute(self, email: str, password: str) -> LoginResult:
        user = await self._user_repo.get_by_email(email)
        if not user or not verify_password(password, user.password_hash):
            raise UnauthorizedError("Invalid email or password")
        if not user.is_active:
            raise UnauthorizedError("Account is disabled")

        access_token, _jti = create_access_token(user.id, user.organization_id, user.role.value)
        refresh_token = str(uuid.uuid4())
        await self._redis.setex(f"refresh:{refresh_token}", _REFRESH_TTL, str(user.id))

        return LoginResult(access_token=access_token, refresh_token=refresh_token)
