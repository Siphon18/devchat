import os
import time
import asyncio
import logging
from collections import defaultdict, deque
from threading import Lock
import uuid
import secrets
from pathlib import Path
from urllib.parse import urlparse, urlencode
from fastapi import FastAPI, Depends, WebSocket, WebSocketDisconnect, HTTPException, status, UploadFile, File, Request, BackgroundTasks
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
import httpx
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel
from app.database import Base, engine, SessionLocal
from app import models, schemas, auth
from app.mailer import send_welcome_email_safe
from app.executor import SUPPORTED_LANGUAGES, execute_code
from app.websocket import manager
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.models import CodeExecution
from jose import JWTError, jwt

from fastapi.encoders import jsonable_encoder


def env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


ENABLE_DOCS = env_bool("ENABLE_DOCS", False)
app = FastAPI(
    docs_url="/docs" if ENABLE_DOCS else None,
    redoc_url="/redoc" if ENABLE_DOCS else None,
    openapi_url="/openapi.json" if ENABLE_DOCS else None,
)

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads")).resolve()
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MAX_UPLOAD_SIZE = 15 * 1024 * 1024  # 15 MB
MAX_USER_STORAGE_BYTES = int(os.getenv("MAX_USER_STORAGE_BYTES", str(250 * 1024 * 1024)))
MAX_ATTACHMENTS_PER_MESSAGE = int(os.getenv("MAX_ATTACHMENTS_PER_MESSAGE", "10"))
MAX_ATTACHMENT_FILE_NAME_LEN = 255
ALLOWED_UPLOAD_PREFIXES = ("image/", "audio/")
ALLOWED_DOC_TYPES = {
    "application/pdf",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))
RATE_LIMIT_DEFAULT_MAX = int(os.getenv("RATE_LIMIT_DEFAULT_MAX", "240"))
RATE_LIMIT_AUTH_MAX = int(os.getenv("RATE_LIMIT_AUTH_MAX", "15"))
RATE_LIMIT_UPLOAD_MAX = int(os.getenv("RATE_LIMIT_UPLOAD_MAX", "30"))
RATE_LIMIT_MESSAGE_MAX = int(os.getenv("RATE_LIMIT_MESSAGE_MAX", "120"))

_rate_state: dict[str, deque[float]] = defaultdict(deque)
_rate_lock = Lock()

# ── CORS — must be before any route definitions ──────────────────────────
frontend_url = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost",
    "http://localhost:80",
    "http://127.0.0.1:8000",
]
if frontend_url:
    allowed_origins.append(frontend_url)
    # Also allow HTTPS variant
    if frontend_url.startswith("http://"):
        allowed_origins.append(frontend_url.replace("http://", "https://", 1))
    elif frontend_url.startswith("https://"):
        allowed_origins.append(frontend_url.replace("https://", "http://", 1))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "").strip()
    if forwarded:
        return forwarded.split(",")[0].strip() or "unknown"
    return request.client.host if request.client else "unknown"


def rate_limit_bucket(request: Request) -> tuple[str, int]:
    path = request.url.path
    if path == "/token":
        return ("auth", RATE_LIMIT_AUTH_MAX)
    if path == "/register":
        return ("register", RATE_LIMIT_AUTH_MAX)
    if path == "/uploads":
        return ("upload", RATE_LIMIT_UPLOAD_MAX)
    if path == "/messages" and request.method.upper() == "POST":
        return ("messages", RATE_LIMIT_MESSAGE_MAX)
    if path.startswith("/docs") or path.startswith("/openapi") or path.startswith("/redoc"):
        return ("docs", RATE_LIMIT_DEFAULT_MAX)
    return ("default", RATE_LIMIT_DEFAULT_MAX)


@app.middleware("http")
async def apply_rate_limit(request: Request, call_next):
    bucket, max_requests = rate_limit_bucket(request)
    if max_requests <= 0:
        return await call_next(request)

    now = time.time()
    window_start = now - RATE_LIMIT_WINDOW_SECONDS
    client_ip = get_client_ip(request)
    key = f"{bucket}:{client_ip}"

    with _rate_lock:
        q = _rate_state[key]
        while q and q[0] < window_start:
            q.popleft()
        if len(q) >= max_requests:
            retry_after = max(1, int(RATE_LIMIT_WINDOW_SECONDS - (now - q[0])))
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Try again shortly."},
                headers={"Retry-After": str(retry_after)},
            )
        q.append(now)

        # Periodically prune empty rate-limit buckets to prevent memory leak
        if len(_rate_state) > 500:
            empty_keys = [k for k, v in _rate_state.items() if not v]
            for k in empty_keys:
                del _rate_state[k]

    return await call_next(request)


app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# AUTH CONFIG
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = schemas.TokenData(username=username)
    except JWTError:
        raise credentials_exception
        
    user = db.query(models.User).filter(models.User.username == token_data.username).first()
    if user is None:
        raise credentials_exception
    return user


def get_joined_project_membership(db: Session, project_id: int, user_id: int):
    return db.query(models.ProjectMember).filter(
        models.ProjectMember.project_id == project_id,
        models.ProjectMember.user_id == user_id,
        models.ProjectMember.status == "joined",
    ).first()


def get_joined_room_membership(db: Session, room_id: int, user_id: int):
    return db.query(models.RoomMember).filter(
        models.RoomMember.room_id == room_id,
        models.RoomMember.user_id == user_id,
        models.RoomMember.status == "joined",
    ).first()


