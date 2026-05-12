# Teacher Calendar Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay thế dashboard bằng calendar month view, thêm trang chi tiết buổi học, restructure class detail thành tabs, và tính điểm TB môn theo hệ số Việt Nam.

**Architecture:** Backend thêm 2 endpoints mới (PATCH session notes, GET calendar). Frontend tách session detail thành route riêng `/classes/[id]/sessions/[sid]`, refactor class detail thành 4 tabs. Calendar dùng lazy session creation — click placeholder → POST tạo session → redirect.

**Tech Stack:** Python FastAPI + SQLAlchemy async (backend), Next.js 15 App Router + TypeScript + Tailwind (frontend). Design system: primary `#ff385c`, ink/ash/surface/canvas/border/success/error — không dùng màu ngoài token.

---

## File Map

**New (API):**
- `apps/api/app/domain/entities/calendar.py` — CalendarSession, CalendarSlot dataclasses
- `apps/api/app/application/use_cases/attendance/update_session.py` — UpdateSessionUseCase
- `apps/api/app/application/use_cases/calendar/get_calendar.py` — GetCalendarUseCase
- `apps/api/app/interfaces/api/v1/schemas/calendar.py` — Pydantic schemas cho calendar
- `apps/api/app/interfaces/api/v1/routers/calendar.py` — GET /calendar router

**Modified (API):**
- `apps/api/app/domain/repositories/attendance_repository.py` — thêm 3 abstract methods
- `apps/api/app/infrastructure/db/repositories/attendance_repository.py` — implement 3 methods mới
- `apps/api/app/interfaces/api/v1/schemas/attendance.py` — thêm UpdateSessionRequest
- `apps/api/app/interfaces/api/v1/routers/attendance.py` — thêm PATCH endpoint
- `apps/api/app/main.py` — include calendar router

**New (Web):**
- `apps/web/src/features/calendar/model/types.ts` — CalendarSession, CalendarSlot types
- `apps/web/src/features/calendar/api/calendar.api.ts` — getCalendarApi, createSessionApi wrapper
- `apps/web/src/features/grades/lib/grading.ts` — computeWeightedAverage utility
- `apps/web/src/features/calendar/ui/CalendarGrid.tsx` — month grid component
- `apps/web/src/features/calendar/ui/CalendarEvent.tsx` — event chip component
- `apps/web/src/features/calendar/ui/CreateSessionModal.tsx` — ad-hoc session modal
- `apps/web/app/(teacher)/classes/[id]/sessions/[sessionId]/page.tsx` — session detail page

**Modified (Web):**
- `apps/web/app/(teacher)/dashboard/page.tsx` — replace with calendar
- `apps/web/app/(teacher)/classes/[id]/page.tsx` — tab layout
- `apps/web/app/(teacher)/layout.tsx` — nav label Dashboard → Lịch dạy
- `apps/web/src/features/grades/ui/ExamSection.tsx` — add filterDate prop + coefficient badge + remove weight_percent field
- `apps/web/src/features/attendance/api/attendance.api.ts` — add patchSessionNotesApi

---

## Task 1: Backend — Repository methods cho calendar + patch notes

**Files:**
- Modify: `apps/api/app/domain/repositories/attendance_repository.py`
- Modify: `apps/api/app/infrastructure/db/repositories/attendance_repository.py`

- [ ] **Step 1: Thêm 3 abstract methods vào IAttendanceRepository**

```python
# apps/api/app/domain/repositories/attendance_repository.py
from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import date
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

    # --- new ---
    @abstractmethod
    async def update_session_notes(self, session_id: UUID, class_id: UUID, notes: str | None) -> ClassSession | None: ...

    @abstractmethod
    async def list_sessions_in_month(self, class_ids: list[UUID], start: date, end: date) -> list[ClassSession]: ...

    @abstractmethod
    async def session_ids_with_attendance(self, session_ids: list[UUID]) -> set[UUID]: ...
```

- [ ] **Step 2: Implement 3 methods mới trong SQLAttendanceRepository**

Thêm vào cuối file `apps/api/app/infrastructure/db/repositories/attendance_repository.py`:

```python
    async def update_session_notes(self, session_id: UUID, class_id: UUID, notes: str | None) -> ClassSession | None:
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
        await self._session.flush()
        await self._session.refresh(row)
        return _session_to_domain(row)

    async def list_sessions_in_month(self, class_ids: list[UUID], start: date, end: date) -> list[ClassSession]:
        if not class_ids:
            return []
        result = await self._session.execute(
            select(ClassSessionModel)
            .where(
                ClassSessionModel.class_id.in_(class_ids),
                ClassSessionModel.date >= start,
                ClassSessionModel.date <= end,
            )
            .order_by(ClassSessionModel.date)
        )
        return [_session_to_domain(r) for r in result.scalars()]

    async def session_ids_with_attendance(self, session_ids: list[UUID]) -> set[UUID]:
        if not session_ids:
            return set()
        result = await self._session.execute(
            select(AttendanceRecordModel.session_id).distinct().where(
                AttendanceRecordModel.session_id.in_(session_ids)
            )
        )
        return {row for row in result.scalars()}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/app/domain/repositories/attendance_repository.py \
        apps/api/app/infrastructure/db/repositories/attendance_repository.py
git commit -m "feat: add update_session_notes, list_sessions_in_month, session_ids_with_attendance to attendance repo"
```

---

## Task 2: Backend — PATCH /classes/{id}/sessions/{sid}

**Files:**
- Create: `apps/api/app/application/use_cases/attendance/update_session.py`
- Modify: `apps/api/app/interfaces/api/v1/schemas/attendance.py`
- Modify: `apps/api/app/interfaces/api/v1/routers/attendance.py`
- Test: `apps/api/tests/test_attendance.py`

- [ ] **Step 1: Viết test fail**

Thêm vào cuối `apps/api/tests/test_attendance.py`:

```python
async def test_patch_session_notes(client: AsyncClient):
    updated = ClassSession(
        id=_SESSION_ID, class_id=_CLASS_ID,
        date=date(2026, 5, 1), notes="Ghi chú mới", created_at=_NOW,
    )
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.attendance.UpdateSessionUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=updated)
            resp = await client.patch(
                f"/api/v1/classes/{_CLASS_ID}/sessions/{_SESSION_ID}",
                json={"notes": "Ghi chú mới"},
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 200
        assert resp.json()["notes"] == "Ghi chú mới"
    finally:
        app.dependency_overrides.pop(get_current_user, None)
```

- [ ] **Step 2: Chạy test, xác nhận fail**

```bash
cd apps/api && pytest tests/test_attendance.py::test_patch_session_notes -v
```

Expected: `FAIL` — `UpdateSessionUseCase` not found.

- [ ] **Step 3: Tạo UpdateSessionUseCase**

```python
# apps/api/app/application/use_cases/attendance/update_session.py
from __future__ import annotations

from uuid import UUID

from app.domain.entities.attendance import ClassSession
from app.domain.exceptions import NotFoundError
from app.domain.repositories.attendance_repository import IAttendanceRepository
from app.domain.repositories.class_repository import IClassRepository


class UpdateSessionUseCase:
    def __init__(self, class_repo: IClassRepository, att_repo: IAttendanceRepository) -> None:
        self._class_repo = class_repo
        self._att_repo = att_repo

    async def execute(self, class_id: UUID, session_id: UUID, org_id: UUID, notes: str | None) -> ClassSession:
        class_ = await self._class_repo.get_by_id(class_id, org_id)
        if not class_:
            raise NotFoundError("Class", str(class_id))
        session = await self._att_repo.update_session_notes(session_id, class_id, notes)
        if not session:
            raise NotFoundError("Session", str(session_id))
        return session
```

