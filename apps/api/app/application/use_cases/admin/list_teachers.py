from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.admin import TeacherInfo
from app.infrastructure.db.models.attendance import ClassSessionModel
from app.infrastructure.db.models.class_ import ClassModel, EnrollmentModel
from app.infrastructure.db.models.user import UserModel


class ListTeachersUseCase:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def execute(self, org_id: UUID) -> list[TeacherInfo]:
        teachers_q = await self._session.execute(
            select(UserModel).where(
                UserModel.role == "teacher",
                UserModel.organization_id == org_id,
                UserModel.deleted_at.is_(None),
            ).order_by(UserModel.name)
        )
        teachers = list(teachers_q.scalars())
        if not teachers:
            return []

        teacher_ids = [t.id for t in teachers]

        class_counts_q = await self._session.execute(
            select(ClassModel.teacher_id, func.count(ClassModel.id).label("cnt"))
            .where(
                ClassModel.teacher_id.in_(teacher_ids),
                ClassModel.organization_id == org_id,
                ClassModel.deleted_at.is_(None),
            )
            .group_by(ClassModel.teacher_id)
        )
        class_counts: dict[UUID, int] = {r.teacher_id: r.cnt for r in class_counts_q}

        student_counts_q = await self._session.execute(
            select(
                ClassModel.teacher_id,
                func.count(func.distinct(EnrollmentModel.student_id)).label("cnt"),
            )
            .join(EnrollmentModel, EnrollmentModel.class_id == ClassModel.id)
            .where(
                ClassModel.teacher_id.in_(teacher_ids),
                ClassModel.organization_id == org_id,
                ClassModel.deleted_at.is_(None),
            )
            .group_by(ClassModel.teacher_id)
        )
        student_counts: dict[UUID, int] = {r.teacher_id: r.cnt for r in student_counts_q}

        this_month = date.today().replace(day=1)
        sessions_q = await self._session.execute(
            select(ClassModel.teacher_id, func.count(ClassSessionModel.id).label("cnt"))
            .join(ClassSessionModel, ClassSessionModel.class_id == ClassModel.id)
            .where(
                ClassModel.teacher_id.in_(teacher_ids),
                ClassModel.organization_id == org_id,
                ClassModel.deleted_at.is_(None),
                ClassSessionModel.date >= this_month,
            )
            .group_by(ClassModel.teacher_id)
        )
        sessions: dict[UUID, int] = {r.teacher_id: r.cnt for r in sessions_q}

        return [
            TeacherInfo(
                id=t.id,
                name=t.name,
                email=t.email,
                phone=t.phone,
                is_active=t.is_active,
                created_at=t.created_at,
                class_count=class_counts.get(t.id, 0),
                student_count=student_counts.get(t.id, 0),
                sessions_this_month=sessions.get(t.id, 0),
            )
            for t in teachers
        ]
