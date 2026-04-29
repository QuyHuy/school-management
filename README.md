# School Management System

Ứng dụng quản lý trung tâm dạy thêm — PWA hỗ trợ 3 vai trò: Admin, Giáo viên, Phụ huynh. Tích hợp Zalo OA để gửi thông báo học tập.

## Yêu cầu hệ thống

| Công cụ | Phiên bản tối thiểu |
|---|---|
| Python | 3.12 |
| Node.js | 18+ |
| pnpm | 9+ |
| Docker Desktop | 24+ |

---

## Cài đặt lần đầu

### 1. Clone và cài dependencies

```bash
git clone <repo-url>
cd school-management

# Cài frontend dependencies
pnpm install
```

### 2. Tạo file môi trường

```bash
cp .env.example .env
```

File `.env` mặc định đã dùng được cho môi trường dev — không cần chỉnh gì thêm.

> Nếu muốn tích hợp Zalo OA, điền `ZALO_OA_ACCESS_TOKEN` và `ZALO_OA_SECRET_KEY`.

### 3. Tạo virtualenv cho API

```bash
cd apps/api
python3.12 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
cd ../..
```

---

## Khởi động môi trường dev

### Cách 1 — Tất cả qua Docker (đơn giản nhất)

Khởi động toàn bộ stack (Postgres, Redis, API, Web) với một lệnh:

```bash
make dev
```

Truy cập:
- **Web app**: http://localhost:8080
- **API docs (Swagger)**: http://localhost:8080/api/docs
- **API health**: http://localhost:8080/health

Dừng:

```bash
make stop
```

---

### Cách 2 — Chạy tách riêng BE + FE (khuyến nghị khi dev)

Cách này cho phép hot-reload nhanh hơn và dễ debug hơn.

#### Bước 1 — Khởi động database và Redis

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis
```

Đợi ~5 giây để Postgres sẵn sàng. Kiểm tra:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml ps
```

Cột `STATUS` của `postgres` và `redis` phải là `healthy`.

#### Bước 2 — Chạy migration database

```bash
cd apps/api
.venv/bin/alembic upgrade head
cd ../..
```

> Chỉ cần chạy lần đầu, hoặc sau khi pull code có migration mới.

#### Bước 3 — Khởi động Backend (FastAPI)

```bash
cd apps/api
.venv/bin/uvicorn app.main:app --reload --port 8000
```

API chạy tại http://localhost:8000  
Swagger UI: http://localhost:8000/docs

#### Bước 4 — Khởi động Frontend (Next.js)

Mở terminal mới:

```bash
cd apps/web
pnpm dev
```

Web app chạy tại http://localhost:3000

---

## Seed dữ liệu test

Sau khi chạy migration, tạo tài khoản admin để đăng nhập thử:

```bash
cd apps/api
.venv/bin/python - <<'EOF'
import asyncio, uuid
from app.infrastructure.db.session import AsyncSessionLocal
from app.infrastructure.db.models.user import OrganizationModel, UserModel
from app.infrastructure.security.password import hash_password
from sqlalchemy import select

async def seed():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(UserModel).where(UserModel.email == "admin@school.com"))
        if result.scalar_one_or_none():
            print("Đã tồn tại: admin@school.com / password123")
            return
        org = OrganizationModel(id=uuid.uuid4(), name="Trung tâm Demo")
        db.add(org)
        await db.flush()
        db.add(UserModel(
            id=uuid.uuid4(),
            organization_id=org.id,
            email="admin@school.com",
            password_hash=hash_password("password123"),
            role="admin",
            name="Admin Demo",
        ))
        await db.commit()
        print("Đã tạo: admin@school.com / password123")

asyncio.run(seed())
EOF
```

---

## Test luồng đăng nhập

### Kiểm tra qua cURL

