from __future__ import annotations

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, field_validator


ExamType = Literal["quiz", "midterm", "final", "assignment"]


class CreateExamRequest(BaseModel):
    title: str
    type: ExamType
    max_score: float
    weight_percent: int = 0
    exam_date: date | None = None

    @field_validator("max_score")
    @classmethod
    def positive_score(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("max_score must be > 0")
        return v

    @field_validator("weight_percent")
    @classmethod
    def valid_weight(cls, v: int) -> int:
        if not 0 <= v <= 100:
            raise ValueError("weight_percent must be 0-100")
        return v


class ExamResponse(BaseModel):
    id: UUID
    class_id: UUID
    organization_id: UUID
    title: str
    type: str
    max_score: float
    weight_percent: int
    exam_date: date | None
    created_at: datetime

    model_config = {"from_attributes": True}


class GradeIn(BaseModel):
    student_id: UUID
    score: float
    note: str | None = None


class BulkUpsertGradesRequest(BaseModel):
    grades: list[GradeIn]


class GradeResponse(BaseModel):
    id: UUID
    exam_id: UUID
    student_id: UUID
    score: float
    note: str | None
    graded_by: UUID
    graded_at: datetime

    model_config = {"from_attributes": True}
