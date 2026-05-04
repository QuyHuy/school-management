from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from uuid import UUID


@dataclass
class ChildClass:
    class_id: UUID
    name: str
    subject: str
    academic_year: str
    is_active: bool


@dataclass
class ChildInfo:
    student_id: UUID
    student_name: str
    date_of_birth: date | None
    classes: list[ChildClass]


@dataclass
class ChildGradeRow:
    exam_id: UUID
    class_id: UUID
    class_name: str
    exam_title: str
    exam_type: str
    exam_date: date | None
    max_score: float
    score: float | None
    note: str | None


@dataclass
class ChildAttendanceRow:
    session_id: UUID
    class_id: UUID
    class_name: str
    date: date
    status: str | None
    note: str | None
