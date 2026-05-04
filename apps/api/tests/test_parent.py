import uuid
from datetime import date
from unittest.mock import AsyncMock, patch

from httpx import AsyncClient

from app.domain.entities.parent import ChildAttendanceRow, ChildClass, ChildGradeRow, ChildInfo
from app.domain.exceptions import ForbiddenError
from app.infrastructure.security.jwt import TokenData
from app.interfaces.api.v1.dependencies import get_current_user
from app.main import app

_ORG_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")
_PARENT_ID = uuid.UUID("00000000-0000-0000-0000-000000000005")
_STUDENT_ID = uuid.UUID("00000000-0000-0000-0000-000000000003")
_CLASS_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")
_EXAM_ID = uuid.UUID("00000000-0000-0000-0000-000000000030")
_SESSION_ID = uuid.UUID("00000000-0000-0000-0000-000000000020")
_TOKEN = TokenData(user_id=_PARENT_ID, org_id=_ORG_ID, role="parent", jti="j", exp=9999999999)

_CHILD_INFO = ChildInfo(
    student_id=_STUDENT_ID,
    student_name="Nguyễn Văn An",
    date_of_birth=date(2015, 3, 1),
    classes=[
        ChildClass(class_id=_CLASS_ID, name="Toán 10A", subject="Toán", academic_year="2025-2026", is_active=True)
    ],
)

_GRADE_ROW = ChildGradeRow(
    exam_id=_EXAM_ID,
    class_id=_CLASS_ID,
    class_name="Toán 10A",
    exam_title="Kiểm tra 15 phút",
    exam_type="quiz",
    exam_date=date(2026, 5, 10),
    max_score=10.0,
    score=8.5,
    note=None,
)

_ATTENDANCE_ROW = ChildAttendanceRow(
    session_id=_SESSION_ID,
    class_id=_CLASS_ID,
    class_name="Toán 10A",
    date=date(2026, 5, 3),
    status="present",
    note=None,
)


async def _override():
    return _TOKEN


async def test_list_children(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.parent.GetChildrenUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=[_CHILD_INFO])
            resp = await client.get(
                "/api/v1/parent/children",
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 200
        assert len(resp.json()) == 1
        assert resp.json()[0]["student_name"] == "Nguyễn Văn An"
        assert len(resp.json()[0]["classes"]) == 1
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_get_child_grades(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.parent.GetChildGradesUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=[_GRADE_ROW])
            resp = await client.get(
                f"/api/v1/parent/children/{_STUDENT_ID}/grades",
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 200
        assert resp.json()[0]["score"] == 8.5
        assert resp.json()[0]["exam_type"] == "quiz"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_get_child_grades_wrong_child(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.parent.GetChildGradesUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(side_effect=ForbiddenError("Not your child"))
            resp = await client.get(
                f"/api/v1/parent/children/{uuid.uuid4()}/grades",
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_get_child_attendance(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.parent.GetChildAttendanceUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=[_ATTENDANCE_ROW])
            resp = await client.get(
                f"/api/v1/parent/children/{_STUDENT_ID}/attendance",
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 200
        assert resp.json()[0]["status"] == "present"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_parent_endpoints_forbidden_for_teacher(client: AsyncClient):
    teacher_token = TokenData(
        user_id=uuid.uuid4(), org_id=_ORG_ID, role="teacher", jti="j2", exp=9999999999
    )

    async def _teacher_override():
        return teacher_token

    app.dependency_overrides[get_current_user] = _teacher_override
    try:
        resp = await client.get(
            "/api/v1/parent/children",
            headers={"Authorization": "Bearer fake"},
        )
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)
