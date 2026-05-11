from __future__ import annotations

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.admin.create_teacher import CreateTeacherInput, CreateTeacherUseCase
from app.application.use_cases.admin.get_admin_dashboard import GetAdminDashboardUseCase
from app.application.use_cases.admin.get_report_attendance import GetReportAttendanceUseCase
from app.application.use_cases.admin.get_report_grades import GetReportGradesUseCase
from app.application.use_cases.admin.get_settings import GetSettingsUseCase
from app.application.use_cases.admin.get_teacher import GetTeacherUseCase
from app.application.use_cases.admin.list_teachers import ListTeachersUseCase
from app.application.use_cases.admin.reset_password import ResetPasswordUseCase
from app.application.use_cases.admin.toggle_teacher import ToggleTeacherUseCase
from app.application.use_cases.admin.update_settings import UpdateSettingsInput, UpdateSettingsUseCase
from app.application.use_cases.admin.update_teacher import UpdateTeacherInput, UpdateTeacherUseCase
from app.infrastructure.db.repositories.user_repository import SQLUserRepository
from app.infrastructure.db.session import get_db
from app.interfaces.api.v1.dependencies import require_role
from app.interfaces.api.v1.schemas.admin import (
    AdminDashboardSchema,
    AttendanceReportResponse,
    AttendanceReportRowSchema,
    CreateTeacherRequest,
    GradeReportResponse,
    GradeReportRowSchema,
    OrgSettingsSchema,
    ResetPasswordRequest,
    TeacherClassInfoSchema,
    TeacherDetailSchema,
    TeacherInfoSchema,
    UpdateTeacherRequest,
)

router = APIRouter()
_admin = require_role("admin")


def _teacher_info(t) -> TeacherInfoSchema:
    return TeacherInfoSchema(
        id=t.id, name=t.name, email=t.email, phone=t.phone,
        is_active=t.is_active, created_at=t.created_at,
        class_count=t.class_count, student_count=t.student_count,
        sessions_this_month=t.sessions_this_month,
    )


def _teacher_detail(t) -> TeacherDetailSchema:
    return TeacherDetailSchema(
        id=t.id, name=t.name, email=t.email, phone=t.phone,
        is_active=t.is_active, created_at=t.created_at,
        classes=[
            TeacherClassInfoSchema(
                id=c.id, name=c.name, subject=c.subject,
                academic_year=c.academic_year, is_active=c.is_active,
                student_count=c.student_count,
            )
            for c in t.classes
        ],
        total_students=t.total_students,
    )


@router.get("/dashboard", response_model=AdminDashboardSchema)
async def get_dashboard(token=Depends(_admin), db: AsyncSession = Depends(get_db)):
    result = await GetAdminDashboardUseCase(db).execute(token.org_id)
    return AdminDashboardSchema(
        total_teachers=result.total_teachers,
        total_classes=result.total_classes,
        total_students=result.total_students,
        total_active_classes=result.total_active_classes,
        attendance_rate_this_month=result.attendance_rate_this_month,
        sessions_this_month=result.sessions_this_month,
        teachers=[_teacher_info(t) for t in result.teachers],
    )


@router.get("/teachers", response_model=list[TeacherInfoSchema])
async def list_teachers(token=Depends(_admin), db: AsyncSession = Depends(get_db)):
    teachers = await ListTeachersUseCase(db).execute(token.org_id)
    return [_teacher_info(t) for t in teachers]


@router.post("/teachers", response_model=TeacherDetailSchema, status_code=201)
async def create_teacher(
    body: CreateTeacherRequest,
    token=Depends(_admin),
    db: AsyncSession = Depends(get_db),
):
    user_repo = SQLUserRepository(db)
    user = await CreateTeacherUseCase(user_repo).execute(
        token.org_id,
        CreateTeacherInput(name=body.name, email=body.email, password=body.password, phone=body.phone),
    )
    detail = await GetTeacherUseCase(db, user_repo).execute(user.id, token.org_id)
    return _teacher_detail(detail)


@router.get("/teachers/{teacher_id}", response_model=TeacherDetailSchema)
async def get_teacher(
    teacher_id: UUID,
    token=Depends(_admin),
    db: AsyncSession = Depends(get_db),
):
    detail = await GetTeacherUseCase(db, SQLUserRepository(db)).execute(teacher_id, token.org_id)
    return _teacher_detail(detail)


