from __future__ import annotations

from abc import ABC, abstractmethod
from uuid import UUID

from app.domain.entities.student import Student


class IStudentRepository(ABC):
    @abstractmethod
    async def create(self, student: Student) -> Student: ...

    @abstractmethod
    async def get_by_id(self, student_id: UUID, org_id: UUID) -> Student | None: ...

    @abstractmethod
    async def list_by_org(self, org_id: UUID) -> list[Student]: ...
