from __future__ import annotations

from pydantic import BaseModel


class ZaloSender(BaseModel):
    id: str
    display_name: str | None = None


class ZaloMessage(BaseModel):
    text: str
    msg_id: str | None = None


class ZaloWebhookEvent(BaseModel):
    app_id: str
    event_name: str
    timestamp: str
    sender: ZaloSender
    message: ZaloMessage | None = None


class ZaloBindingStatusResponse(BaseModel):
    is_bound: bool
    is_following: bool
    zalo_user_id: str | None
