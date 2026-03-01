# DevChat

DevChat is a full-stack real-time collaboration chat platform with:

- project and room based chat
- private/public access controls
- unread counters and read tracking
- typing indicator and online presence
- code messages with Python execution output
- file attachments (images, docs, audio)
- WhatsApp-style voice note recording UI with visualizer

The app is dockerized and ready for local use and small-group deployment.

## Tech Stack

- Frontend: React + Vite + Tailwind + Nginx
- Backend: FastAPI + SQLAlchemy + WebSocket
- Database: PostgreSQL
- Runtime: Docker Compose

## Repository Layout

- `backend/`: FastAPI app, DB models, migrations
- `frontend/devchat-frontend/`: React app
- `docker-compose.yml`: full-stack local/prod compose setup

## Prerequisites

- Docker Desktop (or Docker Engine + Compose plugin)
- Git

## Quick Start

1. Clone:
```bash
git clone https://github.com/Siphon18/devchat.git
cd devchat
```

2. Create root env file:
```bash
cp backend/.env.example .env
```

3. Set at least:
- `SECRET_KEY` to a strong random value

4. Start services:
```bash
docker compose up -d --build
```

5. Open:
- Frontend: `http://localhost`
- Backend health: `http://localhost:8000/`

## Environment Variables

Important variables from `.env`:

- `SECRET_KEY`: JWT signing key (required)
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`: DB credentials
- `FRONTEND_URL`: frontend origin for CORS
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `ENABLE_DOCS`: `true|false` (Swagger/ReDoc exposure)
- `RATE_LIMIT_*`: API rate limiting knobs
- `MAX_USER_STORAGE_BYTES`: per-user attachment quota
- `MAX_ATTACHMENTS_PER_MESSAGE`: attachment count limit

## Security Defaults Included

- API rate limiting for auth, uploads and messages
- attachment MIME type validation and size limits
- per-user upload quota guard
- attachment URL normalization to local `/uploads/*`
- docs disabled by default via `ENABLE_DOCS=false`

## Useful Commands

Build and run:
```bash
docker compose up -d --build
```

View logs:
```bash
docker compose logs -f backend
docker compose logs -f frontend
```

Stop:
```bash
docker compose down
```

## Deployment (Free VM style)

For stable free usage with WebSocket + file uploads, deploy this compose setup to a single Linux VM (for example Oracle Cloud Always Free), then:

1. copy repo + `.env`
2. set strong secrets and domain values
3. run `docker compose up -d --build`
4. put TLS (Caddy/Nginx + Let's Encrypt) in front

## Notes

- Local artifact files (`*.db`, uploads, temporary smoke outputs) are ignored and should not be committed.
- If you enable API docs in production, protect them behind auth or IP restrictions.
