from sqlalchemy import (
    Column, Integer, String, Text, ForeignKey, DateTime,
    Boolean, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    username        = Column(String(50),  unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    gender          = Column(String(20),  default="neutral")
    nickname        = Column(String(60),  nullable=True)   # auto-generated cool name
    created_at      = Column(DateTime(timezone=True), default=utcnow)

    room_memberships = relationship(
        "RoomMember", back_populates="user", cascade="all, delete-orphan"
    )
    project_memberships = relationship(
        "ProjectMember", back_populates="user", cascade="all, delete-orphan"
    )


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    is_public = Column(Boolean, default=False)

    owner = relationship("User")
    rooms = relationship("Room", back_populates="project", cascade="all, delete-orphan")
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")


class Room(Base):
    __tablename__ = "rooms"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String(100), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"))
    creator_id = Column(Integer, ForeignKey("users.id",    ondelete="SET NULL"), nullable=True)
    is_private = Column(Boolean, default=False)

    project  = relationship("Project", back_populates="rooms")
    messages = relationship("Message",    back_populates="room", cascade="all, delete-orphan")
    members  = relationship("RoomMember", back_populates="room", cascade="all, delete-orphan")
    creator  = relationship("User")

    __table_args__ = (
        Index("ix_rooms_project_id", "project_id"),
    )


class RoomMember(Base):
    __tablename__ = "room_members"
    __table_args__ = (
        UniqueConstraint("user_id", "room_id", name="_user_room_uc"),
        Index("ix_room_members_room_id", "room_id"),
    )

    id        = Column(Integer, primary_key=True, index=True)
    user_id   = Column(Integer, ForeignKey("users.id",  ondelete="CASCADE"))
    room_id   = Column(Integer, ForeignKey("rooms.id",  ondelete="CASCADE"))
    role      = Column(String(20), default="member")
    status    = Column(String(20), default="joined")
    joined_at = Column(DateTime(timezone=True), default=utcnow)
    last_read_at = Column(DateTime(timezone=True), default=utcnow)
    cleared_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="room_memberships")
    room = relationship("Room", back_populates="members")

    @property
    def username(self):
        return self.user.username if self.user else None


class Message(Base):
    __tablename__ = "messages"

    id       = Column(Integer, primary_key=True, index=True)
    room_id  = Column(Integer, ForeignKey("rooms.id", ondelete="CASCADE"))
    sender   = Column(String(50), nullable=False)
    type     = Column(String(10), nullable=False)
    language = Column(String(20), nullable=True)
    content  = Column(Text,       nullable=False)
    timestamp = Column(DateTime(timezone=True), default=utcnow)
    is_edited = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    reply_to_id = Column(Integer, ForeignKey("messages.id", ondelete="SET NULL"), nullable=True)

    room = relationship("Room", back_populates="messages")
    reply_to = relationship("Message", remote_side=[id])
    attachments = relationship("MessageAttachment", back_populates="message", cascade="all, delete-orphan")

    __table_args__ = (
        # Most common query pattern: all messages for a room, ordered by time
        Index("ix_messages_room_timestamp", "room_id", "timestamp"),
    )


class CodeExecution(Base):
    __tablename__ = "code_executions"

    id         = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, unique=True)
    stdout     = Column(Text, nullable=True)
    stderr     = Column(Text, nullable=True)
    status     = Column(String(20), nullable=False)
    runtime    = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    message = relationship("Message")


class MessageAttachment(Base):
    __tablename__ = "message_attachments"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, index=True)
    file_name = Column(String(255), nullable=False)
    content_type = Column(String(120), nullable=False)
    file_size = Column(Integer, nullable=False)
    url = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    message = relationship("Message", back_populates="attachments")


class ProjectMember(Base):
    __tablename__ = "project_members"
    __table_args__ = (
        UniqueConstraint("user_id", "project_id", name="_user_project_uc"),
        Index("ix_project_members_project_id", "project_id"),
    )

    id        = Column(Integer, primary_key=True, index=True)
    user_id   = Column(Integer, ForeignKey("users.id",  ondelete="CASCADE"))
    project_id = Column(Integer, ForeignKey("projects.id",  ondelete="CASCADE"))
    role      = Column(String(20), default="member") # "admin" or "member"
    status    = Column(String(20), default="joined")
    joined_at = Column(DateTime(timezone=True), default=utcnow)

    user = relationship("User", back_populates="project_memberships")
    project = relationship("Project", back_populates="members")


class Invite(Base):
    __tablename__ = "invites"

    id         = Column(Integer, primary_key=True, index=True)
    inviter_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    invitee_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    target_id  = Column(Integer, nullable=False)
    target_type = Column(String(20), nullable=False) # "room" or "project"
    status     = Column(String(20), default="pending") # "pending", "accepted", "declined"
    created_at = Column(DateTime(timezone=True), default=utcnow)

    inviter = relationship("User", foreign_keys=[inviter_id])
    invitee = relationship("User", foreign_keys=[invitee_id])


class AccessRequest(Base):
    __tablename__ = "access_requests"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    target_id  = Column(Integer, nullable=False)
    target_type = Column(String(20), nullable=False) # "room" or "project"
    status     = Column(String(20), default="pending") # "pending", "approved", "denied"
    created_at = Column(DateTime(timezone=True), default=utcnow)

    user = relationship("User")