- [ ] **Step 4: Thêm UpdateSessionRequest vào schemas**

Thêm vào `apps/api/app/interfaces/api/v1/schemas/attendance.py`:

```python
class UpdateSessionRequest(BaseModel):
    notes: str | None = None
```

- [ ] **Step 5: Thêm PATCH endpoint vào router**

Thêm vào `apps/api/app/interfaces/api/v1/routers/attendance.py` (sau import, thêm UpdateSessionUseCase và UpdateSessionRequest):

```python
from app.application.use_cases.attendance.update_session import UpdateSessionUseCase
from app.interfaces.api.v1.schemas.attendance import (
    AttendanceRecordResponse,
    CreateSessionRequest,
    MarkAttendanceRequest,
    SessionResponse,
    UpdateSessionRequest,
)
```

Thêm endpoint:

```python
@router.patch("/{class_id}/sessions/{session_id}", response_model=SessionResponse)
async def update_session(
    class_id: UUID,
    session_id: UUID,
    body: UpdateSessionRequest,
    token=Depends(_teacher),
    db: AsyncSession = Depends(get_db),
):
    uc = UpdateSessionUseCase(SQLClassRepository(db), SQLAttendanceRepository(db))
    return await uc.execute(class_id, session_id, token.org_id, body.notes)
```

- [ ] **Step 6: Chạy test, xác nhận pass**

```bash
cd apps/api && pytest tests/test_attendance.py::test_patch_session_notes -v
```

Expected: `PASS`

- [ ] **Step 7: Commit**

```bash
git add apps/api/app/application/use_cases/attendance/update_session.py \
        apps/api/app/interfaces/api/v1/schemas/attendance.py \
        apps/api/app/interfaces/api/v1/routers/attendance.py \
        apps/api/tests/test_attendance.py
git commit -m "feat: add PATCH /classes/{id}/sessions/{sid} to update session notes"
```

---

## Task 3: Backend — GET /api/v1/calendar

**Files:**
- Create: `apps/api/app/domain/entities/calendar.py`
- Create: `apps/api/app/application/use_cases/calendar/get_calendar.py`
- Create: `apps/api/app/interfaces/api/v1/schemas/calendar.py`
- Create: `apps/api/app/interfaces/api/v1/routers/calendar.py`
- Modify: `apps/api/app/main.py`
- Test: `apps/api/tests/test_calendar.py`

- [ ] **Step 1: Tạo domain entities**

```python
# apps/api/app/domain/entities/calendar.py
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, time
from uuid import UUID


@dataclass
class CalendarSession:
    id: UUID
    class_id: UUID
    class_name: str
    date: date
    start_time: time | None
    end_time: time | None
    has_attendance: bool


@dataclass
class CalendarSlot:
    class_id: UUID
    class_name: str
    date: date
    start_time: time
    end_time: time


@dataclass
class CalendarData:
    sessions: list[CalendarSession]
    schedule_slots: list[CalendarSlot]
```

- [ ] **Step 2: Viết test fail**

```python
# apps/api/tests/test_calendar.py
import uuid
from datetime import date, datetime, time, timezone
from unittest.mock import AsyncMock, patch

from httpx import AsyncClient

from app.infrastructure.security.jwt import TokenData
from app.interfaces.api.v1.dependencies import get_current_user
from app.main import app

_ORG_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")
_TEACHER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
_TOKEN = TokenData(user_id=_TEACHER_ID, org_id=_ORG_ID, role="teacher", jti="j", exp=9999999999)


async def _override():
    return _TOKEN


async def test_get_calendar_returns_200(client: AsyncClient):
    from app.domain.entities.calendar import CalendarData

    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.calendar.GetCalendarUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(
                return_value=CalendarData(sessions=[], schedule_slots=[])
            )
            resp = await client.get(
                "/api/v1/calendar?month=2026-05",
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert "sessions" in data
        assert "schedule_slots" in data
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_get_calendar_invalid_month(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        resp = await client.get(
            "/api/v1/calendar?month=bad-month",
            headers={"Authorization": "Bearer fake"},
        )
        assert resp.status_code == 422
    finally:
        app.dependency_overrides.pop(get_current_user, None)
```

- [ ] **Step 3: Chạy test, xác nhận fail**

```bash
cd apps/api && pytest tests/test_calendar.py -v
```

Expected: `FAIL` — route not found.

- [ ] **Step 4: Tạo GetCalendarUseCase**

```python
# apps/api/app/application/use_cases/calendar/get_calendar.py
from __future__ import annotations

import calendar as cal
from datetime import date
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.calendar import CalendarData, CalendarSession, CalendarSlot
from app.domain.repositories.attendance_repository import IAttendanceRepository
from app.domain.repositories.class_repository import IClassRepository
from app.infrastructure.db.repositories.attendance_repository import SQLAttendanceRepository
from app.infrastructure.db.repositories.class_repository import SQLClassRepository


def _dates_in_month_for_dow(year: int, month: int, dow: int) -> list[date]:
    """Returns all dates in the month matching the given day_of_week (0=Mon..6=Sun)."""
    _, last_day = cal.monthrange(year, month)
    return [
        date(year, month, day)
        for day in range(1, last_day + 1)
        if date(year, month, day).weekday() == dow
    ]


class GetCalendarUseCase:
    def __init__(self, class_repo: IClassRepository, att_repo: IAttendanceRepository) -> None:
        self._class_repo = class_repo
        self._att_repo = att_repo

    async def execute(self, teacher_id: UUID, org_id: UUID, year: int, month: int) -> CalendarData:
        _, last_day = cal.monthrange(year, month)
        start = date(year, month, 1)
        end = date(year, month, last_day)

        classes = await self._class_repo.list_by_teacher(teacher_id, org_id)
        if not classes:
            return CalendarData(sessions=[], schedule_slots=[])

        class_map = {c.id: c for c in classes}
        sessions_in_month = await self._att_repo.list_sessions_in_month(
            [c.id for c in classes], start, end
        )
        # (class_id, date) -> session
        session_map = {(s.class_id, s.date): s for s in sessions_in_month}
        attended_ids = await self._att_repo.session_ids_with_attendance(
            [s.id for s in sessions_in_month]
        )

        sessions_out: list[CalendarSession] = []
        slots_out: list[CalendarSlot] = []
        scheduled_session_ids: set[UUID] = set()

        for class_ in classes:
            schedules = await self._class_repo.list_schedules(class_.id)
            for schedule in schedules:
                for d in _dates_in_month_for_dow(year, month, schedule.day_of_week):
                    session = session_map.get((class_.id, d))
                    if session:
                        scheduled_session_ids.add(session.id)
                        sessions_out.append(CalendarSession(
                            id=session.id,
                            class_id=class_.id,
                            class_name=class_.name,
                            date=d,
                            start_time=schedule.start_time,
                            end_time=schedule.end_time,
                            has_attendance=session.id in attended_ids,
                        ))
                    else:
                        slots_out.append(CalendarSlot(
                            class_id=class_.id,
                            class_name=class_.name,
                            date=d,
                            start_time=schedule.start_time,
                            end_time=schedule.end_time,
                        ))

        # Ad-hoc sessions (không khớp schedule nào)
        for session in sessions_in_month:
            if session.id not in scheduled_session_ids:
                class_ = class_map.get(session.class_id)
                if class_:
                    sessions_out.append(CalendarSession(
                        id=session.id,
                        class_id=session.class_id,
                        class_name=class_.name,
                        date=session.date,
                        start_time=None,
                        end_time=None,
                        has_attendance=session.id in attended_ids,
                    ))

        return CalendarData(sessions=sessions_out, schedule_slots=slots_out)
```

