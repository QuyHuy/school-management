from __future__ import annotations

from uuid import UUID

import redis.asyncio as redis_lib

from app.domain.exceptions import UnauthorizedError
from app.domain.repositories.user_repository import IUserRepository
from app.infrastructure.security.jwt import create_access_token


class RefreshTokenUseCase:
    def __init__(self, user_repo: IUserRepository, redis: redis_lib.Redis) -> None:
        self._user_repo = user_repo
        self._redis = redis

    async def execute(self, refresh_token: str) -> str:
        user_id_str = await self._redis.get(f"refresh:{refresh_token}")
        if not user_id_str:
            raise UnauthorizedError("Invalid or expired refresh token")

        user = await self._user_repo.get_by_id(UUID(user_id_str))
        if not user or not user.is_active:
            raise UnauthorizedError("User not found or disabled")

        access_token, _jti = create_access_token(user.id, user.organization_id, user.role.value)
        return access_token
