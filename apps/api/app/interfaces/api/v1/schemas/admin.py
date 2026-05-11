from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class TeacherClassInfoSchema(BaseModel):
    id: UUID
    name: str
    subject: str
    academic_year: str
    is_active: bool
    student_count: int


class TeacherInfoSchema(BaseModel):
    id: UUID
    name: str
    email: str | None
    phone: str | None
    is_active: bool
    created_at: datetime
    class_count: int
    student_count: int
    sessions_this_month: int


class TeacherDetailSchema(BaseModel):
    id: UUID
    name: str
    email: str | None
    phone: str | None
    is_active: bool
    created_at: datetime
    classes: list[TeacherClassInfoSchema]
    total_students: int


class AdminDashboardSchema(BaseModel):
    total_teachers: int
    total_classes: int
    total_students: int
    total_active_classes: int
    attendance_rate_this_month: float
    sessions_this_month: int
    teachers: list[TeacherInfoSchema]


class AttendanceReportRowSchema(BaseModel):
    teacher_name: str
    class_name: str
    subject: str
    total_sessions: int
    total_attendances: int
    present: int
    absent: int
    attendance_rate: float


class GradeReportRowSchema(BaseModel):
    teacher_name: str
    class_name: str
    subject: str
    student_count: int
    avg_score: float
    min_score: float
    max_score: float


class OrgSettingsSchema(BaseModel):
    name: str
    phone: str | None = None
    address: str | None = None
    academic_year: str | None = None
    logo_url: str | None = None
    zalo_oa_id: str | None = None
    zalo_oa_token: str | None = None


class AttendanceReportResponse(BaseModel):
    rows: list[AttendanceReportRowSchema]


class GradeReportResponse(BaseModel):
    rows: list[GradeReportRowSchema]


class CreateTeacherRequest(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=8)
    phone: str | None = None


class UpdateTeacherRequest(BaseModel):
    name: str
    email: EmailStr
    phone: str | None = None


class ResetPasswordRequest(BaseModel):
    new_password: str = Field(min_length=8)


class UpdateSettingsRequest(BaseModel):
    name: str | None = None
    phone: str | None = None
    address: str | None = None
    academic_year: str | None = None
    logo_url: str | None = None
    zalo_oa_id: str | None = None
    zalo_oa_token: str | None = None