```bash
# 1. Đăng nhập
curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@school.com","password":"password123"}' | python3 -m json.tool

# 2. Lấy thông tin user (thay <access_token> bằng token vừa nhận)
curl -s http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer <access_token>"

# 3. Đăng xuất
curl -s -X POST http://localhost:8000/api/v1/auth/logout \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"<refresh_token>"}'
```

### Kiểm tra qua trình duyệt

1. Mở http://localhost:3000 → tự động redirect về `/login`
2. Nhấn **Đăng nhập Giáo viên** → vào form tại `/login/teacher`
3. Nhập `admin@school.com` / `password123` → redirect về `/dashboard`
4. Nhấn **Đăng xuất** → redirect về `/login`

### Swagger UI (dành cho API)

Mở http://localhost:8000/docs để test tất cả endpoints trực tiếp trên browser.

---

## Chạy test suite

```bash
# API tests (Python)
cd apps/api
.venv/bin/pytest -v

# Với coverage report
.venv/bin/pytest --cov=app --cov-report=term-missing

# Frontend type-check
cd apps/web
npx tsc --noEmit
```

---

## Biến môi trường quan trọng

| Biến | Mặc định (dev) | Ghi chú |
|---|---|---|
| `POSTGRES_USER` | `school` | |
| `POSTGRES_PASSWORD` | `school` | Đổi khi production |
| `POSTGRES_DB` | `school` | |
| `DATABASE_URL` | `postgresql+asyncpg://school:school@postgres:5432/school` | Dùng `@localhost` khi chạy ngoài Docker |
| `REDIS_URL` | `redis://redis:6379/0` | Dùng `redis://localhost:6379/0` khi chạy ngoài Docker |
| `JWT_SECRET_KEY` | `change-me-in-production` | **Bắt buộc đổi khi production** |
| `ENVIRONMENT` | `development` | |
| `DEBUG` | `true` | `false` khi production (tắt Swagger) |

> **Lưu ý:** Khi chạy API ngoài Docker (Cách 2), `DATABASE_URL` và `REDIS_URL` phải dùng `localhost` thay vì tên service Docker. File `.env` mặc định đã cấu hình đúng cho Cách 1 (Docker). Khi dùng Cách 2, API tự dùng fallback `localhost` trong `app/config.py`.

---

## Cấu trúc thư mục

```
school-management/
├── apps/
│   ├── api/                    ← FastAPI (Python 3.12, Clean Architecture)
│   │   ├── app/
│   │   │   ├── domain/         ← Entities, repository interfaces
│   │   │   ├── application/    ← Use cases (1 file = 1 trách nhiệm)
│   │   │   ├── infrastructure/ ← SQLAlchemy, Redis, Zalo client
│   │   │   └── interfaces/     ← FastAPI routers, Pydantic schemas
│   │   ├── alembic/            ← Database migrations
│   │   └── tests/              ← pytest tests
│   │
│   └── web/                    ← Next.js 14 PWA (Feature-Sliced Design)
│       ├── app/                ← Next.js App Router (routing)
│       └── src/
│           ├── features/       ← Feature modules (auth, attendance, grades...)
│           ├── entities/       ← Domain types
│           ├── shared/         ← API client, hooks, utilities
│           └── widgets/        ← Composite UI components
│
├── packages/
│   ├── api-types/              ← Auto-generated TypeScript types từ FastAPI
│   └── configs/                ← ESLint, TypeScript, Tailwind base configs
│
├── docker-compose.yml          ← Production services
├── docker-compose.dev.yml      ← Dev overrides (volumes, ports, hot-reload)
├── Makefile                    ← Shortcut commands
└── .env.example                ← Template biến môi trường
```

---

## Lệnh hữu ích

```bash
# Xem logs realtime
make logs

# Tạo migration mới sau khi thêm ORM model
cd apps/api && .venv/bin/alembic revision --autogenerate -m "tên_migration"

# Generate TypeScript types từ FastAPI OpenAPI spec
make gen-types

# Dọn dẹp toàn bộ containers + volumes (xóa DB)
make clean
```
