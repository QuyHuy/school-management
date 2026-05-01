from __future__ import annotations

import uuid

from app.domain.entities.student import Student
from app.domain.repositories.student_repository import IStudentRepository


class ListStudentsUseCase:
    def __init__(self, student_repo: IStudentRepository) -> None:
        self._repo = student_repo

    async def execute(self, org_id: uuid.UUID) -> list[Student]:
        return await self._repo.list_by_org(org_id)
