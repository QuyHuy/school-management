from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from uuid import UUID


@dataclass
class Student:
    id: UUID
    organization_id: UUID
    name: str
    date_of_birth: date | None
    note: str | None
    parent_id: UUID | None   # FK to users (role=parent)
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None
