"""add message_attachments table

Revision ID: 7f3b9f7f1c2a
Revises: 6d5c0d7c3e42
Create Date: 2026-04-03
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7f3b9f7f1c2a"
down_revision: Union[str, Sequence[str], None] = "6d5c0d7c3e42"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = set(inspector.get_table_names())

    if "message_attachments" not in tables:
        op.create_table(
            "message_attachments",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("message_id", sa.Integer(), nullable=False),
            sa.Column("file_name", sa.String(length=255), nullable=False),
            sa.Column("content_type", sa.String(length=120), nullable=False),
            sa.Column("file_size", sa.Integer(), nullable=False),
            sa.Column("url", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["message_id"], ["messages.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    indexes = {idx["name"] for idx in inspector.get_indexes("message_attachments")} if "message_attachments" in set(sa.inspect(conn).get_table_names()) else set()
    if "ix_message_attachments_message_id" not in indexes:
        op.create_index("ix_message_attachments_message_id", "message_attachments", ["message_id"], unique=False)


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = set(inspector.get_table_names())
    if "message_attachments" in tables:
        indexes = {idx["name"] for idx in inspector.get_indexes("message_attachments")}
        if "ix_message_attachments_message_id" in indexes:
            op.drop_index("ix_message_attachments_message_id", table_name="message_attachments")
        op.drop_table("message_attachments")