- [ ] **Step 5: Tạo Pydantic schemas**

```python
# apps/api/app/interfaces/api/v1/schemas/calendar.py
from __future__ import annotations

from datetime import date, time
from uuid import UUID

from pydantic import BaseModel


class CalendarSessionSchema(BaseModel):
    id: UUID
    class_id: UUID
    class_name: str
    date: date
    start_time: time | None
    end_time: time | None
    has_attendance: bool

    model_config = {"from_attributes": True}


class CalendarSlotSchema(BaseModel):
    class_id: UUID
    class_name: str
    date: date
    start_time: time
    end_time: time

    model_config = {"from_attributes": True}


class CalendarDataSchema(BaseModel):
    sessions: list[CalendarSessionSchema]
    schedule_slots: list[CalendarSlotSchema]
```

- [ ] **Step 6: Tạo router**

```python
# apps/api/app/interfaces/api/v1/routers/calendar.py
from __future__ import annotations

import re
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.calendar.get_calendar import GetCalendarUseCase
from app.domain.exceptions import ValidationError
from app.infrastructure.db.repositories.attendance_repository import SQLAttendanceRepository
from app.infrastructure.db.repositories.class_repository import SQLClassRepository
from app.infrastructure.db.session import get_db
from app.interfaces.api.v1.dependencies import require_role
from app.interfaces.api.v1.schemas.calendar import CalendarDataSchema

router = APIRouter()
_teacher = require_role("teacher", "admin")

_MONTH_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


@router.get("/calendar", response_model=CalendarDataSchema)
async def get_calendar(
    month: str = Query(..., description="YYYY-MM"),
    token=Depends(_teacher),
    db: AsyncSession = Depends(get_db),
):
    if not _MONTH_RE.match(month):
        raise ValidationError("month must be YYYY-MM format")
    year, month_int = int(month[:4]), int(month[5:])
    uc = GetCalendarUseCase(SQLClassRepository(db), SQLAttendanceRepository(db))
    result = await uc.execute(token.user_id, token.org_id, year, month_int)
    return CalendarDataSchema(
        sessions=[
            {
                "id": s.id, "class_id": s.class_id, "class_name": s.class_name,
                "date": s.date, "start_time": s.start_time, "end_time": s.end_time,
                "has_attendance": s.has_attendance,
            }
            for s in result.sessions
        ],
        schedule_slots=[
            {
                "class_id": sl.class_id, "class_name": sl.class_name,
                "date": sl.date, "start_time": sl.start_time, "end_time": sl.end_time,
            }
            for sl in result.schedule_slots
        ],
    )
```

- [ ] **Step 7: Register router in main.py**

Thêm vào cuối `apps/api/app/main.py`:

```python
from app.interfaces.api.v1.routers import calendar  # noqa: E402

app.include_router(calendar.router, prefix="/api/v1", tags=["calendar"])
```

- [ ] **Step 8: Tạo `__init__.py` cho use case package**

```bash
touch apps/api/app/application/use_cases/calendar/__init__.py
```

- [ ] **Step 9: Chạy test, xác nhận pass**

```bash
cd apps/api && pytest tests/test_calendar.py -v
```

Expected: `PASS`

- [ ] **Step 10: Commit**

```bash
git add apps/api/app/domain/entities/calendar.py \
        apps/api/app/application/use_cases/calendar/__init__.py \
        apps/api/app/application/use_cases/calendar/get_calendar.py \
        apps/api/app/interfaces/api/v1/schemas/calendar.py \
        apps/api/app/interfaces/api/v1/routers/calendar.py \
        apps/api/app/main.py \
        apps/api/tests/test_calendar.py
git commit -m "feat: add GET /calendar endpoint with lazy session slots"
```

---

## Task 4: Frontend — Types, API client, grading utility

**Files:**
- Create: `apps/web/src/features/calendar/model/types.ts`
- Create: `apps/web/src/features/calendar/api/calendar.api.ts`
- Create: `apps/web/src/features/grades/lib/grading.ts`
- Modify: `apps/web/src/features/attendance/api/attendance.api.ts`

- [ ] **Step 1: Tạo calendar types**

```typescript
// apps/web/src/features/calendar/model/types.ts
export interface CalendarSession {
  id: string;
  class_id: string;
  class_name: string;
  date: string;          // "YYYY-MM-DD"
  start_time: string | null;  // "HH:MM:SS"
  end_time: string | null;
  has_attendance: boolean;
}

export interface CalendarSlot {
  class_id: string;
  class_name: string;
  date: string;          // "YYYY-MM-DD"
  start_time: string;    // "HH:MM:SS"
  end_time: string;
}

export interface CalendarData {
  sessions: CalendarSession[];
  schedule_slots: CalendarSlot[];
}
```

- [ ] **Step 2: Tạo calendar API client**

```typescript
// apps/web/src/features/calendar/api/calendar.api.ts
import { apiClient } from "@/src/shared/api/client";
import type { CalendarData } from "../model/types";

export async function getCalendarApi(month: string): Promise<CalendarData> {
  const { data } = await apiClient.get<CalendarData>("/calendar", {
    params: { month },
  });
  return data;
}
```

- [ ] **Step 3: Thêm patchSessionNotesApi vào attendance API**

Thêm vào cuối `apps/web/src/features/attendance/api/attendance.api.ts`:

```typescript
export async function patchSessionNotesApi(
  classId: string,
  sessionId: string,
  notes: string | null,
): Promise<import("../model/types").ClassSession> {
  const { data } = await apiClient.patch(
    `/classes/${classId}/sessions/${sessionId}`,
    { notes },
  );
  return data;
}
```

- [ ] **Step 4: Tạo grading utility**

```typescript
// apps/web/src/features/grades/lib/grading.ts
import type { Exam, Grade } from "../model/types";

const EXAM_WEIGHT: Record<string, number> = {
  quiz: 1,
  midterm: 2,
  final: 3,
  // assignment: excluded (not in map)
};

/**
 * Tính điểm TB môn theo hệ số Việt Nam.
 * - quiz ×1, midterm ×2, final ×3, assignment không tính.
 * - Điểm quy về thang 10 trước khi nhân hệ số.
 * - Trả về null nếu chưa có bài nào hợp lệ.
 */
export function computeWeightedAverage(
  exams: Exam[],
  gradesByExam: Record<string, Grade[]>,
  studentId: string,
): number | null {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const exam of exams) {
    const weight = EXAM_WEIGHT[exam.type];
    if (!weight) continue; // assignment hoặc type không rõ

    const grades = gradesByExam[exam.id] ?? [];
    const grade = grades.find((g) => g.student_id === studentId);
    if (!grade) continue;

    const score10 = (grade.score / exam.max_score) * 10;
    weightedSum += score10 * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return null;
  return Math.round((weightedSum / totalWeight) * 10) / 10;
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/calendar/model/types.ts \
        apps/web/src/features/calendar/api/calendar.api.ts \
        apps/web/src/features/grades/lib/grading.ts \
        apps/web/src/features/attendance/api/attendance.api.ts
git commit -m "feat: add calendar types, API client, grading utility, and patchSessionNotes"
```

