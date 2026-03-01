"""initial_schema

Revision ID: 001
Revises:
Create Date: 2026-02-25
"""
from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── users ─────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id",              sa.Integer(),    primary_key=True),
        sa.Column("username",        sa.String(50),   nullable=False),
        sa.Column("hashed_password", sa.String(255),  nullable=False),
        sa.Column("gender",          sa.String(20),   server_default="neutral"),
        sa.Column("created_at",      sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_users_id",       "users", ["id"])
    op.create_index("ix_users_username", "users", ["username"], unique=True)

    # ── projects ──────────────────────────────────────────────────────────────
    op.create_table(
        "projects",
        sa.Column("id",          sa.Integer(),    primary_key=True),
        sa.Column("name",        sa.String(100),  nullable=False),
        sa.Column("description", sa.Text(),       nullable=True),
        sa.Column("github_url",  sa.String(255),  nullable=True),
    )
    op.create_index("ix_projects_id", "projects", ["id"])

    # ── rooms ─────────────────────────────────────────────────────────────────
    op.create_table(
        "rooms",
        sa.Column("id",         sa.Integer(),  primary_key=True),
        sa.Column("name",       sa.String(100), nullable=False),
        sa.Column("project_id", sa.Integer(),  sa.ForeignKey("projects.id", ondelete="CASCADE")),
        sa.Column("creator_id", sa.Integer(),  sa.ForeignKey("users.id",    ondelete="SET NULL"), nullable=True),
        sa.Column("is_private", sa.Boolean(),  server_default=sa.text("false")),
    )
    op.create_index("ix_rooms_id",         "rooms", ["id"])
    op.create_index("ix_rooms_project_id", "rooms", ["project_id"])

    # ── room_members ──────────────────────────────────────────────────────────
    op.create_table(
        "room_members",
        sa.Column("id",        sa.Integer(),  primary_key=True),
        sa.Column("user_id",   sa.Integer(),  sa.ForeignKey("users.id",  ondelete="CASCADE")),
        sa.Column("room_id",   sa.Integer(),  sa.ForeignKey("rooms.id",  ondelete="CASCADE")),
        sa.Column("role",      sa.String(20), server_default="member"),
        sa.Column("status",    sa.String(20), server_default="joined"),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("user_id", "room_id", name="_user_room_uc"),
    )
    op.create_index("ix_room_members_id",      "room_members", ["id"])
    op.create_index("ix_room_members_room_id", "room_members", ["room_id"])

    # ── messages ──────────────────────────────────────────────────────────────
    op.create_table(
        "messages",
        sa.Column("id",        sa.Integer(),   primary_key=True),
        sa.Column("room_id",   sa.Integer(),   sa.ForeignKey("rooms.id", ondelete="CASCADE")),
        sa.Column("sender",    sa.String(50),  nullable=False),
        sa.Column("type",      sa.String(10),  nullable=False),
        sa.Column("language",  sa.String(20),  nullable=True),
        sa.Column("content",   sa.Text(),      nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_messages_id",             "messages", ["id"])
    op.create_index("ix_messages_room_timestamp", "messages", ["room_id", "timestamp"])

    # ── code_executions ───────────────────────────────────────────────────────
    op.create_table(
        "code_executions",
        sa.Column("id",         sa.Integer(),  primary_key=True),
        sa.Column("message_id", sa.Integer(),  sa.ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("stdout",     sa.Text(),     nullable=True),
        sa.Column("stderr",     sa.Text(),     nullable=True),
        sa.Column("status",     sa.String(20), nullable=False),
        sa.Column("runtime",    sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_code_executions_id", "code_executions", ["id"])


def downgrade() -> None:
    op.drop_table("code_executions")
    op.drop_table("messages")
    op.drop_table("room_members")
    op.drop_table("rooms")
    op.drop_table("projects")
    op.drop_table("users")
