"""initial tables: users, audio_tasks, credit_transactions, token_blacklist

Revision ID: 0001
Revises:
Create Date: 2026-03-13

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(100), nullable=False),
        sa.Column("credits", sa.Integer(), server_default=sa.text("10"), nullable=False),
        sa.Column("role", sa.String(20), server_default=sa.text("'user'"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("storage_used_bytes", sa.BigInteger(), server_default=sa.text("0"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("credits >= 0", name="ck_users_credits_non_negative"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_role", "users", ["role"])

    op.create_table(
        "audio_tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(20), server_default=sa.text("'pending'"), nullable=False),
        sa.Column("model_used", sa.String(50), nullable=True),
        sa.Column("credit_consumed", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("input_file_path", sa.String(500), nullable=True),
        sa.Column("output_vocals_path", sa.String(500), nullable=True),
        sa.Column("output_accompaniment_path", sa.String(500), nullable=True),
        sa.Column("output_drums_path", sa.String(500), nullable=True),
        sa.Column("output_bass_path", sa.String(500), nullable=True),
        sa.Column("output_other_path", sa.String(500), nullable=True),
        sa.Column("duration", sa.Float(), nullable=True),
        sa.Column("file_size", sa.BigInteger(), nullable=True),
        sa.Column("original_filename", sa.String(255), nullable=True),
        sa.Column("error_log", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_audio_tasks_user_id", "audio_tasks", ["user_id"])
    op.create_index("ix_audio_tasks_status", "audio_tasks", ["status"])
    op.create_index("ix_audio_tasks_created_at", "audio_tasks", ["created_at"])

    op.create_table(
        "credit_transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(30), nullable=False),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("audio_tasks.id", ondelete="SET NULL"), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_credit_transactions_user_id", "credit_transactions", ["user_id"])
    op.create_index("ix_credit_transactions_created_at", "credit_transactions", ["created_at"])

    op.create_table(
        "token_blacklist",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("jti", sa.String(36), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("jti"),
    )
    op.create_index("ix_token_blacklist_jti", "token_blacklist", ["jti"])
    op.create_index("ix_token_blacklist_expires_at", "token_blacklist", ["expires_at"])


def downgrade() -> None:
    op.drop_table("token_blacklist")
    op.drop_table("credit_transactions")
    op.drop_table("audio_tasks")
    op.drop_table("users")