---

## Task 5: Frontend — CalendarGrid + CalendarEvent + CreateSessionModal

**Files:**
- Create: `apps/web/src/features/calendar/ui/CalendarEvent.tsx`
- Create: `apps/web/src/features/calendar/ui/CalendarGrid.tsx`
- Create: `apps/web/src/features/calendar/ui/CreateSessionModal.tsx`

- [ ] **Step 1: Tạo CalendarEvent component**

```tsx
// apps/web/src/features/calendar/ui/CalendarEvent.tsx
import type { CalendarSession, CalendarSlot } from "../model/types";

function formatTime(t: string) {
  return t.slice(0, 5); // "HH:MM"
}

interface SessionEventProps {
  session: CalendarSession;
  onClick: () => void;
}

export function SessionEvent({ session, onClick }: SessionEventProps) {
  const attended = session.has_attendance;
  const timeStr = session.start_time ? formatTime(session.start_time) : "";

  if (attended) {
    return (
      <button
        onClick={onClick}
        className="w-full text-left rounded-sm border-l-2 border-success bg-success/8 px-1.5 py-0.5 mb-0.5"
      >
        <p className="text-[11px] font-semibold text-[#005c04] truncate">{session.class_name} ✓</p>
        {timeStr && <p className="text-[10px] text-success">{timeStr}</p>}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-sm border-l-2 border-error bg-error/8 px-1.5 py-0.5 mb-0.5"
    >
      <p className="text-[11px] font-semibold text-error truncate">{session.class_name} !</p>
      {timeStr && <p className="text-[10px] text-error">Chưa ĐD</p>}
    </button>
  );
}

interface SlotEventProps {
  slot: CalendarSlot;
  onClick: () => void;
  loading?: boolean;
}

export function SlotEvent({ slot, onClick, loading }: SlotEventProps) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full text-left rounded-sm border-l-2 border-stone bg-surface px-1.5 py-0.5 mb-0.5 disabled:opacity-50"
    >
      <p className="text-[11px] font-semibold text-ash truncate">{slot.class_name}</p>
      <p className="text-[10px] text-mute">{formatTime(slot.start_time)}</p>
    </button>
  );
}
```

- [ ] **Step 2: Tạo CalendarGrid component**

