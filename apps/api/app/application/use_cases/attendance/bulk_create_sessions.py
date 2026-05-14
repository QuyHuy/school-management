from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, time, timedelta
from uuid import UUID

from app.domain.entities.attendance import ClassSession
from app.domain.exceptions import NotFoundError, ValidationError
from app.domain.repositories.attendance_repository import IAttendanceRepository
from app.domain.repositories.class_repository import IClassRepository
from app.infrastructure.utils.meet import generate_meet_link


class BulkCreateSessionsUseCase:
    def __init__(self, class_repo: IClassRepository, att_repo: IAttendanceRepository) -> None:
        self._class_repo = class_repo
        self._att_repo = att_repo

    async def execute(
        self,
        class_id: UUID,
        org_id: UUID,
        days: list[int],
        from_date: date,
        to_date: date,
        notes: str | None,
        mode: str,
        start_time: time | None,
    ) -> tuple[int, int]:
        if not days:
            raise ValidationError("Phải chọn ít nhất một thứ trong tuần")
        if from_date > to_date:
            raise ValidationError("Ngày bắt đầu phải trước ngày kết thúc")

        class_ = await self._class_repo.get_by_id(class_id, org_id)
        if not class_:
            raise NotFoundError("Class", str(class_id))

        existing_dates = await self._att_repo.session_dates_in_range(class_id, from_date, to_date)

        days_set = set(days)
        created = 0
        skipped = 0
        current = from_date
        while current <= to_date:
            if current.weekday() in days_set:
                if current in existing_dates:
                    skipped += 1
                else:
                    meet_link = generate_meet_link() if mode == "online" else None
                    session = ClassSession(
                        id=uuid.uuid4(),
                        class_id=class_id,
                        date=current,
                        notes=notes,
                        created_at=datetime.now(UTC),
                        mode=mode,
                        start_time=start_time,
                        meet_link=meet_link,
                    )
                    await self._att_repo.create_session(session)
                    created += 1
            current += timedelta(days=1)

        return created, skipped
