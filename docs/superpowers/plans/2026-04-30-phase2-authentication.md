# Phase 2: Authentication — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement email/password authentication for Admin and Teacher roles — backend (FastAPI) and frontend (Next.js login page), with JWT access tokens, Redis refresh tokens, and logout blacklisting.

**Architecture:** Backend follows Clean Architecture — domain entities → repository interface → SQLAlchemy implementation → use cases → FastAPI router. Frontend uses Feature-Sliced Design — auth feature with Zustand store, API module, and UI components wired into Next.js App Router pages.

**Tech Stack:** Python 3.12, FastAPI 0.115, SQLAlchemy 2.0 async, PostgreSQL, Redis, python-jose, passlib[bcrypt], Alembic · Next.js 14 App Router, TypeScript, Zustand, Tailwind CSS, axios

---

## File Map

### Backend — new files

| File | Responsibility |
|---|---|
| `apps/api/app/domain/entities/user.py` | Domain dataclasses: `UserRole`, `User`, `Organization` |
| `apps/api/app/domain/repositories/user_repository.py` | `IUserRepository` ABC interface |
| `apps/api/app/infrastructure/db/models/user.py` | SQLAlchemy ORM models for `users` + `organizations` |
| `apps/api/app/infrastructure/db/models/__init__.py` | Import models so Alembic detects them |
| `apps/api/app/infrastructure/db/repositories/user_repository.py` | SQLAlchemy impl of `IUserRepository` |
| `apps/api/app/infrastructure/security/password.py` | `hash_password`, `verify_password` (bcrypt) |
| `apps/api/app/infrastructure/security/jwt.py` | `create_access_token`, `decode_token`, `TokenData` |
| `apps/api/app/application/use_cases/auth/login.py` | `LoginUseCase` — validate credentials → issue tokens |
| `apps/api/app/application/use_cases/auth/refresh_token.py` | `RefreshTokenUseCase` — validate refresh token → new access token |
| `apps/api/app/application/use_cases/auth/logout.py` | `LogoutUseCase` — blacklist access token, delete refresh token |
| `apps/api/app/interfaces/api/v1/schemas/auth.py` | Pydantic request/response schemas |
| `apps/api/app/interfaces/api/v1/dependencies.py` | `get_current_user` FastAPI dependency |
| `apps/api/app/interfaces/api/v1/routers/auth.py` | Router: POST /login, /refresh, /logout · GET /me |
| `apps/api/alembic/versions/001_users_organizations.py` | First migration: `organizations` + `users` tables |
| `apps/api/tests/test_auth.py` | HTTP-level auth endpoint tests |

### Frontend — new files

| File | Responsibility |
|---|---|
| `apps/web/src/features/auth/api/auth.api.ts` | `loginApi`, `logoutApi`, `refreshApi`, `getMeApi` |
| `apps/web/src/features/auth/model/store.ts` | Zustand `useAuthStore` — user state + login/logout actions |
| `apps/web/src/features/auth/ui/LoginForm.tsx` | Controlled form: email, password, submit, error display |
| `apps/web/src/app/layout.tsx` | Root layout: html/body, Zustand provider |
| `apps/web/src/app/page.tsx` | Root redirect: `/dashboard` if auth, `/login` if not |
| `apps/web/src/app/(auth)/layout.tsx` | Centered unauthenticated layout |
| `apps/web/src/app/(auth)/login/page.tsx` | Login page — renders `LoginForm` |
| `apps/web/src/app/(teacher)/layout.tsx` | Protected layout: checks auth, redirects to `/login` if not |
| `apps/web/src/app/(teacher)/dashboard/page.tsx` | Dashboard placeholder (`<h1>Dashboard</h1>`) |

---

## Task 1: Domain Entities

**Files:**
- Create: `apps/api/app/domain/entities/user.py`

- [ ] **Step 1: Create the file**

```python
# apps/api/app/domain/entities/user.py
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from uuid import UUID


class UserRole(str, Enum):
    admin = "admin"
    teacher = "teacher"
    parent = "parent"


@dataclass
class Organization:
    id: UUID
    name: str
    zalo_oa_id: str | None
    zalo_oa_token_encrypted: str | None
    created_at: datetime
    updated_at: datetime


@dataclass
class User:
    id: UUID
    organization_id: UUID
    email: str
    password_hash: str
    role: UserRole
    name: str
    phone: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None
```

- [ ] **Step 2: Verify Python import is clean**

