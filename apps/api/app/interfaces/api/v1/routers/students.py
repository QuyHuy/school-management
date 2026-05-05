from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.students.create_student import CreateStudentUseCase, ParentInput
from app.application.use_cases.students.get_student import GetStudentUseCase
from app.application.use_cases.students.list_student_classes import ListStudentClassesUseCase
from app.application.use_cases.students.list_students import ListStudentsUseCase
from app.infrastructure.db.repositories.class_repository import SQLClassRepository
from app.infrastructure.db.repositories.student_repository import SQLStudentRepository
from app.infrastructure.db.repositories.user_repository import SQLUserRepository
from app.infrastructure.db.session import get_db
from app.interfaces.api.v1.dependencies import require_role
from app.interfaces.api.v1.schemas.class_ import ClassResponse
from app.interfaces.api.v1.schemas.student import CreateStudentRequest, ParentInfo, StudentResponse

router = APIRouter()
_teacher_or_admin = require_role("teacher", "admin")


@router.post("", response_model=StudentResponse, status_code=201)
async def create_student(
    body: CreateStudentRequest,
    token=Depends(_teacher_or_admin),
    db: AsyncSession = Depends(get_db),
):
    parent_input: ParentInput | None = None
    if body.parent:
        parent_input = ParentInput(
            name=body.parent.name,
            email=body.parent.email,
            phone=body.parent.phone,
            password=body.parent.password,
        )
    uc = CreateStudentUseCase(SQLStudentRepository(db), SQLUserRepository(db))
    return await uc.execute(token.org_id, body.name, body.date_of_birth, body.note, parent_input)


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
    student = await GetStudentUseCase(SQLStudentRepository(db)).execute(student_id, token.org_id)
    parent: ParentInfo | None = None
    if student.parent_id:
        user = await SQLUserRepository(db).get_by_id(student.parent_id)
        if user:
            parent = ParentInfo(name=user.name, email=user.email, phone=user.phone)
    return StudentResponse(
        id=student.id,
        organization_id=student.organization_id,
        name=student.name,
        date_of_birth=student.date_of_birth,
        note=student.note,
        parent_id=student.parent_id,
        parent=parent,
        created_at=student.created_at,
    )


@router.get("/{student_id}/classes", response_model=list[ClassResponse])
async def list_student_classes(
    student_id: UUID,
    token=Depends(_teacher_or_admin),
    db: AsyncSession = Depends(get_db),
):
    uc = ListStudentClassesUseCase(SQLStudentRepository(db), SQLClassRepository(db))
    return await uc.execute(student_id, token.org_id)
