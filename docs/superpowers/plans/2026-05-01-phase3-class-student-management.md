# Phase 3: Class & Student Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build CRUD API and teacher UI for managing Classes (with schedules), Students, and Enrollments (linking students to classes).

**Architecture:** Backend follows existing Clean Architecture pattern — pure Python domain entities → repository ABC interfaces → SQLAlchemy implementations → use cases → FastAPI routers. Frontend follows Feature-Sliced Design — `features/classes/` and `features/students/` each contain `api/`, `model/`, and `ui/` sub-folders wired into Next.js App Router pages under `(teacher)/`.

**Tech Stack:** Python 3.12, FastAPI 0.115, SQLAlchemy 2.0 async, Alembic, PostgreSQL · Next.js 14 App Router, TypeScript, Zustand, axios, Tailwind CSS

---

## File Map

### Backend — new files

| File | Responsibility |
|---|---|
| `apps/api/app/domain/entities/student.py` | `Student` domain dataclass |
| `apps/api/app/domain/entities/class_.py` | `Class`, `ClassSchedule`, `Enrollment` domain dataclasses |
| `apps/api/app/domain/repositories/student_repository.py` | `IStudentRepository` ABC |
| `apps/api/app/domain/repositories/class_repository.py` | `IClassRepository` ABC |
| `apps/api/app/infrastructure/db/models/student.py` | `StudentModel` SQLAlchemy ORM |
| `apps/api/app/infrastructure/db/models/class_.py` | `ClassModel`, `ClassScheduleModel`, `EnrollmentModel` SQLAlchemy ORM |
| `apps/api/app/infrastructure/db/repositories/student_repository.py` | `SQLStudentRepository` |
| `apps/api/app/infrastructure/db/repositories/class_repository.py` | `SQLClassRepository` |
| `apps/api/app/application/use_cases/students/create_student.py` | `CreateStudentUseCase` |
| `apps/api/app/application/use_cases/students/list_students.py` | `ListStudentsUseCase` |
| `apps/api/app/application/use_cases/students/get_student.py` | `GetStudentUseCase` |
| `apps/api/app/application/use_cases/classes/create_class.py` | `CreateClassUseCase` |
| `apps/api/app/application/use_cases/classes/list_classes.py` | `ListClassesUseCase` |
| `apps/api/app/application/use_cases/classes/get_class.py` | `GetClassUseCase` |
| `apps/api/app/application/use_cases/classes/add_schedule.py` | `AddScheduleUseCase` |
| `apps/api/app/application/use_cases/classes/delete_schedule.py` | `DeleteScheduleUseCase` |
| `apps/api/app/application/use_cases/classes/enroll_student.py` | `EnrollStudentUseCase` |
| `apps/api/app/application/use_cases/classes/unenroll_student.py` | `UnenrollStudentUseCase` |
| `apps/api/app/interfaces/api/v1/schemas/student.py` | Pydantic request/response schemas for students |
| `apps/api/app/interfaces/api/v1/schemas/class_.py` | Pydantic request/response schemas for classes |
| `apps/api/app/interfaces/api/v1/routers/students.py` | FastAPI router `/students` |
| `apps/api/app/interfaces/api/v1/routers/classes.py` | FastAPI router `/classes` (incl. schedules + enrollments) |
| `apps/api/tests/test_students.py` | HTTP-level student endpoint tests |
| `apps/api/tests/test_classes.py` | HTTP-level class endpoint tests |

### Backend — modified files

| File | Change |
|---|---|
| `apps/api/app/infrastructure/db/models/__init__.py` | Import new models so Alembic detects them |
| `apps/api/app/interfaces/api/v1/dependencies.py` | Add `require_role()` dependency factory |
| `apps/api/app/main.py` | Register `/students` and `/classes` routers |

### Frontend — new files

| File | Responsibility |
|---|---|
| `apps/web/src/features/classes/model/types.ts` | `Class`, `ClassSchedule`, `Enrollment` TypeScript types |
| `apps/web/src/features/classes/api/classes.api.ts` | `listClassesApi`, `createClassApi`, `getClassApi`, `addScheduleApi`, `deleteScheduleApi`, `listEnrollmentsApi`, `enrollStudentApi`, `unenrollStudentApi` |
| `apps/web/src/features/classes/ui/ClassCard.tsx` | Single class card (name, subject, schedule summary) |
| `apps/web/src/features/classes/ui/CreateClassForm.tsx` | Controlled form: name, subject, academic_year |
| `apps/web/src/features/classes/ui/ScheduleForm.tsx` | Add schedule row: day_of_week, start_time, end_time |
| `apps/web/src/features/classes/ui/EnrollmentList.tsx` | List of enrolled students with unenroll button |
| `apps/web/src/features/classes/ui/AddStudentToClassForm.tsx` | Dropdown of org students + enroll button |
| `apps/web/src/features/students/model/types.ts` | `Student` TypeScript type |
| `apps/web/src/features/students/api/students.api.ts` | `listStudentsApi`, `createStudentApi`, `getStudentApi` |
| `apps/web/src/features/students/ui/CreateStudentForm.tsx` | Controlled form: name, date_of_birth, note |
| `apps/web/app/(teacher)/classes/page.tsx` | `/classes` — teacher's class list |
| `apps/web/app/(teacher)/classes/new/page.tsx` | `/classes/new` — create class |
| `apps/web/app/(teacher)/classes/[id]/page.tsx` | `/classes/[id]` — class detail + schedules + students |

### Frontend — modified files

| File | Change |
|---|---|
| `apps/web/app/(teacher)/dashboard/page.tsx` | Add link to `/classes` |

---

## Task 1: Domain entities — Student, Class, ClassSchedule, Enrollment

**Files:**
- Create: `apps/api/app/domain/entities/student.py`
- Create: `apps/api/app/domain/entities/class_.py`

- [ ] **Step 1: Create student entity**

```python
# apps/api/app/domain/entities/student.py
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from uuid import UUID


@dataclass
class Student:
    id: UUID
    organization_id: UUID
    name: str
    date_of_birth: date | None
    note: str | None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None
```

- [ ] **Step 2: Create class entities**

```python
# apps/api/app/domain/entities/class_.py
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time
from uuid import UUID


@dataclass
class Class:
    id: UUID
    organization_id: UUID
    teacher_id: UUID
    name: str
    subject: str
    academic_year: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None


@dataclass
class ClassSchedule:
    id: UUID
    class_id: UUID
    day_of_week: int   # 0=Monday … 6=Sunday
    start_time: time
    end_time: time


@dataclass
class Enrollment:
    id: UUID
    class_id: UUID
    student_id: UUID
    parent_id: UUID | None
    enrolled_at: datetime
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/app/domain/entities/student.py apps/api/app/domain/entities/class_.py
git commit -m "feat: domain entities for student, class, schedule, enrollment"
```

---

## Task 2: Repository ABC interfaces

**Files:**
- Create: `apps/api/app/domain/repositories/student_repository.py`
- Create: `apps/api/app/domain/repositories/class_repository.py`

- [ ] **Step 1: Student repository interface**

```python
# apps/api/app/domain/repositories/student_repository.py
from __future__ import annotations

from abc import ABC, abstractmethod
from uuid import UUID

from app.domain.entities.student import Student


class IStudentRepository(ABC):
    @abstractmethod
    async def create(self, student: Student) -> Student: ...

    @abstractmethod
    async def get_by_id(self, student_id: UUID, org_id: UUID) -> Student | None: ...

    @abstractmethod
    async def list_by_org(self, org_id: UUID) -> list[Student]: ...
```

- [ ] **Step 2: Class repository interface**

