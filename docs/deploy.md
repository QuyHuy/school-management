# Production Deployment Setup

## Required GitHub Secrets

Add these in GitHub repo Settings → Secrets and variables → Actions:

| Secret | Value |
|--------|-------|
| `DEPLOY_HOST` | VPS IP or hostname (e.g., `123.45.67.89`) |
| `DEPLOY_USER` | SSH username (e.g., `ubuntu`) |
| `DEPLOY_SSH_KEY` | Private SSH key (paste content of `~/.ssh/id_rsa`) |
| `DEPLOY_PATH` | Absolute path on VPS (e.g., `/home/ubuntu/school-management`) |
| `NEXT_PUBLIC_API_URL` | Production API URL (e.g., `https://api.school.example.com`) |
| `NEXT_PUBLIC_APP_URL` | Production app URL (e.g., `https://school.example.com`) |

## GitHub Environment

Create a `production` environment in repo Settings → Environments → New environment.
Optionally add required reviewers for production deploys.

## First-time VPS Setup

```bash
# On VPS: clone repo and create .env
git clone https://github.com/your-org/school-management.git /home/ubuntu/school-management
cd /home/ubuntu/school-management
cp .env.example .env  # edit with real values
docker compose up -d
docker compose exec api alembic upgrade head
```

## How Deploy Works

1. Push to `main` triggers `deploy.yml`
2. `build-api` and `build-web` jobs build Docker images in parallel and push to GHCR
3. `deploy` job SSHs to VPS and runs:
   - `docker compose pull api web` — fetches new images from GHCR
   - `docker compose up -d --no-build api web` — restarts containers with new images
   - `alembic upgrade head` — runs any new DB migrations
   - `nginx -s reload` — reloads nginx config

## GHCR Image URLs

Images are published to:
- `ghcr.io/<owner>/<repo>/api:latest` (and SHA-tagged)
- `ghcr.io/<owner>/<repo>/web:latest` (and SHA-tagged)

## Local Pull-based Deploy (optional)

To test pulling GHCR images locally, set these env vars before running `docker compose`:

```bash
# For production pull-based deploys, set these to GHCR image URLs
# API_IMAGE=ghcr.io/your-org/school-management/api:latest
# WEB_IMAGE=ghcr.io/your-org/school-management/web:latest
```
