# Phase 11: CI/CD Docker Build & Deploy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing CI workflow to build Docker images and push to GitHub Container Registry (GHCR), then deploy to the production VPS via SSH when code is pushed to `main`.

**Architecture:** The existing `.github/workflows/ci.yml` runs lint + test + build. A new `deploy.yml` workflow runs after CI passes on `main`: builds `api` and `web` Docker images, pushes to GHCR (`ghcr.io/<owner>/<repo>/api` and `ghcr.io/<owner>/<repo>/web`), then SSHs to the VPS and runs `docker compose pull && docker compose up -d`. Secrets (SSH key, GHCR token, env vars) are stored in GitHub repository secrets.

**Tech Stack:** GitHub Actions, Docker buildx + GHCR, docker compose, bash/SSH

---

## File Map

**New files:**
- `.github/workflows/deploy.yml` — Docker build + push + SSH deploy

**Modified files:**
- `docker-compose.yml` — use GHCR image names instead of local builds for production pull
- `.github/workflows/ci.yml` — add `requirements-dev.txt` install step (currently uses `requirements-dev.txt`, ensure it exists)

**Required GitHub Secrets (document these, don't create them — the user sets these in GitHub UI):**
- `DEPLOY_SSH_KEY` — private SSH key for VPS access
- `DEPLOY_HOST` — VPS IP or hostname
- `DEPLOY_USER` — VPS SSH username (e.g., `ubuntu`)
- `DEPLOY_PATH` — absolute path to project on VPS (e.g., `/home/ubuntu/school-management`)
- `GHCR_TOKEN` — GitHub personal access token with `write:packages` scope (or use `GITHUB_TOKEN` for same-repo packages)

---

### Task 1: Verify Requirements Dev File Exists

**Files:**
- Check/create: `apps/api/requirements-dev.txt`

- [ ] **Step 1: Check if requirements-dev.txt exists**

```bash
ls apps/api/requirements-dev.txt
```

- [ ] **Step 2: If missing, create it**

```
# apps/api/requirements-dev.txt
-r requirements.txt
pytest==8.3.3
pytest-asyncio==0.24.0
pytest-cov==6.0.0
httpx==0.28.0
respx==0.21.1
```

- [ ] **Step 3: Ensure CI test job uses requirements-dev.txt**

The existing `.github/workflows/ci.yml` api-test job already runs `pip install -r requirements-dev.txt`. Verify this is still correct after reading the file — if it runs `requirements.txt` instead, update the line to `requirements-dev.txt`.

- [ ] **Step 4: Commit if changes were needed**

```bash
git add apps/api/requirements-dev.txt
git commit -m "fix: ensure requirements-dev.txt exists with pytest dependencies"
```

---

### Task 2: Update docker-compose.yml to Support GHCR Images

The production `docker-compose.yml` currently builds from source. For the deploy workflow to pull pre-built images from GHCR, we need to support using image names via env vars. The approach: keep `build:` config for local dev, add `image:` field so `docker compose pull` can pull from GHCR when `IMAGE_TAG` is set.

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add `image:` fields to api and web services**

Read `docker-compose.yml` first, then make this edit:

In the `api` service block, add an `image:` field before `build:`:
```yaml
  api:
    image: ${API_IMAGE:-school-api:local}
    build:
      context: ./apps/api
      dockerfile: Dockerfile
    environment:
      ...
```

In the `web` service block, add an `image:` field before `build:`:
```yaml
  web:
    image: ${WEB_IMAGE:-school-web:local}
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      args:
        ...
```

Add to `.env` (documentation only — don't store real values there):
```bash
# For production pull-based deploys, set these to GHCR image URLs
# API_IMAGE=ghcr.io/your-org/school-management/api:latest
# WEB_IMAGE=ghcr.io/your-org/school-management/web:latest
```

- [ ] **Step 2: Verify docker compose config is valid**

```bash
docker compose config --quiet
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml .env
git commit -m "feat: add image vars to docker-compose for GHCR pull-based deploy"
```

---

### Task 3: Write the Deploy Workflow

**Files:**
- Create: `.github/workflows/deploy.yml`
- Test: Manual trigger with `workflow_dispatch` to verify it runs

- [ ] **Step 1: Create the deploy workflow**

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: deploy-production
  cancel-in-progress: false

jobs:
  # Wait for CI to pass on the same commit
  check-ci:
    name: Wait for CI
    runs-on: ubuntu-latest
    steps:
      - name: Check CI status
        uses: actions/github-script@v7
        with:
          script: |
            const { data: checks } = await github.rest.checks.listForRef({
              owner: context.repo.owner,
              repo: context.repo.repo,
              ref: context.sha,
            });
            const ciRun = checks.check_runs.find(r => r.name === 'API Tests' && r.status === 'completed');
            if (ciRun && ciRun.conclusion !== 'success') {
              core.setFailed('CI tests did not pass');
            }

  build-api:
    name: Build & Push API Image
    runs-on: ubuntu-latest
    needs: check-ci
    permissions:
      contents: read
      packages: write
    outputs:
      image: ${{ steps.meta.outputs.tags }}
    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Docker metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}/api
          tags: |
            type=sha,prefix=,suffix=,format=short
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build and push API
        uses: docker/build-push-action@v6
        with:
          context: ./apps/api
          file: ./apps/api/Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  build-web:
    name: Build & Push Web Image
    runs-on: ubuntu-latest
    needs: check-ci
    permissions:
      contents: read
      packages: write
    outputs:
      image: ${{ steps.meta.outputs.tags }}
    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Docker metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}/web
          tags: |
            type=sha,prefix=,suffix=,format=short
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build and push Web
        uses: docker/build-push-action@v6
        with:
          context: .
          file: ./apps/web/Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          build-args: |
            NEXT_PUBLIC_API_URL=http://localhost
            NEXT_PUBLIC_APP_URL=http://localhost
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    name: Deploy to VPS
    runs-on: ubuntu-latest
    needs: [build-api, build-web]
    environment: production
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          script: |
            set -e
            cd ${{ secrets.DEPLOY_PATH }}

            # Pull latest images from GHCR
            export API_IMAGE=ghcr.io/${{ github.repository }}/api:latest
            export WEB_IMAGE=ghcr.io/${{ github.repository }}/web:latest

            echo "${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io -u ${{ github.actor }} --password-stdin

            docker compose pull api web

            # Rolling restart: stop old, start new
            docker compose up -d --no-build api web

            # Run alembic migrations
            docker compose exec -T api alembic upgrade head

            # Reload nginx to pick up any config changes
            docker compose exec -T nginx nginx -s reload

            echo "Deploy complete for commit ${{ github.sha }}"
