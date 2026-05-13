from __future__ import annotations

import csv
import io
from dataclasses import dataclass, field
from datetime import date
from uuid import UUID

from app.application.use_cases.students.create_student import CreateStudentUseCase
from app.domain.repositories.student_repository import IStudentRepository
from app.domain.repositories.user_repository import IUserRepository


@dataclass
class PreviewRow:
    row: int
    name: str
    grade: int | None
    date_of_birth: date | None
    note: str | None
    errors: list[str] = field(default_factory=list)


@dataclass
class PreviewResult:
    valid: list[PreviewRow]
    invalid: list[PreviewRow]
    total_rows: int


@dataclass
class ConfirmResult:
    created: int
    failed: list[dict]


class BulkImportStudentsUseCase:
    def __init__(self, student_repo: IStudentRepository, user_repo: IUserRepository) -> None:
        self._student_repo = student_repo
        self._user_repo = user_repo

    async def preview(self, file_bytes: bytes, org_id: UUID) -> PreviewResult:
        text = file_bytes.decode("utf-8-sig")  # strip BOM if present
        reader = csv.DictReader(io.StringIO(text))
        valid: list[PreviewRow] = []
        invalid: list[PreviewRow] = []

        for i, raw in enumerate(reader, start=1):
            errors: list[str] = []
            name = (raw.get("name") or "").strip()
            grade_raw = (raw.get("grade") or "").strip()
            dob_raw = (raw.get("date_of_birth") or "").strip()
            note = (raw.get("note") or "").strip() or None

            if not name:
                errors.append("Tên là bắt buộc")

            grade: int | None = None
            if not grade_raw:
                errors.append("Khối là bắt buộc")
            else:
                try:
                    grade = int(grade_raw)
                    if not 1 <= grade <= 12:
                        errors.append("Khối phải từ 1 đến 12")
                        grade = None
                except ValueError:
                    errors.append("Khối phải là số nguyên (1–12)")

            dob: date | None = None
            if dob_raw:
                try:
                    dob = date.fromisoformat(dob_raw)
                except ValueError:
                    errors.append("Ngày sinh không hợp lệ (định dạng YYYY-MM-DD)")

            row = PreviewRow(row=i, name=name, grade=grade, date_of_birth=dob, note=note, errors=errors)
            (invalid if errors else valid).append(row)

        return PreviewResult(valid=valid, invalid=invalid, total_rows=len(valid) + len(invalid))

    async def confirm(self, rows: list[PreviewRow], org_id: UUID, teacher_id: UUID) -> ConfirmResult:
        created = 0
        failed: list[dict] = []
        uc = CreateStudentUseCase(self._student_repo, self._user_repo)

        for row in rows:
            if row.errors:
                failed.append({"row": row.row, "error": "Dòng có lỗi validation, bỏ qua"})
                continue
            # Server-side re-validation: don't trust client-supplied errors=[].
            if not row.name or not row.name.strip():
                failed.append({"row": row.row, "error": "Tên là bắt buộc"})
                continue
            if row.grade is None or not (1 <= row.grade <= 12):
                failed.append({"row": row.row, "error": "Khối phải từ 1 đến 12"})
                continue
            try:
                await uc.execute(
                    org_id=org_id,
                    name=row.name,
                    grade=row.grade,
                    date_of_birth=row.date_of_birth,
                    note=row.note,
                    parent=None,
                )
                created += 1
            except Exception as e:
                failed.append({"row": row.row, "error": str(e)})

        return ConfirmResult(created=created, failed=failed)
