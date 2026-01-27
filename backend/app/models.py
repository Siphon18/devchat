from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
from sqlalchemy import Boolean


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)



class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    github_url = Column(String(255), nullable=True)

    rooms = relationship("Room", back_populates="project")


class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"))

    project = relationship("Project", back_populates="rooms")
    messages = relationship("Message", back_populates="room")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"))
    sender = Column(String(50), nullable=False)

    type = Column(String(10), nullable=False)  # "text" or "code"
    language = Column(String(20), nullable=True)
    content = Column(Text, nullable=False)

    timestamp = Column(DateTime, default=datetime.utcnow)

    room = relationship("Room", back_populates="messages")

class CodeExecution(Base):
    __tablename__ = "code_executions"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id"), nullable=False)

    stdout = Column(Text, nullable=True)
    stderr = Column(Text, nullable=True)
    status = Column(String(20), nullable=False)  # success | error | timeout
    runtime = Column(String(50), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    message = relationship("Message")