```bash
cd apps/api && python -c "from app.domain.entities.user import User, Organization, UserRole; print('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add apps/api/app/domain/entities/user.py
git commit -m "feat: add User and Organization domain entities"
```

---

## Task 2: SQLAlchemy ORM Models

**Files:**
- Create: `apps/api/app/infrastructure/db/models/user.py`
- Modify: `apps/api/app/infrastructure/db/models/__init__.py`

- [ ] **Step 1: Create the ORM models file**

```python
# apps/api/app/infrastructure/db/models/user.py
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum as SAEnum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.db.session import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class OrganizationModel(Base):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    zalo_oa_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    zalo_oa_token_encrypted: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class UserModel(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(
        SAEnum("admin", "teacher", "parent", name="user_role"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

- [ ] **Step 2: Update models `__init__.py` so Alembic detects the models**

```python
# apps/api/app/infrastructure/db/models/__init__.py
from app.infrastructure.db.models.user import OrganizationModel, UserModel  # noqa: F401
```

- [ ] **Step 3: Verify import**

```bash
cd apps/api && python -c "from app.infrastructure.db.models.user import UserModel, OrganizationModel; print('OK')"
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add apps/api/app/infrastructure/db/models/user.py apps/api/app/infrastructure/db/models/__init__.py
git commit -m "feat: add OrganizationModel and UserModel SQLAlchemy ORM models"
```

---

## Task 3: Security Utilities — Password & JWT

**Files:**
- Create: `apps/api/app/infrastructure/security/password.py`
- Create: `apps/api/app/infrastructure/security/jwt.py`
- Create: `apps/api/app/infrastructure/security/__init__.py`

- [ ] **Step 1: Create the security package init**

```python
# apps/api/app/infrastructure/security/__init__.py
```
(empty file)

- [ ] **Step 2: Create password utility**

```python
# apps/api/app/infrastructure/security/password.py
from passlib.context import CryptContext

_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return _ctx.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _ctx.verify(plain, hashed)
```

- [ ] **Step 3: Create JWT utility**

```python
# apps/api/app/infrastructure/security/jwt.py
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID

from jose import JWTError, jwt

from app.config import settings
from app.domain.exceptions import UnauthorizedError


@dataclass
class TokenData:
    user_id: UUID
    org_id: UUID
    role: str
    jti: str
    exp: int


def create_access_token(user_id: UUID, org_id: UUID, role: str) -> tuple[str, str]:
    """Returns (encoded_jwt, jti)."""
    jti = str(uuid.uuid4())
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {
        "sub": str(user_id),
        "org_id": str(org_id),
        "role": role,
        "jti": jti,
        "exp": expire,
    }
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return token, jti


def decode_token(token: str) -> TokenData:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError:
        raise UnauthorizedError("Invalid or expired token")
    return TokenData(
        user_id=UUID(payload["sub"]),
        org_id=UUID(payload["org_id"]),
        role=payload["role"],
        jti=payload["jti"],
        exp=payload["exp"],
    )
```

- [ ] **Step 4: Verify imports**

```bash
cd apps/api && python -c "
from app.infrastructure.security.password import hash_password, verify_password
from app.infrastructure.security.jwt import create_access_token, decode_token
import uuid
h = hash_password('secret')
assert verify_password('secret', h)
tok, jti = create_access_token(uuid.uuid4(), uuid.uuid4(), 'teacher')
data = decode_token(tok)
assert data.role == 'teacher'
print('OK')
"
```
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/infrastructure/security/
git commit -m "feat: add password hashing and JWT utilities"
```

---

## Task 4: Alembic Migration — organizations + users

**Files:**
- Create: `apps/api/alembic/versions/001_users_organizations.py` (auto-generated then reviewed)

> **Requires:** PostgreSQL running. Start with `docker compose -f docker-compose.dev.yml up -d postgres` from the repo root.

- [ ] **Step 1: Start postgres**

```bash
docker compose -f docker-compose.dev.yml up -d postgres
```
Expected: postgres container starts. Wait ~3 seconds.

- [ ] **Step 2: Autogenerate migration**

```bash
cd apps/api && alembic revision --autogenerate -m "users_organizations"
```
Expected: creates a file at `alembic/versions/<hash>_users_organizations.py`

- [ ] **Step 3: Rename the file for readability**

```bash
cd apps/api && mv alembic/versions/*_users_organizations.py alembic/versions/001_users_organizations.py
```
Then open `alembic/versions/001_users_organizations.py` and set the revision id for clarity:
```python
revision: str = "001"
down_revision: str | None = None
```

