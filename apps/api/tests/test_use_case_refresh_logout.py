import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import pytest

from app.application.use_cases.auth.logout import LogoutUseCase
from app.application.use_cases.auth.refresh_token import RefreshTokenUseCase
from app.domain.entities.user import User, UserRole
from app.domain.exceptions import UnauthorizedError
from app.infrastructure.security.jwt import TokenData

_USER_ID = uuid.uuid4()
_ORG_ID = uuid.uuid4()
_NOW = datetime.now(UTC)


def _make_user() -> User:
    return User(
        id=_USER_ID, organization_id=_ORG_ID, email="t@s.com",
        password_hash="h", role=UserRole.teacher, name="T", phone=None,
        is_active=True, created_at=_NOW, updated_at=_NOW, deleted_at=None,
    )


async def test_refresh_returns_new_access_token():
    user_repo = AsyncMock()
    redis = AsyncMock()
    redis.get.return_value = str(_USER_ID)
    user_repo.get_by_id.return_value = _make_user()

    with patch("app.application.use_cases.auth.refresh_token.create_access_token",
               return_value=("new.token", "jti-new")):
        result = await RefreshTokenUseCase(user_repo, redis).execute("valid-refresh-token")

    assert result == "new.token"


async def test_refresh_raises_on_invalid_token():
    user_repo = AsyncMock()
    redis = AsyncMock()
    redis.get.return_value = None

    with pytest.raises(UnauthorizedError):
        await RefreshTokenUseCase(user_repo, redis).execute("bad-token")


async def test_logout_blacklists_jti_and_deletes_refresh():
    redis = AsyncMock()
    token_data = TokenData(
        user_id=_USER_ID, org_id=_ORG_ID, role="teacher",
        jti="jti-abc", exp=9999999999
    )

    await LogoutUseCase(redis).execute(token_data, refresh_token="rt-xyz")

    redis.setex.assert_called_once()
    call_args = redis.setex.call_args[0]
    assert call_args[0] == "blacklist:jti-abc"
    redis.delete.assert_called_once_with("refresh:rt-xyz")


async def test_logout_without_refresh_token():
    redis = AsyncMock()
    token_data = TokenData(
        user_id=_USER_ID, org_id=_ORG_ID, role="teacher",
        jti="jti-def", exp=9999999999
    )

    await LogoutUseCase(redis).execute(token_data, refresh_token=None)

    redis.setex.assert_called_once()
    redis.delete.assert_not_called()
