from __future__ import annotations

from datetime import date, time
from uuid import UUID

from pydantic import BaseModel


class TodayClassSchema(BaseModel):
    class_id: UUID
    class_name: str
    subject: str
    start_time: time
    end_time: time

    model_config = {"from_attributes": True}


class PendingSessionSchema(BaseModel):
    session_id: UUID
    class_id: UUID
    class_name: str
    date: date

    model_config = {"from_attributes": True}


class DashboardSummarySchema(BaseModel):
    active_classes_count: int
    total_students_count: int
    today_schedule: list[TodayClassSchema]
    pending_sessions: list[PendingSessionSchema]

    model_config = {"from_attributes": True}
