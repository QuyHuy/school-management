from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.admin import AttendanceReportRow
from app.infrastructure.db.models.attendance import AttendanceRecordModel, ClassSessionModel
from app.infrastructure.db.models.class_ import ClassModel
from app.infrastructure.db.models.user import UserModel


class GetReportAttendanceUseCase:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def execute(
        self,
        org_id: UUID,
        date_from: date | None,
        date_to: date | None,
        teacher_id: UUID | None,
        class_id: UUID | None,
    ) -> list[AttendanceReportRow]:
        stmt = (
            select(
                UserModel.name.label("teacher_name"),
                ClassModel.name.label("class_name"),
                ClassModel.subject,
                func.count(func.distinct(ClassSessionModel.id)).label("total_sessions"),
                func.count(AttendanceRecordModel.id).label("total_attendances"),
                func.sum(case((AttendanceRecordModel.status == "present", 1), else_=0)).label("present"),
                func.sum(case((AttendanceRecordModel.status == "absent", 1), else_=0)).label("absent"),
            )
            .select_from(ClassSessionModel)
            .join(ClassModel, ClassModel.id == ClassSessionModel.class_id)
            .join(UserModel, UserModel.id == ClassModel.teacher_id)
            .outerjoin(AttendanceRecordModel, AttendanceRecordModel.session_id == ClassSessionModel.id)
            .where(
                ClassModel.organization_id == org_id,
                ClassModel.deleted_at.is_(None),
            )
            .group_by(UserModel.name, ClassModel.name, ClassModel.subject)
            .order_by(UserModel.name, ClassModel.name)
        )

        if date_from:
            stmt = stmt.where(ClassSessionModel.date >= date_from)
        if date_to:
            stmt = stmt.where(ClassSessionModel.date <= date_to)
        if teacher_id:
            stmt = stmt.where(ClassModel.teacher_id == teacher_id)
        if class_id:
            stmt = stmt.where(ClassModel.id == class_id)

        result = await self._session.execute(stmt)
        rows = []
        for r in result:
            total = r.total_attendances or 0
            present = r.present or 0
            absent = r.absent or 0
            rate = round(present / total * 100, 1) if total > 0 else 0.0
            rows.append(AttendanceReportRow(
                teacher_name=r.teacher_name,
                class_name=r.class_name,
                subject=r.subject,
                total_sessions=r.total_sessions or 0,
                total_attendances=total,
                present=present,
                absent=absent,
                attendance_rate=rate,
            ))
        return rows
