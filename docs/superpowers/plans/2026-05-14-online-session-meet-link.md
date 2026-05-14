# Online Session + Google Meet Link — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add online/offline mode to class sessions with automatic Google Meet link generation and a stub "send to class channel" button.

**Architecture:** Extend the existing `ClassSession` entity with `mode`, `start_time`, and `meet_link` fields. The backend generates the Meet link (random, no Google API) inside `CreateSessionUseCase` when mode is online. The frontend adds a mode toggle to session creation and displays the link + notify button in the session detail page. The notify-meet endpoint is a stub (Feature 2 fills it in).

**Tech Stack:** FastAPI, SQLAlchemy (async), Alembic, Pydantic v2, Next.js 14 App Router, TypeScript, Tailwind CSS.

---

## File Map

| File | Change |
|---|---|
| `apps/api/app/infrastructure/utils/__init__.py` | CREATE (empty) |
| `apps/api/app/infrastructure/utils/meet.py` | CREATE — `generate_meet_link()` |
| `apps/api/tests/test_online_session.py` | CREATE — all backend tests |
| `apps/api/alembic/versions/a1b2c3d4e5f6_add_online_session_fields.py` | CREATE — migration |
| `apps/api/app/domain/entities/attendance.py` | MODIFY — 3 new fields on `ClassSession` |
| `apps/api/app/infrastructure/db/models/attendance.py` | MODIFY — 3 new columns on `ClassSessionModel` |
| `apps/api/app/domain/repositories/attendance_repository.py` | MODIFY — rename `update_session_notes` → `update_session` |
| `apps/api/app/infrastructure/db/repositories/attendance_repository.py` | MODIFY — `_session_to_domain`, `create_session`, `update_session` |
| `apps/api/app/interfaces/api/v1/schemas/attendance.py` | MODIFY — 3 schemas updated, 1 new |
| `apps/api/app/application/use_cases/attendance/create_session.py` | MODIFY — accept mode/start_time, generate link |
| `apps/api/app/application/use_cases/attendance/update_session.py` | MODIFY — accept mode/start_time, generate link if needed |
| `apps/api/app/interfaces/api/v1/routers/attendance.py` | MODIFY — pass new fields, add notify-meet endpoint |
| `apps/web/src/features/attendance/model/types.ts` | MODIFY — 3 new fields on `ClassSession` |
| `apps/web/src/features/attendance/api/attendance.api.ts` | MODIFY — update `createSessionApi`, rename `patchSessionNotesApi` → `updateSessionApi`, add `notifyMeetApi` |
| `apps/web/src/features/attendance/ui/SessionSection.tsx` | MODIFY — mode toggle + start_time picker |
| `apps/web/app/(teacher)/classes/[id]/sessions/[sessionId]/page.tsx` | MODIFY — badge, meet link card, notify button |

---

### Task 1: Meet link generator utility

**Files:**
- Create: `apps/api/app/infrastructure/utils/__init__.py`
- Create: `apps/api/app/infrastructure/utils/meet.py`
- Create: `apps/api/tests/test_online_session.py`

- [ ] **Step 1: Write the failing tests**

```python
# apps/api/tests/test_online_session.py
import re
from app.infrastructure.utils.meet import generate_meet_link


def test_generate_meet_link_format():
    link = generate_meet_link()
    assert re.fullmatch(r"meet\.google\.com/[a-z]{3}-[a-z]{4}-[a-z]{3}", link)


def test_generate_meet_link_is_random():
    links = {generate_meet_link() for _ in range(20)}
    assert len(links) > 1
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api
.venv/bin/python -m pytest tests/test_online_session.py -v
```

Expected: `ModuleNotFoundError: No module named 'app.infrastructure.utils'`

- [ ] **Step 3: Create the utility files**

```python
# apps/api/app/infrastructure/utils/__init__.py
# (empty file)
```

```python
# apps/api/app/infrastructure/utils/meet.py
from __future__ import annotations

import random
import string


def generate_meet_link() -> str:
    def seg(n: int) -> str:
        return "".join(random.choices(string.ascii_lowercase, k=n))

    return f"meet.google.com/{seg(3)}-{seg(4)}-{seg(3)}"
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
.venv/bin/python -m pytest tests/test_online_session.py -v
```

