from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.admin import GradeReportRow
from app.infrastructure.db.models.class_ import ClassModel
from app.infrastructure.db.models.exam import ExamModel, GradeModel
from app.infrastructure.db.models.user import UserModel


class GetReportGradesUseCase:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def execute(
        self,
        org_id: UUID,
        teacher_id: UUID | None,
        class_id: UUID | None,
    ) -> list[GradeReportRow]:
        stmt = (
            select(
                UserModel.name.label("teacher_name"),
                ClassModel.name.label("class_name"),
                ClassModel.subject,
                func.count(func.distinct(GradeModel.student_id)).label("student_count"),
                func.avg(GradeModel.score).label("avg_score"),
                func.min(GradeModel.score).label("min_score"),
                func.max(GradeModel.score).label("max_score"),
            )
            .join(ExamModel, ExamModel.id == GradeModel.exam_id)
            .join(ClassModel, ClassModel.id == ExamModel.class_id)
            .join(UserModel, UserModel.id == ClassModel.teacher_id)
            .where(
                ClassModel.organization_id == org_id,
                ClassModel.deleted_at.is_(None),
                ExamModel.deleted_at.is_(None),
            )
            .group_by(UserModel.name, ClassModel.name, ClassModel.subject)
            .order_by(UserModel.name, ClassModel.name)
        )

        if teacher_id:
            stmt = stmt.where(ClassModel.teacher_id == teacher_id)
        if class_id:
            stmt = stmt.where(ClassModel.id == class_id)

        result = await self._session.execute(stmt)
        return [
            GradeReportRow(
                teacher_name=r.teacher_name,
                class_name=r.class_name,
                subject=r.subject,
                student_count=r.student_count or 0,
                avg_score=round(float(r.avg_score or 0), 2),
                min_score=float(r.min_score or 0),
                max_score=float(r.max_score or 0),
            )
            for r in result
        ]
