from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.parent import ChildGradeRow
from app.domain.exceptions import ForbiddenError
from app.infrastructure.db.models.class_ import ClassModel, EnrollmentModel
from app.infrastructure.db.models.exam import ExamModel, GradeModel
from app.infrastructure.db.models.student import StudentModel


class GetChildGradesUseCase:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def execute(self, parent_id: UUID, student_id: UUID, org_id: UUID) -> list[ChildGradeRow]:
        owner_q = await self._session.execute(
            select(StudentModel.id).where(
                StudentModel.id == student_id,
                StudentModel.parent_id == parent_id,
                StudentModel.organization_id == org_id,
                StudentModel.deleted_at.is_(None),
            )
        )
        if owner_q.scalar_one_or_none() is None:
            raise ForbiddenError("Not your child")

        rows_q = await self._session.execute(
            select(ExamModel, ClassModel.name.label("class_name"), GradeModel)
            .join(ClassModel, ExamModel.class_id == ClassModel.id)
            .join(
                EnrollmentModel,
                (EnrollmentModel.class_id == ClassModel.id) & (EnrollmentModel.student_id == student_id),
            )
            .outerjoin(
                GradeModel,
                (GradeModel.exam_id == ExamModel.id) & (GradeModel.student_id == student_id),
            )
            .where(
                ExamModel.deleted_at.is_(None),
                ExamModel.organization_id == org_id,
            )
            .order_by(ClassModel.name, ExamModel.exam_date.asc().nullslast())
        )

        result: list[ChildGradeRow] = []
        for exam, class_name, grade in rows_q:
            result.append(ChildGradeRow(
                exam_id=exam.id,
                class_id=exam.class_id,
                class_name=class_name,
                exam_title=exam.title,
                exam_type=exam.type,
                exam_date=exam.exam_date,
                max_score=float(exam.max_score),
                score=float(grade.score) if grade else None,
                note=grade.note if grade else None,
            ))
        return result