Expected: `2 passed`

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/infrastructure/utils/ apps/api/tests/test_online_session.py
git commit -m "feat: add Google Meet link generator utility"
```

---

### Task 2: DB migration + entity + ORM model

**Files:**
- Create: `apps/api/alembic/versions/a1b2c3d4e5f6_add_online_session_fields.py`
- Modify: `apps/api/app/domain/entities/attendance.py`
- Modify: `apps/api/app/infrastructure/db/models/attendance.py`

- [ ] **Step 1: Create the Alembic migration**

```python
# apps/api/alembic/versions/a1b2c3d4e5f6_add_online_session_fields.py
"""add online session fields

Revision ID: a1b2c3d4e5f6
Revises: f1a2b3c4d5e6
Create Date: 2026-05-14 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS mode VARCHAR(10) NOT NULL DEFAULT 'offline'"
    )
    op.execute("ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS start_time TIME")
    op.execute("ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS meet_link VARCHAR(100)")


def downgrade() -> None:
    op.drop_column("class_sessions", "meet_link")
    op.drop_column("class_sessions", "start_time")
    op.drop_column("class_sessions", "mode")
```

- [ ] **Step 2: Run the migration**

```bash
cd apps/api
.venv/bin/alembic upgrade head
```

Expected: `Running upgrade f1a2b3c4d5e6 -> a1b2c3d4e5f6, add online session fields`

- [ ] **Step 3: Update the domain entity**

Replace the full content of `apps/api/app/domain/entities/attendance.py`:

```python
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, time
from uuid import UUID


@dataclass
class ClassSession:
    id: UUID
    class_id: UUID
    date: date
    notes: str | None
    created_at: datetime
    mode: str = field(default="offline")
    start_time: time | None = field(default=None)
    meet_link: str | None = field(default=None)


@dataclass
class AttendanceRecord:
    id: UUID
    session_id: UUID
    student_id: UUID
    status: str   # "present" | "absent" | "late"
    note: str | None
    marked_at: datetime
```

- [ ] **Step 4: Update the ORM model**

Replace the full content of `apps/api/app/infrastructure/db/models/attendance.py`:

```python
from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, time

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, String, Text, Time, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.db.session import Base


def _now() -> datetime:
    return datetime.now(UTC)


class ClassSessionModel(Base):
    __tablename__ = "class_sessions"
    __table_args__ = (
        UniqueConstraint("class_id", "date", name="uq_session_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    class_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("classes.id"), nullable=False, index=True
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    mode: Mapped[str] = mapped_column(String(10), nullable=False, default="offline")
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    meet_link: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class AttendanceRecordModel(Base):
    __tablename__ = "attendance_records"
    __table_args__ = (
        UniqueConstraint("session_id", "student_id", name="uq_attendance_record"),
        CheckConstraint("status IN ('present', 'absent', 'late')", name="ck_attendance_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("class_sessions.id"), nullable=False, index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("students.id"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(10), nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    marked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
```

- [ ] **Step 5: Verify imports are clean**

```bash
.venv/bin/python -m ruff check app/domain/entities/attendance.py app/infrastructure/db/models/attendance.py
```

Expected: `All checks passed!`

- [ ] **Step 6: Commit**

```bash
git add alembic/versions/a1b2c3d4e5f6_add_online_session_fields.py \
        app/domain/entities/attendance.py \
        app/infrastructure/db/models/attendance.py
git commit -m "feat: add mode/start_time/meet_link columns to class_sessions"
```

---

### Task 3: Repository — interface + implementation

**Files:**
- Modify: `apps/api/app/domain/repositories/attendance_repository.py`
- Modify: `apps/api/app/infrastructure/db/repositories/attendance_repository.py`

- [ ] **Step 1: Update the repository interface**

In `apps/api/app/domain/repositories/attendance_repository.py`, replace `update_session_notes` with `update_session`:

```python
from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import date, time
from uuid import UUID

from app.domain.entities.attendance import AttendanceRecord, ClassSession


class IAttendanceRepository(ABC):
    @abstractmethod
    async def create_session(self, session: ClassSession) -> ClassSession: ...

    @abstractmethod
    async def get_session(self, session_id: UUID, class_id: UUID) -> ClassSession | None: ...

    @abstractmethod
    async def list_sessions(self, class_id: UUID) -> list[ClassSession]: ...

    @abstractmethod
    async def session_exists_for_date(self, class_id: UUID, date_: date) -> bool: ...

    @abstractmethod
    async def upsert_attendance(self, record: AttendanceRecord) -> AttendanceRecord: ...

    @abstractmethod
    async def bulk_upsert_attendance(self, records: list[AttendanceRecord]) -> list[AttendanceRecord]: ...

    @abstractmethod
    async def list_attendance(self, session_id: UUID) -> list[AttendanceRecord]: ...

    @abstractmethod
    async def update_session(
        self,
        session_id: UUID,
        class_id: UUID,
        notes: str | None,
        mode: str,
        start_time: time | None,
        meet_link: str | None,
    ) -> ClassSession | None: ...

    @abstractmethod
    async def list_sessions_in_month(self, class_ids: list[UUID], start: date, end: date) -> list[ClassSession]: ...

    @abstractmethod
    async def session_ids_with_attendance(self, session_ids: list[UUID]) -> set[UUID]: ...
```

- [ ] **Step 2: Update `_session_to_domain` in the SQL repository**

In `apps/api/app/infrastructure/db/repositories/attendance_repository.py`, update `_session_to_domain` (lines ~14-22):

```python
def _session_to_domain(row: ClassSessionModel) -> ClassSession:
    return ClassSession(
        id=row.id,
        class_id=row.class_id,
        date=row.date,
        notes=row.notes,
        created_at=row.created_at,
        mode=row.mode,
        start_time=row.start_time,
        meet_link=row.meet_link,
    )
```

- [ ] **Step 3: Update `create_session` in the SQL repository**

Replace the existing `create_session` method body:

```python
async def create_session(self, session: ClassSession) -> ClassSession:
    row = ClassSessionModel(
        id=session.id,
        class_id=session.class_id,
        date=session.date,
        notes=session.notes,
        mode=session.mode,
        start_time=session.start_time,
        meet_link=session.meet_link,
    )
    self._session.add(row)
    await self._session.flush()
    await self._session.refresh(row)
    return _session_to_domain(row)
```

- [ ] **Step 4: Replace `update_session_notes` with `update_session`**

In `SQLAttendanceRepository`, replace the `update_session_notes` method with:

```python
async def update_session(
    self,
    session_id: UUID,
    class_id: UUID,
    notes: str | None,
    mode: str,
    start_time: time | None,
    meet_link: str | None,
) -> ClassSession | None:
    result = await self._session.execute(
        select(ClassSessionModel).where(
            ClassSessionModel.id == session_id,
            ClassSessionModel.class_id == class_id,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        return None
    row.notes = notes
    row.mode = mode
    row.start_time = start_time
    row.meet_link = meet_link
    await self._session.flush()
    await self._session.refresh(row)
    return _session_to_domain(row)
```

Also add `time` to the imports at the top of the file:

```python
from datetime import date, time
```

- [ ] **Step 5: Verify with ruff**

```bash
.venv/bin/python -m ruff check app/domain/repositories/attendance_repository.py \
    app/infrastructure/db/repositories/attendance_repository.py
```

Expected: `All checks passed!`

- [ ] **Step 6: Commit**

```bash
git add app/domain/repositories/attendance_repository.py \
        app/infrastructure/db/repositories/attendance_repository.py
git commit -m "feat: update attendance repository for online session fields"
```

---

### Task 4: Backend API — schemas, use cases, router, tests

**Files:**
- Modify: `apps/api/app/interfaces/api/v1/schemas/attendance.py`
- Modify: `apps/api/app/application/use_cases/attendance/create_session.py`
- Modify: `apps/api/app/application/use_cases/attendance/update_session.py`
- Modify: `apps/api/app/interfaces/api/v1/routers/attendance.py`
- Modify: `apps/api/tests/test_online_session.py`

- [ ] **Step 1: Write the failing use case tests**

Append to `apps/api/tests/test_online_session.py`:

```python
import uuid
from datetime import date, time
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.application.use_cases.attendance.create_session import CreateSessionUseCase
from app.application.use_cases.attendance.update_session import UpdateSessionUseCase
from app.domain.entities.attendance import ClassSession
from app.domain.exceptions import ConflictError, ValidationError


CLASS_ID = uuid.uuid4()
ORG_ID = uuid.uuid4()
SESSION_ID = uuid.uuid4()
TODAY = date.today()


def _make_class_repo(found: bool = True) -> AsyncMock:
    repo = AsyncMock()
    repo.get_by_id = AsyncMock(return_value=MagicMock() if found else None)
    return repo


def _make_att_repo(session_exists: bool = False) -> AsyncMock:
    repo = AsyncMock()
    repo.session_exists_for_date = AsyncMock(return_value=session_exists)
    repo.create_session = AsyncMock(side_effect=lambda s: s)
    repo.get_session = AsyncMock(return_value=ClassSession(
        id=SESSION_ID, class_id=CLASS_ID, date=TODAY, notes=None,
        created_at=MagicMock(), mode="offline", start_time=None, meet_link=None,
    ))
    repo.update_session = AsyncMock(side_effect=lambda sid, cid, notes, mode, st, ml: ClassSession(
        id=SESSION_ID, class_id=CLASS_ID, date=TODAY, notes=notes,
        created_at=MagicMock(), mode=mode, start_time=st, meet_link=ml,
    ))
    return repo


@pytest.mark.asyncio
async def test_create_offline_session_no_link():
    uc = CreateSessionUseCase(_make_class_repo(), _make_att_repo())
    session = await uc.execute(CLASS_ID, ORG_ID, TODAY, None, mode="offline", start_time=None)
    assert session.mode == "offline"
    assert session.meet_link is None
    assert session.start_time is None


@pytest.mark.asyncio
async def test_create_online_session_generates_link():
    uc = CreateSessionUseCase(_make_class_repo(), _make_att_repo())
    t = time(14, 0)
    session = await uc.execute(CLASS_ID, ORG_ID, TODAY, None, mode="online", start_time=t)
    assert session.mode == "online"
    assert session.meet_link is not None
    assert session.meet_link.startswith("meet.google.com/")
    assert session.start_time == t


@pytest.mark.asyncio
async def test_update_offline_to_online_generates_link():
    att_repo = _make_att_repo()
    uc = UpdateSessionUseCase(_make_class_repo(), att_repo)
    session = await uc.execute(CLASS_ID, SESSION_ID, ORG_ID, None, mode="online", start_time=time(9, 0))
    assert session.mode == "online"
    assert session.meet_link is not None


@pytest.mark.asyncio
async def test_update_online_to_online_keeps_existing_link():
    att_repo = _make_att_repo()
    existing_link = "meet.google.com/abc-defg-hij"
    att_repo.get_session = AsyncMock(return_value=ClassSession(
        id=SESSION_ID, class_id=CLASS_ID, date=TODAY, notes=None,
        created_at=MagicMock(), mode="online", start_time=time(14, 0), meet_link=existing_link,
    ))
    uc = UpdateSessionUseCase(_make_class_repo(), att_repo)
    session = await uc.execute(CLASS_ID, SESSION_ID, ORG_ID, None, mode="online", start_time=time(14, 0))
    assert session.meet_link == existing_link
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api
.venv/bin/python -m pytest tests/test_online_session.py -v
```

Expected: 2 existing pass, 4 new FAIL with `TypeError` (execute() missing arguments).

- [ ] **Step 3: Update the schemas**

Replace the full content of `apps/api/app/interfaces/api/v1/schemas/attendance.py`:

```python
from __future__ import annotations

from datetime import date, datetime, time
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, model_validator


class CreateSessionRequest(BaseModel):
    date: date
    notes: str | None = None
    mode: Literal["online", "offline"] = "offline"
    start_time: time | None = None

    @model_validator(mode="after")
    def start_time_required_for_online(self) -> "CreateSessionRequest":
        if self.mode == "online" and self.start_time is None:
            raise ValueError("Giờ bắt đầu là bắt buộc khi học online")
        return self


class UpdateSessionRequest(BaseModel):
    notes: str | None = None
    mode: Literal["online", "offline"] | None = None
    start_time: time | None = None


class SessionResponse(BaseModel):
    id: UUID
    class_id: UUID
    date: date
    notes: str | None
    created_at: datetime
    mode: str
    start_time: time | None
    meet_link: str | None

    model_config = {"from_attributes": True}


class NotifyMeetResponse(BaseModel):
    sent: bool
    message: str


class AttendanceRecordIn(BaseModel):
    student_id: UUID
    status: Literal["present", "absent", "late"]
    note: str | None = None


class MarkAttendanceRequest(BaseModel):
    records: list[AttendanceRecordIn]


class AttendanceRecordResponse(BaseModel):
    id: UUID
    session_id: UUID
    student_id: UUID
    status: str
    note: str | None
    marked_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 4: Update `CreateSessionUseCase`**

Replace the full content of `apps/api/app/application/use_cases/attendance/create_session.py`:

```python
from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, time

from app.domain.entities.attendance import ClassSession
from app.domain.exceptions import ConflictError, NotFoundError
from app.domain.repositories.attendance_repository import IAttendanceRepository
from app.domain.repositories.class_repository import IClassRepository
from app.infrastructure.utils.meet import generate_meet_link


class CreateSessionUseCase:
    def __init__(self, class_repo: IClassRepository, att_repo: IAttendanceRepository) -> None:
        self._class_repo = class_repo
        self._att_repo = att_repo

    async def execute(
        self,
        class_id: uuid.UUID,
        org_id: uuid.UUID,
        session_date: date,
        notes: str | None,
        mode: str = "offline",
        start_time: time | None = None,
    ) -> ClassSession:
        class_ = await self._class_repo.get_by_id(class_id, org_id)
        if not class_:
            raise NotFoundError("Class", str(class_id))
        if await self._att_repo.session_exists_for_date(class_id, session_date):
            raise ConflictError(f"Session already exists for date {session_date}")

        meet_link = generate_meet_link() if mode == "online" else None

        session = ClassSession(
            id=uuid.uuid4(),
            class_id=class_id,
            date=session_date,
            notes=notes,
            created_at=datetime.now(UTC),
            mode=mode,
            start_time=start_time,
            meet_link=meet_link,
        )
        return await self._att_repo.create_session(session)
```

- [ ] **Step 5: Update `UpdateSessionUseCase`**

Replace the full content of `apps/api/app/application/use_cases/attendance/update_session.py`:

```python
from __future__ import annotations

from datetime import time
from uuid import UUID

from app.domain.entities.attendance import ClassSession
from app.domain.exceptions import NotFoundError
from app.domain.repositories.attendance_repository import IAttendanceRepository
from app.domain.repositories.class_repository import IClassRepository
from app.infrastructure.utils.meet import generate_meet_link


class UpdateSessionUseCase:
    def __init__(self, class_repo: IClassRepository, att_repo: IAttendanceRepository) -> None:
        self._class_repo = class_repo
        self._att_repo = att_repo

    async def execute(
        self,
        class_id: UUID,
        session_id: UUID,
        org_id: UUID,
        notes: str | None,
        mode: str | None = None,
        start_time: time | None = None,
    ) -> ClassSession:
        class_ = await self._class_repo.get_by_id(class_id, org_id)
        if not class_:
            raise NotFoundError("Class", str(class_id))

        current = await self._att_repo.get_session(session_id, class_id)
        if not current:
            raise NotFoundError("Session", str(session_id))

        new_mode = mode if mode is not None else current.mode
        new_start_time = start_time if mode is not None else current.start_time

        if new_mode == "online" and current.meet_link is None:
            new_meet_link = generate_meet_link()
        else:
            new_meet_link = current.meet_link

        session = await self._att_repo.update_session(
            session_id, class_id, notes, new_mode, new_start_time, new_meet_link
        )
        if not session:
            raise NotFoundError("Session", str(session_id))
        return session
```

- [ ] **Step 6: Update the router**

Replace the full content of `apps/api/app/interfaces/api/v1/routers/attendance.py`:

```python
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.attendance.create_session import CreateSessionUseCase
from app.application.use_cases.attendance.get_session import GetSessionUseCase
from app.application.use_cases.attendance.list_attendance import ListAttendanceUseCase
from app.application.use_cases.attendance.list_sessions import ListSessionsUseCase
from app.application.use_cases.attendance.mark_attendance import MarkAttendanceUseCase
from app.application.use_cases.attendance.send_zalo_notifications import SendZaloNotificationsUseCase
from app.application.use_cases.attendance.update_session import UpdateSessionUseCase
from app.infrastructure.db.repositories.attendance_repository import SQLAttendanceRepository
from app.infrastructure.db.repositories.class_repository import SQLClassRepository
from app.infrastructure.db.session import get_db
from app.interfaces.api.v1.dependencies import require_role
from app.interfaces.api.v1.schemas.attendance import (
    AttendanceRecordResponse,
    CreateSessionRequest,
    MarkAttendanceRequest,
    NotifyMeetResponse,
    SessionResponse,
    UpdateSessionRequest,
)

router = APIRouter()
_teacher = require_role("teacher", "admin")


@router.post("/{class_id}/sessions", response_model=SessionResponse, status_code=201)
async def create_session(
    class_id: UUID,
    body: CreateSessionRequest,
    token=Depends(_teacher),
    db: AsyncSession = Depends(get_db),
):
    uc = CreateSessionUseCase(SQLClassRepository(db), SQLAttendanceRepository(db))
    return await uc.execute(class_id, token.org_id, body.date, body.notes, body.mode, body.start_time)


@router.get("/{class_id}/sessions", response_model=list[SessionResponse])
async def list_sessions(
    class_id: UUID,
    token=Depends(_teacher),
    db: AsyncSession = Depends(get_db),
):
    uc = ListSessionsUseCase(SQLClassRepository(db), SQLAttendanceRepository(db))
    return await uc.execute(class_id, token.org_id)


@router.get("/{class_id}/sessions/{session_id}", response_model=SessionResponse)
async def get_session(
    class_id: UUID,
    session_id: UUID,
    token=Depends(_teacher),
    db: AsyncSession = Depends(get_db),
):
    uc = GetSessionUseCase(SQLClassRepository(db), SQLAttendanceRepository(db))
    return await uc.execute(session_id, class_id, token.org_id)


@router.patch("/{class_id}/sessions/{session_id}", response_model=SessionResponse)
async def update_session(
    class_id: UUID,
    session_id: UUID,
    body: UpdateSessionRequest,
    token=Depends(_teacher),
    db: AsyncSession = Depends(get_db),
):
    uc = UpdateSessionUseCase(SQLClassRepository(db), SQLAttendanceRepository(db))
    return await uc.execute(class_id, session_id, token.org_id, body.notes, body.mode, body.start_time)


@router.post(
    "/{class_id}/sessions/{session_id}/notify-meet",
    response_model=NotifyMeetResponse,
)
async def notify_meet(
    class_id: UUID,
    session_id: UUID,
    token=Depends(_teacher),
    db: AsyncSession = Depends(get_db),
):
    return NotifyMeetResponse(sent=False, message="Class channel chưa được setup")


@router.put(
    "/{class_id}/sessions/{session_id}/attendance",
    response_model=list[AttendanceRecordResponse],
)
async def mark_attendance(
    class_id: UUID,
    session_id: UUID,
    body: MarkAttendanceRequest,
    token=Depends(_teacher),
    db: AsyncSession = Depends(get_db),
):
    uc = MarkAttendanceUseCase(SQLClassRepository(db), SQLAttendanceRepository(db))
    records = [
        {"student_id": r.student_id, "status": r.status, "note": r.note}
        for r in body.records
    ]
    return await uc.execute(class_id, session_id, token.org_id, records)


@router.get(
    "/{class_id}/sessions/{session_id}/attendance",
    response_model=list[AttendanceRecordResponse],
)
async def list_attendance(
    class_id: UUID,
    session_id: UUID,
    token=Depends(_teacher),
    db: AsyncSession = Depends(get_db),
):
    uc = ListAttendanceUseCase(SQLClassRepository(db), SQLAttendanceRepository(db))
    return await uc.execute(session_id, class_id, token.org_id)


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

- [ ] **Step 7: Run all tests**

```bash
.venv/bin/python -m pytest tests/test_online_session.py tests/test_bulk_import_students.py -v
```

Expected: `8 passed` (2 meet link + 4 use case + 2 existing bulk import)

- [ ] **Step 8: Lint check**

```bash
.venv/bin/python -m ruff check app/interfaces/api/v1/schemas/attendance.py \
    app/application/use_cases/attendance/create_session.py \
    app/application/use_cases/attendance/update_session.py \
    app/interfaces/api/v1/routers/attendance.py
```

Expected: `All checks passed!`

- [ ] **Step 9: Commit**

```bash
git add app/interfaces/api/v1/schemas/attendance.py \
        app/application/use_cases/attendance/create_session.py \
        app/application/use_cases/attendance/update_session.py \
        app/interfaces/api/v1/routers/attendance.py \
        tests/test_online_session.py
git commit -m "feat: add online mode + Meet link to session API"
```

---

### Task 5: Frontend types + API

**Files:**
- Modify: `apps/web/src/features/attendance/model/types.ts`
- Modify: `apps/web/src/features/attendance/api/attendance.api.ts`

- [ ] **Step 1: Update `ClassSession` type**

Replace the full content of `apps/web/src/features/attendance/model/types.ts`:

```typescript
export type AttendanceStatus = "present" | "absent" | "late";

export interface ClassSession {
  id: string;
  class_id: string;
  date: string;
  notes: string | null;
  created_at: string;
  mode: "online" | "offline";
  start_time: string | null;
  meet_link: string | null;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
  note: string | null;
  marked_at: string;
}

export interface AttendanceRecordIn {
  student_id: string;
  status: AttendanceStatus;
  note?: string;
}
```

- [ ] **Step 2: Update `attendance.api.ts`**

Replace the full content of `apps/web/src/features/attendance/api/attendance.api.ts`:

```typescript
import { apiClient } from "@/src/shared/api/client";
import type { AttendanceRecord, AttendanceRecordIn, ClassSession } from "../model/types";

export async function createSessionApi(
  classId: string,
  date: string,
  options?: {
    notes?: string | null;
    mode?: "online" | "offline";
    start_time?: string | null;
  },
): Promise<ClassSession> {
  const { data } = await apiClient.post<ClassSession>(`/classes/${classId}/sessions`, {
    date,
    notes: options?.notes ?? null,
    mode: options?.mode ?? "offline",
    start_time: options?.start_time ?? null,
  });
  return data;
}

export async function listSessionsApi(classId: string): Promise<ClassSession[]> {
  const { data } = await apiClient.get<ClassSession[]>(`/classes/${classId}/sessions`);
  return data;
}

export async function getSessionApi(classId: string, sessionId: string): Promise<ClassSession> {
  const { data } = await apiClient.get<ClassSession>(
    `/classes/${classId}/sessions/${sessionId}`,
  );
  return data;
}

export async function updateSessionApi(
  classId: string,
  sessionId: string,
  body: { notes?: string | null; mode?: "online" | "offline" | null; start_time?: string | null },
): Promise<ClassSession> {
  const { data } = await apiClient.patch<ClassSession>(
    `/classes/${classId}/sessions/${sessionId}`,
    body,
  );
  return data;
}

export async function notifyMeetApi(
  classId: string,
  sessionId: string,
): Promise<{ sent: boolean; message: string }> {
  const { data } = await apiClient.post(
    `/classes/${classId}/sessions/${sessionId}/notify-meet`,
  );
  return data;
}

export async function markAttendanceApi(
  classId: string,
  sessionId: string,
  records: AttendanceRecordIn[],
): Promise<AttendanceRecord[]> {
  const { data } = await apiClient.put<AttendanceRecord[]>(
    `/classes/${classId}/sessions/${sessionId}/attendance`,
    { records },
  );
  return data;
}

export async function listAttendanceApi(
  classId: string,
  sessionId: string,
): Promise<AttendanceRecord[]> {
  const { data } = await apiClient.get<AttendanceRecord[]>(
    `/classes/${classId}/sessions/${sessionId}/attendance`,
  );
  return data;
}
```

- [ ] **Step 3: Update the session detail page import**

In `apps/web/app/(teacher)/classes/[id]/sessions/[sessionId]/page.tsx`, replace the import of `patchSessionNotesApi` with `updateSessionApi`:

```typescript
import { getSessionApi, listAttendanceApi, updateSessionApi } from "@/src/features/attendance/api/attendance.api";
```

Then find the `patchSessionNotesApi` call (inside `handleSaveNotes`) and replace it:

```typescript
// old:
await patchSessionNotesApi(classId, sessionId, notes);
// new:
await updateSessionApi(classId, sessionId, { notes });
```

- [ ] **Step 4: Type-check**

```bash
cd apps/web
pnpm type-check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/attendance/model/types.ts \
        src/features/attendance/api/attendance.api.ts \
        "app/(teacher)/classes/[id]/sessions/[sessionId]/page.tsx"
git commit -m "feat: update attendance types and API for online session"
```

---

### Task 6: Frontend UI

**Files:**
- Modify: `apps/web/src/features/attendance/ui/SessionSection.tsx`
- Modify: `apps/web/app/(teacher)/classes/[id]/sessions/[sessionId]/page.tsx`

- [ ] **Step 1: Update `SessionSection.tsx` — add mode state**

Add two new state variables after `const [newDate, setNewDate] = useState("")`:

```typescript
const [newMode, setNewMode] = useState<"online" | "offline">("offline");
const [newStartTime, setNewStartTime] = useState("");
```

- [ ] **Step 2: Update `handleCreateSession` to pass mode**

Replace the existing `handleCreateSession` function:

```typescript
async function handleCreateSession() {
  if (!newDate) return;
  if (newMode === "online" && !newStartTime) {
    setCreateError("Vui lòng nhập giờ bắt đầu cho buổi học online.");
    return;
  }
  setCreating(true);
  setCreateError(null);
  try {
    const session = await createSessionApi(classId, newDate, {
      mode: newMode,
      start_time: newMode === "online" ? newStartTime : null,
    });
    setSessions((prev) => [session, ...prev]);
    setNewDate("");
    setNewMode("offline");
    setNewStartTime("");
    setSelectedSession(session);
    setAttendanceRecords([]);
  } catch (e: unknown) {
    const status = (e as { response?: { status?: number } }).response?.status;
    setCreateError(
      status === 409 ? "Buổi học ngày này đã tồn tại." : "Không thể tạo buổi học."
    );
  } finally {
    setCreating(false);
  }
}
```

- [ ] **Step 3: Add mode toggle + time picker to the create form**

In the JSX, after the date input `<div>` and before the submit button, add:

```tsx
{/* Mode toggle */}
<div className="flex flex-col gap-1">
  <label className="text-xs font-semibold text-ash uppercase tracking-wide">
    Hình thức
  </label>
  <div className="flex gap-1">
    <button
      type="button"
      onClick={() => { setNewMode("offline"); setNewStartTime(""); }}
      className={`px-3 py-2 text-sm font-semibold rounded-sm border transition-colors ${
        newMode === "offline"
          ? "bg-ink text-canvas border-ink"
          : "bg-canvas text-ash border-border hover:border-ink"
      }`}
    >
      Offline
    </button>
    <button
      type="button"
      onClick={() => setNewMode("online")}
      className={`px-3 py-2 text-sm font-semibold rounded-sm border transition-colors ${
        newMode === "online"
          ? "bg-primary text-canvas border-primary"
          : "bg-canvas text-ash border-border hover:border-ink"
      }`}
    >
      Online
    </button>
  </div>
</div>

{/* Start time — only when online */}
{newMode === "online" && (
  <div className="flex flex-col gap-1">
    <label className="text-xs font-semibold text-ash uppercase tracking-wide">
      Giờ bắt đầu *
    </label>
    <input
      type="time"
      value={newStartTime}
      onChange={(e) => setNewStartTime(e.target.value)}
      className="border border-border rounded-sm px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:border-primary"
    />
  </div>
)}
```

The outer flex container for the create form must also allow wrapping — change `className` of the outer `<div className="flex items-end gap-3">` to:

```tsx
<div className="flex flex-wrap items-end gap-3">
```

- [ ] **Step 4: Add mode badge to each session row in the list**

Inside `.map((s) => ...)`, after the session date `<span>`, add a mode badge:

```tsx
<span className="text-sm font-medium text-ink">{formatDate(s.date)}</span>
{s.mode === "online" && (
  <span className="text-xs font-semibold text-primary bg-primary/8 border border-primary/20 rounded-full px-2 py-0.5">
    Online
  </span>
)}
```

- [ ] **Step 5: Update session detail page — add badge + Meet link card + notify button**

In `apps/web/app/(teacher)/classes/[id]/sessions/[sessionId]/page.tsx`, add the `notifyMeetApi` import:

```typescript
import { getSessionApi, listAttendanceApi, updateSessionApi, notifyMeetApi } from "@/src/features/attendance/api/attendance.api";
```

Add state for the notify button (after existing state declarations):

```typescript
const [notifying, setNotifying] = useState(false);
const [notifyResult, setNotifyResult] = useState<string | null>(null);
```

Add handler:

```typescript
async function handleNotifyMeet() {
  if (!session || notifying) return;
  setNotifying(true);
  setNotifyResult(null);
  try {
    const result = await notifyMeetApi(classId, sessionId);
    setNotifyResult(
      result.sent
        ? "Đã gửi vào class channel ✓"
        : "Tính năng đang phát triển — sẽ hoạt động sau khi setup class channel"
    );
  } catch {
    setNotifyResult("Không thể gửi thông báo. Vui lòng thử lại.");
  } finally {
    setNotifying(false);
  }
}
```

In the JSX, find the session header area (the section with the session date/day label) and add mode badge + Meet card after the existing header content:

```tsx
{/* Mode badge */}
<div className="flex items-center gap-2 mt-2">
  {session.mode === "online" ? (
    <span className="text-xs font-semibold text-primary bg-primary/8 border border-primary/20 rounded-full px-2.5 py-0.5">
      Học Online
    </span>
  ) : (
    <span className="text-xs font-semibold text-ash bg-surface border border-border rounded-full px-2.5 py-0.5">
      Offline
    </span>
  )}
  {session.start_time && (
    <span className="text-sm text-ash">
      {session.start_time.slice(0, 5)}
    </span>
  )}
</div>

{/* Meet link card — only when online */}
{session.mode === "online" && session.meet_link && (
  <div className="mt-4 rounded-sm border border-border bg-surface px-4 py-3 flex items-center justify-between gap-4">
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-sm text-ash shrink-0">🔗</span>
      <span className="text-sm font-medium text-ink truncate">{session.meet_link}</span>
    </div>
    <div className="flex items-center gap-2 shrink-0">
      <CopyLinkButton link={`https://${session.meet_link}`} />
      <button
        onClick={handleNotifyMeet}
        disabled={notifying}
        className="rounded-sm border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-50 transition-colors"
      >
        {notifying ? "Đang gửi..." : "Gửi vào class channel"}
      </button>
    </div>
  </div>
)}
{notifyResult && (
  <p className="text-xs text-ash mt-2">{notifyResult}</p>
)}
```

- [ ] **Step 6: Add `CopyLinkButton` component inline in the same file**

Add this small component before the `export default function SessionDetailPage()`:

```tsx
function CopyLinkButton({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={handleCopy}
      className="rounded-sm border border-border bg-canvas px-3 py-1.5 text-xs font-semibold text-ash hover:text-ink hover:border-ink transition-colors"
    >
      {copied ? "Đã copy!" : "Copy"}
    </button>
  );
}
```

- [ ] **Step 7: Type-check**

```bash
cd apps/web
pnpm type-check
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add "src/features/attendance/ui/SessionSection.tsx" \
        "app/(teacher)/classes/[id]/sessions/[sessionId]/page.tsx"
git commit -m "feat: online session UI — mode toggle, Meet link card, notify button"
```

---

## Done

After Task 6, the full feature is shipped:
- Teachers can create online or offline sessions
- Online sessions automatically get a Meet link
- Session detail shows a copy-able Meet link and a "Gửi vào class channel" button (stub, logs "chưa setup" until Feature 2)
- All existing offline sessions are unaffected (default `mode = 'offline'`)
