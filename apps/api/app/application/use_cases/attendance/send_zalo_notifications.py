from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.infrastructure.db.models.attendance import AttendanceRecordModel
from app.infrastructure.db.models.class_ import EnrollmentModel
from app.infrastructure.db.models.student import StudentModel
from app.infrastructure.db.repositories.zalo_repository import SQLZaloRepository
from app.infrastructure.tasks import send_zalo_message


@dataclass
class SendZaloResult:
    sent_count: int
    skipped_count: int


_STATUS_LABEL = {"present": "Có mặt ✅", "absent": "Vắng ❌", "late": "Muộn ⏰"}


class SendZaloNotificationsUseCase:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._zalo_repo = SQLZaloRepository(db)

    async def execute(self, session_id: UUID, org_id: UUID) -> SendZaloResult:
        records = (
            await self._db.execute(
                select(AttendanceRecordModel).where(AttendanceRecordModel.session_id == session_id)
            )
        ).scalars().all()

        sent, skipped = 0, 0
        for record in records:
            student = await self._db.get(StudentModel, record.student_id)
            if not student:
                skipped += 1
                continue

            enrollment = await self._db.scalar(
                select(EnrollmentModel).where(
                    EnrollmentModel.student_id == record.student_id,
                )
            )
            if not enrollment or not enrollment.parent_id:
                skipped += 1
                continue

            binding = await self._zalo_repo.get_by_user_id(enrollment.parent_id)
            if not binding or not binding.is_following:
                skipped += 1
                continue

            status_label = _STATUS_LABEL.get(record.status, record.status)
            message = (
                f"📚 Thông báo điểm danh\n"
                f"Học sinh: {student.name}\n"
                f"Trạng thái: {status_label}\n"
                f"Ghi chú: {record.note or '—'}"
            )
            send_zalo_message.delay(
                binding.zalo_user_id, message, settings.zalo_oa_access_token
            )
            sent += 1

        return SendZaloResult(sent_count=sent, skipped_count=skipped)
