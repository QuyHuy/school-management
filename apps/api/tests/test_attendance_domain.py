from datetime import UTC, date, datetime
from uuid import uuid4

from app.domain.entities.attendance import AttendanceRecord, ClassSession


def test_class_session_fields():
    s = ClassSession(
        id=uuid4(),
        class_id=uuid4(),
        date=date(2026, 5, 1),
        notes="First session",
        created_at=datetime.now(UTC),
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
        marked_at=datetime.now(UTC),
    )
    assert r.status == "present"


def test_orm_models_importable():
    from app.infrastructure.db.models.attendance import AttendanceRecordModel, ClassSessionModel
    assert ClassSessionModel.__tablename__ == "class_sessions"
    assert AttendanceRecordModel.__tablename__ == "attendance_records"


def test_sql_repo_is_subclass_of_abc():
    from app.domain.repositories.attendance_repository import IAttendanceRepository
    from app.infrastructure.db.repositories.attendance_repository import SQLAttendanceRepository
    assert issubclass(SQLAttendanceRepository, IAttendanceRepository)
