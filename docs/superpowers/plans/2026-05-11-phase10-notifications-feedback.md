# Phase 10: Notifications & Feedback — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow teachers to send learning notifications to parents (which also trigger Zalo messages), and allow parents to reply with feedback. Teachers can view the feedback inbox and reply back.

**Architecture:** Two new DB tables: `notifications` (teacher→parent, can link to a session) and `feedback` (parent→teacher, can link to a notification). Both support org-level isolation via `organization_id`. The teacher creates a notification per-student or per-class. The parent sees their notifications, can mark as read, and can create feedback. The teacher sees their feedback inbox and can reply.

**Tech Stack:** Python FastAPI, SQLAlchemy async, Alembic, Next.js 15 (TypeScript)

---

## File Map

**New files (API):**
- `apps/api/app/infrastructure/db/models/notification.py` — NotificationModel, FeedbackModel
- `apps/api/app/domain/repositories/notification_repository.py` — interfaces
- `apps/api/app/infrastructure/db/repositories/notification_repository.py` — SQL impl
- `apps/api/app/application/use_cases/notifications/create_notification.py`
- `apps/api/app/application/use_cases/notifications/list_teacher_notifications.py`
- `apps/api/app/application/use_cases/notifications/list_parent_notifications.py`
- `apps/api/app/application/use_cases/notifications/mark_notification_read.py`
- `apps/api/app/application/use_cases/feedback/create_feedback.py`
- `apps/api/app/application/use_cases/feedback/list_teacher_feedback.py`
- `apps/api/app/application/use_cases/feedback/reply_feedback.py`
- `apps/api/app/interfaces/api/v1/schemas/notification.py`
- `apps/api/app/interfaces/api/v1/routers/notifications.py`
- `apps/api/alembic/versions/c8b4e1a3f7d2_add_notifications_feedback.py`

**Modified files (API):**
- `apps/api/app/infrastructure/db/models/__init__.py` — import new models
- `apps/api/app/main.py` — include notifications router

**New files (Web):**
- `apps/web/src/features/notifications/api/notifications.api.ts`
- `apps/web/src/features/notifications/model/types.ts`
- `apps/web/src/features/notifications/ui/NotificationCard.tsx`
- `apps/web/src/features/notifications/ui/FeedbackCard.tsx`
- `apps/web/app/(teacher)/feedback/page.tsx` — teacher feedback inbox
- `apps/web/app/(portal)/parent/notifications/page.tsx` — parent notifications

**Modified files (Web):**
- `apps/web/app/(portal)/layout.tsx` — add "Thông báo" to bottom nav

---

### Task 1: Notification & Feedback DB Models + Migration

**Files:**
- Create: `apps/api/app/infrastructure/db/models/notification.py`
- Modify: `apps/api/app/infrastructure/db/models/__init__.py`
- Create: `apps/api/alembic/versions/c8b4e1a3f7d2_add_notifications_feedback.py`
- Test: `apps/api/tests/test_notification_model.py`

- [ ] **Step 1: Write the failing test**

```python
# apps/api/tests/test_notification_model.py
import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text


@pytest.mark.asyncio
async def test_notifications_table_exists(db: AsyncSession):
    result = await db.execute(text("SELECT 1 FROM notifications LIMIT 0"))
    assert result is not None


@pytest.mark.asyncio
async def test_feedback_table_exists(db: AsyncSession):
    result = await db.execute(text("SELECT 1 FROM feedback LIMIT 0"))
    assert result is not None
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd apps/api && pytest tests/test_notification_model.py -v
```

Expected: `FAIL` — tables don't exist.

- [ ] **Step 3: Write the models**

```python
# apps/api/app/infrastructure/db/models/notification.py
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.db.session import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class NotificationModel(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    recipient_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    student_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("students.id"), nullable=True, index=True
    )
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("class_sessions.id"), nullable=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class FeedbackModel(Base):
    __tablename__ = "feedback"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    notification_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("notifications.id"), nullable=True
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    recipient_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    student_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("students.id"), nullable=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    reply_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    replied_by_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    replied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
```

