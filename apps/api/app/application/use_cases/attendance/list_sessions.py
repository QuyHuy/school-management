from __future__ import annotations

import uuid

from app.domain.entities.attendance import ClassSession
from app.domain.exceptions import NotFoundError
from app.domain.repositories.attendance_repository import IAttendanceRepository
from app.domain.repositories.class_repository import IClassRepository


class ListSessionsUseCase:
    def __init__(self, class_repo: IClassRepository, att_repo: IAttendanceRepository) -> None:
        self._class_repo = class_repo
        self._att_repo = att_repo

    async def execute(self, class_id: uuid.UUID, org_id: uuid.UUID) -> list[ClassSession]:
        class_ = await self._class_repo.get_by_id(class_id, org_id)
        if not class_:
            raise NotFoundError("Class", str(class_id))
        return await self._att_repo.list_sessions(class_id)
