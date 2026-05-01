import uuid
from unittest.mock import AsyncMock, patch

from httpx import AsyncClient

from app.domain.entities.student import Student
from app.infrastructure.security.jwt import TokenData
from app.interfaces.api.v1.dependencies import get_current_user
from app.main import app

_ORG_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")
_TEACHER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
_STUDENT_ID = uuid.UUID("00000000-0000-0000-0000-000000000003")

_TOKEN = TokenData(user_id=_TEACHER_ID, org_id=_ORG_ID, role="teacher", jti="j", exp=9999999999)

import datetime as _dt
_NOW = _dt.datetime(2026, 1, 1, tzinfo=_dt.timezone.utc)

_STUDENT = Student(
    id=_STUDENT_ID,
    organization_id=_ORG_ID,
    name="Nguyễn Văn A",
    date_of_birth=None,
    note=None,
    created_at=_NOW,
    updated_at=_NOW,
    deleted_at=None,
)


async def _override():
    return _TOKEN


async def test_create_student(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.students.CreateStudentUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=_STUDENT)
            resp = await client.post(
                "/api/v1/students",
                json={"name": "Nguyễn Văn A"},
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 201
        assert resp.json()["name"] == "Nguyễn Văn A"
        assert resp.json()["id"] == str(_STUDENT_ID)
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_list_students(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.students.ListStudentsUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=[_STUDENT])
            resp = await client.get("/api/v1/students", headers={"Authorization": "Bearer fake"})
        assert resp.status_code == 200
        assert len(resp.json()) == 1
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_get_student_not_found(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.students.GetStudentUseCase") as MockUC:
            from app.domain.exceptions import NotFoundError
            MockUC.return_value.execute = AsyncMock(side_effect=NotFoundError("Student", str(_STUDENT_ID)))
            resp = await client.get(
                f"/api/v1/students/{_STUDENT_ID}",
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 404
    finally:
        app.dependency_overrides.pop(get_current_user, None)
