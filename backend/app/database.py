import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import QueuePool

# Read from environment. Fallback for local dev without Docker.
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://devchat:devchat@localhost:5432/devchat"
)

# PostgreSQL engine with connection pooling tuned for a WebSocket-heavy chat app:
#   pool_size      – persistent connections kept open (one per uvicorn worker)
#   max_overflow   – extra connections allowed under burst load
#   pool_timeout   – seconds to wait for a free connection before raising
#   pool_pre_ping  – test each connection before use (handles DB restarts)
engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
    pool_pre_ping=True,
    echo=False,  # set True to log SQL queries during dev
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()
