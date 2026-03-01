import os
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config, pool
from alembic import context

# ── Make sure "app" package is importable ───────────────────────────────────
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# ── Import models so Alembic can autogenerate migrations ─────────────────────
from app.database import Base  # noqa: E402 — must come after sys.path patch
import app.models  # noqa: F401 — registers all ORM models on Base.metadata

# ── Alembic Config ────────────────────────────────────────────────────────────
config = context.config

# Override sqlalchemy.url from DATABASE_URL environment variable
db_url = os.getenv(
    "DATABASE_URL",
    "postgresql://devchat:devchat@localhost:5432/devchat"
)
config.set_main_option("sqlalchemy.url", db_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations without a live DB connection — emits SQL to stdout."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations against a live DB connection."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
