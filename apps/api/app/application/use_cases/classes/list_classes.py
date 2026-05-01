from __future__ import annotations

import uuid

from app.domain.entities.class_ import Class
from app.domain.repositories.class_repository import IClassRepository


class ListClassesUseCase:
    def __init__(self, class_repo: IClassRepository) -> None:
        self._repo = class_repo

    async def execute(self, teacher_id: uuid.UUID, org_id: uuid.UUID) -> list[Class]:
        return await self._repo.list_by_teacher(teacher_id, org_id)
