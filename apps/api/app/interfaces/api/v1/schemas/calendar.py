from __future__ import annotations

from datetime import date, time
from uuid import UUID

from pydantic import BaseModel


class CalendarSessionSchema(BaseModel):
    id: UUID
    class_id: UUID
    class_name: str
    date: date
    start_time: time | None
    end_time: time | None
    has_attendance: bool

    model_config = {"from_attributes": True}


class CalendarSlotSchema(BaseModel):
    class_id: UUID
    class_name: str
    date: date
    start_time: time
    end_time: time

    model_config = {"from_attributes": True}


class CalendarDataSchema(BaseModel):
    sessions: list[CalendarSessionSchema]
    schedule_slots: list[CalendarSlotSchema]
