from __future__ import annotations

import uuid
from datetime import datetime, timezone

from app.domain.entities.class_ import Class
from app.domain.repositories.class_repository import IClassRepository


class CreateClassUseCase:
    def __init__(self, class_repo: IClassRepository) -> None:
        self._repo = class_repo

    async def execute(
        self,
        org_id: uuid.UUID,
        teacher_id: uuid.UUID,
        name: str,
        subject: str,
        academic_year: str,
        grade: int,
    ) -> Class:
        class_ = Class(
            id=uuid.uuid4(),
            organization_id=org_id,
            teacher_id=teacher_id,
            name=name,
            subject=subject,
            academic_year=academic_year,
            grade=grade,
            is_active=True,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            deleted_at=None,
        )
        return await self._repo.create(class_)
