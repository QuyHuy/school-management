import uuid
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, patch

from httpx import AsyncClient

from app.domain.entities.exam import Exam, Grade
from app.domain.exceptions import NotFoundError
from app.infrastructure.security.jwt import TokenData
from app.interfaces.api.v1.dependencies import get_current_user
from app.main import app

_ORG_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")
_TEACHER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
_CLASS_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")
_EXAM_ID = uuid.UUID("00000000-0000-0000-0000-000000000030")
_STUDENT_ID = uuid.UUID("00000000-0000-0000-0000-000000000003")
_TOKEN = TokenData(user_id=_TEACHER_ID, org_id=_ORG_ID, role="teacher", jti="j", exp=9999999999)
_NOW = datetime(2026, 5, 4, tzinfo=timezone.utc)

_EXAM = Exam(
    id=_EXAM_ID,
    class_id=_CLASS_ID,
    organization_id=_ORG_ID,
    title="Kiểm tra 15 phút",
    type="quiz",
    max_score=10.0,
    weight_percent=10,
    exam_date=date(2026, 5, 10),
    created_at=_NOW,
    updated_at=_NOW,
    deleted_at=None,
)

_GRADE = Grade(
    id=uuid.uuid4(),
    exam_id=_EXAM_ID,
    student_id=_STUDENT_ID,
    score=8.5,
    note=None,
    graded_by=_TEACHER_ID,
    graded_at=_NOW,
)


async def _override():
    return _TOKEN


async def test_create_exam(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.exams.CreateExamUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=_EXAM)
            resp = await client.post(
                f"/api/v1/classes/{_CLASS_ID}/exams",
                json={"title": "Kiểm tra 15 phút", "type": "quiz", "max_score": 10.0, "weight_percent": 10, "exam_date": "2026-05-10"},
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 201
        assert resp.json()["title"] == "Kiểm tra 15 phút"
        assert resp.json()["type"] == "quiz"
        assert resp.json()["max_score"] == 10.0
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_create_exam_invalid_type(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        resp = await client.post(
            f"/api/v1/classes/{_CLASS_ID}/exams",
            json={"title": "Bad", "type": "unknown", "max_score": 10.0},
            headers={"Authorization": "Bearer fake"},
        )
        assert resp.status_code == 422
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_create_exam_invalid_weight(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        resp = await client.post(
            f"/api/v1/classes/{_CLASS_ID}/exams",
            json={"title": "Bad", "type": "quiz", "max_score": 10.0, "weight_percent": 150},
            headers={"Authorization": "Bearer fake"},
        )
        assert resp.status_code == 422
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_list_exams(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.exams.ListExamsUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=[_EXAM])
            resp = await client.get(
                f"/api/v1/classes/{_CLASS_ID}/exams",
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 200
        assert len(resp.json()) == 1
        assert resp.json()[0]["id"] == str(_EXAM_ID)
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_delete_exam(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.exams.DeleteExamUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=None)
            resp = await client.delete(
                f"/api/v1/classes/{_CLASS_ID}/exams/{_EXAM_ID}",
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 204
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_delete_exam_not_found(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.exams.DeleteExamUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(
                side_effect=NotFoundError("Exam", str(_EXAM_ID))
            )
            resp = await client.delete(
                f"/api/v1/classes/{_CLASS_ID}/exams/{_EXAM_ID}",
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 404
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_bulk_upsert_grades(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.exams.BulkUpsertGradesUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=[_GRADE])
            resp = await client.post(
                f"/api/v1/classes/{_CLASS_ID}/exams/{_EXAM_ID}/grades",
                json={"grades": [{"student_id": str(_STUDENT_ID), "score": 8.5}]},
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 200
        assert len(resp.json()) == 1
        assert resp.json()[0]["score"] == 8.5
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_list_grades(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.exams.ListGradesUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=[_GRADE])
            resp = await client.get(
                f"/api/v1/classes/{_CLASS_ID}/exams/{_EXAM_ID}/grades",
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 200
        assert resp.json()[0]["student_id"] == str(_STUDENT_ID)
    finally:
        app.dependency_overrides.pop(get_current_user, None)
