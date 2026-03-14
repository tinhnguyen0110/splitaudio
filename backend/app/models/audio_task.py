import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Integer, BigInteger, Float, Text, ForeignKey, Index
from sqlalchemy.orm import mapped_column, Mapped
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import text

from database import Base


class AudioTask(Base):
    __tablename__ = "audio_tasks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending",
        server_default=text("'pending'"),
    )
    model_used: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    credit_consumed: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
    )

    # File paths (MinIO object keys)
    input_file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    output_vocals_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    output_accompaniment_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    output_drums_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    output_bass_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    output_other_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Metadata
    duration: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    file_size: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    original_filename: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    error_log: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        nullable=False,
        server_default=text("now()"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False,
        server_default=text("now()"),
        onupdate=datetime.utcnow,
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    __table_args__ = (
        Index("ix_audio_tasks_user_id", "user_id"),
        Index("ix_audio_tasks_status", "status"),
        Index("ix_audio_tasks_created_at", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<AudioTask id={self.id} status={self.status}>"