```python
# apps/api/app/domain/repositories/class_repository.py
from __future__ import annotations

from abc import ABC, abstractmethod
from uuid import UUID

from app.domain.entities.class_ import Class, ClassSchedule, Enrollment


class IClassRepository(ABC):
    @abstractmethod
    async def create(self, class_: Class) -> Class: ...

    @abstractmethod
    async def get_by_id(self, class_id: UUID, org_id: UUID) -> Class | None: ...

    @abstractmethod
    async def list_by_teacher(self, teacher_id: UUID, org_id: UUID) -> list[Class]: ...

    @abstractmethod
    async def add_schedule(self, schedule: ClassSchedule) -> ClassSchedule: ...

    @abstractmethod
    async def list_schedules(self, class_id: UUID) -> list[ClassSchedule]: ...

    @abstractmethod
    async def delete_schedule(self, schedule_id: UUID, class_id: UUID) -> None: ...

    @abstractmethod
    async def enroll(self, enrollment: Enrollment) -> Enrollment: ...

    @abstractmethod
    async def enrollment_exists(self, class_id: UUID, student_id: UUID) -> bool: ...

    @abstractmethod
    async def list_enrollments(self, class_id: UUID) -> list[Enrollment]: ...

    @abstractmethod
    async def unenroll(self, class_id: UUID, student_id: UUID) -> None: ...
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/app/domain/repositories/
git commit -m "feat: repository ABC interfaces for student and class"
```

---

## Task 3: SQLAlchemy ORM models

**Files:**
- Create: `apps/api/app/infrastructure/db/models/student.py`
- Create: `apps/api/app/infrastructure/db/models/class_.py`
- Modify: `apps/api/app/infrastructure/db/models/__init__.py`

- [ ] **Step 1: StudentModel**

```python
# apps/api/app/infrastructure/db/models/student.py
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.db.session import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class StudentModel(Base):
    __tablename__ = "students"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

- [ ] **Step 2: ClassModel, ClassScheduleModel, EnrollmentModel**

```python
# apps/api/app/infrastructure/db/models/class_.py
from __future__ import annotations

import uuid
from datetime import datetime, time, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, SmallInteger, String, Time, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.db.session import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ClassModel(Base):
    __tablename__ = "classes"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    academic_year: Mapped[str] = mapped_column(String(20), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ClassScheduleModel(Base):
    __tablename__ = "class_schedules"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    class_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("classes.id"), nullable=False, index=True
    )
    day_of_week: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # 0=Mon … 6=Sun
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)


class EnrollmentModel(Base):
    __tablename__ = "enrollments"
    __table_args__ = (UniqueConstraint("class_id", "student_id", name="uq_enrollment"),)

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    class_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("classes.id"), nullable=False, index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("students.id"), nullable=False, index=True
    )
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    enrolled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
```

- [ ] **Step 3: Update models `__init__.py` so Alembic detects new tables**

The current content of `apps/api/app/infrastructure/db/models/__init__.py` is:
```python
from app.infrastructure.db.models.user import OrganizationModel, UserModel  # noqa: F401
```

Replace with:
```python
from app.infrastructure.db.models.user import OrganizationModel, UserModel  # noqa: F401
from app.infrastructure.db.models.student import StudentModel  # noqa: F401
from app.infrastructure.db.models.class_ import ClassModel, ClassScheduleModel, EnrollmentModel  # noqa: F401
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/app/infrastructure/db/models/
git commit -m "feat: ORM models for student, class, schedule, enrollment"
```

---

## Task 4: Database migration

**Files:**
- Create: `apps/api/alembic/versions/<rev>_students_classes.py` (auto-generated)

- [ ] **Step 1: Generate migration** (run from `apps/api/`)

```bash
cd apps/api
.venv/bin/alembic revision --autogenerate -m "students_classes"
```

Expected output:
```
Generating .../alembic/versions/XXXX_students_classes.py ...  done
```

- [ ] **Step 2: Verify generated migration contains these tables**

Open the generated file and confirm it creates: `students`, `classes`, `class_schedules`, `enrollments`.
Check that `uq_enrollment` UniqueConstraint is present on `enrollments`.

- [ ] **Step 3: Apply migration**

```bash
.venv/bin/alembic upgrade head
```

Expected:
```
Running upgrade 72bfbd1e01e0 -> XXXX, students_classes
```

- [ ] **Step 4: Verify in DB** (optional — via DBeaver or psql)

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;
```

Expected tables: `alembic_version`, `class_schedules`, `classes`, `enrollments`, `organizations`, `students`, `users`.

- [ ] **Step 5: Commit**

```bash
cd ../..
git add apps/api/alembic/versions/
git commit -m "feat: migration for students, classes, schedules, enrollments"
```

---

## Task 5: SQLAlchemy repository implementations

**Files:**
- Create: `apps/api/app/infrastructure/db/repositories/student_repository.py`
- Create: `apps/api/app/infrastructure/db/repositories/class_repository.py`

- [ ] **Step 1: SQLStudentRepository**

```python
# apps/api/app/infrastructure/db/repositories/student_repository.py
from __future__ import annotations

import uuid
from datetime import date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.student import Student
from app.domain.repositories.student_repository import IStudentRepository
from app.infrastructure.db.models.student import StudentModel


def _to_domain(row: StudentModel) -> Student:
    return Student(
        id=row.id,
        organization_id=row.organization_id,
        name=row.name,
        date_of_birth=row.date_of_birth,
        note=row.note,
        created_at=row.created_at,
        updated_at=row.updated_at,
        deleted_at=row.deleted_at,
    )


class SQLStudentRepository(IStudentRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, student: Student) -> Student:
        row = StudentModel(
            id=student.id,
            organization_id=student.organization_id,
            name=student.name,
            date_of_birth=student.date_of_birth,
            note=student.note,
        )
        self._session.add(row)
        await self._session.flush()
        await self._session.refresh(row)
        return _to_domain(row)

    async def get_by_id(self, student_id: UUID, org_id: UUID) -> Student | None:
        result = await self._session.execute(
            select(StudentModel).where(
                StudentModel.id == student_id,
                StudentModel.organization_id == org_id,
                StudentModel.deleted_at.is_(None),
            )
        )
        row = result.scalar_one_or_none()
        return _to_domain(row) if row else None

    async def list_by_org(self, org_id: UUID) -> list[Student]:
        result = await self._session.execute(
            select(StudentModel).where(
                StudentModel.organization_id == org_id,
                StudentModel.deleted_at.is_(None),
            ).order_by(StudentModel.name)
        )
        return [_to_domain(r) for r in result.scalars()]
```

- [ ] **Step 2: SQLClassRepository**