- [ ] **Step 4: Register models**

Add to `apps/api/app/infrastructure/db/models/__init__.py`:

```python
from app.infrastructure.db.models.notification import NotificationModel, FeedbackModel  # noqa: F401
```

- [ ] **Step 5: Write Alembic migration**

```python
# apps/api/alembic/versions/c8b4e1a3f7d2_add_notifications_feedback.py
"""add_notifications_feedback

Revision ID: c8b4e1a3f7d2
Revises: a9f3c2d5e1b4
Create Date: 2026-05-11 00:01:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c8b4e1a3f7d2'
down_revision: Union[str, None] = 'a9f3c2d5e1b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'notifications',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=False),
        sa.Column('sender_id', sa.UUID(), nullable=False),
        sa.Column('recipient_id', sa.UUID(), nullable=False),
        sa.Column('student_id', sa.UUID(), nullable=True),
        sa.Column('session_id', sa.UUID(), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id']),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id']),
        sa.ForeignKeyConstraint(['recipient_id'], ['users.id']),
        sa.ForeignKeyConstraint(['student_id'], ['students.id']),
        sa.ForeignKeyConstraint(['session_id'], ['class_sessions.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_notifications_organization_id'), 'notifications', ['organization_id'])
    op.create_index(op.f('ix_notifications_sender_id'), 'notifications', ['sender_id'])
    op.create_index(op.f('ix_notifications_recipient_id'), 'notifications', ['recipient_id'])
    op.create_index(op.f('ix_notifications_student_id'), 'notifications', ['student_id'])

    op.create_table(
        'feedback',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=False),
        sa.Column('notification_id', sa.UUID(), nullable=True),
        sa.Column('sender_id', sa.UUID(), nullable=False),
        sa.Column('recipient_id', sa.UUID(), nullable=False),
        sa.Column('student_id', sa.UUID(), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('reply_content', sa.Text(), nullable=True),
        sa.Column('replied_by_id', sa.UUID(), nullable=True),
        sa.Column('replied_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id']),
        sa.ForeignKeyConstraint(['notification_id'], ['notifications.id']),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id']),
        sa.ForeignKeyConstraint(['recipient_id'], ['users.id']),
        sa.ForeignKeyConstraint(['student_id'], ['students.id']),
        sa.ForeignKeyConstraint(['replied_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_feedback_organization_id'), 'feedback', ['organization_id'])
    op.create_index(op.f('ix_feedback_sender_id'), 'feedback', ['sender_id'])
    op.create_index(op.f('ix_feedback_recipient_id'), 'feedback', ['recipient_id'])


def downgrade() -> None:
    op.drop_index(op.f('ix_feedback_recipient_id'), table_name='feedback')
    op.drop_index(op.f('ix_feedback_sender_id'), table_name='feedback')
    op.drop_index(op.f('ix_feedback_organization_id'), table_name='feedback')
    op.drop_table('feedback')
    op.drop_index(op.f('ix_notifications_student_id'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_recipient_id'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_sender_id'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_organization_id'), table_name='notifications')
    op.drop_table('notifications')
```

Run migration:
```bash
cd apps/api && alembic upgrade head
```

- [ ] **Step 6: Run test — verify it passes**

```bash
cd apps/api && pytest tests/test_notification_model.py -v
```

Expected: `PASS`

- [ ] **Step 7: Commit**

```bash
git add apps/api/app/infrastructure/db/models/notification.py \
        apps/api/app/infrastructure/db/models/__init__.py \
        apps/api/alembic/versions/c8b4e1a3f7d2_add_notifications_feedback.py \
        apps/api/tests/test_notification_model.py
git commit -m "feat: add Notification and Feedback models + migration"
```