- [ ] **Step 4: Run the migration**

```bash
cd apps/api && alembic upgrade head
```
Expected output ends with: `Running upgrade  -> 001, users_organizations`

- [ ] **Step 5: Verify tables in postgres**

```bash
docker exec -it $(docker ps -qf "name=postgres") psql -U school -d school -c "\dt"
```
Expected: shows `organizations` and `users` tables.

- [ ] **Step 6: Commit**

```bash
git add apps/api/alembic/versions/001_users_organizations.py
git commit -m "feat: add initial Alembic migration for users and organizations"
```

---

## Task 5: User Repository Interface + Implementation

**Files:**
- Create: `apps/api/app/domain/repositories/user_repository.py`
- Create: `apps/api/app/infrastructure/db/repositories/user_repository.py`

- [ ] **Step 1: Write the failing test first**

```python
# apps/api/tests/test_user_repository.py
import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db.repositories.user_repository import SQLUserRepository
from app.infrastructure.db.models.user import UserModel


async def test_get_by_email_returns_none_when_not_found():
    session = AsyncMock(spec=AsyncSession)
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = None
    session.execute.return_value = result_mock

    repo = SQLUserRepository(session)
    user = await repo.get_by_email("notfound@example.com")
    assert user is None
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && pytest tests/test_user_repository.py -v
```
Expected: FAIL — `ModuleNotFoundError: No module named 'app.infrastructure.db.repositories.user_repository'`

- [ ] **Step 3: Create the repository interface**

```python
# apps/api/app/domain/repositories/user_repository.py
from __future__ import annotations

from abc import ABC, abstractmethod
from uuid import UUID

from app.domain.entities.user import User


class IUserRepository(ABC):
    @abstractmethod
    async def get_by_email(self, email: str) -> User | None: ...

    @abstractmethod
    async def get_by_id(self, user_id: UUID) -> User | None: ...
```

- [ ] **Step 4: Create the SQLAlchemy implementation**

```python
# apps/api/app/infrastructure/db/repositories/user_repository.py
from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.user import Organization, User, UserRole
from app.domain.repositories.user_repository import IUserRepository
from app.infrastructure.db.models.user import OrganizationModel, UserModel


def _to_domain(row: UserModel) -> User:
    return User(
        id=row.id,
        organization_id=row.organization_id,
        email=row.email,
        password_hash=row.password_hash,
        role=UserRole(row.role),
        name=row.name,
        phone=row.phone,
        is_active=row.is_active,
        created_at=row.created_at,
        updated_at=row.updated_at,
        deleted_at=row.deleted_at,
    )


class SQLUserRepository(IUserRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_email(self, email: str) -> User | None:
        result = await self._session.execute(
            select(UserModel).where(UserModel.email == email, UserModel.deleted_at.is_(None))
        )
        row = result.scalar_one_or_none()
        return _to_domain(row) if row else None

    async def get_by_id(self, user_id: UUID) -> User | None:
        result = await self._session.execute(
            select(UserModel).where(UserModel.id == user_id, UserModel.deleted_at.is_(None))
        )
        row = result.scalar_one_or_none()
        return _to_domain(row) if row else None
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd apps/api && pytest tests/test_user_repository.py -v
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/domain/repositories/user_repository.py \
        apps/api/app/infrastructure/db/repositories/user_repository.py \
        apps/api/tests/test_user_repository.py
git commit -m "feat: add IUserRepository interface and SQLAlchemy implementation"
```

---

## Task 6: Login Use Case

**Files:**
- Create: `apps/api/app/application/use_cases/auth/__init__.py` (empty)
- Create: `apps/api/app/application/use_cases/auth/login.py`

- [ ] **Step 1: Write the failing tests**

