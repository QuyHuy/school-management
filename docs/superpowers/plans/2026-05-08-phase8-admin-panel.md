# Phase 8: Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a desktop-first Admin Panel for center managers to manage teachers, view dashboard stats, generate reports, and configure center settings — all protected by `role=admin`.

**Architecture:** Backend adds `/api/v1/admin/*` router with `require_role("admin")`; use cases query `AsyncSession` directly for aggregate reads; DB migration adds 4 nullable columns to `organizations`; `IUserRepository` gets 2 new abstract methods. Frontend adds `(admin)` route group with sidebar layout and `src/features/admin/` feature module; admin login reuses `LoginForm` with `expectedRole="admin"`.

**Tech Stack:** FastAPI + SQLAlchemy 2.0 async + Alembic + bcrypt (backend), Next.js 15 App Router + Zustand + Axios + Tailwind custom tokens (frontend), pytest-asyncio (tests).

---

## File Map

**New backend files:**
- `apps/api/alembic/versions/<rev>_add_org_fields.py`
- `apps/api/app/domain/entities/admin.py`
- `apps/api/app/application/use_cases/admin/__init__.py`
- `apps/api/app/application/use_cases/admin/list_teachers.py`
- `apps/api/app/application/use_cases/admin/create_teacher.py`
- `apps/api/app/application/use_cases/admin/get_teacher.py`
- `apps/api/app/application/use_cases/admin/update_teacher.py`
- `apps/api/app/application/use_cases/admin/reset_password.py`
- `apps/api/app/application/use_cases/admin/toggle_teacher.py`
- `apps/api/app/application/use_cases/admin/get_admin_dashboard.py`
- `apps/api/app/application/use_cases/admin/get_report_attendance.py`
- `apps/api/app/application/use_cases/admin/get_report_grades.py`
- `apps/api/app/application/use_cases/admin/get_settings.py`
- `apps/api/app/application/use_cases/admin/update_settings.py`
- `apps/api/app/interfaces/api/v1/schemas/admin.py`
- `apps/api/app/interfaces/api/v1/routers/admin.py`
- `apps/api/tests/test_admin.py`

**Modified backend files:**
- `apps/api/app/domain/entities/user.py` — add 4 fields to `Organization`
- `apps/api/app/infrastructure/db/models/user.py` — add 4 columns to `OrganizationModel`
- `apps/api/app/domain/repositories/user_repository.py` — add `update_password`, `set_active` abstract methods
- `apps/api/app/infrastructure/db/repositories/user_repository.py` — implement new methods
- `apps/api/app/main.py` — register admin router

**New frontend files:**
- `apps/web/src/features/admin/model/types.ts`
- `apps/web/src/features/admin/api/admin.api.ts`
- `apps/web/app/(auth)/login/admin/page.tsx`
- `apps/web/app/(admin)/dashboard/page.tsx`
- `apps/web/app/(admin)/teachers/page.tsx`
- `apps/web/app/(admin)/teachers/new/page.tsx`
- `apps/web/app/(admin)/teachers/[id]/page.tsx`
- `apps/web/app/(admin)/reports/attendance/page.tsx`
- `apps/web/app/(admin)/reports/grades/page.tsx`
- `apps/web/app/(admin)/settings/page.tsx`

**Modified frontend files:**
- `apps/web/app/(admin)/layout.tsx` — flesh out sidebar nav + auth guard

---

## Task 1: DB Migration — Add fields to `organizations`

**Files:**
- Modify: `apps/api/app/domain/entities/user.py`
- Modify: `apps/api/app/infrastructure/db/models/user.py`
- Create: `apps/api/alembic/versions/<rev>_add_org_fields.py` (via autogenerate)

- [ ] **Step 1: Update `Organization` entity**

In `apps/api/app/domain/entities/user.py`, add 4 fields to the `Organization` dataclass:

```python
@dataclass
class Organization:
    id: UUID
    name: str
    phone: str | None          # new
    address: str | None        # new
    academic_year: str | None  # new
    logo_url: str | None       # new
    zalo_oa_id: str | None
    zalo_oa_token_encrypted: str | None
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 2: Update `OrganizationModel`**

In `apps/api/app/infrastructure/db/models/user.py`, add `Text` to imports and 4 new columns:

```python
from sqlalchemy import Boolean, DateTime, Enum as SAEnum, ForeignKey, String, Text
# ...

class OrganizationModel(Base):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    academic_year: Mapped[str | None] = mapped_column(String(20), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    zalo_oa_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    zalo_oa_token_encrypted: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)
```

- [ ] **Step 3: Generate and apply migration**

```bash
cd apps/api
docker compose exec api alembic revision --autogenerate -m "add_org_fields"
```

Open the generated file and verify the `upgrade()` contains exactly these 4 `add_column` calls (autogenerate may need cleanup):

```python
def upgrade() -> None:
    op.add_column('organizations', sa.Column('phone', sa.String(length=20), nullable=True))
    op.add_column('organizations', sa.Column('address', sa.Text(), nullable=True))
    op.add_column('organizations', sa.Column('academic_year', sa.String(length=20), nullable=True))
    op.add_column('organizations', sa.Column('logo_url', sa.String(length=500), nullable=True))

def downgrade() -> None:
    op.drop_column('organizations', 'logo_url')
    op.drop_column('organizations', 'academic_year')
    op.drop_column('organizations', 'address')
    op.drop_column('organizations', 'phone')
```

Then apply:
```bash
docker compose exec api alembic upgrade head
```

Expected output ends with: `Running upgrade ... -> <rev>, add_org_fields`

- [ ] **Step 4: Commit**

```bash
git add apps/api/app/domain/entities/user.py \
        apps/api/app/infrastructure/db/models/user.py \
        apps/api/alembic/versions/
git commit -m "feat: add phone/address/academic_year/logo_url to organizations"
```

---

## Task 2: Extend `IUserRepository` with `update_password` + `set_active`

**Files:**
- Modify: `apps/api/app/domain/repositories/user_repository.py`
- Modify: `apps/api/app/infrastructure/db/repositories/user_repository.py`

- [ ] **Step 1: Add abstract methods to interface**

In `apps/api/app/domain/repositories/user_repository.py`, add after `update`:

```python
    @abstractmethod
    async def update_password(self, user_id: UUID, new_hash: str) -> None: ...

    @abstractmethod
    async def set_active(self, user_id: UUID, is_active: bool) -> None: ...
```

- [ ] **Step 2: Implement in `SQLUserRepository`**

In `apps/api/app/infrastructure/db/repositories/user_repository.py`, add at the end of the class:

```python
    async def update_password(self, user_id: UUID, new_hash: str) -> None:
        result = await self._session.execute(
            select(UserModel).where(UserModel.id == user_id, UserModel.deleted_at.is_(None))
        )
        row = result.scalar_one_or_none()
        if not row:
            raise ValueError(f"User {user_id} not found")
        row.password_hash = new_hash
        await self._session.flush()

    async def set_active(self, user_id: UUID, is_active: bool) -> None:
        result = await self._session.execute(
            select(UserModel).where(UserModel.id == user_id, UserModel.deleted_at.is_(None))
        )
        row = result.scalar_one_or_none()
        if not row:
            raise ValueError(f"User {user_id} not found")
        row.is_active = is_active
        await self._session.flush()
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/app/domain/repositories/user_repository.py \
        apps/api/app/infrastructure/db/repositories/user_repository.py
git commit -m "feat: add update_password and set_active to IUserRepository"
```

---

## Task 3: Admin Domain Entities

**Files:**
- Create: `apps/api/app/domain/entities/admin.py`

- [ ] **Step 1: Create entities file**

Create `apps/api/app/domain/entities/admin.py`:

```python
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID


@dataclass
class TeacherClassInfo:
    id: UUID
    name: str
    subject: str
    academic_year: str
    is_active: bool
    student_count: int


@dataclass
class TeacherInfo:
    id: UUID
    name: str
    email: str | None
    phone: str | None
    is_active: bool
    created_at: datetime
    class_count: int
    student_count: int
    sessions_this_month: int


@dataclass
class TeacherDetail:
    id: UUID
    name: str
    email: str | None
    phone: str | None
    is_active: bool
    created_at: datetime
    classes: list[TeacherClassInfo] = field(default_factory=list)
    total_students: int = 0


@dataclass
class AdminDashboard:
    total_teachers: int
    total_classes: int
    total_students: int
    total_active_classes: int
    attendance_rate_this_month: float
    sessions_this_month: int
    teachers: list[TeacherInfo] = field(default_factory=list)


@dataclass
class AttendanceReportRow:
    teacher_name: str
    class_name: str
    subject: str
    total_sessions: int
    total_attendances: int
    present: int
    absent: int
    attendance_rate: float


@dataclass
class GradeReportRow:
    teacher_name: str
    class_name: str
    subject: str
    student_count: int
    avg_score: float
    min_score: float
    max_score: float


@dataclass
class OrgSettings:
    name: str
    phone: str | None
    address: str | None
    academic_year: str | None
    logo_url: str | None
    zalo_oa_id: str | None
    zalo_oa_token: str | None
