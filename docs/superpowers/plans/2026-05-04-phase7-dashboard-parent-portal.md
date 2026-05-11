# Phase 7: Teacher Dashboard + Parent Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a live Teacher Dashboard with today's schedule and quick stats, and build a read-only Parent Portal for parents to view their child's grades and attendance.

**Architecture:** Backend uses clean architecture — new use cases query existing DB models via raw AsyncSession (acceptable for aggregate reads that span multiple tables). Frontend follows Feature-Sliced Design with new `dashboard` and `parent` features under `src/features/`. No new DB migrations needed.

**Tech Stack:** FastAPI + SQLAlchemy 2.0 async (backend), Next.js 15 + React 18 + Zustand + Axios (frontend), Tailwind custom tokens.

---

## File Map

**New backend files:**
- `apps/api/app/domain/entities/dashboard.py`
- `apps/api/app/application/use_cases/dashboard/__init__.py`
- `apps/api/app/application/use_cases/dashboard/get_teacher_dashboard.py`
- `apps/api/app/interfaces/api/v1/schemas/dashboard.py`
- `apps/api/app/interfaces/api/v1/routers/dashboard.py`
- `apps/api/app/domain/entities/parent.py`
- `apps/api/app/application/use_cases/parent/__init__.py`
- `apps/api/app/application/use_cases/parent/get_children.py`
- `apps/api/app/application/use_cases/parent/get_child_grades.py`
- `apps/api/app/application/use_cases/parent/get_child_attendance.py`
- `apps/api/app/interfaces/api/v1/schemas/parent.py`
- `apps/api/app/interfaces/api/v1/routers/parent.py`
- `apps/api/tests/test_dashboard.py`
- `apps/api/tests/test_parent.py`

**Modified backend files:**
- `apps/api/app/main.py` — add dashboard + parent routers

**New frontend files:**
- `apps/web/src/features/dashboard/model/types.ts`
- `apps/web/src/features/dashboard/api/dashboard.api.ts`
- `apps/web/src/features/parent/model/types.ts`
- `apps/web/src/features/parent/api/parent.api.ts`
- `apps/web/app/(auth)/login/parent/page.tsx`
- `apps/web/app/(parent)/home/page.tsx`
- `apps/web/app/(parent)/grades/page.tsx`
- `apps/web/app/(parent)/attendance/page.tsx`

**Modified frontend files:**
- `apps/web/app/(teacher)/dashboard/page.tsx` — replace static with dynamic
- `apps/web/app/(parent)/layout.tsx` — add auth guard + wired bottom nav

---

## Task 1: Backend — Dashboard API

**Files:**
- Create: `apps/api/app/domain/entities/dashboard.py`
- Create: `apps/api/app/application/use_cases/dashboard/__init__.py`
- Create: `apps/api/app/application/use_cases/dashboard/get_teacher_dashboard.py`
- Create: `apps/api/app/interfaces/api/v1/schemas/dashboard.py`
- Create: `apps/api/app/interfaces/api/v1/routers/dashboard.py`
- Modify: `apps/api/app/main.py`
- Create: `apps/api/tests/test_dashboard.py`

- [ ] **Step 1: Write domain entities**

Create `apps/api/app/domain/entities/dashboard.py`:

```python
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, time
from uuid import UUID


@dataclass
class TodayClass:
    class_id: UUID
    class_name: str
    subject: str
    start_time: time
    end_time: time


@dataclass
class PendingSession:
    session_id: UUID
    class_id: UUID
    class_name: str
    date: date


@dataclass
class DashboardSummary:
    active_classes_count: int
    total_students_count: int
    today_schedule: list[TodayClass]
    pending_sessions: list[PendingSession]
```

- [ ] **Step 2: Write the use case**

Create `apps/api/app/application/use_cases/dashboard/__init__.py` (empty).

Create `apps/api/app/application/use_cases/dashboard/get_teacher_dashboard.py`:

```python
from __future__ import annotations

from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.dashboard import DashboardSummary, PendingSession, TodayClass
from app.infrastructure.db.models.attendance import AttendanceRecordModel, ClassSessionModel
from app.infrastructure.db.models.class_ import ClassModel, ClassScheduleModel, EnrollmentModel


class GetTeacherDashboardUseCase:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def execute(self, teacher_id: UUID, org_id: UUID) -> DashboardSummary:
        # 1. Active classes taught by this teacher
        classes_q = await self._session.execute(
            select(ClassModel).where(
                ClassModel.teacher_id == teacher_id,
                ClassModel.organization_id == org_id,
                ClassModel.is_active.is_(True),
                ClassModel.deleted_at.is_(None),
            )
        )
        active_classes = list(classes_q.scalars())
        class_ids = [c.id for c in active_classes]
        class_meta: dict[UUID, tuple[str, str]] = {c.id: (c.name, c.subject) for c in active_classes}

        # 2. Unique enrolled students
        if class_ids:
            count_q = await self._session.execute(
                select(func.count(func.distinct(EnrollmentModel.student_id))).where(
                    EnrollmentModel.class_id.in_(class_ids)
                )
            )
            total_students: int = count_q.scalar_one()
        else:
            total_students = 0

        # 3. Today's schedule (matches weekday 0=Mon…6=Sun)
        if class_ids:
            today_dow = date.today().weekday()
            sched_q = await self._session.execute(
                select(ClassScheduleModel).where(
                    ClassScheduleModel.class_id.in_(class_ids),
                    ClassScheduleModel.day_of_week == today_dow,
                ).order_by(ClassScheduleModel.start_time)
            )
            today_schedule = [
                TodayClass(
                    class_id=r.class_id,
                    class_name=class_meta[r.class_id][0],
                    subject=class_meta[r.class_id][1],
                    start_time=r.start_time,
                    end_time=r.end_time,
                )
                for r in sched_q.scalars()
            ]
        else:
            today_schedule = []

        # 4. Sessions in last 7 days with no attendance records yet
        if class_ids:
            seven_days_ago = date.today() - timedelta(days=7)
            pending_q = await self._session.execute(
                select(ClassSessionModel).where(
                    ClassSessionModel.class_id.in_(class_ids),
                    ClassSessionModel.date >= seven_days_ago,
                    ~select(AttendanceRecordModel.id)
                    .where(AttendanceRecordModel.session_id == ClassSessionModel.id)
                    .correlate(ClassSessionModel)
                    .exists(),
                ).order_by(ClassSessionModel.date.desc()).limit(5)
            )
            pending_sessions = [
                PendingSession(
                    session_id=r.id,
                    class_id=r.class_id,
                    class_name=class_meta[r.class_id][0],
                    date=r.date,
                )
                for r in pending_q.scalars()
            ]
        else:
            pending_sessions = []

        return DashboardSummary(
            active_classes_count=len(active_classes),
            total_students_count=total_students,
            today_schedule=today_schedule,
            pending_sessions=pending_sessions,
        )
```

