import uuid
from unittest.mock import AsyncMock, patch

from httpx import AsyncClient

from app.application.use_cases.auth.login import LoginResult
from app.domain.exceptions import UnauthorizedError
from app.infrastructure.security.jwt import TokenData
from app.interfaces.api.v1.dependencies import get_current_user
from app.main import app

_TOKEN_DATA = TokenData(
    user_id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
    org_id=uuid.UUID("00000000-0000-0000-0000-000000000002"),
    role="teacher",
    jti="test-jti",
    exp=9999999999,
)


async def test_login_success(client: AsyncClient):
    mock_result = LoginResult(access_token="acc.tok", refresh_token="ref.tok")
    with patch("app.interfaces.api.v1.routers.auth.LoginUseCase") as MockUC:
        MockUC.return_value.execute = AsyncMock(return_value=mock_result)
        resp = await client.post("/api/v1/auth/login", json={"email": "t@s.com", "password": "pass"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["access_token"] == "acc.tok"
    assert data["refresh_token"] == "ref.tok"
    assert data["token_type"] == "bearer"


async def test_login_invalid_credentials(client: AsyncClient):
    with patch("app.interfaces.api.v1.routers.auth.LoginUseCase") as MockUC:
        MockUC.return_value.execute = AsyncMock(side_effect=UnauthorizedError("Invalid"))
        resp = await client.post("/api/v1/auth/login", json={"email": "t@s.com", "password": "bad"})
    assert resp.status_code == 401


async def test_refresh_success(client: AsyncClient):
    with patch("app.interfaces.api.v1.routers.auth.RefreshTokenUseCase") as MockUC:
        MockUC.return_value.execute = AsyncMock(return_value="new.token")
        resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": "rt"})
    assert resp.status_code == 200
    assert resp.json()["access_token"] == "new.token"


async def test_logout_success(client: AsyncClient):
    async def override_get_current_user():
        return _TOKEN_DATA

    app.dependency_overrides[get_current_user] = override_get_current_user
    try:
        with patch("app.interfaces.api.v1.routers.auth.LogoutUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=None)
            resp = await client.post(
                "/api/v1/auth/logout",
                json={"refresh_token": "rt"},
                headers={"Authorization": "Bearer fake.token"},
            )
        assert resp.status_code == 204
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_get_me(client: AsyncClient):
    async def override_get_current_user():
        return _TOKEN_DATA

    app.dependency_overrides[get_current_user] = override_get_current_user
    try:
        resp = await client.get("/api/v1/auth/me", headers={"Authorization": "Bearer fake.token"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["role"] == "teacher"
        assert data["user_id"] == "00000000-0000-0000-0000-000000000001"
    finally:
        app.dependency_overrides.pop(get_current_user, None)
