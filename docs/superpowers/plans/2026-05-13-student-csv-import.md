# Student CSV Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bulk student import via CSV with a two-step preview-then-confirm flow.

**Architecture:** Stateless backend — CSV parsed in memory, no temp files. `BulkImportStudentsUseCase` handles parse/validate/confirm. Three new API endpoints. Frontend: "Import CSV" button on students page opens a two-step modal (upload → preview table → confirm).

**Tech Stack:** FastAPI `UploadFile`, Python `csv` stdlib, Pydantic v2, React, axios, lucide-react, Tailwind CSS tokens (primary, ink, ash, canvas, border, surface, success, error)

---

## File Structure

**New files:**
- `apps/api/app/application/use_cases/students/bulk_import_students.py` — use case with preview + confirm logic
- `apps/api/tests/test_bulk_import_students.py` — backend unit tests
- `apps/web/components/students/ImportCSVModal.tsx` — two-step modal component

**Modified files:**
- `apps/api/app/interfaces/api/v1/schemas/student.py` — add 4 new Pydantic schemas
- `apps/api/app/interfaces/api/v1/routers/students.py` — add 3 new endpoints
- `apps/web/src/features/students/model/types.ts` — add 3 new TS interfaces
- `apps/web/src/features/students/api/students.api.ts` — add 3 new API functions
- `apps/web/app/(teacher)/students/page.tsx` — add Import CSV button + mount modal

---

## Task 1: BulkImportStudentsUseCase

**Files:**
- Create: `apps/api/app/application/use_cases/students/bulk_import_students.py`
- Test: `apps/api/tests/test_bulk_import_students.py`

- [ ] **Step 1: Write failing tests**

Create `apps/api/tests/test_bulk_import_students.py`:

```python
import io
from datetime import date
from unittest.mock import AsyncMock, patch
import pytest

from app.application.use_cases.students.bulk_import_students import (
    BulkImportStudentsUseCase,
    PreviewRow,
)

ORG = "00000000-0000-0000-0000-000000000001"
TEACHER = "00000000-0000-0000-0000-000000000002"


def _csv(rows: list[str]) -> bytes:
    return ("name,grade,date_of_birth,note\n" + "\n".join(rows)).encode()


@pytest.mark.asyncio
async def test_preview_valid_rows():
    csv_bytes = _csv(["Nguyễn Văn An,5,2015-03-20,ghi chú", "Trần Thị Bình,3,,"])
    uc = BulkImportStudentsUseCase(student_repo=AsyncMock(), user_repo=AsyncMock())
    result = await uc.preview(csv_bytes, ORG)
    assert result.total_rows == 2
    assert len(result.valid) == 2
    assert len(result.invalid) == 0
    assert result.valid[0].name == "Nguyễn Văn An"
    assert result.valid[0].grade == 5
    assert result.valid[0].date_of_birth == date(2015, 3, 20)
    assert result.valid[1].date_of_birth is None


@pytest.mark.asyncio
async def test_preview_invalid_name():
    csv_bytes = _csv([",5,,"])
    uc = BulkImportStudentsUseCase(student_repo=AsyncMock(), user_repo=AsyncMock())
    result = await uc.preview(csv_bytes, ORG)
    assert len(result.invalid) == 1
    assert any("tên" in e.lower() for e in result.invalid[0].errors)


@pytest.mark.asyncio
async def test_preview_invalid_grade():
    csv_bytes = _csv(["An,abc,,"])
    uc = BulkImportStudentsUseCase(student_repo=AsyncMock(), user_repo=AsyncMock())
    result = await uc.preview(csv_bytes, ORG)
    assert len(result.invalid) == 1
    assert any("khối" in e.lower() for e in result.invalid[0].errors)


@pytest.mark.asyncio
async def test_preview_grade_out_of_range():
    csv_bytes = _csv(["An,13,,"])
    uc = BulkImportStudentsUseCase(student_repo=AsyncMock(), user_repo=AsyncMock())
    result = await uc.preview(csv_bytes, ORG)
    assert len(result.invalid) == 1


@pytest.mark.asyncio
async def test_preview_invalid_date():
    csv_bytes = _csv(["An,5,20-03-2015,"])
    uc = BulkImportStudentsUseCase(student_repo=AsyncMock(), user_repo=AsyncMock())
    result = await uc.preview(csv_bytes, ORG)
    assert len(result.invalid) == 1
    assert any("ngày" in e.lower() for e in result.invalid[0].errors)


@pytest.mark.asyncio
async def test_preview_mixed():
    csv_bytes = _csv(["An,5,,", ",3,,", "Bình,15,,"])
    uc = BulkImportStudentsUseCase(student_repo=AsyncMock(), user_repo=AsyncMock())
    result = await uc.preview(csv_bytes, ORG)
    assert result.total_rows == 3
    assert len(result.valid) == 1
    assert len(result.invalid) == 2


@pytest.mark.asyncio
async def test_confirm_creates_students():
    rows = [
        PreviewRow(row=1, name="An", grade=5, date_of_birth=None, note=None, errors=[]),
        PreviewRow(row=2, name="Bình", grade=3, date_of_birth=None, note=None, errors=[]),
    ]
    student_repo = AsyncMock()
    user_repo = AsyncMock()
    uc = BulkImportStudentsUseCase(student_repo=student_repo, user_repo=user_repo)

    with patch(
        "app.application.use_cases.students.bulk_import_students.CreateStudentUseCase"
    ) as MockUC:
        mock_instance = MockUC.return_value
        mock_instance.execute = AsyncMock(return_value=AsyncMock())
        result = await uc.confirm(rows, ORG, TEACHER)

    assert mock_instance.execute.call_count == 2
    assert result.created == 2
    assert result.failed == []
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api
pytest tests/test_bulk_import_students.py -v 2>&1 | head -20
```
Expected: `ImportError` or `ModuleNotFoundError` — use case does not exist yet.

