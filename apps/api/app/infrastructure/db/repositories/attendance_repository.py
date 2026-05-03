from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.attendance import AttendanceRecord, ClassSession
from app.domain.repositories.attendance_repository import IAttendanceRepository
from app.infrastructure.db.models.attendance import AttendanceRecordModel, ClassSessionModel


def _session_to_domain(row: ClassSessionModel) -> ClassSession:
    return ClassSession(
        id=row.id,
        class_id=row.class_id,
        date=row.date,
        notes=row.notes,
        created_at=row.created_at,
    )


def _record_to_domain(row: AttendanceRecordModel) -> AttendanceRecord:
    return AttendanceRecord(
        id=row.id,
        session_id=row.session_id,
        student_id=row.student_id,
        status=row.status,
        note=row.note,
        marked_at=row.marked_at,
    )


class SQLAttendanceRepository(IAttendanceRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create_session(self, session: ClassSession) -> ClassSession:
        row = ClassSessionModel(
            id=session.id,
            class_id=session.class_id,
            date=session.date,
            notes=session.notes,
        )
        self._session.add(row)
        await self._session.flush()
        await self._session.refresh(row)
        return _session_to_domain(row)

    async def get_session(self, session_id: UUID, class_id: UUID) -> ClassSession | None:
        result = await self._session.execute(
            select(ClassSessionModel).where(
                ClassSessionModel.id == session_id,
                ClassSessionModel.class_id == class_id,
            )
        )
        row = result.scalar_one_or_none()
        return _session_to_domain(row) if row else None

    async def list_sessions(self, class_id: UUID) -> list[ClassSession]:
        result = await self._session.execute(
            select(ClassSessionModel)
            .where(ClassSessionModel.class_id == class_id)
            .order_by(ClassSessionModel.date.desc())
        )
        return [_session_to_domain(r) for r in result.scalars()]

    async def session_exists_for_date(self, class_id: UUID, date_: date) -> bool:
        result = await self._session.execute(
            select(ClassSessionModel.id).where(
                ClassSessionModel.class_id == class_id,
                ClassSessionModel.date == date_,
            )
        )
        return result.scalar_one_or_none() is not None

    async def upsert_attendance(self, record: AttendanceRecord) -> AttendanceRecord:
        stmt = (
            pg_insert(AttendanceRecordModel)
            .values(
                id=record.id,
                session_id=record.session_id,
                student_id=record.student_id,
                status=record.status,
                note=record.note,
                marked_at=record.marked_at,
            )
            .on_conflict_do_update(
                constraint="uq_attendance_record",
                set_={"status": record.status, "note": record.note, "marked_at": record.marked_at},
            )
            .returning(AttendanceRecordModel)
        )
        result = await self._session.execute(stmt)
        row = result.scalar_one()
        return _record_to_domain(row)

    async def list_attendance(self, session_id: UUID) -> list[AttendanceRecord]:
        result = await self._session.execute(
            select(AttendanceRecordModel)
            .where(AttendanceRecordModel.session_id == session_id)
            .order_by(AttendanceRecordModel.marked_at)
        )
        return [_record_to_domain(r) for r in result.scalars()]
