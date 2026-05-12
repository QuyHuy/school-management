from __future__ import annotations

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class CreateSessionRequest(BaseModel):
    date: date
    notes: str | None = None


class SessionResponse(BaseModel):
    id: UUID
    class_id: UUID
    date: date
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AttendanceRecordIn(BaseModel):
    student_id: UUID
    status: Literal["present", "absent", "late"]
    note: str | None = None


class MarkAttendanceRequest(BaseModel):
    records: list[AttendanceRecordIn]


class AttendanceRecordResponse(BaseModel):
    id: UUID
    session_id: UUID
    student_id: UUID
    status: str
    note: str | None
    marked_at: datetime

    model_config = {"from_attributes": True}


class UpdateSessionRequest(BaseModel):
    notes: str | None = None
