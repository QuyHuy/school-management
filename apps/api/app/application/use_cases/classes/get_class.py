from __future__ import annotations

import uuid

from app.domain.entities.class_ import Class
from app.domain.exceptions import NotFoundError
from app.domain.repositories.class_repository import IClassRepository


class GetClassUseCase:
    def __init__(self, class_repo: IClassRepository) -> None:
        self._repo = class_repo

    async def execute(self, class_id: uuid.UUID, org_id: uuid.UUID) -> Class:
        class_ = await self._repo.get_by_id(class_id, org_id)
        if not class_:
            raise NotFoundError("Class", str(class_id))
        return class_
