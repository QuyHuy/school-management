from __future__ import annotations

from datetime import datetime, time
from uuid import UUID

from pydantic import BaseModel, field_validator


class CreateClassRequest(BaseModel):
    name: str
    subject: str
    academic_year: str
    grade: int | None = None

    @field_validator("grade")
    @classmethod
    def validate_grade(cls, v: int | None) -> int | None:
        if v is not None and not 1 <= v <= 12:
            raise ValueError("Khối học phải từ 1 đến 12")
        return v


class ClassResponse(BaseModel):
    id: UUID
    organization_id: UUID
    teacher_id: UUID
    name: str
    subject: str
    academic_year: str
    grade: int | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AddScheduleRequest(BaseModel):
    day_of_week: int      # 0=Monday ... 6=Sunday
    start_time: time
    end_time: time

    @field_validator("day_of_week")
    @classmethod
    def validate_day(cls, v: int) -> int:
        if not 0 <= v <= 6:
            raise ValueError("day_of_week must be 0-6")
        return v


class ScheduleResponse(BaseModel):
    id: UUID
    class_id: UUID
    day_of_week: int
    start_time: time
    end_time: time

    model_config = {"from_attributes": True}


class EnrollRequest(BaseModel):
    student_id: UUID
    parent_id: UUID | None = None


class EnrollmentResponse(BaseModel):
    id: UUID
    class_id: UUID
    student_id: UUID
    parent_id: UUID | None
    enrolled_at: datetime

    model_config = {"from_attributes": True}