- [ ] **Step 3: Write schemas**

Create `apps/api/app/interfaces/api/v1/schemas/dashboard.py`:

```python
from __future__ import annotations

from datetime import date, time
from uuid import UUID

from pydantic import BaseModel


class TodayClassSchema(BaseModel):
    class_id: UUID
    class_name: str
    subject: str
    start_time: time
    end_time: time

    model_config = {"from_attributes": True}


class PendingSessionSchema(BaseModel):
    session_id: UUID
    class_id: UUID
    class_name: str
    date: date

    model_config = {"from_attributes": True}


class DashboardSummarySchema(BaseModel):
    active_classes_count: int
    total_students_count: int
    today_schedule: list[TodayClassSchema]
    pending_sessions: list[PendingSessionSchema]

    model_config = {"from_attributes": True}
```

- [ ] **Step 4: Write the router**

Create `apps/api/app/interfaces/api/v1/routers/dashboard.py`:

```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.dashboard.get_teacher_dashboard import GetTeacherDashboardUseCase
from app.infrastructure.db.session import get_db
from app.interfaces.api.v1.dependencies import require_role
from app.interfaces.api.v1.schemas.dashboard import DashboardSummarySchema

router = APIRouter()
_teacher = require_role("teacher", "admin")


@router.get("/dashboard", response_model=DashboardSummarySchema)
async def get_dashboard(
    token=Depends(_teacher),
    db: AsyncSession = Depends(get_db),
):
    uc = GetTeacherDashboardUseCase(db)
    return await uc.execute(token.user_id, token.org_id)
```

- [ ] **Step 5: Register router in main.py**

In `apps/api/app/main.py`, after the exams router block, append:

```python
from app.interfaces.api.v1.routers import dashboard  # noqa: E402

app.include_router(dashboard.router, prefix="/api/v1", tags=["dashboard"])
```

- [ ] **Step 6: Write failing tests**

Create `apps/api/tests/test_dashboard.py`:

```python
import uuid
from datetime import date, time, timedelta
from unittest.mock import AsyncMock, patch

from httpx import AsyncClient

from app.domain.entities.dashboard import DashboardSummary, PendingSession, TodayClass
from app.infrastructure.security.jwt import TokenData
from app.interfaces.api.v1.dependencies import get_current_user
from app.main import app

_ORG_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")
_TEACHER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
_CLASS_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")
_SESSION_ID = uuid.UUID("00000000-0000-0000-0000-000000000020")
_TOKEN = TokenData(user_id=_TEACHER_ID, org_id=_ORG_ID, role="teacher", jti="j", exp=9999999999)

_SUMMARY = DashboardSummary(
    active_classes_count=3,
    total_students_count=12,
    today_schedule=[
        TodayClass(
            class_id=_CLASS_ID,
            class_name="Toán 10A",
            subject="Toán",
            start_time=time(8, 0),
            end_time=time(10, 0),
        )
    ],
    pending_sessions=[
        PendingSession(
            session_id=_SESSION_ID,
            class_id=_CLASS_ID,
            class_name="Toán 10A",
            date=date.today() - timedelta(days=1),
        )
    ],
)


async def _override():
    return _TOKEN


async def test_get_dashboard(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch(
            "app.interfaces.api.v1.routers.dashboard.GetTeacherDashboardUseCase"
        ) as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=_SUMMARY)
            resp = await client.get(
                "/api/v1/dashboard",
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 200
        body = resp.json()
        assert body["active_classes_count"] == 3
        assert body["total_students_count"] == 12
        assert len(body["today_schedule"]) == 1
        assert body["today_schedule"][0]["class_name"] == "Toán 10A"
        assert len(body["pending_sessions"]) == 1
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_dashboard_forbidden_for_parent(client: AsyncClient):
    parent_token = TokenData(
        user_id=uuid.uuid4(), org_id=_ORG_ID, role="parent", jti="j2", exp=9999999999
    )

    async def _parent_override():
        return parent_token

    app.dependency_overrides[get_current_user] = _parent_override
    try:
        resp = await client.get(
            "/api/v1/dashboard",
            headers={"Authorization": "Bearer fake"},
        )
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)
```

- [ ] **Step 7: Run tests**

```bash
cd /Users/nals_macbook_303/Documents/NALS/04.Learning/School-Management/apps/api
docker compose exec api pytest tests/test_dashboard.py -v
```

Expected: 2 PASSED

- [ ] **Step 8: Commit**

```bash
cd /Users/nals_macbook_303/Documents/NALS/04.Learning/School-Management
git add apps/api/app/domain/entities/dashboard.py \
        apps/api/app/application/use_cases/dashboard/ \
        apps/api/app/interfaces/api/v1/schemas/dashboard.py \
        apps/api/app/interfaces/api/v1/routers/dashboard.py \
        apps/api/app/main.py \
        apps/api/tests/test_dashboard.py
git commit -m "feat: add teacher dashboard API endpoint with stats, today schedule, pending sessions"
```

---

## Task 2: Backend — Parent Portal API

