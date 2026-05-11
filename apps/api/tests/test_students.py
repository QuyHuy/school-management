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
    student_code=None,
    grade=None,
    date_of_birth=None,
    note=None,
    parent_id=None,
    created_at=_NOW,
    updated_at=_NOW,
    deleted_at=None,
)


async def _override():
    return _TOKEN


async def test_create_student_no_parent(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.students.CreateStudentUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=_STUDENT)
            resp = await client.post(
                "/api/v1/students",
                json={"name": "Nguyễn Văn A", "grade": 5},
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 201
        assert resp.json()["name"] == "Nguyễn Văn A"
        assert resp.json()["parent_id"] is None
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_create_student_with_parent(client: AsyncClient):
    _PARENT_ID = uuid.UUID("00000000-0000-0000-0000-000000000099")
    student_with_parent = Student(
        id=_STUDENT_ID, organization_id=_ORG_ID, name="Nguyễn Văn A",
        student_code=None, grade=None,
        date_of_birth=None, note=None, parent_id=_PARENT_ID,
        created_at=_NOW, updated_at=_NOW, deleted_at=None,
    )
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.students.CreateStudentUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=student_with_parent)
            resp = await client.post(
                "/api/v1/students",
                json={
                    "name": "Nguyễn Văn A",
                    "grade": 5,
                    "parent": {
                        "phone": "0901234567",
                        "name": "Nguyễn Văn Cha",
                        "password": "secret123",
                    },
                },
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 201
        assert resp.json()["parent_id"] == str(_PARENT_ID)
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_create_student_weak_password(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        resp = await client.post(
            "/api/v1/students",
            json={"name": "A", "grade": 1, "parent": {"phone": "0901111111", "name": "B", "password": "123"}},
            headers={"Authorization": "Bearer fake"},
        )
        assert resp.status_code == 422
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


async def test_get_student(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.students.GetStudentUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=_STUDENT)
            resp = await client.get(
                f"/api/v1/students/{_STUDENT_ID}",
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 200
        assert resp.json()["id"] == str(_STUDENT_ID)
        assert resp.json()["name"] == "Nguyễn Văn A"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_list_student_classes(client: AsyncClient):
    import datetime as _dt
    from app.domain.entities.class_ import Class
    _CLASS_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")
    _class = Class(
        id=_CLASS_ID, organization_id=_ORG_ID, teacher_id=_TEACHER_ID,
        name="Toán 10A", subject="Toán", academic_year="2025-2026",
        grade=None, is_active=True, created_at=_NOW, updated_at=_NOW, deleted_at=None,
    )
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.students.ListStudentClassesUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=[_class])
            resp = await client.get(
                f"/api/v1/students/{_STUDENT_ID}/classes",
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 200
        assert len(resp.json()) == 1
        assert resp.json()[0]["name"] == "Toán 10A"
    finally:
        app.dependency_overrides.pop(get_current_user, None)
