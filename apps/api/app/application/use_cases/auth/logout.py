from __future__ import annotations

import time

import redis.asyncio as redis_lib

from app.infrastructure.security.jwt import TokenData


class LogoutUseCase:
    def __init__(self, redis: redis_lib.Redis) -> None:
        self._redis = redis

    async def execute(self, token_data: TokenData, refresh_token: str | None) -> None:
        remaining = max(1, token_data.exp - int(time.time()))
        await self._redis.setex(f"blacklist:{token_data.jti}", remaining, "1")
        if refresh_token:
            await self._redis.delete(f"refresh:{refresh_token}")
