from __future__ import annotations

from datetime import time
from uuid import UUID

from app.domain.entities.attendance import ClassSession
from app.domain.exceptions import NotFoundError
from app.domain.repositories.attendance_repository import IAttendanceRepository
from app.domain.repositories.class_repository import IClassRepository
from app.infrastructure.utils.meet import generate_meet_link


class UpdateSessionUseCase:
    def __init__(self, class_repo: IClassRepository, att_repo: IAttendanceRepository) -> None:
        self._class_repo = class_repo
        self._att_repo = att_repo

    async def execute(
        self,
        class_id: UUID,
        session_id: UUID,
        org_id: UUID,
        notes: str | None,
        mode: str | None = None,
        start_time: time | None = None,
    ) -> ClassSession:
        class_ = await self._class_repo.get_by_id(class_id, org_id)
        if not class_:
            raise NotFoundError("Class", str(class_id))

        current = await self._att_repo.get_session(session_id, class_id)
        if not current:
            raise NotFoundError("Session", str(session_id))

        new_mode = mode if mode is not None else current.mode
        new_start_time = start_time if mode is not None else current.start_time

        if new_mode == "online" and current.meet_link is None:
            new_meet_link = generate_meet_link()
        else:
            new_meet_link = current.meet_link

        session = await self._att_repo.update_session(
            session_id, class_id, notes, new_mode, new_start_time, new_meet_link
        )
        if not session:
            raise NotFoundError("Session", str(session_id))
        return session
