# Teacher Calendar Redesign — Design Spec

**Date:** 2026-05-12
**Scope:** Teacher portal — Home (calendar), Session detail page, Class detail restructure, Grading system with coefficients

---

## 1. Goals

- Thay thế trang Dashboard dạng list bằng **calendar month view** hiển thị toàn bộ lịch dạy
- Tạo **trang chi tiết buổi học** riêng (điểm danh + ghi chú + bài kiểm tra)
- Restructure **trang chi tiết lớp** thành tab layout (quản lý tổng quát, không còn điểm danh trực tiếp)
- Áp dụng **hệ số tính điểm TB môn** theo chuẩn Việt Nam

---

## 2. Routing Changes

| Route | Thay đổi | Mô tả |
|---|---|---|
| `/dashboard` | Redesign | Calendar month view — lịch dạy tháng này |
| `/classes/[id]` | Restructure | Tab layout: Học sinh / Buổi học / Điểm số / Lịch học |
| `/classes/[id]/sessions/[sessionId]` | **Mới** | Chi tiết buổi học: điểm danh + ghi chú + bài kiểm tra |

Nav sidebar: đổi label "Dashboard" → **"Lịch dạy"**, giữ nguyên icon.

---

## 3. Home — Calendar (Month View)

### 3.1 Layout