- [ ] **Step 3: Implement the use case**

Create `apps/api/app/application/use_cases/students/bulk_import_students.py`:

```python
from __future__ import annotations

import csv
import io
import uuid
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
            try:
                await uc.execute(
                    org_id=org_id,
                    name=row.name,
                    grade=row.grade or 1,
                    date_of_birth=row.date_of_birth,
                    note=row.note,
                    parent=None,
                )
                created += 1
            except Exception as e:
                failed.append({"row": row.row, "error": str(e)})

        return ConfirmResult(created=created, failed=failed)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/api
pytest tests/test_bulk_import_students.py -v
```
Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/application/use_cases/students/bulk_import_students.py \
        apps/api/tests/test_bulk_import_students.py
git commit -m "feat: add BulkImportStudentsUseCase with preview and confirm"
```

---

## Task 2: Pydantic Schemas

**Files:**
- Modify: `apps/api/app/interfaces/api/v1/schemas/student.py`

- [ ] **Step 1: Add schemas at end of file**

Append to `apps/api/app/interfaces/api/v1/schemas/student.py`:

```python
class ImportPreviewRow(BaseModel):
    row: int
    name: str
    grade: int | None = None
    date_of_birth: date | None = None
    note: str | None = None
    errors: list[str] = []

    model_config = {"from_attributes": True}


class ImportPreviewResponse(BaseModel):
    valid: list[ImportPreviewRow]
    invalid: list[ImportPreviewRow]
    total_rows: int


class ImportConfirmRequest(BaseModel):
    rows: list[ImportPreviewRow]


class ImportConfirmResponse(BaseModel):
    created: int
    failed: list[dict]
