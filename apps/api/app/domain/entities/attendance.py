from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from uuid import UUID


@dataclass
class ClassSession:
    id: UUID
    class_id: UUID
    date: date
    notes: str | None
    created_at: datetime


@dataclass
class AttendanceRecord:
    id: UUID
    session_id: UUID
    student_id: UUID
    status: str   # "present" | "absent" | "late"
    note: str | None
    marked_at: datetime
