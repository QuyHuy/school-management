from __future__ import annotations

import uuid
from datetime import UTC, datetime

from app.domain.entities.class_ import Enrollment
from app.domain.exceptions import ConflictError, NotFoundError, ValidationError
from app.domain.repositories.class_repository import IClassRepository
from app.domain.repositories.student_repository import IStudentRepository


class EnrollStudentUseCase:
    def __init__(self, class_repo: IClassRepository, student_repo: IStudentRepository) -> None:
        self._class_repo = class_repo
        self._student_repo = student_repo

    async def execute(
        self,
        class_id: uuid.UUID,
        student_id: uuid.UUID,
        org_id: uuid.UUID,
        parent_id: uuid.UUID | None = None,
    ) -> Enrollment:
        class_ = await self._class_repo.get_by_id(class_id, org_id)
        if not class_:
            raise NotFoundError("Class", str(class_id))
        student = await self._student_repo.get_by_id(student_id, org_id)
        if not student:
            raise NotFoundError("Student", str(student_id))
        if class_.grade is not None and student.grade is not None and class_.grade != student.grade:
            raise ValidationError(
                f"Học sinh khối {student.grade} không thể đăng ký lớp khối {class_.grade}"
            )
        if await self._class_repo.enrollment_exists(class_id, student_id):
            raise ConflictError("Student already enrolled in this class")
        enrollment = Enrollment(
            id=uuid.uuid4(),
            class_id=class_id,
            student_id=student_id,
            parent_id=parent_id,
            enrolled_at=datetime.now(UTC),
        )
        return await self._class_repo.enroll(enrollment)