**Files:**
- Create: `apps/api/app/domain/entities/parent.py`
- Create: `apps/api/app/application/use_cases/parent/__init__.py`
- Create: `apps/api/app/application/use_cases/parent/get_children.py`
- Create: `apps/api/app/application/use_cases/parent/get_child_grades.py`
- Create: `apps/api/app/application/use_cases/parent/get_child_attendance.py`
- Create: `apps/api/app/interfaces/api/v1/schemas/parent.py`
- Create: `apps/api/app/interfaces/api/v1/routers/parent.py`
- Modify: `apps/api/app/main.py`
- Create: `apps/api/tests/test_parent.py`

- [ ] **Step 1: Write domain entities**

Create `apps/api/app/domain/entities/parent.py`:

```python
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from uuid import UUID


@dataclass
class ChildClass:
    class_id: UUID
    name: str
    subject: str
    academic_year: str
    is_active: bool


@dataclass
class ChildInfo:
    student_id: UUID
    student_name: str
    date_of_birth: date | None
    classes: list[ChildClass]


@dataclass
class ChildGradeRow:
    exam_id: UUID
    class_id: UUID
    class_name: str
    exam_title: str
    exam_type: str
    exam_date: date | None
    max_score: float
    score: float | None
    note: str | None


@dataclass
class ChildAttendanceRow:
    session_id: UUID
    class_id: UUID
    class_name: str
    date: date
    status: str | None   # None = not yet marked
    note: str | None
```

- [ ] **Step 2: Write get_children use case**

Create `apps/api/app/application/use_cases/parent/__init__.py` (empty).

Create `apps/api/app/application/use_cases/parent/get_children.py`:

```python
from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.parent import ChildClass, ChildInfo
from app.infrastructure.db.models.class_ import ClassModel, EnrollmentModel
from app.infrastructure.db.models.student import StudentModel


class GetChildrenUseCase:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def execute(self, parent_id: UUID, org_id: UUID) -> list[ChildInfo]:
        students_q = await self._session.execute(
            select(StudentModel).where(
                StudentModel.parent_id == parent_id,
                StudentModel.organization_id == org_id,
                StudentModel.deleted_at.is_(None),
            ).order_by(StudentModel.name)
        )
        students = list(students_q.scalars())

        result: list[ChildInfo] = []
        for s in students:
            classes_q = await self._session.execute(
                select(ClassModel)
                .join(EnrollmentModel, EnrollmentModel.class_id == ClassModel.id)
                .where(
                    EnrollmentModel.student_id == s.id,
                    ClassModel.deleted_at.is_(None),
                )
                .order_by(ClassModel.is_active.desc(), ClassModel.name)
            )
            classes = [
                ChildClass(
                    class_id=c.id,
                    name=c.name,
                    subject=c.subject,
                    academic_year=c.academic_year,
                    is_active=c.is_active,
                )
                for c in classes_q.scalars()
            ]
            result.append(ChildInfo(
                student_id=s.id,
                student_name=s.name,
                date_of_birth=s.date_of_birth,
                classes=classes,
            ))
        return result
```

- [ ] **Step 3: Write get_child_grades use case**

Create `apps/api/app/application/use_cases/parent/get_child_grades.py`:

```python
from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.parent import ChildGradeRow
from app.domain.exceptions import ForbiddenError
from app.infrastructure.db.models.class_ import ClassModel, EnrollmentModel
from app.infrastructure.db.models.exam import ExamModel, GradeModel
from app.infrastructure.db.models.student import StudentModel


class GetChildGradesUseCase:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def execute(self, parent_id: UUID, student_id: UUID, org_id: UUID) -> list[ChildGradeRow]:
        # Verify ownership
        owner_q = await self._session.execute(
            select(StudentModel.id).where(
                StudentModel.id == student_id,
                StudentModel.parent_id == parent_id,
                StudentModel.organization_id == org_id,
                StudentModel.deleted_at.is_(None),
            )
        )
        if owner_q.scalar_one_or_none() is None:
            raise ForbiddenError("Not your child")

        rows_q = await self._session.execute(
            select(ExamModel, ClassModel.name.label("class_name"), GradeModel)
            .join(ClassModel, ExamModel.class_id == ClassModel.id)
            .join(EnrollmentModel, (EnrollmentModel.class_id == ClassModel.id) & (EnrollmentModel.student_id == student_id))
            .outerjoin(GradeModel, (GradeModel.exam_id == ExamModel.id) & (GradeModel.student_id == student_id))
            .where(
                ExamModel.deleted_at.is_(None),
                ExamModel.organization_id == org_id,
            )
            .order_by(ClassModel.name, ExamModel.exam_date.asc().nullslast())
        )

        result: list[ChildGradeRow] = []
        for exam, class_name, grade in rows_q:
            result.append(ChildGradeRow(
                exam_id=exam.id,
                class_id=exam.class_id,
                class_name=class_name,
                exam_title=exam.title,
                exam_type=exam.type,
                exam_date=exam.exam_date,
                max_score=float(exam.max_score),
                score=float(grade.score) if grade else None,
                note=grade.note if grade else None,
            ))
        return result
```

- [ ] **Step 4: Write get_child_attendance use case**

Create `apps/api/app/application/use_cases/parent/get_child_attendance.py`:

```python
from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.parent import ChildAttendanceRow
from app.domain.exceptions import ForbiddenError
from app.infrastructure.db.models.attendance import AttendanceRecordModel, ClassSessionModel
from app.infrastructure.db.models.class_ import ClassModel, EnrollmentModel
from app.infrastructure.db.models.student import StudentModel


class GetChildAttendanceUseCase:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def execute(self, parent_id: UUID, student_id: UUID, org_id: UUID) -> list[ChildAttendanceRow]:
        # Verify ownership
        owner_q = await self._session.execute(
            select(StudentModel.id).where(
                StudentModel.id == student_id,
                StudentModel.parent_id == parent_id,
                StudentModel.organization_id == org_id,
                StudentModel.deleted_at.is_(None),
            )
        )
        if owner_q.scalar_one_or_none() is None:
            raise ForbiddenError("Not your child")

        rows_q = await self._session.execute(
            select(ClassSessionModel, ClassModel.name.label("class_name"), AttendanceRecordModel)
            .join(ClassModel, ClassSessionModel.class_id == ClassModel.id)
            .join(EnrollmentModel, (EnrollmentModel.class_id == ClassModel.id) & (EnrollmentModel.student_id == student_id))
            .outerjoin(
                AttendanceRecordModel,
                (AttendanceRecordModel.session_id == ClassSessionModel.id)
                & (AttendanceRecordModel.student_id == student_id),
            )
            .where(ClassModel.organization_id == org_id)
            .order_by(ClassSessionModel.date.desc())
            .limit(100)
        )

        result: list[ChildAttendanceRow] = []
        for session, class_name, record in rows_q:
            result.append(ChildAttendanceRow(
                session_id=session.id,
                class_id=session.class_id,
                class_name=class_name,
                date=session.date,
                status=record.status if record else None,
                note=record.note if record else None,
            ))
        return result
```