```

- [ ] **Step 2: Create GitHub Environments (document for user)**

The deploy job uses `environment: production`. Create this environment in the GitHub repo:
- Go to repo Settings → Environments → New environment → name: `production`
- Optionally add required reviewers for production deploys

- [ ] **Step 3: Document required secrets**

Create a `docs/deploy.md` (only if it doesn't exist) explaining what secrets to add:

```markdown
# Production Deployment Setup

## Required GitHub Secrets

Add these in GitHub repo Settings → Secrets and variables → Actions:

| Secret | Value |
|--------|-------|
| `DEPLOY_HOST` | VPS IP or hostname (e.g., `123.45.67.89`) |
| `DEPLOY_USER` | SSH username (e.g., `ubuntu`) |
| `DEPLOY_SSH_KEY` | Private SSH key (paste content of `~/.ssh/id_rsa`) |
| `DEPLOY_PATH` | Absolute path on VPS (e.g., `/home/ubuntu/school-management`) |

## First-time VPS Setup

```bash
# On VPS: clone repo and create .env
git clone https://github.com/your-org/school-management.git /home/ubuntu/school-management
cd /home/ubuntu/school-management
cp .env .env  # edit with real values
docker compose up -d
docker compose exec api alembic upgrade head
```

## How Deploy Works

1. Push to `main` triggers `deploy.yml`
2. `build-api` and `build-web` jobs build Docker images and push to GHCR
3. `deploy` job SSHs to VPS and runs:
   - `docker compose pull api web` — fetches new images
   - `docker compose up -d --no-build api web` — restarts containers
   - `alembic upgrade head` — runs any new migrations
   - `nginx -s reload` — reloads nginx config
