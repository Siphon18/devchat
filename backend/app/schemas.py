from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

# --- Auth Schemas ---
class UserCreate(BaseModel):
    username: str
    password: str
    gender: Optional[str] = "neutral"

class UserResponse(BaseModel):
    id: int
    username: str
    gender: Optional[str]
    nickname: Optional[str] = None
    created_at: datetime
    oauth_provider: Optional[str] = None
    avatar_url: Optional[str] = None
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
# --------------------


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    is_public: Optional[bool] = False


class ProjectResponse(BaseModel):
    id: int
    name: str
    owner_id: int
    is_public: bool = False

    class Config:
        from_attributes = True


class RoomCreate(BaseModel):
    name: str
    project_id: int
    is_private: Optional[bool] = False


class RoomResponse(BaseModel):
    id: int
    name: str
    project_id: int
    creator_id: Optional[int] = None
    is_private: bool = False

    class Config:
        from_attributes = True


class MessageCreate(BaseModel):
    room_id: int
    sender: str
    type: str  # "text" or "code"
    language: Optional[str] = None
    content: str
    reply_to_id: Optional[int] = None
    attachments: Optional[list["AttachmentUploadResponse"]] = []

class MessageEdit(BaseModel):
    content: str

class MessageResponse(MessageCreate):
    id: int
    is_edited: bool = False
    is_deleted: bool = False
    timestamp: datetime
    
    # Optional nested structure for the replied-to message preview
    reply_to: Optional['MessageResponse'] = None
    attachments: list["MessageAttachmentResponse"] = []

    class Config:
        from_attributes = True

class AttachmentUploadResponse(BaseModel):
    file_name: str
    content_type: str
    file_size: int
    url: str


class MessageAttachmentResponse(AttachmentUploadResponse):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# New Schema for Room Members
class RoomMemberResponse(BaseModel):
    user_id: int
    username: Optional[str] = None  # joined via relationship
    nickname: Optional[str] = None  # mapped in main.py
    role: str
    status: str
    joined_at: datetime

    class Config:
        from_attributes = True

class CodeExecutionResponse(BaseModel):
    id: int
    message_id: int
    stdout: str | None
    stderr: str | None
    status: str
    runtime: str | None

    class Config:
        from_attributes = True


class ProjectMemberResponse(BaseModel):
    user_id: int
    username: Optional[str] = None
    nickname: Optional[str] = None
    role: str
    status: str
    joined_at: datetime

    class Config:
        from_attributes = True

class InviteResponse(BaseModel):
    id: int
    inviter_id: int
    inviter_name: Optional[str] = None
    target_id: int
    target_name: Optional[str] = None
    target_type: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class AccessRequestResponse(BaseModel):
    id: int
    user_id: int
    username: Optional[str] = None
    target_id: int
    target_type: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class UserSearchResponse(BaseModel):
    id: int
    username: str
    nickname: Optional[str] = None
    gender: Optional[str] = None

    class Config:
        from_attributes = True


MessageResponse.update_forward_refs()
