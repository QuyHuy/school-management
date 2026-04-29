import uuid
import pytest
from unittest.mock import AsyncMock, patch
from datetime import datetime, timezone

from app.application.use_cases.auth.login import LoginUseCase, LoginResult
from app.domain.entities.user import User, UserRole
from app.domain.exceptions import UnauthorizedError

_ORG_ID = uuid.uuid4()
_USER_ID = uuid.uuid4()
_NOW = datetime.now(timezone.utc)


def _make_user(is_active: bool = True) -> User:
    return User(
        id=_USER_ID, organization_id=_ORG_ID,
        email="teacher@school.com", password_hash="$2b$12$fake",
        role=UserRole.teacher, name="Test Teacher",
        phone=None, is_active=is_active,
        created_at=_NOW, updated_at=_NOW, deleted_at=None,
    )


async def test_login_returns_tokens_on_valid_credentials():
    user_repo = AsyncMock()
    redis = AsyncMock()

    with patch("app.application.use_cases.auth.login.verify_password", return_value=True), \
         patch("app.application.use_cases.auth.login.create_access_token", return_value=("access.token.here", "jti-123")):
        user_repo.get_by_email.return_value = _make_user()
        result = await LoginUseCase(user_repo, redis).execute("teacher@school.com", "correct")

    assert result.access_token == "access.token.here"
    assert result.refresh_token is not None
    assert result.token_type == "bearer"
    redis.setex.assert_called_once()


async def test_login_raises_on_wrong_password():
    user_repo = AsyncMock()
    redis = AsyncMock()

    with patch("app.application.use_cases.auth.login.verify_password", return_value=False):
        user_repo.get_by_email.return_value = _make_user()
        with pytest.raises(UnauthorizedError):
            await LoginUseCase(user_repo, redis).execute("teacher@school.com", "wrong")


async def test_login_raises_on_unknown_email():
    user_repo = AsyncMock()
    redis = AsyncMock()
    user_repo.get_by_email.return_value = None

    with pytest.raises(UnauthorizedError):
        await LoginUseCase(user_repo, redis).execute("nobody@school.com", "any")


async def test_login_raises_on_inactive_user():
    user_repo = AsyncMock()
    redis = AsyncMock()

    with patch("app.application.use_cases.auth.login.verify_password", return_value=True):
        user_repo.get_by_email.return_value = _make_user(is_active=False)
        with pytest.raises(UnauthorizedError):
            await LoginUseCase(user_repo, redis).execute("teacher@school.com", "correct")
