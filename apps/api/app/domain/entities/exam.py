from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from uuid import UUID


@dataclass
class Exam:
    id: UUID
    class_id: UUID
    organization_id: UUID
    title: str
    type: str           # "quiz" | "midterm" | "final" | "assignment"
    max_score: float
    weight_percent: int  # 0-100
    exam_date: date | None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None


@dataclass
class Grade:
    id: UUID
    exam_id: UUID
    student_id: UUID
    score: float
    note: str | None
    graded_by: UUID
    graded_at: datetime
