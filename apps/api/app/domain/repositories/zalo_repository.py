from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass
class ZaloBinding:
    id: UUID
    organization_id: UUID
    user_id: UUID
    zalo_user_id: str
    is_following: bool
    bound_at: datetime
    updated_at: datetime


class IZaloRepository(ABC):
    @abstractmethod
    async def get_by_user_id(self, user_id: UUID) -> ZaloBinding | None: ...

    @abstractmethod
    async def get_by_zalo_user_id(self, org_id: UUID, zalo_user_id: str) -> ZaloBinding | None: ...

    @abstractmethod
    async def upsert(
        self, org_id: UUID, user_id: UUID, zalo_user_id: str, is_following: bool
    ) -> ZaloBinding: ...

    @abstractmethod
    async def set_following(self, zalo_user_id: str, org_id: UUID, is_following: bool) -> None: ...
