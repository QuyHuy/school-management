from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.zalo.handle_webhook import HandleZaloWebhookUseCase
from app.infrastructure.db.repositories.zalo_repository import SQLZaloRepository
from app.infrastructure.db.session import get_db
from app.interfaces.api.v1.dependencies import require_role
from app.interfaces.api.v1.schemas.zalo import ZaloBindingStatusResponse, ZaloWebhookEvent

router = APIRouter()


@router.post("/webhook")
async def zalo_webhook(
    event: ZaloWebhookEvent,
    db: AsyncSession = Depends(get_db),
):
    try:
        org_id = UUID(event.app_id)
    except ValueError:
        return {"ok": True}

    await HandleZaloWebhookUseCase(db).execute(
        event_name=event.event_name,
        zalo_user_id=event.sender.id,
        org_id=org_id,
        message_text=event.message.text if event.message else None,
    )
    return {"ok": True}


@router.get("/binding/status", response_model=ZaloBindingStatusResponse)
async def binding_status(
    token=Depends(require_role("parent")),
    db: AsyncSession = Depends(get_db),
):
    repo = SQLZaloRepository(db)
    binding = await repo.get_by_user_id(token.user_id)
    if not binding:
        return ZaloBindingStatusResponse(is_bound=False, is_following=False, zalo_user_id=None)
    return ZaloBindingStatusResponse(
        is_bound=True,
        is_following=binding.is_following,
        zalo_user_id=binding.zalo_user_id,
    )
