# Phase 4: Attendance Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add attendance tracking — teachers can create class sessions (a specific date occurrence of a class), then mark each enrolled student as present/absent/late.

**Architecture:** Backend follows the existing Clean Architecture pattern (domain entity → repository ABC → SQLAlchemy implementation → use case → FastAPI router). Frontend follows Feature-Sliced Design under `src/features/attendance/`. New router is nested under `/api/v1/classes/{class_id}/sessions`.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 async, PostgreSQL, Alembic, Next.js App Router, TypeScript, Axios, Tailwind CSS (custom tokens: `primary`, `ink`, `ash`, `border`, `surface`, `canvas`, `error`, `success`)

---

## File Map

**Backend (create):**
- `apps/api/app/domain/entities/attendance.py` — `ClassSession`, `AttendanceRecord` dataclasses
- `apps/api/app/domain/repositories/attendance_repository.py` — `IAttendanceRepository` ABC
- `apps/api/app/infrastructure/db/models/attendance.py` — ORM models
- `apps/api/app/infrastructure/db/repositories/attendance_repository.py` — `SQLAttendanceRepository`
- `apps/api/app/application/use_cases/attendance/create_session.py`
- `apps/api/app/application/use_cases/attendance/list_sessions.py`
- `apps/api/app/application/use_cases/attendance/get_session.py`
- `apps/api/app/application/use_cases/attendance/mark_attendance.py`
- `apps/api/app/application/use_cases/attendance/list_attendance.py`
- `apps/api/app/interfaces/api/v1/schemas/attendance.py`
- `apps/api/app/interfaces/api/v1/routers/attendance.py`
- `apps/api/tests/test_attendance.py`

**Backend (modify):**
- `apps/api/app/infrastructure/db/models/__init__.py` — add import for attendance models
- `apps/api/app/main.py` — register attendance router

**Frontend (create):**
- `apps/web/src/features/attendance/model/types.ts`
- `apps/web/src/features/attendance/api/attendance.api.ts`
- `apps/web/src/features/attendance/ui/AttendanceSheet.tsx`
- `apps/web/src/features/attendance/ui/SessionSection.tsx`

**Frontend (modify):**
- `apps/web/app/(teacher)/classes/[id]/page.tsx` — add SessionSection

---

### Task 1: Domain Entities + Repository ABC

**Files:**
- Create: `apps/api/app/domain/entities/attendance.py`
- Create: `apps/api/app/domain/repositories/attendance_repository.py`

- [ ] **Step 1: Write the failing test**

```python
# apps/api/tests/test_attendance_domain.py
from datetime import date, datetime, timezone
from uuid import uuid4
from app.domain.entities.attendance import AttendanceRecord, ClassSession


def test_class_session_fields():
    s = ClassSession(
        id=uuid4(),
        class_id=uuid4(),
        date=date(2026, 5, 1),
        notes="First session",
        created_at=datetime.now(timezone.utc),
    )
    assert s.date == date(2026, 5, 1)
    assert s.notes == "First session"


def test_attendance_record_status():
    r = AttendanceRecord(
        id=uuid4(),
        session_id=uuid4(),
        student_id=uuid4(),
        status="present",
        note=None,
        marked_at=datetime.now(timezone.utc),
    )
    assert r.status == "present"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && python -m pytest tests/test_attendance_domain.py -v
```
Expected: `ImportError` — `attendance` module not found

- [ ] **Step 3: Create domain entities**

```python
# apps/api/app/domain/entities/attendance.py
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from uuid import UUID


@dataclass
class ClassSession:
    id: UUID
    class_id: UUID
    date: date
    notes: str | None
    created_at: datetime


@dataclass
class AttendanceRecord:
    id: UUID
    session_id: UUID
    student_id: UUID
    status: str   # "present" | "absent" | "late"
    note: str | None
    marked_at: datetime
```

- [ ] **Step 4: Create repository ABC**

```python
# apps/api/app/domain/repositories/attendance_repository.py
from __future__ import annotations

from abc import ABC, abstractmethod
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
    async def session_exists_for_date(self, class_id: UUID, date) -> bool: ...

    @abstractmethod
    async def upsert_attendance(self, record: AttendanceRecord) -> AttendanceRecord: ...

    @abstractmethod
    async def list_attendance(self, session_id: UUID) -> list[AttendanceRecord]: ...
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd apps/api && python -m pytest tests/test_attendance_domain.py -v
```
Expected: 2 tests PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/domain/entities/attendance.py \
        apps/api/app/domain/repositories/attendance_repository.py \
        apps/api/tests/test_attendance_domain.py
git commit -m "feat: add ClassSession and AttendanceRecord domain entities"
```

---

### Task 2: ORM Models + Migration

**Files:**
- Create: `apps/api/app/infrastructure/db/models/attendance.py`
- Modify: `apps/api/app/infrastructure/db/models/__init__.py`

- [ ] **Step 1: Write the failing test**

```python
# Add to apps/api/tests/test_attendance_domain.py
from app.infrastructure.db.models.attendance import AttendanceRecordModel, ClassSessionModel


