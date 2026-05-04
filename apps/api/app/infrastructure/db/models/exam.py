from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Numeric, SmallInteger, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.db.session import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ExamModel(Base):
    __tablename__ = "exams"
    __table_args__ = (
        CheckConstraint("weight_percent BETWEEN 0 AND 100", name="ck_exam_weight"),
        CheckConstraint("type IN ('quiz', 'midterm', 'final', 'assignment')", name="ck_exam_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    class_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("classes.id"), nullable=False, index=True
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    max_score: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    weight_percent: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    exam_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class GradeModel(Base):
    __tablename__ = "grades"
    __table_args__ = (
        UniqueConstraint("exam_id", "student_id", name="uq_grade"),
    )

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    exam_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("exams.id"), nullable=False, index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("students.id"), nullable=False, index=True
    )
    score: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    graded_by: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    graded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
