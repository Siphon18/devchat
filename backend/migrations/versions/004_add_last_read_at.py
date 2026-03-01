"""add last_read_at to room_members

Revision ID: 004
Revises: 003
Create Date: 2026-02-26
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [c["name"] for c in inspector.get_columns("room_members")]
    
    if "last_read_at" not in columns:
        op.add_column("room_members", sa.Column("last_read_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("room_members", "last_read_at")
