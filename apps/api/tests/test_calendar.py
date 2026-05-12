import uuid
from datetime import UTC, date, time
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


async def test_get_calendar_use_case_slot_logic():
    """Verify schedule-slot vs session split in GetCalendarUseCase."""
    from datetime import datetime
    from unittest.mock import AsyncMock
    from uuid import UUID

    from app.application.use_cases.calendar.get_calendar import GetCalendarUseCase
    from app.domain.entities.attendance import ClassSession
    from app.domain.entities.calendar import CalendarData
    from app.domain.entities.class_ import Class, ClassSchedule

    class_id = UUID("10000000-0000-0000-0000-000000000001")
    session_id = UUID("20000000-0000-0000-0000-000000000001")
    _now = datetime(2026, 1, 1, tzinfo=UTC)

    # May 2026: Tuesdays are 5, 12, 19, 26
    # We have a session on May 12 (Tuesday) — it should be a CalendarSession
    # May 5, 19, 26 have no session — they should be CalendarSlots

    mock_class = Class(
        id=class_id,
        organization_id=UUID("00000000-0000-0000-0000-000000000002"),
        teacher_id=UUID("00000000-0000-0000-0000-000000000001"),
        name="Toán 10A",
        subject="Toán học",
        academic_year="2025-2026",
        grade=10,
        is_active=True,
        created_at=_now,
        updated_at=_now,
        deleted_at=None,
    )
    mock_schedule = ClassSchedule(
        id=UUID("30000000-0000-0000-0000-000000000001"),
        class_id=class_id,
        day_of_week=1,  # Tuesday
        start_time=time(7, 30),
        end_time=time(9, 0),
    )
    mock_session = ClassSession(
        id=session_id,
        class_id=class_id,
        date=date(2026, 5, 12),  # a Tuesday
        notes=None,
        created_at=_now,
    )

    class_repo = AsyncMock()
    class_repo.list_by_teacher.return_value = [mock_class]
    class_repo.list_schedules.return_value = [mock_schedule]

    att_repo = AsyncMock()
    att_repo.list_sessions_in_month.return_value = [mock_session]
    att_repo.session_ids_with_attendance.return_value = set()

    uc = GetCalendarUseCase(class_repo, att_repo)
    result: CalendarData = await uc.execute(
        teacher_id=mock_class.teacher_id,
        org_id=mock_class.organization_id,
        year=2026,
        month=5,
    )

    # 4 Tuesdays in May 2026: 5, 12, 19, 26
    # May 12 has a session → CalendarSession
    assert len(result.sessions) == 1
    assert result.sessions[0].date == date(2026, 5, 12)
    assert result.sessions[0].has_attendance is False

    # May 5, 19, 26 are slots → CalendarSlot
    assert len(result.schedule_slots) == 3
    slot_dates = {sl.date for sl in result.schedule_slots}
    assert slot_dates == {date(2026, 5, 5), date(2026, 5, 19), date(2026, 5, 26)}
