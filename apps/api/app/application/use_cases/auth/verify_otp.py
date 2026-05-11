from __future__ import annotations

import uuid

import redis.asyncio as redis_lib

from app.config import settings
from app.domain.entities.user import UserRole
from app.domain.exceptions import NotFoundError, UnauthorizedError
from app.domain.repositories.user_repository import IUserRepository
from app.infrastructure.security.jwt import create_access_token

_REFRESH_TTL = settings.refresh_token_expire_days * 86400


class VerifyOTPResult:
    def __init__(self, access_token: str, refresh_token: str) -> None:
        self.access_token = access_token
        self.refresh_token = refresh_token


class VerifyOTPUseCase:
    def __init__(self, user_repo: IUserRepository, redis: redis_lib.Redis) -> None:
        self._user_repo = user_repo
        self._redis = redis

    async def execute(self, phone: str, code: str) -> VerifyOTPResult:
        user = await self._user_repo.get_by_phone(phone)
        if not user or user.role != UserRole.parent:
            raise NotFoundError("parent", phone)

        stored = await self._redis.get(f"otp:{phone}")
        if not stored or stored.decode() != code:
            raise UnauthorizedError("Mã OTP không hợp lệ hoặc đã hết hạn")

        await self._redis.delete(f"otp:{phone}")

        access_token, _jti = create_access_token(user.id, user.organization_id, user.role.value)
        refresh_token = str(uuid.uuid4())
        await self._redis.setex(f"refresh:{refresh_token}", _REFRESH_TTL, str(user.id))

        return VerifyOTPResult(access_token=access_token, refresh_token=refresh_token)
