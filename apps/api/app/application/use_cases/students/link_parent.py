from __future__ import annotations

import uuid
from datetime import UTC, datetime

from app.application.use_cases.students.create_student import ParentInput
from app.domain.entities.student import Student
from app.domain.entities.user import User, UserRole
from app.domain.exceptions import ConflictError, NotFoundError, ValidationError
from app.domain.repositories.student_repository import IStudentRepository
from app.domain.repositories.user_repository import IUserRepository
from app.infrastructure.security.password import hash_password


class LinkParentUseCase:
    def __init__(self, student_repo: IStudentRepository, user_repo: IUserRepository) -> None:
        self._student_repo = student_repo
        self._user_repo = user_repo

    async def execute(self, student_id: uuid.UUID, org_id: uuid.UUID, parent: ParentInput) -> Student:
        student = await self._student_repo.get_by_id(student_id, org_id)
        if not student:
            raise NotFoundError("Student", str(student_id))
        if student.parent_id:
            raise ConflictError("Học sinh đã có tài khoản phụ huynh")

        existing = await self._user_repo.get_by_phone(parent.phone)
        if existing:
            if existing.role != UserRole.parent:
                raise ConflictError(
                    f"Số điện thoại '{parent.phone}' đang được dùng cho tài khoản {existing.role}, không thể dùng làm tài khoản phụ huynh"
                )
            parent_user = existing
        else:
            if not parent.name or not parent.password:
                raise ValidationError("Cần cung cấp tên và mật khẩu để tạo tài khoản phụ huynh mới")
            parent_user = User(
                id=uuid.uuid4(),
                organization_id=org_id,
                email=parent.email or "",
                password_hash=hash_password(parent.password),
                role=UserRole.parent,
                name=parent.name,
                phone=parent.phone,
                is_active=True,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
                deleted_at=None,
            )
            parent_user = await self._user_repo.create(parent_user)

        updated = await self._student_repo.update_parent(student_id, org_id, parent_user.id)
        return updated  # type: ignore[return-value]