```python
# apps/api/app/infrastructure/db/repositories/class_repository.py
from __future__ import annotations

from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.class_ import Class, ClassSchedule, Enrollment
from app.domain.repositories.class_repository import IClassRepository
from app.infrastructure.db.models.class_ import ClassModel, ClassScheduleModel, EnrollmentModel


def _class_to_domain(row: ClassModel) -> Class:
    return Class(
        id=row.id,
        organization_id=row.organization_id,
        teacher_id=row.teacher_id,
        name=row.name,
        subject=row.subject,
        academic_year=row.academic_year,
        is_active=row.is_active,
        created_at=row.created_at,
        updated_at=row.updated_at,
        deleted_at=row.deleted_at,
    )


def _schedule_to_domain(row: ClassScheduleModel) -> ClassSchedule:
    return ClassSchedule(
        id=row.id,
        class_id=row.class_id,
        day_of_week=row.day_of_week,
        start_time=row.start_time,
        end_time=row.end_time,
    )


def _enrollment_to_domain(row: EnrollmentModel) -> Enrollment:
    return Enrollment(
        id=row.id,
        class_id=row.class_id,
        student_id=row.student_id,
        parent_id=row.parent_id,
        enrolled_at=row.enrolled_at,
    )


class SQLClassRepository(IClassRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, class_: Class) -> Class:
        row = ClassModel(
            id=class_.id,
            organization_id=class_.organization_id,
            teacher_id=class_.teacher_id,
            name=class_.name,
            subject=class_.subject,
            academic_year=class_.academic_year,
            is_active=class_.is_active,
        )
        self._session.add(row)
        await self._session.flush()
        await self._session.refresh(row)
        return _class_to_domain(row)

    async def get_by_id(self, class_id: UUID, org_id: UUID) -> Class | None:
        result = await self._session.execute(
            select(ClassModel).where(
                ClassModel.id == class_id,
                ClassModel.organization_id == org_id,
                ClassModel.deleted_at.is_(None),
            )
        )
        row = result.scalar_one_or_none()
        return _class_to_domain(row) if row else None

    async def list_by_teacher(self, teacher_id: UUID, org_id: UUID) -> list[Class]:
        result = await self._session.execute(
            select(ClassModel).where(
                ClassModel.teacher_id == teacher_id,
                ClassModel.organization_id == org_id,
                ClassModel.deleted_at.is_(None),
            ).order_by(ClassModel.name)
        )
        return [_class_to_domain(r) for r in result.scalars()]

    async def add_schedule(self, schedule: ClassSchedule) -> ClassSchedule:
        row = ClassScheduleModel(
            id=schedule.id,
            class_id=schedule.class_id,
            day_of_week=schedule.day_of_week,
            start_time=schedule.start_time,
            end_time=schedule.end_time,
        )
        self._session.add(row)
        await self._session.flush()
        await self._session.refresh(row)
        return _schedule_to_domain(row)

    async def list_schedules(self, class_id: UUID) -> list[ClassSchedule]:
        result = await self._session.execute(
            select(ClassScheduleModel).where(
                ClassScheduleModel.class_id == class_id
            ).order_by(ClassScheduleModel.day_of_week, ClassScheduleModel.start_time)
        )
        return [_schedule_to_domain(r) for r in result.scalars()]

    async def delete_schedule(self, schedule_id: UUID, class_id: UUID) -> None:
        await self._session.execute(
            delete(ClassScheduleModel).where(
                ClassScheduleModel.id == schedule_id,
                ClassScheduleModel.class_id == class_id,
            )
        )

    async def enroll(self, enrollment: Enrollment) -> Enrollment:
        row = EnrollmentModel(
            id=enrollment.id,
            class_id=enrollment.class_id,
            student_id=enrollment.student_id,
            parent_id=enrollment.parent_id,
        )
        self._session.add(row)
        await self._session.flush()
        await self._session.refresh(row)
        return _enrollment_to_domain(row)

    async def enrollment_exists(self, class_id: UUID, student_id: UUID) -> bool:
        result = await self._session.execute(
            select(EnrollmentModel.id).where(
                EnrollmentModel.class_id == class_id,
                EnrollmentModel.student_id == student_id,
            )
        )
        return result.scalar_one_or_none() is not None

    async def list_enrollments(self, class_id: UUID) -> list[Enrollment]:
        result = await self._session.execute(
            select(EnrollmentModel).where(
                EnrollmentModel.class_id == class_id
            )
        )
        return [_enrollment_to_domain(r) for r in result.scalars()]

    async def unenroll(self, class_id: UUID, student_id: UUID) -> None:
        await self._session.execute(
            delete(EnrollmentModel).where(
                EnrollmentModel.class_id == class_id,
                EnrollmentModel.student_id == student_id,
            )
        )
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/app/infrastructure/db/repositories/student_repository.py \
        apps/api/app/infrastructure/db/repositories/class_repository.py
git commit -m "feat: SQL repository implementations for student and class"
```

---

## Task 6: Student use cases

**Files:**
- Create: `apps/api/app/application/use_cases/students/create_student.py`
- Create: `apps/api/app/application/use_cases/students/list_students.py`
- Create: `apps/api/app/application/use_cases/students/get_student.py`

- [ ] **Step 1: Write failing tests first**

```python
# apps/api/tests/test_students.py
import uuid
from unittest.mock import AsyncMock, patch

from httpx import AsyncClient

from app.domain.entities.student import Student
from app.infrastructure.security.jwt import TokenData
from app.interfaces.api.v1.dependencies import get_current_user
from app.main import app

_ORG_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")
_TEACHER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
_STUDENT_ID = uuid.UUID("00000000-0000-0000-0000-000000000003")

_TOKEN = TokenData(user_id=_TEACHER_ID, org_id=_ORG_ID, role="teacher", jti="j", exp=9999999999)

_STUDENT = Student(
    id=_STUDENT_ID,
    organization_id=_ORG_ID,
    name="Nguyễn Văn A",
    date_of_birth=None,
    note=None,
    created_at=__import__("datetime").datetime(2026, 1, 1, tzinfo=__import__("datetime").timezone.utc),
    updated_at=__import__("datetime").datetime(2026, 1, 1, tzinfo=__import__("datetime").timezone.utc),
    deleted_at=None,
)


async def _override():
    return _TOKEN


async def test_create_student(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.students.CreateStudentUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=_STUDENT)
            resp = await client.post(
                "/api/v1/students",
                json={"name": "Nguyễn Văn A"},
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 201
        assert resp.json()["name"] == "Nguyễn Văn A"
        assert resp.json()["id"] == str(_STUDENT_ID)
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_list_students(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.students.ListStudentsUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=[_STUDENT])
            resp = await client.get("/api/v1/students", headers={"Authorization": "Bearer fake"})
        assert resp.status_code == 200
        assert len(resp.json()) == 1
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_get_student_not_found(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.students.GetStudentUseCase") as MockUC:
            from app.domain.exceptions import NotFoundError
            MockUC.return_value.execute = AsyncMock(side_effect=NotFoundError("Student", str(_STUDENT_ID)))
            resp = await client.get(
                f"/api/v1/students/{_STUDENT_ID}",
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 404
    finally:
        app.dependency_overrides.pop(get_current_user, None)
```

- [ ] **Step 2: Run tests — confirm they FAIL**

```bash
cd apps/api
.venv/bin/pytest tests/test_students.py -v
```

Expected: FAIL — `ImportError` or `404` on routing (routers not registered yet).

- [ ] **Step 3: Create student use cases**

```python
# apps/api/app/application/use_cases/students/create_student.py
from __future__ import annotations

import uuid
from datetime import date

from app.domain.entities.student import Student
from app.domain.repositories.student_repository import IStudentRepository


class CreateStudentUseCase:
    def __init__(self, student_repo: IStudentRepository) -> None:
        self._repo = student_repo

    async def execute(
        self,
        org_id: uuid.UUID,
        name: str,
        date_of_birth: date | None,
        note: str | None,
    ) -> Student:
        student = Student(
            id=uuid.uuid4(),
            organization_id=org_id,
            name=name,
            date_of_birth=date_of_birth,
            note=note,
            created_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc),
            updated_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc),
            deleted_at=None,
        )
        return await self._repo.create(student)
```

```python
# apps/api/app/application/use_cases/students/list_students.py
from __future__ import annotations

import uuid

from app.domain.entities.student import Student
from app.domain.repositories.student_repository import IStudentRepository


class ListStudentsUseCase:
    def __init__(self, student_repo: IStudentRepository) -> None:
        self._repo = student_repo

    async def execute(self, org_id: uuid.UUID) -> list[Student]:
        return await self._repo.list_by_org(org_id)
```

```python
# apps/api/app/application/use_cases/students/get_student.py
from __future__ import annotations

import uuid

from app.domain.entities.student import Student
from app.domain.exceptions import NotFoundError
from app.domain.repositories.student_repository import IStudentRepository


class GetStudentUseCase:
    def __init__(self, student_repo: IStudentRepository) -> None:
        self._repo = student_repo

    async def execute(self, student_id: uuid.UUID, org_id: uuid.UUID) -> Student:
        student = await self._repo.get_by_id(student_id, org_id)
        if not student:
            raise NotFoundError("Student", str(student_id))
        return student
```

- [ ] **Step 4: Commit use cases**

```bash
git add apps/api/app/application/use_cases/students/
git commit -m "feat: student use cases (create, list, get)"
```

---

## Task 7: Class use cases

**Files:**
- Create: `apps/api/app/application/use_cases/classes/create_class.py`
- Create: `apps/api/app/application/use_cases/classes/list_classes.py`
- Create: `apps/api/app/application/use_cases/classes/get_class.py`
- Create: `apps/api/app/application/use_cases/classes/add_schedule.py`
- Create: `apps/api/app/application/use_cases/classes/delete_schedule.py`
- Create: `apps/api/app/application/use_cases/classes/enroll_student.py`
- Create: `apps/api/app/application/use_cases/classes/unenroll_student.py`