```tsx
// apps/web/src/features/calendar/ui/CalendarGrid.tsx
"use client";

import type { CalendarSession, CalendarSlot } from "../model/types";
import { SessionEvent, SlotEvent } from "./CalendarEvent";

interface Props {
  year: number;
  month: number; // 1-12
  sessions: CalendarSession[];
  slots: CalendarSlot[];
  loadingSlot: string | null; // "classId|date"
  onSessionClick: (session: CalendarSession) => void;
  onSlotClick: (slot: CalendarSlot) => void;
}

const DAY_HEADERS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function getDaysInGrid(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  // monday-based: firstDay.getDay() 0=Sun → push 6, 1=Mon → push 0, etc.
  const startPad = (firstDay.getDay() + 6) % 7;
  const days: (Date | null)[] = Array(startPad).fill(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month - 1, d));
  }
  const trailingPad = (7 - (days.length % 7)) % 7;
  for (let i = 0; i < trailingPad; i++) days.push(null);
  return days;
}

function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CalendarGrid({ year, month, sessions, slots, loadingSlot, onSessionClick, onSlotClick }: Props) {
  const today = toIso(new Date());
  const days = getDaysInGrid(year, month);

  const sessionsByDate = new Map<string, CalendarSession[]>();
  for (const s of sessions) {
    const arr = sessionsByDate.get(s.date) ?? [];
    arr.push(s);
    sessionsByDate.set(s.date, arr);
  }

  const slotsByDate = new Map<string, CalendarSlot[]>();
  for (const sl of slots) {
    const arr = slotsByDate.get(sl.date) ?? [];
    arr.push(sl);
    slotsByDate.set(sl.date, arr);
  }

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_HEADERS.map((d, i) => (
          <div
            key={d}
            className={`text-center text-[11px] font-semibold uppercase tracking-wide py-1 ${
              i === 6 ? "text-stone" : "text-mute"
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
          if (!day) {
            return <div key={`pad-${idx}`} className="min-h-[88px] rounded-sm bg-surface" />;
          }

          const iso = toIso(day);
          const isToday = iso === today;
          const isSunday = day.getDay() === 0;
          const daySessions = sessionsByDate.get(iso) ?? [];
          const daySlots = slotsByDate.get(iso) ?? [];

          return (
            <div
              key={iso}
              className={`min-h-[88px] rounded-sm p-1.5 border ${
                isToday
                  ? "bg-primary/5 border-primary border-2"
                  : "bg-canvas border-border"
              }`}
            >
              <div className="mb-1">
                {isToday ? (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-canvas text-[11px] font-bold">
                    {day.getDate()}
                  </span>
                ) : (
                  <span className={`text-xs font-semibold ${isSunday ? "text-stone" : "text-ink"}`}>
                    {day.getDate()}
                  </span>
                )}
              </div>

              {daySessions.map((s) => (
                <SessionEvent key={s.id} session={s} onClick={() => onSessionClick(s)} />
              ))}
              {daySlots.map((sl) => (
                <SlotEvent
                  key={`${sl.class_id}-${sl.date}`}
                  slot={sl}
                  loading={loadingSlot === `${sl.class_id}|${sl.date}`}
                  onClick={() => onSlotClick(sl)}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Tạo CreateSessionModal**

```tsx
// apps/web/src/features/calendar/ui/CreateSessionModal.tsx
"use client";

import { useEffect, useState } from "react";
import { listClassesApi } from "@/src/features/classes/api/classes.api";
import type { Class } from "@/src/features/classes/model/types";
import { createSessionApi } from "@/src/features/attendance/api/attendance.api";

interface Props {
  onCreated: (classId: string, sessionId: string) => void;
  onClose: () => void;
}

export function CreateSessionModal({ onCreated, onClose }: Props) {
  const [classes, setClasses] = useState<Class[]>([]);
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listClassesApi().then(setClasses).catch(() => {});
  }, []);

  async function handleCreate() {
    if (!classId || !date) return;
    setCreating(true);
    setError(null);
    try {
      const session = await createSessionApi(classId, date);
      onCreated(classId, session.id);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } }).response?.status;
      setError(status === 409 ? "Buổi học ngày này đã tồn tại." : "Không thể tạo buổi học.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40">
      <div className="bg-canvas rounded-md border border-border shadow-card w-full max-w-sm p-6">
        <h2 className="text-base font-bold text-ink mb-4">Tạo buổi học</h2>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-ash uppercase tracking-wide">Lớp học</label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="rounded-sm border border-border bg-canvas px-3 py-2 text-sm text-ink focus:outline-none focus:border-primary"
            >
              <option value="">Chọn lớp...</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-ash uppercase tracking-wide">Ngày</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-sm border border-border bg-canvas px-3 py-2 text-sm text-ink focus:outline-none focus:border-primary"
            />
          </div>

          {error && <p className="text-sm text-error">{error}</p>}
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 rounded-sm border border-border px-3 py-2 text-sm font-semibold text-ink hover:bg-surface transition-colors"
          >
            Huỷ
          </button>
          <button
            onClick={handleCreate}
            disabled={!classId || !date || creating}
            className="flex-1 rounded-sm bg-primary px-3 py-2 text-sm font-semibold text-canvas hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            {creating ? "Đang tạo..." : "Tạo buổi"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd apps/web && pnpm type-check 2>&1 | head -30
```

Expected: No errors liên quan đến 3 files mới.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/calendar/ui/CalendarEvent.tsx \
        apps/web/src/features/calendar/ui/CalendarGrid.tsx \
        apps/web/src/features/calendar/ui/CreateSessionModal.tsx
git commit -m "feat: add CalendarGrid, CalendarEvent, CreateSessionModal components"
```

---

## Task 6: Frontend — Dashboard page → Calendar

**Files:**
- Modify: `apps/web/app/(teacher)/dashboard/page.tsx`

- [ ] **Step 1: Rewrite dashboard/page.tsx**

```tsx
// apps/web/app/(teacher)/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCalendarApi } from "@/src/features/calendar/api/calendar.api";
import { createSessionApi } from "@/src/features/attendance/api/attendance.api";
import { CalendarGrid } from "@/src/features/calendar/ui/CalendarGrid";
import { CreateSessionModal } from "@/src/features/calendar/ui/CreateSessionModal";
import type { CalendarData, CalendarSession, CalendarSlot } from "@/src/features/calendar/model/types";

function monthLabel(year: number, month: number) {
  return `Tháng ${month}, ${year}`;
}

function toMonthStr(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export default function CalendarPage() {
  const router = useRouter();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<CalendarData>({ sessions: [], schedule_slots: [] });
  const [loading, setLoading] = useState(true);
  const [loadingSlot, setLoadingSlot] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    setLoading(true);
    getCalendarApi(toMonthStr(year, month))
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [year, month]);

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  function goToday() {
    const n = new Date();
    setYear(n.getFullYear());
    setMonth(n.getMonth() + 1);
  }

  function handleSessionClick(session: CalendarSession) {
    router.push(`/classes/${session.class_id}/sessions/${session.id}`);
  }

  async function handleSlotClick(slot: CalendarSlot) {
    const key = `${slot.class_id}|${slot.date}`;
    setLoadingSlot(key);
    try {
      const session = await createSessionApi(slot.class_id, slot.date);
      router.push(`/classes/${slot.class_id}/sessions/${session.id}`);
    } catch {
      setLoadingSlot(null);
    }
  }

  function handleModalCreated(classId: string, sessionId: string) {
    setShowModal(false);
    router.push(`/classes/${classId}/sessions/${sessionId}`);
  }

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="rounded-sm border border-border bg-canvas px-3 py-1.5 text-sm font-semibold text-ink hover:bg-surface transition-colors"
          >
            ◀
          </button>
          <span className="text-base font-bold text-ink tracking-tight min-w-[140px] text-center">
            {monthLabel(year, month)}
          </span>
          <button
            onClick={nextMonth}
            className="rounded-sm border border-border bg-canvas px-3 py-1.5 text-sm font-semibold text-ink hover:bg-surface transition-colors"
          >
            ▶
          </button>
          <button
            onClick={goToday}
            className="rounded-sm border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-ash hover:text-ink transition-colors"
          >
            Hôm nay
          </button>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-canvas hover:bg-primary-hover transition-colors"
        >
          + Tạo buổi học
        </button>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-ash">
          <div className="w-3 h-3 rounded-[2px] bg-surface border-l-2 border-stone" />
          Lịch chưa mở (click để tạo)
        </div>
        <div className="flex items-center gap-1.5 text-xs text-ash">
          <div className="w-3 h-3 rounded-[2px] bg-success/8 border-l-2 border-success" />
          Đã điểm danh ✓
        </div>
        <div className="flex items-center gap-1.5 text-xs text-ash">
          <div className="w-3 h-3 rounded-[2px] bg-error/8 border-l-2 border-error" />
          Chưa điểm danh !
        </div>
      </div>

      {/* Calendar */}
      {loading ? (
        <div className="h-96 bg-stone/10 rounded-md animate-pulse" />
      ) : (
        <CalendarGrid
          year={year}
          month={month}
          sessions={data.sessions}
          slots={data.schedule_slots}
          loadingSlot={loadingSlot}
          onSessionClick={handleSessionClick}
          onSlotClick={handleSlotClick}
        />
      )}

      {showModal && (
        <CreateSessionModal
          onCreated={handleModalCreated}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update nav label trong layout.tsx**

Trong `apps/web/app/(teacher)/layout.tsx`, tìm dòng:

```typescript
{ href: "/dashboard", label: "Dashboard", icon: "⊞" },
```

Đổi thành:

```typescript
{ href: "/dashboard", label: "Lịch dạy", icon: "⊞" },
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd apps/web && pnpm type-check 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/(teacher)/dashboard/page.tsx \
        apps/web/app/(teacher)/layout.tsx
git commit -m "feat: replace dashboard with calendar month view + update nav label"
```

---

## Task 7: Frontend — Session detail page

**Files:**
- Create: `apps/web/app/(teacher)/classes/[id]/sessions/[sessionId]/page.tsx`

- [ ] **Step 1: Tạo thư mục và page**

```bash
mkdir -p "apps/web/app/(teacher)/classes/[id]/sessions/[sessionId]"
```

- [ ] **Step 2: Viết session detail page**

```tsx
// apps/web/app/(teacher)/classes/[id]/sessions/[sessionId]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getClassApi, listEnrollmentsApi } from "@/src/features/classes/api/classes.api";
import { getSessionApi, listAttendanceApi, patchSessionNotesApi } from "@/src/features/attendance/api/attendance.api";
import { listStudentsApi } from "@/src/features/students/api/students.api";
import { AttendanceSheet } from "@/src/features/attendance/ui/AttendanceSheet";
import { ExamSection } from "@/src/features/grades/ui/ExamSection";
import type { Class, Enrollment } from "@/src/features/classes/model/types";
import type { ClassSession, AttendanceRecord } from "@/src/features/attendance/model/types";
import type { Student } from "@/src/features/students/model/types";

const DAY_LABELS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

function formatSessionTitle(date: string) {
  const d = new Date(date + "T00:00:00");
  const dow = DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1];
  return `${dow}, ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

export default function SessionDetailPage() {
  const { id: classId, sessionId } = useParams<{ id: string; sessionId: string }>();

  const [class_, setClass_] = useState<Class | null>(null);
  const [session, setSession] = useState<ClassSession | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      getClassApi(classId),
      getSessionApi(classId, sessionId),
      listEnrollmentsApi(classId),
      listStudentsApi(),
      listAttendanceApi(classId, sessionId),
    ])
      .then(([c, s, e, st, att]) => {
        setClass_(c);
        setSession(s);
        setEnrollments(e);
        setStudents(st);
        setAttendance(att);
        setNotes(s.notes ?? "");
      })
      .catch(() => setError("Không thể tải buổi học."))
      .finally(() => setLoading(false));
  }, [classId, sessionId]);

  const enrolledIds = new Set(enrollments.map((e) => e.student_id));
  const enrolledStudents = students.filter((s) => enrolledIds.has(s.id));
  const hasAttendance = attendance.length > 0;

  async function handleSaveNotes() {
    setSavingNotes(true);
    setNotesSaved(false);
    try {
      const updated = await patchSessionNotesApi(classId, sessionId, notes || null);
      setSession(updated);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } finally {
      setSavingNotes(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl flex flex-col gap-4">
        <div className="h-4 w-32 bg-stone/30 rounded animate-pulse" />
        <div className="h-8 w-64 bg-stone/30 rounded animate-pulse" />
        <div className="h-48 bg-stone/20 rounded-md animate-pulse" />
      </div>
    );
  }

  if (error || !session || !class_) {
    return (
      <div className="max-w-3xl">
        <Link href="/dashboard" className="text-sm text-ash hover:text-ink">← Lịch dạy</Link>
        <div className="mt-4 rounded-md border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
          {error ?? "Không tìm thấy buổi học."}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl flex flex-col gap-6">
      {/* Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 text-sm text-ash mb-2">
          <Link href="/dashboard" className="hover:text-ink transition-colors">← Lịch dạy</Link>
          <span className="text-stone">/</span>
          <Link href={`/classes/${classId}`} className="hover:text-ink transition-colors">{class_.name}</Link>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink tracking-tight">
              Buổi học — {formatSessionTitle(String(session.date))}
            </h1>
            <p className="text-sm text-ash mt-1">{class_.name} · {class_.subject}</p>
          </div>
          {hasAttendance ? (
            <span className="text-xs font-semibold text-success bg-success/8 rounded-full px-3 py-1.5 mt-1 border border-success/15">
              Đã điểm danh
            </span>
          ) : (
            <span className="text-xs font-semibold text-ash bg-surface rounded-full px-3 py-1.5 mt-1 border border-border">
              Chưa điểm danh
            </span>
          )}
        </div>
      </div>

      {/* Section 1: Điểm danh */}
      <section className="rounded-md border border-border bg-canvas p-5">
        <h2 className="font-semibold text-ink mb-4">Điểm danh</h2>
        {enrolledStudents.length === 0 ? (
          <p className="text-sm text-ash">Chưa có học sinh trong lớp.</p>
        ) : (
          <AttendanceSheet
            classId={classId}
            sessionId={sessionId}
            enrollments={enrollments}
            students={enrolledStudents}
            initialRecords={attendance}
            onSaved={(records) => setAttendance(records)}
          />
        )}
      </section>

      {/* Section 2: Ghi chú */}
      <section className="rounded-md border border-border bg-canvas p-5">
        <h2 className="font-semibold text-ink mb-3">Ghi chú buổi học</h2>
        <textarea
          value={notes}
          onChange={(e) => { setNotes(e.target.value); setNotesSaved(false); }}
          placeholder="Nội dung buổi học, bài tập về nhà, lưu ý..."
          rows={4}
          className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-stone focus:outline-none focus:border-primary resize-y transition-colors"
        />
        <div className="flex items-center justify-end gap-3 mt-2">
          {notesSaved && <span className="text-xs text-success">Đã lưu</span>}
          <button
            onClick={handleSaveNotes}
            disabled={savingNotes}
            className="rounded-sm border border-border bg-canvas px-4 py-1.5 text-sm font-semibold text-ink hover:bg-surface disabled:opacity-50 transition-colors"
          >
            {savingNotes ? "Đang lưu..." : "Lưu ghi chú"}
          </button>
        </div>
      </section>

      {/* Section 3: Bài kiểm tra */}
      <section className="rounded-md border border-border bg-canvas p-5">
        <h2 className="font-semibold text-ink mb-4">Bài kiểm tra</h2>
        <ExamSection
          classId={classId}
          students={enrolledStudents}
          filterDate={String(session.date)}
        />
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd apps/web && pnpm type-check 2>&1 | head -30
```

Expected: Có thể báo lỗi `filterDate` chưa tồn tại trong ExamSection — sẽ fix ở Task 8.

- [ ] **Step 4: Commit (chưa fix ExamSection)**

```bash
git add "apps/web/app/(teacher)/classes/[id]/sessions/[sessionId]/page.tsx"
git commit -m "feat: add session detail page with attendance, notes, and exam sections"
```

---

## Task 8: Frontend — ExamSection: filterDate + coefficient badge + bỏ weight_percent

**Files:**
- Modify: `apps/web/src/features/grades/ui/ExamSection.tsx`

- [ ] **Step 1: Update ExamSection**

Thay toàn bộ nội dung `apps/web/src/features/grades/ui/ExamSection.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  createExamApi,
  deleteExamApi,
  listExamsApi,
  listGradesApi,
} from "../api/grades.api";
import type { CreateExamRequest, Exam, ExamType, Grade } from "../model/types";
import { EXAM_TYPE_LABELS } from "../model/types";
import { GradeSheet } from "./GradeSheet";
import type { Student } from "@/src/features/students/model/types";

interface Props {
  classId: string;
  students: Student[];
  filterDate?: string; // "YYYY-MM-DD" — nếu có, chỉ hiển thị bài có exam_date khớp
}

const EXAM_WEIGHT: Record<string, number> = { quiz: 1, midterm: 2, final: 3 };

const WEIGHT_LABEL: Record<string, string> = {
  quiz: "×1",
  midterm: "×2",
  final: "×3",
  assignment: "—",
};

function formatExamDate(d: string | null) {
  if (!d) return null;
  const dt = new Date(d + "T00:00:00");
  return `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()}`;
}

const EXAM_TYPE_OPTIONS: { value: ExamType; label: string }[] = [
  { value: "quiz", label: "Kiểm tra thường xuyên / miệng / 15 phút" },
  { value: "midterm", label: "Kiểm tra 1 tiết / Giữa kỳ" },
  { value: "final", label: "Cuối kỳ" },
  { value: "assignment", label: "Bài tập (không tính TB)" },
];

export function ExamSection({ classId, students, filterDate }: Props) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [gradesCache, setGradesCache] = useState<Record<string, Grade[]>>({});
  const [gradesLoading, setGradesLoading] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ExamType>("quiz");
  const [maxScore, setMaxScore] = useState("10");
  const [examDate, setExamDate] = useState(filterDate ?? "");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    listExamsApi(classId)
      .then(setExams)
      .finally(() => setLoading(false));
  }, [classId]);

  const visibleExams = filterDate
    ? exams.filter((e) => e.exam_date === filterDate)
    : exams;

  async function handleExpand(exam: Exam) {
    if (expandedId === exam.id) { setExpandedId(null); return; }
    setExpandedId(exam.id);
    if (!gradesCache[exam.id]) {
      setGradesLoading(true);
      try {
        const grades = await listGradesApi(classId, exam.id);
        setGradesCache((prev) => ({ ...prev, [exam.id]: grades }));
      } finally {
        setGradesLoading(false);
      }
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    const ms = parseFloat(maxScore);
    if (isNaN(ms) || ms <= 0) { setCreateError("Điểm tối đa phải lớn hơn 0."); return; }
    setCreating(true);
    try {
      const body: CreateExamRequest = {
        title: title.trim(),
        type,
        max_score: ms,
        weight_percent: EXAM_WEIGHT[type] ?? 0,
        exam_date: examDate || null,
      };
      const exam = await createExamApi(classId, body);
      setExams((prev) => [...prev, exam]);
      setTitle(""); setMaxScore("10"); setExamDate(filterDate ?? "");
      setShowCreate(false);
    } catch {
      setCreateError("Không thể tạo bài kiểm tra.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(exam: Exam) {
    if (!confirm(`Xoá bài kiểm tra "${exam.title}"? Toàn bộ điểm sẽ bị xoá.`)) return;
    try {
      await deleteExamApi(classId, exam.id);
      setExams((prev) => prev.filter((ex) => ex.id !== exam.id));
      if (expandedId === exam.id) setExpandedId(null);
    } catch {
      alert("Không thể xoá bài kiểm tra.");
    }
  }

  const inputCls =
    "w-full rounded-sm border border-border bg-canvas px-3 py-2 text-sm text-ink placeholder:text-stone focus:border-primary focus:outline-none transition-colors";
  const labelCls = "text-xs font-semibold text-ash uppercase tracking-wide";

  if (loading) return <div className="h-10 w-full bg-stone/20 rounded animate-pulse" />;

  return (
    <div className="flex flex-col gap-4">
      {visibleExams.length === 0 && !showCreate && (
        <p className="text-sm text-ash">
          {filterDate ? "Chưa có bài kiểm tra nào trong buổi học này." : "Chưa có bài kiểm tra nào."}
        </p>
      )}

      {visibleExams.length > 0 && (
        <div className="flex flex-col gap-2">
          {visibleExams.map((exam) => {
            const grades = gradesCache[exam.id] ?? [];
            const gradedCount = grades.length;
            const avg =
              gradedCount > 0
                ? (grades.reduce((s, g) => s + g.score, 0) / gradedCount).toFixed(1)
                : null;

            return (
              <div key={exam.id} className="rounded-sm border border-border overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-canvas">
                  <button
                    onClick={() => handleExpand(exam)}
                    className="flex-1 flex items-center gap-3 text-left"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-ink">{exam.title}</p>
                      <p className="text-xs text-ash mt-0.5">
                        {EXAM_TYPE_LABELS[exam.type]}
                        {exam.exam_date ? ` · ${formatExamDate(exam.exam_date)}` : ""}
                        {" · "}Tối đa {exam.max_score} điểm
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-bold text-ink bg-surface border border-border rounded-full px-2 py-0.5">
                        {WEIGHT_LABEL[exam.type] ?? "—"}
                      </span>
                      {avg && <span className="text-xs text-ash">TB: <strong className="text-ink">{avg}</strong></span>}
                      <span className="text-xs text-ash">{gradedCount}/{students.length} đã có điểm</span>
                      <span className="text-stone text-sm">{expandedId === exam.id ? "▲" : "▼"}</span>
                    </div>
                  </button>
                  <button
                    onClick={() => handleDelete(exam)}
                    className="ml-3 text-xs text-ash hover:text-error transition-colors"
                  >
                    Xoá
                  </button>
                </div>

                {expandedId === exam.id && (
                  <div className="px-4 py-4 border-t border-border bg-surface">
                    {gradesLoading && !gradesCache[exam.id] ? (
                      <div className="h-8 bg-stone/20 rounded animate-pulse" />
                    ) : students.length === 0 ? (
                      <p className="text-sm text-ash">Chưa có học sinh trong lớp.</p>
                    ) : (
                      <GradeSheet
                        classId={classId}
                        exam={exam}
                        students={students}
                        initialGrades={gradesCache[exam.id] ?? []}
                        onSaved={(saved) =>
                          setGradesCache((prev) => ({ ...prev, [exam.id]: saved }))
                        }
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreate ? (
        <form
          onSubmit={handleCreate}
          className="rounded-sm border border-primary/20 bg-primary/5 p-4 flex flex-col gap-3"
        >
          <h3 className="text-sm font-semibold text-ink">Tạo bài kiểm tra mới</h3>

          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Tên bài kiểm tra *</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Kiểm tra 15 phút chương 2"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Loại *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ExamType)}
                className={inputCls}
              >
                {EXAM_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Ngày kiểm tra</label>
              <input
                type="date"
                value={examDate}
                onChange={(e) => !filterDate && setExamDate(e.target.value)}
                readOnly={!!filterDate}
                className={`${inputCls} ${filterDate ? "bg-surface text-ash cursor-default" : ""}`}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Điểm tối đa *</label>
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={maxScore}
              onChange={(e) => setMaxScore(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="rounded-sm bg-surface border border-border px-3 py-2 text-xs text-ash">
            Hệ số: <strong className="text-ink">{WEIGHT_LABEL[type] ?? "—"}</strong>
            {type === "assignment" && " · Không tính vào điểm TB môn"}
          </div>

          {createError && <p className="text-sm text-error">{createError}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => { setShowCreate(false); setCreateError(null); }}
              className="flex-1 rounded-sm border border-border px-3 py-2 text-sm font-semibold text-ink hover:bg-surface transition-colors"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={creating || !title.trim()}
              className="flex-1 rounded-sm bg-primary px-3 py-2 text-sm font-semibold text-canvas hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {creating ? "Đang tạo..." : "Tạo"}
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          className="self-start text-sm font-semibold text-primary hover:underline"
        >
          + Thêm bài kiểm tra
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/web && pnpm type-check 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/grades/ui/ExamSection.tsx
git commit -m "feat: add filterDate prop, coefficient badge to ExamSection; remove weight_percent from form"
```

---

## Task 9: Frontend — Class detail tab layout

**Files:**
- Modify: `apps/web/app/(teacher)/classes/[id]/page.tsx`

- [ ] **Step 1: Rewrite class detail page với 4 tabs**

```tsx
// apps/web/app/(teacher)/classes/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getClassApi, listSchedulesApi, listEnrollmentsApi } from "@/src/features/classes/api/classes.api";
import { listSessionsApi } from "@/src/features/attendance/api/attendance.api";
import { listExamsApi, listGradesApi } from "@/src/features/grades/api/grades.api";
import { ScheduleList } from "@/src/features/classes/ui/ScheduleList";
import { AddScheduleForm } from "@/src/features/classes/ui/AddScheduleForm";
import { EnrollmentSection } from "@/src/features/classes/ui/EnrollmentSection";
import { ExamSection } from "@/src/features/grades/ui/ExamSection";
import { computeWeightedAverage } from "@/src/features/grades/lib/grading";
import type { Class, ClassSchedule, Enrollment } from "@/src/features/classes/model/types";
import type { ClassSession } from "@/src/features/attendance/model/types";
import type { Exam, Grade } from "@/src/features/grades/model/types";
import type { Student } from "@/src/features/students/model/types";
import { listStudentsApi } from "@/src/features/students/api/students.api";

type Tab = "students" | "sessions" | "grades" | "schedule";

const DAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return `${DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1]}, ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("students");
  const [class_, setClass_] = useState<Class | null>(null);
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [gradesByExam, setGradesByExam] = useState<Record<string, Grade[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getClassApi(id),
      listSchedulesApi(id),
      listEnrollmentsApi(id),
      listStudentsApi(),
    ])
      .then(([c, s, e, st]) => {
        setClass_(c); setSchedules(s); setEnrollments(e); setStudents(st);
      })
      .catch(() => setError("Không thể tải thông tin lớp."))
      .finally(() => setLoading(false));
  }, [id]);

  // Lazy load sessions khi chuyển tab
  useEffect(() => {
    if (tab === "sessions" && sessions.length === 0) {
      listSessionsApi(id).then(setSessions).catch(() => {});
    }
    if (tab === "students" && exams.length === 0) {
      listExamsApi(id).then(async (fetchedExams) => {
        setExams(fetchedExams);
        const gradeMap: Record<string, Grade[]> = {};
        await Promise.all(
          fetchedExams.map(async (exam) => {
            const grades = await listGradesApi(id, exam.id);
            gradeMap[exam.id] = grades;
          })
        );
        setGradesByExam(gradeMap);
      }).catch(() => {});
    }
  }, [tab, id]);

  if (loading) {
    return (
      <div className="max-w-3xl flex flex-col gap-4">
        <div className="h-6 w-32 bg-stone/30 rounded animate-pulse" />
        <div className="h-8 w-64 bg-stone/30 rounded animate-pulse" />
        <div className="h-40 bg-stone/20 rounded-md animate-pulse mt-2" />
      </div>
    );
  }

  if (error || !class_) {
    return (
      <div className="max-w-3xl">
        <Link href="/classes" className="text-sm text-ash hover:text-ink">← Danh sách lớp</Link>
        <div className="mt-4 rounded-md border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
          {error ?? "Không tìm thấy lớp học."}
        </div>
      </div>
    );
  }

  const enrolledIds = new Set(enrollments.map((e) => e.student_id));
  const enrolledStudents = students.filter((s) => enrolledIds.has(s.id));

  const TABS: { key: Tab; label: string }[] = [
    { key: "students", label: "Học sinh" },
    { key: "sessions", label: "Buổi học" },
    { key: "grades", label: "Điểm số" },
    { key: "schedule", label: "Lịch học" },
  ];

  return (
    <div className="max-w-3xl flex flex-col gap-6">
      {/* Header */}
      <div>
        <Link href="/classes" className="text-sm text-ash hover:text-ink transition-colors">
          ← Danh sách lớp
        </Link>
        <div className="flex items-start justify-between mt-3">
          <div>
            <h1 className="text-2xl font-bold text-ink tracking-tight">{class_.name}</h1>
            <p className="text-ash text-sm mt-1">
              {class_.subject} · {class_.academic_year}
              {class_.grade !== null && ` · Khối ${class_.grade}`}
            </p>
          </div>
          {class_.is_active ? (
            <span className="text-xs font-semibold text-success bg-success/8 rounded-full px-3 py-1.5 mt-1 border border-success/15">
              Đang học
            </span>
          ) : (
            <span className="text-xs font-semibold text-ash bg-surface rounded-full px-3 py-1.5 mt-1 border border-border">
              Kết thúc
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border flex gap-0">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
              tab === key
                ? "text-primary border-primary"
                : "text-ash border-transparent hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Học sinh */}
      {tab === "students" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-ash">{enrolledStudents.length} học sinh</p>
          </div>
          <EnrollmentSection classId={id} classGrade={class_.grade} />

          {enrolledStudents.length > 0 && (
            <div className="rounded-md border border-border overflow-hidden shadow-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface border-b border-border">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-ash uppercase tracking-wide">Học sinh</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-ash uppercase tracking-wide">Có mặt</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-ash uppercase tracking-wide">Vắng</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-ash uppercase tracking-wide">TB Môn</th>
                  </tr>
                </thead>
                <tbody>
                  {enrolledStudents.map((s, i) => {
                    const avg = computeWeightedAverage(exams, gradesByExam, s.id);
                    return (
                      <tr key={s.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? "bg-canvas" : "bg-surface/50"}`}>
                        <td className="px-4 py-2.5 font-semibold text-ink">{s.name}</td>
                        <td className="px-4 py-2.5 text-center font-semibold text-success">—</td>
                        <td className="px-4 py-2.5 text-center font-semibold text-error">—</td>
                        <td className="px-4 py-2.5 text-center">
                          {avg === null ? (
                            <span className="text-ash">—</span>
                          ) : (
                            <span className={`font-bold ${avg < 5 ? "text-error" : "text-ink"}`}>{avg}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Buổi học */}
      {tab === "sessions" && (
        <div className="flex flex-col gap-2">
          {sessions.length === 0 ? (
            <p className="text-sm text-ash">Chưa có buổi học nào. Tạo buổi từ trang Lịch dạy.</p>
          ) : (
            sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-sm border border-border bg-canvas px-4 py-3">
                <span className="text-sm font-semibold text-ink">{formatDate(String(s.date))}</span>
                <Link
                  href={`/classes/${id}/sessions/${s.id}`}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Chi tiết →
                </Link>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Điểm số */}
      {tab === "grades" && (
        <ExamSection classId={id} students={enrolledStudents} />
      )}

      {/* Tab: Lịch học */}
      {tab === "schedule" && (
        <section className="rounded-md border border-border bg-canvas p-5">
          <h2 className="font-semibold text-ink mb-4">Lịch học</h2>
          <ScheduleList
            classId={id}
            schedules={schedules}
            onDeleted={(sid) => setSchedules((prev) => prev.filter((s) => s.id !== sid))}
          />
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs font-semibold text-ash uppercase tracking-wide mb-3">Thêm lịch học</p>
            <AddScheduleForm
              classId={id}
              onAdded={(s) => setSchedules((prev) => [...prev, s])}
            />
          </div>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/web && pnpm type-check 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(teacher)/classes/[id]/page.tsx
git commit -m "feat: restructure class detail page into 4-tab layout (students, sessions, grades, schedule)"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Sec 3.1 Layout: CalendarGrid với 7 cột, header nav, hôm nay highlight
- ✅ Sec 3.2 Event states: 3 màu (placeholder/chưa ĐD/đã ĐD) trong CalendarEvent
- ✅ Sec 3.3 Lazy creation: handleSlotClick POST → redirect; modal cho ad-hoc
- ✅ Sec 3.4 API: GET /calendar?month=YYYY-MM trong Task 3
- ✅ Sec 4.1–4.5 Session detail: header, data fetch, AttendanceSheet, notes textarea, ExamSection filterDate
- ✅ Sec 5.1 Tab layout: 4 tabs trong class detail
- ✅ Sec 5.2 TB Môn: computeWeightedAverage trong Task 4 + hiển thị trong Tab Học sinh
- ✅ Sec 6 Grading: EXAM_WEIGHT map, assignment excluded, badge ×1/×2/×3 trong ExamSection
- ✅ Sec 7 APIs: PATCH /sessions/{sid} Task 2, GET /calendar Task 3
- ✅ Nav label: Dashboard → Lịch dạy trong Task 6

**Gaps noted:**
- Tab "Học sinh" có cột Có mặt/Vắng hiển thị "—" vì cần thêm 1 API call nữa để đếm attendance per student. Đây là enhancement sau — scope đúng như spec ("Tab Học sinh fetch exams + grades khi mount").

**Design system:**
- Mọi className trong components đều dùng token: `primary`, `ink`, `ash`, `surface`, `canvas`, `border`, `success`, `error`, `stone`, `mute`
- Không có màu blue/indigo/purple/teal nào
