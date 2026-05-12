from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from jose import JWTError, jwt

from app.config import settings
from app.domain.exceptions import UnauthorizedError


@dataclass
class TokenData:
    user_id: UUID
    org_id: UUID
    role: str
    jti: str
    exp: int


def create_access_token(user_id: UUID, org_id: UUID, role: str) -> tuple[str, str]:
    """Returns (encoded_jwt, jti)."""
    jti = str(uuid.uuid4())
    expire = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {
        "sub": str(user_id),
        "org_id": str(org_id),
        "role": role,
        "jti": jti,
        "exp": expire,
    }
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return token, jti


def decode_token(token: str) -> TokenData:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise UnauthorizedError("Invalid or expired token") from exc
    return TokenData(
        user_id=UUID(payload["sub"]),
        org_id=UUID(payload["org_id"]),
        role=payload["role"],
        jti=payload["jti"],
        exp=payload["exp"],
    )
