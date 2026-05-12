import uuid
from unittest.mock import AsyncMock, patch

import pytest

from app.infrastructure.security.jwt import TokenData
from app.interfaces.api.v1.dependencies import get_current_user
from app.main import app

_ORG_ID = uuid.UUID("00000000-0000-0000-0000-000000000099")
_TEACHER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
_CLASS_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")
_SESSION_ID = uuid.UUID("00000000-0000-0000-0000-000000000020")

_TEACHER_TOKEN = TokenData(
    user_id=_TEACHER_ID, org_id=_ORG_ID, role="teacher", jti="j1", exp=9999999999
)


@pytest.mark.asyncio
async def test_send_zalo_requires_teacher_auth(client):
    resp = await client.post(
        f"/api/v1/classes/{_CLASS_ID}/sessions/{_SESSION_ID}/attendance/send-zalo"
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_send_zalo_returns_200_with_count(client):
    from app.application.use_cases.attendance.send_zalo_notifications import SendZaloResult
    app.dependency_overrides[get_current_user] = lambda: _TEACHER_TOKEN
    try:
        with patch(
            "app.interfaces.api.v1.routers.attendance.SendZaloNotificationsUseCase"
        ) as MockUC:
            MockUC.return_value.execute = AsyncMock(
                return_value=SendZaloResult(sent_count=3, skipped_count=1)
            )
            resp = await client.post(
                f"/api/v1/classes/{_CLASS_ID}/sessions/{_SESSION_ID}/attendance/send-zalo",
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["sent_count"] == 3
        assert data["skipped_count"] == 1
    finally:
        app.dependency_overrides.pop(get_current_user, None)
