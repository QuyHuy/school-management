# Phase 8: Admin Panel — Design Spec

**Date:** 2026-05-08  
**Status:** Approved  
**Approach:** Option B — Route group `(admin)` trong `apps/web`, router `/api/v1/admin/` trong `apps/api`

---

## 1. Overview

Admin Panel cho phép người quản lý trung tâm (role `admin`) thực hiện:
- Quản lý giáo viên: tạo, sửa, đặt lại mật khẩu, vô hiệu hóa
- Xem dashboard tổng quan + drill-down theo giáo viên/lớp
- Báo cáo chuyên cần và điểm số toàn trung tâm có filter
- Cài đặt thông tin trung tâm (tên, liên hệ, năm học, logo URL, Zalo OA)

**Ràng buộc:**
- 1 admin / 1 trung tâm (organization)
- Admin là tài khoản riêng biệt, không kiêm giáo viên
- Admin dùng email + password (giống GV), role check sau login
- Tất cả endpoint `/api/v1/admin/*` đều yêu cầu `require_role("admin")`

---

## 2. Architecture

### Frontend
- Route group `(admin)` trong `apps/web/app/` — layout sidebar riêng, desktop-first
- Feature slice `src/features/admin/` với sub-modules: `teachers`, `reports`, `settings`
- Tái dụng `apiClient`, `useAuthStore`, `getMeApi` từ `features/auth`
- Không có bottom nav (admin là desktop-first)

### Backend
- Router mới `apps/api/app/interfaces/api/v1/routers/admin.py`
- Use cases trong `apps/api/app/application/use_cases/admin/`
- Guard: `require_role("admin")` trên tất cả routes
- Không cần router riêng cho auth — admin dùng `POST /api/v1/auth/login` như GV

### DB Migration
Thêm 4 fields vào bảng `organizations`:

| Field | Type | Nullable | Mô tả |
|---|---|---|---|
| `phone` | VARCHAR(20) | YES | Số điện thoại liên hệ |
| `address` | TEXT | YES | Địa chỉ trung tâm |
| `academic_year` | VARCHAR(20) | YES | Năm học hiện tại, vd "2025-2026" |
| `logo_url` | VARCHAR(500) | YES | URL logo (nhập tay, upload file ở phase sau) |

---

## 3. Pages & Routes

| Route | Mô tả |
|---|---|
| `/admin/login` | Form email + password, riêng biệt với `/login/teacher` |
| `/admin/dashboard` | Stats tổng quan + bảng drill-down GV |
| `/admin/teachers` | Danh sách GV |
| `/admin/teachers/new` | Form tạo GV mới |
| `/admin/teachers/[id]` | Chi tiết GV: info + lớp + HS + actions |
| `/admin/reports/attendance` | Báo cáo chuyên cần (filter: date range, GV, lớp) |
| `/admin/reports/grades` | Báo cáo điểm số (filter: GV, lớp) |
| `/admin/settings` | Form cài đặt trung tâm |

### Admin Layout (`(admin)/layout.tsx`)
- Sidebar cố định trái (w-60): logo/tên trung tâm + nav items
- Nav items: Dashboard · Giáo viên · Báo cáo (sub: Điểm danh / Điểm số) · Cài đặt
- Header top: tên admin + nút Đăng xuất
- Auth guard: `hydrate()` → nếu `role !== "admin"` → redirect `/admin/login`
- Loading state khi chưa xác thực

### Admin Login (`/admin/login`)
- Form email + password
- Gọi `POST /api/v1/auth/login`
- Nếu login thành công nhưng role khác admin → hiển thị lỗi "Tài khoản không có quyền admin"
- Thành công → redirect `/admin/dashboard`

---

## 4. Backend API

### Dashboard
```
GET /api/v1/admin/dashboard
```
Response:
```json
{
  "total_teachers": 5,
  "total_classes": 12,
  "total_students": 180,
  "total_active_classes": 8,
  "attendance_rate_this_month": 92.5,
  "sessions_this_month": 48,
  "teachers": [
    {
      "teacher_id": "uuid",
      "teacher_name": "Nguyễn Văn A",
      "class_count": 3,
      "student_count": 45,
      "sessions_this_month": 12
    }
  ]
}
```

