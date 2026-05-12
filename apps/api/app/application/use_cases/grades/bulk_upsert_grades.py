from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from app.domain.entities.exam import Grade
from app.domain.exceptions import NotFoundError, ValidationError
from app.domain.repositories.exam_repository import IExamRepository


@dataclass
class GradeInput:
    student_id: uuid.UUID
    score: float
    note: str | None


class BulkUpsertGradesUseCase:
    def __init__(self, exam_repo: IExamRepository) -> None:
        self._exam_repo = exam_repo

    async def execute(
        self,
        exam_id: uuid.UUID,
        org_id: uuid.UUID,
        graded_by: uuid.UUID,
        inputs: list[GradeInput],
    ) -> list[Grade]:
        exam = await self._exam_repo.get_by_id(exam_id, org_id)
        if not exam:
            raise NotFoundError("Exam", str(exam_id))

        for inp in inputs:
            if inp.score < 0 or inp.score > exam.max_score:
                raise ValidationError(
                    f"Điểm {inp.score} vượt quá điểm tối đa {exam.max_score}"
                )

        now = datetime.now(UTC)
        grades = [
            Grade(
                id=uuid.uuid4(),
                exam_id=exam_id,
                student_id=inp.student_id,
                score=inp.score,
                note=inp.note,
                graded_by=graded_by,
                graded_at=now,
            )
            for inp in inputs
        ]
        return await self._exam_repo.bulk_upsert_grades(grades)