def test_orm_models_importable():
    assert ClassSessionModel.__tablename__ == "class_sessions"
    assert AttendanceRecordModel.__tablename__ == "attendance_records"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && python -m pytest tests/test_attendance_domain.py::test_orm_models_importable -v
```
Expected: `ImportError`

- [ ] **Step 3: Create ORM models**

```python
# apps/api/app/infrastructure/db/models/attendance.py
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.db.session import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


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

- [ ] **Step 4: Register models in `__init__.py`**

The current content is:
```python
from app.infrastructure.db.models.user import OrganizationModel, UserModel  # noqa: F401
from app.infrastructure.db.models.student import StudentModel  # noqa: F401
from app.infrastructure.db.models.class_ import ClassModel, ClassScheduleModel, EnrollmentModel  # noqa: F401
```

Add this line at the end:
```python
from app.infrastructure.db.models.attendance import ClassSessionModel, AttendanceRecordModel  # noqa: F401
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd apps/api && python -m pytest tests/test_attendance_domain.py -v
```
Expected: all tests PASS

- [ ] **Step 6: Generate and apply migration**

```bash
cd apps/api && alembic revision --autogenerate -m "add_attendance_tables"
alembic upgrade head
```
Expected: new file in `alembic/versions/`, migration runs without error.
Verify: `alembic current` shows the new head.

- [ ] **Step 7: Commit**

```bash
git add apps/api/app/infrastructure/db/models/attendance.py \
        apps/api/app/infrastructure/db/models/__init__.py \
        apps/api/alembic/versions/
git commit -m "feat: add class_sessions and attendance_records ORM models and migration"
```

---

### Task 3: SQL Repository

**Files:**
- Create: `apps/api/app/infrastructure/db/repositories/attendance_repository.py`

- [ ] **Step 1: Write the failing test**

```python
# Add to apps/api/tests/test_attendance_domain.py
from app.infrastructure.db.repositories.attendance_repository import SQLAttendanceRepository


def test_sql_repo_importable():
    # Just verify it can be imported and is a subclass of the ABC
    from app.domain.repositories.attendance_repository import IAttendanceRepository
    assert issubclass(SQLAttendanceRepository, IAttendanceRepository)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && python -m pytest tests/test_attendance_domain.py::test_sql_repo_importable -v
```
Expected: `ImportError`

- [ ] **Step 3: Create the SQL repository**

```python
# apps/api/app/infrastructure/db/repositories/attendance_repository.py
from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.attendance import AttendanceRecord, ClassSession
from app.domain.repositories.attendance_repository import IAttendanceRepository
from app.infrastructure.db.models.attendance import AttendanceRecordModel, ClassSessionModel


def _session_to_domain(row: ClassSessionModel) -> ClassSession:
    return ClassSession(
        id=row.id,
        class_id=row.class_id,
        date=row.date,
        notes=row.notes,
        created_at=row.created_at,
    )


def _record_to_domain(row: AttendanceRecordModel) -> AttendanceRecord:
    return AttendanceRecord(
        id=row.id,
        session_id=row.session_id,
        student_id=row.student_id,
        status=row.status,
        note=row.note,
        marked_at=row.marked_at,
    )


class SQLAttendanceRepository(IAttendanceRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create_session(self, session: ClassSession) -> ClassSession:
        row = ClassSessionModel(
            id=session.id,
            class_id=session.class_id,
            date=session.date,
            notes=session.notes,
        )
        self._session.add(row)
        await self._session.flush()
        await self._session.refresh(row)
        return _session_to_domain(row)

    async def get_session(self, session_id: UUID, class_id: UUID) -> ClassSession | None:
        result = await self._session.execute(
            select(ClassSessionModel).where(
                ClassSessionModel.id == session_id,
                ClassSessionModel.class_id == class_id,
            )
        )
        row = result.scalar_one_or_none()
        return _session_to_domain(row) if row else None

    async def list_sessions(self, class_id: UUID) -> list[ClassSession]:
        result = await self._session.execute(
            select(ClassSessionModel)
            .where(ClassSessionModel.class_id == class_id)
            .order_by(ClassSessionModel.date.desc())
        )
        return [_session_to_domain(r) for r in result.scalars()]

    async def session_exists_for_date(self, class_id: UUID, date_: date) -> bool:
        result = await self._session.execute(
            select(ClassSessionModel.id).where(
                ClassSessionModel.class_id == class_id,
                ClassSessionModel.date == date_,
            )
        )
        return result.scalar_one_or_none() is not None

    async def upsert_attendance(self, record: AttendanceRecord) -> AttendanceRecord:
        stmt = (
            pg_insert(AttendanceRecordModel)
            .values(
                id=record.id,
                session_id=record.session_id,
                student_id=record.student_id,
                status=record.status,
                note=record.note,
                marked_at=record.marked_at,
            )
            .on_conflict_do_update(
                constraint="uq_attendance_record",
                set_={"status": record.status, "note": record.note, "marked_at": record.marked_at},
            )
            .returning(AttendanceRecordModel)
        )
        result = await self._session.execute(stmt)
        row = result.scalar_one()
        return _record_to_domain(row)

    async def list_attendance(self, session_id: UUID) -> list[AttendanceRecord]:
        result = await self._session.execute(
            select(AttendanceRecordModel)
            .where(AttendanceRecordModel.session_id == session_id)
            .order_by(AttendanceRecordModel.marked_at)
        )
        return [_record_to_domain(r) for r in result.scalars()]
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/api && python -m pytest tests/test_attendance_domain.py -v
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/infrastructure/db/repositories/attendance_repository.py
git commit -m "feat: add SQLAttendanceRepository"
```

