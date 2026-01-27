print("MAIN.PY LOADED")
import os
from fastapi import FastAPI, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from app.database import Base, engine, SessionLocal
from app import models, schemas
from app.executor import execute_python
from app.websocket import manager
from fastapi.middleware.cors import CORSMiddleware
from app.models import CodeExecution



app = FastAPI()

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


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/")
def root():
    return {"status": "DevChat backend running"}


# -------- PROJECTS --------

@app.post("/projects")
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db)):
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
def list_projects(db: Session = Depends(get_db)):
    return db.query(models.Project).all()


# -------- ROOMS --------

@app.post("/rooms")
def create_room(room: schemas.RoomCreate, db: Session = Depends(get_db)):
    db_room = models.Room(
        name=room.name,
        project_id=room.project_id
    )
    db.add(db_room)
    db.commit()
    db.refresh(db_room)
    return db_room


@app.get("/rooms/{project_id}")
def list_rooms(project_id: int, db: Session = Depends(get_db)):
    return db.query(models.Room).filter(models.Room.project_id == project_id).all()

@app.delete("/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    db.query(models.Project).filter(models.Project.id == project_id).delete()
    db.commit()
    return {"status": "deleted", "id": project_id}

@app.delete("/rooms/{room_id}")
def delete_room(room_id: int, db: Session = Depends(get_db)):
    db.query(models.Room).filter(models.Room.id == room_id).delete()
    db.commit()
    return {"status": "deleted", "id": room_id}

# -------- MESSAGES --------

@app.post("/messages")
def create_message(message: schemas.MessageCreate, db: Session = Depends(get_db)):
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
def get_messages(room_id: int, db: Session = Depends(get_db)):
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