```

- [ ] **Step 2: Verify import works**

```bash
cd apps/api
python -c "from app.interfaces.api.v1.schemas.student import ImportPreviewRow, ImportPreviewResponse, ImportConfirmRequest, ImportConfirmResponse; print('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add apps/api/app/interfaces/api/v1/schemas/student.py
git commit -m "feat: add CSV import Pydantic schemas"
```

---

## Task 3: API Router Endpoints

**Files:**
- Modify: `apps/api/app/interfaces/api/v1/routers/students.py`
- Test: `apps/api/tests/test_bulk_import_students.py` (add endpoint tests)

- [ ] **Step 1: Write failing endpoint test**

Add to `apps/api/tests/test_bulk_import_students.py`:

```python
import io
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_template_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # login first
        login = await client.post("/api/v1/auth/login", json={
            "email": "admin@gmail.com", "password": "password123"
        })
        token = login.json().get("access_token", "fake-token")
        resp = await client.get(
            "/api/v1/students/import/template",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "name,grade,date_of_birth,note" in resp.text
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api
pytest tests/test_bulk_import_students.py::test_template_endpoint -v
```
Expected: `404 Not Found` — endpoint does not exist yet.

- [ ] **Step 3: Add imports and three endpoints to router**

At the top of `apps/api/app/interfaces/api/v1/routers/students.py`, add to the imports:

```python
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.application.use_cases.students.bulk_import_students import BulkImportStudentsUseCase, PreviewRow
from app.interfaces.api.v1.schemas.student import (
    CheckParentResponse,
    CreateStudentRequest,
    ImportConfirmRequest,
    ImportConfirmResponse,
    ImportPreviewResponse,
    ParentInfo,
    StudentResponse,
)
```

Then append these three endpoints **before** the `/{student_id}` route (FastAPI matches routes in order — fixed paths must come before parameterised ones):

```python
_TEMPLATE_CSV = (
    "name,grade,date_of_birth,note\r\n"
    "Nguyễn Văn An,5,2015-03-20,Học giỏi toán\r\n"
    "Trần Thị Bình,3,,\r\n"
)


@router.get("/import/template")
async def download_import_template(token=Depends(_teacher_or_admin)):
    return StreamingResponse(
        iter([_TEMPLATE_CSV]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=\"students_template.csv\""},
    )


@router.post("/import/preview", response_model=ImportPreviewResponse)
async def preview_import(
    file: UploadFile,
    token=Depends(_teacher_or_admin),
    db: AsyncSession = Depends(get_db),
):
    if not (file.filename or "").endswith(".csv"):
        raise HTTPException(status_code=400, detail="Chỉ chấp nhận file .csv")
    contents = await file.read()
    if len(contents) > 500 * 1024:
        raise HTTPException(status_code=400, detail="File quá lớn (tối đa 500KB)")
    uc = BulkImportStudentsUseCase(SQLStudentRepository(db), SQLUserRepository(db))
    result = await uc.preview(contents, token.org_id)
    return ImportPreviewResponse(
        valid=[_row_to_schema(r) for r in result.valid],
        invalid=[_row_to_schema(r) for r in result.invalid],
        total_rows=result.total_rows,
    )


@router.post("/import/confirm", response_model=ImportConfirmResponse)
async def confirm_import(
    body: ImportConfirmRequest,
    token=Depends(_teacher_or_admin),
    db: AsyncSession = Depends(get_db),
):
    rows = [
        PreviewRow(
            row=r.row,
            name=r.name,
            grade=r.grade,
            date_of_birth=r.date_of_birth,
            note=r.note,
            errors=[],
        )
        for r in body.rows
    ]
    uc = BulkImportStudentsUseCase(SQLStudentRepository(db), SQLUserRepository(db))
    result = await uc.confirm(rows, token.org_id, token.user_id)
    return ImportConfirmResponse(created=result.created, failed=result.failed)


def _row_to_schema(r: PreviewRow) -> "ImportPreviewRow":
    from app.interfaces.api.v1.schemas.student import ImportPreviewRow
    return ImportPreviewRow(
        row=r.row, name=r.name, grade=r.grade,
        date_of_birth=r.date_of_birth, note=r.note, errors=r.errors,
    )
```

- [ ] **Step 4: Run all import tests**

```bash
cd apps/api
pytest tests/test_bulk_import_students.py -v
```
Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/interfaces/api/v1/routers/students.py
git commit -m "feat: add CSV import endpoints (template, preview, confirm)"
```

---

## Task 4: Frontend Types + API Client

**Files:**
- Modify: `apps/web/src/features/students/model/types.ts`
- Modify: `apps/web/src/features/students/api/students.api.ts`

- [ ] **Step 1: Add TypeScript interfaces**

Append to `apps/web/src/features/students/model/types.ts`:

```typescript
export interface ImportPreviewRow {
  row: number;
  name: string;
  grade: number | null;
  date_of_birth: string | null;
  note: string | null;
  errors: string[];
}

export interface ImportPreviewResponse {
  valid: ImportPreviewRow[];
  invalid: ImportPreviewRow[];
  total_rows: number;
}

export interface ImportConfirmResponse {
  created: number;
  failed: { row: number; error: string }[];
}
```

- [ ] **Step 2: Add API functions**

Append to `apps/web/src/features/students/api/students.api.ts`:

```typescript
import type {
  CheckParentResponse,
  CreateStudentRequest,
  ImportConfirmResponse,
  ImportPreviewResponse,
  ImportPreviewRow,
  Student,
} from "../model/types";

export async function downloadStudentTemplateApi(): Promise<void> {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : "";
  const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const resp = await fetch(`${BASE_URL}/api/v1/students/import/template`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error("Không thể tải template");
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "students_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export async function previewStudentImportApi(file: File): Promise<ImportPreviewResponse> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<ImportPreviewResponse>("/students/import/preview", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function confirmStudentImportApi(rows: ImportPreviewRow[]): Promise<ImportConfirmResponse> {
  const { data } = await apiClient.post<ImportConfirmResponse>("/students/import/confirm", { rows });
  return data;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/web
pnpm type-check 2>&1 | grep -E "error|Error" | head -10
```
Expected: No errors related to the new types.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/students/model/types.ts \
        apps/web/src/features/students/api/students.api.ts
git commit -m "feat: add CSV import TypeScript types and API client functions"
```

---

## Task 5: ImportCSVModal Component

**Files:**
- Create: `apps/web/components/students/ImportCSVModal.tsx`

- [ ] **Step 1: Create the modal**

Create `apps/web/components/students/ImportCSVModal.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";
import { Upload, ArrowLeft, CheckCircle, XCircle, Download } from "lucide-react";
import {
  confirmStudentImportApi,
  downloadStudentTemplateApi,
  previewStudentImportApi,
} from "@/src/features/students/api/students.api";
import type { ImportPreviewResponse, ImportPreviewRow } from "@/src/features/students/model/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = "upload" | "preview";

export function ImportCSVModal({ open, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  function handleClose() {
    setStep("upload");
    setPreview(null);
    setError(null);
    setToast(null);
    if (fileRef.current) fileRef.current.value = "";
    onClose();
  }

  async function handlePreview() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setError("Vui lòng chọn file CSV"); return; }
    if (!file.name.endsWith(".csv")) { setError("Chỉ chấp nhận file .csv"); return; }
    if (file.size > 500 * 1024) { setError("File quá lớn (tối đa 500KB)"); return; }
    setError(null);
    setLoading(true);
    try {
      const result = await previewStudentImportApi(file);
      setPreview(result);
      setStep("preview");
    } catch {
      setError("Không thể đọc file. Vui lòng kiểm tra lại định dạng.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!preview || preview.valid.length === 0) return;
    setLoading(true);
    try {
      const result = await confirmStudentImportApi(preview.valid);
      setToast(`Đã tạo ${result.created} học sinh`);
      setTimeout(() => {
        handleClose();
        onSuccess();
      }, 1500);
    } catch {
      setError("Có lỗi xảy ra khi tạo học sinh. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4">
      <div className="w-full max-w-2xl rounded-md border border-border bg-canvas shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-semibold text-ink">
            {step === "upload" ? "Import học sinh từ CSV" : `Preview — ${preview?.valid.length ?? 0} hợp lệ / ${preview?.invalid.length ?? 0} lỗi`}
          </h2>
          <button onClick={handleClose} className="text-ash hover:text-ink text-xl leading-none">×</button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {toast && (
            <div className="mb-4 rounded-sm bg-success/10 border border-success/20 px-4 py-2.5 text-sm text-success font-medium">
              {toast}
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-sm bg-error/10 border border-error/20 px-4 py-2.5 text-sm text-error">
              {error}
            </div>
          )}

          {step === "upload" && (
            <div className="flex flex-col gap-4">
              <button
                onClick={downloadStudentTemplateApi}
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline w-fit"
              >
                <Download className="w-4 h-4" />
                Tải template CSV
              </button>
              <div className="rounded-sm border-2 border-dashed border-border bg-surface px-6 py-8 text-center">
                <Upload className="w-8 h-8 text-stone mx-auto mb-3" />
                <p className="text-sm text-ash mb-3">Chọn file CSV để import</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  className="block w-full text-sm text-ash file:mr-3 file:rounded-sm file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-canvas hover:file:bg-primary-hover"
                />
              </div>
            </div>
          )}

          {step === "preview" && preview && (
            <div className="overflow-auto max-h-72">
              {preview.total_rows === 0 ? (
                <p className="text-sm text-ash text-center py-6">Không có dữ liệu trong file</p>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-ash">
                      <th className="py-2 pr-3 font-medium">#</th>
                      <th className="py-2 pr-3 font-medium">Tên</th>
                      <th className="py-2 pr-3 font-medium">Khối</th>
                      <th className="py-2 pr-3 font-medium">Ngày sinh</th>
                      <th className="py-2 pr-3 font-medium">Ghi chú</th>
                      <th className="py-2 font-medium">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...preview.valid, ...preview.invalid]
                      .sort((a, b) => a.row - b.row)
                      .map((r) => {
                        const isValid = r.errors.length === 0;
                        return (
                          <tr key={r.row} className="border-b border-border/50 hover:bg-surface">
                            <td className="py-2 pr-3 text-ash">{r.row}</td>
                            <td className="py-2 pr-3 text-ink">{r.name || "—"}</td>
                            <td className="py-2 pr-3 text-ink">{r.grade ?? "—"}</td>
                            <td className="py-2 pr-3 text-ash">{r.date_of_birth ?? "—"}</td>
                            <td className="py-2 pr-3 text-ash truncate max-w-[100px]">{r.note ?? "—"}</td>
                            <td className="py-2">
                              {isValid ? (
                                <CheckCircle className="w-4 h-4 text-success" />
                              ) : (
                                <span className="flex items-start gap-1">
                                  <XCircle className="w-4 h-4 text-error shrink-0 mt-0.5" />
                                  <span className="text-xs text-error">{r.errors.join(", ")}</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              )}
              {preview.valid.length === 0 && preview.total_rows > 0 && (
                <p className="text-sm text-ash text-center py-3">Không có dòng hợp lệ</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          {step === "upload" ? (
            <>
              <button onClick={handleClose} className="text-sm text-ash hover:text-ink">Huỷ</button>
              <button
                onClick={handlePreview}
                disabled={loading}
                className="rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-canvas hover:bg-primary-hover disabled:opacity-50 transition-colors"
              >
                {loading ? "Đang xử lý..." : "Xem preview →"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setStep("upload"); setError(null); }}
                className="flex items-center gap-1.5 text-sm text-ash hover:text-ink"
              >
                <ArrowLeft className="w-4 h-4" /> Quay lại
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading || (preview?.valid.length ?? 0) === 0}
                className="rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-canvas hover:bg-primary-hover disabled:opacity-50 transition-colors"
              >
                {loading ? "Đang tạo..." : `Tạo ${preview?.valid.length ?? 0} học sinh`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web
pnpm type-check 2>&1 | grep -E "ImportCSVModal|error" | head -10
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/students/ImportCSVModal.tsx
git commit -m "feat: add ImportCSVModal component (two-step upload + preview)"
```

---

## Task 6: Wire Up Students Page

**Files:**
- Modify: `apps/web/app/(teacher)/students/page.tsx`

- [ ] **Step 1: Update the page**

Replace the content of `apps/web/app/(teacher)/students/page.tsx` with:

```tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Users, Plus, ChevronRight, Upload } from "lucide-react";
import { listStudentsApi } from "@/src/features/students/api/students.api";
import { ImportCSVModal } from "@/components/students/ImportCSVModal";
import type { Student } from "@/src/features/students/model/types";

function formatDob(dob: string | null) {
  if (!dob) return "—";
  const d = new Date(dob + "T00:00:00");
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [importOpen, setImportOpen] = useState(false);

  const fetchStudents = useCallback(() => {
    setLoading(true);
    listStudentsApi()
      .then(setStudents)
      .catch(() => setError("Không thể tải danh sách học sinh."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const filtered = useMemo(
    () =>
      query.trim()
        ? students.filter((s) =>
            s.name.toLowerCase().includes(query.trim().toLowerCase())
          )
        : students,
    [students, query]
  );

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-ink tracking-tight">Học sinh</h1>
          </div>
          <p className="text-sm text-ash">
            {!loading && !error
              ? `${students.length} học sinh đang quản lý`
              : "Quản lý danh sách học sinh"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 rounded-sm border border-border bg-canvas px-4 py-2.5 text-sm font-semibold text-ink hover:bg-surface transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
          <Link
            href="/students/new"
            className="flex items-center gap-2 rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-canvas hover:bg-primary-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            Thêm học sinh
          </Link>
        </div>
      </div>

      <ImportCSVModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={fetchStudents}
      />

      {!loading && !error && students.length > 1 && (
        <div className="mb-4">
          <input
            type="text"
            placeholder="Tìm theo tên..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-sm border border-border bg-canvas px-4 py-2.5 text-sm text-ink placeholder:text-stone focus:border-primary focus:outline-none"
          />
        </div>
      )}

      {loading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-md bg-stone/30 animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      {!loading && !error && students.length === 0 && (
        <div className="rounded-md border border-border bg-canvas p-10 text-center">
          <div className="text-4xl mb-3">👤</div>
          <p className="font-semibold text-ink">Chưa có học sinh nào</p>
          <p className="text-ash text-sm mt-1 mb-4">Thêm học sinh đầu tiên để bắt đầu</p>
          <Link
            href="/students/new"
            className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-canvas hover:bg-primary-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            Thêm học sinh
          </Link>
        </div>
      )}

      {!loading && !error && students.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-ash py-6 text-center">Không tìm thấy học sinh nào.</p>
      )}

      <div className="flex flex-col gap-3">
        {filtered.map((s) => (
          <Link
            key={s.id}
            href={`/students/${s.id}`}
            className="group flex items-center justify-between rounded-md border border-border bg-canvas px-5 py-4 hover:border-stone hover:shadow-card transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/8 flex items-center justify-center shrink-0">
                <span className="text-primary font-bold text-sm">
                  {s.name.trim().split(" ").pop()?.slice(0, 2).toUpperCase() ?? "HS"}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-ink group-hover:text-primary transition-colors text-sm">
                    {s.name}
                  </h3>
                  {s.student_code && (
                    <span className="text-xs font-mono text-ash bg-surface border border-border rounded px-1.5 py-0.5">
                      {s.student_code}
                    </span>
                  )}
                </div>
                <p className="text-xs text-ash mt-0.5">
                  {s.grade ? `Khối ${s.grade}` : ""}
                  {s.grade && s.date_of_birth ? " · " : ""}
                  {s.date_of_birth ? `${formatDob(s.date_of_birth)}` : ""}
                  {!s.grade && !s.date_of_birth ? "Chưa có thông tin" : ""}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-stone group-hover:text-ash transition-colors shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web
pnpm type-check 2>&1 | grep -E "error|students/page" | head -10
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(teacher\)/students/page.tsx
git commit -m "feat: add Import CSV button and modal to students page"
```

---

## Task 7: Final Checks + Push

- [ ] **Step 1: Run all backend tests**

```bash
cd apps/api
pytest --tb=short -q
```
Expected: All tests pass, no new failures.

- [ ] **Step 2: Run frontend type check and lint**

```bash
cd apps/web
pnpm type-check && pnpm lint
```
Expected: No errors.

- [ ] **Step 3: Push to GitHub**

```bash
git push origin main
```

Expected: CI pipeline passes all jobs (api-lint, api-test, web-lint, web-build).