```python
# apps/api/tests/test_use_case_login.py
import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

from app.application.use_cases.auth.login import LoginUseCase, LoginResult
from app.domain.entities.user import User, UserRole
from app.domain.exceptions import UnauthorizedError

_ORG_ID = uuid.uuid4()
_USER_ID = uuid.uuid4()
_NOW = datetime.now(timezone.utc)

def _make_user(password_hash: str = "$2b$12$fake") -> User:
    return User(
        id=_USER_ID,
        organization_id=_ORG_ID,
        email="teacher@school.com",
        password_hash=password_hash,
        role=UserRole.teacher,
        name="Test Teacher",
        phone=None,
        is_active=True,
        created_at=_NOW,
        updated_at=_NOW,
        deleted_at=None,
    )


async def test_login_returns_tokens_on_valid_credentials():
    user_repo = AsyncMock()
    redis = AsyncMock()

    with patch("app.application.use_cases.auth.login.verify_password", return_value=True), \
         patch("app.application.use_cases.auth.login.create_access_token", return_value=("access.token.here", "jti-123")):
        user_repo.get_by_email.return_value = _make_user()
        use_case = LoginUseCase(user_repo, redis)
        result = await use_case.execute("teacher@school.com", "correct-password")

    assert result.access_token == "access.token.here"
    assert result.refresh_token is not None
    redis.setex.assert_called_once()


async def test_login_raises_on_wrong_password():
    user_repo = AsyncMock()
    redis = AsyncMock()

    with patch("app.application.use_cases.auth.login.verify_password", return_value=False):
        user_repo.get_by_email.return_value = _make_user()
        use_case = LoginUseCase(user_repo, redis)

        with pytest.raises(UnauthorizedError):
            await use_case.execute("teacher@school.com", "wrong-password")


async def test_login_raises_on_unknown_email():
    user_repo = AsyncMock()
    redis = AsyncMock()
    user_repo.get_by_email.return_value = None

    use_case = LoginUseCase(user_repo, redis)
    with pytest.raises(UnauthorizedError):
        await use_case.execute("nobody@school.com", "any-password")
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && pytest tests/test_use_case_login.py -v
```
Expected: FAIL — `ModuleNotFoundError: No module named 'app.application.use_cases.auth.login'`

- [ ] **Step 3: Create empty `__init__.py` for the auth use cases package**

```python
# apps/api/app/application/use_cases/auth/__init__.py
```
(empty file)

- [ ] **Step 4: Create the LoginUseCase**

```python
# apps/api/app/application/use_cases/auth/login.py
from __future__ import annotations

import uuid
from dataclasses import dataclass

import redis.asyncio as redis_lib

from app.config import settings
from app.domain.exceptions import UnauthorizedError
from app.domain.repositories.user_repository import IUserRepository
from app.infrastructure.security.jwt import create_access_token
from app.infrastructure.security.password import verify_password

_REFRESH_TTL = settings.refresh_token_expire_days * 86400


@dataclass
class LoginResult:
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginUseCase:
    def __init__(self, user_repo: IUserRepository, redis: redis_lib.Redis) -> None:
        self._user_repo = user_repo
        self._redis = redis

    async def execute(self, email: str, password: str) -> LoginResult:
        user = await self._user_repo.get_by_email(email)
        if not user or not verify_password(password, user.password_hash):
            raise UnauthorizedError("Invalid email or password")
        if not user.is_active:
            raise UnauthorizedError("Account is disabled")

        access_token, _jti = create_access_token(user.id, user.organization_id, user.role.value)
        refresh_token = str(uuid.uuid4())
        await self._redis.setex(f"refresh:{refresh_token}", _REFRESH_TTL, str(user.id))

        return LoginResult(access_token=access_token, refresh_token=refresh_token)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/api && pytest tests/test_use_case_login.py -v
```
Expected: 3 PASSED

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/application/use_cases/auth/__init__.py \
        apps/api/app/application/use_cases/auth/login.py \
        apps/api/tests/test_use_case_login.py
git commit -m "feat: add LoginUseCase with JWT + Redis refresh token"
```

---

## Task 7: Refresh Token + Logout Use Cases

**Files:**
- Create: `apps/api/app/application/use_cases/auth/refresh_token.py`
- Create: `apps/api/app/application/use_cases/auth/logout.py`

- [ ] **Step 1: Write the failing tests**

```python
# apps/api/tests/test_use_case_refresh_logout.py
import uuid
import pytest
from unittest.mock import AsyncMock, patch
from datetime import datetime, timezone

from app.application.use_cases.auth.refresh_token import RefreshTokenUseCase
from app.application.use_cases.auth.logout import LogoutUseCase
from app.domain.entities.user import User, UserRole
from app.domain.exceptions import UnauthorizedError
from app.infrastructure.security.jwt import TokenData

_USER_ID = uuid.uuid4()
_ORG_ID = uuid.uuid4()
_NOW = datetime.now(timezone.utc)


def _make_user() -> User:
    return User(
        id=_USER_ID, organization_id=_ORG_ID, email="t@s.com",
        password_hash="h", role=UserRole.teacher, name="T", phone=None,
        is_active=True, created_at=_NOW, updated_at=_NOW, deleted_at=None,
    )


