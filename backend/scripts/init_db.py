"""
Initialize database tables using SQLAlchemy metadata.
Run this script directly to create all tables.
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))

from database import engine, Base
import models  # noqa: F401 — registers all ORM models with Base.metadata


async def init_db() -> None:
    print("Creating database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Database tables created successfully.")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(init_db())
