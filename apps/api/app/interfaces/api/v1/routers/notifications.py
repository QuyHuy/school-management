from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db.repositories.notification_repository import (
    SQLFeedbackRepository,
    SQLNotificationRepository,
)
from app.infrastructure.db.session import get_db
from app.interfaces.api.v1.dependencies import require_role
from app.interfaces.api.v1.schemas.notification import (
    CreateFeedbackRequest,
    CreateNotificationRequest,
    FeedbackResponse,
    NotificationResponse,
    ReplyFeedbackRequest,
)

router = APIRouter()


def _notif_resp(n) -> NotificationResponse:
    return NotificationResponse(
        id=n.id, sender_id=n.sender_id, recipient_id=n.recipient_id,
        student_id=n.student_id, session_id=n.session_id,
        content=n.content, read_at=n.read_at, created_at=n.created_at,
    )


def _feedback_resp(f) -> FeedbackResponse:
    return FeedbackResponse(
        id=f.id, sender_id=f.sender_id, recipient_id=f.recipient_id,
        student_id=f.student_id, notification_id=f.notification_id,
        content=f.content, reply_content=f.reply_content,
        replied_by_id=f.replied_by_id, replied_at=f.replied_at, created_at=f.created_at,
    )


@router.post("/notifications", response_model=NotificationResponse, status_code=201)
async def create_notification(
    body: CreateNotificationRequest,
    token=Depends(require_role("teacher")),
    db: AsyncSession = Depends(get_db),
):
    repo = SQLNotificationRepository(db)
    n = await repo.create(
        org_id=token.org_id,
        sender_id=token.user_id,
        recipient_id=body.recipient_id,
        student_id=body.student_id,
        content=body.content,
        session_id=body.session_id,
    )
    return _notif_resp(n)


@router.get("/notifications", response_model=list[NotificationResponse])
async def list_notifications(
    token=Depends(require_role("parent")),
    db: AsyncSession = Depends(get_db),
):
    repo = SQLNotificationRepository(db)
    items = await repo.list_for_recipient(token.user_id, token.org_id)
    return [_notif_resp(n) for n in items]


@router.patch("/notifications/{notification_id}/read", status_code=204)
async def mark_notification_read(
    notification_id: UUID,
    token=Depends(require_role("parent")),
    db: AsyncSession = Depends(get_db),
):
    repo = SQLNotificationRepository(db)
    await repo.mark_read(notification_id, token.user_id)


@router.post("/feedback", response_model=FeedbackResponse, status_code=201)
async def create_feedback(
    body: CreateFeedbackRequest,
    token=Depends(require_role("parent")),
    db: AsyncSession = Depends(get_db),
):
    repo = SQLFeedbackRepository(db)
    f = await repo.create(
        org_id=token.org_id,
        sender_id=token.user_id,
        recipient_id=body.recipient_id,
        student_id=body.student_id,
        content=body.content,
        notification_id=body.notification_id,
    )
    return _feedback_resp(f)


@router.get("/feedback", response_model=list[FeedbackResponse])
async def list_feedback(
    token=Depends(require_role("teacher")),
    db: AsyncSession = Depends(get_db),
):
    repo = SQLFeedbackRepository(db)
    items = await repo.list_for_recipient(token.user_id, token.org_id)
    return [_feedback_resp(f) for f in items]


@router.patch("/feedback/{feedback_id}/reply", response_model=FeedbackResponse)
async def reply_feedback(
    feedback_id: UUID,
    body: ReplyFeedbackRequest,
    token=Depends(require_role("teacher")),
    db: AsyncSession = Depends(get_db),
):
    repo = SQLFeedbackRepository(db)
    f = await repo.reply(feedback_id, token.user_id, body.content)
    return _feedback_resp(f)
