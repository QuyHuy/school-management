from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, field_validator


class ParentRequest(BaseModel):
    phone: str
    name: str | None = None
    email: EmailStr | None = None
    password: str | None = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str | None) -> str | None:
        if v is not None and len(v) < 6:
            raise ValueError("Mật khẩu phải có ít nhất 6 ký tự")
        return v


class CreateStudentRequest(BaseModel):
    name: str
    grade: int
    date_of_birth: date | None = None
    note: str | None = None
    parent: ParentRequest | None = None

    @field_validator("grade")
    @classmethod
    def validate_grade(cls, v: int) -> int:
        if not 1 <= v <= 12:
            raise ValueError("Khối học phải từ 1 đến 12")
        return v


class CheckParentResponse(BaseModel):
    exists: bool
    is_parent: bool = True
    name: str | None = None
    phone: str | None = None
    email: str | None = None


class ParentInfo(BaseModel):
    name: str
    email: str
    phone: str | None

    model_config = {"from_attributes": True}


class StudentResponse(BaseModel):
    id: UUID
    organization_id: UUID
    name: str
    student_code: str | None
    grade: int | None
    date_of_birth: date | None
    note: str | None
    parent_id: UUID | None
    parent: ParentInfo | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ImportPreviewRow(BaseModel):
    row: int
    name: str
    grade: int | None = None
    date_of_birth: date | None = None
    note: str | None = None
    errors: list[str] = []

    model_config = {"from_attributes": True}


class ImportPreviewResponse(BaseModel):
    valid: list[ImportPreviewRow]
    invalid: list[ImportPreviewRow]
    total_rows: int


class ImportConfirmRequest(BaseModel):
    rows: list[ImportPreviewRow]


class ImportConfirmResponse(BaseModel):
    created: int
    failed: list[dict]
