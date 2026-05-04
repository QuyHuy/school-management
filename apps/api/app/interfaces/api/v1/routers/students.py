from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.students.create_student import CreateStudentUseCase
from app.application.use_cases.students.get_student import GetStudentUseCase
from app.application.use_cases.students.list_student_classes import ListStudentClassesUseCase
from app.application.use_cases.students.list_students import ListStudentsUseCase
from app.infrastructure.db.repositories.class_repository import SQLClassRepository
from app.infrastructure.db.repositories.student_repository import SQLStudentRepository
from app.infrastructure.db.session import get_db
from app.interfaces.api.v1.dependencies import require_role
from app.interfaces.api.v1.schemas.class_ import ClassResponse
from app.interfaces.api.v1.schemas.student import CreateStudentRequest, StudentResponse

router = APIRouter()
_teacher_or_admin = require_role("teacher", "admin")


@router.post("", response_model=StudentResponse, status_code=201)
async def create_student(
    body: CreateStudentRequest,
    token=Depends(_teacher_or_admin),
    db: AsyncSession = Depends(get_db),
):
    uc = CreateStudentUseCase(SQLStudentRepository(db))
    return await uc.execute(token.org_id, body.name, body.date_of_birth, body.note)


@router.get("", response_model=list[StudentResponse])
async def list_students(
    token=Depends(_teacher_or_admin),
    db: AsyncSession = Depends(get_db),
):
    uc = ListStudentsUseCase(SQLStudentRepository(db))
    return await uc.execute(token.org_id)


@router.get("/{student_id}", response_model=StudentResponse)
async def get_student(
    student_id: UUID,
    token=Depends(_teacher_or_admin),
    db: AsyncSession = Depends(get_db),
):
    uc = GetStudentUseCase(SQLStudentRepository(db))
    return await uc.execute(student_id, token.org_id)


@router.get("/{student_id}/classes", response_model=list[ClassResponse])
async def list_student_classes(
    student_id: UUID,
    token=Depends(_teacher_or_admin),
    db: AsyncSession = Depends(get_db),
):
    uc = ListStudentClassesUseCase(SQLStudentRepository(db), SQLClassRepository(db))
    return await uc.execute(student_id, token.org_id)
