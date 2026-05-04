from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.parent import ChildClass, ChildInfo
from app.infrastructure.db.models.class_ import ClassModel, EnrollmentModel
from app.infrastructure.db.models.student import StudentModel


class GetChildrenUseCase:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def execute(self, parent_id: UUID, org_id: UUID) -> list[ChildInfo]:
        students_q = await self._session.execute(
            select(StudentModel).where(
                StudentModel.parent_id == parent_id,
                StudentModel.organization_id == org_id,
                StudentModel.deleted_at.is_(None),
            ).order_by(StudentModel.name)
        )
        students = list(students_q.scalars())

        result: list[ChildInfo] = []
        for s in students:
            classes_q = await self._session.execute(
                select(ClassModel)
                .join(EnrollmentModel, EnrollmentModel.class_id == ClassModel.id)
                .where(
                    EnrollmentModel.student_id == s.id,
                    ClassModel.deleted_at.is_(None),
                )
                .order_by(ClassModel.is_active.desc(), ClassModel.name)
            )
            classes = [
                ChildClass(
                    class_id=c.id,
                    name=c.name,
                    subject=c.subject,
                    academic_year=c.academic_year,
                    is_active=c.is_active,
                )
                for c in classes_q.scalars()
            ]
            result.append(ChildInfo(
                student_id=s.id,
                student_name=s.name,
                date_of_birth=s.date_of_birth,
                classes=classes,
            ))
        return result
