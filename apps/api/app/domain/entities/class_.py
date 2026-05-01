from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time
from uuid import UUID


@dataclass
class Class:
    id: UUID
    organization_id: UUID
    teacher_id: UUID
    name: str
    subject: str
    academic_year: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None


@dataclass
class ClassSchedule:
    id: UUID
    class_id: UUID
    day_of_week: int   # 0=Monday … 6=Sunday
    start_time: time
    end_time: time


@dataclass
class Enrollment:
    id: UUID
    class_id: UUID
    student_id: UUID
    parent_id: UUID | None
    enrolled_at: datetime
