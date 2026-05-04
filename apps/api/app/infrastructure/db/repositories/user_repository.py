from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.user import User, UserRole
from app.domain.repositories.user_repository import IUserRepository
from app.infrastructure.db.models.user import UserModel


def _to_domain(row: UserModel) -> User:
    return User(
        id=row.id,
        organization_id=row.organization_id,
        email=row.email,
        password_hash=row.password_hash,
        role=UserRole(row.role),
        name=row.name,
        phone=row.phone,
        is_active=row.is_active,
        created_at=row.created_at,
        updated_at=row.updated_at,
        deleted_at=row.deleted_at,
    )


class SQLUserRepository(IUserRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_email(self, email: str) -> User | None:
        result = await self._session.execute(
            select(UserModel).where(UserModel.email == email, UserModel.deleted_at.is_(None))
        )
        row = result.scalar_one_or_none()
        return _to_domain(row) if row else None

    async def get_by_id(self, user_id: UUID) -> User | None:
        result = await self._session.execute(
            select(UserModel).where(UserModel.id == user_id, UserModel.deleted_at.is_(None))
        )
        row = result.scalar_one_or_none()
        return _to_domain(row) if row else None

    async def create(self, user: User) -> User:
        row = UserModel(
            id=user.id,
            organization_id=user.organization_id,
            email=user.email,
            password_hash=user.password_hash,
            role=user.role.value,
            name=user.name,
            phone=user.phone,
            is_active=user.is_active,
        )
        self._session.add(row)
        await self._session.flush()
        await self._session.refresh(row)
        return _to_domain(row)
