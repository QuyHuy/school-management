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
