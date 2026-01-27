from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    github_url: Optional[str] = None


class RoomCreate(BaseModel):
    name: str
    project_id: int


class MessageCreate(BaseModel):
    room_id: int
    sender: str
    type: str  # "text" or "code"
    language: Optional[str] = None
    content: str


class MessageResponse(MessageCreate):
    id: int
    timestamp: datetime

    class Config:
        orm_mode = True

class CodeExecutionResponse(BaseModel):
    id: int
    message_id: int
    stdout: str | None
    stderr: str | None
    status: str
    runtime: str | None

    class Config:
        from_attributes = True

