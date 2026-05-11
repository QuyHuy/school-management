from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.admin import OrgSettings
from app.domain.exceptions import NotFoundError
from app.infrastructure.db.models.user import OrganizationModel


class GetSettingsUseCase:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def execute(self, org_id: UUID) -> OrgSettings:
        result = await self._session.execute(
            select(OrganizationModel).where(OrganizationModel.id == org_id)
        )
        org = result.scalar_one_or_none()
        if not org:
            raise NotFoundError("Organization", str(org_id))

        token = org.zalo_oa_token_encrypted
        if token and len(token) >= 4:
            masked = f"{'*' * (len(token) - 4)}{token[-4:]}"
        else:
            masked = token

        return OrgSettings(
            name=org.name,
            phone=org.phone,
            address=org.address,
            academic_year=org.academic_year,
            logo_url=org.logo_url,
            zalo_oa_id=org.zalo_oa_id,
            zalo_oa_token=masked,
        )