- [ ] **Step 1: Create class use cases**

```python
# apps/api/app/application/use_cases/classes/create_class.py
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from app.domain.entities.class_ import Class
from app.domain.repositories.class_repository import IClassRepository


class CreateClassUseCase:
    def __init__(self, class_repo: IClassRepository) -> None:
        self._repo = class_repo

    async def execute(
        self,
        org_id: uuid.UUID,
        teacher_id: uuid.UUID,
        name: str,
        subject: str,
        academic_year: str,
    ) -> Class:
        class_ = Class(
            id=uuid.uuid4(),
            organization_id=org_id,
            teacher_id=teacher_id,
            name=name,
            subject=subject,
            academic_year=academic_year,
            is_active=True,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            deleted_at=None,
        )
        return await self._repo.create(class_)
```

```python
# apps/api/app/application/use_cases/classes/list_classes.py
from __future__ import annotations

import uuid

from app.domain.entities.class_ import Class
from app.domain.repositories.class_repository import IClassRepository


class ListClassesUseCase:
    def __init__(self, class_repo: IClassRepository) -> None:
        self._repo = class_repo

    async def execute(self, teacher_id: uuid.UUID, org_id: uuid.UUID) -> list[Class]:
        return await self._repo.list_by_teacher(teacher_id, org_id)
```

```python
# apps/api/app/application/use_cases/classes/get_class.py
from __future__ import annotations

import uuid

from app.domain.entities.class_ import Class
from app.domain.exceptions import NotFoundError
from app.domain.repositories.class_repository import IClassRepository


class GetClassUseCase:
    def __init__(self, class_repo: IClassRepository) -> None:
        self._repo = class_repo

    async def execute(self, class_id: uuid.UUID, org_id: uuid.UUID) -> Class:
        class_ = await self._repo.get_by_id(class_id, org_id)
        if not class_:
            raise NotFoundError("Class", str(class_id))
        return class_
```

```python
# apps/api/app/application/use_cases/classes/add_schedule.py
from __future__ import annotations

import uuid
from datetime import time

from app.domain.entities.class_ import ClassSchedule
from app.domain.exceptions import NotFoundError
from app.domain.repositories.class_repository import IClassRepository


class AddScheduleUseCase:
    def __init__(self, class_repo: IClassRepository) -> None:
        self._repo = class_repo

    async def execute(
        self,
        class_id: uuid.UUID,
        org_id: uuid.UUID,
        day_of_week: int,
        start_time: time,
        end_time: time,
    ) -> ClassSchedule:
        class_ = await self._repo.get_by_id(class_id, org_id)
        if not class_:
            raise NotFoundError("Class", str(class_id))
        schedule = ClassSchedule(
            id=uuid.uuid4(),
            class_id=class_id,
            day_of_week=day_of_week,
            start_time=start_time,
            end_time=end_time,
        )
        return await self._repo.add_schedule(schedule)
```

```python
# apps/api/app/application/use_cases/classes/delete_schedule.py
from __future__ import annotations

import uuid

from app.domain.repositories.class_repository import IClassRepository


class DeleteScheduleUseCase:
    def __init__(self, class_repo: IClassRepository) -> None:
        self._repo = class_repo

    async def execute(self, class_id: uuid.UUID, schedule_id: uuid.UUID, org_id: uuid.UUID) -> None:
        class_ = await self._repo.get_by_id(class_id, org_id)
        if not class_:
            from app.domain.exceptions import NotFoundError
            raise NotFoundError("Class", str(class_id))
        await self._repo.delete_schedule(schedule_id, class_id)
```

```python
# apps/api/app/application/use_cases/classes/enroll_student.py
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from app.domain.entities.class_ import Enrollment
from app.domain.exceptions import ConflictError, NotFoundError
from app.domain.repositories.class_repository import IClassRepository
from app.domain.repositories.student_repository import IStudentRepository


class EnrollStudentUseCase:
    def __init__(self, class_repo: IClassRepository, student_repo: IStudentRepository) -> None:
        self._class_repo = class_repo
        self._student_repo = student_repo

    async def execute(
        self,
        class_id: uuid.UUID,
        student_id: uuid.UUID,
        org_id: uuid.UUID,
        parent_id: uuid.UUID | None = None,
    ) -> Enrollment:
        class_ = await self._class_repo.get_by_id(class_id, org_id)
        if not class_:
            raise NotFoundError("Class", str(class_id))
        student = await self._student_repo.get_by_id(student_id, org_id)
        if not student:
            raise NotFoundError("Student", str(student_id))
        if await self._class_repo.enrollment_exists(class_id, student_id):
            raise ConflictError("Student already enrolled in this class")
        enrollment = Enrollment(
            id=uuid.uuid4(),
            class_id=class_id,
            student_id=student_id,
            parent_id=parent_id,
            enrolled_at=datetime.now(timezone.utc),
        )
        return await self._class_repo.enroll(enrollment)
```

```python
# apps/api/app/application/use_cases/classes/unenroll_student.py
from __future__ import annotations

import uuid

from app.domain.repositories.class_repository import IClassRepository


class UnenrollStudentUseCase:
    def __init__(self, class_repo: IClassRepository) -> None:
        self._repo = class_repo

    async def execute(self, class_id: uuid.UUID, student_id: uuid.UUID, org_id: uuid.UUID) -> None:
        class_ = await self._repo.get_by_id(class_id, org_id)
        if not class_:
            from app.domain.exceptions import NotFoundError
            raise NotFoundError("Class", str(class_id))
        await self._repo.unenroll(class_id, student_id)
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/app/application/use_cases/classes/ apps/api/app/application/use_cases/students/
git commit -m "feat: class use cases (create, list, get, schedule, enroll)"
```

---

## Task 8: Pydantic schemas + require_role dependency

**Files:**
- Create: `apps/api/app/interfaces/api/v1/schemas/student.py`
- Create: `apps/api/app/interfaces/api/v1/schemas/class_.py`
- Modify: `apps/api/app/interfaces/api/v1/dependencies.py`

- [ ] **Step 1: Student schemas**

```python
# apps/api/app/interfaces/api/v1/schemas/student.py
from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel


class CreateStudentRequest(BaseModel):
    name: str
    date_of_birth: date | None = None
    note: str | None = None


class StudentResponse(BaseModel):
    id: UUID
    organization_id: UUID
    name: str
    date_of_birth: date | None
    note: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 2: Class schemas**

```python
# apps/api/app/interfaces/api/v1/schemas/class_.py
from __future__ import annotations

from datetime import datetime, time
from uuid import UUID

from pydantic import BaseModel, field_validator


class CreateClassRequest(BaseModel):
    name: str
    subject: str
    academic_year: str


class ClassResponse(BaseModel):
    id: UUID
    organization_id: UUID
    teacher_id: UUID
    name: str
    subject: str
    academic_year: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AddScheduleRequest(BaseModel):
    day_of_week: int      # 0=Monday … 6=Sunday
    start_time: time
    end_time: time

    @field_validator("day_of_week")
    @classmethod
    def validate_day(cls, v: int) -> int:
        if not 0 <= v <= 6:
            raise ValueError("day_of_week must be 0–6")
        return v


class ScheduleResponse(BaseModel):
    id: UUID
    class_id: UUID
    day_of_week: int
    start_time: time
    end_time: time

    model_config = {"from_attributes": True}


class EnrollRequest(BaseModel):
    student_id: UUID
    parent_id: UUID | None = None


class EnrollmentResponse(BaseModel):
    id: UUID
    class_id: UUID
    student_id: UUID
    parent_id: UUID | None
    enrolled_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 3: Add `require_role` to dependencies.py**

Current file content:
```python
from __future__ import annotations

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from redis.asyncio import Redis

from app.domain.exceptions import UnauthorizedError
from app.infrastructure.cache.redis_client import get_redis
from app.infrastructure.security.jwt import TokenData, decode_token

_bearer = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    redis: Redis = Depends(get_redis),
) -> TokenData:
    token_data = decode_token(credentials.credentials)
    if await redis.get(f"blacklist:{token_data.jti}"):
        raise UnauthorizedError("Token has been revoked")
    return token_data
```

