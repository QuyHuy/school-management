from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.repositories.notification_repository import (
    Feedback,
    IFeedbackRepository,
    INotificationRepository,
    Notification,
)
from app.infrastructure.db.models.notification import FeedbackModel, NotificationModel


def _to_notification(m: NotificationModel) -> Notification:
    return Notification(
        id=m.id,
        organization_id=m.organization_id,
        sender_id=m.sender_id,
        recipient_id=m.recipient_id,
        student_id=m.student_id,
        session_id=m.session_id,
        content=m.content,
        read_at=m.read_at,
        created_at=m.created_at,
    )


def _to_feedback(m: FeedbackModel) -> Feedback:
    return Feedback(
        id=m.id,
        organization_id=m.organization_id,
        notification_id=m.notification_id,
        sender_id=m.sender_id,
        recipient_id=m.recipient_id,
        student_id=m.student_id,
        content=m.content,
        reply_content=m.reply_content,
        replied_by_id=m.replied_by_id,
        replied_at=m.replied_at,
        created_at=m.created_at,
    )


class SQLNotificationRepository(INotificationRepository):
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def create(
        self,
        org_id: UUID,
        sender_id: UUID,
        recipient_id: UUID,
        student_id: UUID | None,
        content: str,
        session_id: UUID | None,
    ) -> Notification:
        m = NotificationModel(
            organization_id=org_id,
            sender_id=sender_id,
            recipient_id=recipient_id,
            student_id=student_id,
            session_id=session_id,
            content=content,
        )
        self._db.add(m)
        await self._db.flush()
        await self._db.refresh(m)
        return _to_notification(m)

    async def list_for_recipient(self, recipient_id: UUID, org_id: UUID) -> list[Notification]:
        rows = (
            await self._db.execute(
                select(NotificationModel)
                .where(
                    NotificationModel.recipient_id == recipient_id,
                    NotificationModel.organization_id == org_id,
                )
                .order_by(NotificationModel.created_at.desc())
            )
        ).scalars().all()
        return [_to_notification(r) for r in rows]

    async def list_sent_by(self, sender_id: UUID, org_id: UUID) -> list[Notification]:
        rows = (
            await self._db.execute(
                select(NotificationModel)
                .where(
                    NotificationModel.sender_id == sender_id,
                    NotificationModel.organization_id == org_id,
                )
                .order_by(NotificationModel.created_at.desc())
            )
        ).scalars().all()
        return [_to_notification(r) for r in rows]

    async def mark_read(self, notification_id: UUID, user_id: UUID) -> None:
        await self._db.execute(
            update(NotificationModel)
            .where(
                NotificationModel.id == notification_id,
                NotificationModel.recipient_id == user_id,
            )
            .values(read_at=datetime.now(UTC))
        )


class SQLFeedbackRepository(IFeedbackRepository):
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def create(
        self,
        org_id: UUID,
        sender_id: UUID,
        recipient_id: UUID,
        student_id: UUID | None,
        content: str,
        notification_id: UUID | None,
    ) -> Feedback:
        m = FeedbackModel(
            organization_id=org_id,
            sender_id=sender_id,
            recipient_id=recipient_id,
            student_id=student_id,
            content=content,
            notification_id=notification_id,
        )
        self._db.add(m)
        await self._db.flush()
        await self._db.refresh(m)
        return _to_feedback(m)

    async def list_for_recipient(self, recipient_id: UUID, org_id: UUID) -> list[Feedback]:
        rows = (
            await self._db.execute(
                select(FeedbackModel)
                .where(
                    FeedbackModel.recipient_id == recipient_id,
                    FeedbackModel.organization_id == org_id,
                )
                .order_by(FeedbackModel.created_at.desc())
            )
        ).scalars().all()
        return [_to_feedback(r) for r in rows]

    async def reply(self, feedback_id: UUID, replied_by: UUID, content: str) -> Feedback:
        await self._db.execute(
            update(FeedbackModel)
            .where(FeedbackModel.id == feedback_id)
            .values(
                reply_content=content,
                replied_by_id=replied_by,
                replied_at=datetime.now(UTC),
            )
        )
        m = await self._db.get(FeedbackModel, feedback_id)
        assert m is not None
        return _to_feedback(m)
