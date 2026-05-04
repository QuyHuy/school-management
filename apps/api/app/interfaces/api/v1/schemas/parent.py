from __future__ import annotations

from datetime import date
from uuid import UUID

from pydantic import BaseModel


class ChildClassSchema(BaseModel):
    class_id: UUID
    name: str
    subject: str
    academic_year: str
    is_active: bool

    model_config = {"from_attributes": True}


class ChildInfoSchema(BaseModel):
    student_id: UUID
    student_name: str
    date_of_birth: date | None
    classes: list[ChildClassSchema]

    model_config = {"from_attributes": True}


class ChildGradeRowSchema(BaseModel):
    exam_id: UUID
    class_id: UUID
    class_name: str
    exam_title: str
    exam_type: str
    exam_date: date | None
    max_score: float
    score: float | None
    note: str | None

    model_config = {"from_attributes": True}


class ChildAttendanceRowSchema(BaseModel):
    session_id: UUID
    class_id: UUID
    class_name: str
    date: date
    status: str | None
    note: str | None

    model_config = {"from_attributes": True}