```

- [ ] **Step 2: Create `__init__.py` for use cases package**

```bash
touch apps/api/app/application/use_cases/admin/__init__.py
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/app/domain/entities/admin.py \
        apps/api/app/application/use_cases/admin/__init__.py
git commit -m "feat: add admin domain entities"
```

---

## Task 4: Admin Use Cases — Teacher Management

**Files:**
- Create: `apps/api/app/application/use_cases/admin/list_teachers.py`
- Create: `apps/api/app/application/use_cases/admin/create_teacher.py`
- Create: `apps/api/app/application/use_cases/admin/get_teacher.py`
- Create: `apps/api/app/application/use_cases/admin/update_teacher.py`
- Create: `apps/api/app/application/use_cases/admin/reset_password.py`
- Create: `apps/api/app/application/use_cases/admin/toggle_teacher.py`

- [ ] **Step 1: Create `list_teachers.py`**

```python
from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.admin import TeacherInfo
from app.infrastructure.db.models.attendance import ClassSessionModel
from app.infrastructure.db.models.class_ import ClassModel, EnrollmentModel
from app.infrastructure.db.models.user import UserModel


class ListTeachersUseCase:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def execute(self, org_id: UUID) -> list[TeacherInfo]:
        teachers_q = await self._session.execute(
            select(UserModel).where(
                UserModel.role == "teacher",
                UserModel.organization_id == org_id,
                UserModel.deleted_at.is_(None),
            ).order_by(UserModel.name)
        )
        teachers = list(teachers_q.scalars())
        if not teachers:
            return []

        teacher_ids = [t.id for t in teachers]

        class_counts_q = await self._session.execute(
            select(ClassModel.teacher_id, func.count(ClassModel.id).label("cnt"))
            .where(
                ClassModel.teacher_id.in_(teacher_ids),
                ClassModel.organization_id == org_id,
                ClassModel.deleted_at.is_(None),
            )
            .group_by(ClassModel.teacher_id)
        )
        class_counts: dict[UUID, int] = {r.teacher_id: r.cnt for r in class_counts_q}

        student_counts_q = await self._session.execute(
            select(
                ClassModel.teacher_id,
                func.count(func.distinct(EnrollmentModel.student_id)).label("cnt"),
            )
            .join(EnrollmentModel, EnrollmentModel.class_id == ClassModel.id)
            .where(
                ClassModel.teacher_id.in_(teacher_ids),
                ClassModel.organization_id == org_id,
                ClassModel.deleted_at.is_(None),
            )
            .group_by(ClassModel.teacher_id)
        )
        student_counts: dict[UUID, int] = {r.teacher_id: r.cnt for r in student_counts_q}

        this_month = date.today().replace(day=1)
        sessions_q = await self._session.execute(
            select(ClassModel.teacher_id, func.count(ClassSessionModel.id).label("cnt"))
            .join(ClassSessionModel, ClassSessionModel.class_id == ClassModel.id)
            .where(
                ClassModel.teacher_id.in_(teacher_ids),
                ClassModel.organization_id == org_id,
                ClassModel.deleted_at.is_(None),
                ClassSessionModel.date >= this_month,
            )
            .group_by(ClassModel.teacher_id)
        )
        sessions: dict[UUID, int] = {r.teacher_id: r.cnt for r in sessions_q}

        return [
            TeacherInfo(
                id=t.id,
                name=t.name,
                email=t.email,
                phone=t.phone,
                is_active=t.is_active,
                created_at=t.created_at,
                class_count=class_counts.get(t.id, 0),
                student_count=student_counts.get(t.id, 0),
                sessions_this_month=sessions.get(t.id, 0),
            )
            for t in teachers
        ]
```

- [ ] **Step 2: Create `create_teacher.py`**

```python
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID

from app.domain.entities.user import User, UserRole
from app.domain.exceptions import ConflictError
from app.domain.repositories.user_repository import IUserRepository
from app.infrastructure.security.password import hash_password


@dataclass
class CreateTeacherInput:
    name: str
    email: str
    password: str
    phone: str | None


class CreateTeacherUseCase:
    def __init__(self, user_repo: IUserRepository) -> None:
        self._user_repo = user_repo

    async def execute(self, org_id: UUID, inp: CreateTeacherInput) -> User:
        existing = await self._user_repo.get_by_email(inp.email)
        if existing:
            raise ConflictError(f"Email '{inp.email}' is already taken")

        now = datetime.now(timezone.utc)
        user = User(
            id=uuid.uuid4(),
            organization_id=org_id,
            email=inp.email,
            password_hash=hash_password(inp.password),
            role=UserRole.teacher,
            name=inp.name,
            phone=inp.phone,
            is_active=True,
            created_at=now,
            updated_at=now,
            deleted_at=None,
        )
        return await self._user_repo.create(user)
```

- [ ] **Step 3: Create `get_teacher.py`**

```python
from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.admin import TeacherClassInfo, TeacherDetail
from app.domain.entities.user import UserRole
from app.domain.exceptions import NotFoundError
from app.domain.repositories.user_repository import IUserRepository
from app.infrastructure.db.models.class_ import ClassModel, EnrollmentModel


class GetTeacherUseCase:
    def __init__(self, session: AsyncSession, user_repo: IUserRepository) -> None:
        self._session = session
        self._user_repo = user_repo

    async def execute(self, teacher_id: UUID, org_id: UUID) -> TeacherDetail:
        user = await self._user_repo.get_by_id(teacher_id)
        if not user or user.role != UserRole.teacher or user.organization_id != org_id:
            raise NotFoundError("Teacher", str(teacher_id))

        classes_q = await self._session.execute(
            select(ClassModel).where(
                ClassModel.teacher_id == teacher_id,
                ClassModel.organization_id == org_id,
                ClassModel.deleted_at.is_(None),
            ).order_by(ClassModel.name)
        )
        classes = list(classes_q.scalars())
        class_ids = [c.id for c in classes]

        if class_ids:
            counts_q = await self._session.execute(
                select(EnrollmentModel.class_id, func.count(EnrollmentModel.student_id).label("cnt"))
                .where(EnrollmentModel.class_id.in_(class_ids))
                .group_by(EnrollmentModel.class_id)
            )
            counts: dict[UUID, int] = {r.class_id: r.cnt for r in counts_q}
        else:
            counts = {}

        class_infos = [
            TeacherClassInfo(
                id=c.id,
                name=c.name,
                subject=c.subject,
                academic_year=c.academic_year,
                is_active=c.is_active,
                student_count=counts.get(c.id, 0),
            )
            for c in classes
        ]

        return TeacherDetail(
            id=user.id,
            name=user.name,
            email=user.email,
            phone=user.phone,
            is_active=user.is_active,
            created_at=user.created_at,
            classes=class_infos,
            total_students=sum(counts.values()),
        )
```

- [ ] **Step 4: Create `update_teacher.py`**

```python
from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from app.domain.entities.user import UserRole
from app.domain.exceptions import ConflictError, NotFoundError
from app.domain.repositories.user_repository import IUserRepository


@dataclass
class UpdateTeacherInput:
    name: str
    email: str | None
    phone: str | None


class UpdateTeacherUseCase:
    def __init__(self, user_repo: IUserRepository) -> None:
        self._user_repo = user_repo

    async def execute(self, teacher_id: UUID, org_id: UUID, inp: UpdateTeacherInput) -> None:
        user = await self._user_repo.get_by_id(teacher_id)
        if not user or user.role != UserRole.teacher or user.organization_id != org_id:
            raise NotFoundError("Teacher", str(teacher_id))

        if inp.email and inp.email != user.email:
            existing = await self._user_repo.get_by_email(inp.email)
            if existing:
                raise ConflictError(f"Email '{inp.email}' is already taken")

        user.name = inp.name
        user.email = inp.email
        user.phone = inp.phone
        await self._user_repo.update(user)
```

- [ ] **Step 5: Create `reset_password.py`**

```python
from __future__ import annotations

from uuid import UUID

from app.domain.entities.user import UserRole
from app.domain.exceptions import NotFoundError
from app.domain.repositories.user_repository import IUserRepository
from app.infrastructure.security.password import hash_password


class ResetPasswordUseCase:
    def __init__(self, user_repo: IUserRepository) -> None:
        self._user_repo = user_repo

    async def execute(self, teacher_id: UUID, org_id: UUID, new_password: str) -> None:
        user = await self._user_repo.get_by_id(teacher_id)
        if not user or user.role != UserRole.teacher or user.organization_id != org_id:
            raise NotFoundError("Teacher", str(teacher_id))
        await self._user_repo.update_password(teacher_id, hash_password(new_password))
```

- [ ] **Step 6: Create `toggle_teacher.py`**

```python
from __future__ import annotations

from uuid import UUID

from app.domain.entities.user import UserRole
from app.domain.exceptions import NotFoundError
from app.domain.repositories.user_repository import IUserRepository


