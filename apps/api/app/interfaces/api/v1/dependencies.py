from __future__ import annotations

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from redis.asyncio import Redis

from app.domain.exceptions import ForbiddenError, UnauthorizedError
from app.infrastructure.cache.redis_client import get_redis
from app.infrastructure.security.jwt import TokenData, decode_token

_bearer = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    redis: Redis = Depends(get_redis),
) -> TokenData:
    token_data = decode_token(credentials.credentials)
    if await redis.get(f"blacklist:{token_data.jti}"):
        raise UnauthorizedError("Token has been revoked")
    return token_data


def require_role(*roles: str):
    async def _check(token_data: TokenData = Depends(get_current_user)) -> TokenData:
        if token_data.role not in roles:
            raise ForbiddenError(f"Role '{token_data.role}' not allowed")
        return token_data
    return _check
