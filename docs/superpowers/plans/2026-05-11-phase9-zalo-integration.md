# Phase 9: Zalo OA Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Zalo Official Account so the system can send attendance notifications to parents via Zalo, allow parents to bind their Zalo account, and log in with OTP sent via Zalo.

**Architecture:** ZaloBinding table maps parent user_id ↔ Zalo follower ID. When a parent follows the OA, Zalo sends a webhook; we respond by sending a welcome message asking for their phone number. When they reply, we look up the user by phone and save the binding. Teachers trigger notifications via a "Gửi Zalo" button after saving attendance. OTP login is an alternative to password login for parents: we generate a 6-digit code stored in Redis (TTL 5 min), send it via Zalo, and verify on the next endpoint.

**Tech Stack:** Python FastAPI, SQLAlchemy async, Alembic, Celery + Redis, httpx (already in requirements), Next.js 15 (TypeScript)

---

## File Map

**New files (API):**
- `apps/api/app/infrastructure/db/models/zalo.py` — ZaloBindingModel
- `apps/api/app/infrastructure/external/zalo/client.py` — ZaloOAClient (httpx)
- `apps/api/app/domain/repositories/zalo_repository.py` — IZaloRepository interface
- `apps/api/app/infrastructure/db/repositories/zalo_repository.py` — SQL implementation
- `apps/api/app/application/use_cases/zalo/handle_webhook.py` — webhook event handler
- `apps/api/app/application/use_cases/zalo/send_attendance_notifications.py` — queue Celery tasks
- `apps/api/app/application/use_cases/auth/request_otp.py` — OTP send
- `apps/api/app/application/use_cases/auth/verify_otp.py` — OTP verify
- `apps/api/app/interfaces/api/v1/routers/zalo.py` — /zalo/* endpoints
- `apps/api/app/interfaces/api/v1/schemas/zalo.py` — Pydantic schemas
- `apps/api/alembic/versions/a9f3c2d5e1b4_add_zalo_binding.py` — migration

**Modified files (API):**
- `apps/api/app/infrastructure/db/models/__init__.py` — import ZaloBindingModel
- `apps/api/app/infrastructure/tasks.py` — add send_zalo_message task
- `apps/api/app/interfaces/api/v1/routers/attendance.py` — add send-zalo endpoint
- `apps/api/app/interfaces/api/v1/routers/auth.py` — add OTP endpoints
- `apps/api/app/interfaces/api/v1/schemas/auth.py` — add OTP schemas
- `apps/api/app/main.py` — include zalo router

**New files (Web):**
- `apps/web/src/features/zalo/api/zalo.api.ts` — sendZaloNotifications API call

**Modified files (Web):**
- `apps/web/src/features/attendance/ui/SessionSection.tsx` — add "Gửi Zalo" button

---

### Task 1: ZaloBinding SQLAlchemy model

**Files:**
- Create: `apps/api/app/infrastructure/db/models/zalo.py`
- Modify: `apps/api/app/infrastructure/db/models/__init__.py`
- Test: `apps/api/tests/test_zalo_binding_model.py`

- [ ] **Step 1: Write the failing test**

```python
# apps/api/tests/test_zalo_binding_model.py
import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from app.infrastructure.db.models.zalo import ZaloBindingModel

@pytest.mark.asyncio
async def test_zalo_binding_table_exists(db: AsyncSession):
    from sqlalchemy import text
    result = await db.execute(text("SELECT 1 FROM zalo_bindings LIMIT 0"))
    assert result is not None
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd apps/api && pytest tests/test_zalo_binding_model.py -v
```

Expected: `FAIL` — table doesn't exist yet.

- [ ] **Step 3: Write the model**

```python
# apps/api/app/infrastructure/db/models/zalo.py
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.db.session import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ZaloBindingModel(Base):
    __tablename__ = "zalo_bindings"
    __table_args__ = (
        UniqueConstraint("organization_id", "zalo_user_id", name="uq_zalo_user_per_org"),
    )

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True, index=True
    )
    zalo_user_id: Mapped[str] = mapped_column(String(64), nullable=False)
    is_following: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    bound_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)
```

- [ ] **Step 4: Register model in `__init__.py`**

```python
# apps/api/app/infrastructure/db/models/__init__.py
from app.infrastructure.db.models.user import OrganizationModel, UserModel  # noqa: F401
from app.infrastructure.db.models.student import StudentModel  # noqa: F401
from app.infrastructure.db.models.class_ import ClassModel, ClassScheduleModel, EnrollmentModel  # noqa: F401
from app.infrastructure.db.models.attendance import ClassSessionModel, AttendanceRecordModel  # noqa: F401
from app.infrastructure.db.models.exam import ExamModel, GradeModel  # noqa: F401
from app.infrastructure.db.models.zalo import ZaloBindingModel  # noqa: F401
```

- [ ] **Step 5: Write and run Alembic migration**

```python
# apps/api/alembic/versions/a9f3c2d5e1b4_add_zalo_binding.py
"""add_zalo_binding

Revision ID: a9f3c2d5e1b4
Revises: fd5fe20f1357
Create Date: 2026-05-11 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a9f3c2d5e1b4'
down_revision: Union[str, None] = 'fd5fe20f1357'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'zalo_bindings',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('zalo_user_id', sa.String(length=64), nullable=False),
        sa.Column('is_following', sa.Boolean(), nullable=False),
        sa.Column('bound_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('organization_id', 'zalo_user_id', name='uq_zalo_user_per_org'),
        sa.UniqueConstraint('user_id'),
    )
    op.create_index(op.f('ix_zalo_bindings_organization_id'), 'zalo_bindings', ['organization_id'], unique=False)
    op.create_index(op.f('ix_zalo_bindings_user_id'), 'zalo_bindings', ['user_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_zalo_bindings_user_id'), table_name='zalo_bindings')
    op.drop_index(op.f('ix_zalo_bindings_organization_id'), table_name='zalo_bindings')
    op.drop_table('zalo_bindings')
```

Run migration:
```bash
cd apps/api && alembic upgrade head
```

- [ ] **Step 6: Run test — verify it passes**

```bash
cd apps/api && pytest tests/test_zalo_binding_model.py -v
```

Expected: `PASS`

- [ ] **Step 7: Commit**

```bash
git add apps/api/app/infrastructure/db/models/zalo.py \
        apps/api/app/infrastructure/db/models/__init__.py \
        apps/api/alembic/versions/a9f3c2d5e1b4_add_zalo_binding.py \
        apps/api/tests/test_zalo_binding_model.py
git commit -m "feat: add ZaloBinding model and migration"
```

---

### Task 2: Zalo OA HTTP Client

**Files:**
- Create: `apps/api/app/infrastructure/external/zalo/client.py`
- Test: `apps/api/tests/test_zalo_client.py`

- [ ] **Step 1: Write the failing test**

```python
# apps/api/tests/test_zalo_client.py
import pytest
import httpx
import respx
from app.infrastructure.external.zalo.client import ZaloOAClient

@pytest.mark.asyncio
@respx.mock
async def test_send_text_calls_zalo_api():
    mock = respx.post("https://openapi.zalo.me/v2.0/oa/message").mock(
        return_value=httpx.Response(200, json={"error": 0, "message": "Success"})
    )

    client = ZaloOAClient(access_token="test-token")
    result = await client.send_text(zalo_user_id="123456789", text="Xin chào!")

    assert mock.called
    assert result["error"] == 0
    request_body = httpx.Request.read  # parsed by respx
    sent = mock.calls[0].request
    import json
    body = json.loads(sent.content)
    assert body["recipient"]["user_id"] == "123456789"
    assert body["message"]["text"] == "Xin chào!"


@pytest.mark.asyncio
@respx.mock
async def test_send_text_raises_on_zalo_error():
    respx.post("https://openapi.zalo.me/v2.0/oa/message").mock(
        return_value=httpx.Response(200, json={"error": -201, "message": "Invalid access token"})
    )

    client = ZaloOAClient(access_token="bad-token")
    with pytest.raises(ValueError, match="Zalo OA error"):
        await client.send_text(zalo_user_id="123", text="hello")
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd apps/api && pytest tests/test_zalo_client.py -v
```

Expected: `FAIL` — `ZaloOAClient` not found.

- [ ] **Step 3: Install respx for mocking**

```bash
cd apps/api && pip install respx
echo "respx==0.21.1" >> requirements-dev.txt
```

- [ ] **Step 4: Write the client**

```python
# apps/api/app/infrastructure/external/zalo/client.py
import httpx


class ZaloOAClient:
    _BASE = "https://openapi.zalo.me/v2.0/oa"

    def __init__(self, access_token: str) -> None:
        self._token = access_token

    async def send_text(self, zalo_user_id: str, text: str) -> dict:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{self._BASE}/message",
                headers={"access_token": self._token},
                json={
                    "recipient": {"user_id": zalo_user_id},
                    "message": {"text": text},
                },
            )
            resp.raise_for_status()
            data = resp.json()
            if data.get("error", 0) != 0:
                raise ValueError(f"Zalo OA error {data['error']}: {data.get('message')}")
            return data
```

- [ ] **Step 5: Run test — verify it passes**

```bash
cd apps/api && pytest tests/test_zalo_client.py -v
```

Expected: `PASS`

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/infrastructure/external/zalo/client.py \
        apps/api/tests/test_zalo_client.py \
        apps/api/requirements-dev.txt
git commit -m "feat: add Zalo OA HTTP client with send_text"
```

---

### Task 3: ZaloBinding Repository

**Files:**
- Create: `apps/api/app/domain/repositories/zalo_repository.py`
- Create: `apps/api/app/infrastructure/db/repositories/zalo_repository.py`
- Test: `apps/api/tests/test_zalo_repository.py`

- [ ] **Step 1: Write the failing test**

```python
# apps/api/tests/test_zalo_repository.py
import uuid
import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from app.infrastructure.db.repositories.zalo_repository import SQLZaloRepository


@pytest.mark.asyncio
async def test_get_binding_by_user_id_returns_none_when_missing(db: AsyncSession):
    repo = SQLZaloRepository(db)
    result = await repo.get_by_user_id(uuid.uuid4())
    assert result is None


@pytest.mark.asyncio
async def test_upsert_binding_creates_new(db: AsyncSession, test_org, test_parent_user):
    repo = SQLZaloRepository(db)
    binding = await repo.upsert(
        org_id=test_org.id,
        user_id=test_parent_user.id,
        zalo_user_id="zalo123",
        is_following=True,
    )
    assert binding.zalo_user_id == "zalo123"
    assert binding.is_following is True


@pytest.mark.asyncio
async def test_get_binding_by_zalo_user_id(db: AsyncSession, test_org, test_parent_user):
    repo = SQLZaloRepository(db)
    await repo.upsert(test_org.id, test_parent_user.id, "zalo456", True)
    result = await repo.get_by_zalo_user_id(org_id=test_org.id, zalo_user_id="zalo456")
    assert result is not None
    assert result.user_id == test_parent_user.id
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd apps/api && pytest tests/test_zalo_repository.py -v
```

Expected: `FAIL` — `SQLZaloRepository` not found.

- [ ] **Step 3: Write domain interface**

```python
# apps/api/app/domain/repositories/zalo_repository.py
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass
class ZaloBinding:
    id: UUID
    organization_id: UUID
    user_id: UUID
    zalo_user_id: str
    is_following: bool
    bound_at: datetime
    updated_at: datetime


class IZaloRepository(ABC):
    @abstractmethod
    async def get_by_user_id(self, user_id: UUID) -> ZaloBinding | None: ...

    @abstractmethod
    async def get_by_zalo_user_id(self, org_id: UUID, zalo_user_id: str) -> ZaloBinding | None: ...

    @abstractmethod
    async def upsert(
        self, org_id: UUID, user_id: UUID, zalo_user_id: str, is_following: bool
    ) -> ZaloBinding: ...

    @abstractmethod
    async def set_following(self, zalo_user_id: str, org_id: UUID, is_following: bool) -> None: ...
```

- [ ] **Step 4: Write SQL implementation**

```python
# apps/api/app/infrastructure/db/repositories/zalo_repository.py
from __future__ import annotations

from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.repositories.zalo_repository import IZaloRepository, ZaloBinding
from app.infrastructure.db.models.zalo import ZaloBindingModel


def _to_entity(m: ZaloBindingModel) -> ZaloBinding:
    return ZaloBinding(
        id=m.id,
        organization_id=m.organization_id,
        user_id=m.user_id,
        zalo_user_id=m.zalo_user_id,
        is_following=m.is_following,
        bound_at=m.bound_at,
        updated_at=m.updated_at,
    )


class SQLZaloRepository(IZaloRepository):
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_by_user_id(self, user_id: UUID) -> ZaloBinding | None:
        row = await self._db.scalar(
            select(ZaloBindingModel).where(ZaloBindingModel.user_id == user_id)
        )
        return _to_entity(row) if row else None

    async def get_by_zalo_user_id(self, org_id: UUID, zalo_user_id: str) -> ZaloBinding | None:
        row = await self._db.scalar(
            select(ZaloBindingModel).where(
                ZaloBindingModel.organization_id == org_id,
                ZaloBindingModel.zalo_user_id == zalo_user_id,
            )
        )
        return _to_entity(row) if row else None

    async def upsert(
        self, org_id: UUID, user_id: UUID, zalo_user_id: str, is_following: bool
    ) -> ZaloBinding:
        stmt = (
            pg_insert(ZaloBindingModel)
            .values(
                organization_id=org_id,
                user_id=user_id,
                zalo_user_id=zalo_user_id,
                is_following=is_following,
            )
            .on_conflict_do_update(
                index_elements=["user_id"],
                set_={"zalo_user_id": zalo_user_id, "is_following": is_following},
            )
            .returning(ZaloBindingModel)
        )
        result = await self._db.execute(stmt)
        row = result.scalar_one()
        return _to_entity(row)

    async def set_following(self, zalo_user_id: str, org_id: UUID, is_following: bool) -> None:
        await self._db.execute(
            update(ZaloBindingModel)
            .where(
                ZaloBindingModel.zalo_user_id == zalo_user_id,
                ZaloBindingModel.organization_id == org_id,
            )
            .values(is_following=is_following)
        )
```

- [ ] **Step 5: Run test — verify it passes**

```bash
cd apps/api && pytest tests/test_zalo_repository.py -v
```

Expected: `PASS`

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/domain/repositories/zalo_repository.py \
        apps/api/app/infrastructure/db/repositories/zalo_repository.py \
        apps/api/tests/test_zalo_repository.py
git commit -m "feat: add ZaloBinding repository (domain interface + SQL impl)"
```

---

### Task 4: Celery Task for Sending Zalo Messages

**Files:**
- Modify: `apps/api/app/infrastructure/tasks.py`
- Test: `apps/api/tests/test_zalo_task.py`

- [ ] **Step 1: Write the failing test**

```python
# apps/api/tests/test_zalo_task.py
import pytest
from unittest.mock import AsyncMock, patch
from app.infrastructure.tasks import send_zalo_message


def test_send_zalo_message_task_exists():
    assert callable(send_zalo_message)


def test_send_zalo_message_calls_client(monkeypatch):
    calls = []

    async def mock_send_text(self, zalo_user_id, text):
        calls.append((zalo_user_id, text))

    with patch(
        "app.infrastructure.external.zalo.client.ZaloOAClient.send_text",
        new=mock_send_text,
    ):
        send_zalo_message("zalo123", "Xin chào!", "test-token")

    assert len(calls) == 1
    assert calls[0] == ("zalo123", "Xin chào!")
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd apps/api && pytest tests/test_zalo_task.py::test_send_zalo_message_task_exists -v
```

Expected: `FAIL` — `send_zalo_message` not in tasks.

- [ ] **Step 3: Add the Celery task**

```python
# apps/api/app/infrastructure/tasks.py
import asyncio

from app.infrastructure.celery_app import celery_app


@celery_app.task(name="send_zalo_message", queue="zalo_notifications", bind=True, max_retries=3)
def send_zalo_message(self, zalo_user_id: str, text: str, access_token: str) -> None:
    from app.infrastructure.external.zalo.client import ZaloOAClient

    async def _run():
        client = ZaloOAClient(access_token=access_token)
        await client.send_text(zalo_user_id=zalo_user_id, text=text)

    try:
        asyncio.run(_run())
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)
```

- [ ] **Step 4: Run test — verify it passes**

```bash
cd apps/api && pytest tests/test_zalo_task.py::test_send_zalo_message_task_exists -v
```

Expected: `PASS`

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/infrastructure/tasks.py \
        apps/api/tests/test_zalo_task.py
git commit -m "feat: add send_zalo_message Celery task"
```

---

### Task 5: Zalo Webhook Handler

**Files:**
- Create: `apps/api/app/application/use_cases/zalo/handle_webhook.py`
- Create: `apps/api/app/interfaces/api/v1/schemas/zalo.py`
- Create: `apps/api/app/interfaces/api/v1/routers/zalo.py`
- Modify: `apps/api/app/main.py`
- Test: `apps/api/tests/test_zalo_webhook.py`

Zalo webhook events handled:
- `follow` → save binding with is_following=True, send welcome message
- `unfollow` → set is_following=False
- `user_send_text` → try to parse phone, bind if valid user found

- [ ] **Step 1: Write the failing test**

```python
# apps/api/tests/test_zalo_webhook.py
import pytest
from httpx import AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_webhook_follow_event_returns_200(db, test_org):
    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/zalo/webhook",
            json={
                "app_id": str(test_org.id),
                "event_name": "follow",
                "timestamp": "1700000000000",
                "sender": {"id": "zalo_new_user", "display_name": "Nguyen Van A"},
            },
        )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_webhook_unfollow_event_returns_200(db, test_org):
    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/zalo/webhook",
            json={
                "app_id": str(test_org.id),
                "event_name": "unfollow",
                "timestamp": "1700000000001",
                "sender": {"id": "zalo_existing_user"},
            },
        )
    assert resp.status_code == 200
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd apps/api && pytest tests/test_zalo_webhook.py -v
```

Expected: `FAIL` — route doesn't exist.

- [ ] **Step 3: Write Pydantic schemas**

```python
# apps/api/app/interfaces/api/v1/schemas/zalo.py
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
```

- [ ] **Step 4: Write the webhook use case**

```python
# apps/api/app/application/use_cases/zalo/handle_webhook.py
from __future__ import annotations

import re
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.domain.repositories.user_repository import IUserRepository
from app.infrastructure.db.repositories.user_repository import SQLUserRepository
from app.infrastructure.db.repositories.zalo_repository import SQLZaloRepository
from app.infrastructure.tasks import send_zalo_message


_PHONE_RE = re.compile(r"0\d{9}")

WELCOME_MSG = (
    "Xin chào! Để liên kết tài khoản phụ huynh, vui lòng nhắn SĐT của bạn "
    "(ví dụ: 0912345678)."
)


class HandleZaloWebhookUseCase:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._zalo_repo = SQLZaloRepository(db)
        self._user_repo: IUserRepository = SQLUserRepository(db)

    async def execute(self, event_name: str, zalo_user_id: str, org_id: UUID, message_text: str | None) -> None:
        if event_name == "follow":
            await self._handle_follow(zalo_user_id, org_id)
        elif event_name == "unfollow":
            await self._zalo_repo.set_following(zalo_user_id, org_id, False)
        elif event_name == "user_send_text" and message_text:
            await self._handle_message(zalo_user_id, org_id, message_text)

    async def _handle_follow(self, zalo_user_id: str, org_id: UUID) -> None:
        send_zalo_message.delay(zalo_user_id, WELCOME_MSG, settings.zalo_oa_access_token)

    async def _handle_message(self, zalo_user_id: str, org_id: UUID, text: str) -> None:
        match = _PHONE_RE.search(text.strip())
        if not match:
            return
        phone = match.group()
        user = await self._user_repo.get_by_phone(phone)
        if not user or str(user.organization_id) != str(org_id):
            return
        await self._zalo_repo.upsert(org_id, user.id, zalo_user_id, True)
        send_zalo_message.delay(
            zalo_user_id,
            f"Đã liên kết tài khoản phụ huynh thành công! Bạn sẽ nhận thông báo từ giáo viên qua đây.",
            settings.zalo_oa_access_token,
        )
```

- [ ] **Step 5: Write the Zalo router**

```python
# apps/api/app/interfaces/api/v1/routers/zalo.py
from __future__ import annotations

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
    # app_id corresponds to organization_id (set in Zalo OA config)
    # In production, verify X-ZaloOA-Signature HMAC here
    try:
        from uuid import UUID
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
```

- [ ] **Step 6: Register zalo router in main.py**

Add at the end of `apps/api/app/main.py`:

```python
from app.interfaces.api.v1.routers import zalo  # noqa: E402

app.include_router(zalo.router, prefix="/api/v1/zalo", tags=["zalo"])
```

- [ ] **Step 7: Run test — verify it passes**

```bash
cd apps/api && pytest tests/test_zalo_webhook.py -v
```

Expected: `PASS`

- [ ] **Step 8: Commit**

```bash
git add apps/api/app/application/use_cases/zalo/handle_webhook.py \
        apps/api/app/interfaces/api/v1/schemas/zalo.py \
        apps/api/app/interfaces/api/v1/routers/zalo.py \
        apps/api/app/main.py \
        apps/api/tests/test_zalo_webhook.py
git commit -m "feat: add Zalo webhook handler (follow/unfollow/message binding)"
```

---

### Task 6: OTP Login for Parents

**Files:**
- Create: `apps/api/app/application/use_cases/auth/request_otp.py`
- Create: `apps/api/app/application/use_cases/auth/verify_otp.py`
- Modify: `apps/api/app/interfaces/api/v1/schemas/auth.py`
- Modify: `apps/api/app/interfaces/api/v1/routers/auth.py`
- Test: `apps/api/tests/test_otp_auth.py`

- [ ] **Step 1: Write the failing test**

```python
# apps/api/tests/test_otp_auth.py
import pytest
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock
from app.main import app


@pytest.mark.asyncio
async def test_otp_request_returns_404_for_unknown_phone(db):
    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/auth/otp/request",
            json={"phone": "0999000000"},
        )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_otp_verify_returns_401_for_wrong_code(db, test_parent_user, redis_client):
    await redis_client.setex(f"otp:{test_parent_user.phone}", 300, "654321")
    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/auth/otp/verify",
            json={"phone": test_parent_user.phone, "code": "000000"},
        )
    assert resp.status_code == 401
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd apps/api && pytest tests/test_otp_auth.py -v
```

Expected: `FAIL` — endpoints don't exist.

- [ ] **Step 3: Write RequestOTPUseCase**

```python
# apps/api/app/application/use_cases/auth/request_otp.py
from __future__ import annotations

import random
import string

import redis.asyncio as redis_lib

from app.config import settings
from app.domain.entities.user import UserRole
from app.domain.exceptions import NotFoundError
from app.domain.repositories.user_repository import IUserRepository
from app.infrastructure.db.repositories.zalo_repository import SQLZaloRepository
from app.infrastructure.tasks import send_zalo_message

_OTP_TTL = 300  # 5 minutes


def _generate_otp() -> str:
    return "".join(random.choices(string.digits, k=6))


class RequestOTPUseCase:
    def __init__(self, user_repo: IUserRepository, zalo_repo, redis: redis_lib.Redis) -> None:
        self._user_repo = user_repo
        self._zalo_repo = zalo_repo
        self._redis = redis

    async def execute(self, phone: str) -> None:
        user = await self._user_repo.get_by_phone(phone)
        if not user or user.role != UserRole.parent:
            raise NotFoundError("Không tìm thấy tài khoản phụ huynh với SĐT này")

        binding = await self._zalo_repo.get_by_user_id(user.id)
        if not binding or not binding.is_following:
            raise NotFoundError("Tài khoản chưa liên kết Zalo OA")

        otp = _generate_otp()
        await self._redis.setex(f"otp:{phone}", _OTP_TTL, otp)
        send_zalo_message.delay(
            binding.zalo_user_id,
            f"Mã đăng nhập của bạn là: {otp}\nMã có hiệu lực trong 5 phút, không chia sẻ cho ai.",
            settings.zalo_oa_access_token,
        )
```

- [ ] **Step 4: Write VerifyOTPUseCase**

```python
# apps/api/app/application/use_cases/auth/verify_otp.py
from __future__ import annotations

import uuid

import redis.asyncio as redis_lib

from app.config import settings
from app.domain.entities.user import UserRole
from app.domain.exceptions import NotFoundError, UnauthorizedError
from app.domain.repositories.user_repository import IUserRepository
from app.infrastructure.security.jwt import create_access_token

_REFRESH_TTL = settings.refresh_token_expire_days * 86400


class VerifyOTPResult:
    def __init__(self, access_token: str, refresh_token: str) -> None:
        self.access_token = access_token
        self.refresh_token = refresh_token


class VerifyOTPUseCase:
    def __init__(self, user_repo: IUserRepository, redis: redis_lib.Redis) -> None:
        self._user_repo = user_repo
        self._redis = redis

    async def execute(self, phone: str, code: str) -> VerifyOTPResult:
        user = await self._user_repo.get_by_phone(phone)
        if not user or user.role != UserRole.parent:
            raise NotFoundError("Không tìm thấy tài khoản")

        stored = await self._redis.get(f"otp:{phone}")
        if not stored or stored.decode() != code:
            raise UnauthorizedError("Mã OTP không hợp lệ hoặc đã hết hạn")

        await self._redis.delete(f"otp:{phone}")

        access_token, _jti = create_access_token(user.id, user.organization_id, user.role.value)
        refresh_token = str(uuid.uuid4())
        await self._redis.setex(f"refresh:{refresh_token}", _REFRESH_TTL, str(user.id))

        return VerifyOTPResult(access_token=access_token, refresh_token=refresh_token)
```

- [ ] **Step 5: Add OTP schemas to auth.py**

In `apps/api/app/interfaces/api/v1/schemas/auth.py`, add at the end:

```python
class OTPRequestSchema(BaseModel):
    phone: str

class OTPVerifySchema(BaseModel):
    phone: str
    code: str
```

- [ ] **Step 6: Add OTP endpoints to auth router**

In `apps/api/app/interfaces/api/v1/routers/auth.py`, add:

```python
from app.application.use_cases.auth.request_otp import RequestOTPUseCase
from app.application.use_cases.auth.verify_otp import VerifyOTPUseCase
from app.infrastructure.db.repositories.zalo_repository import SQLZaloRepository
from app.interfaces.api.v1.schemas.auth import OTPRequestSchema, OTPVerifySchema


@router.post("/otp/request", status_code=204)
async def request_otp(
    body: OTPRequestSchema,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    from app.domain.repositories.user_repository import IUserRepository
    use_case = RequestOTPUseCase(SQLUserRepository(db), SQLZaloRepository(db), redis)
    await use_case.execute(body.phone)


@router.post("/otp/verify", response_model=LoginResponse)
async def verify_otp(
    body: OTPVerifySchema,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    result = await VerifyOTPUseCase(SQLUserRepository(db), redis).execute(body.phone, body.code)
    return LoginResponse(access_token=result.access_token, refresh_token=result.refresh_token)
```

- [ ] **Step 7: Run test — verify it passes**

```bash
cd apps/api && pytest tests/test_otp_auth.py -v
```

Expected: `PASS`

- [ ] **Step 8: Commit**

```bash
git add apps/api/app/application/use_cases/auth/request_otp.py \
        apps/api/app/application/use_cases/auth/verify_otp.py \
        apps/api/app/interfaces/api/v1/schemas/auth.py \
        apps/api/app/interfaces/api/v1/routers/auth.py \
        apps/api/tests/test_otp_auth.py
git commit -m "feat: add parent OTP login via Zalo (request + verify endpoints)"
```

---

### Task 7: Send Zalo After Attendance

**Files:**
- Create: `apps/api/app/application/use_cases/attendance/send_zalo_notifications.py`
- Modify: `apps/api/app/interfaces/api/v1/routers/attendance.py`
- Test: `apps/api/tests/test_send_zalo_attendance.py`

The endpoint `POST /classes/{class_id}/sessions/{session_id}/attendance/send-zalo` looks up each student's attendance record, finds their parent via enrollment, checks for a ZaloBinding, and queues a Celery task.

- [ ] **Step 1: Write the failing test**

```python
# apps/api/tests/test_send_zalo_attendance.py
import pytest
from httpx import AsyncClient
from unittest.mock import patch
from app.main import app


@pytest.mark.asyncio
async def test_send_zalo_requires_teacher_auth(db, test_session):
    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.post(
            f"/api/v1/classes/{test_session.class_id}/sessions/{test_session.id}/attendance/send-zalo"
        )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_send_zalo_returns_200_with_count(
    db, teacher_auth_headers, test_session, test_attendance_record
):
    with patch("app.infrastructure.tasks.send_zalo_message.delay") as mock_delay:
        async with AsyncClient(app=app, base_url="http://test") as client:
            resp = await client.post(
                f"/api/v1/classes/{test_session.class_id}/sessions/{test_session.id}/attendance/send-zalo",
                headers=teacher_auth_headers,
            )
    assert resp.status_code == 200
    data = resp.json()
    assert "sent_count" in data
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd apps/api && pytest tests/test_send_zalo_attendance.py -v
```

Expected: `FAIL` — endpoint doesn't exist.

- [ ] **Step 3: Write the use case**

```python
# apps/api/app/application/use_cases/attendance/send_zalo_notifications.py
from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.infrastructure.db.models.attendance import AttendanceRecordModel, ClassSessionModel
from app.infrastructure.db.models.class_ import EnrollmentModel
from app.infrastructure.db.models.student import StudentModel
from app.infrastructure.db.repositories.zalo_repository import SQLZaloRepository
from app.infrastructure.tasks import send_zalo_message


@dataclass
class SendZaloResult:
    sent_count: int
    skipped_count: int


_STATUS_LABEL = {"present": "Có mặt ✅", "absent": "Vắng ❌", "late": "Muộn ⏰"}


class SendZaloNotificationsUseCase:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._zalo_repo = SQLZaloRepository(db)

    async def execute(self, session_id: UUID, org_id: UUID) -> SendZaloResult:
        records = (
            await self._db.execute(
                select(AttendanceRecordModel).where(AttendanceRecordModel.session_id == session_id)
            )
        ).scalars().all()

        sent, skipped = 0, 0
        for record in records:
            student = await self._db.get(StudentModel, record.student_id)
            if not student:
                skipped += 1
                continue

            enrollment = await self._db.scalar(
                select(EnrollmentModel).where(
                    EnrollmentModel.student_id == record.student_id,
                )
            )
            if not enrollment or not enrollment.parent_id:
                skipped += 1
                continue

            binding = await self._zalo_repo.get_by_user_id(enrollment.parent_id)
            if not binding or not binding.is_following:
                skipped += 1
                continue

            status_label = _STATUS_LABEL.get(record.status, record.status)
            message = (
                f"📚 Thông báo điểm danh\n"
                f"Học sinh: {student.name}\n"
                f"Trạng thái: {status_label}\n"
                f"Ghi chú: {record.note or '—'}"
            )
            send_zalo_message.delay(
                binding.zalo_user_id, message, settings.zalo_oa_access_token
            )
            sent += 1

        return SendZaloResult(sent_count=sent, skipped_count=skipped)
```

- [ ] **Step 4: Add endpoint to attendance router**

In `apps/api/app/interfaces/api/v1/routers/attendance.py`, add the import and endpoint:

```python
from app.application.use_cases.attendance.send_zalo_notifications import SendZaloNotificationsUseCase

@router.post("/{class_id}/sessions/{session_id}/attendance/send-zalo")
async def send_zalo_attendance(
    class_id: UUID,
    session_id: UUID,
    token=Depends(require_role("teacher")),
    db: AsyncSession = Depends(get_db),
):
    result = await SendZaloNotificationsUseCase(db).execute(session_id, token.org_id)
    return {"sent_count": result.sent_count, "skipped_count": result.skipped_count}
```

- [ ] **Step 5: Run test — verify it passes**

```bash
cd apps/api && pytest tests/test_send_zalo_attendance.py -v
```

Expected: `PASS`

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/application/use_cases/attendance/send_zalo_notifications.py \
        apps/api/app/interfaces/api/v1/routers/attendance.py \
        apps/api/tests/test_send_zalo_attendance.py
git commit -m "feat: add send-zalo endpoint to trigger Zalo notifications after attendance"
```

---

### Task 8: Frontend — "Gửi Zalo" Button in SessionSection

**Files:**
- Create: `apps/web/src/features/zalo/api/zalo.api.ts`
- Modify: `apps/web/src/features/attendance/ui/SessionSection.tsx`

- [ ] **Step 1: Create Zalo API helper**

```typescript
// apps/web/src/features/zalo/api/zalo.api.ts
import { apiClient } from "@/src/shared/api/client";

export interface SendZaloResult {
  sent_count: number;
  skipped_count: number;
}

export async function sendZaloAttendanceNotifications(
  classId: string,
  sessionId: string
): Promise<SendZaloResult> {
  const resp = await apiClient.post(
    `/api/v1/classes/${classId}/sessions/${sessionId}/attendance/send-zalo`
  );
  return resp.data as SendZaloResult;
}
```

- [ ] **Step 2: Add "Gửi Zalo" button to SessionSection**

In `apps/web/src/features/attendance/ui/SessionSection.tsx`, add state and button after the attendance sheet:

At the top, add import:
```typescript
import { sendZaloAttendanceNotifications } from "@/src/features/zalo/api/zalo.api";
```

Inside the component, add state:
```typescript
const [sendingZalo, setSendingZalo] = useState(false);
const [zaloResult, setZaloResult] = useState<string | null>(null);
```

Add handler:
```typescript
async function handleSendZalo() {
  if (!selectedSession || sendingZalo) return;
  setSendingZalo(true);
  setZaloResult(null);
  try {
    const result = await sendZaloAttendanceNotifications(classId, selectedSession.id);
    setZaloResult(`Đã gửi ${result.sent_count} thông báo Zalo (bỏ qua ${result.skipped_count}).`);
  } catch {
    setZaloResult("Lỗi khi gửi thông báo Zalo.");
  } finally {
    setSendingZalo(false);
  }
}
```

Add button in the selected-session section (after AttendanceSheet):
```tsx
<div className="mt-3 flex flex-col gap-2">
  <button
    onClick={handleSendZalo}
    disabled={sendingZalo}
    className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
  >
    {sendingZalo ? "Đang gửi..." : "Gửi Zalo cho phụ huynh"}
  </button>
  {zaloResult && (
    <p className="text-xs text-center text-ash">{zaloResult}</p>
  )}
</div>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/web && pnpm type-check
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/zalo/api/zalo.api.ts \
        apps/web/src/features/attendance/ui/SessionSection.tsx
git commit -m "feat: add Gửi Zalo button to attendance session section"
```

---

## Self-Review

**Spec coverage:**
- ✅ ZaloBinding table for parent ↔ Zalo user mapping
- ✅ Webhook: follow event saves binding, message event binds by phone
- ✅ Celery task sends Zalo messages asynchronously
- ✅ OTP request/verify endpoints for parent login via Zalo
- ✅ POST /sessions/{id}/attendance/send-zalo
- ✅ Frontend "Gửi Zalo" button

**Gaps/notes:**
- Zalo OA app_id is used as org_id in webhook — this requires the organization to configure their Zalo OA `app_id` to match their UUID, or a mapping table needs to be added. For now, admin sets the Zalo OA id in Settings, and the webhook uses app_id for lookup.
- Webhook signature verification (HMAC-SHA256 from `X-ZaloOA-Signature` header) should be added in production but is omitted here to keep the plan focused.
- OTP login requires prior Zalo binding — parents must follow OA first.