@router.patch("/teachers/{teacher_id}", response_model=TeacherDetailSchema)
async def update_teacher(
    teacher_id: UUID,
    body: UpdateTeacherRequest,
    token=Depends(_admin),
    db: AsyncSession = Depends(get_db),
):
    user_repo = SQLUserRepository(db)
    await UpdateTeacherUseCase(user_repo).execute(
        teacher_id, token.org_id,
        UpdateTeacherInput(name=body.name, email=body.email, phone=body.phone),
    )
    detail = await GetTeacherUseCase(db, user_repo).execute(teacher_id, token.org_id)
    return _teacher_detail(detail)


@router.post("/teachers/{teacher_id}/reset-password", status_code=204)
async def reset_password(
    teacher_id: UUID,
    body: ResetPasswordRequest,
    token=Depends(_admin),
    db: AsyncSession = Depends(get_db),
):
    await ResetPasswordUseCase(SQLUserRepository(db)).execute(teacher_id, token.org_id, body.new_password)


@router.patch("/teachers/{teacher_id}/deactivate", response_model=TeacherDetailSchema)
async def toggle_teacher(
    teacher_id: UUID,
    token=Depends(_admin),
    db: AsyncSession = Depends(get_db),
):
    user_repo = SQLUserRepository(db)
    await ToggleTeacherUseCase(user_repo).execute(teacher_id, token.org_id)
    detail = await GetTeacherUseCase(db, user_repo).execute(teacher_id, token.org_id)
    return _teacher_detail(detail)


@router.get("/reports/attendance", response_model=AttendanceReportResponse)
async def report_attendance(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    teacher_id: UUID | None = Query(None),
    class_id: UUID | None = Query(None),
    token=Depends(_admin),
    db: AsyncSession = Depends(get_db),
):
    rows = await GetReportAttendanceUseCase(db).execute(
        token.org_id, date_from, date_to, teacher_id, class_id
    )
    return AttendanceReportResponse(rows=[
        AttendanceReportRowSchema(
            teacher_name=r.teacher_name, class_name=r.class_name, subject=r.subject,
            total_sessions=r.total_sessions, total_attendances=r.total_attendances,
            present=r.present, absent=r.absent, attendance_rate=r.attendance_rate,
        )
        for r in rows
    ])


@router.get("/reports/grades", response_model=GradeReportResponse)
async def report_grades(
    teacher_id: UUID | None = Query(None),
    class_id: UUID | None = Query(None),
    token=Depends(_admin),
    db: AsyncSession = Depends(get_db),
):
    rows = await GetReportGradesUseCase(db).execute(token.org_id, teacher_id, class_id)
    return GradeReportResponse(rows=[
        GradeReportRowSchema(
            teacher_name=r.teacher_name, class_name=r.class_name, subject=r.subject,
            student_count=r.student_count, avg_score=r.avg_score,
            min_score=r.min_score, max_score=r.max_score,
        )
        for r in rows
    ])


@router.get("/settings", response_model=OrgSettingsSchema)
async def get_settings(token=Depends(_admin), db: AsyncSession = Depends(get_db)):
    s = await GetSettingsUseCase(db).execute(token.org_id)
    return OrgSettingsSchema(
        name=s.name, phone=s.phone, address=s.address,
        academic_year=s.academic_year, logo_url=s.logo_url,
        zalo_oa_id=s.zalo_oa_id, zalo_oa_token=s.zalo_oa_token,
    )


@router.patch("/settings", response_model=OrgSettingsSchema)
async def update_settings(
    body: OrgSettingsSchema,
    token=Depends(_admin),
    db: AsyncSession = Depends(get_db),
):
    await UpdateSettingsUseCase(db).execute(
        token.org_id,
        UpdateSettingsInput(
            name=body.name, phone=body.phone, address=body.address,
            academic_year=body.academic_year, logo_url=body.logo_url,
            zalo_oa_id=body.zalo_oa_id, zalo_oa_token=body.zalo_oa_token,
        ),
    )
    s = await GetSettingsUseCase(db).execute(token.org_id)
    return OrgSettingsSchema(
        name=s.name, phone=s.phone, address=s.address,
        academic_year=s.academic_year, logo_url=s.logo_url,
        zalo_oa_id=s.zalo_oa_id, zalo_oa_token=s.zalo_oa_token,
    )
