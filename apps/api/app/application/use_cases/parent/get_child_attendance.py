from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.parent import ChildAttendanceRow
from app.domain.exceptions import ForbiddenError
from app.infrastructure.db.models.attendance import AttendanceRecordModel, ClassSessionModel
from app.infrastructure.db.models.class_ import ClassModel, EnrollmentModel
from app.infrastructure.db.models.student import StudentModel


class GetChildAttendanceUseCase:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def execute(self, parent_id: UUID, student_id: UUID, org_id: UUID) -> list[ChildAttendanceRow]:
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
            select(ClassSessionModel, ClassModel.name.label("class_name"), AttendanceRecordModel)
            .join(ClassModel, ClassSessionModel.class_id == ClassModel.id)
            .join(
                EnrollmentModel,
                (EnrollmentModel.class_id == ClassModel.id) & (EnrollmentModel.student_id == student_id),
            )
            .outerjoin(
                AttendanceRecordModel,
                (AttendanceRecordModel.session_id == ClassSessionModel.id)
                & (AttendanceRecordModel.student_id == student_id),
            )
            .where(ClassModel.organization_id == org_id)
            .order_by(ClassSessionModel.date.desc())
            .limit(100)
        )

        result: list[ChildAttendanceRow] = []
        for session_row, class_name, record in rows_q:
            result.append(ChildAttendanceRow(
                session_id=session_row.id,
                class_id=session_row.class_id,
                class_name=class_name,
                date=session_row.date,
                status=record.status if record else None,
                note=record.note if record else None,
            ))
        return result