- [ ] **Step 5: Write schemas**

Create `apps/api/app/interfaces/api/v1/schemas/parent.py`:

```python
from __future__ import annotations

from datetime import date
from uuid import UUID

from pydantic import BaseModel


class ChildClassSchema(BaseModel):
    class_id: UUID
    name: str
    subject: str
    academic_year: str
    is_active: bool

    model_config = {"from_attributes": True}


class ChildInfoSchema(BaseModel):
    student_id: UUID
    student_name: str
    date_of_birth: date | None
    classes: list[ChildClassSchema]

    model_config = {"from_attributes": True}


class ChildGradeRowSchema(BaseModel):
    exam_id: UUID
    class_id: UUID
    class_name: str
    exam_title: str
    exam_type: str
    exam_date: date | None
    max_score: float
    score: float | None
    note: str | None

    model_config = {"from_attributes": True}


class ChildAttendanceRowSchema(BaseModel):
    session_id: UUID
    class_id: UUID
    class_name: str
    date: date
    status: str | None
    note: str | None

    model_config = {"from_attributes": True}
```

- [ ] **Step 6: Write the router**

Create `apps/api/app/interfaces/api/v1/routers/parent.py`:

```python
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.parent.get_child_attendance import GetChildAttendanceUseCase
from app.application.use_cases.parent.get_child_grades import GetChildGradesUseCase
from app.application.use_cases.parent.get_children import GetChildrenUseCase
from app.infrastructure.db.session import get_db
from app.interfaces.api.v1.dependencies import require_role
from app.interfaces.api.v1.schemas.parent import (
    ChildAttendanceRowSchema,
    ChildGradeRowSchema,
    ChildInfoSchema,
)

router = APIRouter()
_parent = require_role("parent")


@router.get("/children", response_model=list[ChildInfoSchema])
async def list_children(
    token=Depends(_parent),
    db: AsyncSession = Depends(get_db),
):
    uc = GetChildrenUseCase(db)
    return await uc.execute(token.user_id, token.org_id)


@router.get("/children/{student_id}/grades", response_model=list[ChildGradeRowSchema])
async def get_child_grades(
    student_id: UUID,
    token=Depends(_parent),
    db: AsyncSession = Depends(get_db),
):
    uc = GetChildGradesUseCase(db)
    return await uc.execute(token.user_id, student_id, token.org_id)


@router.get("/children/{student_id}/attendance", response_model=list[ChildAttendanceRowSchema])
async def get_child_attendance(
    student_id: UUID,
    token=Depends(_parent),
    db: AsyncSession = Depends(get_db),
):
    uc = GetChildAttendanceUseCase(db)
    return await uc.execute(token.user_id, student_id, token.org_id)
```

- [ ] **Step 7: Register router in main.py**

In `apps/api/app/main.py`, after the dashboard router block, append:

```python
from app.interfaces.api.v1.routers import parent  # noqa: E402

app.include_router(parent.router, prefix="/api/v1/parent", tags=["parent"])
```

- [ ] **Step 8: Write failing tests**

Create `apps/api/tests/test_parent.py`:

```python
import uuid
from datetime import date
from unittest.mock import AsyncMock, patch

from httpx import AsyncClient

from app.domain.entities.parent import ChildAttendanceRow, ChildClass, ChildGradeRow, ChildInfo
from app.domain.exceptions import ForbiddenError
from app.infrastructure.security.jwt import TokenData
from app.interfaces.api.v1.dependencies import get_current_user
from app.main import app

_ORG_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")
_PARENT_ID = uuid.UUID("00000000-0000-0000-0000-000000000005")
_STUDENT_ID = uuid.UUID("00000000-0000-0000-0000-000000000003")
_CLASS_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")
_EXAM_ID = uuid.UUID("00000000-0000-0000-0000-000000000030")
_SESSION_ID = uuid.UUID("00000000-0000-0000-0000-000000000020")
_TOKEN = TokenData(user_id=_PARENT_ID, org_id=_ORG_ID, role="parent", jti="j", exp=9999999999)

_CHILD_INFO = ChildInfo(
    student_id=_STUDENT_ID,
    student_name="Nguyễn Văn An",
    date_of_birth=date(2015, 3, 1),
    classes=[
        ChildClass(class_id=_CLASS_ID, name="Toán 10A", subject="Toán", academic_year="2025-2026", is_active=True)
    ],
)

_GRADE_ROW = ChildGradeRow(
    exam_id=_EXAM_ID,
    class_id=_CLASS_ID,
    class_name="Toán 10A",
    exam_title="Kiểm tra 15 phút",
    exam_type="quiz",
    exam_date=date(2026, 5, 10),
    max_score=10.0,
    score=8.5,
    note=None,
)

_ATTENDANCE_ROW = ChildAttendanceRow(
    session_id=_SESSION_ID,
    class_id=_CLASS_ID,
    class_name="Toán 10A",
    date=date(2026, 5, 3),
    status="present",
    note=None,
)


async def _override():
    return _TOKEN


async def test_list_children(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.parent.GetChildrenUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=[_CHILD_INFO])
            resp = await client.get(
                "/api/v1/parent/children",
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 200
        assert len(resp.json()) == 1
        assert resp.json()[0]["student_name"] == "Nguyễn Văn An"
        assert len(resp.json()[0]["classes"]) == 1
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_get_child_grades(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.parent.GetChildGradesUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=[_GRADE_ROW])
            resp = await client.get(
                f"/api/v1/parent/children/{_STUDENT_ID}/grades",
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 200
        assert resp.json()[0]["score"] == 8.5
        assert resp.json()[0]["exam_type"] == "quiz"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_get_child_grades_wrong_child(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.parent.GetChildGradesUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(side_effect=ForbiddenError("Not your child"))
            resp = await client.get(
                f"/api/v1/parent/children/{uuid.uuid4()}/grades",
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_get_child_attendance(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.parent.GetChildAttendanceUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=[_ATTENDANCE_ROW])
            resp = await client.get(
                f"/api/v1/parent/children/{_STUDENT_ID}/attendance",
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 200
        assert resp.json()[0]["status"] == "present"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_parent_endpoints_forbidden_for_teacher(client: AsyncClient):
    teacher_token = TokenData(
        user_id=uuid.uuid4(), org_id=_ORG_ID, role="teacher", jti="j2", exp=9999999999
    )

    async def _teacher_override():
        return teacher_token

    app.dependency_overrides[get_current_user] = _teacher_override
    try:
        resp = await client.get(
            "/api/v1/parent/children",
            headers={"Authorization": "Bearer fake"},
        )
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)
```