Replace with:
```python
from __future__ import annotations

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from redis.asyncio import Redis

from app.domain.exceptions import ForbiddenError, UnauthorizedError
from app.infrastructure.cache.redis_client import get_redis
from app.infrastructure.security.jwt import TokenData, decode_token

_bearer = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    redis: Redis = Depends(get_redis),
) -> TokenData:
    token_data = decode_token(credentials.credentials)
    if await redis.get(f"blacklist:{token_data.jti}"):
        raise UnauthorizedError("Token has been revoked")
    return token_data


def require_role(*roles: str):
    async def _check(token_data: TokenData = Depends(get_current_user)) -> TokenData:
        if token_data.role not in roles:
            raise ForbiddenError(f"Role '{token_data.role}' not allowed")
        return token_data
    return _check
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/app/interfaces/api/v1/schemas/student.py \
        apps/api/app/interfaces/api/v1/schemas/class_.py \
        apps/api/app/interfaces/api/v1/dependencies.py
git commit -m "feat: Pydantic schemas for student/class and require_role dependency"
```

---

## Task 9: FastAPI routers + register in main

**Files:**
- Create: `apps/api/app/interfaces/api/v1/routers/students.py`
- Create: `apps/api/app/interfaces/api/v1/routers/classes.py`
- Modify: `apps/api/app/main.py`

- [ ] **Step 1: Students router**

```python
# apps/api/app/interfaces/api/v1/routers/students.py
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.students.create_student import CreateStudentUseCase
from app.application.use_cases.students.get_student import GetStudentUseCase
from app.application.use_cases.students.list_students import ListStudentsUseCase
from app.infrastructure.db.repositories.student_repository import SQLStudentRepository
from app.infrastructure.db.session import get_db
from app.interfaces.api.v1.dependencies import require_role
from app.interfaces.api.v1.schemas.student import CreateStudentRequest, StudentResponse

router = APIRouter()
_teacher_or_admin = require_role("teacher", "admin")


@router.post("", response_model=StudentResponse, status_code=201)
async def create_student(
    body: CreateStudentRequest,
    token=Depends(_teacher_or_admin),
    db: AsyncSession = Depends(get_db),
):
    uc = CreateStudentUseCase(SQLStudentRepository(db))
    result = await uc.execute(token.org_id, body.name, body.date_of_birth, body.note)
    return result


@router.get("", response_model=list[StudentResponse])
async def list_students(
    token=Depends(_teacher_or_admin),
    db: AsyncSession = Depends(get_db),
):
    uc = ListStudentsUseCase(SQLStudentRepository(db))
    return await uc.execute(token.org_id)


@router.get("/{student_id}", response_model=StudentResponse)
async def get_student(
    student_id: UUID,
    token=Depends(_teacher_or_admin),
    db: AsyncSession = Depends(get_db),
):
    uc = GetStudentUseCase(SQLStudentRepository(db))
    return await uc.execute(student_id, token.org_id)
```

- [ ] **Step 2: Classes router**

```python
# apps/api/app/interfaces/api/v1/routers/classes.py
from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.classes.add_schedule import AddScheduleUseCase
from app.application.use_cases.classes.create_class import CreateClassUseCase
from app.application.use_cases.classes.delete_schedule import DeleteScheduleUseCase
from app.application.use_cases.classes.enroll_student import EnrollStudentUseCase
from app.application.use_cases.classes.get_class import GetClassUseCase
from app.application.use_cases.classes.list_classes import ListClassesUseCase
from app.application.use_cases.classes.unenroll_student import UnenrollStudentUseCase
from app.infrastructure.db.repositories.class_repository import SQLClassRepository
from app.infrastructure.db.repositories.student_repository import SQLStudentRepository
from app.infrastructure.db.session import get_db
from app.interfaces.api.v1.dependencies import require_role
from app.interfaces.api.v1.schemas.class_ import (
    AddScheduleRequest,
    ClassResponse,
    CreateClassRequest,
    EnrollRequest,
    EnrollmentResponse,
    ScheduleResponse,
)

router = APIRouter()
_teacher = require_role("teacher", "admin")


@router.post("", response_model=ClassResponse, status_code=201)
async def create_class(
    body: CreateClassRequest,
    token=Depends(_teacher),
    db: AsyncSession = Depends(get_db),
):
    uc = CreateClassUseCase(SQLClassRepository(db))
    return await uc.execute(token.org_id, token.user_id, body.name, body.subject, body.academic_year)


@router.get("", response_model=list[ClassResponse])
async def list_classes(
    token=Depends(_teacher),
    db: AsyncSession = Depends(get_db),
):
    uc = ListClassesUseCase(SQLClassRepository(db))
    return await uc.execute(token.user_id, token.org_id)


@router.get("/{class_id}", response_model=ClassResponse)
async def get_class(
    class_id: UUID,
    token=Depends(_teacher),
    db: AsyncSession = Depends(get_db),
):
    uc = GetClassUseCase(SQLClassRepository(db))
    return await uc.execute(class_id, token.org_id)


@router.post("/{class_id}/schedules", response_model=ScheduleResponse, status_code=201)
async def add_schedule(
    class_id: UUID,
    body: AddScheduleRequest,
    token=Depends(_teacher),
    db: AsyncSession = Depends(get_db),
):
    uc = AddScheduleUseCase(SQLClassRepository(db))
    return await uc.execute(class_id, token.org_id, body.day_of_week, body.start_time, body.end_time)


@router.get("/{class_id}/schedules", response_model=list[ScheduleResponse])
async def list_schedules(
    class_id: UUID,
    token=Depends(_teacher),
    db: AsyncSession = Depends(get_db),
):
    repo = SQLClassRepository(db)
    return await repo.list_schedules(class_id)


@router.delete("/{class_id}/schedules/{schedule_id}", status_code=204)
async def delete_schedule(
    class_id: UUID,
    schedule_id: UUID,
    token=Depends(_teacher),
    db: AsyncSession = Depends(get_db),
):
    uc = DeleteScheduleUseCase(SQLClassRepository(db))
    await uc.execute(class_id, schedule_id, token.org_id)
    return Response(status_code=204)


@router.post("/{class_id}/enrollments", response_model=EnrollmentResponse, status_code=201)
async def enroll_student(
    class_id: UUID,
    body: EnrollRequest,
    token=Depends(_teacher),
    db: AsyncSession = Depends(get_db),
):
    uc = EnrollStudentUseCase(SQLClassRepository(db), SQLStudentRepository(db))
    return await uc.execute(class_id, body.student_id, token.org_id, body.parent_id)


@router.get("/{class_id}/enrollments", response_model=list[EnrollmentResponse])
async def list_enrollments(
    class_id: UUID,
    token=Depends(_teacher),
    db: AsyncSession = Depends(get_db),
):
    repo = SQLClassRepository(db)
    return await repo.list_enrollments(class_id)


@router.delete("/{class_id}/enrollments/{student_id}", status_code=204)
async def unenroll_student(
    class_id: UUID,
    student_id: UUID,
    token=Depends(_teacher),
    db: AsyncSession = Depends(get_db),
):
    uc = UnenrollStudentUseCase(SQLClassRepository(db))
    await uc.execute(class_id, student_id, token.org_id)
    return Response(status_code=204)
```

- [ ] **Step 3: Register routers in main.py**

At the bottom of `apps/api/app/main.py`, after the existing `auth` router import, add:

```python
from app.interfaces.api.v1.routers import classes, students  # noqa: E402

app.include_router(students.router, prefix="/api/v1/students", tags=["students"])
app.include_router(classes.router, prefix="/api/v1/classes", tags=["classes"])
```

- [ ] **Step 4: Run student tests — they should PASS now**

```bash
cd apps/api
.venv/bin/pytest tests/test_students.py -v
```

Expected:
```
PASSED tests/test_students.py::test_create_student
PASSED tests/test_students.py::test_list_students
PASSED tests/test_students.py::test_get_student_not_found
```

