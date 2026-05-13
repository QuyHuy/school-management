from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.students.bulk_import_students import BulkImportStudentsUseCase, PreviewRow
from app.application.use_cases.students.create_student import CreateStudentUseCase, ParentInput
from app.application.use_cases.students.get_student import GetStudentUseCase
from app.application.use_cases.students.list_student_classes import ListStudentClassesUseCase
from app.application.use_cases.students.list_students import ListStudentsUseCase
from app.domain.entities.user import UserRole
from app.infrastructure.db.repositories.class_repository import SQLClassRepository
from app.infrastructure.db.repositories.student_repository import SQLStudentRepository
from app.infrastructure.db.repositories.user_repository import SQLUserRepository
from app.infrastructure.db.session import get_db
from app.interfaces.api.v1.dependencies import require_role
from app.interfaces.api.v1.schemas.class_ import ClassResponse
from app.interfaces.api.v1.schemas.student import (
    CheckParentResponse,
    CreateStudentRequest,
    ImportConfirmRequest,
    ImportConfirmResponse,
    ImportPreviewResponse,
    ImportPreviewRow,
    ParentInfo,
    StudentResponse,
)

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
            phone=body.parent.phone,
            name=body.parent.name,
            email=body.parent.email,
            password=body.parent.password,
        )
    uc = CreateStudentUseCase(SQLStudentRepository(db), SQLUserRepository(db))
    return await uc.execute(token.org_id, body.name, body.grade, body.date_of_birth, body.note, parent_input)


@router.get("", response_model=list[StudentResponse])
async def list_students(
    token=Depends(_teacher_or_admin),
    db: AsyncSession = Depends(get_db),
):
    uc = ListStudentsUseCase(SQLStudentRepository(db))
    return await uc.execute(token.org_id)


@router.get("/check-parent", response_model=CheckParentResponse)
async def check_parent_phone(
    phone: str,
    token=Depends(_teacher_or_admin),
    db: AsyncSession = Depends(get_db),
):
    user = await SQLUserRepository(db).get_by_phone(phone)
    if not user:
        return CheckParentResponse(exists=False)
    is_parent = user.role == UserRole.parent
    return CheckParentResponse(
        exists=True,
        is_parent=is_parent,
        name=user.name if is_parent else None,
        phone=user.phone if is_parent else None,
        email=user.email if is_parent else None,
    )


_TEMPLATE_CSV = (
    "name,grade,date_of_birth,note\r\n"
    "Nguyễn Văn An,5,2015-03-20,Học giỏi toán\r\n"
    "Trần Thị Bình,3,,\r\n"
)


@router.get("/import/template")
async def download_import_template(token=Depends(_teacher_or_admin)):
    return StreamingResponse(
        iter([_TEMPLATE_CSV]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=\"students_template.csv\""},
    )


@router.post("/import/preview", response_model=ImportPreviewResponse)
async def preview_import(
    file: UploadFile,
    token=Depends(_teacher_or_admin),
    db: AsyncSession = Depends(get_db),
):
    if not (file.filename or "").endswith(".csv"):
        raise HTTPException(status_code=400, detail="Chỉ chấp nhận file .csv")
    contents = await file.read()
    await file.close()
    if len(contents) > 500 * 1024:
        raise HTTPException(status_code=400, detail="File quá lớn (tối đa 500KB)")
    uc = BulkImportStudentsUseCase(SQLStudentRepository(db), SQLUserRepository(db))
    result = await uc.preview(contents, token.org_id)
    return ImportPreviewResponse(
        valid=[_row_to_schema(r) for r in result.valid],
        invalid=[_row_to_schema(r) for r in result.invalid],
        total_rows=result.total_rows,
    )


@router.post("/import/confirm", response_model=ImportConfirmResponse)
async def confirm_import(
    body: ImportConfirmRequest,
    token=Depends(_teacher_or_admin),
    db: AsyncSession = Depends(get_db),
):
    rows = [
        PreviewRow(
            row=r.row,
            name=r.name,
            grade=r.grade,
            date_of_birth=r.date_of_birth,
            note=r.note,
            errors=[],
        )
        for r in body.rows
    ]
    uc = BulkImportStudentsUseCase(SQLStudentRepository(db), SQLUserRepository(db))
    result = await uc.confirm(rows, token.org_id, token.user_id)
    return ImportConfirmResponse(created=result.created, failed=result.failed)


def _row_to_schema(r: PreviewRow) -> ImportPreviewRow:
    return ImportPreviewRow(
        row=r.row, name=r.name, grade=r.grade,
        date_of_birth=r.date_of_birth, note=r.note, errors=r.errors,
    )


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
        student_code=student.student_code,
        grade=student.grade,
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
