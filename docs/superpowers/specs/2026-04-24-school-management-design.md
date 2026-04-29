# School Management System — Design Spec

**Date:** 2026-04-24  
**Status:** Approved  
**Author:** Brainstorming session

---

## 1. Overview

Ứng dụng quản lý trung tâm dạy thêm, chạy trên mọi thiết bị (điện thoại, máy tính bảng, máy tính) dưới dạng Progressive Web App (PWA). Hỗ trợ 3 vai trò: Admin trung tâm, Giáo viên, và Phụ huynh/Học sinh. Tích hợp Zalo Official Account để gửi thông báo học tập về phụ huynh sau mỗi buổi học.

### Mục tiêu chính

- Giáo viên tạo và quản lý lớp học, học sinh, điểm danh, bài kiểm tra, điểm số
- Gửi nhận xét học tập và vi phạm về phụ huynh qua Zalo OA sau mỗi buổi học
- Phụ huynh theo dõi điểm số, chuyên cần, và phản hồi trực tiếp đến giáo viên
- Admin trung tâm quản lý toàn bộ giáo viên và xem báo cáo tổng hợp

---

## 2. Tech Stack

| Layer | Công nghệ | Lý do |
|---|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript | PWA, SSR, hệ sinh thái React mạnh |
| UI | Tailwind CSS + shadcn/ui | Componentized, design system sẵn |
| Charts | Recharts | Biểu đồ điểm số, analytics |
| Backend | Python FastAPI | Async native, OpenAPI tự sinh, hiệu năng cao |
| ORM | SQLAlchemy + Alembic | Migrations, type-safe queries |
| Database | PostgreSQL 16 | Relational, analytics, row-level security |
| Queue | Celery + Redis | Gửi Zalo async, không block request |
| Cache | Redis | JWT blacklist, OTP TTL, session cache |
| Deploy | Docker Compose + Nginx + VPS Việt Nam | Latency thấp, chi phí thấp (~$15-20/tháng) |
| CI/CD | GitHub Actions | Tự động test, build, deploy |
| Type sync | openapi-typescript | Generate TS types từ FastAPI OpenAPI spec |

---

## 3. Architecture

### 3.1 Monorepo Structure

```
school-management/
├── apps/
│   ├── web/                        ← Next.js 14 PWA (Feature Sliced Design)
│   │   ├── src/
│   │   │   ├── app/                ← Routing + layouts (admin/teacher/parent)
│   │   │   ├── widgets/            ← Composite UI (Sidebar, Navbar, GradeChart)
│   │   │   ├── features/           ← Feature modules độc lập
│   │   │   │   ├── attendance/     ← ui/ + api/ + model/ + lib/
│   │   │   │   ├── grades/
│   │   │   │   ├── students/
│   │   │   │   ├── zalo-notify/
│   │   │   │   └── auth/
│   │   │   ├── entities/           ← Domain types (student, class, grade)
│   │   │   └── shared/             ← ui/, api-client/, hooks/, lib/
│   │   └── public/manifest.json    ← PWA manifest
│   │
│   └── api/                        ← Python FastAPI (Clean Architecture)
│       └── app/
│           ├── domain/             ← Pure Python: entities, repo interfaces
│           ├── application/        ← Use cases (1 file = 1 trách nhiệm)
│           │   └── use_cases/
│           │       ├── attendance/
│           │       ├── grades/
│           │       ├── students/
│           │       └── zalo/
│           ├── infrastructure/     ← SQLAlchemy, Redis, Zalo OA client
│           │   ├── db/
│           │   ├── external/zalo/
│           │   └── cache/
│           └── interfaces/         ← FastAPI routers, Pydantic schemas, Celery tasks
│               ├── api/v1/routers/
│               └── workers/
│
├── packages/
│   ├── ui/                         ← Shared React components (Button, DataTable...)
│   ├── api-types/                  ← Auto-generated từ FastAPI OpenAPI
│   └── configs/                    ← ESLint, TypeScript, Tailwind base configs
│
├── turbo.json
├── pnpm-workspace.yaml
├── docker-compose.yml
└── Makefile
```

### 3.2 Architecture Patterns

**Frontend — Feature Sliced Design (FSD):**
- Import chỉ đi xuống: `app → widgets → features → entities → shared`
- Mỗi feature hoàn toàn độc lập, không cross-import giữa features
- `shared/ui/` chỉ chứa technical components, không biết về domain

**Backend — Clean Architecture:**
- `domain/` — pure Python dataclasses, zero framework dependency, dễ unit test
- `application/` — 1 use case = 1 file, orchestrate domain objects
- `infrastructure/` — SQLAlchemy models, Zalo client, Redis — implement domain interfaces
- `interfaces/` — FastAPI router chỉ validate input → gọi use case → trả response, không chứa business logic