async def test_refresh_returns_new_access_token():
    user_repo = AsyncMock()
    redis = AsyncMock()
    redis.get.return_value = str(_USER_ID)
    user_repo.get_by_id.return_value = _make_user()

    with patch("app.application.use_cases.auth.refresh_token.create_access_token",
               return_value=("new.token", "jti-new")):
        use_case = RefreshTokenUseCase(user_repo, redis)
        result = await use_case.execute("valid-refresh-token")

    assert result == "new.token"


async def test_refresh_raises_on_invalid_token():
    user_repo = AsyncMock()
    redis = AsyncMock()
    redis.get.return_value = None

    use_case = RefreshTokenUseCase(user_repo, redis)
    with pytest.raises(UnauthorizedError):
        await use_case.execute("bad-token")


async def test_logout_blacklists_jti_and_deletes_refresh():
    redis = AsyncMock()
    token_data = TokenData(user_id=_USER_ID, org_id=_ORG_ID, role="teacher",
                           jti="jti-abc", exp=9999999999)

    use_case = LogoutUseCase(redis)
    await use_case.execute(token_data, refresh_token="rt-xyz")

    redis.setex.assert_called_once()
    call_args = redis.setex.call_args[0]
    assert call_args[0] == "blacklist:jti-abc"

    redis.delete.assert_called_once_with("refresh:rt-xyz")
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd apps/api && pytest tests/test_use_case_refresh_logout.py -v
```
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Create RefreshTokenUseCase**

```python
# apps/api/app/application/use_cases/auth/refresh_token.py
from __future__ import annotations

from uuid import UUID

import redis.asyncio as redis_lib

from app.domain.exceptions import UnauthorizedError
from app.domain.repositories.user_repository import IUserRepository
from app.infrastructure.security.jwt import create_access_token


class RefreshTokenUseCase:
    def __init__(self, user_repo: IUserRepository, redis: redis_lib.Redis) -> None:
        self._user_repo = user_repo
        self._redis = redis

    async def execute(self, refresh_token: str) -> str:
        user_id_str = await self._redis.get(f"refresh:{refresh_token}")
        if not user_id_str:
            raise UnauthorizedError("Invalid or expired refresh token")

        user = await self._user_repo.get_by_id(UUID(user_id_str))
        if not user or not user.is_active:
            raise UnauthorizedError("User not found or disabled")

        access_token, _jti = create_access_token(user.id, user.organization_id, user.role.value)
        return access_token
```

- [ ] **Step 4: Create LogoutUseCase**

```python
# apps/api/app/application/use_cases/auth/logout.py
from __future__ import annotations

import time

import redis.asyncio as redis_lib

from app.infrastructure.security.jwt import TokenData


class LogoutUseCase:
    def __init__(self, redis: redis_lib.Redis) -> None:
        self._redis = redis

    async def execute(self, token_data: TokenData, refresh_token: str | None) -> None:
        remaining = max(1, token_data.exp - int(time.time()))
        await self._redis.setex(f"blacklist:{token_data.jti}", remaining, "1")
        if refresh_token:
            await self._redis.delete(f"refresh:{refresh_token}")
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/api && pytest tests/test_use_case_refresh_logout.py -v
```
Expected: 3 PASSED

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/application/use_cases/auth/refresh_token.py \
        apps/api/app/application/use_cases/auth/logout.py \
        apps/api/tests/test_use_case_refresh_logout.py
git commit -m "feat: add RefreshTokenUseCase and LogoutUseCase"
```

---

## Task 8: Pydantic Schemas + FastAPI Dependencies

**Files:**
- Create: `apps/api/app/interfaces/api/v1/schemas/auth.py`
- Create: `apps/api/app/interfaces/api/v1/dependencies.py`

- [ ] **Step 1: Create auth schemas**

```python
# apps/api/app/interfaces/api/v1/schemas/auth.py
from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LogoutRequest(BaseModel):
    refresh_token: str | None = None


class MeResponse(BaseModel):
    user_id: str
    org_id: str
    role: str
```

- [ ] **Step 2: Create FastAPI dependencies**

```python
# apps/api/app/interfaces/api/v1/dependencies.py
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

- [ ] **Step 3: Verify imports**

```bash
cd apps/api && python -c "
from app.interfaces.api.v1.schemas.auth import LoginRequest, LoginResponse
from app.interfaces.api.v1.dependencies import get_current_user
print('OK')
"
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add apps/api/app/interfaces/api/v1/schemas/auth.py \
        apps/api/app/interfaces/api/v1/dependencies.py