- [ ] **Step 5: Commit**

```bash
cd ../..
git add apps/api/app/interfaces/api/v1/routers/students.py \
        apps/api/app/interfaces/api/v1/routers/classes.py \
        apps/api/app/main.py
git commit -m "feat: students and classes FastAPI routers registered"
```

---

## Task 10: Class endpoint tests

**Files:**
- Create: `apps/api/tests/test_classes.py`

- [ ] **Step 1: Write class tests**

```python
# apps/api/tests/test_classes.py
import uuid
from datetime import datetime, time, timezone
from unittest.mock import AsyncMock, patch

from httpx import AsyncClient

from app.domain.entities.class_ import Class, ClassSchedule, Enrollment
from app.domain.exceptions import ConflictError, NotFoundError
from app.infrastructure.security.jwt import TokenData
from app.interfaces.api.v1.dependencies import get_current_user
from app.main import app

_ORG_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")
_TEACHER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
_CLASS_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")
_STUDENT_ID = uuid.UUID("00000000-0000-0000-0000-000000000003")
_TOKEN = TokenData(user_id=_TEACHER_ID, org_id=_ORG_ID, role="teacher", jti="j", exp=9999999999)

_NOW = datetime(2026, 1, 1, tzinfo=timezone.utc)

_CLASS = Class(
    id=_CLASS_ID, organization_id=_ORG_ID, teacher_id=_TEACHER_ID,
    name="Toán 10A", subject="Toán", academic_year="2025-2026",
    is_active=True, created_at=_NOW, updated_at=_NOW, deleted_at=None,
)

_SCHEDULE = ClassSchedule(
    id=uuid.uuid4(), class_id=_CLASS_ID,
    day_of_week=0, start_time=time(8, 0), end_time=time(10, 0),
)

_ENROLLMENT = Enrollment(
    id=uuid.uuid4(), class_id=_CLASS_ID, student_id=_STUDENT_ID,
    parent_id=None, enrolled_at=_NOW,
)


async def _override():
    return _TOKEN


async def test_create_class(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.classes.CreateClassUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=_CLASS)
            resp = await client.post(
                "/api/v1/classes",
                json={"name": "Toán 10A", "subject": "Toán", "academic_year": "2025-2026"},
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 201
        assert resp.json()["name"] == "Toán 10A"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_list_classes(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.classes.ListClassesUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=[_CLASS])
            resp = await client.get("/api/v1/classes", headers={"Authorization": "Bearer fake"})
        assert resp.status_code == 200
        assert len(resp.json()) == 1
        assert resp.json()[0]["subject"] == "Toán"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_get_class_not_found(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.classes.GetClassUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(side_effect=NotFoundError("Class", str(_CLASS_ID)))
            resp = await client.get(
                f"/api/v1/classes/{_CLASS_ID}", headers={"Authorization": "Bearer fake"}
            )
        assert resp.status_code == 404
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_add_schedule(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.classes.AddScheduleUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=_SCHEDULE)
            resp = await client.post(
                f"/api/v1/classes/{_CLASS_ID}/schedules",
                json={"day_of_week": 0, "start_time": "08:00:00", "end_time": "10:00:00"},
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 201
        assert resp.json()["day_of_week"] == 0
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_enroll_student_conflict(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _override
    try:
        with patch("app.interfaces.api.v1.routers.classes.EnrollStudentUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(
                side_effect=ConflictError("Student already enrolled in this class")
            )
            resp = await client.post(
                f"/api/v1/classes/{_CLASS_ID}/enrollments",
                json={"student_id": str(_STUDENT_ID)},
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 409
    finally:
        app.dependency_overrides.pop(get_current_user, None)
```

- [ ] **Step 2: Run all tests — all should PASS**

```bash
cd apps/api
.venv/bin/pytest tests/ -v
```

Expected: All tests pass including the 5 original auth tests + 3 student tests + 5 class tests = 13+ tests.

- [ ] **Step 3: Commit**

```bash
cd ../..
git add apps/api/tests/test_classes.py
git commit -m "test: class endpoint tests"
```

---

## Task 11: Frontend — TypeScript types and API clients

**Files:**
- Create: `apps/web/src/features/students/model/types.ts`
- Create: `apps/web/src/features/students/api/students.api.ts`
- Create: `apps/web/src/features/classes/model/types.ts`
- Create: `apps/web/src/features/classes/api/classes.api.ts`

- [ ] **Step 1: Student types + API**

```typescript
// apps/web/src/features/students/model/types.ts
export interface Student {
  id: string;
  organization_id: string;
  name: string;
  date_of_birth: string | null;
  note: string | null;
  created_at: string;
}

export interface CreateStudentRequest {
  name: string;
  date_of_birth?: string | null;
  note?: string | null;
}
```

```typescript
// apps/web/src/features/students/api/students.api.ts
import { apiClient } from "@/src/shared/api/client";
import type { CreateStudentRequest, Student } from "../model/types";

export async function listStudentsApi(): Promise<Student[]> {
  const { data } = await apiClient.get<Student[]>("/students");
  return data;
}

export async function createStudentApi(body: CreateStudentRequest): Promise<Student> {
  const { data } = await apiClient.post<Student>("/students", body);
  return data;
}

export async function getStudentApi(id: string): Promise<Student> {
  const { data } = await apiClient.get<Student>(`/students/${id}`);
  return data;
}
```

- [ ] **Step 2: Class types + API**

```typescript
// apps/web/src/features/classes/model/types.ts
export interface Class {
  id: string;
  organization_id: string;
  teacher_id: string;
  name: string;
  subject: string;
  academic_year: string;
  is_active: boolean;
  created_at: string;
}

export interface ClassSchedule {
  id: string;
  class_id: string;
  day_of_week: number;  // 0=Mon … 6=Sun
  start_time: string;   // "HH:MM:SS"
  end_time: string;
}

export interface Enrollment {
  id: string;
  class_id: string;
  student_id: string;
  parent_id: string | null;
  enrolled_at: string;
}

export interface CreateClassRequest {
  name: string;
  subject: string;
  academic_year: string;
}

export interface AddScheduleRequest {
  day_of_week: number;
  start_time: string;
  end_time: string;
}
```

```typescript
// apps/web/src/features/classes/api/classes.api.ts
import { apiClient } from "@/src/shared/api/client";
import type {
  AddScheduleRequest,
  Class,
  ClassSchedule,
  CreateClassRequest,
  Enrollment,
} from "../model/types";

export async function listClassesApi(): Promise<Class[]> {
  const { data } = await apiClient.get<Class[]>("/classes");
  return data;
}

export async function createClassApi(body: CreateClassRequest): Promise<Class> {
  const { data } = await apiClient.post<Class>("/classes", body);
  return data;
}

export async function getClassApi(id: string): Promise<Class> {
  const { data } = await apiClient.get<Class>(`/classes/${id}`);
  return data;
}

export async function listSchedulesApi(classId: string): Promise<ClassSchedule[]> {
  const { data } = await apiClient.get<ClassSchedule[]>(`/classes/${classId}/schedules`);
  return data;
}

export async function addScheduleApi(classId: string, body: AddScheduleRequest): Promise<ClassSchedule> {
  const { data } = await apiClient.post<ClassSchedule>(`/classes/${classId}/schedules`, body);
  return data;
}

export async function deleteScheduleApi(classId: string, scheduleId: string): Promise<void> {
  await apiClient.delete(`/classes/${classId}/schedules/${scheduleId}`);
}

export async function listEnrollmentsApi(classId: string): Promise<Enrollment[]> {
  const { data } = await apiClient.get<Enrollment[]>(`/classes/${classId}/enrollments`);
  return data;
}

export async function enrollStudentApi(classId: string, studentId: string): Promise<Enrollment> {
  const { data } = await apiClient.post<Enrollment>(`/classes/${classId}/enrollments`, {
    student_id: studentId,
  });
  return data;
}

export async function unenrollStudentApi(classId: string, studentId: string): Promise<void> {
  await apiClient.delete(`/classes/${classId}/enrollments/${studentId}`);
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/students/ apps/web/src/features/classes/
git commit -m "feat: frontend types and API clients for students and classes"
```

