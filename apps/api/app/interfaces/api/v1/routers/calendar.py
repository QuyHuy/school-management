from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.calendar.get_calendar import GetCalendarUseCase
from app.infrastructure.db.repositories.attendance_repository import SQLAttendanceRepository
from app.infrastructure.db.repositories.class_repository import SQLClassRepository
from app.infrastructure.db.session import get_db
from app.interfaces.api.v1.dependencies import require_role
from app.interfaces.api.v1.schemas.calendar import (
    CalendarDataSchema,
    CalendarSessionSchema,
    CalendarSlotSchema,
)

router = APIRouter()
_teacher = require_role("teacher", "admin")

_MONTH_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


@router.get("/calendar", response_model=CalendarDataSchema)
async def get_calendar(
    month: str = Query(..., description="YYYY-MM"),
    token=Depends(_teacher),
    db: AsyncSession = Depends(get_db),
):
    if not _MONTH_RE.match(month):
        raise HTTPException(status_code=422, detail="month must be YYYY-MM format")
    year, month_int = int(month[:4]), int(month[5:])
    uc = GetCalendarUseCase(SQLClassRepository(db), SQLAttendanceRepository(db))
    result = await uc.execute(token.user_id, token.org_id, year, month_int)
    return CalendarDataSchema(
        sessions=[
            CalendarSessionSchema(
                id=s.id,
                class_id=s.class_id,
                class_name=s.class_name,
                date=s.date,
                start_time=s.start_time,
                end_time=s.end_time,
                has_attendance=s.has_attendance,
            )
            for s in result.sessions
        ],
        schedule_slots=[
            CalendarSlotSchema(
                class_id=sl.class_id,
                class_name=sl.class_name,
                date=sl.date,
                start_time=sl.start_time,
                end_time=sl.end_time,
            )
            for sl in result.schedule_slots
        ],
    )
