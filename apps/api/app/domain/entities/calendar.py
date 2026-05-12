from __future__ import annotations

from dataclasses import dataclass
from datetime import date, time
from uuid import UUID


@dataclass
class CalendarSession:
    id: UUID
    class_id: UUID
    class_name: str
    date: date
    start_time: time | None
    end_time: time | None
    has_attendance: bool


@dataclass
class CalendarSlot:
    class_id: UUID
    class_name: str
    date: date
    start_time: time
    end_time: time


@dataclass
class CalendarData:
    sessions: list[CalendarSession]
    schedule_slots: list[CalendarSlot]