---

### Task 4: Use Cases

**Files:**
- Create: `apps/api/app/application/use_cases/attendance/create_session.py`
- Create: `apps/api/app/application/use_cases/attendance/list_sessions.py`
- Create: `apps/api/app/application/use_cases/attendance/get_session.py`
- Create: `apps/api/app/application/use_cases/attendance/mark_attendance.py`
- Create: `apps/api/app/application/use_cases/attendance/list_attendance.py`

- [ ] **Step 1: Write the failing tests**

```python
# apps/api/tests/test_attendance_use_cases.py
import uuid
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock

import pytest

from app.application.use_cases.attendance.create_session import CreateSessionUseCase
from app.application.use_cases.attendance.get_session import GetSessionUseCase
from app.application.use_cases.attendance.list_attendance import ListAttendanceUseCase
from app.application.use_cases.attendance.list_sessions import ListSessionsUseCase
from app.application.use_cases.attendance.mark_attendance import MarkAttendanceUseCase
from app.domain.entities.attendance import AttendanceRecord, ClassSession
from app.domain.entities.class_ import Class
from app.domain.exceptions import ConflictError, NotFoundError

_ORG_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")
_CLASS_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")
_SESSION_ID = uuid.UUID("00000000-0000-0000-0000-000000000020")
_STUDENT_ID = uuid.UUID("00000000-0000-0000-0000-000000000003")
_NOW = datetime(2026, 5, 1, tzinfo=timezone.utc)

_CLASS = Class(
    id=_CLASS_ID, organization_id=_ORG_ID, teacher_id=uuid.uuid4(),
    name="Toán 10A", subject="Toán", academic_year="2025-2026",
    is_active=True, created_at=_NOW, updated_at=_NOW, deleted_at=None,
)
_SESSION = ClassSession(
    id=_SESSION_ID, class_id=_CLASS_ID,
    date=date(2026, 5, 1), notes=None, created_at=_NOW,
)
_RECORD = AttendanceRecord(
    id=uuid.uuid4(), session_id=_SESSION_ID, student_id=_STUDENT_ID,
    status="present", note=None, marked_at=_NOW,
)


@pytest.mark.asyncio
async def test_create_session_class_not_found():
    class_repo = AsyncMock()
    class_repo.get_by_id.return_value = None
    att_repo = AsyncMock()
    with pytest.raises(NotFoundError):
        await CreateSessionUseCase(class_repo, att_repo).execute(
            _CLASS_ID, _ORG_ID, date(2026, 5, 1), None
        )


@pytest.mark.asyncio
async def test_create_session_duplicate_date():
    class_repo = AsyncMock()
    class_repo.get_by_id.return_value = _CLASS
    att_repo = AsyncMock()
    att_repo.session_exists_for_date.return_value = True
    with pytest.raises(ConflictError):
        await CreateSessionUseCase(class_repo, att_repo).execute(
            _CLASS_ID, _ORG_ID, date(2026, 5, 1), None
        )


@pytest.mark.asyncio
async def test_create_session_success():
    class_repo = AsyncMock()
    class_repo.get_by_id.return_value = _CLASS
    att_repo = AsyncMock()
    att_repo.session_exists_for_date.return_value = False
    att_repo.create_session.return_value = _SESSION
    result = await CreateSessionUseCase(class_repo, att_repo).execute(
        _CLASS_ID, _ORG_ID, date(2026, 5, 1), None
    )
    assert result.class_id == _CLASS_ID
    att_repo.create_session.assert_called_once()


@pytest.mark.asyncio
async def test_mark_attendance_session_not_found():
    class_repo = AsyncMock()
    class_repo.get_by_id.return_value = _CLASS
    att_repo = AsyncMock()
    att_repo.get_session.return_value = None
    with pytest.raises(NotFoundError):
        await MarkAttendanceUseCase(class_repo, att_repo).execute(
            _CLASS_ID, _SESSION_ID, _ORG_ID,
            [{"student_id": _STUDENT_ID, "status": "present", "note": None}],
        )


@pytest.mark.asyncio
async def test_mark_attendance_success():
    class_repo = AsyncMock()
    class_repo.get_by_id.return_value = _CLASS
    att_repo = AsyncMock()
    att_repo.get_session.return_value = _SESSION
    att_repo.upsert_attendance.return_value = _RECORD
    results = await MarkAttendanceUseCase(class_repo, att_repo).execute(
        _CLASS_ID, _SESSION_ID, _ORG_ID,
        [{"student_id": _STUDENT_ID, "status": "present", "note": None}],
    )
    assert len(results) == 1
    assert results[0].status == "present"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && python -m pytest tests/test_attendance_use_cases.py -v
```
Expected: `ImportError`

