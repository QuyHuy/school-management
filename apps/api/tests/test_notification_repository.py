import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.domain.repositories.notification_repository import Feedback, Notification
from app.infrastructure.db.repositories.notification_repository import (
    SQLFeedbackRepository,
    SQLNotificationRepository,
)

_ORG = uuid.UUID("00000000-0000-0000-0000-000000000002")
_SENDER = uuid.UUID("00000000-0000-0000-0000-000000000001")
_RECIPIENT = uuid.UUID("00000000-0000-0000-0000-000000000003")
_NOW = datetime(2026, 5, 11, tzinfo=timezone.utc)


def _make_notif_model(**kwargs):
    m = MagicMock()
    m.id = uuid.uuid4()
    m.organization_id = _ORG
    m.sender_id = _SENDER
    m.recipient_id = _RECIPIENT
    m.student_id = None
    m.session_id = None
    m.content = "Test content"
    m.read_at = None
    m.created_at = _NOW
    for k, v in kwargs.items():
        setattr(m, k, v)
    return m


def _make_feedback_model(**kwargs):
    m = MagicMock()
    m.id = uuid.uuid4()
    m.organization_id = _ORG
    m.notification_id = None
    m.sender_id = _RECIPIENT
    m.recipient_id = _SENDER
    m.student_id = None
    m.content = "Feedback content"
    m.reply_content = None
    m.replied_by_id = None
    m.replied_at = None
    m.created_at = _NOW
    for k, v in kwargs.items():
        setattr(m, k, v)
    return m


@pytest.mark.asyncio
async def test_notification_repo_create():
    db = AsyncMock()
    notif_model = _make_notif_model()
    db.flush = AsyncMock()
    db.refresh = AsyncMock()
    db.add = MagicMock()

    repo = SQLNotificationRepository(db)
    with patch.object(repo, "create", return_value=Notification(
        id=notif_model.id, organization_id=_ORG, sender_id=_SENDER,
        recipient_id=_RECIPIENT, student_id=None, session_id=None,
        content="Test content", read_at=None, created_at=_NOW,
    )) as mock_create:
        result = await repo.create(_ORG, _SENDER, _RECIPIENT, None, "Test content", None)

    assert result.content == "Test content"
    assert result.read_at is None


@pytest.mark.asyncio
async def test_notification_repo_list_for_recipient_returns_list():
    db = AsyncMock()
    notif = _make_notif_model()
    scalars_mock = MagicMock()
    scalars_mock.all.return_value = [notif]
    result_mock = MagicMock()
    result_mock.scalars.return_value = scalars_mock
    db.execute = AsyncMock(return_value=result_mock)

    repo = SQLNotificationRepository(db)
    items = await repo.list_for_recipient(_RECIPIENT, _ORG)
    assert len(items) == 1
    assert items[0].content == "Test content"


@pytest.mark.asyncio
async def test_feedback_repo_list_for_recipient_returns_list():
    db = AsyncMock()
    fb = _make_feedback_model()
    scalars_mock = MagicMock()
    scalars_mock.all.return_value = [fb]
    result_mock = MagicMock()
    result_mock.scalars.return_value = scalars_mock
    db.execute = AsyncMock(return_value=result_mock)

    repo = SQLFeedbackRepository(db)
    items = await repo.list_for_recipient(_SENDER, _ORG)
    assert len(items) == 1
    assert items[0].content == "Feedback content"
