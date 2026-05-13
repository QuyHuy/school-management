# Student CSV Import Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow admins/teachers to bulk-create students by uploading a CSV file, with a two-step preview-then-confirm flow before any data is written.

**Architecture:** Two new API endpoints (preview + confirm) keep the backend stateless — no temp files stored. The frontend uses a two-step modal: step 1 uploads the file and shows a preview table, step 2 lets the user confirm valid rows.

**Tech Stack:** FastAPI `UploadFile`, Python `csv` stdlib, React modal, existing `CreateStudentUseCase`

---

## CSV Template

Four columns, first row is header:

```
name,grade,date_of_birth,note
Nguyễn Văn An,5,2015-03-20,Học giỏi toán
Trần Thị Bình,3,,
```

| Column | Required | Format | Validation |
|---|---|---|---|
| `name` | Yes | string | Non-empty |
| `grade` | Yes | integer | 1–12 |
| `date_of_birth` | No | `YYYY-MM-DD` | Valid date or empty |
| `note` | No | string | Any text or empty |

---

## Backend

### New file: `app/application/use_cases/students/bulk_import_students.py`

Two methods on `BulkImportStudentsUseCase`:

**`preview(file_bytes: bytes, org_id: UUID) -> PreviewResult`**
- Parse CSV with Python `csv.DictReader`
- Validate each row: name non-empty, grade integer 1–12, date_of_birth parses as `YYYY-MM-DD` if present
- Return:
  ```python
  @dataclass
  class PreviewRow:
      row: int           # 1-based row number (excluding header)
      name: str
      grade: int | None
      date_of_birth: date | None
      note: str | None
      errors: list[str]  # empty = valid

  @dataclass
  class PreviewResult:
      valid: list[PreviewRow]
      invalid: list[PreviewRow]
      total_rows: int
  ```

**`confirm(rows: list[PreviewRow], org_id: UUID, teacher_id: UUID) -> ConfirmResult`**
- Call existing `CreateStudentUseCase.execute()` for each row (no parent)
- Collect any runtime errors (e.g. DB constraint)
- Return:
  ```python
  @dataclass
  class ConfirmResult:
      created: int
      failed: list[dict]  # { row, error }
  ```

### Modified file: `app/interfaces/api/v1/routers/students.py`

Three new endpoints (all require teacher/admin role):

```
GET  /students/import/template
POST /students/import/preview
POST /students/import/confirm
```

**GET /students/import/template**
- Returns a `StreamingResponse` with CSV content
- `Content-Disposition: attachment; filename="students_template.csv"`
- Body: header row + 2 example rows

**POST /students/import/preview**
- Accepts `UploadFile` (multipart/form-data)
- Validates file is `.csv` and ≤ 500KB
- Calls `BulkImportStudentsUseCase.preview()`
- Returns `PreviewResult` as JSON

**POST /students/import/confirm**
- Accepts JSON body: `{ rows: [PreviewRow] }`
- Calls `BulkImportStudentsUseCase.confirm()`
- Returns `ConfirmResult` as JSON

### Pydantic schemas (`app/interfaces/api/v1/schemas/student.py`)

```python
class ImportPreviewRow(BaseModel):
    row: int
    name: str
    grade: int | None
    date_of_birth: date | None
    note: str | None
    errors: list[str]

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

---

## Frontend

### Modified file: `apps/web/app/(teacher)/students/page.tsx`

Add "Import CSV" button next to "Thêm học sinh":

```tsx
<div className="flex gap-2">
  <Button onClick={() => setImportOpen(true)} variant="outline">
    <Upload className="w-4 h-4 mr-2" /> Import CSV
  </Button>
  <Link href="/students/new">
    <Button><UserPlus className="w-4 h-4 mr-2" />Thêm học sinh</Button>
  </Link>
</div>
<ImportCSVModal open={importOpen} onClose={() => setImportOpen(false)} onSuccess={refetch} />
```

### New file: `apps/web/components/students/ImportCSVModal.tsx`

Two-step modal:

**Step 1 — Upload**
- "Tải template CSV" link → `GET /students/import/template`
- File input (`.csv` only)
- "Xem preview" button → calls `POST /students/import/preview`, advances to step 2

**Step 2 — Preview**
- Header: "X hợp lệ / Y lỗi"
- Table with columns: #, Tên, Khối, Ngày sinh, Ghi chú, Trạng thái
- Valid rows: green `✓` in status column
- Invalid rows: red `✗` + tooltip or inline text showing error messages
- "← Quay lại" button → back to step 1
- "Tạo X học sinh" button (disabled if valid count = 0) → calls `POST /students/import/confirm`
- On success: toast "Đã tạo X học sinh", close modal, reload student list

### API client: `apps/web/lib/api/students.ts`

Add three functions:
- `downloadStudentTemplate()` — fetch + trigger browser download
- `previewStudentImport(file: File)` — POST multipart, return `ImportPreviewResponse`
- `confirmStudentImport(rows: ImportPreviewRow[])` — POST JSON, return `ImportConfirmResponse`

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| File not CSV | Step 1: show error "Chỉ chấp nhận file .csv" |
| File > 500KB | Step 1: show error "File quá lớn (tối đa 500KB)" |
| File empty / header only | Step 2: show "Không có dữ liệu trong file" |
| All rows invalid | Step 2: confirm button disabled, message "Không có dòng hợp lệ" |
| Runtime DB error on confirm | Toast error with count of failed rows |

---

## Tests

**Backend (`tests/test_bulk_import_students.py`):**
- `test_preview_valid_rows` — all valid CSV, returns correct valid list
- `test_preview_invalid_name` — empty name row appears in invalid
- `test_preview_invalid_grade` — non-integer grade in invalid
- `test_preview_invalid_date` — bad date format in invalid
- `test_preview_mixed` — mix of valid and invalid rows
- `test_confirm_creates_students` — mock CreateStudentUseCase, verify called N times
- `test_template_endpoint` — GET returns CSV with correct headers

**Frontend (manual test plan):**
- Download template → opens CSV with correct columns
- Upload valid CSV → step 2 shows all green rows
- Upload CSV with errors → step 2 shows red rows with error text
- Upload CSV with all errors → confirm button disabled
- Confirm → student list reloads with new students
- Upload non-CSV file → error shown on step 1