class ToggleTeacherUseCase:
    def __init__(self, user_repo: IUserRepository) -> None:
        self._user_repo = user_repo

    async def execute(self, teacher_id: UUID, org_id: UUID) -> bool:
        user = await self._user_repo.get_by_id(teacher_id)
        if not user or user.role != UserRole.teacher or user.organization_id != org_id:
            raise NotFoundError("Teacher", str(teacher_id))
        new_state = not user.is_active
        await self._user_repo.set_active(teacher_id, new_state)
        return new_state
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/app/application/use_cases/admin/
git commit -m "feat: admin teacher management use cases"
```

---

## Task 5: Admin Use Cases — Dashboard, Reports, Settings

**Files:**
- Create: `apps/api/app/application/use_cases/admin/get_admin_dashboard.py`
- Create: `apps/api/app/application/use_cases/admin/get_report_attendance.py`
- Create: `apps/api/app/application/use_cases/admin/get_report_grades.py`
- Create: `apps/api/app/application/use_cases/admin/get_settings.py`
- Create: `apps/api/app/application/use_cases/admin/update_settings.py`

- [ ] **Step 1: Create `get_admin_dashboard.py`**

```python
from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.admin import AdminDashboard
from app.application.use_cases.admin.list_teachers import ListTeachersUseCase
from app.infrastructure.db.models.attendance import AttendanceRecordModel, ClassSessionModel
from app.infrastructure.db.models.class_ import ClassModel
from app.infrastructure.db.models.student import StudentModel
from app.infrastructure.db.models.user import UserModel


class GetAdminDashboardUseCase:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def execute(self, org_id: UUID) -> AdminDashboard:
        teachers = await ListTeachersUseCase(self._session).execute(org_id)

        total_teachers = len(teachers)

        classes_q = await self._session.execute(
            select(
                func.count(ClassModel.id).label("total"),
                func.sum(case((ClassModel.is_active.is_(True), 1), else_=0)).label("active"),
            ).where(ClassModel.organization_id == org_id, ClassModel.deleted_at.is_(None))
        )
        class_row = classes_q.one()
        total_classes = class_row.total or 0
        total_active_classes = class_row.active or 0

        students_q = await self._session.execute(
            select(func.count(StudentModel.id)).where(
                StudentModel.organization_id == org_id,
                StudentModel.deleted_at.is_(None),
            )
        )
        total_students = students_q.scalar_one() or 0

        this_month = date.today().replace(day=1)
        sessions_q = await self._session.execute(
            select(func.count(ClassSessionModel.id))
            .join(ClassModel, ClassModel.id == ClassSessionModel.class_id)
            .where(
                ClassModel.organization_id == org_id,
                ClassModel.deleted_at.is_(None),
                ClassSessionModel.date >= this_month,
            )
        )
        sessions_this_month = sessions_q.scalar_one() or 0

        att_q = await self._session.execute(
            select(
                func.count(AttendanceRecordModel.id).label("total"),
                func.sum(case((AttendanceRecordModel.status == "present", 1), else_=0)).label("present"),
            )
            .join(ClassSessionModel, ClassSessionModel.id == AttendanceRecordModel.session_id)
            .join(ClassModel, ClassModel.id == ClassSessionModel.class_id)
            .where(
                ClassModel.organization_id == org_id,
                ClassModel.deleted_at.is_(None),
                ClassSessionModel.date >= this_month,
            )
        )
        att_row = att_q.one()
        total_att = att_row.total or 0
        present_att = att_row.present or 0
        rate = round(present_att / total_att * 100, 1) if total_att > 0 else 0.0

        return AdminDashboard(
            total_teachers=total_teachers,
            total_classes=total_classes,
            total_students=total_students,
            total_active_classes=total_active_classes,
            attendance_rate_this_month=rate,
            sessions_this_month=sessions_this_month,
            teachers=teachers,
        )
```

- [ ] **Step 2: Create `get_report_attendance.py`**

```python
from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.admin import AttendanceReportRow
from app.infrastructure.db.models.attendance import AttendanceRecordModel, ClassSessionModel
from app.infrastructure.db.models.class_ import ClassModel
from app.infrastructure.db.models.user import UserModel


class GetReportAttendanceUseCase:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def execute(
        self,
        org_id: UUID,
        date_from: date | None,
        date_to: date | None,
        teacher_id: UUID | None,
        class_id: UUID | None,
    ) -> list[AttendanceReportRow]:
        stmt = (
            select(
                UserModel.name.label("teacher_name"),
                ClassModel.name.label("class_name"),
                ClassModel.subject,
                func.count(func.distinct(ClassSessionModel.id)).label("total_sessions"),
                func.count(AttendanceRecordModel.id).label("total_attendances"),
                func.sum(case((AttendanceRecordModel.status == "present", 1), else_=0)).label("present"),
                func.sum(case((AttendanceRecordModel.status == "absent", 1), else_=0)).label("absent"),
            )
            .join(ClassModel, ClassModel.id == ClassSessionModel.class_id)
            .join(UserModel, UserModel.id == ClassModel.teacher_id)
            .outerjoin(AttendanceRecordModel, AttendanceRecordModel.session_id == ClassSessionModel.id)
            .where(
                ClassModel.organization_id == org_id,
                ClassModel.deleted_at.is_(None),
            )
            .group_by(UserModel.name, ClassModel.name, ClassModel.subject)
            .order_by(UserModel.name, ClassModel.name)
        )

        if date_from:
            stmt = stmt.where(ClassSessionModel.date >= date_from)
        if date_to:
            stmt = stmt.where(ClassSessionModel.date <= date_to)
        if teacher_id:
            stmt = stmt.where(ClassModel.teacher_id == teacher_id)
        if class_id:
            stmt = stmt.where(ClassModel.id == class_id)

        result = await self._session.execute(stmt)
        rows = []
        for r in result:
            total = r.total_attendances or 0
            present = r.present or 0
            absent = r.absent or 0
            rate = round(present / total * 100, 1) if total > 0 else 0.0
            rows.append(AttendanceReportRow(
                teacher_name=r.teacher_name,
                class_name=r.class_name,
                subject=r.subject,
                total_sessions=r.total_sessions or 0,
                total_attendances=total,
                present=present,
                absent=absent,
                attendance_rate=rate,
            ))
        return rows
```

- [ ] **Step 3: Create `get_report_grades.py`**

```python
from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.admin import GradeReportRow
from app.infrastructure.db.models.class_ import ClassModel, EnrollmentModel
from app.infrastructure.db.models.exam import ExamModel, GradeModel
from app.infrastructure.db.models.user import UserModel


class GetReportGradesUseCase:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def execute(
        self,
        org_id: UUID,
        teacher_id: UUID | None,
        class_id: UUID | None,
    ) -> list[GradeReportRow]:
        stmt = (
            select(
                UserModel.name.label("teacher_name"),
                ClassModel.name.label("class_name"),
                ClassModel.subject,
                func.count(func.distinct(GradeModel.student_id)).label("student_count"),
                func.avg(GradeModel.score).label("avg_score"),
                func.min(GradeModel.score).label("min_score"),
                func.max(GradeModel.score).label("max_score"),
            )
            .join(ExamModel, ExamModel.id == GradeModel.exam_id)
            .join(ClassModel, ClassModel.id == ExamModel.class_id)
            .join(UserModel, UserModel.id == ClassModel.teacher_id)
            .where(
                ClassModel.organization_id == org_id,
                ClassModel.deleted_at.is_(None),
                ExamModel.deleted_at.is_(None),
            )
            .group_by(UserModel.name, ClassModel.name, ClassModel.subject)
            .order_by(UserModel.name, ClassModel.name)
        )

        if teacher_id:
            stmt = stmt.where(ClassModel.teacher_id == teacher_id)
        if class_id:
            stmt = stmt.where(ClassModel.id == class_id)

        result = await self._session.execute(stmt)
        return [
            GradeReportRow(
                teacher_name=r.teacher_name,
                class_name=r.class_name,
                subject=r.subject,
                student_count=r.student_count or 0,
                avg_score=round(float(r.avg_score or 0), 2),
                min_score=float(r.min_score or 0),
                max_score=float(r.max_score or 0),
            )
            for r in result
        ]
```

- [ ] **Step 4: Create `get_settings.py`**

```python
from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.admin import OrgSettings
from app.domain.exceptions import NotFoundError
from app.infrastructure.db.models.user import OrganizationModel


class GetSettingsUseCase:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def execute(self, org_id: UUID) -> OrgSettings:
        result = await self._session.execute(
            select(OrganizationModel).where(OrganizationModel.id == org_id)
        )
        org = result.scalar_one_or_none()
        if not org:
            raise NotFoundError("Organization", str(org_id))

        token = org.zalo_oa_token_encrypted
        if token and len(token) >= 4:
            masked = f"{'*' * (len(token) - 4)}{token[-4:]}"
        else:
            masked = token

        return OrgSettings(
            name=org.name,
            phone=org.phone,
            address=org.address,
            academic_year=org.academic_year,
            logo_url=org.logo_url,
            zalo_oa_id=org.zalo_oa_id,
            zalo_oa_token=masked,
        )
```

- [ ] **Step 5: Create `update_settings.py`**

```python
from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.exceptions import NotFoundError
from app.infrastructure.db.models.user import OrganizationModel


@dataclass
class UpdateSettingsInput:
    name: str | None
    phone: str | None
    address: str | None
    academic_year: str | None
    logo_url: str | None
    zalo_oa_id: str | None
    zalo_oa_token: str | None


