from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date, datetime, timezone

from app.domain.entities.student import Student
from app.domain.entities.user import User, UserRole
from app.domain.exceptions import ConflictError, ValidationError
from app.domain.repositories.student_repository import IStudentRepository
from app.domain.repositories.user_repository import IUserRepository
from app.infrastructure.security.password import hash_password


@dataclass
class ParentInput:
    phone: str
    name: str | None = None
    email: str | None = None
    password: str | None = None


def _generate_code_base(name: str) -> str:
    parts = [p for p in name.strip().split() if p]
    if len(parts) == 1:
        return parts[0]
    last = parts[-1]
    initials = "".join(p[0] for p in parts[:-1])
    return last + initials


class CreateStudentUseCase:
    def __init__(
        self,
        student_repo: IStudentRepository,
        user_repo: IUserRepository,
    ) -> None:
        self._student_repo = student_repo
        self._user_repo = user_repo

    async def execute(
        self,
        org_id: uuid.UUID,
        name: str,
        grade: int,
        date_of_birth: date | None,
        note: str | None,
        parent: ParentInput | None = None,
    ) -> Student:
        parent_user: User | None = None

        if parent:
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
                    email=parent.email,
                    password_hash=hash_password(parent.password),
                    role=UserRole.parent,
                    name=parent.name,
                    phone=parent.phone,
                    is_active=True,
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                    deleted_at=None,
                )
                parent_user = await self._user_repo.create(parent_user)

        base_code = _generate_code_base(name)
        student_code = await self._student_repo.get_next_student_code(base_code, org_id)

        student = Student(
            id=uuid.uuid4(),
            organization_id=org_id,
            name=name,
            student_code=student_code,
            grade=grade,
            date_of_birth=date_of_birth,
            note=note,
            parent_id=parent_user.id if parent_user else None,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            deleted_at=None,
        )
        return await self._student_repo.create(student)