git commit -m "feat: add auth Pydantic schemas and get_current_user dependency"
```

---

## Task 9: Auth Router — 4 Endpoints

**Files:**
- Modify: `apps/api/app/interfaces/api/v1/routers/auth.py`

- [ ] **Step 1: Write failing HTTP-level tests**

```python
# apps/api/tests/test_auth.py
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from httpx import AsyncClient

from app.main import app
from app.application.use_cases.auth.login import LoginResult
from app.domain.exceptions import UnauthorizedError
from app.infrastructure.security.jwt import TokenData
import uuid


_TOKEN_DATA = TokenData(
    user_id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
    org_id=uuid.UUID("00000000-0000-0000-0000-000000000002"),
    role="teacher",
    jti="test-jti",
    exp=9999999999,
)


async def test_login_success(client: AsyncClient):
    mock_result = LoginResult(access_token="acc.tok", refresh_token="ref.tok")
    with patch("app.interfaces.api.v1.routers.auth.LoginUseCase") as MockUC:
        MockUC.return_value.execute = AsyncMock(return_value=mock_result)
        resp = await client.post("/api/v1/auth/login", json={"email": "t@s.com", "password": "pass"})
    assert resp.status_code == 200
    assert resp.json()["access_token"] == "acc.tok"


async def test_login_invalid_credentials(client: AsyncClient):
    with patch("app.interfaces.api.v1.routers.auth.LoginUseCase") as MockUC:
        MockUC.return_value.execute = AsyncMock(side_effect=UnauthorizedError("Invalid"))
        resp = await client.post("/api/v1/auth/login", json={"email": "t@s.com", "password": "bad"})
    assert resp.status_code == 401


async def test_refresh_success(client: AsyncClient):
    with patch("app.interfaces.api.v1.routers.auth.RefreshTokenUseCase") as MockUC:
        MockUC.return_value.execute = AsyncMock(return_value="new.token")
        resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": "rt"})
    assert resp.status_code == 200
    assert resp.json()["access_token"] == "new.token"


async def test_logout_success(client: AsyncClient):
    with patch("app.interfaces.api.v1.routers.auth.get_current_user", return_value=_TOKEN_DATA), \
         patch("app.interfaces.api.v1.routers.auth.LogoutUseCase") as MockUC:
        MockUC.return_value.execute = AsyncMock(return_value=None)
        resp = await client.post(
            "/api/v1/auth/logout",
            json={"refresh_token": "rt"},
            headers={"Authorization": "Bearer fake.token"},
        )
    assert resp.status_code == 204


async def test_get_me(client: AsyncClient):
    with patch("app.interfaces.api.v1.routers.auth.get_current_user", return_value=_TOKEN_DATA):
        resp = await client.get("/api/v1/auth/me", headers={"Authorization": "Bearer fake.token"})
    assert resp.status_code == 200
    assert resp.json()["role"] == "teacher"
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd apps/api && pytest tests/test_auth.py -v
```
Expected: FAIL — ImportErrors or assertion errors because the router is a stub.

- [ ] **Step 3: Replace the auth router stub with full implementation**

```python
# apps/api/app/interfaces/api/v1/routers/auth.py
from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.auth.login import LoginUseCase
from app.application.use_cases.auth.logout import LogoutUseCase
from app.application.use_cases.auth.refresh_token import RefreshTokenUseCase
from app.infrastructure.cache.redis_client import get_redis
from app.infrastructure.db.repositories.user_repository import SQLUserRepository
from app.infrastructure.db.session import get_db
from app.interfaces.api.v1.dependencies import get_current_user
from app.interfaces.api.v1.schemas.auth import (
    LoginRequest,
    LoginResponse,
    LogoutRequest,
    MeResponse,
    RefreshRequest,
    RefreshResponse,
)

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    use_case = LoginUseCase(SQLUserRepository(db), redis)
    result = await use_case.execute(body.email, body.password)
    return LoginResponse(access_token=result.access_token, refresh_token=result.refresh_token)


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    use_case = RefreshTokenUseCase(SQLUserRepository(db), redis)
    access_token = await use_case.execute(body.refresh_token)
    return RefreshResponse(access_token=access_token)


@router.post("/logout", status_code=204)
async def logout(
    body: LogoutRequest,
    token_data=Depends(get_current_user),
    redis=Depends(get_redis),
):
    use_case = LogoutUseCase(redis)
    await use_case.execute(token_data, body.refresh_token)
    return Response(status_code=204)


