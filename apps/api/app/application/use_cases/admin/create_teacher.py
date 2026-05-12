from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from app.domain.entities.user import User, UserRole
from app.domain.exceptions import ConflictError
from app.domain.repositories.user_repository import IUserRepository
from app.infrastructure.security.password import hash_password


@dataclass
class CreateTeacherInput:
    name: str
    email: str
    password: str
    phone: str | None


class CreateTeacherUseCase:
    def __init__(self, user_repo: IUserRepository) -> None:
        self._user_repo = user_repo

    async def execute(self, org_id: UUID, inp: CreateTeacherInput) -> User:
        existing = await self._user_repo.get_by_email(inp.email)
        if existing:
            raise ConflictError(f"Email '{inp.email}' is already taken")

        now = datetime.now(UTC)
        user = User(
            id=uuid.uuid4(),
            organization_id=org_id,
            email=inp.email,
            password_hash=hash_password(inp.password),
            role=UserRole.teacher,
            name=inp.name,
            phone=inp.phone,
            is_active=True,
            created_at=now,
            updated_at=now,
            deleted_at=None,
        )
        return await self._user_repo.create(user)
