from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateNotificationRequest(BaseModel):
    recipient_id: UUID
    student_id: UUID | None = None
    session_id: UUID | None = None
    content: str


class NotificationResponse(BaseModel):
    id: UUID
    sender_id: UUID
    recipient_id: UUID
    student_id: UUID | None
    session_id: UUID | None
    content: str
    read_at: datetime | None
    created_at: datetime


class CreateFeedbackRequest(BaseModel):
    recipient_id: UUID
    student_id: UUID | None = None
    notification_id: UUID | None = None
    content: str


class ReplyFeedbackRequest(BaseModel):
    content: str


class FeedbackResponse(BaseModel):
    id: UUID
    sender_id: UUID
    recipient_id: UUID
    student_id: UUID | None
    notification_id: UUID | None
    content: str
    reply_content: str | None
    replied_by_id: UUID | None
    replied_at: datetime | None
    created_at: datetime
