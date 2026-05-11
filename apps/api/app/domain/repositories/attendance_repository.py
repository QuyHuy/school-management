from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import date
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