- [ ] **Step 3: Create `create_session.py`**

```python
# apps/api/app/application/use_cases/attendance/create_session.py
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from app.domain.entities.attendance import ClassSession
from app.domain.exceptions import ConflictError, NotFoundError
from app.domain.repositories.attendance_repository import IAttendanceRepository
from app.domain.repositories.class_repository import IClassRepository


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
    ) -> ClassSession:
        class_ = await self._class_repo.get_by_id(class_id, org_id)
        if not class_:
            raise NotFoundError("Class", str(class_id))
        if await self._att_repo.session_exists_for_date(class_id, session_date):
            raise ConflictError(f"Session already exists for date {session_date}")
        session = ClassSession(
            id=uuid.uuid4(),
            class_id=class_id,
            date=session_date,
            notes=notes,
            created_at=datetime.now(timezone.utc),
        )
        return await self._att_repo.create_session(session)
```

- [ ] **Step 4: Create `list_sessions.py`**

```python
# apps/api/app/application/use_cases/attendance/list_sessions.py
from __future__ import annotations

import uuid

from app.domain.entities.attendance import ClassSession
from app.domain.exceptions import NotFoundError
from app.domain.repositories.attendance_repository import IAttendanceRepository
from app.domain.repositories.class_repository import IClassRepository


class ListSessionsUseCase:
    def __init__(self, class_repo: IClassRepository, att_repo: IAttendanceRepository) -> None:
        self._class_repo = class_repo
        self._att_repo = att_repo

    async def execute(self, class_id: uuid.UUID, org_id: uuid.UUID) -> list[ClassSession]:
        class_ = await self._class_repo.get_by_id(class_id, org_id)
        if not class_:
            raise NotFoundError("Class", str(class_id))
        return await self._att_repo.list_sessions(class_id)
```

- [ ] **Step 5: Create `get_session.py`**

```python
# apps/api/app/application/use_cases/attendance/get_session.py
from __future__ import annotations

import uuid

from app.domain.entities.attendance import ClassSession
from app.domain.exceptions import NotFoundError
from app.domain.repositories.attendance_repository import IAttendanceRepository
from app.domain.repositories.class_repository import IClassRepository


class GetSessionUseCase:
    def __init__(self, class_repo: IClassRepository, att_repo: IAttendanceRepository) -> None:
        self._class_repo = class_repo
        self._att_repo = att_repo

    async def execute(
        self, session_id: uuid.UUID, class_id: uuid.UUID, org_id: uuid.UUID
    ) -> ClassSession:
        class_ = await self._class_repo.get_by_id(class_id, org_id)
        if not class_:
            raise NotFoundError("Class", str(class_id))
        session = await self._att_repo.get_session(session_id, class_id)
        if not session:
            raise NotFoundError("ClassSession", str(session_id))
        return session
```

- [ ] **Step 6: Create `mark_attendance.py`**

```python
# apps/api/app/application/use_cases/attendance/mark_attendance.py
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from app.domain.entities.attendance import AttendanceRecord
from app.domain.exceptions import NotFoundError
from app.domain.repositories.attendance_repository import IAttendanceRepository
from app.domain.repositories.class_repository import IClassRepository


class MarkAttendanceUseCase:
    def __init__(self, class_repo: IClassRepository, att_repo: IAttendanceRepository) -> None:
        self._class_repo = class_repo
        self._att_repo = att_repo

    async def execute(
        self,
        class_id: uuid.UUID,
        session_id: uuid.UUID,
        org_id: uuid.UUID,
        records: list[dict[str, Any]],
    ) -> list[AttendanceRecord]:
        class_ = await self._class_repo.get_by_id(class_id, org_id)
        if not class_:
            raise NotFoundError("Class", str(class_id))
        session = await self._att_repo.get_session(session_id, class_id)
        if not session:
            raise NotFoundError("ClassSession", str(session_id))
        now = datetime.now(timezone.utc)
        results = []
        for r in records:
            record = AttendanceRecord(
                id=uuid.uuid4(),
                session_id=session_id,
                student_id=r["student_id"],
                status=r["status"],
                note=r.get("note"),
                marked_at=now,
            )
            saved = await self._att_repo.upsert_attendance(record)
            results.append(saved)
        return results
```

- [ ] **Step 7: Create `list_attendance.py`**

```python
# apps/api/app/application/use_cases/attendance/list_attendance.py
from __future__ import annotations

import uuid

from app.domain.entities.attendance import AttendanceRecord
from app.domain.exceptions import NotFoundError
from app.domain.repositories.attendance_repository import IAttendanceRepository
from app.domain.repositories.class_repository import IClassRepository


class ListAttendanceUseCase:
    def __init__(self, class_repo: IClassRepository, att_repo: IAttendanceRepository) -> None:
        self._class_repo = class_repo
        self._att_repo = att_repo

    async def execute(
        self, session_id: uuid.UUID, class_id: uuid.UUID, org_id: uuid.UUID
    ) -> list[AttendanceRecord]:
        class_ = await self._class_repo.get_by_id(class_id, org_id)
        if not class_:
            raise NotFoundError("Class", str(class_id))
        session = await self._att_repo.get_session(session_id, class_id)
        if not session:
            raise NotFoundError("ClassSession", str(session_id))
        return await self._att_repo.list_attendance(session_id)
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
cd apps/api && python -m pytest tests/test_attendance_use_cases.py -v
```
Expected: 5 tests PASS

