"""add email to users

Revision ID: 6d5c0d7c3e42
Revises: 005_oauth
Create Date: 2026-03-15
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "6d5c0d7c3e42"
down_revision: Union[str, Sequence[str], None] = "005_oauth"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = {c["name"] for c in inspector.get_columns("users")}

    if "email" not in columns:
        op.add_column("users", sa.Column("email", sa.String(length=255), nullable=True))

    indexes = {idx["name"] for idx in inspector.get_indexes("users")}
    if "ix_users_email" not in indexes:
        op.create_index("ix_users_email", "users", ["email"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_email", table_name="users")
    op.drop_column("users", "email")