- [ ] **Step 9: Run tests**

```bash
cd /Users/nals_macbook_303/Documents/NALS/04.Learning/School-Management/apps/api
docker compose exec api pytest tests/test_parent.py -v
```

Expected: 5 PASSED

- [ ] **Step 10: Run full test suite to check for regressions**

```bash
docker compose exec api pytest -v --tb=short
```

Expected: all tests pass.

- [ ] **Step 11: Commit**

```bash
cd /Users/nals_macbook_303/Documents/NALS/04.Learning/School-Management
git add apps/api/app/domain/entities/parent.py \
        apps/api/app/application/use_cases/parent/ \
        apps/api/app/interfaces/api/v1/schemas/parent.py \
        apps/api/app/interfaces/api/v1/routers/parent.py \
        apps/api/app/main.py \
        apps/api/tests/test_parent.py
git commit -m "feat: add parent portal API (children, grades, attendance endpoints)"
```

---

## Task 3: Frontend — Teacher Dashboard (dynamic)

**Files:**
- Create: `apps/web/src/features/dashboard/model/types.ts`
- Create: `apps/web/src/features/dashboard/api/dashboard.api.ts`
- Modify: `apps/web/app/(teacher)/dashboard/page.tsx`

- [ ] **Step 1: Write dashboard types**

Create `apps/web/src/features/dashboard/model/types.ts`:

```typescript
export interface TodayClass {
  class_id: string;
  class_name: string;
  subject: string;
  start_time: string;  // "HH:MM:SS"
  end_time: string;
}

export interface PendingSession {
  session_id: string;
  class_id: string;
  class_name: string;
  date: string;  // "YYYY-MM-DD"
}

export interface DashboardSummary {
  active_classes_count: number;
  total_students_count: number;
  today_schedule: TodayClass[];
  pending_sessions: PendingSession[];
}
```

- [ ] **Step 2: Write dashboard API client**

Create `apps/web/src/features/dashboard/api/dashboard.api.ts`:

```typescript
import { apiClient } from "@/src/shared/api/client";
import type { DashboardSummary } from "../model/types";

export async function getDashboardApi(): Promise<DashboardSummary> {
  const { data } = await apiClient.get<DashboardSummary>("/dashboard");
  return data;
}
```

- [ ] **Step 3: Rewrite the teacher dashboard page**

Replace `apps/web/app/(teacher)/dashboard/page.tsx` with:

```typescript
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDashboardApi } from "@/src/features/dashboard/api/dashboard.api";
import type { DashboardSummary } from "@/src/features/dashboard/model/types";

function formatTime(t: string) {
  const [h, m] = t.split(":");
  return `${h}:${m}`;
}

function formatDate(d: string) {
  const dt = new Date(d + "T00:00:00");
  return `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()}`;
}

const DAY_NAMES = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

export default function TeacherDashboard() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const todayName = DAY_NAMES[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];

  useEffect(() => {
    getDashboardApi()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ink tracking-tight">Xin chào</h1>
        <p className="text-ash text-sm mt-1">Chào mừng trở lại EduManager.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-md border border-border bg-canvas p-5">
          <p className="text-xs font-semibold text-ash uppercase tracking-wide mb-1">Lớp đang dạy</p>
          {loading ? (
            <div className="h-8 w-12 bg-stone/30 rounded animate-pulse" />
          ) : (
            <p className="text-3xl font-bold text-ink">{data?.active_classes_count ?? 0}</p>
          )}
        </div>
        <div className="rounded-md border border-border bg-canvas p-5">
          <p className="text-xs font-semibold text-ash uppercase tracking-wide mb-1">Tổng học sinh</p>
          {loading ? (
            <div className="h-8 w-12 bg-stone/30 rounded animate-pulse" />
          ) : (
            <p className="text-3xl font-bold text-ink">{data?.total_students_count ?? 0}</p>
          )}
        </div>
      </div>

      {/* Today's schedule */}
      <section className="rounded-md border border-border bg-canvas p-5">
        <h2 className="font-semibold text-ink mb-4">Lịch hôm nay — {todayName}</h2>
        {loading ? (
          <div className="space-y-2">
            <div className="h-14 bg-stone/20 rounded animate-pulse" />
            <div className="h-14 bg-stone/20 rounded animate-pulse" />
          </div>
        ) : data?.today_schedule.length === 0 ? (
          <p className="text-sm text-ash py-4 text-center">Không có lớp nào hôm nay.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {data?.today_schedule.map((c) => (
              <Link
                key={c.class_id}
                href={`/classes/${c.class_id}`}
                className="group flex items-center justify-between rounded-sm border border-border bg-surface px-4 py-3 hover:border-ink transition-colors"
              >
                <div>
                  <p className="text-sm font-semibold text-ink group-hover:text-primary transition-colors">
                    {c.class_name}
                  </p>
                  <p className="text-xs text-ash">{c.subject}</p>
                </div>
                <p className="text-sm font-medium text-ash shrink-0">
                  {formatTime(c.start_time)} – {formatTime(c.end_time)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Pending sessions */}
      {!loading && (data?.pending_sessions.length ?? 0) > 0 && (
        <section className="rounded-md border border-error/20 bg-error/5 p-5">
          <h2 className="font-semibold text-error mb-3 text-sm">Chưa điểm danh ({data!.pending_sessions.length} buổi)</h2>
          <div className="flex flex-col gap-2">
            {data!.pending_sessions.map((s) => (
              <Link
                key={s.session_id}
                href={`/classes/${s.class_id}`}
                className="flex items-center justify-between rounded-sm border border-error/10 bg-canvas px-4 py-2.5 hover:border-error/30 transition-colors"
              >
                <p className="text-sm font-medium text-ink">{s.class_name}</p>
                <p className="text-xs text-ash">{formatDate(s.date)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/classes"
          className="group rounded-md border border-border bg-canvas p-5 hover:border-ink hover:shadow-card transition-all"
        >
          <p className="text-sm font-semibold text-ink mb-1">Quản lý lớp học</p>
          <p className="text-xs text-ash">Lịch, danh sách, điểm số</p>
        </Link>
        <Link
          href="/students"
          className="group rounded-md border border-border bg-canvas p-5 hover:border-ink hover:shadow-card transition-all"
        >
          <p className="text-sm font-semibold text-ink mb-1">Quản lý học sinh</p>
          <p className="text-xs text-ash">Hồ sơ và danh sách lớp</p>
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/nals_macbook_303/Documents/NALS/04.Learning/School-Management/apps/web
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/nals_macbook_303/Documents/NALS/04.Learning/School-Management
git add apps/web/src/features/dashboard/ \
        apps/web/app/\(teacher\)/dashboard/page.tsx
git commit -m "feat: teacher dashboard shows live stats, today's schedule and pending sessions"
```