- [ ] **Step 9: Commit**

```bash
git add apps/api/app/application/use_cases/attendance/ \
        apps/api/tests/test_attendance_use_cases.py
git commit -m "feat: add attendance use cases (create session, mark attendance, list)"
```

---

### Task 5: Schemas + Router + Register

**Files:**
- Create: `apps/api/app/interfaces/api/v1/schemas/attendance.py`
- Create: `apps/api/app/interfaces/api/v1/routers/attendance.py`
- Modify: `apps/api/app/main.py`

- [ ] **Step 1: Create Pydantic schemas**

```python
# apps/api/app/interfaces/api/v1/schemas/attendance.py
from __future__ import annotations

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class CreateSessionRequest(BaseModel):
    date: date
    notes: str | None = None


class SessionResponse(BaseModel):
    id: UUID
    class_id: UUID
    date: date
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


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

- [ ] **Step 2: Create attendance router**

```python
# apps/api/app/interfaces/api/v1/routers/attendance.py
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.attendance.create_session import CreateSessionUseCase
from app.application.use_cases.attendance.get_session import GetSessionUseCase
from app.application.use_cases.attendance.list_attendance import ListAttendanceUseCase
from app.application.use_cases.attendance.list_sessions import ListSessionsUseCase
from app.application.use_cases.attendance.mark_attendance import MarkAttendanceUseCase
from app.infrastructure.db.repositories.attendance_repository import SQLAttendanceRepository
from app.infrastructure.db.repositories.class_repository import SQLClassRepository
from app.infrastructure.db.session import get_db
from app.interfaces.api.v1.dependencies import require_role
from app.interfaces.api.v1.schemas.attendance import (
    AttendanceRecordResponse,
    CreateSessionRequest,
    MarkAttendanceRequest,
    SessionResponse,
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
    return await uc.execute(class_id, token.org_id, body.date, body.notes)


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
```

- [ ] **Step 3: Register router in `main.py`**

In `apps/api/app/main.py`, the current last lines are:
```python
from app.interfaces.api.v1.routers import classes, students  # noqa: E402

app.include_router(students.router, prefix="/api/v1/students", tags=["students"])
app.include_router(classes.router, prefix="/api/v1/classes", tags=["classes"])
```

Add after that:
```python
from app.interfaces.api.v1.routers import attendance  # noqa: E402

app.include_router(attendance.router, prefix="/api/v1/classes", tags=["attendance"])
```

- [ ] **Step 4: Verify the app starts**

```bash
cd apps/api && python -c "from app.main import app; print('OK')"
```
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/interfaces/api/v1/schemas/attendance.py \
        apps/api/app/interfaces/api/v1/routers/attendance.py \
        apps/api/app/main.py
git commit -m "feat: add attendance router and schemas"
```

---

### Task 6: API Tests

**Files:**
- Create: `apps/api/tests/test_attendance.py`

- [ ] **Step 1: Write the tests**

```python
# apps/api/tests/test_attendance.py
import uuid
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, patch

from httpx import AsyncClient

from app.domain.entities.attendance import AttendanceRecord, ClassSession
from app.domain.exceptions import ConflictError, NotFoundError
from app.infrastructure.security.jwt import TokenData
from app.interfaces.api.v1.dependencies import get_current_user
from app.main import app

_ORG_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")
_TEACHER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
_CLASS_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")
_SESSION_ID = uuid.UUID("00000000-0000-0000-0000-000000000020")
_STUDENT_ID = uuid.UUID("00000000-0000-0000-0000-000000000003")
_TOKEN = TokenData(user_id=_TEACHER_ID, org_id=_ORG_ID, role="teacher", jti="j", exp=9999999999)
_NOW = datetime(2026, 5, 1, tzinfo=timezone.utc)

_SESSION = ClassSession(
    id=_SESSION_ID, class_id=_CLASS_ID,
    date=date(2026, 5, 1), notes=None, created_at=_NOW,
)
_RECORD = AttendanceRecord(
    id=uuid.uuid4(), session_id=_SESSION_ID, student_id=_STUDENT_ID,
    status="present", note=None, marked_at=_NOW,
)


async def _override():
    return _TOKEN


async def test_create_session(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.attendance.CreateSessionUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=_SESSION)
            resp = await client.post(
                f"/api/v1/classes/{_CLASS_ID}/sessions",
                json={"date": "2026-05-01"},
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 201
        assert resp.json()["date"] == "2026-05-01"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_create_session_conflict(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.attendance.CreateSessionUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(
                side_effect=ConflictError("Session already exists for date 2026-05-01")
            )
            resp = await client.post(
                f"/api/v1/classes/{_CLASS_ID}/sessions",
                json={"date": "2026-05-01"},
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 409
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_list_sessions(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.attendance.ListSessionsUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=[_SESSION])
            resp = await client.get(
                f"/api/v1/classes/{_CLASS_ID}/sessions",
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 200
        assert len(resp.json()) == 1
        assert resp.json()[0]["class_id"] == str(_CLASS_ID)
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_mark_attendance(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.attendance.MarkAttendanceUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=[_RECORD])
            resp = await client.put(
                f"/api/v1/classes/{_CLASS_ID}/sessions/{_SESSION_ID}/attendance",
                json={"records": [{"student_id": str(_STUDENT_ID), "status": "present"}]},
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 200
        assert resp.json()[0]["status"] == "present"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_mark_attendance_session_not_found(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.attendance.MarkAttendanceUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(
                side_effect=NotFoundError("ClassSession", str(_SESSION_ID))
            )
            resp = await client.put(
                f"/api/v1/classes/{_CLASS_ID}/sessions/{_SESSION_ID}/attendance",
                json={"records": [{"student_id": str(_STUDENT_ID), "status": "present"}]},
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 404
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_list_attendance(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.attendance.ListAttendanceUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=[_RECORD])
            resp = await client.get(
                f"/api/v1/classes/{_CLASS_ID}/sessions/{_SESSION_ID}/attendance",
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 200
        assert resp.json()[0]["student_id"] == str(_STUDENT_ID)
    finally:
        app.dependency_overrides.pop(get_current_user, None)
```

- [ ] **Step 2: Run tests**

```bash
cd apps/api && python -m pytest tests/test_attendance.py tests/test_attendance_use_cases.py tests/test_attendance_domain.py -v
```
Expected: all tests PASS

- [ ] **Step 3: Run full test suite**

```bash
cd apps/api && python -m pytest --tb=short -q
```
Expected: all existing tests still pass, total count increased

- [ ] **Step 4: Commit**

```bash
git add apps/api/tests/test_attendance.py
git commit -m "test: add attendance API and use case tests"
```

---

### Task 7: Frontend Types + API Client

**Files:**
- Create: `apps/web/src/features/attendance/model/types.ts`
- Create: `apps/web/src/features/attendance/api/attendance.api.ts`

- [ ] **Step 1: Create TypeScript types**

```typescript
// apps/web/src/features/attendance/model/types.ts
export type AttendanceStatus = "present" | "absent" | "late";

export interface ClassSession {
  id: string;
  class_id: string;
  date: string;  // "YYYY-MM-DD"
  notes: string | null;
  created_at: string;
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

- [ ] **Step 2: Create API client**

```typescript
// apps/web/src/features/attendance/api/attendance.api.ts
import { apiClient } from "@/src/shared/api/client";
import type { AttendanceRecord, AttendanceRecordIn, ClassSession } from "../model/types";

export async function createSessionApi(
  classId: string,
  date: string,
  notes?: string,
): Promise<ClassSession> {
  const { data } = await apiClient.post<ClassSession>(
    `/classes/${classId}/sessions`,
    { date, notes: notes ?? null },
  );
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

- [ ] **Step 3: Check TypeScript**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep -E "attendance" || echo "No TS errors in attendance"
```
Expected: `No TS errors in attendance`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/attendance/
git commit -m "feat: add attendance TypeScript types and API client"
```

---

### Task 8: AttendanceSheet + SessionSection Components

**Files:**
- Create: `apps/web/src/features/attendance/ui/AttendanceSheet.tsx`
- Create: `apps/web/src/features/attendance/ui/SessionSection.tsx`

- [ ] **Step 1: Write `AttendanceSheet.tsx`**

This component receives a list of enrolled students and the current attendance records, lets the teacher toggle each student's status, and submits in bulk.

```tsx
// apps/web/src/features/attendance/ui/AttendanceSheet.tsx
"use client";

import { useState } from "react";
import { markAttendanceApi } from "../api/attendance.api";
import type { AttendanceRecord, AttendanceRecordIn, AttendanceStatus } from "../model/types";
import type { Enrollment } from "@/src/features/classes/model/types";
import type { Student } from "@/src/features/students/model/types";

interface Props {
  classId: string;
  sessionId: string;
  enrollments: Enrollment[];
  students: Student[];
  initialRecords: AttendanceRecord[];
  onSaved: (records: AttendanceRecord[]) => void;
}

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Có mặt",
  absent: "Vắng",
  late: "Trễ",
};

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  present: "bg-success/10 text-success border-success/30",
  absent: "bg-error/10 text-error border-error/30",
  late: "bg-amber-50 text-amber-700 border-amber-200",
};

const DEFAULT_STATUS: AttendanceStatus = "present";

export function AttendanceSheet({
  classId,
  sessionId,
  enrollments,
  students,
  initialRecords,
  onSaved,
}: Props) {
  const initialMap = Object.fromEntries(
    initialRecords.map((r) => [r.student_id, r.status as AttendanceStatus])
  );
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus>>(
    Object.fromEntries(
      enrollments.map((e) => [e.student_id, initialMap[e.student_id] ?? DEFAULT_STATUS])
    )
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const studentById = Object.fromEntries(students.map((s) => [s.id, s]));

  function toggle(studentId: string, status: AttendanceStatus) {
    setStatusMap((prev) => ({ ...prev, [studentId]: status }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const records: AttendanceRecordIn[] = enrollments.map((e) => ({
        student_id: e.student_id,
        status: statusMap[e.student_id] ?? DEFAULT_STATUS,
      }));
      const saved = await markAttendanceApi(classId, sessionId, records);
      onSaved(saved);
    } catch {
      setError("Không thể lưu điểm danh. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  if (enrollments.length === 0) {
    return (
      <p className="text-sm text-ash">Chưa có học sinh nào trong lớp.</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="rounded-sm border border-error/20 bg-error/5 px-3 py-2 text-sm text-error">
          {error}
        </div>
      )}
      <div className="flex flex-col gap-2">
        {enrollments.map((e) => {
          const student = studentById[e.student_id];
          const current = statusMap[e.student_id] ?? DEFAULT_STATUS;
          return (
            <div
              key={e.student_id}
              className="flex items-center justify-between rounded-sm border border-border bg-surface px-4 py-3"
            >
              <span className="text-sm font-medium text-ink">
                {student?.full_name ?? e.student_id}
              </span>
              <div className="flex gap-1.5">
                {(["present", "absent", "late"] as AttendanceStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => toggle(e.student_id, s)}
                    className={`px-3 py-1 text-xs font-semibold rounded-sm border transition-colors ${
                      current === s
                        ? STATUS_STYLES[s]
                        : "bg-canvas text-ash border-border hover:border-ink"
                    }`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 text-sm font-semibold text-white bg-primary rounded-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
        >
          {saving ? "Đang lưu..." : "Lưu điểm danh"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `SessionSection.tsx`**

This component manages the full attendance flow for a class: shows a form to create a session, lists past sessions, and renders the AttendanceSheet for the selected session.

```tsx
// apps/web/src/features/attendance/ui/SessionSection.tsx
"use client";

import { useEffect, useState } from "react";
import {
  createSessionApi,
  listAttendanceApi,
  listSessionsApi,
} from "../api/attendance.api";
import type { AttendanceRecord, ClassSession } from "../model/types";
import { AttendanceSheet } from "./AttendanceSheet";
import type { Enrollment } from "@/src/features/classes/model/types";
import type { Student } from "@/src/features/students/model/types";
import { listStudentsApi } from "@/src/features/students/api/students.api";

interface Props {
  classId: string;
  enrollments: Enrollment[];
}

const DAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} (${DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1]})`;
}

export function SessionSection({ classId, enrollments }: Props) {
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<ClassSession | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listSessionsApi(classId), listStudentsApi()])
      .then(([s, st]) => { setSessions(s); setStudents(st); })
      .finally(() => setLoading(false));
  }, [classId]);

  async function handleSelectSession(session: ClassSession) {
    if (selectedSession?.id === session.id) {
      setSelectedSession(null);
      return;
    }
    setSelectedSession(session);
    setAttendanceLoading(true);
    try {
      const records = await listAttendanceApi(classId, session.id);
      setAttendanceRecords(records);
    } finally {
      setAttendanceLoading(false);
    }
  }

  async function handleCreateSession() {
    if (!newDate) return;
    setCreating(true);
    setCreateError(null);
    try {
      const session = await createSessionApi(classId, newDate);
      setSessions((prev) => [session, ...prev]);
      setNewDate("");
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

  if (loading) {
    return <div className="h-10 w-full bg-stone/20 rounded animate-pulse" />;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Create session form */}
      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-ash uppercase tracking-wide">
            Ngày buổi học
          </label>
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="border border-border rounded-sm px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:border-primary"
          />
        </div>
        <button
          onClick={handleCreateSession}
          disabled={!newDate || creating}
          className="px-4 py-2 text-sm font-semibold text-white bg-primary rounded-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
        >
          {creating ? "Đang tạo..." : "+ Tạo buổi"}
        </button>
      </div>
      {createError && (
        <p className="text-sm text-error">{createError}</p>
      )}

      {/* Session list */}
      {sessions.length === 0 ? (
        <p className="text-sm text-ash">Chưa có buổi học nào. Tạo buổi học đầu tiên ở trên.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {sessions.map((s) => (
            <div key={s.id} className="rounded-sm border border-border overflow-hidden">
              <button
                onClick={() => handleSelectSession(s)}
                className="w-full flex items-center justify-between px-4 py-3 bg-canvas hover:bg-surface transition-colors text-left"
              >
                <span className="text-sm font-medium text-ink">{formatDate(s.date)}</span>
                <span className="text-stone text-sm">
                  {selectedSession?.id === s.id ? "▲" : "▼"}
                </span>
              </button>
              {selectedSession?.id === s.id && (
                <div className="px-4 py-4 border-t border-border bg-surface">
                  {attendanceLoading ? (
                    <div className="h-8 bg-stone/20 rounded animate-pulse" />
                  ) : (
                    <AttendanceSheet
                      classId={classId}
                      sessionId={s.id}
                      enrollments={enrollments}
                      students={students}
                      initialRecords={attendanceRecords}
                      onSaved={(records) => setAttendanceRecords(records)}
                    />
                  )}
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

- [ ] **Step 3: Check TypeScript**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -30
```
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/attendance/ui/
git commit -m "feat: add AttendanceSheet and SessionSection UI components"
```

---

### Task 9: Integrate into Class Detail Page

**Files:**
- Modify: `apps/web/app/(teacher)/classes/[id]/page.tsx`

- [ ] **Step 1: Read current file**

Current file is at `apps/web/app/(teacher)/classes/[id]/page.tsx`. The `return` JSX ends with:
```tsx
      {/* Students */}
      <section className="rounded-md border border-border bg-canvas p-5">
        <EnrollmentSection classId={id} />
      </section>
    </div>
  );