class UpdateSettingsUseCase:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def execute(self, org_id: UUID, inp: UpdateSettingsInput) -> None:
        result = await self._session.execute(
            select(OrganizationModel).where(OrganizationModel.id == org_id)
        )
        org = result.scalar_one_or_none()
        if not org:
            raise NotFoundError("Organization", str(org_id))

        if inp.name is not None:
            org.name = inp.name
        if inp.phone is not None:
            org.phone = inp.phone
        if inp.address is not None:
            org.address = inp.address
        if inp.academic_year is not None:
            org.academic_year = inp.academic_year
        if inp.logo_url is not None:
            org.logo_url = inp.logo_url
        if inp.zalo_oa_id is not None:
            org.zalo_oa_id = inp.zalo_oa_id
        if inp.zalo_oa_token is not None:
            org.zalo_oa_token_encrypted = inp.zalo_oa_token

        await self._session.flush()
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/application/use_cases/admin/
git commit -m "feat: admin dashboard, reports, and settings use cases"
```

---

## Task 6: Admin Schemas + Router + Register in `main.py`

**Files:**
- Create: `apps/api/app/interfaces/api/v1/schemas/admin.py`
- Create: `apps/api/app/interfaces/api/v1/routers/admin.py`
- Modify: `apps/api/app/main.py`

- [ ] **Step 1: Create `schemas/admin.py`**

```python
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr


class TeacherClassInfoSchema(BaseModel):
    id: UUID
    name: str
    subject: str
    academic_year: str
    is_active: bool
    student_count: int


class TeacherInfoSchema(BaseModel):
    id: UUID
    name: str
    email: str | None
    phone: str | None
    is_active: bool
    created_at: datetime
    class_count: int
    student_count: int
    sessions_this_month: int


class TeacherDetailSchema(BaseModel):
    id: UUID
    name: str
    email: str | None
    phone: str | None
    is_active: bool
    created_at: datetime
    classes: list[TeacherClassInfoSchema]
    total_students: int


class AdminDashboardSchema(BaseModel):
    total_teachers: int
    total_classes: int
    total_students: int
    total_active_classes: int
    attendance_rate_this_month: float
    sessions_this_month: int
    teachers: list[TeacherInfoSchema]


class AttendanceReportRowSchema(BaseModel):
    teacher_name: str
    class_name: str
    subject: str
    total_sessions: int
    total_attendances: int
    present: int
    absent: int
    attendance_rate: float


class GradeReportRowSchema(BaseModel):
    teacher_name: str
    class_name: str
    subject: str
    student_count: int
    avg_score: float
    min_score: float
    max_score: float


class OrgSettingsSchema(BaseModel):
    name: str
    phone: str | None = None
    address: str | None = None
    academic_year: str | None = None
    logo_url: str | None = None
    zalo_oa_id: str | None = None
    zalo_oa_token: str | None = None


class AttendanceReportResponse(BaseModel):
    rows: list[AttendanceReportRowSchema]


class GradeReportResponse(BaseModel):
    rows: list[GradeReportRowSchema]


class CreateTeacherRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: str | None = None


class UpdateTeacherRequest(BaseModel):
    name: str
    email: EmailStr | None = None
    phone: str | None = None


class ResetPasswordRequest(BaseModel):
    new_password: str
```

- [ ] **Step 2: Create `routers/admin.py`**

```python
from __future__ import annotations

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.admin.create_teacher import CreateTeacherInput, CreateTeacherUseCase
from app.application.use_cases.admin.get_admin_dashboard import GetAdminDashboardUseCase
from app.application.use_cases.admin.get_report_attendance import GetReportAttendanceUseCase
from app.application.use_cases.admin.get_report_grades import GetReportGradesUseCase
from app.application.use_cases.admin.get_settings import GetSettingsUseCase
from app.application.use_cases.admin.get_teacher import GetTeacherUseCase
from app.application.use_cases.admin.list_teachers import ListTeachersUseCase
from app.application.use_cases.admin.reset_password import ResetPasswordUseCase
from app.application.use_cases.admin.toggle_teacher import ToggleTeacherUseCase
from app.application.use_cases.admin.update_settings import UpdateSettingsInput, UpdateSettingsUseCase
from app.application.use_cases.admin.update_teacher import UpdateTeacherInput, UpdateTeacherUseCase
from app.infrastructure.db.repositories.user_repository import SQLUserRepository
from app.infrastructure.db.session import get_db
from app.interfaces.api.v1.dependencies import require_role
from app.interfaces.api.v1.schemas.admin import (
    AdminDashboardSchema,
    AttendanceReportResponse,
    CreateTeacherRequest,
    GradeReportResponse,
    OrgSettingsSchema,
    ResetPasswordRequest,
    TeacherDetailSchema,
    TeacherInfoSchema,
    UpdateTeacherRequest,
)

router = APIRouter()
_admin = require_role("admin")


def _to_teacher_info(t) -> TeacherInfoSchema:
    return TeacherInfoSchema(
        id=t.id, name=t.name, email=t.email, phone=t.phone,
        is_active=t.is_active, created_at=t.created_at,
        class_count=t.class_count, student_count=t.student_count,
        sessions_this_month=t.sessions_this_month,
    )


def _to_teacher_detail(t) -> TeacherDetailSchema:
    from app.interfaces.api.v1.schemas.admin import TeacherClassInfoSchema
    return TeacherDetailSchema(
        id=t.id, name=t.name, email=t.email, phone=t.phone,
        is_active=t.is_active, created_at=t.created_at,
        classes=[
            TeacherClassInfoSchema(
                id=c.id, name=c.name, subject=c.subject,
                academic_year=c.academic_year, is_active=c.is_active,
                student_count=c.student_count,
            )
            for c in t.classes
        ],
        total_students=t.total_students,
    )


@router.get("/dashboard", response_model=AdminDashboardSchema)
async def get_dashboard(token=Depends(_admin), db: AsyncSession = Depends(get_db)):
    result = await GetAdminDashboardUseCase(db).execute(token.org_id)
    return AdminDashboardSchema(
        total_teachers=result.total_teachers,
        total_classes=result.total_classes,
        total_students=result.total_students,
        total_active_classes=result.total_active_classes,
        attendance_rate_this_month=result.attendance_rate_this_month,
        sessions_this_month=result.sessions_this_month,
        teachers=[_to_teacher_info(t) for t in result.teachers],
    )


@router.get("/teachers", response_model=list[TeacherInfoSchema])
async def list_teachers(token=Depends(_admin), db: AsyncSession = Depends(get_db)):
    teachers = await ListTeachersUseCase(db).execute(token.org_id)
    return [_to_teacher_info(t) for t in teachers]


@router.post("/teachers", response_model=TeacherDetailSchema, status_code=201)
async def create_teacher(
    body: CreateTeacherRequest,
    token=Depends(_admin),
    db: AsyncSession = Depends(get_db),
):
    user_repo = SQLUserRepository(db)
    user = await CreateTeacherUseCase(user_repo).execute(
        token.org_id,
        CreateTeacherInput(name=body.name, email=body.email, password=body.password, phone=body.phone),
    )
    detail = await GetTeacherUseCase(db, user_repo).execute(user.id, token.org_id)
    return _to_teacher_detail(detail)


@router.get("/teachers/{teacher_id}", response_model=TeacherDetailSchema)
async def get_teacher(
    teacher_id: UUID,
    token=Depends(_admin),
    db: AsyncSession = Depends(get_db),
):
    detail = await GetTeacherUseCase(db, SQLUserRepository(db)).execute(teacher_id, token.org_id)
    return _to_teacher_detail(detail)


@router.patch("/teachers/{teacher_id}", response_model=TeacherDetailSchema)
async def update_teacher(
    teacher_id: UUID,
    body: UpdateTeacherRequest,
    token=Depends(_admin),
    db: AsyncSession = Depends(get_db),
):
    user_repo = SQLUserRepository(db)
    await UpdateTeacherUseCase(user_repo).execute(
        teacher_id, token.org_id,
        UpdateTeacherInput(name=body.name, email=body.email, phone=body.phone),
    )
    detail = await GetTeacherUseCase(db, user_repo).execute(teacher_id, token.org_id)
    return _to_teacher_detail(detail)


@router.post("/teachers/{teacher_id}/reset-password", status_code=204)
async def reset_password(
    teacher_id: UUID,
    body: ResetPasswordRequest,
    token=Depends(_admin),
    db: AsyncSession = Depends(get_db),
):
    await ResetPasswordUseCase(SQLUserRepository(db)).execute(teacher_id, token.org_id, body.new_password)


@router.patch("/teachers/{teacher_id}/deactivate", response_model=TeacherDetailSchema)
async def toggle_teacher(
    teacher_id: UUID,
    token=Depends(_admin),
    db: AsyncSession = Depends(get_db),
):
    user_repo = SQLUserRepository(db)
    await ToggleTeacherUseCase(user_repo).execute(teacher_id, token.org_id)
    detail = await GetTeacherUseCase(db, user_repo).execute(teacher_id, token.org_id)
    return _to_teacher_detail(detail)


