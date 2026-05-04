from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date, datetime, timezone

from app.domain.entities.student import Student
from app.domain.entities.user import User, UserRole
from app.domain.exceptions import ConflictError
from app.domain.repositories.student_repository import IStudentRepository
from app.domain.repositories.user_repository import IUserRepository
from app.infrastructure.security.password import hash_password


@dataclass
class ParentInput:
    name: str
    email: str
    phone: str | None
    password: str


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
        date_of_birth: date | None,
        note: str | None,
        parent: ParentInput | None = None,
    ) -> Student:
        parent_user: User | None = None

        if parent:
            existing = await self._user_repo.get_by_email(parent.email)
            if existing:
                raise ConflictError(f"Email '{parent.email}' đã được sử dụng")
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

        student = Student(
            id=uuid.uuid4(),
            organization_id=org_id,
            name=name,
            date_of_birth=date_of_birth,
            note=note,
            parent_id=parent_user.id if parent_user else None,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            deleted_at=None,
        )
        return await self._student_repo.create(student)