```

- [ ] **Step 2: Add enrollment state lifting**

The page currently fetches class and schedules. We need to also fetch enrollments at the page level so `SessionSection` can receive them. Modify the state and effect in `ClassDetailPage`:

Replace the existing state block:
```tsx
const [class_, setClass_] = useState<Class | null>(null);
const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
```
With:
```tsx
const [class_, setClass_] = useState<Class | null>(null);
const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
```

Replace the useEffect:
```tsx
useEffect(() => {
  Promise.all([getClassApi(id), listSchedulesApi(id)])
    .then(([c, s]) => { setClass_(c); setSchedules(s); })
    .catch(() => setError("Không thể tải thông tin lớp."))
    .finally(() => setLoading(false));
}, [id]);
```
With:
```tsx
useEffect(() => {
  Promise.all([getClassApi(id), listSchedulesApi(id), listEnrollmentsApi(id)])
    .then(([c, s, e]) => { setClass_(c); setSchedules(s); setEnrollments(e); })
    .catch(() => setError("Không thể tải thông tin lớp."))
    .finally(() => setLoading(false));
}, [id]);
```

- [ ] **Step 3: Add imports and SessionSection**

Add imports at the top of the file:
```tsx
import { SessionSection } from "@/src/features/attendance/ui/SessionSection";
import { listEnrollmentsApi } from "@/src/features/classes/api/classes.api";
import type { Enrollment } from "@/src/features/classes/model/types";
```

Add `SessionSection` after the Students section. Replace the closing `</div>` of the page's main content:
```tsx
      {/* Students */}
      <section className="rounded-md border border-border bg-canvas p-5">
        <EnrollmentSection classId={id} />
      </section>

      {/* Attendance */}
      <section className="rounded-md border border-border bg-canvas p-5">
        <h2 className="font-semibold text-ink mb-4">Điểm danh</h2>
        <SessionSection classId={id} enrollments={enrollments} />
      </section>
    </div>
  );
