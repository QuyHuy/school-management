import uuid
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock

import pytest

from app.application.use_cases.attendance.create_session import CreateSessionUseCase
from app.application.use_cases.attendance.get_session import GetSessionUseCase
from app.application.use_cases.attendance.list_attendance import ListAttendanceUseCase
from app.application.use_cases.attendance.list_sessions import ListSessionsUseCase
from app.application.use_cases.attendance.mark_attendance import MarkAttendanceUseCase
from app.domain.entities.attendance import AttendanceRecord, ClassSession
from app.domain.entities.class_ import Class
from app.domain.exceptions import ConflictError, NotFoundError

_ORG_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")
_CLASS_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")
_SESSION_ID = uuid.UUID("00000000-0000-0000-0000-000000000020")
_STUDENT_ID = uuid.UUID("00000000-0000-0000-0000-000000000003")
_NOW = datetime(2026, 5, 1, tzinfo=timezone.utc)

_CLASS = Class(
    id=_CLASS_ID, organization_id=_ORG_ID, teacher_id=uuid.uuid4(),
    name="Toán 10A", subject="Toán", academic_year="2025-2026",
    is_active=True, created_at=_NOW, updated_at=_NOW, deleted_at=None,
)
_SESSION = ClassSession(
    id=_SESSION_ID, class_id=_CLASS_ID,
    date=date(2026, 5, 1), notes=None, created_at=_NOW,
)
_RECORD = AttendanceRecord(
    id=uuid.uuid4(), session_id=_SESSION_ID, student_id=_STUDENT_ID,
    status="present", note=None, marked_at=_NOW,
)


@pytest.mark.asyncio
async def test_create_session_class_not_found():
    class_repo = AsyncMock()
    class_repo.get_by_id.return_value = None
    att_repo = AsyncMock()
    with pytest.raises(NotFoundError):
        await CreateSessionUseCase(class_repo, att_repo).execute(
            _CLASS_ID, _ORG_ID, date(2026, 5, 1), None
        )


@pytest.mark.asyncio
async def test_create_session_duplicate_date():
    class_repo = AsyncMock()
    class_repo.get_by_id.return_value = _CLASS
    att_repo = AsyncMock()
    att_repo.session_exists_for_date.return_value = True
    with pytest.raises(ConflictError):
        await CreateSessionUseCase(class_repo, att_repo).execute(
            _CLASS_ID, _ORG_ID, date(2026, 5, 1), None
        )


@pytest.mark.asyncio
async def test_create_session_success():
    class_repo = AsyncMock()
    class_repo.get_by_id.return_value = _CLASS
    att_repo = AsyncMock()
    att_repo.session_exists_for_date.return_value = False
    att_repo.create_session.return_value = _SESSION
    result = await CreateSessionUseCase(class_repo, att_repo).execute(
        _CLASS_ID, _ORG_ID, date(2026, 5, 1), None
    )
    assert result.class_id == _CLASS_ID
    att_repo.create_session.assert_called_once()


@pytest.mark.asyncio
async def test_mark_attendance_session_not_found():
    class_repo = AsyncMock()
    class_repo.get_by_id.return_value = _CLASS
    att_repo = AsyncMock()
    att_repo.get_session.return_value = None
    with pytest.raises(NotFoundError):
        await MarkAttendanceUseCase(class_repo, att_repo).execute(
            _CLASS_ID, _SESSION_ID, _ORG_ID,
            [{"student_id": _STUDENT_ID, "status": "present", "note": None}],
        )


@pytest.mark.asyncio
async def test_mark_attendance_success():
    class_repo = AsyncMock()
    class_repo.get_by_id.return_value = _CLASS
    att_repo = AsyncMock()
    att_repo.get_session.return_value = _SESSION
    att_repo.bulk_upsert_attendance.return_value = [_RECORD]
    results = await MarkAttendanceUseCase(class_repo, att_repo).execute(
        _CLASS_ID, _SESSION_ID, _ORG_ID,
        [{"student_id": _STUDENT_ID, "status": "present", "note": None}],
    )
    assert len(results) == 1
    assert results[0].status == "present"