@router.get("/me", response_model=MeResponse)
async def me(token_data=Depends(get_current_user)):
    return MeResponse(
        user_id=str(token_data.user_id),
        org_id=str(token_data.org_id),
        role=token_data.role,
    )
```

- [ ] **Step 4: Run all auth tests**

```bash
cd apps/api && pytest tests/test_auth.py -v
```
Expected: 5 PASSED (`test_health` included via conftest)

- [ ] **Step 5: Run full test suite**

```bash
cd apps/api && pytest -v
```
Expected: all PASSED

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/interfaces/api/v1/routers/auth.py \
        apps/api/tests/test_auth.py
git commit -m "feat: implement auth router (login, refresh, logout, me)"
```

---

## Task 10: Frontend — Auth API Module

**Files:**
- Create: `apps/web/src/features/auth/api/auth.api.ts`

- [ ] **Step 1: Create the API module**

```typescript
// apps/web/src/features/auth/api/auth.api.ts
import { apiClient } from "@/src/shared/api/client";

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface MeResponse {
  user_id: string;
  org_id: string;
  role: "admin" | "teacher" | "parent";
}

export async function loginApi(email: string, password: string): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>("/auth/login", { email, password });
  return data;
}

export async function logoutApi(refreshToken: string): Promise<void> {
  await apiClient.post("/auth/logout", { refresh_token: refreshToken });
}

export async function getMeApi(): Promise<MeResponse> {
  const { data } = await apiClient.get<MeResponse>("/auth/me");
  return data;
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/auth/api/auth.api.ts
git commit -m "feat: add auth API module (login, logout, me)"
```

---

## Task 11: Zustand Auth Store

**Files:**
- Create: `apps/web/src/features/auth/model/store.ts`

- [ ] **Step 1: Create the store**

```typescript
// apps/web/src/features/auth/model/store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { loginApi, logoutApi, getMeApi, type MeResponse } from "../api/auth.api";

interface AuthState {
  user: MeResponse | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      login: async (email, password) => {
        const tokens = await loginApi(email, password);
        if (typeof window !== "undefined") {
          localStorage.setItem("access_token", tokens.access_token);
          localStorage.setItem("refresh_token", tokens.refresh_token);
        }
        const user = await getMeApi();
        set({ user, accessToken: tokens.access_token, refreshToken: tokens.refresh_token, isAuthenticated: true });
      },

      logout: async () => {
        const { refreshToken } = get();
        if (refreshToken) {
          await logoutApi(refreshToken).catch(() => {});
        }
        if (typeof window !== "undefined") {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
        }
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },

      hydrate: async () => {
        const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
        if (!token) return;
        try {
          const user = await getMeApi();
          set({ user, isAuthenticated: true });
        } catch {
          set({ user: null, isAuthenticated: false });
        }
      },
    }),
    { name: "auth-store", partialize: (s) => ({ accessToken: s.accessToken, refreshToken: s.refreshToken }) }
  )
);
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/auth/model/store.ts
git commit -m "feat: add Zustand auth store with login/logout/hydrate"
```

---

## Task 12: LoginForm Component

**Files:**
- Create: `apps/web/src/features/auth/ui/LoginForm.tsx`

- [ ] **Step 1: Create the form component**

```tsx
// apps/web/src/features/auth/ui/LoginForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../model/store";

export function LoginForm() {
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
      router.push("/dashboard");
    } catch {
      setError("Email hoặc mật khẩu không đúng.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-black focus:outline-none focus:ring-2 focus:ring-black"
          placeholder="giaovien@truong.com"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium text-gray-700">
          Mật khẩu
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-black focus:outline-none focus:ring-2 focus:ring-black"
          placeholder="••••••••"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-black px-4 py-3 text-sm font-medium text-white transition active:scale-95 disabled:opacity-50"
      >
        {loading ? "Đang đăng nhập..." : "Đăng nhập"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/auth/ui/LoginForm.tsx
git commit -m "feat: add LoginForm component"
```

---

## Task 13: Next.js App Router — Root Layout + Pages

**Files:**
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/(auth)/layout.tsx`
- Create: `apps/web/src/app/(auth)/login/page.tsx`
- Create: `apps/web/src/app/(teacher)/layout.tsx`
- Create: `apps/web/src/app/(teacher)/dashboard/page.tsx`

- [ ] **Step 1: Create the root layout**

```tsx
// apps/web/src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "School Management",
  description: "Hệ thống quản lý trung tâm dạy thêm",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="bg-white text-gray-900 antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Create `globals.css`**