**Type Safety:**
- `make gen-types` → `curl /openapi.json | openapi-typescript` → `packages/api-types/src/index.ts`
- Chạy sau mỗi thay đổi schema Python để giữ FE/BE đồng bộ

### 3.3 System Diagram

```
[Browser PWA] → [Nginx SSL :443]
                     ├── /api/* → [FastAPI :8000] → [PostgreSQL]
                     │                           → [Redis]
                     │                           → [Celery Worker] → [Zalo OA API]
                     └── /*    → [Next.js :3000]

[Zalo OA] → POST /api/v1/zalo/webhook → [FastAPI]
```

---

## 4. Authentication

### Giáo viên / Admin
- Email + mật khẩu → JWT access token (15 phút) + refresh token (30 ngày)
- Refresh token lưu trong Redis với TTL, hỗ trợ revoke (logout tất cả thiết bị)
- Access token blacklist trong Redis khi logout

### Phụ huynh / Học sinh
- Số điện thoại phụ huynh → OTP 6 số gửi qua Zalo OA → JWT
- OTP lưu trong Redis với TTL 5 phút, chỉ dùng 1 lần
- Tài khoản do giáo viên tạo khi thêm học sinh, không tự đăng ký

### Phân quyền
- FastAPI dependency `get_current_org()` inject tự động vào mọi query — tenant isolation đảm bảo không truy cập data org khác
- Role guards: `require_role(["admin"])`, `require_role(["teacher"])`, `require_role(["parent"])`

---

## 5. Data Model

### 5.1 Entities (15 tables)

**Core:**
- `Organization` — trung tâm, có Zalo OA config
- `User` — Admin/GV/Phụ huynh (role enum), GV dùng email+password, PH dùng phone+OTP
- `Student` — hồ sơ học sinh, tách khỏi User account

**Class Management:**
- `Class` — lớp học, thuộc GV và Organization
- `ClassSchedule` — lịch học (day_of_week, start_time, end_time) — thay thế JSONB
- `Enrollment` — junction Student ↔ Class, giữ `parent_id` per-enrollment
- `EnrollmentContact` — hỗ trợ nhiều phụ huynh theo dõi 1 enrollment

**Session & Attendance:**
- `Session` — buổi học (date, start_time, end_time, topic)
- `Attendance` — UNIQUE(session_id, student_id), có `status`, `note`, `violation`, `zalo_sent_at`

**Exams & Grades:**
- `Exam` — bài kiểm tra (type, max_score, weight_percent CHECK 0..100)
- `Grade` — UNIQUE(exam_id, student_id), có `graded_by` audit
- `GradeHistory` — lịch sử thay đổi điểm (old_score, new_score, changed_by, reason)

**Communication:**
- `Notification` — tin nhắn GV→PH, có `recipient_id`, `class_id`, `zalo_msg_id`, `zalo_status`
- `Feedback` — phản hồi PH→GV, có `reply_content`, `replied_by_id`, `replied_at`
- `ZaloBinding` — mapping User.id ↔ zalo_user_id, có `is_following boolean`

### 5.2 Design Decisions

- **UUID v7** (time-ordered) cho tất cả PK — tránh B-tree fragmentation
- **updated_at** (trigger auto-update) + **deleted_at** (soft delete) trên tất cả entities
- **UNIQUE constraints** ở DB level cho Attendance và Grade — không phụ thuộc application code
- **Zalo OA token** encrypt bằng AES-256-GCM trước khi lưu, key từ env `ENCRYPTION_KEY`
- **Exam.weight_percent** là `smallint CHECK (weight_percent BETWEEN 0 AND 100)`, validate tổng ở application layer
- **Indexes thủ công** cho tất cả FK hay dùng trong JOIN: `User.organization_id`, `Class.teacher_id`, `Session.class_id`, `Attendance.session_id`, `Enrollment.parent_id`, `Notification.recipient_id`, v.v.

### 5.3 Key Relationships

```
Organization  1:N  User, Class, Student
User(teacher) 1:N  Class
Student ↔ Class    N:M via Enrollment (+ EnrollmentContact)
Class         1:N  ClassSchedule, Session, Exam
Session       1:N  Attendance       [UNIQUE session_id + student_id]
Exam          1:N  Grade            [UNIQUE exam_id + student_id]
Grade         1:N  GradeHistory
User(parent)  1:1  ZaloBinding
Notification  N:1  Session (nullable)
Feedback      N:1  Notification (nullable)
```

---

## 6. Features by Role

### Admin Trung tâm
| Feature | Mô tả |
|---|---|
| Dashboard | Tổng số GV, HS, lớp, điểm TB, tỉ lệ chuyên cần toàn trung tâm |
| Quản lý Giáo viên | Tạo tài khoản, vô hiệu hóa, reset mật khẩu |
| Xem tất cả Lớp học | Filter theo GV, môn, trạng thái |
| Báo cáo tổng hợp | Điểm TB theo GV/lớp/môn, tỉ lệ chuyên cần theo tuần/tháng |
| Cài đặt Trung tâm | Thông tin, Zalo OA token, cấu hình thông báo |

