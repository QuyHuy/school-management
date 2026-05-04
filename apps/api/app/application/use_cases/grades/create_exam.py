from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from app.domain.entities.exam import Exam
from app.domain.exceptions import NotFoundError, ValidationError
from app.domain.repositories.class_repository import IClassRepository
from app.domain.repositories.exam_repository import IExamRepository

VALID_TYPES = {"quiz", "midterm", "final", "assignment"}


class CreateExamUseCase:
    def __init__(self, class_repo: IClassRepository, exam_repo: IExamRepository) -> None:
        self._class_repo = class_repo
        self._exam_repo = exam_repo

    async def execute(
        self,
        class_id: uuid.UUID,
        org_id: uuid.UUID,
        title: str,
        type_: str,
        max_score: float,
        weight_percent: int,
        exam_date: date | None,
    ) -> Exam:
        if type_ not in VALID_TYPES:
            raise ValidationError(f"Loại bài kiểm tra không hợp lệ: {type_}")
        if not 0 <= weight_percent <= 100:
            raise ValidationError("weight_percent phải từ 0 đến 100")
        if max_score <= 0:
            raise ValidationError("max_score phải lớn hơn 0")

        class_ = await self._class_repo.get_by_id(class_id, org_id)
        if not class_:
            raise NotFoundError("Class", str(class_id))

        now = datetime.now(timezone.utc)
        exam = Exam(
            id=uuid.uuid4(),
            class_id=class_id,
            organization_id=org_id,
            title=title,
            type=type_,
            max_score=max_score,
            weight_percent=weight_percent,
            exam_date=exam_date,
            created_at=now,
            updated_at=now,
            deleted_at=None,
        )
        return await self._exam_repo.create(exam)
