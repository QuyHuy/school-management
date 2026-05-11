from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.exceptions import NotFoundError
from app.infrastructure.db.models.user import OrganizationModel


@dataclass
class UpdateSettingsInput:
    name: str | None
    phone: str | None
    address: str | None
    academic_year: str | None
    logo_url: str | None
    zalo_oa_id: str | None
    zalo_oa_token: str | None


class UpdateSettingsUseCase:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def execute(self, org_id: UUID, inp: UpdateSettingsInput) -> None:
        result = await self._session.execute(
            select(OrganizationModel).where(OrganizationModel.id == org_id)
        )
        org = result.scalar_one_or_none()
        if not org:
            raise NotFoundError("Organization", str(org_id))

        if inp.name is not None:
            org.name = inp.name
        if inp.phone is not None:
            org.phone = inp.phone
        if inp.address is not None:
            org.address = inp.address
        if inp.academic_year is not None:
            org.academic_year = inp.academic_year
        if inp.logo_url is not None:
            org.logo_url = inp.logo_url
        if inp.zalo_oa_id is not None:
            org.zalo_oa_id = inp.zalo_oa_id
        if inp.zalo_oa_token is not None:
            org.zalo_oa_token_encrypted = inp.zalo_oa_token

        await self._session.flush()
