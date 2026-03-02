"""add oauth fields to users

Revision ID: 005_oauth
Revises: 004_add_last_read_at
Create Date: 2026-03-03
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "005_oauth"
down_revision = "c607dda928fb"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add columns only if they don't exist (safe for re-runs)
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c["name"] for c in inspector.get_columns("users")]

    if "oauth_provider" not in columns:
        op.add_column("users", sa.Column("oauth_provider", sa.String(20), nullable=True))
    if "oauth_id" not in columns:
        op.add_column("users", sa.Column("oauth_id", sa.String(255), nullable=True))
    if "avatar_url" not in columns:
        op.add_column("users", sa.Column("avatar_url", sa.String(500), nullable=True))

    # Make hashed_password nullable (OAuth users don't have one)
    op.alter_column("users", "hashed_password", existing_type=sa.String(255), nullable=True)


def downgrade() -> None:
    op.alter_column("users", "hashed_password", existing_type=sa.String(255), nullable=False)
    op.drop_column("users", "avatar_url")
    op.drop_column("users", "oauth_id")
    op.drop_column("users", "oauth_provider")
