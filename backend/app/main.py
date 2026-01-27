print("MAIN.PY LOADED")
import os
from fastapi import FastAPI, Depends, WebSocket, WebSocketDisconnect, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import Base, engine, SessionLocal
from app import models, schemas, auth
from app.executor import execute_python
from app.websocket import manager
from fastapi.middleware.cors import CORSMiddleware
from app.models import CodeExecution
from jose import JWTError, jwt


app = FastAPI()

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


# -------- AUTH ROUTES --------

@app.post("/register", response_model=schemas.UserResponse)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(username=user.username, hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
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

# -----------------------------

# Allow frontend URLs from environment variable for deployment
frontend_url = os.getenv("FRONTEND_URL", "").strip()
allowed_origins = [
    "http://localhost:5173",
    "http://localhost",
    "http://localhost:80",
]
if frontend_url:
    allowed_origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)




@app.get("/")
def root():
    return {"status": "DevChat backend running"}


# -------- PROJECTS --------

@app.post("/projects")
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_project = models.Project(
        name=project.name,
        description=project.description,
        github_url=project.github_url
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project


@app.get("/projects")
def list_projects(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Project).all()


# -------- ROOMS --------

@app.post("/rooms")
def create_room(room: schemas.RoomCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_room = models.Room(
        name=room.name,
        project_id=room.project_id
    )
    db.add(db_room)
    db.commit()
    db.refresh(db_room)
    return db_room


@app.get("/rooms/{project_id}")
def list_rooms(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Room).filter(models.Room.project_id == project_id).all()

@app.delete("/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # 1. Get all rooms for this project
    rooms = db.query(models.Room).filter(models.Room.project_id == project_id).all()
    room_ids = [room.id for room in rooms]

    # 2. Delete all messages in these rooms
    if room_ids:
        db.query(models.Message).filter(models.Message.room_id.in_(room_ids)).delete(synchronize_session=False)

    # 3. Delete the rooms
    db.query(models.Room).filter(models.Room.project_id == project_id).delete(synchronize_session=False)

    # 4. Delete the project
    db.query(models.Project).filter(models.Project.id == project_id).delete(synchronize_session=False)
    
    db.commit()
    return {"status": "deleted", "id": project_id}

@app.delete("/rooms/{room_id}")
def delete_room(room_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db.query(models.Room).filter(models.Room.id == room_id).delete()
    db.commit()
    return {"status": "deleted", "id": room_id}

# -------- MESSAGES --------

@app.post("/messages")
def create_message(message: schemas.MessageCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_message = models.Message(
        room_id=message.room_id,
        sender=message.sender,
        type=message.type,
        language=message.language,
        content=message.content
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)

    execution_result = None

    if message.type == "code" and message.language == "python":
        execution_result = execute_python(message.content)  

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
        "message": db_message,
        "execution": execution_result
    }

@app.get("/messages/{room_id}")
def get_messages(room_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    messages = db.query(models.Message)\
        .filter(models.Message.room_id == room_id)\
        .order_by(models.Message.timestamp.asc())\
        .all()

    response = []
    for m in messages:
        execution = db.query(CodeExecution)\
            .filter(CodeExecution.message_id == m.id)\
            .first()

        response.append({
            "message": m,
            "execution": execution
        })

    return response


@app.delete("/messages/room/{room_id}")
def clear_room_messages(room_id: int, db: Session = Depends(get_db)):
    db.query(models.Message).filter(models.Message.room_id == room_id).delete()
    db.commit()
    return {"status": "cleared", "room_id": room_id}

        
@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: int):
    await manager.connect(room_id, websocket)

    try:
        while True:
            data = await websocket.receive_json()

            db = SessionLocal()
            try:
                db_message = models.Message(
                    room_id=room_id,
                    sender=data["sender"],
                    type=data["type"],
                    language=data.get("language"),
                    content=data["content"]
                )
                db.add(db_message)
                db.commit()
                db.refresh(db_message)

                execution_result = None
                if data["type"] == "code" and data.get("language") == "python":
                    execution_result = execute_python(data["content"])

# First broadcast: RUNNING state
# Always broadcast the message first
                base_payload = {
                    "message": {
                        "id": db_message.id,
                        "room_id": room_id,
                        "sender": db_message.sender,
                        "type": db_message.type,
                        "language": db_message.language,
                        "content": db_message.content,
                        "timestamp": str(db_message.timestamp)
                    },
                    "execution": None
                }

                await manager.broadcast(room_id, base_payload)

                # Second broadcast: EXECUTION state
                if data["type"] == "code" and data.get("language") == "python":

                    # 1. Send running state
                    running_payload = {
                        "message": base_payload["message"],
                        "execution": {
                            "status": "running"
                        }
                    }
                    await manager.broadcast(room_id, running_payload)

                    # 2. Execute code
                    execution_result = execute_python(data["content"])

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

            finally:
                db.close()

    except WebSocketDisconnect:
        manager.disconnect(room_id, websocket)












