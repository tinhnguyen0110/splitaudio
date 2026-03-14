from datetime import datetime

from sqlalchemy import String, Integer, DateTime, Index
from sqlalchemy.orm import mapped_column, Mapped
from sqlalchemy.sql import text

from database import Base


class TokenBlacklist(Base):
    __tablename__ = "token_blacklist"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    jti: Mapped[str] = mapped_column(String(36), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        Index("ix_token_blacklist_jti", "jti"),
        Index("ix_token_blacklist_expires_at", "expires_at"),
    )

    def __repr__(self) -> str:
        return f"<TokenBlacklist id={self.id} jti={self.jti}>"
