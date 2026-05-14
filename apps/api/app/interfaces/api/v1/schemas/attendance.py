from __future__ import annotations

from datetime import date, datetime, time
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, model_validator


class CreateSessionRequest(BaseModel):
    date: date
    notes: str | None = None
    mode: Literal["online", "offline"] = "offline"
    start_time: time | None = None

    @model_validator(mode="after")
    def start_time_required_for_online(self) -> CreateSessionRequest:
        if self.mode == "online" and self.start_time is None:
            raise ValueError("Giờ bắt đầu là bắt buộc khi học online")
        return self


class UpdateSessionRequest(BaseModel):
    notes: str | None = None
    mode: Literal["online", "offline"] | None = None
    start_time: time | None = None

    @model_validator(mode="after")
    def start_time_required_when_switching_to_online(self) -> UpdateSessionRequest:
        if self.mode == "online" and self.start_time is None:
            raise ValueError("Giờ bắt đầu là bắt buộc khi học online")
        return self


class SessionResponse(BaseModel):
    id: UUID
    class_id: UUID
    date: date
    notes: str | None
    created_at: datetime
    mode: Literal["online", "offline"]
    start_time: time | None
    meet_link: str | None

    model_config = {"from_attributes": True}


class NotifyMeetResponse(BaseModel):
    sent: bool
    message: str


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
