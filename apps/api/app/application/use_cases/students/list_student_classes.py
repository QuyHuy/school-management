from __future__ import annotations

import uuid

from app.domain.entities.class_ import Class
from app.domain.exceptions import NotFoundError
from app.domain.repositories.class_repository import IClassRepository
from app.domain.repositories.student_repository import IStudentRepository


class ListStudentClassesUseCase:
    def __init__(self, student_repo: IStudentRepository, class_repo: IClassRepository) -> None:
        self._student_repo = student_repo
        self._class_repo = class_repo

    async def execute(self, student_id: uuid.UUID, org_id: uuid.UUID) -> list[Class]:
        student = await self._student_repo.get_by_id(student_id, org_id)
        if not student:
            raise NotFoundError("Student", str(student_id))
        return await self._class_repo.list_by_student(student_id, org_id)
