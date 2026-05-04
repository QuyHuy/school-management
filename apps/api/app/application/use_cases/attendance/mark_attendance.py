from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from app.domain.entities.attendance import AttendanceRecord
from app.domain.exceptions import NotFoundError
from app.domain.repositories.attendance_repository import IAttendanceRepository
from app.domain.repositories.class_repository import IClassRepository


class MarkAttendanceUseCase:
    def __init__(self, class_repo: IClassRepository, att_repo: IAttendanceRepository) -> None:
        self._class_repo = class_repo
        self._att_repo = att_repo

    async def execute(
        self,
        class_id: uuid.UUID,
        session_id: uuid.UUID,
        org_id: uuid.UUID,
        records: list[dict[str, Any]],
    ) -> list[AttendanceRecord]:
        class_ = await self._class_repo.get_by_id(class_id, org_id)
        if not class_:
            raise NotFoundError("Class", str(class_id))
        session = await self._att_repo.get_session(session_id, class_id)
        if not session:
            raise NotFoundError("ClassSession", str(session_id))
        now = datetime.now(timezone.utc)
        att_records = [
            AttendanceRecord(
                id=uuid.uuid4(),
                session_id=session_id,
                student_id=r["student_id"],
                status=r["status"],
                note=r.get("note"),
                marked_at=now,
            )
            for r in records
        ]
        return await self._att_repo.bulk_upsert_attendance(att_records)
