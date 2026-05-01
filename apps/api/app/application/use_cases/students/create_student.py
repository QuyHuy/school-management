from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from app.domain.entities.student import Student
from app.domain.repositories.student_repository import IStudentRepository


class CreateStudentUseCase:
    def __init__(self, student_repo: IStudentRepository) -> None:
        self._repo = student_repo

    async def execute(
        self,
        org_id: uuid.UUID,
        name: str,
        date_of_birth: date | None,
        note: str | None,
    ) -> Student:
        student = Student(
            id=uuid.uuid4(),
            organization_id=org_id,
            name=name,
            date_of_birth=date_of_birth,
            note=note,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            deleted_at=None,
        )
        return await self._repo.create(student)