### Teacher Management
```
GET    /api/v1/admin/teachers                     — list all teachers
POST   /api/v1/admin/teachers                     — create teacher
GET    /api/v1/admin/teachers/{id}                — teacher detail
PATCH  /api/v1/admin/teachers/{id}                — update name/email/phone
POST   /api/v1/admin/teachers/{id}/reset-password — set new password (admin provides)
PATCH  /api/v1/admin/teachers/{id}/deactivate     — toggle is_active
```

**POST /admin/teachers body:**
```json
{ "name": "string", "email": "string", "password": "string", "phone": "string|null" }
```

**GET /admin/teachers/{id} response:**
```json
{
  "id": "uuid", "name": "string", "email": "string",
  "phone": "string|null", "is_active": true,
  "created_at": "datetime",
  "classes": [
    { "id": "uuid", "name": "string", "subject": "string",
      "academic_year": "string", "is_active": true, "student_count": 15 }
  ],
  "total_students": 45
}
```

**POST /admin/teachers/{id}/reset-password body:**
```json
{ "new_password": "string" }
```
*Note: reset password không invalidate token hiện tại của GV. GV phải tự logout hoặc đợi token hết hạn.*

**PATCH /admin/teachers/{id}/deactivate:**
- Toggle `is_active` (true → false hoặc ngược lại)
- Khi `is_active = false`, endpoint `POST /api/v1/auth/login` cần trả về 403 cho tài khoản đó
- Không tự động invalidate token đang active của GV trong Phase 8

### Reports
```
GET /api/v1/admin/reports/attendance
  ?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&teacher_id=uuid&class_id=uuid

GET /api/v1/admin/reports/grades
  ?teacher_id=uuid&class_id=uuid
```

**Attendance report response:**
```json
{
  "rows": [
    {
      "teacher_name": "string", "class_name": "string", "subject": "string",
      "total_sessions": 20, "total_attendances": 300,
      "present": 275, "absent": 25, "attendance_rate": 91.7
    }
  ]
}
```

**Grades report response:**
```json
{
  "rows": [
    {
      "teacher_name": "string", "class_name": "string", "subject": "string",
      "student_count": 15, "avg_score": 7.8, "min_score": 4.5, "max_score": 10.0
    }
  ]
}
```

### Settings
```
GET   /api/v1/admin/settings   — lấy thông tin org hiện tại
PATCH /api/v1/admin/settings   — cập nhật
```

**GET response / PATCH body:**
```json
{
  "name": "string",
  "phone": "string|null",
  "address": "string|null",
  "academic_year": "string|null",
  "logo_url": "string|null",
  "zalo_oa_id": "string|null",
  "zalo_oa_token": "string|null"
}
```
*Note: `zalo_oa_token` trong GET response trả về masked (chỉ show 4 ký tự cuối). Trong Phase 8, lưu plaintext vào field `zalo_oa_token_encrypted` hiện có — encryption AES-256-GCM sẽ thêm vào Phase 9 khi tích hợp Zalo.*

---

## 5. Frontend Components

### `src/features/admin/`
```
admin/
  api/
    admin.api.ts         — tất cả API calls (dashboard, teachers, reports, settings)
  model/
    types.ts             — AdminDashboard, TeacherDetail, AttendanceRow, GradeRow, OrgSettings
  ui/
    TeacherTable.tsx     — danh sách GV với status badge + action buttons
    TeacherForm.tsx      — form tạo/sửa GV
    ReportTable.tsx      — generic table cho attendance/grades report
    ReportFilters.tsx    — filter bar (date range, GV select, lớp select)
    SettingsForm.tsx     — form cài đặt trung tâm
    StatCard.tsx         — card hiển thị 1 metric (số GV, số lớp, tỉ lệ,...)
```

### Dashboard page
- 4 StatCard ở trên: Tổng GV / Tổng lớp đang hoạt động / Tổng HS / Tỉ lệ chuyên cần tháng này
- Bảng GV bên dưới: Tên GV | Số lớp | Số HS | Buổi dạy tháng này → click row đến `/admin/teachers/{id}`

