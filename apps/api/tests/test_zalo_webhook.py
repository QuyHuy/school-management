import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.main import app

_ORG_ID = uuid.UUID("00000000-0000-0000-0000-000000000099")


@pytest.mark.asyncio
async def test_webhook_follow_event_returns_200(client):
    with patch("app.interfaces.api.v1.routers.zalo.HandleZaloWebhookUseCase") as MockUC:
        MockUC.return_value.execute = AsyncMock(return_value=None)
        resp = await client.post(
            "/api/v1/zalo/webhook",
            json={
                "app_id": str(_ORG_ID),
                "event_name": "follow",
                "timestamp": "1700000000000",
                "sender": {"id": "zalo_new_user", "display_name": "Nguyen Van A"},
            },
        )
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


@pytest.mark.asyncio
async def test_webhook_unfollow_event_returns_200(client):
    with patch("app.interfaces.api.v1.routers.zalo.HandleZaloWebhookUseCase") as MockUC:
        MockUC.return_value.execute = AsyncMock(return_value=None)
        resp = await client.post(
            "/api/v1/zalo/webhook",
            json={
                "app_id": str(_ORG_ID),
                "event_name": "unfollow",
                "timestamp": "1700000000001",
                "sender": {"id": "zalo_existing_user"},
            },
        )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_webhook_invalid_app_id_returns_200(client):
    resp = await client.post(
        "/api/v1/zalo/webhook",
        json={
            "app_id": "not-a-uuid",
            "event_name": "follow",
            "timestamp": "1700000000002",
            "sender": {"id": "zalo_user"},
        },
    )
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