---

## Task 4: Frontend — Parent Login Page

**Files:**
- Create: `apps/web/app/(auth)/login/parent/page.tsx`
- Modify: `apps/web/src/features/auth/ui/LoginForm.tsx` — accept optional `redirectTo` prop

- [ ] **Step 1: Extend LoginForm with redirectTo prop**

The current `LoginForm` always redirects to `/dashboard`. We need it to redirect to `/parent/home` for parents, and validate role after login.

Modify `apps/web/src/features/auth/ui/LoginForm.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../model/store";

interface Props {
  redirectTo?: string;
  expectedRole?: "teacher" | "admin" | "parent";
}

export function LoginForm({ redirectTo = "/dashboard", expectedRole }: Props) {
  const login = useAuthStore((s) => s.login);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      const user = useAuthStore.getState().user;
      if (expectedRole && user?.role !== expectedRole) {
        await useAuthStore.getState().logout();
        setError("Tài khoản này không có quyền truy cập trang này.");
        return;
      }
      router.push(redirectTo);
    } catch {
      setError("Email hoặc mật khẩu không đúng.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-semibold text-ink">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-sm border border-border px-4 py-3 text-sm text-ink placeholder-ash focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink"
          placeholder="phuhuynh@email.com"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-semibold text-ink">
          Mật khẩu
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-sm border border-border px-4 py-3 text-sm text-ink placeholder-ash focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink"
          placeholder="••••••••"
        />
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-sm bg-primary px-4 py-3 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-50 hover:bg-primary-hover"
      >
        {loading ? "Đang đăng nhập..." : "Đăng nhập"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create parent login page**

Create `apps/web/app/(auth)/login/parent/page.tsx`:

```typescript
import { LoginForm } from "@/src/features/auth/ui/LoginForm";

export default function ParentLoginPage() {
  return (
    <div className="bg-canvas rounded-md shadow-card p-8">
      <h1 className="text-2xl font-bold text-ink text-display mb-2">
        Đăng nhập Phụ huynh
      </h1>
      <p className="text-sm text-ash mb-6">Dành cho phụ huynh học sinh</p>
      <LoginForm redirectTo="/parent/home" expectedRole="parent" />
    </div>
  );
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/nals_macbook_303/Documents/NALS/04.Learning/School-Management/apps/web
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/nals_macbook_303/Documents/NALS/04.Learning/School-Management
git add apps/web/app/\(auth\)/login/parent/page.tsx \
        apps/web/src/features/auth/ui/LoginForm.tsx
git commit -m "feat: add parent login page with role validation and redirect to parent portal"
```

---

## Task 5: Frontend — Parent Portal Layout + Pages

**Files:**
- Create: `apps/web/src/features/parent/model/types.ts`
- Create: `apps/web/src/features/parent/api/parent.api.ts`
- Modify: `apps/web/app/(parent)/layout.tsx`
- Create: `apps/web/app/(parent)/home/page.tsx`
- Create: `apps/web/app/(parent)/grades/page.tsx`
- Create: `apps/web/app/(parent)/attendance/page.tsx`

- [ ] **Step 1: Write parent types**

Create `apps/web/src/features/parent/model/types.ts`:

```typescript
export interface ChildClass {
  class_id: string;
  name: string;
  subject: string;
  academic_year: string;
  is_active: boolean;
}

export interface ChildInfo {
  student_id: string;
  student_name: string;
  date_of_birth: string | null;
  classes: ChildClass[];
}

export interface ChildGradeRow {
  exam_id: string;
  class_id: string;
  class_name: string;
  exam_title: string;
  exam_type: string;
  exam_date: string | null;
  max_score: number;
  score: number | null;
  note: string | null;
}

export interface ChildAttendanceRow {
  session_id: string;
  class_id: string;
  class_name: string;
  date: string;
  status: "present" | "absent" | "late" | null;
  note: string | null;
}
```

- [ ] **Step 2: Write parent API client**

Create `apps/web/src/features/parent/api/parent.api.ts`:

```typescript
import { apiClient } from "@/src/shared/api/client";
import type { ChildAttendanceRow, ChildGradeRow, ChildInfo } from "../model/types";

export async function listChildrenApi(): Promise<ChildInfo[]> {
  const { data } = await apiClient.get<ChildInfo[]>("/parent/children");
  return data;
}

export async function getChildGradesApi(studentId: string): Promise<ChildGradeRow[]> {
  const { data } = await apiClient.get<ChildGradeRow[]>(`/parent/children/${studentId}/grades`);
  return data;
}

export async function getChildAttendanceApi(studentId: string): Promise<ChildAttendanceRow[]> {
  const { data } = await apiClient.get<ChildAttendanceRow[]>(`/parent/children/${studentId}/attendance`);
  return data;
}
```

- [ ] **Step 3: Rewrite parent layout with auth guard + bottom nav**

Replace `apps/web/app/(parent)/layout.tsx`:

```typescript
"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/src/features/auth/model/store";

const NAV = [
  { href: "/parent/home", label: "Trang chủ", icon: "⊞" },
  { href: "/parent/grades", label: "Điểm số", icon: "📝" },
  { href: "/parent/attendance", label: "Điểm danh", icon: "✓" },
];

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, hydrate, user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    hydrate().then(() => {
      const state = useAuthStore.getState();
      if (!state.isAuthenticated) {
        router.replace("/login/parent");
      } else if (state.user?.role !== "parent") {
        router.replace("/dashboard");
      }
    });
  }, [hydrate, router]);

  if (!isAuthenticated || user?.role !== "parent") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <p className="text-ash text-sm">Đang kiểm tra phiên đăng nhập...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface max-w-lg mx-auto">
      <main className="flex-1 overflow-auto pb-20">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 h-16 border-t border-border bg-canvas max-w-lg mx-auto flex items-center justify-around px-4">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 text-xs font-semibold transition-colors ${
                active ? "text-primary" : "text-ash"
              }`}
            >
              <span className="text-lg leading-none">{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
```