### Teacher list page
- Bảng: Tên | Email | Số lớp | Số HS | Trạng thái (Active/Inactive) | Actions (Xem / Vô hiệu hóa)
- Nút "Thêm giáo viên" → `/admin/teachers/new`

### Teacher detail page
- Section thông tin: tên, email, phone + nút Edit (inline form)
- Nút "Đặt lại mật khẩu" → modal nhập mật khẩu mới
- Nút "Vô hiệu hóa / Kích hoạt lại" (toggle)
- Bảng lớp học của GV: Tên lớp | Môn | Năm học | Số HS | Trạng thái
- Tổng số học sinh

### Reports pages
- Filter bar trên cùng (date range chỉ có ở attendance, GV select + lớp select ở cả hai)
- Bảng kết quả bên dưới
- "Chưa có dữ liệu" state khi không có kết quả

### Settings page
- Form đơn: Tên trung tâm | SĐT | Địa chỉ | Năm học (dropdown) | Logo URL | Zalo OA ID | Zalo OA Token (masked)
- Dropdown năm học: danh sách 5 năm gần nhất tính từ năm hiện tại (vd: 2023-2024, 2024-2025, 2025-2026, 2026-2027, 2027-2028)
- Nút Save + success/error toast

---

## 6. Data Flow

### Admin Login
1. User nhập email + password tại `/admin/login`
2. Gọi `POST /api/v1/auth/login` → nhận tokens
3. Gọi `GET /api/v1/auth/me` → check `role === "admin"`
4. Nếu không phải admin → xóa tokens, hiển thị lỗi
5. Nếu là admin → lưu tokens vào localStorage + Zustand → redirect `/admin/dashboard`

### Teacher Creation
1. Admin nhập thông tin GV tại `/admin/teachers/new`
2. Gọi `POST /api/v1/admin/teachers`
3. Backend: tạo User với role `teacher`, hash password, gán cùng `organization_id`
4. Redirect về `/admin/teachers` với success toast

### Reset Password
1. Admin click "Đặt lại mật khẩu" trên trang GV
2. Modal nhập `new_password`
3. Gọi `POST /api/v1/admin/teachers/{id}/reset-password`
4. Backend: hash + update `password_hash`, không invalidate token hiện tại của GV
5. Hiển thị success toast

---

## 7. Error Handling

- **401** — token hết hạn → interceptor refresh tự động, nếu fail → redirect `/admin/login`
- **403** — role không phải admin → redirect `/admin/login` + toast "Không có quyền truy cập"
- **404** — GV không tìm thấy → trang 404 đơn giản với nút Back
- **422** — validation error (email trùng, v.v.) → hiển thị inline error dưới field tương ứng
- **Network error** — toast "Lỗi kết nối, vui lòng thử lại"

---

## 8. Use Cases (Backend)

```
admin/get_dashboard.py       — aggregate query: teachers, classes, students, attendance this month
admin/list_teachers.py       — list users where role=teacher, org_id=current
admin/create_teacher.py      — create User(role=teacher), hash password
admin/get_teacher.py         — teacher + classes + student_count
admin/update_teacher.py      — update name/email/phone
admin/reset_password.py      — hash new_password, update password_hash
admin/toggle_teacher.py      — toggle is_active
admin/get_report_attendance.py — aggregate attendance by class/teacher, filter by date/teacher/class
admin/get_report_grades.py   — aggregate grades by class/teacher, filter by teacher/class
admin/get_settings.py        — get Organization by org_id, mask zalo_oa_token
admin/update_settings.py     — update org fields, encrypt zalo_oa_token if changed
```

---

## 9. Out of Scope (Phase 8)

- Logo file upload (sẽ thêm sau với `POST /admin/settings/logo`)
- Export báo cáo ra CSV/Excel
- Admin tạo/xóa tổ chức (multi-tenant management)
- Thống kê doanh thu / học phí
- Email reset password flow (tự động gửi mail)
- Notification system (Phase 9)
- Zalo OA integration (Phase 9)
