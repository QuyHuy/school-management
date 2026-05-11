from __future__ import annotations

from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.repositories.zalo_repository import IZaloRepository, ZaloBinding
from app.infrastructure.db.models.zalo import ZaloBindingModel


def _to_entity(m: ZaloBindingModel) -> ZaloBinding:
    return ZaloBinding(
        id=m.id,
        organization_id=m.organization_id,
        user_id=m.user_id,
        zalo_user_id=m.zalo_user_id,
        is_following=m.is_following,
        bound_at=m.bound_at,
        updated_at=m.updated_at,
    )


class SQLZaloRepository(IZaloRepository):
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_by_user_id(self, user_id: UUID) -> ZaloBinding | None:
        row = await self._db.scalar(
            select(ZaloBindingModel).where(ZaloBindingModel.user_id == user_id)
        )
        return _to_entity(row) if row else None

    async def get_by_zalo_user_id(self, org_id: UUID, zalo_user_id: str) -> ZaloBinding | None:
        row = await self._db.scalar(
            select(ZaloBindingModel).where(
                ZaloBindingModel.organization_id == org_id,
                ZaloBindingModel.zalo_user_id == zalo_user_id,
            )
        )
        return _to_entity(row) if row else None

    async def upsert(
        self, org_id: UUID, user_id: UUID, zalo_user_id: str, is_following: bool
    ) -> ZaloBinding:
        stmt = (
            pg_insert(ZaloBindingModel)
            .values(
                organization_id=org_id,
                user_id=user_id,
                zalo_user_id=zalo_user_id,
                is_following=is_following,
            )
            .on_conflict_do_update(
                index_elements=["user_id"],
                set_={"zalo_user_id": zalo_user_id, "is_following": is_following},
            )
            .returning(ZaloBindingModel)
        )
        result = await self._db.execute(stmt)
        row = result.scalar_one()
        return _to_entity(row)

    async def set_following(self, zalo_user_id: str, org_id: UUID, is_following: bool) -> None:
        await self._db.execute(
            update(ZaloBindingModel)
            .where(
                ZaloBindingModel.zalo_user_id == zalo_user_id,
                ZaloBindingModel.organization_id == org_id,
            )
            .values(is_following=is_following)
        )