- [ ] **Step 4: Write parent home page**

Create `apps/web/app/(parent)/home/page.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { listChildrenApi } from "@/src/features/parent/api/parent.api";
import type { ChildInfo } from "@/src/features/parent/model/types";

function formatDob(dob: string | null) {
  if (!dob) return "—";
  const d = new Date(dob + "T00:00:00");
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

export default function ParentHomePage() {
  const [children, setChildren] = useState<ChildInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listChildrenApi()
      .then(setChildren)
      .catch(() => setError("Không thể tải thông tin."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-5 flex flex-col gap-4">
        <div className="h-6 w-40 bg-stone/30 rounded animate-pulse" />
        <div className="h-32 bg-stone/20 rounded-md animate-pulse" />
        <div className="h-40 bg-stone/20 rounded-md animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5">
        <div className="rounded-md border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-5 flex flex-col gap-5">
      <h1 className="text-xl font-bold text-ink">Thông tin học sinh</h1>

      {children.length === 0 ? (
        <div className="rounded-md border border-border bg-canvas p-6 text-center">
          <p className="text-sm text-ash">Chưa có học sinh liên kết với tài khoản này.</p>
        </div>
      ) : (
        children.map((child) => (
          <div key={child.student_id} className="flex flex-col gap-3">
            {/* Child card */}
            <div className="rounded-md border border-border bg-canvas p-5">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-primary/8 flex items-center justify-center shrink-0">
                  <span className="text-primary font-bold text-base">
                    {child.student_name.trim().split(" ").pop()?.slice(0, 2).toUpperCase() ?? "HS"}
                  </span>
                </div>
                <div>
                  <h2 className="font-bold text-ink">{child.student_name}</h2>
                  <p className="text-xs text-ash">Ngày sinh: {formatDob(child.date_of_birth)}</p>
                </div>
              </div>

              <p className="text-xs font-semibold text-ash uppercase tracking-wide mb-2">
                Lớp đang học ({child.classes.length})
              </p>
              {child.classes.length === 0 ? (
                <p className="text-sm text-ash">Chưa đăng ký lớp nào.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {child.classes.map((c) => (
                    <div
                      key={c.class_id}
                      className="flex items-center justify-between rounded-sm bg-surface px-3 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-medium text-ink">{c.name}</p>
                        <p className="text-xs text-ash">{c.subject} · {c.academic_year}</p>
                      </div>
                      {c.is_active ? (
                        <span className="text-xs font-semibold text-success">Đang học</span>
                      ) : (
                        <span className="text-xs text-ash">Kết thúc</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 5: Write parent grades page**

Create `apps/web/app/(parent)/grades/page.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { listChildrenApi, getChildGradesApi } from "@/src/features/parent/api/parent.api";
import type { ChildGradeRow, ChildInfo } from "@/src/features/parent/model/types";

const EXAM_TYPE_LABELS: Record<string, string> = {
  quiz: "Kiểm tra nhanh",
  midterm: "Giữa kỳ",
  final: "Cuối kỳ",
  assignment: "Bài tập",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()}`;
}

function groupByClass(rows: ChildGradeRow[]) {
  const map: Record<string, { class_name: string; rows: ChildGradeRow[] }> = {};
  for (const r of rows) {
    if (!map[r.class_id]) map[r.class_id] = { class_name: r.class_name, rows: [] };
    map[r.class_id].rows.push(r);
  }
  return Object.values(map);
}

export default function ParentGradesPage() {
  const [student, setStudent] = useState<ChildInfo | null>(null);
  const [grades, setGrades] = useState<ChildGradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listChildrenApi()
      .then(async (children) => {
        if (children.length === 0) return;
        const first = children[0];
        setStudent(first);
        const g = await getChildGradesApi(first.student_id);
        setGrades(g);
      })
      .catch(() => setError("Không thể tải điểm số."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-5 flex flex-col gap-4">
        <div className="h-6 w-32 bg-stone/30 rounded animate-pulse" />
        <div className="h-48 bg-stone/20 rounded-md animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5">
        <div className="rounded-md border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">{error}</div>
      </div>
    );
  }

  const groups = groupByClass(grades);

  return (
    <div className="p-5 flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-ink">Điểm số</h1>
        {student && <p className="text-sm text-ash mt-0.5">{student.student_name}</p>}
      </div>

      {groups.length === 0 ? (
        <div className="rounded-md border border-border bg-canvas p-6 text-center">
          <p className="text-sm text-ash">Chưa có bài kiểm tra nào.</p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.class_name} className="rounded-md border border-border bg-canvas overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-surface">
              <p className="font-semibold text-ink text-sm">{group.class_name}</p>
            </div>
            <div className="divide-y divide-border">
              {group.rows.map((r) => (
                <div key={r.exam_id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink">{r.exam_title}</p>
                    <p className="text-xs text-ash">
                      {EXAM_TYPE_LABELS[r.exam_type] ?? r.exam_type} · {formatDate(r.exam_date)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {r.score === null ? (
                      <span className="text-xs text-ash">Chưa có</span>
                    ) : (
                      <>
                        <p className="text-base font-bold text-ink">{r.score}</p>
                        <p className="text-xs text-ash">/ {r.max_score}</p>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 6: Write parent attendance page**

Create `apps/web/app/(parent)/attendance/page.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { listChildrenApi, getChildAttendanceApi } from "@/src/features/parent/api/parent.api";
import type { ChildAttendanceRow, ChildInfo } from "@/src/features/parent/model/types";

