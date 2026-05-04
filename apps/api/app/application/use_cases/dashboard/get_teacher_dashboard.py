from __future__ import annotations

from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.dashboard import DashboardSummary, PendingSession, TodayClass
from app.infrastructure.db.models.attendance import AttendanceRecordModel, ClassSessionModel
from app.infrastructure.db.models.class_ import ClassModel, ClassScheduleModel, EnrollmentModel


class GetTeacherDashboardUseCase:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def execute(self, teacher_id: UUID, org_id: UUID) -> DashboardSummary:
        today = date.today()

        classes_q = await self._session.execute(
            select(ClassModel).where(
                ClassModel.teacher_id == teacher_id,
                ClassModel.organization_id == org_id,
                ClassModel.is_active.is_(True),
                ClassModel.deleted_at.is_(None),
            )
        )
        active_classes = list(classes_q.scalars())
        class_ids = [c.id for c in active_classes]
        class_meta: dict[UUID, tuple[str, str]] = {c.id: (c.name, c.subject) for c in active_classes}

        if class_ids:
            count_q = await self._session.execute(
                select(func.count(func.distinct(EnrollmentModel.student_id))).where(
                    EnrollmentModel.class_id.in_(class_ids)
                )
            )
            total_students: int = count_q.scalar_one()
        else:
            total_students = 0

        if class_ids:
            sched_q = await self._session.execute(
                select(ClassScheduleModel).where(
                    ClassScheduleModel.class_id.in_(class_ids),
                    ClassScheduleModel.day_of_week == today.weekday(),
                ).order_by(ClassScheduleModel.start_time)
            )
            today_schedule = [
                TodayClass(
                    class_id=r.class_id,
                    class_name=class_meta[r.class_id][0],
                    subject=class_meta[r.class_id][1],
                    start_time=r.start_time,
                    end_time=r.end_time,
                )
                for r in sched_q.scalars()
            ]
        else:
            today_schedule = []

        if class_ids:
            seven_days_ago = today - timedelta(days=7)
            pending_q = await self._session.execute(
                select(ClassSessionModel).where(
                    ClassSessionModel.class_id.in_(class_ids),
                    ClassSessionModel.date >= seven_days_ago,
                    ClassSessionModel.date < today,
                    ~select(AttendanceRecordModel.id)
                    .where(AttendanceRecordModel.session_id == ClassSessionModel.id)
                    .correlate(ClassSessionModel)
                    .exists(),
                ).order_by(ClassSessionModel.date.desc()).limit(5)
            )
            pending_sessions = [
                PendingSession(
                    session_id=r.id,
                    class_id=r.class_id,
                    class_name=class_meta[r.class_id][0],
                    date=r.date,
                )
                for r in pending_q.scalars()
            ]
        else:
            pending_sessions = []

        return DashboardSummary(
            active_classes_count=len(active_classes),
            total_students_count=total_students,
            today_schedule=today_schedule,
            pending_sessions=pending_sessions,
        )
