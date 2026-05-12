from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.exam import Exam, Grade
from app.domain.repositories.exam_repository import IExamRepository
from app.infrastructure.db.models.exam import ExamModel, GradeModel


def _exam_to_domain(row: ExamModel) -> Exam:
    return Exam(
        id=row.id,
        class_id=row.class_id,
        organization_id=row.organization_id,
        title=row.title,
        type=row.type,
        max_score=float(row.max_score),
        weight_percent=row.weight_percent,
        exam_date=row.exam_date,
        created_at=row.created_at,
        updated_at=row.updated_at,
        deleted_at=row.deleted_at,
    )


def _grade_to_domain(row: GradeModel) -> Grade:
    return Grade(
        id=row.id,
        exam_id=row.exam_id,
        student_id=row.student_id,
        score=float(row.score),
        note=row.note,
        graded_by=row.graded_by,
        graded_at=row.graded_at,
    )


class SQLExamRepository(IExamRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, exam: Exam) -> Exam:
        row = ExamModel(
            id=exam.id,
            class_id=exam.class_id,
            organization_id=exam.organization_id,
            title=exam.title,
            type=exam.type,
            max_score=exam.max_score,
            weight_percent=exam.weight_percent,
            exam_date=exam.exam_date,
        )
        self._session.add(row)
        await self._session.flush()
        await self._session.refresh(row)
        return _exam_to_domain(row)

    async def get_by_id(self, exam_id: UUID, org_id: UUID) -> Exam | None:
        result = await self._session.execute(
            select(ExamModel).where(
                ExamModel.id == exam_id,
                ExamModel.organization_id == org_id,
                ExamModel.deleted_at.is_(None),
            )
        )
        row = result.scalar_one_or_none()
        return _exam_to_domain(row) if row else None

    async def list_by_class(self, class_id: UUID) -> list[Exam]:
        result = await self._session.execute(
            select(ExamModel)
            .where(ExamModel.class_id == class_id, ExamModel.deleted_at.is_(None))
            .order_by(ExamModel.exam_date.asc().nullslast(), ExamModel.created_at.asc())
        )
        return [_exam_to_domain(r) for r in result.scalars()]

    async def delete(self, exam_id: UUID) -> None:
        now = datetime.now(UTC)
        result = await self._session.execute(
            select(ExamModel).where(ExamModel.id == exam_id, ExamModel.deleted_at.is_(None))
        )
        row = result.scalar_one_or_none()
        if row:
            row.deleted_at = now

    async def bulk_upsert_grades(self, grades: list[Grade]) -> list[Grade]:
        if not grades:
            return []
        stmt = pg_insert(GradeModel).values([
            {
                "id": g.id,
                "exam_id": g.exam_id,
                "student_id": g.student_id,
                "score": g.score,
                "note": g.note,
                "graded_by": g.graded_by,
                "graded_at": g.graded_at,
            }
            for g in grades
        ])
        stmt = stmt.on_conflict_do_update(
            constraint="uq_grade",
            set_={
                "score": stmt.excluded.score,
                "note": stmt.excluded.note,
                "graded_by": stmt.excluded.graded_by,
                "graded_at": stmt.excluded.graded_at,
            },
        ).returning(GradeModel)
        result = await self._session.execute(stmt)
        return [_grade_to_domain(row) for row in result.scalars()]

    async def list_grades(self, exam_id: UUID) -> list[Grade]:
        result = await self._session.execute(
            select(GradeModel)
            .where(GradeModel.exam_id == exam_id)
            .order_by(GradeModel.graded_at)
        )
        return [_grade_to_domain(r) for r in result.scalars()]
