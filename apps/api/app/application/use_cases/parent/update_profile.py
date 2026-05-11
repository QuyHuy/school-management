from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from app.domain.exceptions import ConflictError, NotFoundError
from app.domain.repositories.user_repository import IUserRepository


@dataclass
class UpdateProfileInput:
    name: str | None
    phone: str | None
    email: str | None


class UpdateParentProfileUseCase:
    def __init__(self, user_repo: IUserRepository) -> None:
        self._user_repo = user_repo

    async def execute(self, user_id: UUID, data: UpdateProfileInput):
        user = await self._user_repo.get_by_id(user_id)
        if not user:
            raise NotFoundError("User not found")

        if data.phone and data.phone != user.phone:
            existing = await self._user_repo.get_by_phone(data.phone)
            if existing and existing.id != user_id:
                raise ConflictError("Số điện thoại này đã được sử dụng bởi tài khoản khác")

        if data.email and data.email != user.email:
            existing = await self._user_repo.get_by_email(data.email)
            if existing and existing.id != user_id:
                raise ConflictError("Email này đã được sử dụng bởi tài khoản khác")

        user.name = data.name if data.name is not None else user.name
        user.phone = data.phone if data.phone is not None else user.phone
        user.email = data.email if data.email is not None else user.email

        return await self._user_repo.update(user)
