from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, time

from app.domain.entities.attendance import ClassSession
from app.domain.exceptions import ConflictError, NotFoundError
from app.domain.repositories.attendance_repository import IAttendanceRepository
from app.domain.repositories.class_repository import IClassRepository
from app.infrastructure.utils.meet import generate_meet_link


class CreateSessionUseCase:
    def __init__(self, class_repo: IClassRepository, att_repo: IAttendanceRepository) -> None:
        self._class_repo = class_repo
        self._att_repo = att_repo

    async def execute(
        self,
        class_id: uuid.UUID,
        org_id: uuid.UUID,
        session_date: date,
        notes: str | None,
        mode: str = "offline",
        start_time: time | None = None,
    ) -> ClassSession:
        class_ = await self._class_repo.get_by_id(class_id, org_id)
        if not class_:
            raise NotFoundError("Class", str(class_id))
        if await self._att_repo.session_exists_for_date(class_id, session_date):
            raise ConflictError(f"Session already exists for date {session_date}")

        meet_link = generate_meet_link() if mode == "online" else None

        session = ClassSession(
            id=uuid.uuid4(),
            class_id=class_id,
            date=session_date,
            notes=notes,
            created_at=datetime.now(UTC),
            mode=mode,
            start_time=start_time,
            meet_link=meet_link,
        )
        return await self._att_repo.create_session(session)
