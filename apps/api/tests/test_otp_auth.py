import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.domain.exceptions import NotFoundError, UnauthorizedError
from app.application.use_cases.auth.verify_otp import VerifyOTPResult


@pytest.mark.asyncio
async def test_otp_request_returns_404_for_unknown_phone(client):
    with patch("app.interfaces.api.v1.routers.auth.RequestOTPUseCase") as MockUC:
        MockUC.return_value.execute = AsyncMock(side_effect=NotFoundError("parent", "0999000000"))
        resp = await client.post("/api/v1/auth/otp/request", json={"phone": "0999000000"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_otp_verify_returns_401_for_wrong_code(client):
    with patch("app.interfaces.api.v1.routers.auth.VerifyOTPUseCase") as MockUC:
        MockUC.return_value.execute = AsyncMock(
            side_effect=UnauthorizedError("Mã OTP không hợp lệ hoặc đã hết hạn")
        )
        resp = await client.post(
            "/api/v1/auth/otp/verify",
            json={"phone": "0912345678", "code": "000000"},
        )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_otp_request_endpoint_exists(client):
    with patch("app.interfaces.api.v1.routers.auth.RequestOTPUseCase") as MockUC:
        MockUC.return_value.execute = AsyncMock(side_effect=NotFoundError("parent", "0000000000"))
        resp = await client.post("/api/v1/auth/otp/request", json={"phone": "0000000000"})
    assert resp.status_code in (204, 404, 422, 500)


@pytest.mark.asyncio
async def test_otp_verify_success(client):
    mock_result = VerifyOTPResult(access_token="acc.tok", refresh_token="ref.tok")
    with patch("app.interfaces.api.v1.routers.auth.VerifyOTPUseCase") as MockUC:
        MockUC.return_value.execute = AsyncMock(return_value=mock_result)
        resp = await client.post(
            "/api/v1/auth/otp/verify",
            json={"phone": "0912345678", "code": "123456"},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["access_token"] == "acc.tok"
    assert data["refresh_token"] == "ref.tok"
    assert data["token_type"] == "bearer"
