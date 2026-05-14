from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, time
from uuid import UUID


@dataclass
class ClassSession:
    id: UUID
    class_id: UUID
    date: date
    notes: str | None
    created_at: datetime
    mode: str = field(default="offline")
    start_time: time | None = field(default=None)
    meet_link: str | None = field(default=None)


@dataclass
class AttendanceRecord:
    id: UUID
    session_id: UUID
    student_id: UUID
    status: str   # "present" | "absent" | "late"
    note: str | None
    marked_at: datetime
