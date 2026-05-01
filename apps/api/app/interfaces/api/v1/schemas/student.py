from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel


class CreateStudentRequest(BaseModel):
    name: str
    date_of_birth: date | None = None
    note: str | None = None


class StudentResponse(BaseModel):
    id: UUID
    organization_id: UUID
    name: str
    date_of_birth: date | None
    note: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
