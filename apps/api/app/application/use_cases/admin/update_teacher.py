from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from app.domain.entities.user import UserRole
from app.domain.exceptions import ConflictError, NotFoundError
from app.domain.repositories.user_repository import IUserRepository


@dataclass
class UpdateTeacherInput:
    name: str
    email: str
    phone: str | None


class UpdateTeacherUseCase:
    def __init__(self, user_repo: IUserRepository) -> None:
        self._user_repo = user_repo

    async def execute(self, teacher_id: UUID, org_id: UUID, inp: UpdateTeacherInput) -> None:
        user = await self._user_repo.get_by_id(teacher_id)
        if not user or user.role != UserRole.teacher or user.organization_id != org_id:
            raise NotFoundError("Teacher", str(teacher_id))

        if inp.email and inp.email != user.email:
            existing = await self._user_repo.get_by_email(inp.email)
            if existing:
                raise ConflictError(f"Email '{inp.email}' is already taken")

        user.name = inp.name
        user.email = inp.email
        user.phone = inp.phone
        await self._user_repo.update(user)
