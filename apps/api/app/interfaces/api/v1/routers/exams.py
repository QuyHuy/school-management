from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.grades.bulk_upsert_grades import BulkUpsertGradesUseCase, GradeInput
from app.application.use_cases.grades.create_exam import CreateExamUseCase
from app.application.use_cases.grades.delete_exam import DeleteExamUseCase
from app.application.use_cases.grades.list_exams import ListExamsUseCase
from app.application.use_cases.grades.list_grades import ListGradesUseCase
from app.infrastructure.db.repositories.class_repository import SQLClassRepository
from app.infrastructure.db.repositories.exam_repository import SQLExamRepository
from app.infrastructure.db.session import get_db
from app.interfaces.api.v1.dependencies import require_role
from app.interfaces.api.v1.schemas.exam import (
    BulkUpsertGradesRequest,
    CreateExamRequest,
    ExamResponse,
    GradeResponse,
)

router = APIRouter()
_teacher = require_role("teacher", "admin")


@router.post("/{class_id}/exams", response_model=ExamResponse, status_code=201)
async def create_exam(
    class_id: UUID,
    body: CreateExamRequest,
    token=Depends(_teacher),
    db: AsyncSession = Depends(get_db),
):
    uc = CreateExamUseCase(SQLClassRepository(db), SQLExamRepository(db))
    return await uc.execute(
        class_id, token.org_id, body.title, body.type,
        body.max_score, body.weight_percent, body.exam_date,
    )


@router.get("/{class_id}/exams", response_model=list[ExamResponse])
async def list_exams(
    class_id: UUID,
    token=Depends(_teacher),
    db: AsyncSession = Depends(get_db),
):
    uc = ListExamsUseCase(SQLClassRepository(db), SQLExamRepository(db))
    return await uc.execute(class_id, token.org_id)


@router.delete("/{class_id}/exams/{exam_id}", status_code=204)
async def delete_exam(
    class_id: UUID,
    exam_id: UUID,
    token=Depends(_teacher),
    db: AsyncSession = Depends(get_db),
):
    uc = DeleteExamUseCase(SQLExamRepository(db))
    await uc.execute(exam_id, token.org_id)


@router.get("/{class_id}/exams/{exam_id}/grades", response_model=list[GradeResponse])
async def list_grades(
    class_id: UUID,
    exam_id: UUID,
    token=Depends(_teacher),
    db: AsyncSession = Depends(get_db),
):
    uc = ListGradesUseCase(SQLExamRepository(db))
    return await uc.execute(exam_id, token.org_id)


@router.post(
    "/{class_id}/exams/{exam_id}/grades",
    response_model=list[GradeResponse],
    status_code=200,
)
async def bulk_upsert_grades(
    class_id: UUID,
    exam_id: UUID,
    body: BulkUpsertGradesRequest,
    token=Depends(_teacher),
    db: AsyncSession = Depends(get_db),
):
    uc = BulkUpsertGradesUseCase(SQLExamRepository(db))
    inputs = [GradeInput(student_id=g.student_id, score=g.score, note=g.note) for g in body.grades]
    return await uc.execute(exam_id, token.org_id, token.user_id, inputs)
