from __future__ import annotations

import uuid

from app.domain.entities.attendance import AttendanceRecord
from app.domain.exceptions import NotFoundError
from app.domain.repositories.attendance_repository import IAttendanceRepository
from app.domain.repositories.class_repository import IClassRepository


class ListAttendanceUseCase:
    def __init__(self, class_repo: IClassRepository, att_repo: IAttendanceRepository) -> None:
        self._class_repo = class_repo
        self._att_repo = att_repo

    async def execute(
        self, session_id: uuid.UUID, class_id: uuid.UUID, org_id: uuid.UUID
    ) -> list[AttendanceRecord]:
        class_ = await self._class_repo.get_by_id(class_id, org_id)
        if not class_:
            raise NotFoundError("Class", str(class_id))
        session = await self._att_repo.get_session(session_id, class_id)
        if not session:
            raise NotFoundError("ClassSession", str(session_id))
        return await self._att_repo.list_attendance(session_id)
