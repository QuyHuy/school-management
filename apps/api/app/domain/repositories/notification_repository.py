from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass
class Notification:
    id: UUID
    organization_id: UUID
    sender_id: UUID
    recipient_id: UUID
    student_id: UUID | None
    session_id: UUID | None
    content: str
    read_at: datetime | None
    created_at: datetime


@dataclass
class Feedback:
    id: UUID
    organization_id: UUID
    notification_id: UUID | None
    sender_id: UUID
    recipient_id: UUID
    student_id: UUID | None
    content: str
    reply_content: str | None
    replied_by_id: UUID | None
    replied_at: datetime | None
    created_at: datetime


class INotificationRepository(ABC):
    @abstractmethod
    async def create(
        self,
        org_id: UUID,
        sender_id: UUID,
        recipient_id: UUID,
        student_id: UUID | None,
        content: str,
        session_id: UUID | None,
    ) -> Notification: ...

    @abstractmethod
    async def list_for_recipient(self, recipient_id: UUID, org_id: UUID) -> list[Notification]: ...

    @abstractmethod
    async def list_sent_by(self, sender_id: UUID, org_id: UUID) -> list[Notification]: ...

    @abstractmethod
    async def mark_read(self, notification_id: UUID, user_id: UUID) -> None: ...


class IFeedbackRepository(ABC):
    @abstractmethod
    async def create(
        self,
        org_id: UUID,
        sender_id: UUID,
        recipient_id: UUID,
        student_id: UUID | None,
        content: str,
        notification_id: UUID | None,
    ) -> Feedback: ...

    @abstractmethod
    async def list_for_recipient(self, recipient_id: UUID, org_id: UUID) -> list[Feedback]: ...

    @abstractmethod
    async def reply(self, feedback_id: UUID, replied_by: UUID, content: str) -> Feedback: ...