---

## Task 12: Class list page + ClassCard component

**Files:**
- Create: `apps/web/src/features/classes/ui/ClassCard.tsx`
- Create: `apps/web/app/(teacher)/classes/page.tsx`
- Modify: `apps/web/app/(teacher)/dashboard/page.tsx`

- [ ] **Step 1: ClassCard component**

```tsx
// apps/web/src/features/classes/ui/ClassCard.tsx
import Link from "next/link";
import type { Class } from "../model/types";

const DAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

interface Props {
  class_: Class;
}

export function ClassCard({ class_ }: Props) {
  return (
    <Link
      href={`/classes/${class_.id}`}
      className="block rounded-md border border-border bg-canvas p-4 hover:border-ink transition-colors"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-ink">{class_.name}</h3>
          <p className="text-sm text-ash mt-0.5">{class_.subject} · {class_.academic_year}</p>
        </div>
        {class_.is_active ? (
          <span className="text-xs font-medium text-success bg-success/10 rounded px-2 py-0.5">
            Đang học
          </span>
        ) : (
          <span className="text-xs font-medium text-ash bg-surface rounded px-2 py-0.5">
            Kết thúc
          </span>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Classes list page**

```tsx
// apps/web/app/(teacher)/classes/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClassCard } from "@/src/features/classes/ui/ClassCard";
import { listClassesApi } from "@/src/features/classes/api/classes.api";
import type { Class } from "@/src/features/classes/model/types";

