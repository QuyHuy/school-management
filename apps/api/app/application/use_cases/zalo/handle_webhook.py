from __future__ import annotations

import re
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.infrastructure.db.repositories.user_repository import SQLUserRepository
from app.infrastructure.db.repositories.zalo_repository import SQLZaloRepository
from app.infrastructure.tasks import send_zalo_message

_PHONE_RE = re.compile(r"0\d{9}")

WELCOME_MSG = (
    "Xin chào! Để liên kết tài khoản phụ huynh, vui lòng nhắn SĐT của bạn "
    "(ví dụ: 0912345678)."
)


class HandleZaloWebhookUseCase:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._zalo_repo = SQLZaloRepository(db)
        self._user_repo = SQLUserRepository(db)

    async def execute(
        self, event_name: str, zalo_user_id: str, org_id: UUID, message_text: str | None
    ) -> None:
        if event_name == "follow":
            await self._handle_follow(zalo_user_id, org_id)
        elif event_name == "unfollow":
            await self._zalo_repo.set_following(zalo_user_id, org_id, False)
        elif event_name == "user_send_text" and message_text:
            await self._handle_message(zalo_user_id, org_id, message_text)

    async def _handle_follow(self, zalo_user_id: str, org_id: UUID) -> None:
        send_zalo_message.delay(zalo_user_id, WELCOME_MSG, settings.zalo_oa_access_token)

    async def _handle_message(self, zalo_user_id: str, org_id: UUID, text: str) -> None:
        match = _PHONE_RE.search(text.strip())
        if not match:
            return
        phone = match.group()
        user = await self._user_repo.get_by_phone(phone)
        if not user or str(user.organization_id) != str(org_id):
            return
        await self._zalo_repo.upsert(org_id, user.id, zalo_user_id, True)
        send_zalo_message.delay(
            zalo_user_id,
            "Đã liên kết tài khoản phụ huynh thành công! Bạn sẽ nhận thông báo từ giáo viên qua đây.",
            settings.zalo_oa_access_token,
        )
