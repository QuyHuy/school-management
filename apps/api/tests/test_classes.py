import uuid
from datetime import datetime, time, timezone
from unittest.mock import AsyncMock, patch

from httpx import AsyncClient

from app.domain.entities.class_ import Class, ClassSchedule, Enrollment
from app.domain.exceptions import ConflictError, NotFoundError
from app.infrastructure.security.jwt import TokenData
from app.interfaces.api.v1.dependencies import get_current_user
from app.main import app

_ORG_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")
_TEACHER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
_CLASS_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")
_STUDENT_ID = uuid.UUID("00000000-0000-0000-0000-000000000003")
_TOKEN = TokenData(user_id=_TEACHER_ID, org_id=_ORG_ID, role="teacher", jti="j", exp=9999999999)

_NOW = datetime(2026, 1, 1, tzinfo=timezone.utc)

_CLASS = Class(
    id=_CLASS_ID, organization_id=_ORG_ID, teacher_id=_TEACHER_ID,
    name="Toán 10A", subject="Toán", academic_year="2025-2026",
    is_active=True, created_at=_NOW, updated_at=_NOW, deleted_at=None,
)

_SCHEDULE = ClassSchedule(
    id=uuid.uuid4(), class_id=_CLASS_ID,
    day_of_week=0, start_time=time(8, 0), end_time=time(10, 0),
)

_ENROLLMENT = Enrollment(
    id=uuid.uuid4(), class_id=_CLASS_ID, student_id=_STUDENT_ID,
    parent_id=None, enrolled_at=_NOW,
)


async def _override():
    return _TOKEN


async def test_create_class(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.classes.CreateClassUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=_CLASS)
            resp = await client.post(
                "/api/v1/classes",
                json={"name": "Toán 10A", "subject": "Toán", "academic_year": "2025-2026"},
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 201
        assert resp.json()["name"] == "Toán 10A"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_list_classes(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.classes.ListClassesUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=[_CLASS])
            resp = await client.get("/api/v1/classes", headers={"Authorization": "Bearer fake"})
        assert resp.status_code == 200
        assert len(resp.json()) == 1
        assert resp.json()[0]["subject"] == "Toán"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_get_class_not_found(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.classes.GetClassUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(side_effect=NotFoundError("Class", str(_CLASS_ID)))
            resp = await client.get(
                f"/api/v1/classes/{_CLASS_ID}", headers={"Authorization": "Bearer fake"}
            )
        assert resp.status_code == 404
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_add_schedule(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.classes.AddScheduleUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=_SCHEDULE)
            resp = await client.post(
                f"/api/v1/classes/{_CLASS_ID}/schedules",
                json={"day_of_week": 0, "start_time": "08:00:00", "end_time": "10:00:00"},
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 201
        assert resp.json()["day_of_week"] == 0
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_enroll_student_conflict(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.classes.EnrollStudentUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(
                side_effect=ConflictError("Student already enrolled in this class")
            )
            resp = await client.post(
                f"/api/v1/classes/{_CLASS_ID}/enrollments",
                json={"student_id": str(_STUDENT_ID)},
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 409
    finally:
        app.dependency_overrides.pop(get_current_user, None)