@router.get("/reports/attendance", response_model=AttendanceReportResponse)
async def report_attendance(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    teacher_id: UUID | None = Query(None),
    class_id: UUID | None = Query(None),
    token=Depends(_admin),
    db: AsyncSession = Depends(get_db),
):
    rows = await GetReportAttendanceUseCase(db).execute(
        token.org_id, date_from, date_to, teacher_id, class_id
    )
    return AttendanceReportResponse(rows=[
        {"teacher_name": r.teacher_name, "class_name": r.class_name, "subject": r.subject,
         "total_sessions": r.total_sessions, "total_attendances": r.total_attendances,
         "present": r.present, "absent": r.absent, "attendance_rate": r.attendance_rate}
        for r in rows
    ])


@router.get("/reports/grades", response_model=GradeReportResponse)
async def report_grades(
    teacher_id: UUID | None = Query(None),
    class_id: UUID | None = Query(None),
    token=Depends(_admin),
    db: AsyncSession = Depends(get_db),
):
    rows = await GetReportGradesUseCase(db).execute(token.org_id, teacher_id, class_id)
    return GradeReportResponse(rows=[
        {"teacher_name": r.teacher_name, "class_name": r.class_name, "subject": r.subject,
         "student_count": r.student_count, "avg_score": r.avg_score,
         "min_score": r.min_score, "max_score": r.max_score}
        for r in rows
    ])


@router.get("/settings", response_model=OrgSettingsSchema)
async def get_settings(token=Depends(_admin), db: AsyncSession = Depends(get_db)):
    settings = await GetSettingsUseCase(db).execute(token.org_id)
    return OrgSettingsSchema(
        name=settings.name, phone=settings.phone, address=settings.address,
        academic_year=settings.academic_year, logo_url=settings.logo_url,
        zalo_oa_id=settings.zalo_oa_id, zalo_oa_token=settings.zalo_oa_token,
    )


@router.patch("/settings", response_model=OrgSettingsSchema)
async def update_settings(
    body: OrgSettingsSchema,
    token=Depends(_admin),
    db: AsyncSession = Depends(get_db),
):
    await UpdateSettingsUseCase(db).execute(
        token.org_id,
        UpdateSettingsInput(
            name=body.name, phone=body.phone, address=body.address,
            academic_year=body.academic_year, logo_url=body.logo_url,
            zalo_oa_id=body.zalo_oa_id, zalo_oa_token=body.zalo_oa_token,
        ),
    )
    result = await GetSettingsUseCase(db).execute(token.org_id)
    return OrgSettingsSchema(
        name=result.name, phone=result.phone, address=result.address,
        academic_year=result.academic_year, logo_url=result.logo_url,
        zalo_oa_id=result.zalo_oa_id, zalo_oa_token=result.zalo_oa_token,
    )
```

- [ ] **Step 3: Register router in `main.py`**

At the end of `apps/api/app/main.py`, add:

```python
from app.interfaces.api.v1.routers import admin  # noqa: E402

app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])
```

- [ ] **Step 4: Verify API starts without error**

```bash
docker compose restart api
docker compose logs api --tail 20
```

Expected: no import errors; `Application startup complete.`

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/interfaces/api/v1/schemas/admin.py \
        apps/api/app/interfaces/api/v1/routers/admin.py \
        apps/api/app/main.py
git commit -m "feat: admin router with all endpoints"
```

---

## Task 7: Backend Tests

**Files:**
- Create: `apps/api/tests/test_admin.py`

- [ ] **Step 1: Write tests**

Create `apps/api/tests/test_admin.py`:

```python
import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.domain.entities.admin import AdminDashboard, TeacherDetail, OrgSettings, TeacherInfo, TeacherClassInfo
from app.infrastructure.security.jwt import TokenData
from app.interfaces.api.v1.dependencies import get_current_user
from app.main import app

_ORG_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")
_ADMIN_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
_TEACHER_ID = uuid.UUID("00000000-0000-0000-0000-000000000003")

_ADMIN_TOKEN = TokenData(user_id=_ADMIN_ID, org_id=_ORG_ID, role="admin", jti="j", exp=9999999999)

import datetime as _dt
_NOW = _dt.datetime(2026, 1, 1, tzinfo=_dt.timezone.utc)

_TEACHER_INFO = TeacherInfo(
    id=_TEACHER_ID, name="Nguyễn Văn A", email="a@test.com", phone=None,
    is_active=True, created_at=_NOW, class_count=2, student_count=30, sessions_this_month=4,
)

_TEACHER_DETAIL = TeacherDetail(
    id=_TEACHER_ID, name="Nguyễn Văn A", email="a@test.com", phone=None,
    is_active=True, created_at=_NOW, classes=[], total_students=0,
)


async def _admin_override():
    return _ADMIN_TOKEN


async def test_get_dashboard(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _admin_override
    try:
        dashboard = AdminDashboard(
            total_teachers=1, total_classes=2, total_students=30,
            total_active_classes=2, attendance_rate_this_month=90.0,
            sessions_this_month=4, teachers=[_TEACHER_INFO],
        )
        with patch("app.interfaces.api.v1.routers.admin.GetAdminDashboardUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=dashboard)
            resp = await client.get("/api/v1/admin/dashboard", headers={"Authorization": "Bearer fake"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_teachers"] == 1
        assert data["attendance_rate_this_month"] == 90.0
        assert len(data["teachers"]) == 1
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_list_teachers(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _admin_override
    try:
        with patch("app.interfaces.api.v1.routers.admin.ListTeachersUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=[_TEACHER_INFO])
            resp = await client.get("/api/v1/admin/teachers", headers={"Authorization": "Bearer fake"})
        assert resp.status_code == 200
        assert resp.json()[0]["name"] == "Nguyễn Văn A"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_toggle_teacher(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _admin_override
    try:
        deactivated = TeacherDetail(
            id=_TEACHER_ID, name="Nguyễn Văn A", email="a@test.com", phone=None,
            is_active=False, created_at=_NOW, classes=[], total_students=0,
        )
        with patch("app.interfaces.api.v1.routers.admin.ToggleTeacherUseCase") as MockToggle, \
             patch("app.interfaces.api.v1.routers.admin.GetTeacherUseCase") as MockGet:
            MockToggle.return_value.execute = AsyncMock(return_value=False)
            MockGet.return_value.execute = AsyncMock(return_value=deactivated)
            resp = await client.patch(
                f"/api/v1/admin/teachers/{_TEACHER_ID}/deactivate",
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 200
        assert resp.json()["is_active"] is False
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_get_settings(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _admin_override
    try:
        settings = OrgSettings(
            name="EduCenter", phone="0901234567", address="HCM",
            academic_year="2025-2026", logo_url=None, zalo_oa_id=None, zalo_oa_token=None,
        )
        with patch("app.interfaces.api.v1.routers.admin.GetSettingsUseCase") as MockUC:
            MockUC.return_value.execute = AsyncMock(return_value=settings)
            resp = await client.get("/api/v1/admin/settings", headers={"Authorization": "Bearer fake"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "EduCenter"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def test_admin_endpoint_requires_admin_role(client: AsyncClient):
    teacher_token = TokenData(user_id=_TEACHER_ID, org_id=_ORG_ID, role="teacher", jti="j2", exp=9999999999)

    async def _teacher_override():
        return teacher_token

    app.dependency_overrides[get_current_user] = _teacher_override
    try:
        resp = await client.get("/api/v1/admin/dashboard", headers={"Authorization": "Bearer fake"})
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)
```

- [ ] **Step 2: Run tests**

```bash
cd apps/api && docker compose exec api pytest tests/test_admin.py -v
```

Expected: all 5 tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/test_admin.py
git commit -m "test: admin API endpoint tests"
```

---

## Task 8: Frontend — Types + API Module

**Files:**
- Create: `apps/web/src/features/admin/model/types.ts`
- Create: `apps/web/src/features/admin/api/admin.api.ts`

- [ ] **Step 1: Create `types.ts`**

Create `apps/web/src/features/admin/model/types.ts`:

```typescript
export interface TeacherClassInfo {
  id: string;
  name: string;
  subject: string;
  academic_year: string;
  is_active: boolean;
  student_count: number;
}

export interface TeacherInfo {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  class_count: number;
  student_count: number;
  sessions_this_month: number;
}

export interface TeacherDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  classes: TeacherClassInfo[];
  total_students: number;
}

export interface AdminDashboard {
  total_teachers: number;
  total_classes: number;
  total_students: number;
  total_active_classes: number;
  attendance_rate_this_month: number;
  sessions_this_month: number;
  teachers: TeacherInfo[];
}

export interface AttendanceReportRow {
  teacher_name: string;
  class_name: string;
  subject: string;
  total_sessions: number;
  total_attendances: number;
  present: number;
  absent: number;
  attendance_rate: number;
}

export interface GradeReportRow {
  teacher_name: string;
  class_name: string;
  subject: string;
  student_count: number;
  avg_score: number;
  min_score: number;
  max_score: number;
}

