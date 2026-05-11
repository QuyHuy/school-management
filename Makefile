.PHONY: dev build stop logs migrate migrate-down seed gen-types test lint type-check clean help

# ── Config ───────────────────────────────────────────────────────────────────
COMPOSE     := docker compose -f docker-compose.yml -f docker-compose.dev.yml
API_EXEC    := $(COMPOSE) exec api
DB_URL      ?= postgresql+asyncpg://school:school@localhost:5432/school

# ── Help ─────────────────────────────────────────────────────────────────────
help:
	@echo "School Management — available targets:"
	@echo ""
	@echo "  make dev          Start all services in dev mode (hot-reload)"
	@echo "  make build        Build production images"
	@echo "  make stop         Stop all services"
	@echo "  make logs         Tail logs from all services"
	@echo ""
	@echo "  make migrate      Run Alembic migrations (upgrade head)"
	@echo "  make migrate-down Downgrade last migration"
	@echo "  make seed         Seed development data"
	@echo ""
	@echo "  make gen-types    Generate TypeScript types from FastAPI OpenAPI spec"
	@echo ""
	@echo "  make test         Run all tests (API + Web)"
	@echo "  make lint         Run linters (ruff + next lint)"
	@echo "  make type-check   Run type checkers (mypy + tsc)"
	@echo ""
	@echo "  make clean        Remove containers, volumes, build cache"

# ── Dev ──────────────────────────────────────────────────────────────────────
dev:
	cp -n .env.example .env 2>/dev/null || true
	$(COMPOSE) up --build

build:
	docker compose -f docker-compose.yml build

stop:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f

# ── Database ─────────────────────────────────────────────────────────────────
migrate:
	$(API_EXEC) alembic upgrade head

migrate-down:
	$(API_EXEC) alembic downgrade -1

seed:
	$(API_EXEC) alembic upgrade 008_seed_dev

# ── Type Generation ──────────────────────────────────────────────────────────
gen-types:
	@echo "Generating TypeScript types from FastAPI OpenAPI spec..."
	pnpm --filter @school/api-types generate
	@echo "Types written to packages/api-types/src/generated.d.ts"

# ── Testing ──────────────────────────────────────────────────────────────────
test: test-api test-web

test-api:
	$(API_EXEC) pytest --cov=app --cov-report=term-missing -q

test-web:
	pnpm --filter @school/web test

# ── Code Quality ─────────────────────────────────────────────────────────────
lint:
	$(API_EXEC) ruff check app tests
	pnpm --filter @school/web lint

type-check:
	$(API_EXEC) mypy app
	pnpm --filter @school/web type-check

# ── Deploy helpers ───────────────────────────────────────────────────────────
.PHONY: ps restart rollback

ps:  ## Show running production containers
	docker compose ps

restart:  ## Restart api and web without rebuild (production)
	docker compose restart api web
	docker compose exec nginx nginx -s reload

rollback:  ## Roll back one migration (production)
	docker compose exec api alembic downgrade -1

# ── Utilities ────────────────────────────────────────────────────────────────
clean:
	$(COMPOSE) down -v --remove-orphans
	docker system prune -f
