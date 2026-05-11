from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.admin import TeacherClassInfo, TeacherDetail
from app.domain.entities.user import UserRole
from app.domain.exceptions import NotFoundError
from app.domain.repositories.user_repository import IUserRepository
from app.infrastructure.db.models.class_ import ClassModel, EnrollmentModel


class GetTeacherUseCase:
    def __init__(self, session: AsyncSession, user_repo: IUserRepository) -> None:
        self._session = session
        self._user_repo = user_repo

    async def execute(self, teacher_id: UUID, org_id: UUID) -> TeacherDetail:
        user = await self._user_repo.get_by_id(teacher_id)
        if not user or user.role != UserRole.teacher or user.organization_id != org_id:
            raise NotFoundError("Teacher", str(teacher_id))

        classes_q = await self._session.execute(
            select(ClassModel).where(
                ClassModel.teacher_id == teacher_id,
                ClassModel.organization_id == org_id,
                ClassModel.deleted_at.is_(None),
            ).order_by(ClassModel.name)
        )
        classes = list(classes_q.scalars())
        class_ids = [c.id for c in classes]

        if class_ids:
            counts_q = await self._session.execute(
                select(EnrollmentModel.class_id, func.count(EnrollmentModel.student_id).label("cnt"))
                .where(EnrollmentModel.class_id.in_(class_ids))
                .group_by(EnrollmentModel.class_id)
            )
            counts: dict[UUID, int] = {r.class_id: r.cnt for r in counts_q}
        else:
            counts = {}

        class_infos = [
            TeacherClassInfo(
                id=c.id,
                name=c.name,
                subject=c.subject,
                academic_year=c.academic_year,
                is_active=c.is_active,
                student_count=counts.get(c.id, 0),
            )
            for c in classes
        ]

        return TeacherDetail(
            id=user.id,
            name=user.name,
            email=user.email,
            phone=user.phone,
            is_active=user.is_active,
            created_at=user.created_at,
            classes=class_infos,
            total_students=sum(counts.values()),
        )
