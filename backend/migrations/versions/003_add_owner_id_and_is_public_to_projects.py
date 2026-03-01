"""add owner_id and is_public to projects

Revision ID: 003
Revises: 0203c32b8d04
Create Date: 2026-02-26
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "003"
down_revision = "0203c32b8d04"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [c["name"] for c in inspector.get_columns("projects")]
    
    if "owner_id" not in columns:
        op.add_column("projects", sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True))
    if "is_public" not in columns:
        op.add_column("projects", sa.Column("is_public", sa.Boolean(), server_default="false", nullable=True))


def downgrade() -> None:
    op.drop_column("projects", "is_public")
    op.drop_column("projects", "owner_id")
