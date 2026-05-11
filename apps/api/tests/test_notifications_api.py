import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from app.infrastructure.security.jwt import TokenData
from app.interfaces.api.v1.dependencies import get_current_user
from app.main import app

_ORG_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")
_TEACHER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
_PARENT_ID = uuid.UUID("00000000-0000-0000-0000-000000000003")
_NOTIF_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")
_NOW = datetime(2026, 5, 11, tzinfo=timezone.utc)

_TEACHER_TOKEN = TokenData(user_id=_TEACHER_ID, org_id=_ORG_ID, role="teacher", jti="j1", exp=9999999999)
_PARENT_TOKEN = TokenData(user_id=_PARENT_ID, org_id=_ORG_ID, role="parent", jti="j2", exp=9999999999)


def _notif_entity():
    from app.domain.repositories.notification_repository import Notification
    return Notification(
        id=_NOTIF_ID, organization_id=_ORG_ID,
        sender_id=_TEACHER_ID, recipient_id=_PARENT_ID,
        student_id=None, session_id=None,
        content="Em học tốt!", read_at=None, created_at=_NOW,
    )


def _feedback_entity():
    from app.domain.repositories.notification_repository import Feedback
    return Feedback(
        id=uuid.uuid4(), organization_id=_ORG_ID,
        notification_id=_NOTIF_ID,
        sender_id=_PARENT_ID, recipient_id=_TEACHER_ID,
        student_id=None, content="Cảm ơn giáo viên!",
        reply_content=None, replied_by_id=None, replied_at=None, created_at=_NOW,
    )


@pytest.mark.asyncio
async def test_create_notification_requires_teacher(client):
    resp = await client.post(
        "/api/v1/notifications",
        json={"recipient_id": str(_PARENT_ID), "content": "test"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_teacher_creates_notification(client):
    app.dependency_overrides[get_current_user] = lambda: _TEACHER_TOKEN
    try:
        with patch("app.interfaces.api.v1.routers.notifications.SQLNotificationRepository") as MockRepo:
            MockRepo.return_value.create = AsyncMock(return_value=_notif_entity())
            resp = await client.post(
                "/api/v1/notifications",
                json={"recipient_id": str(_PARENT_ID), "content": "Em học tốt!"},
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 201
        data = resp.json()
        assert data["content"] == "Em học tốt!"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_parent_lists_notifications(client):
    app.dependency_overrides[get_current_user] = lambda: _PARENT_TOKEN
    try:
        with patch("app.interfaces.api.v1.routers.notifications.SQLNotificationRepository") as MockRepo:
            MockRepo.return_value.list_for_recipient = AsyncMock(return_value=[_notif_entity()])
            resp = await client.get("/api/v1/notifications", headers={"Authorization": "Bearer fake"})
        assert resp.status_code == 200
        assert len(resp.json()) == 1
        assert resp.json()[0]["content"] == "Em học tốt!"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_parent_marks_notification_read(client):
    app.dependency_overrides[get_current_user] = lambda: _PARENT_TOKEN
    try:
        with patch("app.interfaces.api.v1.routers.notifications.SQLNotificationRepository") as MockRepo:
            MockRepo.return_value.mark_read = AsyncMock(return_value=None)
            resp = await client.patch(
                f"/api/v1/notifications/{_NOTIF_ID}/read",
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 204
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_parent_creates_feedback(client):
    app.dependency_overrides[get_current_user] = lambda: _PARENT_TOKEN
    try:
        with patch("app.interfaces.api.v1.routers.notifications.SQLFeedbackRepository") as MockRepo:
            MockRepo.return_value.create = AsyncMock(return_value=_feedback_entity())
            resp = await client.post(
                "/api/v1/feedback",
                json={
                    "recipient_id": str(_TEACHER_ID),
                    "content": "Cảm ơn giáo viên!",
                    "notification_id": str(_NOTIF_ID),
                },
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 201
        data = resp.json()
        assert data["content"] == "Cảm ơn giáo viên!"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_teacher_lists_feedback(client):
    app.dependency_overrides[get_current_user] = lambda: _TEACHER_TOKEN
    try:
        with patch("app.interfaces.api.v1.routers.notifications.SQLFeedbackRepository") as MockRepo:
            MockRepo.return_value.list_for_recipient = AsyncMock(return_value=[_feedback_entity()])
            resp = await client.get("/api/v1/feedback", headers={"Authorization": "Bearer fake"})
        assert resp.status_code == 200
        assert len(resp.json()) == 1
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_teacher_replies_feedback(client):
    replied_fb = _feedback_entity()
    replied_fb.reply_content = "Cháu rất tiến bộ!"
    replied_fb.replied_by_id = _TEACHER_ID
    app.dependency_overrides[get_current_user] = lambda: _TEACHER_TOKEN
    try:
        with patch("app.interfaces.api.v1.routers.notifications.SQLFeedbackRepository") as MockRepo:
            MockRepo.return_value.reply = AsyncMock(return_value=replied_fb)
            resp = await client.patch(
                f"/api/v1/feedback/{replied_fb.id}/reply",
                json={"content": "Cháu rất tiến bộ!"},
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 200
        assert resp.json()["reply_content"] == "Cháu rất tiến bộ!"
    finally:
        app.dependency_overrides.pop(get_current_user, None)