### Giáo viên
| Feature | Mô tả |
|---|---|
| Dashboard | Lớp hôm nay, việc cần điểm danh, phản hồi mới từ PH |
| Quản lý Lớp | Tạo lớp, thêm lịch học (ClassSchedule), xem sĩ số |
| Quản lý Học sinh | Tạo hồ sơ HS, thêm vào lớp kèm SĐT phụ huynh |
| Điểm danh | Bảng lưới click-to-toggle (P/A/L), ghi vi phạm inline, xem 5 buổi gần nhất |
| Gửi Zalo | Gửi tóm tắt buổi học + nhận xét về toàn bộ PH sau điểm danh |
| Bài kiểm tra | Tạo bài KT, nhập điểm bulk (upsert idempotent) |
| Phân tích điểm | Điểm TB, max/min, biểu đồ tiến bộ, phân phối, danh sách HS yếu |
| Phản hồi PH | Xem inbox, trả lời từng phản hồi |

### Phụ huynh / Học sinh
| Feature | Mô tả |
|---|---|
| Dashboard | Thông báo mới, điểm gần nhất, buổi học sắp tới |
| Điểm số | Xem điểm theo lớp/bài KT, điểm tổng kết có trọng số |
| Chuyên cần | Lịch sử điểm danh theo tháng, tỉ lệ có mặt |
| Thông báo | Nhận xét từng buổi học từ GV (trong app + Zalo) |
| Phản ánh / Tâm tư | Gửi phản ánh điểm số, câu hỏi, tâm tư đến GV |

---

## 7. API Structure

**Base URL:** `/api/v1`  
**Auth:** `Authorization: Bearer {access_token}`  
**Docs:** `/docs` (FastAPI tự sinh OpenAPI)

### Endpoints tóm tắt

| Domain | Endpoints | Vai trò |
|---|---|---|
| Auth | POST /login, /otp/request, /otp/verify, /refresh, /logout · GET /me | Public + All |
| Admin | GET /admin/dashboard, /reports/grades, /reports/attendance · POST/PATCH /admin/teachers · PATCH /admin/settings | Admin |
| Classes | GET/POST /classes · GET/PATCH/DEL /classes/{id} · GET/POST /classes/{id}/schedules · GET/POST/DEL /classes/{id}/enrollments · GET /classes/{id}/analytics | Teacher |
| Sessions | GET/POST /classes/{id}/sessions · GET /sessions/{id}/attendance · POST /sessions/{id}/attendance/bulk · PATCH /sessions/{id}/attendance/{student_id} · POST /sessions/{id}/attendance/send-zalo | Teacher |
| Exams & Grades | GET/POST /classes/{id}/exams · GET/PATCH/DEL /exams/{id} · GET /exams/{id}/grades · POST /exams/{id}/grades/bulk · PATCH /exams/{id}/grades/{student_id} | Teacher |
| Students | GET/POST /students · GET/PATCH /students/{id} · GET /students/{id}/grades · GET /students/{id}/attendance | Teacher + Parent |
| Notifications | GET/POST /notifications · GET/PATCH(reply/read) /feedback | Teacher + Parent |
| Zalo | POST /zalo/webhook · GET /zalo/binding/status · POST /zalo/otp/send | Public (Zalo) + Parent |

### API Conventions

- **Cursor-based pagination:** `?cursor=uuid&limit=20` — tránh offset skip trên data lớn
- **Error format:** `{"error": "NOT_FOUND", "message": "...", "detail": {}}`
- **Tenant isolation:** FastAPI dependency `get_current_org()` inject tự động mọi query
- **Bulk upsert idempotent:** `ON CONFLICT DO UPDATE` cho attendance và grades
- **Async responses:** `202 Accepted` cho send-zalo (Celery job), không block request
- **Versioning:** prefix `/api/v1/`, breaking changes tạo `/api/v2/` song song

---

## 8. Zalo OA Integration Flow

### Gửi thông báo sau điểm danh (async)

```
GV nhấn "Gửi Zalo"
  → POST /sessions/{id}/attendance/send-zalo
  → API tạo Notification records (1 record / học sinh)
  → Enqueue Celery jobs vào queue "zalo_notifications"
  → Response 202 Accepted { queued: N, skipped: M }

Celery Worker (mỗi job):
  → Lookup ZaloBinding by parent User.id
  → Nếu is_following = false → set zalo_status = "not_followed", skip
  → Nếu is_following = true  → Gọi Zalo OA API /message/cs
  → Cập nhật Notification.zalo_status (sent / failed)
  → Retry tối đa 3 lần với exponential backoff nếu fail
```

