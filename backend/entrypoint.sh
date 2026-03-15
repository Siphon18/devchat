#!/bin/sh
set -e

echo "⏳  Running database migrations..."
alembic upgrade head

echo "🚀  Starting DevChat backend..."
PORT_VALUE="${PORT:-8000}"
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT_VALUE"