```css
/* apps/web/src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 3: Create the root redirect page**

```tsx
// apps/web/src/app/page.tsx
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/login");
}
```

- [ ] **Step 4: Create the (auth) group layout**

```tsx
// apps/web/src/app/(auth)/layout.tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-900">
          Đăng nhập
        </h1>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create the login page**

```tsx
// apps/web/src/app/(auth)/login/page.tsx
import { LoginForm } from "@/src/features/auth/ui/LoginForm";

export default function LoginPage() {
  return <LoginForm />;
}
```

- [ ] **Step 6: Create the (teacher) protected layout**

```tsx
// apps/web/src/app/(teacher)/layout.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/src/features/auth/model/store";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, hydrate } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    hydrate().then(() => {
      if (!useAuthStore.getState().isAuthenticated) {
        router.replace("/login");
      }
    });
  }, [hydrate, router]);

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Đang kiểm tra phiên đăng nhập...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <span className="font-semibold text-gray-900">School Management</span>
        <LogoutButton />
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}

function LogoutButton() {
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  return (
    <button
      onClick={async () => { await logout(); router.push("/login"); }}
      className="text-sm text-gray-500 hover:text-gray-900"
    >
      Đăng xuất
    </button>
  );
}
```

- [ ] **Step 7: Create the teacher dashboard placeholder**

```tsx
// apps/web/src/app/(teacher)/dashboard/page.tsx
export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-2 text-gray-500">Chào mừng! Các tính năng sẽ được triển khai trong Phase 3.</p>
    </div>
  );
}
```

- [ ] **Step 8: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/app/
git commit -m "feat: add Next.js app router pages (login, dashboard, layouts)"
```

---

## Task 14: Smoke Test — Dev Server End-to-End

> **Goal:** Verify the full stack runs and the login flow works in browser.

- [ ] **Step 1: Start the full dev stack**

```bash
# Terminal 1 — API
cd apps/api && uvicorn app.main:app --reload --port 8000

# Terminal 2 — Web
cd apps/web && pnpm dev
```

- [ ] **Step 2: Seed a test user in DB (run once)**

In a Python shell or new terminal:
```bash
cd apps/api && python - <<'EOF'
import asyncio, uuid
from app.infrastructure.db.session import AsyncSessionLocal
from app.infrastructure.db.models.user import OrganizationModel, UserModel
from app.infrastructure.security.password import hash_password

async def seed():
    async with AsyncSessionLocal() as db:
        org = OrganizationModel(id=uuid.uuid4(), name="Test Center")
        db.add(org)
        await db.flush()
        user = UserModel(
            id=uuid.uuid4(),
            organization_id=org.id,
            email="admin@school.com",
            password_hash=hash_password("password123"),
            role="admin",
            name="Admin Test",
        )
        db.add(user)
        await db.commit()
        print(f"Created user: {user.email}")

asyncio.run(seed())
EOF
```
Expected: `Created user: admin@school.com`

- [ ] **Step 3: Verify API**

```bash
curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@school.com","password":"password123"}' | python3 -m json.tool
```
Expected: JSON with `access_token`, `refresh_token`, `token_type`.

- [ ] **Step 4: Open browser**

Navigate to `http://localhost:3000` → should redirect to `/login` → enter `admin@school.com` / `password123` → should redirect to `/dashboard`.

- [ ] **Step 5: Verify logout**

Click "Đăng xuất" → should redirect back to `/login`. Verify token is blacklisted:
```bash
# Use the access_token from Step 3
TOKEN="<access_token_from_step3>"
curl -s http://localhost:8000/api/v1/auth/me -H "Authorization: Bearer $TOKEN"
# After logout the token is blacklisted → 401
```

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "feat: phase 2 complete — email/password auth backend + frontend"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Email + password login for Teacher/Admin → Task 6, 9, 12, 13
- [x] JWT access token (15 min) → Task 3, 6
- [x] Refresh token in Redis (30 days) → Task 6, 7
- [x] Access token blacklist on logout → Task 7, 9
- [x] `GET /me` returns current user → Task 9
- [x] Frontend login page → Task 12, 13
- [x] Protected route for Teacher dashboard → Task 13
- [x] Zustand auth store → Task 11
- [x] DB migrations → Task 4
- [x] Tests for all use cases + HTTP endpoints → Tasks 5, 6, 7, 9

**Out of scope for this plan (per spec):**
- OTP login for parents → Phase 3
- Role guards `require_role()` → Phase 3 (when more routes exist)
- Admin route group → Phase 4