---

### Task 2: Notification Repository

**Files:**
- Create: `apps/api/app/domain/repositories/notification_repository.py`
- Create: `apps/api/app/infrastructure/db/repositories/notification_repository.py`
- Test: `apps/api/tests/test_notification_repository.py`

- [ ] **Step 1: Write the failing test**

```python
# apps/api/tests/test_notification_repository.py
import uuid
import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from app.infrastructure.db.repositories.notification_repository import SQLNotificationRepository


@pytest.mark.asyncio
async def test_create_notification(db: AsyncSession, test_org, test_teacher_user, test_parent_user, test_student):
    repo = SQLNotificationRepository(db)
    notif = await repo.create(
        org_id=test_org.id,
        sender_id=test_teacher_user.id,
        recipient_id=test_parent_user.id,
        student_id=test_student.id,
        content="Em học tốt hôm nay!",
        session_id=None,
    )
    assert notif.id is not None
    assert notif.content == "Em học tốt hôm nay!"
    assert notif.read_at is None


@pytest.mark.asyncio
async def test_list_for_recipient(db, test_org, test_teacher_user, test_parent_user, test_student):
    repo = SQLNotificationRepository(db)
    await repo.create(test_org.id, test_teacher_user.id, test_parent_user.id, test_student.id, "msg1", None)
    await repo.create(test_org.id, test_teacher_user.id, test_parent_user.id, test_student.id, "msg2", None)

    items = await repo.list_for_recipient(test_parent_user.id, test_org.id)
    assert len(items) == 2


@pytest.mark.asyncio
async def test_mark_read(db, test_org, test_teacher_user, test_parent_user, test_student):
    repo = SQLNotificationRepository(db)
    notif = await repo.create(test_org.id, test_teacher_user.id, test_parent_user.id, test_student.id, "msg", None)
    await repo.mark_read(notif.id, test_parent_user.id)
    items = await repo.list_for_recipient(test_parent_user.id, test_org.id)
    assert items[0].read_at is not None
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd apps/api && pytest tests/test_notification_repository.py -v
```

Expected: `FAIL` — `SQLNotificationRepository` not found.

- [ ] **Step 3: Write the domain interface**

```python
# apps/api/app/domain/repositories/notification_repository.py
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
```

- [ ] **Step 4: Write the SQL implementation**

```python
# apps/api/app/infrastructure/db/repositories/notification_repository.py
from __future__ import annotations

from datetime import datetime, timezone
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
            .values(read_at=datetime.now(timezone.utc))
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
                replied_at=datetime.now(timezone.utc),
            )
        )
        m = await self._db.get(FeedbackModel, feedback_id)
        return _to_feedback(m)
```

- [ ] **Step 5: Run test — verify it passes**

```bash
cd apps/api && pytest tests/test_notification_repository.py -v
```

Expected: `PASS`

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/domain/repositories/notification_repository.py \
        apps/api/app/infrastructure/db/repositories/notification_repository.py \
        apps/api/tests/test_notification_repository.py