### Template tin nhắn
```
🏫 {org_name} — Thông báo học tập
━━━━━━━━━━━━━━━━━
📅 Buổi học: {day}, {date}
👤 Học sinh: {student_name}
{status_icon} Trạng thái: {status_label}
📝 Nhận xét: {note}
{violation_line}  ← chỉ hiện nếu có vi phạm

Phụ huynh có thể phản hồi trực tiếp tại đây hoặc qua app.
```

### Zalo Webhook events xử lý

| Event | Xử lý |
|---|---|
| `follow` | Upsert ZaloBinding (is_following=true, last_event_at) |
| `unfollow` | Update ZaloBinding (is_following=false) |
| `user_send_text` | Tạo Feedback record → push notification trong app cho GV |

### OTP Login cho Phụ huynh
1. PH nhập số điện thoại → `POST /zalo/otp/send`
2. API gửi OTP 6 số qua Zalo OA message, lưu hash vào Redis TTL 5 phút
3. PH nhập OTP → `POST /auth/otp/verify` → trả JWT

---

## 9. Deployment & Infrastructure

### Docker Services

| Service | Image | Port | Ghi chú |
|---|---|---|---|
| nginx | nginx:alpine | 80, 443 | SSL termination, reverse proxy, gzip |
| web | custom (Next.js) | 3000 (internal) | Standalone output |
| api | custom (FastAPI) | 8000 (internal) | Gunicorn + Uvicorn workers, auto Alembic migrate |
| celery | same as api | — | Queue: zalo_notifications, concurrency: 4 |
| postgres | postgres:16-alpine | 5432 (internal) | pg_uuidv7 extension, health check |
| redis | redis:7-alpine | 6379 (internal) | AOF persistence |

### Nginx Config Key Points
- Force HTTPS redirect (80 → 443)
- `/api/*` → proxy_pass FastAPI
- `/api/v1/zalo/webhook` → tách riêng với rate limit `5r/s`
- `/*` → proxy_pass Next.js
- Rate limit zones: `api: 30r/s`, `zalo_webhook: 5r/s`

### Environment Variables (required secrets)
```
POSTGRES_USER, POSTGRES_PASSWORD
JWT_SECRET_KEY                    # openssl rand -hex 32
ENCRYPTION_KEY                    # AES key cho Zalo OA token
ZALO_OA_ID, ZALO_ACCESS_TOKEN, ZALO_SECRET_KEY, ZALO_WEBHOOK_SECRET
```

### CI/CD — GitHub Actions
```
Push to main → Test (pytest + jest + type-check) → Lint (ruff + ESLint)
→ Docker build + push to GHCR → SSH deploy to VPS
→ Health check /health → Auto rollback nếu fail
```

### Backup Strategy
- **pg_dump** hàng ngày 2AM → gzip → upload Cloudflare R2 → giữ 30 ngày
- **Redis RDB/AOF** mỗi giờ → giữ 3 ngày
- **RPO = 24h, RTO ≈ 30 phút**
- Test restore mỗi tháng

### Monitoring
- **UptimeRobot** — ping /health mỗi 5 phút, alert Telegram khi down
- **Sentry** — error tracking FastAPI + Next.js (free tier)
- **Flower** — Celery queue monitoring tại `/flower`
- **Structured JSON logs** — rotate hàng ngày, debug qua `docker compose logs -f`

---

## 10. Developer Commands (Makefile)

```bash
make dev          # Khởi động môi trường dev
make deploy       # Deploy lên VPS
make migrate      # Chạy Alembic migrations
make gen-types    # Generate TS types từ FastAPI OpenAPI spec
make backup       # Backup DB thủ công
make logs         # Xem logs realtime (api + celery)
make test         # Chạy toàn bộ test suite (pytest + jest)
```

---

## 11. Out of Scope (V1)

- Dark mode
- Mobile native app (iOS/Android)
- Billing / subscription management
- SMS fallback (chỉ dùng Zalo OA)
- Streaming replication (PostgreSQL HA) — thêm V2 nếu cần RPO < 24h
- Prometheus + Grafana metrics dashboard
- Parent-to-parent messaging
- File/image attachments trong Feedback

---

## 12. Open Questions

1. **Zalo OA registration:** Ai đứng tên đăng ký Zalo OA — trung tâm hay cá nhân GV? Ảnh hưởng đến `org.zalo_oa_id` có phải per-teacher không.
2. **OTP fallback:** Nếu PH chưa follow Zalo OA, gửi OTP qua SMS hay yêu cầu follow OA trước?
3. **Exam weight validation:** Validate tổng weight_percent ≤ 100 per class hay per exam type?
4. **Session generation:** Tự động tạo Session từ ClassSchedule (cron job) hay GV tạo thủ công từng buổi?