export interface OrgSettings {
  name: string;
  phone: string | null;
  address: string | null;
  academic_year: string | null;
  logo_url: string | null;
  zalo_oa_id: string | null;
  zalo_oa_token: string | null;
}

export interface CreateTeacherRequest {
  name: string;
  email: string;
  password: string;
  phone: string | null;
}

export interface UpdateTeacherRequest {
  name: string;
  email: string | null;
  phone: string | null;
}
```

- [ ] **Step 2: Create `admin.api.ts`**

Create `apps/web/src/features/admin/api/admin.api.ts`:

```typescript
import { apiClient } from "@/src/shared/api/client";
import type {
  AdminDashboard,
  AttendanceReportRow,
  CreateTeacherRequest,
  GradeReportRow,
  OrgSettings,
  TeacherDetail,
  TeacherInfo,
  UpdateTeacherRequest,
} from "../model/types";

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const { data } = await apiClient.get<AdminDashboard>("/admin/dashboard");
  return data;
}

export async function listTeachers(): Promise<TeacherInfo[]> {
  const { data } = await apiClient.get<TeacherInfo[]>("/admin/teachers");
  return data;
}

export async function getTeacher(id: string): Promise<TeacherDetail> {
  const { data } = await apiClient.get<TeacherDetail>(`/admin/teachers/${id}`);
  return data;
}

export async function createTeacher(body: CreateTeacherRequest): Promise<TeacherDetail> {
  const { data } = await apiClient.post<TeacherDetail>("/admin/teachers", body);
  return data;
}

export async function updateTeacher(id: string, body: UpdateTeacherRequest): Promise<TeacherDetail> {
  const { data } = await apiClient.patch<TeacherDetail>(`/admin/teachers/${id}`, body);
  return data;
}

export async function resetTeacherPassword(id: string, newPassword: string): Promise<void> {
  await apiClient.post(`/admin/teachers/${id}/reset-password`, { new_password: newPassword });
}

export async function toggleTeacher(id: string): Promise<TeacherDetail> {
  const { data } = await apiClient.patch<TeacherDetail>(`/admin/teachers/${id}/deactivate`);
  return data;
}

export async function getAttendanceReport(params: {
  date_from?: string;
  date_to?: string;
  teacher_id?: string;
  class_id?: string;
}): Promise<AttendanceReportRow[]> {
  const { data } = await apiClient.get<{ rows: AttendanceReportRow[] }>(
    "/admin/reports/attendance",
    { params },
  );
  return data.rows;
}

export async function getGradesReport(params: {
  teacher_id?: string;
  class_id?: string;
}): Promise<GradeReportRow[]> {
  const { data } = await apiClient.get<{ rows: GradeReportRow[] }>(
    "/admin/reports/grades",
    { params },
  );
  return data.rows;
}

export async function getSettings(): Promise<OrgSettings> {
  const { data } = await apiClient.get<OrgSettings>("/admin/settings");
  return data;
}

