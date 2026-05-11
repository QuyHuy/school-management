import uuid
from unittest.mock import AsyncMock, patch

from httpx import AsyncClient

from app.domain.entities.admin import AdminDashboard, OrgSettings, TeacherDetail, TeacherInfo
from app.infrastructure.security.jwt import TokenData
from app.interfaces.api.v1.dependencies import get_current_user
from app.main import app

_ORG_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")
_ADMIN_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
_TEACHER_ID = uuid.UUID("00000000-0000-0000-0000-000000000003")

_ADMIN_TOKEN = TokenData(user_id=_ADMIN_ID, org_id=_ORG_ID, role="admin", jti="j", exp=9999999999)

import datetime as _dt
_NOW = _dt.datetime(2026, 1, 1, tzinfo=_dt.timezone.utc)

_TEACHER_INFO = TeacherInfo(
    id=_TEACHER_ID, name="Nguyễn Văn A", email="a@test.com", phone=None,
    is_active=True, created_at=_NOW, class_count=2, student_count=30, sessions_this_month=4,
)

_TEACHER_DETAIL = TeacherDetail(
    id=_TEACHER_ID, name="Nguyễn Văn A", email="a@test.com", phone=None,
    is_active=True, created_at=_NOW, classes=[], total_students=0,
)


async def _admin_override():
    return _ADMIN_TOKEN


async def test_get_dashboard(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _admin_override
    try:
        dashboard = AdminDashboard(
            total_teachers=1, total_classes=2, total_students=30,
            total_active_classes=2, attendance_rate_this_month=90.0,
            sessions_this_month=4, teachers=[_TEACHER_INFO],
        )
        with patch("app.interfaces.api.v1.routers.admin.GetAdminDashboardUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=dashboard)
            resp = await client.get("/api/v1/admin/dashboard", headers={"Authorization": "Bearer fake"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_teachers"] == 1
        assert data["attendance_rate_this_month"] == 90.0
        assert len(data["teachers"]) == 1
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_list_teachers(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _admin_override
    try:
        with patch("app.interfaces.api.v1.routers.admin.ListTeachersUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=[_TEACHER_INFO])
            resp = await client.get("/api/v1/admin/teachers", headers={"Authorization": "Bearer fake"})
        assert resp.status_code == 200
        assert resp.json()[0]["name"] == "Nguyễn Văn A"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_toggle_teacher(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _admin_override
    try:
        deactivated = TeacherDetail(
            id=_TEACHER_ID, name="Nguyễn Văn A", email="a@test.com", phone=None,
            is_active=False, created_at=_NOW, classes=[], total_students=0,
        )
        with patch("app.interfaces.api.v1.routers.admin.ToggleTeacherUseCase") as MockToggle, \
             patch("app.interfaces.api.v1.routers.admin.GetTeacherUseCase") as MockGet:
            MockToggle.return_value.execute = AsyncMock(return_value=False)
            MockGet.return_value.execute = AsyncMock(return_value=deactivated)
            resp = await client.patch(
                f"/api/v1/admin/teachers/{_TEACHER_ID}/deactivate",
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 200
        assert resp.json()["is_active"] is False
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_get_settings(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _admin_override
    try:
        settings = OrgSettings(
            name="EduCenter", phone="0901234567", address="HCM",
            academic_year="2025-2026", logo_url=None, zalo_oa_id=None, zalo_oa_token=None,
        )
        with patch("app.interfaces.api.v1.routers.admin.GetSettingsUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=settings)
            resp = await client.get("/api/v1/admin/settings", headers={"Authorization": "Bearer fake"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "EduCenter"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_admin_endpoint_requires_admin_role(client: AsyncClient):
    teacher_token = TokenData(user_id=_TEACHER_ID, org_id=_ORG_ID, role="teacher", jti="j2", exp=9999999999)

    async def _teacher_override():
        return teacher_token

    app.dependency_overrides[get_current_user] = _teacher_override
    try:
        resp = await client.get("/api/v1/admin/dashboard", headers={"Authorization": "Bearer fake"})
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)
