import uuid
from datetime import date, time, timedelta
from unittest.mock import AsyncMock, patch

from httpx import AsyncClient

from app.domain.entities.dashboard import DashboardSummary, PendingSession, TodayClass
from app.infrastructure.security.jwt import TokenData
from app.interfaces.api.v1.dependencies import get_current_user
from app.main import app

_ORG_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")
_TEACHER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
_CLASS_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")
_SESSION_ID = uuid.UUID("00000000-0000-0000-0000-000000000020")
_TOKEN = TokenData(user_id=_TEACHER_ID, org_id=_ORG_ID, role="teacher", jti="j", exp=9999999999)

_SUMMARY = DashboardSummary(
    active_classes_count=3,
    total_students_count=12,
    today_schedule=[
        TodayClass(
            class_id=_CLASS_ID,
            class_name="Toán 10A",
            subject="Toán",
            start_time=time(8, 0),
            end_time=time(10, 0),
        )
    ],
    pending_sessions=[
        PendingSession(
            session_id=_SESSION_ID,
            class_id=_CLASS_ID,
            class_name="Toán 10A",
            date=date.today() - timedelta(days=1),
        )
    ],
)


async def _override():
    return _TOKEN


async def test_get_dashboard(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch(
            "app.interfaces.api.v1.routers.dashboard.GetTeacherDashboardUseCase"
        ) as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=_SUMMARY)
            resp = await client.get(
                "/api/v1/dashboard",
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 200
        body = resp.json()
        assert body["active_classes_count"] == 3
        assert body["total_students_count"] == 12
        assert len(body["today_schedule"]) == 1
        assert body["today_schedule"][0]["class_name"] == "Toán 10A"
        assert len(body["pending_sessions"]) == 1
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_dashboard_forbidden_for_parent(client: AsyncClient):
    parent_token = TokenData(
        user_id=uuid.uuid4(), org_id=_ORG_ID, role="parent", jti="j2", exp=9999999999
    )

    async def _parent_override():
        return parent_token

    app.dependency_overrides[get_current_user] = _parent_override
    try:
        resp = await client.get(
            "/api/v1/dashboard",
            headers={"Authorization": "Bearer fake"},
        )
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)