def require_project_membership(db: Session, project_id: int, user_id: int):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    membership = get_joined_project_membership(db, project_id, user_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this project")
    return membership


def require_room_membership(db: Session, room_id: int, user_id: int):
    room = db.query(models.Room).filter(models.Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    membership = get_joined_room_membership(db, room_id, user_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this room")
    return membership


def require_room_access(db: Session, room_id: int, user_id: int):
    room = db.query(models.Room).filter(models.Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    require_project_membership(db, room.project_id, user_id)
    if room.is_private:
        require_room_membership(db, room_id, user_id)
    return room


def get_user_accessible_rooms_for_project(db: Session, project_id: int, user_id: int):
    """
    Public rooms are accessible to all joined project members.
    Private rooms are accessible only to joined room members.
    """
    return db.query(models.Room).filter(
        models.Room.project_id == project_id,
        or_(
            models.Room.is_private == False,
            models.Room.members.any(
                (models.RoomMember.user_id == user_id) &
                (models.RoomMember.status == "joined")
            )
        )
    ).all()


def validate_upload_type(content_type: str):
    if not content_type:
        raise HTTPException(status_code=400, detail="Unable to detect file type")
    if content_type.startswith(ALLOWED_UPLOAD_PREFIXES):
        return
    if content_type in ALLOWED_DOC_TYPES:
        return
    raise HTTPException(status_code=400, detail=f"Unsupported file type: {content_type}")


def normalize_uploaded_file_url(url: str) -> tuple[str, Path]:
    parsed = urlparse(url)
    raw_path = parsed.path or url
    if not raw_path.startswith("/uploads/"):
        raise HTTPException(status_code=400, detail="Invalid attachment URL")
    filename = Path(raw_path).name
    if not filename:
        raise HTTPException(status_code=400, detail="Invalid attachment URL")
    stored_path = (UPLOAD_DIR / filename).resolve()
    if stored_path.parent != UPLOAD_DIR or not stored_path.exists():
        raise HTTPException(status_code=400, detail="Attachment file not found")
    return f"/uploads/{filename}", stored_path


def get_user_total_attachment_bytes(db: Session, username: str) -> int:
    total = (
        db.query(func.coalesce(func.sum(models.MessageAttachment.file_size), 0))
        .join(models.Message, models.Message.id == models.MessageAttachment.message_id)
        .filter(models.Message.sender == username)
        .scalar()
    )
    return int(total or 0)


def persist_message_attachments(db: Session, message_id: int, attachments: list[dict] | None):
    if not attachments:
        return
    for att in attachments[:MAX_ATTACHMENTS_PER_MESSAGE]:
        url = att.get("url")
        content_type = att.get("content_type")
        if not url or not content_type:
            continue
        normalized_url, stored_path = normalize_uploaded_file_url(str(url))
        normalized_type = str(content_type).lower()
        validate_upload_type(normalized_type)
        file_size = stored_path.stat().st_size
        if file_size <= 0 or file_size > MAX_UPLOAD_SIZE:
            continue
        db.add(models.MessageAttachment(
            message_id=message_id,
            file_name=str(att.get("file_name", "attachment"))[:MAX_ATTACHMENT_FILE_NAME_LEN],
            content_type=normalized_type,
            file_size=file_size,
            url=normalized_url,
        ))


# -------- AUTH ROUTES --------

@app.post("/register", response_model=schemas.UserResponse)
def register(
    user: schemas.UserCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    from app.nicknames import generate_nickname
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    if user.email:
        existing_email = db.query(models.User).filter(models.User.email == user.email).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password,
        gender=user.gender,
        nickname=generate_nickname(),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    if new_user.email:
        background_tasks.add_task(send_welcome_email_safe, new_user.email, new_user.username)
    return new_user


@app.post("/token", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = auth.create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(get_current_user)):
    return current_user


class NicknameUpdate(BaseModel):
    nickname: str


@app.patch("/users/me", response_model=schemas.UserResponse)
def update_nickname(
    body: NicknameUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    current_user.nickname = body.nickname.strip()[:60] or None
    db.commit()
    db.refresh(current_user)
    return current_user


# -------- OAUTH ROUTES --------

# OAuth config from environment
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "").strip()
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "").strip()
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()

# In-memory state store for CSRF protection (use Redis in production)
_oauth_states: dict[str, float] = {}


def _cleanup_expired_states():
    """Remove OAuth states older than 10 minutes."""
    cutoff = time.time() - 600
    expired = [k for k, v in _oauth_states.items() if v < cutoff]
    for k in expired:
        _oauth_states.pop(k, None)


@app.get("/oauth/github")
def oauth_github_redirect():
    """Redirect user to GitHub OAuth authorization page."""
    if not GITHUB_CLIENT_ID:
        raise HTTPException(400, "GitHub OAuth is not configured")
    _cleanup_expired_states()
    state = secrets.token_urlsafe(32)
    _oauth_states[state] = time.time()
    params = urlencode({
        "client_id": GITHUB_CLIENT_ID,
        "scope": "read:user user:email",
        "state": state,
        "redirect_uri": f"{frontend_url}/oauth/callback" if frontend_url else "",
    })
    return RedirectResponse(f"https://github.com/login/oauth/authorize?{params}")


@app.post("/oauth/github/callback")
async def oauth_github_callback(
    body: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Exchange GitHub code for token, create/login user, return JWT."""
    code = body.get("code", "").strip()
    state = body.get("state", "").strip()
    if not code:
        raise HTTPException(400, "Missing authorization code")
    if state not in _oauth_states:
        raise HTTPException(400, "Invalid or expired OAuth state")
    _oauth_states.pop(state, None)

    # Exchange code for access token
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://github.com/login/oauth/access_token",
            json={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
            },
            headers={"Accept": "application/json"},
        )
        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(400, f"GitHub OAuth failed: {token_data.get('error_description', 'unknown error')}")

        # Get user info
        user_resp = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
        )
        gh_user = user_resp.json()
        gh_id = str(gh_user.get("id", ""))
        gh_login = gh_user.get("login", "")
        gh_avatar = gh_user.get("avatar_url", "")

        # Get primary email
        email_resp = await client.get(
            "https://api.github.com/user/emails",
            headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
        )
        emails = email_resp.json()
        primary_email = next((e["email"] for e in emails if e.get("primary")), None) if isinstance(emails, list) else None

    return _oauth_upsert_user(db, background_tasks=background_tasks, provider="github", oauth_id=gh_id,
                              username_hint=gh_login, avatar_url=gh_avatar, email=primary_email)


@app.get("/oauth/google")
def oauth_google_redirect():
    """Redirect user to Google OAuth authorization page."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(400, "Google OAuth is not configured")
    _cleanup_expired_states()
    state = secrets.token_urlsafe(32)
    _oauth_states[state] = time.time()
    params = urlencode({
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": f"{frontend_url}/oauth/callback" if frontend_url else "",
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
        "prompt": "select_account",
    })
    return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{params}")


@app.post("/oauth/google/callback")
async def oauth_google_callback(
    body: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Exchange Google code for token, create/login user, return JWT."""
    code = body.get("code", "").strip()
    state = body.get("state", "").strip()
    if not code:
        raise HTTPException(400, "Missing authorization code")
    if state not in _oauth_states:
        raise HTTPException(400, "Invalid or expired OAuth state")
    _oauth_states.pop(state, None)

    redirect_uri = f"{frontend_url}/oauth/callback" if frontend_url else ""

    async with httpx.AsyncClient() as client:
        # Exchange code for tokens
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
            },
        )
        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(400, f"Google OAuth failed: {token_data.get('error_description', 'unknown error')}")

        # Get user info
        user_resp = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        g_user = user_resp.json()
        g_id = str(g_user.get("id", ""))
        g_name = g_user.get("name", "").replace(" ", "_")[:50] or g_user.get("email", "").split("@")[0][:50]
        g_avatar = g_user.get("picture", "")
        g_email = g_user.get("email", "")

    return _oauth_upsert_user(db, background_tasks=background_tasks, provider="google", oauth_id=g_id,
                              username_hint=g_name, avatar_url=g_avatar, email=g_email)


def _oauth_upsert_user(db: Session, *, background_tasks: BackgroundTasks, provider: str, oauth_id: str,
                       username_hint: str, avatar_url: str, email: str | None):
    """Find or create a user from OAuth, return JWT."""
    from app.nicknames import generate_nickname

    # 1. Try to find by oauth_provider + oauth_id
    user = db.query(models.User).filter(
        models.User.oauth_provider == provider,
        models.User.oauth_id == oauth_id,
    ).first()

    if user:
        # Update avatar if changed
        changed = False
        if avatar_url and user.avatar_url != avatar_url:
            user.avatar_url = avatar_url
            changed = True
        normalized_email = email.strip().lower() if email else None
        if normalized_email and user.email != normalized_email:
            email_owner = db.query(models.User).filter(
                models.User.email == normalized_email,
                models.User.id != user.id,
            ).first()
            if not email_owner:
                user.email = normalized_email
                changed = True
        if changed:
            db.commit()
        access_token = auth.create_access_token(data={"sub": user.username})
        return {"access_token": access_token, "token_type": "bearer", "is_new": False}

    # 2. Create new user — ensure unique username
    base_username = username_hint[:45] or "user"
    username = base_username
    suffix = 0
    while db.query(models.User).filter(models.User.username == username).first():
        suffix += 1
        username = f"{base_username}_{suffix}"

    new_user = models.User(
        username=username,
        email=email.strip().lower() if email else None,
        hashed_password=None,
        gender="neutral",
        nickname=generate_nickname(),
        oauth_provider=provider,
        oauth_id=oauth_id,
        avatar_url=avatar_url,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    if new_user.email:
        background_tasks.add_task(send_welcome_email_safe, new_user.email, new_user.username)

    access_token = auth.create_access_token(data={"sub": new_user.username})
    return {"access_token": access_token, "token_type": "bearer", "is_new": True}


# -------------------- ROOM ROUTES --------------------

@app.get("/projects/public", response_model=list[schemas.ProjectResponse])
def get_discoverable_projects(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Fetch only public projects (not all projects — that would leak private ones)
    public_projects = db.query(models.Project).filter(
        models.Project.is_public == True
    ).all()
    
    # Filter out projects the user is already a member of
    user_memberships = db.query(models.ProjectMember.project_id).filter(
        models.ProjectMember.user_id == current_user.id,
        models.ProjectMember.status == "joined"
    ).all()
    user_project_ids = {m[0] for m in user_memberships}
    
    available_projects = [p for p in public_projects if p.id not in user_project_ids]
    return available_projects

@app.post("/projects/{project_id}/join")
def join_public_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if not project.is_public:
        raise HTTPException(status_code=403, detail="Project is not public. Please request access.")

    existing_mem = db.query(models.ProjectMember).filter(
        models.ProjectMember.project_id == project_id,
        models.ProjectMember.user_id == current_user.id
    ).first()
    
    if existing_mem:
        if existing_mem.status == "joined":
            raise HTTPException(status_code=400, detail="Already a member")
        else:
            existing_mem.status = "joined"
            existing_mem.role = "member"
    else:
        new_mem = models.ProjectMember(
            user_id=current_user.id,
            project_id=project_id,
            role="member",
            status="joined"
        )
        db.add(new_mem)
        
    db.commit()
    return {"status": "joined", "project_id": project_id}

# NOTE: Table creation is managed by Alembic migrations (see entrypoint.sh).
# Do NOT use Base.metadata.create_all() here — it conflicts with migration history.




@app.get("/")
def root():
    return {"status": "DevChat backend running"}


# -------- UPLOADS --------

@app.post("/uploads", response_model=schemas.AttachmentUploadResponse)
async def upload_attachment(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Keep explicit auth dependency to block anonymous uploads.
    _ = current_user

    content_type = (file.content_type or "").lower()
    validate_upload_type(content_type)

    payload = await file.read(MAX_UPLOAD_SIZE + 1)
    if len(payload) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 15 MB)")
    if len(payload) <= 0:
        raise HTTPException(status_code=400, detail="Empty files are not allowed")

    used_bytes = get_user_total_attachment_bytes(db, current_user.username)
    if used_bytes + len(payload) > MAX_USER_STORAGE_BYTES:
        max_mb = round(MAX_USER_STORAGE_BYTES / (1024 * 1024), 1)
        raise HTTPException(status_code=413, detail=f"Storage quota exceeded (max {max_mb} MB per user)")

    original_name = file.filename or "attachment.bin"
    suffix = Path(original_name).suffix
    safe_suffix = suffix[:16] if suffix else ""
    stored_name = f"{uuid.uuid4().hex}{safe_suffix}"
    stored_path = UPLOAD_DIR / stored_name
    stored_path.write_bytes(payload)

    return {
        "file_name": original_name,
        "content_type": content_type,
        "file_size": len(payload),
        "url": f"/uploads/{stored_name}",
    }


# -------- USERS --------

@app.get("/users/search", response_model=list[schemas.UserSearchResponse])
def search_users(q: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not q or len(q) < 2:
        return []
    
    # Escape SQL LIKE wildcards to prevent wildcard injection
    safe_q = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    users = db.query(models.User).filter(
        or_(
            models.User.username.ilike(f"%{safe_q}%", escape="\\"),
            models.User.nickname.ilike(f"%{safe_q}%", escape="\\")
        )
    ).limit(20).all()
    return users


# -------- PROJECTS --------

@app.post("/projects", response_model=schemas.ProjectResponse)
def create_project(
    project: schemas.ProjectCreate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    db_project = models.Project(
        name=project.name,
        owner_id=current_user.id,
        is_public=project.is_public
    )
    db.add(db_project)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Project name already exists")
    db.refresh(db_project)

    # Add creator as admin member
    member = models.ProjectMember(
        user_id=current_user.id,
        project_id=db_project.id,
        role="admin",
        status="joined"
    )
    db.add(member)
    db.commit()

    return db_project


@app.get("/projects")
def list_projects(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Only return projects where the user is a member
    return db.query(models.Project).join(models.ProjectMember).filter(
        models.ProjectMember.user_id == current_user.id,
        models.ProjectMember.status == "joined"
    ).all()


# -------- ROOMS --------

@app.post("/rooms", response_model=schemas.RoomResponse)
def create_room(room: schemas.RoomCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    project = db.query(models.Project).filter(models.Project.id == room.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the project owner can create rooms")

    db_room = models.Room(
        name=room.name,
        project_id=room.project_id,
        creator_id=current_user.id,
        is_private=room.is_private
    )
    db.add(db_room)
    db.commit()
    db.refresh(db_room)

    # Add creator as admin member
    member = models.RoomMember(
        user_id=current_user.id,
        room_id=db_room.id,
        role="admin",
        status="joined"
    )
    db.add(member)
    db.commit()
    
    return db_room


@app.get("/rooms/{project_id}", response_model=list[schemas.RoomResponse])
def list_rooms(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    require_project_membership(db, project_id, current_user.id)
    return db.query(models.Room).filter(
        models.Room.project_id == project_id,
        or_(
            models.Room.is_private == False,
            models.Room.members.any(models.RoomMember.user_id == current_user.id)
        )
    ).all()


@app.get("/rooms/{project_id}/unread")
def get_unread_counts(
    project_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    """Return unread message counts per room for a given project."""
    from datetime import datetime, timezone

    project_membership = require_project_membership(db, project_id, current_user.id)
    joined_at = project_membership.joined_at or datetime(2000, 1, 1, tzinfo=timezone.utc)
    accessible_rooms = get_user_accessible_rooms_for_project(db, project_id, current_user.id)

    result = {}
    for room in accessible_rooms:
        room_membership = db.query(models.RoomMember).filter(
            models.RoomMember.room_id == room.id,
            models.RoomMember.user_id == current_user.id,
            models.RoomMember.status == "joined"
        ).first()
        last_read = (room_membership.last_read_at if room_membership else None) or joined_at
        count = db.query(models.Message).filter(
            models.Message.room_id == room.id,
            models.Message.timestamp > last_read,
            models.Message.sender != current_user.username,  # don't count own messages
            models.Message.is_deleted == False
        ).count()
        if count > 0:
            result[str(room.id)] = count
    return result


@app.get("/users/me/unread")
def get_all_unread_counts(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Return total unread message counts across all rooms for the user."""
    from datetime import datetime, timezone
    
    project_memberships = db.query(models.ProjectMember).filter(
        models.ProjectMember.user_id == current_user.id,
        models.ProjectMember.status == "joined"
    ).all()
    
    result = {"rooms": {}, "projects": {}}
    for pm in project_memberships:
        joined_at = pm.joined_at or datetime(2000, 1, 1, tzinfo=timezone.utc)
        rooms = get_user_accessible_rooms_for_project(db, pm.project_id, current_user.id)
        for room in rooms:
            room_membership = db.query(models.RoomMember).filter(
                models.RoomMember.room_id == room.id,
                models.RoomMember.user_id == current_user.id,
                models.RoomMember.status == "joined"
            ).first()
            last_read = (room_membership.last_read_at if room_membership else None) or joined_at
            count = db.query(models.Message).filter(
                models.Message.room_id == room.id,
                models.Message.timestamp > last_read,
                models.Message.sender != current_user.username,
                models.Message.is_deleted == False
            ).count()
            if count > 0:
                room_id = str(room.id)
                result["rooms"][room_id] = count
                pid_str = str(room.project_id)
                result["projects"][pid_str] = result["projects"].get(pid_str, 0) + count
                
    return result


@app.post("/rooms/{room_id}/read")
def mark_room_read(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Mark a room as read by updating last_read_at."""
    from datetime import datetime, timezone

    room = require_room_access(db, room_id, current_user.id)
    mem = db.query(models.RoomMember).filter(
        models.RoomMember.room_id == room_id,
        models.RoomMember.user_id == current_user.id,
    ).first()
    if not mem:
        mem = models.RoomMember(
            user_id=current_user.id,
            room_id=room.id,
            role="member",
            status="joined",
        )
        db.add(mem)
    mem.last_read_at = datetime.now(timezone.utc)
    db.commit()
    return {"status": "ok"}

@app.patch("/projects/{project_id}/visibility")
def toggle_project_visibility(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the project owner can change visibility")
    project.is_public = not project.is_public
    db.commit()
    db.refresh(project)
    return {"id": project.id, "name": project.name, "is_public": project.is_public}

@app.delete("/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the project owner can delete this project")
    
    db.delete(project)
    db.commit()
    return {"status": "deleted", "id": project_id}

@app.delete("/rooms/{room_id}")
def delete_room(room_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    room = db.query(models.Room).filter(models.Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    project = db.query(models.Project).filter(models.Project.id == room.project_id).first()
    if not project or project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the project owner can delete rooms")
        
    db.delete(room)
    db.commit()
    return {"status": "deleted", "id": room_id}


@app.post("/seed-defaults")
def seed_default_projects(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Create default learning projects and channels owned by the current user."""
    defaults = {
        "Python Basics": ["general", "help", "exercises", "resources", "show-your-code"],
        "Web Development": ["general", "html-css", "javascript", "react", "backend", "resources"],
        "Data Science": ["general", "python-data", "visualization", "ml-basics", "datasets", "help"],
        "Algorithms & DSA": ["general", "arrays-strings", "trees-graphs", "dynamic-programming", "help", "daily-challenge"],
        "DevOps & Cloud": ["general", "docker", "ci-cd", "cloud-platforms", "linux", "resources"],
    }
    created = []
    for proj_name, channels in defaults.items():
        existing = db.query(models.Project).filter(models.Project.name == proj_name).first()
        if existing:
            continue  # skip if already exists
        project = models.Project(name=proj_name, owner_id=current_user.id, is_public=True)
        db.add(project)
        db.flush()  # get project.id
        # Add owner as admin member
        db.add(models.ProjectMember(user_id=current_user.id, project_id=project.id, role="admin", status="joined"))
        for ch_name in channels:
            room = models.Room(name=ch_name, project_id=project.id, creator_id=current_user.id, is_private=False)
            db.add(room)
            db.flush()
            db.add(models.RoomMember(user_id=current_user.id, room_id=room.id, role="admin", status="joined"))
        created.append(proj_name)
    db.commit()
    return {"status": "ok", "created": created, "skipped": len(defaults) - len(created)}


# -------- MESSAGES --------

ALLOWED_MESSAGE_TYPES = {"text", "code"}
ALLOWED_CODE_LANGUAGES = SUPPORTED_LANGUAGES


@app.post("/messages")
def create_message(message: schemas.MessageCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    message_language = (message.language.value if hasattr(message.language, "value") else message.language) or "python"

    # Validate message type and language
    if message.type not in ALLOWED_MESSAGE_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid message type. Must be one of: {', '.join(ALLOWED_MESSAGE_TYPES)}")
    if message.type == "code" and message_language not in ALLOWED_CODE_LANGUAGES:
        raise HTTPException(status_code=400, detail=f"Unsupported language. Must be one of: {', '.join(ALLOWED_CODE_LANGUAGES)}")

    require_room_access(db, message.room_id, current_user.id)
    db_message = models.Message(
        room_id=message.room_id,
        sender=current_user.username,
        type=message.type,
        language=message_language if message.type == "code" else None,
        content=message.content,
        reply_to_id=message.reply_to_id,
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)

    persist_message_attachments(
        db,
        db_message.id,
        [a.model_dump() if hasattr(a, "model_dump") else a for a in (message.attachments or [])]
    )
    db.commit()
    db.refresh(db_message)

    execution_result = None

    if message.type == "code":
        execution_result = execute_code(
            code=message.content,
            language=message_language,
            stdin_text=message.stdin or "",
        )

    if execution_result:
        exec_entry = CodeExecution(
            message_id=db_message.id,
            stdout=execution_result["stdout"],
            stderr=execution_result["stderr"],
            status=execution_result["status"],
            runtime=execution_result.get("runtime")
        )

        db.add(exec_entry)
        db.commit()
        db.refresh(exec_entry)

        execution_result["db_id"] = exec_entry.id


    return {
        "message": jsonable_encoder(schemas.MessageResponse.from_orm(db_message)),
        "execution": execution_result
    }

@app.get("/messages/{room_id}")
def get_messages(
    room_id: int,
    limit: int = 200,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    require_room_access(db, room_id, current_user.id)
    # Clamp limit to a reasonable maximum
    limit = min(max(1, limit), 500)
    offset = max(0, offset)

    # Check if user has cleared this chat recently
    member = db.query(models.RoomMember).filter(
        models.RoomMember.room_id == room_id,
        models.RoomMember.user_id == current_user.id,
        models.RoomMember.status == "joined",
    ).first()

    query = db.query(models.Message).filter(models.Message.room_id == room_id)
    
    if member and member.cleared_at:
        query = query.filter(models.Message.timestamp > member.cleared_at)
        
    messages = query.order_by(models.Message.timestamp.asc()).offset(offset).limit(limit).all()

    response = []
    for m in messages:
        execution = db.query(CodeExecution)\
            .filter(CodeExecution.message_id == m.id)\
            .first()

        msg_dict = schemas.MessageResponse.from_orm(m).dict()
        
        # Hydrate reply_to
        if m.reply_to:
            msg_dict["reply_to"] = schemas.MessageResponse.from_orm(m.reply_to).dict()
            msg_dict["reply_to"].pop("reply_to", None) # Don't nest further

        response.append({
            "message": msg_dict,
            "execution": execution
        })

    return response


@app.put("/messages/{message_id}")
async def edit_message(message_id: int, edit_data: schemas.MessageEdit, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    msg = db.query(models.Message).filter(models.Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    require_room_access(db, msg.room_id, current_user.id)
    if msg.sender != current_user.username:
        raise HTTPException(status_code=403, detail="You can only edit your own messages")
    if msg.is_deleted:
        raise HTTPException(status_code=400, detail="Cannot edit a deleted message")

    msg.content = edit_data.content
    msg.is_edited = True
    db.commit()
    db.refresh(msg)
    
    # Broadcast edit to room
    await manager.broadcast(msg.room_id, {
        "type": "message_update",
        "message": jsonable_encoder(schemas.MessageResponse.from_orm(msg))
    })
    
    return {"status": "success", "message": msg}


@app.delete("/messages/{message_id}")
async def delete_message(message_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    msg = db.query(models.Message).filter(models.Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    require_room_access(db, msg.room_id, current_user.id)
    if msg.sender != current_user.username:
        raise HTTPException(status_code=403, detail="You can only delete your own messages")

    # Clean up attachment files from disk
    attachments = db.query(models.MessageAttachment).filter(
        models.MessageAttachment.message_id == message_id
    ).all()
    for att in attachments:
        try:
            file_path = (UPLOAD_DIR / Path(att.url).name).resolve()
            if file_path.parent == UPLOAD_DIR and file_path.exists():
                file_path.unlink()
        except Exception:
            pass  # Best-effort cleanup

    msg.is_deleted = True
    # We clear the content to save space and ensure privacy, while keeping the record
    msg.content = ""
    db.commit()
    db.refresh(msg)
    
    # Broadcast deletion to room
    await manager.broadcast(msg.room_id, {
        "type": "message_delete",
        "message_id": msg.id,
        "room_id": msg.room_id
    })
    
    return {"status": "success", "message": msg}


@app.delete("/messages/room/{room_id}")
def clear_room_messages(room_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    from datetime import datetime, timezone
    
    room = require_room_access(db, room_id, current_user.id)

    member = db.query(models.RoomMember).filter(
        models.RoomMember.room_id == room_id,
        models.RoomMember.user_id == current_user.id,
        models.RoomMember.status == "joined",
    ).first()
    
    if not member:
        member = models.RoomMember(
            user_id=current_user.id,
            room_id=room.id,
            role="member",
            status="joined",
        )
        db.add(member)

    member.cleared_at = datetime.now(timezone.utc)
    db.commit()
    
    return {"status": "cleared", "room_id": room_id}
  
# --------------- ACCESS CONTROL (INVITES & REQUESTS) ---------------

from pydantic import BaseModel as _PydanticBaseModel

class InviteRequest(_PydanticBaseModel):
    username: str

@app.post("/invites/room/{room_id}")
def invite_to_room(
    room_id: int,
    payload: InviteRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    room = db.query(models.Room).filter(models.Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    # Only admin can invite
    requester_membership = db.query(models.RoomMember).filter(
        models.RoomMember.room_id == room_id,
        models.RoomMember.user_id == current_user.id
    ).first()
    if not requester_membership or requester_membership.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can invite")

    invitee = db.query(models.User).filter(models.User.username == payload.username).first()
    if not invitee:
        raise HTTPException(status_code=404, detail="User not found")

    existing_member = db.query(models.RoomMember).filter(
        models.RoomMember.room_id == room_id,
        models.RoomMember.user_id == invitee.id,
        models.RoomMember.status == "joined"
    ).first()
    if existing_member:
        raise HTTPException(status_code=400, detail="User is already a member")

    existing_invite = db.query(models.Invite).filter(
        models.Invite.target_id == room_id,
        models.Invite.target_type == "room",
        models.Invite.invitee_id == invitee.id,
        models.Invite.status == "pending"
    ).first()
    if existing_invite:
        raise HTTPException(status_code=400, detail="Invite already pending")

    invite = models.Invite(
        inviter_id=current_user.id,
        invitee_id=invitee.id,
        target_id=room_id,
        target_type="room",
        status="pending"
    )
    db.add(invite)
    
    # Optionally, also add them as "invited" RoomMember so old logic still kinda maps,
    # but strictly speaking, the Invite table represents pending invites now.
    db.commit()
    return {"status": "invited", "username": invitee.username}


@app.get("/invites/me", response_model=list[schemas.InviteResponse])
def get_my_invites(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    invites = db.query(models.Invite).filter(
        models.Invite.invitee_id == current_user.id,
        models.Invite.status == "pending"
    ).all()
    # Populate names for frontend
    for inv in invites:
        inv.inviter_name = inv.inviter.username if inv.inviter else "Unknown"
        if inv.target_type == "room":
            room = db.query(models.Room).filter(models.Room.id == inv.target_id).first()
            inv.target_name = room.name if room else f"Room {inv.target_id}"
        elif inv.target_type == "project":
            proj = db.query(models.Project).filter(models.Project.id == inv.target_id).first()
            inv.target_name = proj.name if proj else f"Project {inv.target_id}"
    return invites


@app.get("/requests/incoming")
def get_incoming_requests(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Get all pending access requests for projects/rooms the current user is admin of."""
    # Find project IDs where user is owner
    owned_projects = db.query(models.Project.id).filter(models.Project.owner_id == current_user.id).all()
    owned_project_ids = [p[0] for p in owned_projects]

    # Find room IDs in those projects
    owned_room_ids = []
    if owned_project_ids:
        owned_rooms = db.query(models.Room.id).filter(models.Room.project_id.in_(owned_project_ids)).all()
        owned_room_ids = [r[0] for r in owned_rooms]

    # Fetch pending access requests for those targets
    filters = []
    if owned_project_ids:
        filters.append(
            (models.AccessRequest.target_type == "project") & (models.AccessRequest.target_id.in_(owned_project_ids))
        )
    if owned_room_ids:
        filters.append(
            (models.AccessRequest.target_type == "room") & (models.AccessRequest.target_id.in_(owned_room_ids))
        )
    if not filters:
        return []

    reqs = db.query(models.AccessRequest).filter(
        models.AccessRequest.status == "pending",
        or_(*filters)
    ).all()

    # Populate display info
    for r in reqs:
        r.username = r.user.username if r.user else "Unknown"
        if r.target_type == "room":
            room = db.query(models.Room).filter(models.Room.id == r.target_id).first()
            r.target_name = room.name if room else f"Room {r.target_id}"
        elif r.target_type == "project":
            proj = db.query(models.Project).filter(models.Project.id == r.target_id).first()
            r.target_name = proj.name if proj else f"Project {r.target_id}"
    return reqs


@app.get("/invites/me/count")
def get_my_invite_count(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    invite_count = db.query(models.Invite).filter(
        models.Invite.invitee_id == current_user.id,
        models.Invite.status == "pending"
    ).count()

    # Also count incoming access requests for admin's projects/rooms
    owned_projects = db.query(models.Project.id).filter(models.Project.owner_id == current_user.id).all()
    owned_project_ids = [p[0] for p in owned_projects]
    request_count = 0
    if owned_project_ids:
        owned_rooms = db.query(models.Room.id).filter(models.Room.project_id.in_(owned_project_ids)).all()
        owned_room_ids = [r[0] for r in owned_rooms]
        filters = [
            (models.AccessRequest.target_type == "project") & (models.AccessRequest.target_id.in_(owned_project_ids))
        ]
        if owned_room_ids:
            filters.append(
                (models.AccessRequest.target_type == "room") & (models.AccessRequest.target_id.in_(owned_room_ids))
            )
        request_count = db.query(models.AccessRequest).filter(
            models.AccessRequest.status == "pending",
            or_(*filters)
        ).count()

    return {"count": invite_count + request_count}


class InviteAction(_PydanticBaseModel):
    action: str # "accept" or "decline"

@app.patch("/invites/{invite_id}")
def respond_to_invite(
    invite_id: int,
    payload: InviteAction,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    invite = db.query(models.Invite).filter(
        models.Invite.id == invite_id,
        models.Invite.invitee_id == current_user.id,
        models.Invite.status == "pending"
    ).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found or already processed")

    if payload.action == "accept":
        invite.status = "accepted"
        if invite.target_type == "room":
            mem = db.query(models.RoomMember).filter(
                models.RoomMember.room_id == invite.target_id,
                models.RoomMember.user_id == current_user.id
            ).first()
            if mem:
                mem.status = "joined"
            else:
                new_mem = models.RoomMember(
                    user_id=current_user.id, 
                    room_id=invite.target_id, 
                    role="member", 
                    status="joined"
                )
                db.add(new_mem)
        elif invite.target_type == "project":
            mem = db.query(models.ProjectMember).filter(
                models.ProjectMember.project_id == invite.target_id,
                models.ProjectMember.user_id == current_user.id
            ).first()
            if mem:
                mem.status = "joined"
            else:
                new_mem = models.ProjectMember(
                    user_id=current_user.id, 
                    project_id=invite.target_id, 
                    role="member", 
                    status="joined"
                )
                db.add(new_mem)
                
    elif payload.action == "decline":
        invite.status = "declined"
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

    db.commit()
    return {"status": invite.status}



@app.post("/invites/project/{project_id}")
def invite_to_project(
    project_id: int,
    payload: InviteRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    requester_membership = db.query(models.ProjectMember).filter(
        models.ProjectMember.project_id == project_id,
        models.ProjectMember.user_id == current_user.id
    ).first()
    if not requester_membership or requester_membership.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can invite")

    invitee = db.query(models.User).filter(models.User.username == payload.username).first()
    if not invitee:
        raise HTTPException(status_code=404, detail="User not found")

    existing_member = db.query(models.ProjectMember).filter(
        models.ProjectMember.project_id == project_id,
        models.ProjectMember.user_id == invitee.id,
        models.ProjectMember.status == "joined"
    ).first()
    if existing_member:
        raise HTTPException(status_code=400, detail="User is already a member")

    existing_invite = db.query(models.Invite).filter(
        models.Invite.target_id == project_id,
        models.Invite.target_type == "project",
        models.Invite.invitee_id == invitee.id,
        models.Invite.status == "pending"
    ).first()
    if existing_invite:
        raise HTTPException(status_code=400, detail="Invite already pending")

    invite = models.Invite(
        inviter_id=current_user.id,
        invitee_id=invitee.id,
        target_id=project_id,
        target_type="project",
        status="pending"
    )
    db.add(invite)
    db.commit()
    return {"status": "invited", "username": invitee.username}


@app.post("/requests/room/{room_id}")
def request_join_room(room_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    room = db.query(models.Room).filter(models.Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
        
    existing_mem = db.query(models.RoomMember).filter(
        models.RoomMember.room_id == room_id,
        models.RoomMember.user_id == current_user.id,
        models.RoomMember.status == "joined"
    ).first()
    if existing_mem:
        raise HTTPException(status_code=400, detail="Already a member")

    existing_req = db.query(models.AccessRequest).filter(
        models.AccessRequest.target_id == room_id,
        models.AccessRequest.target_type == "room",
        models.AccessRequest.user_id == current_user.id,
        models.AccessRequest.status == "pending"
    ).first()
    if existing_req:
        raise HTTPException(status_code=400, detail="Request already pending")

    req = models.AccessRequest(
        user_id=current_user.id,
        target_id=room_id,
        target_type="room",
        status="pending"
    )
    db.add(req)
    db.commit()
    return {"status": "requested"}


@app.post("/requests/project/{project_id}")
def request_join_project(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    proj = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
        
    existing_mem = db.query(models.ProjectMember).filter(
        models.ProjectMember.project_id == project_id,
        models.ProjectMember.user_id == current_user.id,
        models.ProjectMember.status == "joined"
    ).first()
    if existing_mem:
        raise HTTPException(status_code=400, detail="Already a member")

    existing_req = db.query(models.AccessRequest).filter(
        models.AccessRequest.target_id == project_id,
        models.AccessRequest.target_type == "project",
        models.AccessRequest.user_id == current_user.id,
        models.AccessRequest.status == "pending"
    ).first()
    if existing_req:
        raise HTTPException(status_code=400, detail="Request already pending")

    req = models.AccessRequest(
        user_id=current_user.id,
        target_id=project_id,
        target_type="project",
        status="pending"
    )
    db.add(req)
    db.commit()
    return {"status": "requested"}


@app.get("/requests/{target_type}/{target_id}", response_model=list[schemas.AccessRequestResponse])
def get_pending_requests(
    target_type: str, 
    target_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    # Check if admin
    if target_type == "room":
        mem = db.query(models.RoomMember).filter(
            models.RoomMember.room_id == target_id,
            models.RoomMember.user_id == current_user.id
        ).first()
    elif target_type == "project":
        mem = db.query(models.ProjectMember).filter(
            models.ProjectMember.project_id == target_id,
            models.ProjectMember.user_id == current_user.id
        ).first()
    else:
        raise HTTPException(status_code=400, detail="Invalid target type")

    if not mem or mem.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view requests")

    reqs = db.query(models.AccessRequest).filter(
        models.AccessRequest.target_id == target_id,
        models.AccessRequest.target_type == target_type,
        models.AccessRequest.status == "pending"
    ).all()
    for r in reqs:
        r.username = r.user.username if r.user else "Unknown"
    return reqs


@app.patch("/requests/{request_id}")
def respond_to_request(
    request_id: int,
    payload: dict, # {"action": "approve" | "deny"}
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    req = db.query(models.AccessRequest).filter(
        models.AccessRequest.id == request_id, 
        models.AccessRequest.status == "pending"
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found or processed")

    # Check admin
    if req.target_type == "room":
        mem = db.query(models.RoomMember).filter(
            models.RoomMember.room_id == req.target_id,
            models.RoomMember.user_id == current_user.id
        ).first()
    else:
        mem = db.query(models.ProjectMember).filter(
            models.ProjectMember.project_id == req.target_id,
            models.ProjectMember.user_id == current_user.id
        ).first()

    if not mem or mem.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can approve requests")

    action = payload.get("action")
    if action == "approve":
        req.status = "approved"
        if req.target_type == "room":
            new_mem = models.RoomMember(user_id=req.user_id, room_id=req.target_id, role="member", status="joined")
            db.add(new_mem)
        else:
            new_mem = models.ProjectMember(user_id=req.user_id, project_id=req.target_id, role="member", status="joined")
            db.add(new_mem)
    elif action == "deny":
        req.status = "denied"
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

    db.commit()
    return {"status": req.status}


@app.get("/rooms/{room_id}/members", response_model=list[schemas.RoomMemberResponse])
def get_room_members(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    room = db.query(models.Room).filter(models.Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    require_project_membership(db, room.project_id, current_user.id)

    members = db.query(models.RoomMember).filter(
        models.RoomMember.room_id == room_id,
        models.RoomMember.status == "joined"
    ).all()

    if room.is_private:
        is_member = any(m.user_id == current_user.id for m in members)
        if not is_member:
            raise HTTPException(status_code=403, detail="Not a member of this private room")
            
    # Map nickname to the response
    for m in members:
        m.nickname = m.user.nickname if m.user else None

    return members


@app.get("/projects/{project_id}/members", response_model=list[schemas.ProjectMemberResponse])
def get_project_members(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    members = db.query(models.ProjectMember).filter(
        models.ProjectMember.project_id == project_id,
        models.ProjectMember.status == "joined"
    ).all()
    
    # Ensure requester has access
    is_member = any(m.user_id == current_user.id for m in members)
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a member of this project")
        
    for m in members:
        m.username = m.user.username if m.user else "Unknown"
        m.nickname = m.user.nickname if m.user else None
        m.gender = m.user.gender if m.user else "other"

    return members


@app.get("/rooms/{room_id}/online")
def get_room_online_users(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    require_room_access(db, room_id, current_user.id)
    # Returns list of usernames currently online in this room
    return {"online": manager.get_online_users(room_id)}


# -------------------- WEBSOCKET (with JWT auth) --------------------

async def get_ws_user(token: str, db: Session) -> models.User:
    """Validate JWT token from WebSocket query param."""
    credentials_exception = WebSocketDisconnect(code=4001)
    try:
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise credentials_exception
    return user


@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: int, token: str = ""):
    # Authenticate before accepting the connection
    if not token:
        await websocket.close(code=4001)
        return

    db = SessionLocal()
    try:
        current_user = await get_ws_user(token, db)
        try:
            require_room_access(db, room_id, current_user.id)
        except HTTPException:
            raise WebSocketDisconnect(code=4003)
    except WebSocketDisconnect as exc:
        await websocket.close(code=exc.code)
        return
    finally:
        db.close()

    await manager.connect(room_id, websocket, current_user.username)
    # Broadcast join presence event
    await manager.broadcast(room_id, {
        "type": "presence",
        "online": manager.get_online_users(room_id)
    })

    try:
        while True:
            data = await websocket.receive_json()

            # Handle typing events — just broadcast, don't save
            if data.get("type") == "typing":
                await manager.broadcast(room_id, {
                    "type": "typing",
                    "username": current_user.username
                })
                continue

            db = SessionLocal()
            try:
                msg_type = data.get("type")
                content = data.get("content")
                if msg_type not in {"text", "code"} or not isinstance(content, str):
                    continue
                language = (data.get("language") or "python") if msg_type == "code" else None
                if msg_type == "code" and language not in ALLOWED_CODE_LANGUAGES:
                    continue

                raw_attachments = data.get("attachments") or []
                attachments = [a for a in raw_attachments if isinstance(a, dict)]

                db_message = models.Message(
                    room_id=room_id,
                    sender=current_user.username,
                    type=msg_type,
                    language=language,
                    content=content,
                    reply_to_id=data.get("reply_to_id")
                )
                db.add(db_message)
                db.commit()
                db.refresh(db_message)

                persist_message_attachments(db, db_message.id, attachments)
                db.commit()
                db.refresh(db_message)

                msg_response_dict = jsonable_encoder(schemas.MessageResponse.from_orm(db_message))
                if db_message.reply_to:
                    msg_response_dict["reply_to"] = jsonable_encoder(schemas.MessageResponse.from_orm(db_message.reply_to))
                    msg_response_dict["reply_to"].pop("reply_to", None)

                # Always broadcast the message first
                base_payload = {
                    "message": msg_response_dict,
                    "execution": None
                }

                await manager.broadcast(room_id, base_payload)

                # Code execution (non-blocking via asyncio.to_thread)
                if msg_type == "code" and language:

                    # 1. Send running state
                    running_payload = {
                        "message": base_payload["message"],
                        "execution": {
                            "status": "running"
                        }
                    }
                    await manager.broadcast(room_id, running_payload)

                    # 2. Execute code in a thread to avoid blocking the event loop
                    stdin_text = data.get("stdin") or ""
                    execution_result = await asyncio.to_thread(
                        execute_code,
                        content,
                        language,
                        stdin_text,
                    )

                    exec_entry = CodeExecution(
                        message_id=db_message.id,
                        stdout=execution_result["stdout"],
                        stderr=execution_result["stderr"],
                        status=execution_result["status"],
                        runtime=execution_result.get("runtime")
                    )

                    db.add(exec_entry)
                    db.commit()
                    db.refresh(exec_entry)

                    # 3. Send final state
                    final_payload = {
                        "message": base_payload["message"],
                        "execution": {
                            "id": exec_entry.id,
                            "stdout": exec_entry.stdout,
                            "stderr": exec_entry.stderr,
                            "status": exec_entry.status,
                            "runtime": exec_entry.runtime
                        }
                    }

                    await manager.broadcast(room_id, final_payload)

            except Exception as exc:
                logging.exception("Error processing WebSocket message in room %s: %s", room_id, exc)
                # Continue the loop — don't kill the connection on a single bad message
            finally:
                db.close()

    except WebSocketDisconnect:
        manager.disconnect(room_id, websocket, current_user.username)
        # Broadcast leave presence event
        await manager.broadcast(room_id, {
            "type": "presence",
            "online": manager.get_online_users(room_id)
        })
