from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, field_validator


class ParentRequest(BaseModel):
    name: str
    email: EmailStr
    phone: str | None = None
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Mật khẩu phải có ít nhất 6 ký tự")
        return v

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Tên không được để trống")
        return v.strip()


class CreateStudentRequest(BaseModel):
    name: str
    date_of_birth: date | None = None
    note: str | None = None
    parent: ParentRequest | None = None


class StudentResponse(BaseModel):
    id: UUID
    organization_id: UUID
    name: str
    date_of_birth: date | None
    note: str | None
    parent_id: UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}
