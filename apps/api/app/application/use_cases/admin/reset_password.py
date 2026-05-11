from __future__ import annotations

from uuid import UUID

from app.domain.entities.user import UserRole
from app.domain.exceptions import NotFoundError
from app.domain.repositories.user_repository import IUserRepository
from app.infrastructure.security.password import hash_password


class ResetPasswordUseCase:
    def __init__(self, user_repo: IUserRepository) -> None:
        self._user_repo = user_repo

    async def execute(self, teacher_id: UUID, org_id: UUID, new_password: str) -> None:
        user = await self._user_repo.get_by_id(teacher_id)
        if not user or user.role != UserRole.teacher or user.organization_id != org_id:
            raise NotFoundError("Teacher", str(teacher_id))
        await self._user_repo.update_password(teacher_id, hash_password(new_password))