export async function updateSettings(body: Partial<OrgSettings>): Promise<OrgSettings> {
  const { data } = await apiClient.patch<OrgSettings>("/admin/settings", body);
  return data;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/admin/
git commit -m "feat: admin frontend types and API module"
```

---

## Task 9: Frontend — Admin Login + Admin Layout

**Files:**
- Create: `apps/web/app/(auth)/login/admin/page.tsx`
- Modify: `apps/web/app/(admin)/layout.tsx`

- [ ] **Step 1: Create admin login page**

Create `apps/web/app/(auth)/login/admin/page.tsx`:

```tsx
import { LoginForm } from "@/src/features/auth/ui/LoginForm";

export default function AdminLoginPage() {
  return (
    <div className="bg-canvas rounded-md shadow-card p-8">
      <h1 className="text-2xl font-bold text-ink text-display mb-2">
        Đăng nhập Quản trị
      </h1>
      <p className="text-sm text-ash mb-6">Dành cho quản lý trung tâm</p>
      <LoginForm expectedRole="admin" redirectTo="/admin/dashboard" />
    </div>
  );
}
```

- [ ] **Step 2: Flesh out `(admin)/layout.tsx`**

Replace `apps/web/app/(admin)/layout.tsx` with:

```tsx
"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/src/features/auth/model/store";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "⊞" },
  { href: "/admin/teachers", label: "Giáo viên", icon: "👤" },
  { href: "/admin/reports/attendance", label: "Báo cáo điểm danh", icon: "📋" },
  { href: "/admin/reports/grades", label: "Báo cáo điểm số", icon: "📊" },
  { href: "/admin/settings", label: "Cài đặt", icon: "⚙️" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, hydrate, logout, user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    hydrate().then(() => {
      const state = useAuthStore.getState();
      if (!state.isAuthenticated || state.user?.role !== "admin") {
        router.replace("/login/admin");
      }
    });
  }, [hydrate, router]);

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <p className="text-ash text-sm">Đang kiểm tra phiên đăng nhập...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-surface">
      <aside className="hidden md:flex w-60 flex-col border-r border-border bg-canvas shrink-0">
        <div className="h-16 flex items-center px-5 border-b border-border">
          <span className="text-primary font-bold text-lg tracking-tight">EduManager</span>
          <span className="ml-2 text-xs text-ash font-medium bg-surface px-1.5 py-0.5 rounded">Admin</span>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {NAV.map(({ href, label, icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href as never}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-semibold transition-colors ${
                  active
                    ? "bg-primary/8 text-primary"
                    : "text-ash hover:bg-surface hover:text-ink"
                }`}
              >
                <span className="text-base leading-none">{icon}</span>
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-border">
          <div className="px-3 py-2">
            <p className="text-sm font-semibold text-ink">Quản trị viên</p>
          </div>
          <button
            onClick={async () => { await logout(); router.push("/login/admin"); }}
            className="mt-1 w-full text-left px-3 py-2 text-xs text-ash hover:text-error transition-colors rounded-sm hover:bg-surface"
          >
            Đăng xuất
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(auth\)/login/admin/ apps/web/app/\(admin\)/layout.tsx
git commit -m "feat: admin login page and admin layout with sidebar"
```

---

## Task 10: Frontend — Admin Dashboard Page

**Files:**
- Create: `apps/web/app/(admin)/dashboard/page.tsx`

- [ ] **Step 1: Create dashboard page**

Create `apps/web/app/(admin)/dashboard/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAdminDashboard } from "@/src/features/admin/api/admin.api";
import type { AdminDashboard } from "@/src/features/admin/model/types";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-canvas rounded-sm border border-border p-5">
      <p className="text-xs text-ash font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className="text-3xl font-bold text-ink">{value}</p>
    </div>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminDashboard()
      .then(setData)
      .catch(() => setError("Không thể tải dữ liệu dashboard."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-ash text-sm">Đang tải...</p>;
  if (error) return <p className="text-error text-sm">{error}</p>;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Tổng giáo viên" value={data.total_teachers} />
        <StatCard label="Lớp đang hoạt động" value={data.total_active_classes} />
        <StatCard label="Tổng học sinh" value={data.total_students} />
        <StatCard label="Chuyên cần tháng này" value={`${data.attendance_rate_this_month}%`} />
      </div>

      <div className="bg-canvas rounded-sm border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-ink">Giáo viên</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-ash text-xs font-medium uppercase">
              <th className="text-left px-5 py-3">Tên</th>
              <th className="text-right px-5 py-3">Số lớp</th>
              <th className="text-right px-5 py-3">Số HS</th>
              <th className="text-right px-5 py-3">Buổi tháng này</th>
            </tr>
          </thead>
          <tbody>
            {data.teachers.map((t) => (
              <tr
                key={t.id}
                onClick={() => router.push(`/admin/teachers/${t.id}` as never)}
                className="border-b border-border last:border-0 hover:bg-surface cursor-pointer transition-colors"
              >
                <td className="px-5 py-3 font-medium text-ink">{t.name}</td>
                <td className="px-5 py-3 text-right text-ash">{t.class_count}</td>
                <td className="px-5 py-3 text-right text-ash">{t.student_count}</td>
                <td className="px-5 py-3 text-right text-ash">{t.sessions_this_month}</td>
              </tr>
            ))}
            {data.teachers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-ash text-sm">
                  Chưa có giáo viên nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/\(admin\)/dashboard/
git commit -m "feat: admin dashboard page"
```

---

## Task 11: Frontend — Teacher Management Pages

**Files:**
- Create: `apps/web/app/(admin)/teachers/page.tsx`
- Create: `apps/web/app/(admin)/teachers/new/page.tsx`
- Create: `apps/web/app/(admin)/teachers/[id]/page.tsx`

- [ ] **Step 1: Create teachers list page**

Create `apps/web/app/(admin)/teachers/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listTeachers, toggleTeacher } from "@/src/features/admin/api/admin.api";
import type { TeacherInfo } from "@/src/features/admin/model/types";

export default function TeachersPage() {
  const router = useRouter();
  const [teachers, setTeachers] = useState<TeacherInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    listTeachers().then(setTeachers).finally(() => setLoading(false));
  }, []);

  async function handleToggle(id: string) {
    setToggling(id);
    try {
      const updated = await toggleTeacher(id);
      setTeachers((prev) => prev.map((t) => (t.id === id ? { ...t, is_active: updated.is_active } : t)));
    } finally {
      setToggling(null);
    }
  }

  if (loading) return <p className="text-ash text-sm">Đang tải...</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Giáo viên</h1>
        <button
          onClick={() => router.push("/admin/teachers/new" as never)}
          className="rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover transition-colors"
        >
          + Thêm giáo viên
        </button>
      </div>

      <div className="bg-canvas rounded-sm border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-ash text-xs font-medium uppercase">
              <th className="text-left px-5 py-3">Tên</th>
              <th className="text-left px-5 py-3">Email</th>
              <th className="text-right px-5 py-3">Số lớp</th>
              <th className="text-right px-5 py-3">Số HS</th>
              <th className="text-center px-5 py-3">Trạng thái</th>
              <th className="text-right px-5 py-3">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((t) => (
              <tr key={t.id} className="border-b border-border last:border-0 hover:bg-surface transition-colors">
                <td className="px-5 py-3 font-medium text-ink">{t.name}</td>
                <td className="px-5 py-3 text-ash">{t.email ?? "—"}</td>
                <td className="px-5 py-3 text-right text-ash">{t.class_count}</td>
                <td className="px-5 py-3 text-right text-ash">{t.student_count}</td>
                <td className="px-5 py-3 text-center">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                    t.is_active ? "bg-success/10 text-success" : "bg-error/10 text-error"
                  }`}>
                    {t.is_active ? "Hoạt động" : "Vô hiệu"}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => router.push(`/admin/teachers/${t.id}` as never)}
                      className="text-xs text-primary font-semibold hover:underline"
                    >
                      Xem
                    </button>
                    <button
                      onClick={() => handleToggle(t.id)}
                      disabled={toggling === t.id}
                      className="text-xs text-ash hover:text-error font-semibold disabled:opacity-50"
                    >
                      {t.is_active ? "Vô hiệu hóa" : "Kích hoạt"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {teachers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-ash text-sm">
                  Chưa có giáo viên nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create teacher creation page**

Create `apps/web/app/(admin)/teachers/new/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTeacher } from "@/src/features/admin/api/admin.api";

const inputCls = "rounded-sm border border-border px-4 py-3 text-sm text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink bg-canvas";

export default function NewTeacherPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await createTeacher({ name, email, password, phone: phone || null });
      router.push("/admin/teachers" as never);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? "Không thể tạo giáo viên. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-ash hover:text-ink text-sm">← Quay lại</button>
        <h1 className="text-2xl font-bold text-ink">Thêm giáo viên</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 bg-canvas border border-border rounded-sm p-6">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-ink">Họ tên *</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Nguyễn Văn A" />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-ink">Email *</label>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="teacher@email.com" />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-ink">Mật khẩu *</label>
          <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="Mật khẩu ban đầu" />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-ink">Số điện thoại</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="0901234567" />
        </div>

        {error && <p className="text-sm text-error">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.back()} className="rounded-sm border border-border px-4 py-3 text-sm font-semibold text-ink hover:bg-surface transition-colors">
            Huỷ
          </button>
          <button type="submit" disabled={loading} className="flex-1 rounded-sm bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary-hover transition-colors disabled:opacity-50">
            {loading ? "Đang tạo..." : "Tạo giáo viên"}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Create teacher detail page**

Create `apps/web/app/(admin)/teachers/[id]/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getTeacher, updateTeacher, resetTeacherPassword, toggleTeacher } from "@/src/features/admin/api/admin.api";
import type { TeacherDetail } from "@/src/features/admin/model/types";

const inputCls = "rounded-sm border border-border px-4 py-3 text-sm text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink bg-canvas";

export default function TeacherDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [teacher, setTeacher] = useState<TeacherDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [newPwd, setNewPwd] = useState("");
  const [resetting, setResetting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    if (!id) return;
    getTeacher(id).then((t) => {
      setTeacher(t);
      setName(t.name);
      setEmail(t.email ?? "");
      setPhone(t.phone ?? "");
    }).finally(() => setLoading(false));
  }, [id]);

  async function handleSave() {
    if (!teacher) return;
    setSaving(true);
    try {
      const updated = await updateTeacher(id, { name, email: email || null, phone: phone || null });
      setTeacher(updated);
      setEditing(false);
      showToast("Đã lưu thông tin.");
    } catch {
      showToast("Lỗi khi lưu. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPwd() {
    if (!newPwd) return;
    setResetting(true);
    try {
      await resetTeacherPassword(id, newPwd);
      setShowReset(false);
      setNewPwd("");
      showToast("Đã đặt lại mật khẩu.");
    } catch {
      showToast("Lỗi khi đặt lại mật khẩu.");
    } finally {
      setResetting(false);
    }
  }

  async function handleToggle() {
    if (!teacher) return;
    const updated = await toggleTeacher(id);
    setTeacher(updated);
    showToast(updated.is_active ? "Đã kích hoạt lại." : "Đã vô hiệu hóa.");
  }

  if (loading) return <p className="text-ash text-sm">Đang tải...</p>;
  if (!teacher) return <p className="text-error text-sm">Không tìm thấy giáo viên.</p>;

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {toast && (
        <div className="fixed top-4 right-4 bg-ink text-white text-sm px-4 py-2 rounded shadow-lg z-50">{toast}</div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-ash hover:text-ink text-sm">← Quay lại</button>
        <h1 className="text-2xl font-bold text-ink">{teacher.name}</h1>
        <span className={`ml-2 text-xs px-2 py-0.5 rounded font-semibold ${teacher.is_active ? "bg-success/10 text-success" : "bg-error/10 text-error"}`}>
          {teacher.is_active ? "Hoạt động" : "Vô hiệu"}
        </span>
      </div>

      {/* Info section */}
      <div className="bg-canvas border border-border rounded-sm p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">Thông tin</h2>
          {!editing && (
            <button onClick={() => setEditing(true)} className="text-sm text-primary font-semibold hover:underline">Chỉnh sửa</button>
          )}
        </div>

        {editing ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-ink">Họ tên</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-ink">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-ink">Số điện thoại</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditing(false)} className="rounded-sm border border-border px-4 py-2 text-sm text-ink hover:bg-surface">Huỷ</button>
              <button onClick={handleSave} disabled={saving} className="rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50">
                {saving ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt className="text-ash">Email</dt><dd className="text-ink">{teacher.email ?? "—"}</dd>
            <dt className="text-ash">Số điện thoại</dt><dd className="text-ink">{teacher.phone ?? "—"}</dd>
            <dt className="text-ash">Tổng học sinh</dt><dd className="text-ink">{teacher.total_students}</dd>
          </dl>
        )}

        <div className="flex gap-3 pt-2 border-t border-border">
          <button
            onClick={() => setShowReset(true)}
            className="rounded-sm border border-border px-4 py-2 text-sm font-semibold text-ink hover:bg-surface transition-colors"
          >
            Đặt lại mật khẩu
          </button>
          <button
            onClick={handleToggle}
            className={`rounded-sm px-4 py-2 text-sm font-semibold transition-colors ${
              teacher.is_active
                ? "border border-error text-error hover:bg-error/5"
                : "border border-success text-success hover:bg-success/5"
            }`}
          >
            {teacher.is_active ? "Vô hiệu hóa" : "Kích hoạt lại"}
          </button>
        </div>
      </div>

      {/* Reset password modal */}
      {showReset && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40">
          <div className="bg-canvas rounded-sm p-6 w-80 flex flex-col gap-4 shadow-xl">
            <h3 className="text-base font-semibold text-ink">Đặt lại mật khẩu</h3>
            <input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder="Mật khẩu mới"
              className={inputCls}
            />
            <div className="flex gap-3">
              <button onClick={() => { setShowReset(false); setNewPwd(""); }} className="flex-1 rounded-sm border border-border px-4 py-2 text-sm text-ink hover:bg-surface">Huỷ</button>
              <button onClick={handleResetPwd} disabled={resetting || !newPwd} className="flex-1 rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50">
                {resetting ? "Đang lưu..." : "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Classes table */}
      <div className="bg-canvas border border-border rounded-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-ink">Lớp học ({teacher.classes.length})</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-ash text-xs font-medium uppercase">
              <th className="text-left px-5 py-3">Tên lớp</th>
              <th className="text-left px-5 py-3">Môn</th>
              <th className="text-left px-5 py-3">Năm học</th>
              <th className="text-right px-5 py-3">Số HS</th>
              <th className="text-center px-5 py-3">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {teacher.classes.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3 font-medium text-ink">{c.name}</td>
                <td className="px-5 py-3 text-ash">{c.subject}</td>
                <td className="px-5 py-3 text-ash">{c.academic_year}</td>
                <td className="px-5 py-3 text-right text-ash">{c.student_count}</td>
                <td className="px-5 py-3 text-center">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${c.is_active ? "bg-success/10 text-success" : "bg-error/10 text-error"}`}>
                    {c.is_active ? "Đang dạy" : "Đã kết thúc"}
                  </span>
                </td>
              </tr>
            ))}
            {teacher.classes.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-ash text-sm">Chưa có lớp nào</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(admin\)/teachers/
git commit -m "feat: admin teacher management pages"
```

---

## Task 12: Frontend — Reports Pages

**Files:**
- Create: `apps/web/app/(admin)/reports/attendance/page.tsx`
- Create: `apps/web/app/(admin)/reports/grades/page.tsx`

- [ ] **Step 1: Create attendance report page**

Create `apps/web/app/(admin)/reports/attendance/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { getAttendanceReport } from "@/src/features/admin/api/admin.api";
import type { AttendanceReportRow } from "@/src/features/admin/model/types";

const inputCls = "rounded-sm border border-border px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink bg-canvas";

export default function AttendanceReportPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rows, setRows] = useState<AttendanceReportRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    setLoading(true);
    setError(null);
    try {
      const data = await getAttendanceReport({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      setRows(data);
    } catch {
      setError("Không thể tải dữ liệu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">Báo cáo điểm danh</h1>

      <div className="bg-canvas border border-border rounded-sm p-4 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-ash">Từ ngày</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-ash">Đến ngày</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputCls} />
        </div>
        <button
          onClick={handleSearch}
          disabled={loading}
          className="rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
        >
          {loading ? "Đang tải..." : "Xem báo cáo"}
        </button>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      {rows !== null && (
        <div className="bg-canvas border border-border rounded-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-ash text-xs font-medium uppercase">
                <th className="text-left px-5 py-3">Giáo viên</th>
                <th className="text-left px-5 py-3">Lớp</th>
                <th className="text-left px-5 py-3">Môn</th>
                <th className="text-right px-5 py-3">Buổi</th>
                <th className="text-right px-5 py-3">Có mặt</th>
                <th className="text-right px-5 py-3">Vắng</th>
                <th className="text-right px-5 py-3">Tỉ lệ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 text-ink">{r.teacher_name}</td>
                  <td className="px-5 py-3 text-ink">{r.class_name}</td>
                  <td className="px-5 py-3 text-ash">{r.subject}</td>
                  <td className="px-5 py-3 text-right text-ash">{r.total_sessions}</td>
                  <td className="px-5 py-3 text-right text-ash">{r.present}</td>
                  <td className="px-5 py-3 text-right text-ash">{r.absent}</td>
                  <td className="px-5 py-3 text-right font-semibold text-ink">{r.attendance_rate}%</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-ash text-sm">Chưa có dữ liệu</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create grades report page**

Create `apps/web/app/(admin)/reports/grades/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { getGradesReport } from "@/src/features/admin/api/admin.api";
import type { GradeReportRow } from "@/src/features/admin/model/types";

export default function GradesReportPage() {
  const [rows, setRows] = useState<GradeReportRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    setLoading(true);
    setError(null);
    try {
      setRows(await getGradesReport({}));
    } catch {
      setError("Không thể tải dữ liệu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">Báo cáo điểm số</h1>

      <div className="bg-canvas border border-border rounded-sm p-4 flex gap-3 items-end">
        <button
          onClick={handleSearch}
          disabled={loading}
          className="rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
        >
          {loading ? "Đang tải..." : "Xem báo cáo"}
        </button>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      {rows !== null && (
        <div className="bg-canvas border border-border rounded-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-ash text-xs font-medium uppercase">
                <th className="text-left px-5 py-3">Giáo viên</th>
                <th className="text-left px-5 py-3">Lớp</th>
                <th className="text-left px-5 py-3">Môn</th>
                <th className="text-right px-5 py-3">Số HS</th>
                <th className="text-right px-5 py-3">TB</th>
                <th className="text-right px-5 py-3">Thấp nhất</th>
                <th className="text-right px-5 py-3">Cao nhất</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 text-ink">{r.teacher_name}</td>
                  <td className="px-5 py-3 text-ink">{r.class_name}</td>
                  <td className="px-5 py-3 text-ash">{r.subject}</td>
                  <td className="px-5 py-3 text-right text-ash">{r.student_count}</td>
                  <td className="px-5 py-3 text-right font-semibold text-ink">{r.avg_score}</td>
                  <td className="px-5 py-3 text-right text-ash">{r.min_score}</td>
                  <td className="px-5 py-3 text-right text-ash">{r.max_score}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-ash text-sm">Chưa có dữ liệu</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(admin\)/reports/
git commit -m "feat: admin attendance and grades report pages"
```

---

## Task 13: Frontend — Settings Page

**Files:**
- Create: `apps/web/app/(admin)/settings/page.tsx`

- [ ] **Step 1: Create settings page**

Create `apps/web/app/(admin)/settings/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { getSettings, updateSettings } from "@/src/features/admin/api/admin.api";
import type { OrgSettings } from "@/src/features/admin/model/types";

const inputCls = "rounded-sm border border-border px-4 py-3 text-sm text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink bg-canvas";

function getAcademicYears(): string[] {
  const current = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => {
    const start = current - 1 + i;
    return `${start}-${start + 1}`;
  });
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // form fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [zaloOaId, setZaloOaId] = useState("");
  const [zaloToken, setZaloToken] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setName(s.name);
      setPhone(s.phone ?? "");
      setAddress(s.address ?? "");
      setAcademicYear(s.academic_year ?? "");
      setLogoUrl(s.logo_url ?? "");
      setZaloOaId(s.zalo_oa_id ?? "");
      setZaloToken("");
    }).finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Partial<OrgSettings> = {
        name,
        phone: phone || null,
        address: address || null,
        academic_year: academicYear || null,
        logo_url: logoUrl || null,
        zalo_oa_id: zaloOaId || null,
      };
      if (zaloToken) payload.zalo_oa_token = zaloToken;
      const updated = await updateSettings(payload);
      setSettings(updated);
      setZaloToken("");
      showToast("Đã lưu cài đặt.");
    } catch {
      showToast("Lỗi khi lưu. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-ash text-sm">Đang tải...</p>;

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      {toast && (
        <div className="fixed top-4 right-4 bg-ink text-white text-sm px-4 py-2 rounded shadow-lg z-50">{toast}</div>
      )}

      <h1 className="text-2xl font-bold text-ink">Cài đặt trung tâm</h1>

      <form onSubmit={handleSave} className="flex flex-col gap-4 bg-canvas border border-border rounded-sm p-6">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-ink">Tên trung tâm *</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-ink">Số điện thoại</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="0901234567" />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-ink">Địa chỉ</label>
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-ink">Năm học</label>
          <select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className={inputCls}>
            <option value="">— Chọn năm học —</option>
            {getAcademicYears().map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-ink">Logo URL</label>
          <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className={inputCls} placeholder="https://example.com/logo.png" />
        </div>

        <div className="border-t border-border pt-4 flex flex-col gap-3">
          <p className="text-xs text-ash font-semibold uppercase tracking-wide">Zalo OA (tuỳ chọn)</p>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-ink">Zalo OA ID</label>
            <input value={zaloOaId} onChange={(e) => setZaloOaId(e.target.value)} className={inputCls} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-ink">
              Zalo OA Token
              {settings?.zalo_oa_token && (
                <span className="ml-2 text-xs text-ash font-normal">({settings.zalo_oa_token})</span>
              )}
            </label>
            <input
              type="password"
              value={zaloToken}
              onChange={(e) => setZaloToken(e.target.value)}
              className={inputCls}
              placeholder="Nhập token mới để cập nhật"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-sm bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
        >
          {saving ? "Đang lưu..." : "Lưu cài đặt"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/\(admin\)/settings/
git commit -m "feat: admin settings page"
```

---

## Task 14: End-to-End Verification

- [ ] **Step 1: Rebuild and restart containers**

```bash
docker compose build web && docker compose up -d web
docker compose logs web --tail 20
```

Expected: no build errors; server listening on port 3000.

- [ ] **Step 2: Test admin login flow**

1. Navigate to `http://localhost/login/admin`
2. Login with a user that has `role=teacher` — should see error "Tài khoản này không có quyền truy cập trang này."
3. Create an admin user via psql or Swagger docs:
   ```sql
   UPDATE users SET role = 'admin' WHERE email = 'your-admin@email.com';
   ```
   Or via Swagger at `http://localhost/api/v1/docs`:
   - POST `/api/v1/admin/teachers` as an existing admin to create a teacher
4. Login with an admin account — should redirect to `/admin/dashboard`

- [ ] **Step 3: Verify all pages load**

- `/admin/dashboard` — shows stat cards and teacher table
- `/admin/teachers` — shows teacher list with toggle buttons
- `/admin/teachers/new` — form creates a teacher (appears in list after redirect)
- `/admin/teachers/{id}` — shows teacher detail with edit/reset-pwd/toggle
- `/admin/reports/attendance` — click "Xem báo cáo" shows table
- `/admin/reports/grades` — click "Xem báo cáo" shows table
- `/admin/settings` — loads and saves center settings

- [ ] **Step 4: Verify auth guard**

Log out, then navigate to `http://localhost/admin/dashboard` directly — should redirect to `/login/admin`.

- [ ] **Step 5: Run full backend test suite**

```bash
docker compose exec api pytest tests/ -v --tb=short
```

Expected: all tests pass with no regressions.

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "feat: Phase 8 Admin Panel complete"
```
