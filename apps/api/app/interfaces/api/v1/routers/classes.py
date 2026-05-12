from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.classes.add_schedule import AddScheduleUseCase
from app.application.use_cases.classes.create_class import CreateClassUseCase
from app.application.use_cases.classes.delete_schedule import DeleteScheduleUseCase
from app.application.use_cases.classes.enroll_student import EnrollStudentUseCase
from app.application.use_cases.classes.get_class import GetClassUseCase
from app.application.use_cases.classes.list_classes import ListClassesUseCase
from app.application.use_cases.classes.list_enrollments import ListEnrollmentsUseCase
from app.application.use_cases.classes.list_schedules import ListSchedulesUseCase
from app.application.use_cases.classes.unenroll_student import UnenrollStudentUseCase
from app.infrastructure.db.repositories.class_repository import SQLClassRepository
from app.infrastructure.db.repositories.student_repository import SQLStudentRepository
from app.infrastructure.db.session import get_db
from app.interfaces.api.v1.dependencies import require_role
from app.interfaces.api.v1.schemas.class_ import (
    AddScheduleRequest,
    ClassResponse,
    CreateClassRequest,
    EnrollmentResponse,
    EnrollRequest,
    ScheduleResponse,
)

router = APIRouter()
_teacher = require_role("teacher", "admin")


@router.post("", response_model=ClassResponse, status_code=201)
async def create_class(
    body: CreateClassRequest,
    token=Depends(_teacher),
    db: AsyncSession = Depends(get_db),
):
    uc = CreateClassUseCase(SQLClassRepository(db))
    return await uc.execute(token.org_id, token.user_id, body.name, body.subject, body.academic_year, body.grade)


@router.get("", response_model=list[ClassResponse])
async def list_classes(
    token=Depends(_teacher),
    db: AsyncSession = Depends(get_db),
):
    uc = ListClassesUseCase(SQLClassRepository(db))
    return await uc.execute(token.user_id, token.org_id)


@router.get("/{class_id}", response_model=ClassResponse)
async def get_class(
    class_id: UUID,
    token=Depends(_teacher),
    db: AsyncSession = Depends(get_db),
):
    uc = GetClassUseCase(SQLClassRepository(db))
    return await uc.execute(class_id, token.org_id)


@router.post("/{class_id}/schedules", response_model=ScheduleResponse, status_code=201)
async def add_schedule(
    class_id: UUID,
    body: AddScheduleRequest,
    token=Depends(_teacher),
    db: AsyncSession = Depends(get_db),
):
    uc = AddScheduleUseCase(SQLClassRepository(db))
    return await uc.execute(class_id, token.org_id, body.day_of_week, body.start_time, body.end_time)


@router.get("/{class_id}/schedules", response_model=list[ScheduleResponse])
async def list_schedules(
    class_id: UUID,
    token=Depends(_teacher),
    db: AsyncSession = Depends(get_db),
):
    uc = ListSchedulesUseCase(SQLClassRepository(db))
    return await uc.execute(class_id, token.org_id)


@router.delete("/{class_id}/schedules/{schedule_id}", status_code=204)
async def delete_schedule(
    class_id: UUID,
    schedule_id: UUID,
    token=Depends(_teacher),
    db: AsyncSession = Depends(get_db),
):
    uc = DeleteScheduleUseCase(SQLClassRepository(db))
    await uc.execute(class_id, schedule_id, token.org_id)
    return Response(status_code=204)


@router.post("/{class_id}/enrollments", response_model=EnrollmentResponse, status_code=201)
async def enroll_student(
    class_id: UUID,
    body: EnrollRequest,
    token=Depends(_teacher),
    db: AsyncSession = Depends(get_db),
):
    uc = EnrollStudentUseCase(SQLClassRepository(db), SQLStudentRepository(db))
    return await uc.execute(class_id, body.student_id, token.org_id, body.parent_id)


@router.get("/{class_id}/enrollments", response_model=list[EnrollmentResponse])
async def list_enrollments(
    class_id: UUID,
    token=Depends(_teacher),
    db: AsyncSession = Depends(get_db),
):
    uc = ListEnrollmentsUseCase(SQLClassRepository(db))
    return await uc.execute(class_id, token.org_id)


@router.delete("/{class_id}/enrollments/{student_id}", status_code=204)
async def unenroll_student(
    class_id: UUID,
    student_id: UUID,
    token=Depends(_teacher),
    db: AsyncSession = Depends(get_db),
):
    uc = UnenrollStudentUseCase(SQLClassRepository(db))
    await uc.execute(class_id, student_id, token.org_id)
    return Response(status_code=204)
