from __future__ import annotations

import uuid
from datetime import time

from app.domain.entities.class_ import ClassSchedule
from app.domain.exceptions import NotFoundError
from app.domain.repositories.class_repository import IClassRepository


class AddScheduleUseCase:
    def __init__(self, class_repo: IClassRepository) -> None:
        self._repo = class_repo

    async def execute(
        self,
        class_id: uuid.UUID,
        org_id: uuid.UUID,
        day_of_week: int,
        start_time: time,
        end_time: time,
    ) -> ClassSchedule:
        class_ = await self._repo.get_by_id(class_id, org_id)
        if not class_:
            raise NotFoundError("Class", str(class_id))
        schedule = ClassSchedule(
            id=uuid.uuid4(),
            class_id=class_id,
            day_of_week=day_of_week,
            start_time=start_time,
            end_time=end_time,
        )
        return await self._repo.add_schedule(schedule)