```

- [ ] **Step 4: Check TypeScript**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -30
```
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(teacher\)/classes/\[id\]/page.tsx
git commit -m "feat: integrate attendance section into class detail page"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|---|---|
| ClassSession domain entity (date, class_id, notes) | Task 1 |
| AttendanceRecord domain entity (session_id, student_id, status) | Task 1 |
| Repository ABC with upsert | Task 1 |
| ORM models with unique constraints and status check | Task 2 |
| Alembic migration | Task 2 |
| SQL repository with pg_insert upsert | Task 3 |
| Create session use case (org check, duplicate check) | Task 4 |
| Mark attendance use case (batch, session ownership) | Task 4 |
| List sessions/attendance use cases | Task 4 |
| Pydantic schemas with `Literal` status | Task 5 |
| FastAPI router at `/classes/{class_id}/sessions` | Task 5 |
| Router registration in main.py | Task 5 |
| API tests for all 5 endpoints | Task 6 |
| TypeScript types (`AttendanceStatus`, `ClassSession`, `AttendanceRecord`) | Task 7 |
| API client (create, list, mark, list attendance) | Task 7 |
| AttendanceSheet component with per-student toggles | Task 8 |
| SessionSection with create form + session list + inline sheet | Task 8 |
| Integrated into class detail page | Task 9 |

**Placeholder scan:** No TBDs, no "implement later", all code blocks complete.

**Type consistency:**
- `ClassSession` used in Task 1 → 3 → 4 → 5 → 7 → 8: consistent field names (`id`, `class_id`, `date`, `notes`, `created_at`)
- `AttendanceRecord` used in Task 1 → 3 → 4 → 5 → 7 → 8: consistent (`id`, `session_id`, `student_id`, `status`, `note`, `marked_at`)
- `IAttendanceRepository.session_exists_for_date` called in Task 4 `CreateSessionUseCase` — matches ABC signature in Task 1
- `SQLAttendanceRepository` method `session_exists_for_date` in Task 3 — matches
- `listStudentsApi()` imported from `@/src/features/students/api/students.api` — exists from Phase 3
- `Enrollment` type imported from `@/src/features/classes/model/types` — exists from Phase 3
- `Student` type imported from `@/src/features/students/model/types` — exists from Phase 3 (`Student.id`, `Student.full_name`)
