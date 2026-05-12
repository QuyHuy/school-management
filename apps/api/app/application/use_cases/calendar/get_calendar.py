from __future__ import annotations

import calendar as cal
from datetime import date
from uuid import UUID

from app.domain.entities.calendar import CalendarData, CalendarSession, CalendarSlot
from app.domain.repositories.attendance_repository import IAttendanceRepository
from app.domain.repositories.class_repository import IClassRepository


def _dates_in_month_for_dow(year: int, month: int, dow: int) -> list[date]:
    """Returns all dates in the month matching the given day_of_week (0=Mon..6=Sun)."""
    _, last_day = cal.monthrange(year, month)
    return [
        date(year, month, day)
        for day in range(1, last_day + 1)
        if date(year, month, day).weekday() == dow
    ]


class GetCalendarUseCase:
    def __init__(self, class_repo: IClassRepository, att_repo: IAttendanceRepository) -> None:
        self._class_repo = class_repo
        self._att_repo = att_repo

    async def execute(self, teacher_id: UUID, org_id: UUID, year: int, month: int) -> CalendarData:
        _, last_day = cal.monthrange(year, month)
        start = date(year, month, 1)
        end = date(year, month, last_day)

        classes = await self._class_repo.list_by_teacher(teacher_id, org_id)
        if not classes:
            return CalendarData(sessions=[], schedule_slots=[])

        class_map = {c.id: c for c in classes}
        sessions_in_month = await self._att_repo.list_sessions_in_month(
            [c.id for c in classes], start, end
        )
        session_map = {(s.class_id, s.date): s for s in sessions_in_month}
        attended_ids: set[UUID] = set()
        if sessions_in_month:
            attended_ids = await self._att_repo.session_ids_with_attendance(
                [s.id for s in sessions_in_month]
            )

        sessions_out: list[CalendarSession] = []
        slots_out: list[CalendarSlot] = []
        scheduled_session_ids: set[UUID] = set()

        # N+1: one query per class for schedules. Acceptable since teachers have <10 classes.
        for class_ in classes:
            schedules = await self._class_repo.list_schedules(class_.id)
            for schedule in schedules:
                for d in _dates_in_month_for_dow(year, month, schedule.day_of_week):
                    session = session_map.get((class_.id, d))
                    if session:
                        scheduled_session_ids.add(session.id)
                        sessions_out.append(CalendarSession(
                            id=session.id,
                            class_id=class_.id,
                            class_name=class_.name,
                            date=d,
                            start_time=schedule.start_time,
                            end_time=schedule.end_time,
                            has_attendance=session.id in attended_ids,
                        ))
                    else:
                        slots_out.append(CalendarSlot(
                            class_id=class_.id,
                            class_name=class_.name,
                            date=d,
                            start_time=schedule.start_time,
                            end_time=schedule.end_time,
                        ))

        # Ad-hoc sessions (not matching any schedule)
        for session in sessions_in_month:
            if session.id not in scheduled_session_ids:
                adhoc_class = class_map.get(session.class_id)
                if adhoc_class:
                    sessions_out.append(CalendarSession(
                        id=session.id,
                        class_id=session.class_id,
                        class_name=adhoc_class.name,
                        date=session.date,
                        start_time=None,
                        end_time=None,
                        has_attendance=session.id in attended_ids,
                    ))

        return CalendarData(sessions=sessions_out, schedule_slots=slots_out)
