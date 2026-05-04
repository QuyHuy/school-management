from __future__ import annotations

from abc import ABC, abstractmethod
from uuid import UUID

from app.domain.entities.class_ import Class, ClassSchedule, Enrollment


class IClassRepository(ABC):
    @abstractmethod
    async def create(self, class_: Class) -> Class: ...

    @abstractmethod
    async def get_by_id(self, class_id: UUID, org_id: UUID) -> Class | None: ...

    @abstractmethod
    async def list_by_teacher(self, teacher_id: UUID, org_id: UUID) -> list[Class]: ...

    @abstractmethod
    async def add_schedule(self, schedule: ClassSchedule) -> ClassSchedule: ...

    @abstractmethod
    async def list_schedules(self, class_id: UUID) -> list[ClassSchedule]: ...

    @abstractmethod
    async def delete_schedule(self, schedule_id: UUID, class_id: UUID) -> None: ...

    @abstractmethod
    async def enroll(self, enrollment: Enrollment) -> Enrollment: ...

    @abstractmethod
    async def enrollment_exists(self, class_id: UUID, student_id: UUID) -> bool: ...

    @abstractmethod
    async def list_enrollments(self, class_id: UUID) -> list[Enrollment]: ...

    @abstractmethod
    async def unenroll(self, class_id: UUID, student_id: UUID) -> None: ...

    @abstractmethod
    async def list_by_student(self, student_id: UUID, org_id: UUID) -> list[Class]: ...
