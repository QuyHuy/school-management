import uuid
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, patch

from httpx import AsyncClient

from app.domain.entities.attendance import AttendanceRecord, ClassSession
from app.domain.exceptions import ConflictError, NotFoundError
from app.infrastructure.security.jwt import TokenData
from app.interfaces.api.v1.dependencies import get_current_user
from app.main import app

_ORG_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")
_TEACHER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
_CLASS_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")
_SESSION_ID = uuid.UUID("00000000-0000-0000-0000-000000000020")
_STUDENT_ID = uuid.UUID("00000000-0000-0000-0000-000000000003")
_TOKEN = TokenData(user_id=_TEACHER_ID, org_id=_ORG_ID, role="teacher", jti="j", exp=9999999999)
_NOW = datetime(2026, 5, 1, tzinfo=timezone.utc)

_SESSION = ClassSession(
    id=_SESSION_ID, class_id=_CLASS_ID,
    date=date(2026, 5, 1), notes=None, created_at=_NOW,
)
_RECORD = AttendanceRecord(
    id=uuid.uuid4(), session_id=_SESSION_ID, student_id=_STUDENT_ID,
    status="present", note=None, marked_at=_NOW,
)


async def _override():
    return _TOKEN


async def test_create_session(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.attendance.CreateSessionUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=_SESSION)
            resp = await client.post(
                f"/api/v1/classes/{_CLASS_ID}/sessions",
                json={"date": "2026-05-01"},
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 201
        assert resp.json()["date"] == "2026-05-01"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_create_session_conflict(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.attendance.CreateSessionUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(
                side_effect=ConflictError("Session already exists for date 2026-05-01")
            )
            resp = await client.post(
                f"/api/v1/classes/{_CLASS_ID}/sessions",
                json={"date": "2026-05-01"},
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 409
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_list_sessions(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.attendance.ListSessionsUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=[_SESSION])
            resp = await client.get(
                f"/api/v1/classes/{_CLASS_ID}/sessions",
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 200
        assert len(resp.json()) == 1
        assert resp.json()[0]["class_id"] == str(_CLASS_ID)
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_mark_attendance(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.attendance.MarkAttendanceUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=[_RECORD])
            resp = await client.put(
                f"/api/v1/classes/{_CLASS_ID}/sessions/{_SESSION_ID}/attendance",
                json={"records": [{"student_id": str(_STUDENT_ID), "status": "present"}]},
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 200
        assert resp.json()[0]["status"] == "present"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_mark_attendance_session_not_found(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.attendance.MarkAttendanceUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(
                side_effect=NotFoundError("ClassSession", str(_SESSION_ID))
            )
            resp = await client.put(
                f"/api/v1/classes/{_CLASS_ID}/sessions/{_SESSION_ID}/attendance",
                json={"records": [{"student_id": str(_STUDENT_ID), "status": "present"}]},
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 404
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_list_attendance(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.attendance.ListAttendanceUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=[_RECORD])
            resp = await client.get(
                f"/api/v1/classes/{_CLASS_ID}/sessions/{_SESSION_ID}/attendance",
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 200
        assert resp.json()[0]["student_id"] == str(_STUDENT_ID)
    finally:
        app.dependency_overrides.pop(get_current_user, None)
