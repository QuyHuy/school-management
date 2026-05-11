from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from uuid import UUID


@dataclass
class Student:
    id: UUID
    organization_id: UUID
    name: str
    student_code: str | None
    grade: int | None
    date_of_birth: date | None
    note: str | None
    parent_id: UUID | None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None
