from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from app.domain.entities.attendance import ClassSession
from app.domain.exceptions import ConflictError, NotFoundError
from app.domain.repositories.attendance_repository import IAttendanceRepository
from app.domain.repositories.class_repository import IClassRepository


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
    ) -> ClassSession:
        class_ = await self._class_repo.get_by_id(class_id, org_id)
        if not class_:
            raise NotFoundError("Class", str(class_id))
        if await self._att_repo.session_exists_for_date(class_id, session_date):
            raise ConflictError(f"Session already exists for date {session_date}")
        session = ClassSession(
            id=uuid.uuid4(),
            class_id=class_id,
            date=session_date,
            notes=notes,
            created_at=datetime.now(timezone.utc),
        )
        return await self._att_repo.create_session(session)
