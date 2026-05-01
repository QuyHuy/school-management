from __future__ import annotations

import uuid

from app.domain.entities.student import Student
from app.domain.exceptions import NotFoundError
from app.domain.repositories.student_repository import IStudentRepository


class GetStudentUseCase:
    def __init__(self, student_repo: IStudentRepository) -> None:
        self._repo = student_repo

    async def execute(self, student_id: uuid.UUID, org_id: uuid.UUID) -> Student:
        student = await self._repo.get_by_id(student_id, org_id)
        if not student:
            raise NotFoundError("Student", str(student_id))
        return student