- Default view: **month view** (7 cột × n hàng)
- Header: nút `◀` / `▶` đổi tháng, label "Tháng X, YYYY", nút "Hôm nay", nút `+ Tạo buổi học`
- Ngày Chủ nhật: mờ (stone color), không có lịch dạy
- Ngày tháng trước/sau trong grid: mờ (`stone` #c1c1c1)
- Hôm nay: viền `primary` (#ff385c), nền `rgba(255,56,92,0.05)`

### 3.2 Event States (3 trạng thái)

| Trạng thái | Màu nền | Viền trái | Text | Điều kiện |
|---|---|---|---|---|
| Placeholder | `surface` #f7f7f7 | `stone` #c1c1c1 | `ash` #6a6a6a | Có schedule, chưa có session |
| Chưa điểm danh | `rgba(193,53,21,0.08)` | `error` #c13515 | `error` | Session tồn tại, chưa mark |
| Đã điểm danh | `rgba(0,138,5,0.08)` | `success` #008a05 | `#005c04` | Session đã có attendance records |

Mỗi event chip hiển thị: tên lớp + giờ bắt đầu–kết thúc.

### 3.3 Lazy Session Creation

**Khi click vào placeholder event:**
1. `POST /classes/{classId}/sessions { date }` — tạo session
2. Redirect → `/classes/{classId}/sessions/{newId}`

**Khi click vào event đã có session:**
- Redirect thẳng → `/classes/{classId}/sessions/{sessionId}`

**Nút "+ Tạo buổi học":** mở modal gồm:
- Dropdown chọn lớp (fetch từ `GET /classes`)
- Date picker chọn ngày
- Nút "Tạo" → `POST /classes/{classId}/sessions { date }` → redirect đến session detail

### 3.4 API mới

```
GET /api/v1/calendar?month=YYYY-MM
```

Response trả về cho cả tháng:
```json
{
  "sessions": [
    { "id": "uuid", "class_id": "uuid", "class_name": "Toán 10A",
      "date": "2026-05-04", "start_time": "07:30", "end_time": "09:00",
      "has_attendance": true }
  ],
  "schedule_slots": [
    { "class_id": "uuid", "class_name": "Toán 10A",
      "date": "2026-05-12", "start_time": "07:30", "end_time": "09:00" }
  ]
}
```

`schedule_slots` = các ngày trong tháng có schedule nhưng chưa có session (computed backend — iterate class schedules, map `day_of_week` sang ngày cụ thể trong tháng, loại bỏ ngày đã có session).

`has_attendance = true` khi session đó có ít nhất 1 attendance record.

---

## 4. Session Detail Page

**Route:** `/classes/[classId]/sessions/[sessionId]`

### 4.1 Header

- Breadcrumb: `← Lịch dạy / {class_name}`
- Title: `Buổi học — {thứ}, {ngày}/{tháng}/{năm}`
- Subtitle: `{class_name} · {start_time} – {end_time}`
- Badge trạng thái: "Đã điểm danh" (success) hoặc "Chưa điểm danh" (ash)

### 4.2 Data fetching

Session detail page fetch parallel:
- `GET /classes/{classId}` — class info (tên, giờ)
- `GET /classes/{classId}/sessions/{sessionId}` — session data + notes
- `GET /classes/{classId}/enrollments` — danh sách học sinh enrolled
- `GET /classes/{classId}/sessions/{sessionId}/attendance` — attendance records

### 4.3 Section 1 — Điểm danh

- Reuse component `AttendanceSheet` hiện có (nhận props `enrollments`, `students`, `initialRecords`)
- Mỗi học sinh: 3 button toggle — Có mặt / Vắng / Muộn
- Active state: button được chọn dùng màu tương ứng (success/error/ash)
- Footer: tổng hợp đếm + nút "Lưu điểm danh" (`primary`)

### 4.4 Section 2 — Ghi chú buổi học

- Textarea (resize:vertical, min-height 90px)
- Placeholder: "Nội dung buổi học, bài tập về nhà, lưu ý..."
- Nút "Lưu ghi chú" (secondary style: white bg, `border`)
- API: `PATCH /api/v1/classes/{classId}/sessions/{sessionId}` body `{ notes: string }`

### 4.5 Section 3 — Bài kiểm tra

- Reuse `ExamSection` với thêm prop `filterDate?: string` — chỉ hiển thị bài có `exam_date` = ngày session
- Nút `+ Tạo bài kiểm tra` (dark `#222222` bg): mở form inline, tự điền `exam_date` = ngày session (readonly)
- Form tạo bài: **bỏ field `weight_percent`** — hệ số tự động từ `type`

---

## 5. Class Detail — Tab Layout

**Route:** `/classes/[id]`

### 5.1 Tabs

| Tab | Nội dung |
|---|---|
| **Học sinh** | Bảng: tên, số buổi có mặt, số vắng, Điểm TB Môn; nút "+ Thêm học sinh" |
| **Buổi học** | List sessions theo thứ tự mới nhất — link đến session detail; badge trạng thái điểm danh |
| **Điểm số** | `ExamSection` đầy đủ: list bài kiểm tra, badge hệ số ×1/×2/×3, nhập điểm |
| **Lịch học** | `ScheduleList` + `AddScheduleForm` — giữ nguyên như hiện tại |

### 5.2 Tab "Học sinh" — cột Điểm TB Môn

Điểm TB Môn được tính frontend từ dữ liệu grades:
```
TB = Σ(score_quy10 × hệ_số) / Σhệ_số
score_quy10 = (score / max_score) × 10
```
- `assignment` không tính vào TB
- Chưa có bài quiz/midterm/final nào → hiển thị "—" thay vì 0
- TB < 5 → text màu `error` (#c13515)
- TB ≥ 5 → text màu `ink` (#222222)
- Data source: tab Học sinh fetch tất cả exams + tất cả grades của lớp khi mount, tính TB trên frontend

---

## 6. Grading System — Hệ Số

| Exam type | Label | Hệ số | Tính vào TB |
|---|---|---|---|
| `quiz` | KT miệng / Thường xuyên / 15 phút | ×1 | ✓ |
| `midterm` | KT 1 tiết / Giữa kỳ | ×2 | ✓ |
| `final` | Cuối kỳ | ×3 | ✓ |
| `assignment` | Bài tập | — | Không |

**Thay đổi data model:** Field `weight_percent` trong `Exam` giữ nguyên trong DB (không migrate), nhưng không hiển thị trong form tạo bài kiểm tra nữa. Hệ số hiển thị dưới dạng badge cố định (×1, ×2, ×3) dựa trên `type`.

---

## 7. API Summary

### Mới
| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/v1/calendar?month=YYYY-MM` | Calendar data: sessions + schedule slots |
| `PATCH` | `/api/v1/classes/{id}/sessions/{sid}` | Update session notes |

### Giữ nguyên (reuse)
- `POST /api/v1/classes/{id}/sessions` — tạo session (lazy create)
- `GET /api/v1/classes/{id}/sessions` — list sessions (tab Buổi học)
- `PUT /api/v1/classes/{id}/sessions/{sid}/attendance` — mark attendance
- `GET/POST /api/v1/classes/{id}/exams` — exam CRUD
- `GET/POST /api/v1/classes/{id}/exams/{eid}/grades` — grade upsert

---

## 8. Design System Rules

Tất cả UI tuân thủ token từ `packages/configs/tailwind.config.js`:
- **Colors:** `primary` #ff385c, `ink` #222222, `ash` #6a6a6a, `mute` #929292, `stone` #c1c1c1, `border` #dddddd, `surface` #f7f7f7, `canvas` #ffffff, `success` #008a05, `error` #c13515
- **Không dùng:** blue, indigo, teal, purple, orange, yellow
- **Border radius:** `sm`=8px, `md`=14px, `full`=9999px
- **Font:** Inter 500/600/700
- **Shadow:** `shadow-card`

---

## 9. Out of Scope

- Zalo OA integration (tạm dừng)
- Mobile responsive (giữ nguyên behavior hiện tại)
- Week view cho calendar (có thể thêm sau)
- Nhận xét từng học sinh (chỉ ghi chú chung cho buổi)
- Tự động tính GPA toàn trường (chỉ tính TB môn per-class)
