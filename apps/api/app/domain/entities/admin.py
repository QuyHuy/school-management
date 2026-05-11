from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID


@dataclass
class TeacherClassInfo:
    id: UUID
    name: str
    subject: str
    academic_year: str
    is_active: bool
    student_count: int


@dataclass
class TeacherInfo:
    id: UUID
    name: str
    email: str | None
    phone: str | None
    is_active: bool
    created_at: datetime
    class_count: int
    student_count: int
    sessions_this_month: int


@dataclass
class TeacherDetail:
    id: UUID
    name: str
    email: str | None
    phone: str | None
    is_active: bool
    created_at: datetime
    classes: list[TeacherClassInfo] = field(default_factory=list)
    total_students: int = 0


@dataclass
class AdminDashboard:
    total_teachers: int
    total_classes: int
    total_students: int
    total_active_classes: int
    attendance_rate_this_month: float
    sessions_this_month: int
    teachers: list[TeacherInfo] = field(default_factory=list)


@dataclass
class AttendanceReportRow:
    teacher_name: str
    class_name: str
    subject: str
    total_sessions: int
    total_attendances: int
    present: int
    absent: int
    attendance_rate: float


@dataclass
class GradeReportRow:
    teacher_name: str
    class_name: str
    subject: str
    student_count: int
    avg_score: float
    min_score: float
    max_score: float


@dataclass
class OrgSettings:
    name: str
    phone: str | None
    address: str | None
    academic_year: str | None
    logo_url: str | None
    zalo_oa_id: str | None
    zalo_oa_token: str | None
