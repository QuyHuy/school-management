from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.admin.list_teachers import ListTeachersUseCase
from app.domain.entities.admin import AdminDashboard
from app.infrastructure.db.models.attendance import AttendanceRecordModel, ClassSessionModel
from app.infrastructure.db.models.class_ import ClassModel
from app.infrastructure.db.models.student import StudentModel


class GetAdminDashboardUseCase:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def execute(self, org_id: UUID) -> AdminDashboard:
        teachers = await ListTeachersUseCase(self._session).execute(org_id)

        classes_q = await self._session.execute(
            select(
                func.count(ClassModel.id).label("total"),
                func.sum(case((ClassModel.is_active.is_(True), 1), else_=0)).label("active"),
            ).where(ClassModel.organization_id == org_id, ClassModel.deleted_at.is_(None))
        )
        class_row = classes_q.one()
        total_classes = class_row.total or 0
        total_active_classes = class_row.active or 0

        students_q = await self._session.execute(
            select(func.count(StudentModel.id)).where(
                StudentModel.organization_id == org_id,
                StudentModel.deleted_at.is_(None),
            )
        )
        total_students = students_q.scalar_one() or 0

        this_month = date.today().replace(day=1)
        sessions_q = await self._session.execute(
            select(func.count(ClassSessionModel.id))
            .join(ClassModel, ClassModel.id == ClassSessionModel.class_id)
            .where(
                ClassModel.organization_id == org_id,
                ClassModel.deleted_at.is_(None),
                ClassSessionModel.date >= this_month,
            )
        )
        sessions_this_month = sessions_q.scalar_one() or 0

        att_q = await self._session.execute(
            select(
                func.count(AttendanceRecordModel.id).label("total"),
                func.sum(case((AttendanceRecordModel.status == "present", 1), else_=0)).label("present"),
            )
            .join(ClassSessionModel, ClassSessionModel.id == AttendanceRecordModel.session_id)
            .join(ClassModel, ClassModel.id == ClassSessionModel.class_id)
            .where(
                ClassModel.organization_id == org_id,
                ClassModel.deleted_at.is_(None),
                ClassSessionModel.date >= this_month,
            )
        )
        att_row = att_q.one()
        total_att = att_row.total or 0
        present_att = att_row.present or 0
        rate = round(present_att / total_att * 100, 1) if total_att > 0 else 0.0

        return AdminDashboard(
            total_teachers=len(teachers),
            total_classes=total_classes,
            total_students=total_students,
            total_active_classes=total_active_classes,
            attendance_rate_this_month=rate,
            sessions_this_month=sessions_this_month,
            teachers=teachers,
        )