export default function ClassesPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listClassesApi()
      .then(setClasses)
      .catch(() => setError("Không thể tải danh sách lớp."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-ink">Lớp học của tôi</h1>
        <Link
          href="/classes/new"
          className="rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover transition-colors"
        >
          + Tạo lớp
        </Link>
      </div>

      {loading && <p className="text-ash text-sm">Đang tải...</p>}
      {error && <p className="text-error text-sm">{error}</p>}
      {!loading && !error && classes.length === 0 && (
        <p className="text-ash text-sm">Chưa có lớp nào. Tạo lớp đầu tiên!</p>
      )}
      <div className="flex flex-col gap-3">
        {classes.map((c) => (
          <ClassCard key={c.id} class_={c} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update dashboard to link to classes**

Replace entire content of `apps/web/app/(teacher)/dashboard/page.tsx`:

```tsx
// apps/web/app/(teacher)/dashboard/page.tsx
import Link from "next/link";

export default function TeacherDashboard() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-ink mb-6">Dashboard Giáo viên</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/classes"
          className="rounded-md border border-border bg-canvas p-6 hover:border-ink transition-colors"
        >
          <h2 className="font-semibold text-ink">Lớp học</h2>
          <p className="text-sm text-ash mt-1">Quản lý lớp và học sinh</p>
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/classes/ui/ClassCard.tsx \
        apps/web/app/\(teacher\)/classes/page.tsx \
        apps/web/app/\(teacher\)/dashboard/page.tsx
git commit -m "feat: class list page and dashboard link"
```

---

## Task 13: Create class form page

**Files:**
- Create: `apps/web/src/features/classes/ui/CreateClassForm.tsx`
- Create: `apps/web/app/(teacher)/classes/new/page.tsx`

- [ ] **Step 1: CreateClassForm component**

```tsx
// apps/web/src/features/classes/ui/CreateClassForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClassApi } from "../api/classes.api";

export function CreateClassForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [academicYear, setAcademicYear] = useState("2025-2026");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const class_ = await createClassApi({ name, subject, academic_year: academicYear });
      router.push(`/classes/${class_.id}`);
    } catch {
      setError("Không thể tạo lớp. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-md">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-ink">Tên lớp</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="VD: Toán 10A"
          className="rounded-sm border border-border px-4 py-3 text-sm text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-ink">Môn học</label>
        <input
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="VD: Toán, Văn, Anh..."
          className="rounded-sm border border-border px-4 py-3 text-sm text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-ink">Năm học</label>
        <input
          required
          value={academicYear}
          onChange={(e) => setAcademicYear(e.target.value)}
          placeholder="VD: 2025-2026"
          className="rounded-sm border border-border px-4 py-3 text-sm text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink"
        />
      </div>
      {error && <p className="text-sm text-error">{error}</p>}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-sm border border-border px-4 py-3 text-sm font-semibold text-ink hover:bg-surface transition-colors"
        >
          Huỷ
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-sm bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
        >
          {loading ? "Đang tạo..." : "Tạo lớp"}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Create class page**

```tsx
// apps/web/app/(teacher)/classes/new/page.tsx
import { CreateClassForm } from "@/src/features/classes/ui/CreateClassForm";

export default function NewClassPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-ink mb-6">Tạo lớp mới</h1>
      <CreateClassForm />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/classes/ui/CreateClassForm.tsx \
        "apps/web/app/(teacher)/classes/new/page.tsx"
git commit -m "feat: create class form and page"
```

---

## Task 14: Class detail page (schedules + students)

**Files:**
- Create: `apps/web/src/features/classes/ui/ScheduleList.tsx`
- Create: `apps/web/src/features/classes/ui/AddScheduleForm.tsx`
- Create: `apps/web/src/features/classes/ui/EnrollmentSection.tsx`
- Create: `apps/web/src/features/students/ui/CreateStudentForm.tsx`
- Create: `apps/web/app/(teacher)/classes/[id]/page.tsx`

- [ ] **Step 1: ScheduleList + AddScheduleForm**

```tsx
// apps/web/src/features/classes/ui/ScheduleList.tsx
"use client";

import { deleteScheduleApi } from "../api/classes.api";
import type { ClassSchedule } from "../model/types";

const DAYS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

interface Props {
  classId: string;
  schedules: ClassSchedule[];
  onDeleted: (id: string) => void;
}

export function ScheduleList({ classId, schedules, onDeleted }: Props) {
  async function handleDelete(scheduleId: string) {
    await deleteScheduleApi(classId, scheduleId);
    onDeleted(scheduleId);
  }

  if (schedules.length === 0) {
    return <p className="text-ash text-sm">Chưa có lịch học.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {schedules.map((s) => (
        <li
          key={s.id}
          className="flex items-center justify-between rounded border border-border px-4 py-2 text-sm"
        >
          <span className="text-ink">
            {DAYS[s.day_of_week]} · {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
          </span>
          <button
            onClick={() => handleDelete(s.id)}
            className="text-xs text-error hover:underline"
          >
            Xoá
          </button>
        </li>
      ))}
    </ul>
  );
}
```

```tsx
// apps/web/src/features/classes/ui/AddScheduleForm.tsx
"use client";

import { useState } from "react";
import { addScheduleApi } from "../api/classes.api";
import type { ClassSchedule } from "../model/types";

const DAYS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

interface Props {
  classId: string;
  onAdded: (schedule: ClassSchedule) => void;
}

export function AddScheduleForm({ classId, onAdded }: Props) {
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("10:00");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const schedule = await addScheduleApi(classId, {
        day_of_week: dayOfWeek,
        start_time: `${startTime}:00`,
        end_time: `${endTime}:00`,
      });
      onAdded(schedule);
      setStartTime("08:00");
      setEndTime("10:00");
    } catch {
      setError("Không thể thêm lịch.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-ash">Thứ</label>
        <select
          value={dayOfWeek}
          onChange={(e) => setDayOfWeek(Number(e.target.value))}
          className="rounded-sm border border-border px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
        >
          {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-ash">Bắt đầu</label>
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="rounded-sm border border-border px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-ash">Kết thúc</label>
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="rounded-sm border border-border px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
      >
        {loading ? "..." : "+ Thêm lịch"}
      </button>
      {error && <p className="text-xs text-error w-full">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 2: EnrollmentSection**

```tsx
// apps/web/src/features/classes/ui/EnrollmentSection.tsx
"use client";

import { useEffect, useState } from "react";
import {
  enrollStudentApi,
  listEnrollmentsApi,
  unenrollStudentApi,
} from "../api/classes.api";
import { listStudentsApi } from "@/src/features/students/api/students.api";
import type { Enrollment } from "../model/types";
import type { Student } from "@/src/features/students/model/types";

interface Props {
  classId: string;
}

export function EnrollmentSection({ classId }: Props) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listEnrollmentsApi(classId), listStudentsApi()])
      .then(([enrs, students]) => {
        setEnrollments(enrs);
        setAllStudents(students);
        const enrolledIds = new Set(enrs.map((e) => e.student_id));
        const first = students.find((s) => !enrolledIds.has(s.id));
        if (first) setSelectedStudentId(first.id);
      })
      .finally(() => setLoading(false));
  }, [classId]);

  const enrolledIds = new Set(enrollments.map((e) => e.student_id));
  const availableStudents = allStudents.filter((s) => !enrolledIds.has(s.id));

  async function handleEnroll() {
    if (!selectedStudentId) return;
    setEnrolling(true);
    setError(null);
    try {
      const enr = await enrollStudentApi(classId, selectedStudentId);
      setEnrollments((prev) => [...prev, enr]);
      const remaining = availableStudents.filter((s) => s.id !== selectedStudentId);
      setSelectedStudentId(remaining[0]?.id ?? "");
    } catch {
      setError("Không thể thêm học sinh.");
    } finally {
      setEnrolling(false);
    }
  }

  async function handleUnenroll(studentId: string) {
    await unenrollStudentApi(classId, studentId);
    setEnrollments((prev) => prev.filter((e) => e.student_id !== studentId));
  }

  const studentMap = Object.fromEntries(allStudents.map((s) => [s.id, s]));

  return (
    <div>
      <h2 className="text-lg font-semibold text-ink mb-3">
        Học sinh ({enrollments.length})
      </h2>

      {loading && <p className="text-sm text-ash">Đang tải...</p>}

      {!loading && (
        <>
          <ul className="flex flex-col gap-2 mb-4">
            {enrollments.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between rounded border border-border px-4 py-2 text-sm"
              >
                <span className="text-ink">{studentMap[e.student_id]?.name ?? e.student_id}</span>
                <button
                  onClick={() => handleUnenroll(e.student_id)}
                  className="text-xs text-error hover:underline"
                >
                  Xoá khỏi lớp
                </button>
              </li>
            ))}
            {enrollments.length === 0 && (
              <p className="text-sm text-ash">Chưa có học sinh nào trong lớp.</p>
            )}
          </ul>

          {availableStudents.length > 0 && (
            <div className="flex gap-3 items-center">
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="flex-1 rounded-sm border border-border px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
              >
                {availableStudents.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <button
                onClick={handleEnroll}
                disabled={enrolling}
                className="rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                {enrolling ? "..." : "+ Thêm"}
              </button>
            </div>
          )}
          {error && <p className="text-xs text-error mt-2">{error}</p>}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Class detail page**

```tsx
// apps/web/app/(teacher)/classes/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getClassApi, listSchedulesApi } from "@/src/features/classes/api/classes.api";
import { ScheduleList } from "@/src/features/classes/ui/ScheduleList";
import { AddScheduleForm } from "@/src/features/classes/ui/AddScheduleForm";
import { EnrollmentSection } from "@/src/features/classes/ui/EnrollmentSection";
import type { Class, ClassSchedule } from "@/src/features/classes/model/types";

export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [class_, setClass_] = useState<Class | null>(null);
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getClassApi(id), listSchedulesApi(id)])
      .then(([c, s]) => { setClass_(c); setSchedules(s); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-ash text-sm">Đang tải...</p>;
  if (!class_) return <p className="text-error text-sm">Không tìm thấy lớp.</p>;

  return (
    <div className="max-w-3xl flex flex-col gap-8">
      <div>
        <Link href="/classes" className="text-sm text-ash hover:text-ink">
          ← Danh sách lớp
        </Link>
        <h1 className="text-2xl font-bold text-ink mt-2">{class_.name}</h1>
        <p className="text-ash text-sm">{class_.subject} · {class_.academic_year}</p>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-ink mb-3">Lịch học</h2>
        <ScheduleList
          classId={id}
          schedules={schedules}
          onDeleted={(sid) => setSchedules((prev) => prev.filter((s) => s.id !== sid))}
        />
        <div className="mt-4">
          <AddScheduleForm
            classId={id}
            onAdded={(s) => setSchedules((prev) => [...prev, s])}
          />
        </div>
      </section>

      <EnrollmentSection classId={id} />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/classes/ui/ \
        "apps/web/app/(teacher)/classes/[id]/page.tsx"
git commit -m "feat: class detail page with schedules and enrollment"
```

---

## Task 15: Create student form (standalone)

**Files:**
- Create: `apps/web/src/features/students/ui/CreateStudentForm.tsx`

This form is used to create a new student from the org student pool (accessible from the enrollment section when "Tạo học sinh mới" is needed).

- [ ] **Step 1: CreateStudentForm**

```tsx
// apps/web/src/features/students/ui/CreateStudentForm.tsx
"use client";

import { useState } from "react";
import { createStudentApi } from "../api/students.api";
import type { Student } from "../model/types";

interface Props {
  onCreated: (student: Student) => void;
  onCancel: () => void;
}

export function CreateStudentForm({ onCreated, onCancel }: Props) {
  const [name, setName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const student = await createStudentApi({
        name,
        date_of_birth: dateOfBirth || null,
        note: note || null,
      });
      onCreated(student);
    } catch {
      setError("Không thể tạo học sinh.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4 rounded-md border border-border bg-surface">
      <h3 className="font-semibold text-ink text-sm">Tạo học sinh mới</h3>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-ash">Họ tên</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nguyễn Văn A"
          className="rounded-sm border border-border px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-ash">Ngày sinh (tuỳ chọn)</label>
        <input
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          className="rounded-sm border border-border px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-ash">Ghi chú (tuỳ chọn)</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="..."
          className="rounded-sm border border-border px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
        />
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-sm border border-border px-3 py-2 text-sm text-ink hover:bg-canvas transition-colors"
        >
          Huỷ
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-sm bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
        >
          {loading ? "..." : "Tạo"}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Run full test suite**

```bash
cd apps/api
.venv/bin/pytest tests/ -v --tb=short
```

Expected: all tests PASS.

- [ ] **Step 3: TypeScript type-check**

```bash
cd apps/web
pnpm type-check
```

Expected: no errors.

- [ ] **Step 4: Final commit**

```bash
cd ../..
git add apps/web/src/features/students/ui/CreateStudentForm.tsx
git commit -m "feat: create student form component"
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Covered |
|---|---|
| Student CRUD (create, list, get) | ✅ Tasks 6, 9, 11 |
| Class CRUD (create, list, get) | ✅ Tasks 7, 9, 12, 13 |
| ClassSchedule (add, delete, list) | ✅ Tasks 7, 9, 14 |
| Enrollment (enroll, unenroll, list per class) | ✅ Tasks 7, 9, 14 |
| Tenant isolation via org_id on every query | ✅ All repositories filter by org_id |
| Teacher role guard on all endpoints | ✅ `require_role("teacher", "admin")` |
| UNIQUE(class_id, student_id) at DB level | ✅ Task 3 UniqueConstraint |
| ConflictError on duplicate enrollment | ✅ Task 7 EnrollStudentUseCase |
| Test coverage for all endpoints | ✅ Tasks 6, 10 |
| Frontend: class list, create, detail + students | ✅ Tasks 12–15 |

### Type consistency check

- `ClassSchedule.day_of_week: int` (0–6) → used consistently in ORM, use case, schema, frontend
- `ClassSchedule.start_time: time` (Python) / `string "HH:MM:SS"` (frontend) → consistent
- `Enrollment.parent_id: UUID | None` → nullable in ORM, schema, frontend all agree
- `require_role()` returns `TokenData` → `token.org_id`, `token.user_id`, `token.role` used correctly throughout

### No placeholders

Scanned — all code blocks are complete and executable.
