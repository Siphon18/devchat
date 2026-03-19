# DevChat

DevChat is a full-stack, real-time collaboration platform for teams that want chat, lightweight project organization, and in-chat code execution in one place.

It combines:
- project and room based messaging
- role-based member access controls
- live presence and typing events over WebSocket
- Python code messages with execution output
- file and voice-note attachments
- glassmorphism-first frontend design system

The repository is production-oriented and supports both local Docker development and Render deployment.

## Core Capabilities

- Real-time chat with online presence updates
- Public and private projects/rooms with join request workflow
- Unread tracking at room and project level
- Message editing, deletion, reply threading preview
- Attachment uploads with validation and cleanup on message delete
- Code blocks with server-side Python execution and streamed status (`running` -> `success/error`)
- OAuth login support (GitHub and Google)
- Welcome email support via SMTP (optional, feature-flagged)

## Architecture

### Frontend
- React + Vite SPA in `frontend/devchat-frontend/`
- Component-based chat UI with dedicated modals for inbox, directory, member management, and project discovery
- Global toast system (`ToastProvider`, `useToast`) replacing browser alerts
- Styling centered around reusable glass classes in `src/index.css` (`.glass`, `.glass-panel`, `.glass-message`, etc.)

### Backend
- FastAPI app in `backend/app/main.py`
- SQLAlchemy ORM models in `backend/app/models.py`
- JWT auth + OAuth integration
- REST endpoints for CRUD and membership operations
- WebSocket endpoint for room-level real-time messaging and presence
- Sandboxed Python execution subsystem in `backend/app/executor.py`
- SMTP mailer in `backend/app/mailer.py`

### Data Layer
- PostgreSQL
- Alembic migrations in `backend/migrations/`
- Schema validation with Pydantic models in `backend/app/schemas.py`

## Security and Reliability Highlights

- Rate limiting middleware with periodic bucket pruning to prevent in-memory growth
- Message type and language allowlist enforcement
- SQL wildcard escaping for user search (`LIKE` wildcard injection mitigation)
- Access checks for projects/rooms on both HTTP and WebSocket paths
- Sandboxed execution blocks dangerous imports/builtins and strips subprocess environment
- Upload validation (MIME allowlist, URL normalization, user quota)
- Attachment file cleanup when message records are deleted
- WebSocket error isolation: malformed events are logged and skipped without killing connection

## Repository Structure

- `backend/` FastAPI service, DB layer, migrations, Docker image
- `backend/scripts/send_test_welcome_email.py` CLI tool to validate/send test welcome emails
- `frontend/devchat-frontend/` React client, UI components, Vite config
- `docker-compose.yml` local full-stack orchestration
- `render.yaml` Render deployment manifest

## Quick Start (Local)

1. Clone
```bash
git clone https://github.com/Siphon18/devchat.git
cd devchat
```

2. Create root environment file from backend template
```bash
cp backend/.env.example .env
```

3. Set required values in `.env`
- `SECRET_KEY` (strong random)
- `POSTGRES_PASSWORD`

4. Build and run
```bash
docker compose up -d --build
```

5. Open
- Frontend: `http://localhost`
- Backend health: `http://localhost:8000/`

## Environment Configuration

Primary variables:
- `DATABASE_URL`
- `SECRET_KEY`
- `FRONTEND_URL`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `ENABLE_DOCS`

Rate limiting and upload controls:
- `RATE_LIMIT_WINDOW_SECONDS`
- `RATE_LIMIT_DEFAULT_MAX`
- `RATE_LIMIT_AUTH_MAX`
- `RATE_LIMIT_UPLOAD_MAX`
- `RATE_LIMIT_MESSAGE_MAX`
- `MAX_USER_STORAGE_BYTES`
- `MAX_ATTACHMENTS_PER_MESSAGE`

Welcome email (SMTP):
- `WELCOME_EMAIL_ENABLED`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_FROM_EMAIL`
- `SMTP_FROM_NAME`
- `SMTP_USE_TLS`

OAuth:
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

## Email Verification Workflow

Check SMTP config without sending:
```bash
python backend/scripts/send_test_welcome_email.py --to you@example.com --check-only
```

Send a real test welcome email:
```bash
python backend/scripts/send_test_welcome_email.py --to you@example.com --username testuser
```

## Deployment

### Render (Backend)
- `render.yaml` defines a Docker web service with `autoDeploy: true`
- Push to `main` triggers rebuild and redeploy
- Keep sensitive env vars in Render dashboard (not in git)
- After changing env vars, run `Manual Deploy -> Deploy latest commit`

### Frontend
- Can be served via included nginx Dockerfile in `frontend/devchat-frontend/`
- Ensure `VITE_API_URL` points to backend URL

## Operational Commands

Start/rebuild:
```bash
docker compose up -d --build
```

Logs:
```bash
docker compose logs -f backend
docker compose logs -f frontend
```

Stop:
```bash
docker compose down
```

Frontend production build check:
```bash
cd frontend/devchat-frontend
npm run build
```

## Notes

- Do not commit `.env` or secrets.
- Rotate any credential that has been shared publicly.
- Keep SMTP sender addresses verified with your provider (for example Brevo) to avoid delivery failures.
