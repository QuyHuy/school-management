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
    phone: str | None
    address: str | None
    academic_year: str | None
    logo_url: str | None
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
