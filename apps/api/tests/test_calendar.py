import uuid
from datetime import date, time
from unittest.mock import AsyncMock, patch

from httpx import AsyncClient

from app.infrastructure.security.jwt import TokenData
from app.interfaces.api.v1.dependencies import get_current_user
from app.main import app

_ORG_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")
_TEACHER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
_TOKEN = TokenData(user_id=_TEACHER_ID, org_id=_ORG_ID, role="teacher", jti="j", exp=9999999999)


async def _override():
    return _TOKEN


async def test_get_calendar_returns_200(client: AsyncClient):
    from app.domain.entities.calendar import CalendarData

    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.calendar.GetCalendarUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(
                return_value=CalendarData(sessions=[], schedule_slots=[])
            )
            resp = await client.get(
                "/api/v1/calendar?month=2026-05",
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert "sessions" in data
        assert "schedule_slots" in data
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_get_calendar_invalid_month(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        resp = await client.get(
            "/api/v1/calendar?month=bad-month",
            headers={"Authorization": "Bearer fake"},
        )
        assert resp.status_code == 422
    finally:
        app.dependency_overrides.pop(get_current_user, None)
