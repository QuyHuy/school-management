from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import date, time
from uuid import UUID

from app.domain.entities.attendance import AttendanceRecord, ClassSession


class IAttendanceRepository(ABC):
    @abstractmethod
    async def create_session(self, session: ClassSession) -> ClassSession: ...

    @abstractmethod
    async def get_session(self, session_id: UUID, class_id: UUID) -> ClassSession | None: ...

    @abstractmethod
    async def list_sessions(self, class_id: UUID) -> list[ClassSession]: ...

    @abstractmethod
    async def session_exists_for_date(self, class_id: UUID, date_: date) -> bool: ...

    @abstractmethod
    async def upsert_attendance(self, record: AttendanceRecord) -> AttendanceRecord: ...

    @abstractmethod
    async def bulk_upsert_attendance(self, records: list[AttendanceRecord]) -> list[AttendanceRecord]: ...

    @abstractmethod
    async def list_attendance(self, session_id: UUID) -> list[AttendanceRecord]: ...

    @abstractmethod
    async def update_session(
        self,
        session_id: UUID,
        class_id: UUID,
        notes: str | None,
        mode: str,
        start_time: time | None,
        meet_link: str | None,
    ) -> ClassSession | None: ...

    @abstractmethod
    async def list_sessions_in_month(self, class_ids: list[UUID], start: date, end: date) -> list[ClassSession]: ...

    @abstractmethod
    async def session_ids_with_attendance(self, session_ids: list[UUID]) -> set[UUID]: ...

    @abstractmethod
    async def session_dates_in_range(self, class_id: UUID, from_date: date, to_date: date) -> set[date]: ...
