from __future__ import annotations

from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.class_ import Class, ClassSchedule, Enrollment
from app.domain.repositories.class_repository import IClassRepository
from app.infrastructure.db.models.class_ import ClassModel, ClassScheduleModel, EnrollmentModel


def _class_to_domain(row: ClassModel) -> Class:
    return Class(
        id=row.id,
        organization_id=row.organization_id,
        teacher_id=row.teacher_id,
        name=row.name,
        subject=row.subject,
        academic_year=row.academic_year,
        is_active=row.is_active,
        created_at=row.created_at,
        updated_at=row.updated_at,
        deleted_at=row.deleted_at,
    )


def _schedule_to_domain(row: ClassScheduleModel) -> ClassSchedule:
    return ClassSchedule(
        id=row.id,
        class_id=row.class_id,
        day_of_week=row.day_of_week,
        start_time=row.start_time,
        end_time=row.end_time,
    )


def _enrollment_to_domain(row: EnrollmentModel) -> Enrollment:
    return Enrollment(
        id=row.id,
        class_id=row.class_id,
        student_id=row.student_id,
        parent_id=row.parent_id,
        enrolled_at=row.enrolled_at,
    )


class SQLClassRepository(IClassRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, class_: Class) -> Class:
        row = ClassModel(
            id=class_.id,
            organization_id=class_.organization_id,
            teacher_id=class_.teacher_id,
            name=class_.name,
            subject=class_.subject,
            academic_year=class_.academic_year,
            is_active=class_.is_active,
        )
        self._session.add(row)
        await self._session.flush()
        await self._session.refresh(row)
        return _class_to_domain(row)

    async def get_by_id(self, class_id: UUID, org_id: UUID) -> Class | None:
        result = await self._session.execute(
            select(ClassModel).where(
                ClassModel.id == class_id,
                ClassModel.organization_id == org_id,
                ClassModel.deleted_at.is_(None),
            )
        )
        row = result.scalar_one_or_none()
        return _class_to_domain(row) if row else None

    async def list_by_teacher(self, teacher_id: UUID, org_id: UUID) -> list[Class]:
        result = await self._session.execute(
            select(ClassModel).where(
                ClassModel.teacher_id == teacher_id,
                ClassModel.organization_id == org_id,
                ClassModel.deleted_at.is_(None),
            ).order_by(ClassModel.name)
        )
        return [_class_to_domain(r) for r in result.scalars()]

    async def add_schedule(self, schedule: ClassSchedule) -> ClassSchedule:
        row = ClassScheduleModel(
            id=schedule.id,
            class_id=schedule.class_id,
            day_of_week=schedule.day_of_week,
            start_time=schedule.start_time,
            end_time=schedule.end_time,
        )
        self._session.add(row)
        await self._session.flush()
        await self._session.refresh(row)
        return _schedule_to_domain(row)

    async def list_schedules(self, class_id: UUID) -> list[ClassSchedule]:
        result = await self._session.execute(
            select(ClassScheduleModel).where(
                ClassScheduleModel.class_id == class_id
            ).order_by(ClassScheduleModel.day_of_week, ClassScheduleModel.start_time)
        )
        return [_schedule_to_domain(r) for r in result.scalars()]

    async def delete_schedule(self, schedule_id: UUID, class_id: UUID) -> None:
        await self._session.execute(
            delete(ClassScheduleModel).where(
                ClassScheduleModel.id == schedule_id,
                ClassScheduleModel.class_id == class_id,
            )
        )

    async def enroll(self, enrollment: Enrollment) -> Enrollment:
        row = EnrollmentModel(
            id=enrollment.id,
            class_id=enrollment.class_id,
            student_id=enrollment.student_id,
            parent_id=enrollment.parent_id,
        )
        self._session.add(row)
        await self._session.flush()
        await self._session.refresh(row)
        return _enrollment_to_domain(row)

    async def enrollment_exists(self, class_id: UUID, student_id: UUID) -> bool:
        result = await self._session.execute(
            select(EnrollmentModel.id).where(
                EnrollmentModel.class_id == class_id,
                EnrollmentModel.student_id == student_id,
            )
        )
        return result.scalar_one_or_none() is not None

    async def list_enrollments(self, class_id: UUID) -> list[Enrollment]:
        result = await self._session.execute(
            select(EnrollmentModel).where(
                EnrollmentModel.class_id == class_id
            )
        )
        return [_enrollment_to_domain(r) for r in result.scalars()]

    async def unenroll(self, class_id: UUID, student_id: UUID) -> None:
        await self._session.execute(
            delete(EnrollmentModel).where(
                EnrollmentModel.class_id == class_id,
                EnrollmentModel.student_id == student_id,
            )
        )

    async def list_by_student(self, student_id: UUID, org_id: UUID) -> list[Class]:
        result = await self._session.execute(
            select(ClassModel)
            .join(EnrollmentModel, EnrollmentModel.class_id == ClassModel.id)
            .where(
                EnrollmentModel.student_id == student_id,
                ClassModel.organization_id == org_id,
                ClassModel.deleted_at.is_(None),
            )
            .order_by(ClassModel.name)
        )
        return [_class_to_domain(r) for r in result.scalars()]