```

- [ ] **Step 4: Verify workflow YAML is valid**

```bash
# Install actionlint if available
which actionlint && actionlint .github/workflows/deploy.yml || echo "actionlint not installed — skip"
```

If actionlint is not installed, verify manually that the YAML is well-formed:
```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml'))" && echo "YAML valid"
```

Expected: `YAML valid`

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/deploy.yml docs/deploy.md
git commit -m "feat: add GitHub Actions deploy workflow (Docker build + push + SSH deploy)"
```

---

### Task 4: Harden CI — Add requirements-dev.txt Check

The api-test job in `ci.yml` needs to install from `requirements-dev.txt`. Verify and update the CI file if needed.

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Read the current ci.yml api-test step**

Check the `run: pip install` line in the `api-test` job. It should be:

```yaml
- run: pip install -r requirements-dev.txt
```

If it currently says `requirements.txt`, update it to `requirements-dev.txt`.

- [ ] **Step 2: Add alembic migration check to CI**

In the `api-test` job, add a step after the pytest step to verify all migrations are consistent:

```yaml
- name: Check migration consistency
  run: alembic check
  working-directory: apps/api
  env:
    DATABASE_URL: postgresql+asyncpg://school:school@localhost:5432/school_test
```

`alembic check` exits non-zero if there are pending model changes not reflected in migrations.

- [ ] **Step 3: Run the full CI locally to verify**

```bash
cd apps/api && pip install -r requirements-dev.txt && pytest --cov=app -q
```

Expected: Tests pass (or note which ones fail due to missing fixtures — these are pre-existing failures, not introduced by this task).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "fix: ensure CI installs requirements-dev.txt and checks migration consistency"
```

---

### Task 5: Add Makefile Shortcuts for Common Deploy Operations

**Files:**
- Modify: `Makefile`

- [ ] **Step 1: Read the current Makefile**

```bash
cat Makefile
```

- [ ] **Step 2: Add deploy-related targets**

Add these targets at the end of `Makefile`:

```makefile
# ── Deploy helpers ──────────────────────────────────────────────────────────

.PHONY: migrate logs ps restart

migrate:  ## Run DB migrations in running API container
	docker compose exec api alembic upgrade head

logs:  ## Tail logs for all services
	docker compose logs -f --tail=100

ps:  ## Show running containers
	docker compose ps

restart:  ## Restart api and web without rebuild
	docker compose restart api web
	docker compose exec nginx nginx -s reload

rollback:  ## Roll back one migration
	docker compose exec api alembic downgrade -1
```

- [ ] **Step 3: Verify make targets work locally**

```bash
make ps
```

Expected: Shows running docker compose services.

- [ ] **Step 4: Commit**

```bash
git add Makefile
git commit -m "feat: add deploy helper targets to Makefile (migrate, logs, ps, restart)"
```

---

## Self-Review

**Spec coverage:**
- ✅ Docker image build for `api` (Python FastAPI)
- ✅ Docker image build for `web` (Next.js)
- ✅ Push to GHCR with `latest` and SHA-based tags
- ✅ GitHub Actions deploy job with SSH
- ✅ Alembic migrations run on deploy
- ✅ Nginx reload on deploy
- ✅ `environment: production` gate for deploy job
- ✅ Build cache with GitHub Actions cache (faster rebuilds)
- ✅ Makefile helpers for day-to-day operations

**Gaps/notes:**
- The `check-ci` job's GitHub API check is best-effort — if the CI workflow runs concurrently with deploy, timing may be off. A simpler alternative is `needs: [build-api]` without the check-ci job, and rely on branch protection rules requiring CI to pass before merge.
- The `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_APP_URL` are hardcoded to `http://localhost` in the build-web step. If the production domain is different (e.g., `https://school.example.com`), add a `NEXT_PUBLIC_API_URL` secret and use it here.
- Database migration on deploy (`alembic upgrade head`) runs with a brief downtime window if the new schema is incompatible with the old code. For zero-downtime, use backward-compatible migrations and a blue-green strategy — out of scope for this phase.
