#!/bin/sh
set -e
alembic upgrade head
exec gunicorn app.main:app \
  --worker-class uvicorn.workers.UvicornWorker \
  --workers 4 \
  --bind "0.0.0.0:${PORT:-8000}" \
  --timeout 120