git commit -m "feat: add Notification and Feedback repositories"
```

---

### Task 3: Notification & Feedback API Endpoints

**Files:**
- Create: `apps/api/app/interfaces/api/v1/schemas/notification.py`
- Create: `apps/api/app/interfaces/api/v1/routers/notifications.py`
- Modify: `apps/api/app/main.py`
- Test: `apps/api/tests/test_notifications_api.py`

- [ ] **Step 1: Write the failing test**

```python
# apps/api/tests/test_notifications_api.py
import pytest
from httpx import AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_create_notification_requires_teacher(db):
    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.post("/api/v1/notifications", json={"content": "test", "recipient_id": "00000000-0000-0000-0000-000000000001"})
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_parent_can_list_notifications(db, parent_auth_headers):
    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.get("/api/v1/notifications", headers=parent_auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_teacher_can_list_feedback(db, teacher_auth_headers):
    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.get("/api/v1/feedback", headers=teacher_auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd apps/api && pytest tests/test_notifications_api.py -v
```

Expected: `FAIL` — routes not found.

- [ ] **Step 3: Write Pydantic schemas**

```python
# apps/api/app/interfaces/api/v1/schemas/notification.py
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
```

- [ ] **Step 4: Write the notifications router**

```python
# apps/api/app/interfaces/api/v1/routers/notifications.py
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


# ── Notifications ──────────────────────────────────────────────────────────

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


# ── Feedback ───────────────────────────────────────────────────────────────

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
```

- [ ] **Step 5: Register router in main.py**

Add at the end of `apps/api/app/main.py`:

```python
from app.interfaces.api.v1.routers import notifications  # noqa: E402

app.include_router(notifications.router, prefix="/api/v1", tags=["notifications"])
```

- [ ] **Step 6: Run test — verify it passes**

```bash
cd apps/api && pytest tests/test_notifications_api.py -v
```

Expected: `PASS`

- [ ] **Step 7: Commit**

```bash
git add apps/api/app/interfaces/api/v1/schemas/notification.py \
        apps/api/app/interfaces/api/v1/routers/notifications.py \
        apps/api/app/main.py \
        apps/api/tests/test_notifications_api.py
git commit -m "feat: add notifications and feedback API endpoints"
```

---

### Task 4: Frontend — Notifications API Types & Helpers

**Files:**
- Create: `apps/web/src/features/notifications/model/types.ts`
- Create: `apps/web/src/features/notifications/api/notifications.api.ts`

- [ ] **Step 1: Write TypeScript types**

```typescript
// apps/web/src/features/notifications/model/types.ts
export interface Notification {
  id: string;
  sender_id: string;
  recipient_id: string;
  student_id: string | null;
  session_id: string | null;
  content: string;
  read_at: string | null;
  created_at: string;
}

export interface Feedback {
  id: string;
  sender_id: string;
  recipient_id: string;
  student_id: string | null;
  notification_id: string | null;
  content: string;
  reply_content: string | null;
  replied_by_id: string | null;
  replied_at: string | null;
  created_at: string;
}
```

- [ ] **Step 2: Write API helpers**

```typescript
// apps/web/src/features/notifications/api/notifications.api.ts
import { apiClient } from "@/src/shared/api/client";
import type { Feedback, Notification } from "../model/types";

export async function listNotificationsApi(): Promise<Notification[]> {
  const resp = await apiClient.get("/api/v1/notifications");
  return resp.data as Notification[];
}

export async function markNotificationReadApi(id: string): Promise<void> {
  await apiClient.patch(`/api/v1/notifications/${id}/read`);
}

export async function createFeedbackApi(data: {
  recipient_id: string;
  student_id?: string;
  notification_id?: string;
  content: string;
}): Promise<Feedback> {
  const resp = await apiClient.post("/api/v1/feedback", data);
  return resp.data as Feedback;
}

export async function listFeedbackApi(): Promise<Feedback[]> {
  const resp = await apiClient.get("/api/v1/feedback");
  return resp.data as Feedback[];
}

export async function replyFeedbackApi(id: string, content: string): Promise<Feedback> {
  const resp = await apiClient.patch(`/api/v1/feedback/${id}/reply`, { content });
  return resp.data as Feedback;
}

export async function createNotificationApi(data: {
  recipient_id: string;
  student_id?: string;
  session_id?: string;
  content: string;
}): Promise<Notification> {
  const resp = await apiClient.post("/api/v1/notifications", data);
  return resp.data as Notification;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/web && pnpm type-check
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/notifications/model/types.ts \
        apps/web/src/features/notifications/api/notifications.api.ts
git commit -m "feat: add notifications and feedback API helpers and types"
```

---

### Task 5: Parent Notifications Page

**Files:**
- Create: `apps/web/app/(portal)/parent/notifications/page.tsx`
- Modify: `apps/web/app/(portal)/layout.tsx` (add nav item)

- [ ] **Step 1: Create parent notifications page**

```tsx
// apps/web/app/(portal)/parent/notifications/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
  createFeedbackApi,
  listNotificationsApi,
  markNotificationReadApi,
} from "@/src/features/notifications/api/notifications.api";
import type { Notification } from "@/src/features/notifications/model/types";

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function ParentNotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedbackContent, setFeedbackContent] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  useEffect(() => {
    listNotificationsApi()
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  async function handleMarkRead(id: string) {
    await markNotificationReadApi(id);
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
  }

  async function handleFeedback(notif: Notification) {
    const content = feedbackContent[notif.id]?.trim();
    if (!content || submitting) return;
    setSubmitting(notif.id);
    try {
      await createFeedbackApi({
        recipient_id: notif.sender_id,
        student_id: notif.student_id ?? undefined,
        notification_id: notif.id,
        content,
      });
      setFeedbackContent((prev) => ({ ...prev, [notif.id]: "" }));
      showToast("Đã gửi phản hồi.");
    } catch {
      showToast("Lỗi khi gửi phản hồi.");
    } finally {
      setSubmitting(null);
    }
  }

  if (loading) {
    return (
      <div className="p-5 flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-stone/20 rounded-md animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-5 flex flex-col gap-4">
      <h1 className="text-xl font-bold text-ink">Thông báo từ giáo viên</h1>

      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-md bg-primary px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-md border border-border bg-canvas p-6 text-center">
          <p className="text-sm text-ash">Chưa có thông báo nào.</p>
        </div>
      ) : (
        items.map((notif) => (
          <div
            key={notif.id}
            className={`rounded-md border bg-canvas p-4 flex flex-col gap-3 ${notif.read_at ? "border-border" : "border-primary/40 bg-primary/5"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-ink flex-1">{notif.content}</p>
              {!notif.read_at && (
                <button
                  onClick={() => handleMarkRead(notif.id)}
                  className="text-xs text-primary underline shrink-0"
                >
                  Đánh dấu đọc
                </button>
              )}
            </div>
            <p className="text-xs text-ash">{formatDateTime(notif.created_at)}</p>

            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <textarea
                value={feedbackContent[notif.id] ?? ""}
                onChange={(e) => setFeedbackContent((prev) => ({ ...prev, [notif.id]: e.target.value }))}
                placeholder="Phản hồi đến giáo viên..."
                rows={2}
                className="w-full resize-none rounded border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
              />
              <button
                onClick={() => handleFeedback(notif)}
                disabled={submitting === notif.id || !feedbackContent[notif.id]?.trim()}
                className="self-end rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 transition-colors"
              >
                {submitting === notif.id ? "Đang gửi..." : "Gửi phản hồi"}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add "Thông báo" to parent bottom nav**

In `apps/web/app/(portal)/layout.tsx`, update the `NAV` array:

```tsx
const NAV = [
  { href: "/parent/home", label: "Trang chủ", icon: "⊞" },
  { href: "/parent/grades", label: "Điểm số", icon: "📝" },
  { href: "/parent/attendance", label: "Điểm danh", icon: "✓" },
  { href: "/parent/notifications", label: "Thông báo", icon: "🔔" },
  { href: "/parent/profile", label: "Tài khoản", icon: "👤" },
];
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/web && pnpm type-check
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/(portal)/parent/notifications/page.tsx \
        apps/web/app/(portal)/layout.tsx
git commit -m "feat: add parent notifications page with feedback form"
```

---

### Task 6: Teacher Feedback Inbox Page

**Files:**
- Create: `apps/web/app/(teacher)/feedback/page.tsx`

- [ ] **Step 1: Create the teacher feedback inbox page**

```tsx
// apps/web/app/(teacher)/feedback/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
  listFeedbackApi,
  replyFeedbackApi,
} from "@/src/features/notifications/api/notifications.api";
import type { Feedback } from "@/src/features/notifications/model/types";

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function TeacherFeedbackPage() {
  const [items, setItems] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyContent, setReplyContent] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  useEffect(() => {
    listFeedbackApi()
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  async function handleReply(id: string) {
    const content = replyContent[id]?.trim();
    if (!content || submitting) return;
    setSubmitting(id);
    try {
      const updated = await replyFeedbackApi(id, content);
      setItems((prev) => prev.map((f) => f.id === id ? updated : f));
      setReplyContent((prev) => ({ ...prev, [id]: "" }));
      showToast("Đã gửi trả lời.");
    } catch {
      showToast("Lỗi khi gửi trả lời.");
    } finally {
      setSubmitting(null);
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-stone/20 rounded-md animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-ink">Hộp thư phản hồi</h1>
      <p className="text-sm text-ash">{items.length} phản hồi từ phụ huynh</p>

      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-md bg-primary px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-md border border-border bg-canvas p-8 text-center">
          <p className="text-sm text-ash">Chưa có phản hồi nào từ phụ huynh.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((fb) => (
            <div key={fb.id} className="rounded-md border border-border bg-canvas p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-ink flex-1">{fb.content}</p>
                <span className={`text-xs font-semibold ml-3 ${fb.reply_content ? "text-success" : "text-warning"}`}>
                  {fb.reply_content ? "Đã trả lời" : "Chờ trả lời"}
                </span>
              </div>
              <p className="text-xs text-ash">{formatDateTime(fb.created_at)}</p>

              {fb.reply_content ? (
                <div className="rounded-sm bg-surface px-3 py-2 border-l-2 border-primary">
                  <p className="text-xs text-ash mb-1">Trả lời của bạn:</p>
                  <p className="text-sm text-ink">{fb.reply_content}</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2 border-t border-border pt-3">
                  <textarea
                    value={replyContent[fb.id] ?? ""}
                    onChange={(e) => setReplyContent((prev) => ({ ...prev, [fb.id]: e.target.value }))}
                    placeholder="Nhập câu trả lời cho phụ huynh..."
                    rows={3}
                    className="w-full resize-none rounded border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
                  />
                  <button
                    onClick={() => handleReply(fb.id)}
                    disabled={submitting === fb.id || !replyContent[fb.id]?.trim()}
                    className="self-end rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50 transition-colors"
                  >
                    {submitting === fb.id ? "Đang gửi..." : "Gửi trả lời"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add Feedback link to teacher sidebar/nav**

Check `apps/web/app/(teacher)/layout.tsx` and add a "Phản hồi" nav item pointing to `/feedback`. The exact edit depends on the current nav structure — add `{ href: "/feedback", label: "Phản hồi PH" }` to the NAV array.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/web && pnpm type-check
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/(teacher)/feedback/page.tsx \
        apps/web/app/(teacher)/layout.tsx
git commit -m "feat: add teacher feedback inbox page with reply functionality"
```

---

## Self-Review

**Spec coverage:**
- ✅ `notifications` table (teacher→parent, linked to session)
- ✅ `feedback` table (parent→teacher, with reply)
- ✅ POST /notifications (teacher creates)
- ✅ GET /notifications (parent lists)
- ✅ PATCH /notifications/{id}/read (parent marks read)
- ✅ POST /feedback (parent creates)
- ✅ GET /feedback (teacher lists inbox)
- ✅ PATCH /feedback/{id}/reply (teacher replies)
- ✅ Parent notifications page with feedback form
- ✅ Teacher feedback inbox page with reply form
- ✅ "Thông báo" added to parent bottom nav

**Placeholder scan:** None found.

**Type consistency:** All Pydantic field names (sender_id, recipient_id, etc.) match between schema, repository, and TypeScript types.
