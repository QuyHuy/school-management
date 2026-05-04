from __future__ import annotations

from abc import ABC, abstractmethod
from uuid import UUID

from app.domain.entities.exam import Exam, Grade


class IExamRepository(ABC):
    @abstractmethod
    async def create(self, exam: Exam) -> Exam: ...

    @abstractmethod
    async def get_by_id(self, exam_id: UUID, org_id: UUID) -> Exam | None: ...

    @abstractmethod
    async def list_by_class(self, class_id: UUID) -> list[Exam]: ...

    @abstractmethod
    async def delete(self, exam_id: UUID) -> None: ...

    @abstractmethod
    async def bulk_upsert_grades(self, grades: list[Grade]) -> list[Grade]: ...

    @abstractmethod
    async def list_grades(self, exam_id: UUID) -> list[Grade]: ...
