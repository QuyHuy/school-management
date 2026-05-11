from __future__ import annotations

import random
import string

import redis.asyncio as redis_lib

from app.config import settings
from app.domain.entities.user import UserRole
from app.domain.exceptions import NotFoundError
from app.domain.repositories.user_repository import IUserRepository
from app.infrastructure.db.repositories.zalo_repository import SQLZaloRepository
from app.infrastructure.tasks import send_zalo_message

_OTP_TTL = 300


def _generate_otp() -> str:
    return "".join(random.choices(string.digits, k=6))


class RequestOTPUseCase:
    def __init__(self, user_repo: IUserRepository, zalo_repo: SQLZaloRepository, redis: redis_lib.Redis) -> None:
        self._user_repo = user_repo
        self._zalo_repo = zalo_repo
        self._redis = redis

    async def execute(self, phone: str) -> None:
        user = await self._user_repo.get_by_phone(phone)
        if not user or user.role != UserRole.parent:
            raise NotFoundError("parent", phone)

        binding = await self._zalo_repo.get_by_user_id(user.id)
        if not binding or not binding.is_following:
            raise NotFoundError("zalo_binding", str(user.id))

        otp = _generate_otp()
        await self._redis.setex(f"otp:{phone}", _OTP_TTL, otp)
        send_zalo_message.delay(
            binding.zalo_user_id,
            f"Mã đăng nhập của bạn là: {otp}\nMã có hiệu lực trong 5 phút, không chia sẻ cho ai.",
            settings.zalo_oa_access_token,
        )