const STATUS_CONFIG = {
  present: { label: "Có mặt", color: "text-success bg-success/10" },
  absent: { label: "Vắng", color: "text-error bg-error/10" },
  late: { label: "Muộn", color: "text-amber-600 bg-amber-50" },
} as const;

function formatDate(d: string) {
  const dt = new Date(d + "T00:00:00");
  return `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()}`;
}

export default function ParentAttendancePage() {
  const [student, setStudent] = useState<ChildInfo | null>(null);
  const [records, setRecords] = useState<ChildAttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listChildrenApi()
      .then(async (children) => {
        if (children.length === 0) return;
        const first = children[0];
        setStudent(first);
        const a = await getChildAttendanceApi(first.student_id);
        setRecords(a);
      })
      .catch(() => setError("Không thể tải điểm danh."))
      .finally(() => setLoading(false));
  }, []);

  const present = records.filter((r) => r.status === "present").length;
  const absent = records.filter((r) => r.status === "absent").length;
  const late = records.filter((r) => r.status === "late").length;

  if (loading) {
    return (
      <div className="p-5 flex flex-col gap-4">
        <div className="h-6 w-32 bg-stone/30 rounded animate-pulse" />
        <div className="h-20 bg-stone/20 rounded-md animate-pulse" />
        <div className="h-48 bg-stone/20 rounded-md animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5">
        <div className="rounded-md border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-5 flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-ink">Điểm danh</h1>
        {student && <p className="text-sm text-ash mt-0.5">{student.student_name}</p>}
      </div>

      {/* Summary */}
      {records.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-md border border-border bg-canvas p-3 text-center">
            <p className="text-2xl font-bold text-success">{present}</p>
            <p className="text-xs text-ash mt-0.5">Có mặt</p>
          </div>
          <div className="rounded-md border border-border bg-canvas p-3 text-center">
            <p className="text-2xl font-bold text-error">{absent}</p>
            <p className="text-xs text-ash mt-0.5">Vắng</p>
          </div>
          <div className="rounded-md border border-border bg-canvas p-3 text-center">
            <p className="text-2xl font-bold text-amber-600">{late}</p>
            <p className="text-xs text-ash mt-0.5">Muộn</p>
          </div>
        </div>
      )}

      {/* Records list */}
      {records.length === 0 ? (
        <div className="rounded-md border border-border bg-canvas p-6 text-center">
          <p className="text-sm text-ash">Chưa có buổi học nào.</p>
        </div>
      ) : (
        <div className="rounded-md border border-border bg-canvas overflow-hidden">
          <div className="divide-y divide-border">
            {records.map((r) => {
              const cfg = r.status ? STATUS_CONFIG[r.status] : null;
              return (
                <div key={r.session_id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink">{r.class_name}</p>
                    <p className="text-xs text-ash">{formatDate(r.date)}</p>
                    {r.note && <p className="text-xs text-ash italic mt-0.5">{r.note}</p>}
                  </div>
                  {cfg ? (
                    <span className={`text-xs font-semibold rounded-full px-2.5 py-0.5 ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  ) : (
                    <span className="text-xs text-stone">Chưa điểm danh</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: TypeScript check**

```bash
cd /Users/nals_macbook_303/Documents/NALS/04.Learning/School-Management/apps/web
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
cd /Users/nals_macbook_303/Documents/NALS/04.Learning/School-Management
git add apps/web/src/features/parent/ \
        apps/web/app/\(parent\)/layout.tsx \
        apps/web/app/\(parent\)/home/page.tsx \
        apps/web/app/\(parent\)/grades/page.tsx \
        apps/web/app/\(parent\)/attendance/page.tsx
git commit -m "feat: parent portal with home, grades, and attendance pages"
```

---

## Self-Review Checklist

- [x] Teacher dashboard endpoint returns correct shape (`active_classes_count`, `total_students_count`, `today_schedule`, `pending_sessions`)
- [x] `day_of_week == 0` maps to Monday (Python `date.weekday()` standard)
- [x] Pending sessions use NOT EXISTS subquery to find sessions with zero attendance records
- [x] Parent endpoints all require `role="parent"` via `require_role("parent")`
- [x] Child ownership verified in grades + attendance use cases (ForbiddenError if parent_id mismatch)
- [x] `float(exam.max_score)` applied when mapping SQLAlchemy Numeric
- [x] `LoginForm` backward-compatible (redirectTo defaults to `/dashboard`, expectedRole defaults to undefined = no check)
- [x] Parent layout redirects to `/login/parent` if not authenticated, to `/dashboard` if wrong role
- [x] All 5 new tests for parent API, 2 for dashboard
- [x] No new DB migration required (uses existing tables: classes, class_schedules, enrollments, class_sessions, attendance_records, students, exams, grades)
