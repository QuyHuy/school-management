from __future__ import annotations

import uuid

from app.domain.entities.exam import Exam
from app.domain.exceptions import NotFoundError
from app.domain.repositories.class_repository import IClassRepository
from app.domain.repositories.exam_repository import IExamRepository


class ListExamsUseCase:
    def __init__(self, class_repo: IClassRepository, exam_repo: IExamRepository) -> None:
        self._class_repo = class_repo
        self._exam_repo = exam_repo

    async def execute(self, class_id: uuid.UUID, org_id: uuid.UUID) -> list[Exam]:
        class_ = await self._class_repo.get_by_id(class_id, org_id)
        if not class_:
            raise NotFoundError("Class", str(class_id))
        return await self._exam_repo.list_by_class(class_id)
