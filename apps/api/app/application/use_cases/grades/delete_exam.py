from __future__ import annotations

import uuid

from app.domain.exceptions import NotFoundError
from app.domain.repositories.exam_repository import IExamRepository


class DeleteExamUseCase:
    def __init__(self, exam_repo: IExamRepository) -> None:
        self._exam_repo = exam_repo

    async def execute(self, exam_id: uuid.UUID, org_id: uuid.UUID) -> None:
        exam = await self._exam_repo.get_by_id(exam_id, org_id)
        if not exam:
            raise NotFoundError("Exam", str(exam_id))
        await self._exam_repo.delete(exam_id)
