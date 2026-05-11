from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.attendance.create_session import CreateSessionUseCase
from app.application.use_cases.attendance.send_zalo_notifications import SendZaloNotificationsUseCase
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


@router.post("/{class_id}/sessions/{session_id}/attendance/send-zalo")
async def send_zalo_attendance(
    class_id: UUID,
    session_id: UUID,
    token=Depends(require_role("teacher")),
    db: AsyncSession = Depends(get_db),
):
    result = await SendZaloNotificationsUseCase(db).execute(session_id, token.org_id)
    return {"sent_count": result.sent_count, "skipped_count": result.skipped_count}
