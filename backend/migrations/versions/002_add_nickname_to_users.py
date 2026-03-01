"""add_nickname_to_users

Revision ID: 002
Revises: 001
Create Date: 2026-02-26
"""
from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("nickname", sa.String(60), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "nickname")
