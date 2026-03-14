"""
Seed the database with initial data for development/testing.
Run after init_db.py.
"""
import asyncio
import sys
import os
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))

from sqlalchemy import select
from database import AsyncSessionLocal
from models import User
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def seed_data() -> None:
    async with AsyncSessionLocal() as session:
        # Check if admin already exists
        result = await session.execute(
            select(User).where(User.email == "admin@example.com")
        )
        if result.scalar_one_or_none():
            print("Seed data already exists, skipping.")
            return

        admin = User(
            id=uuid.uuid4(),
            email="admin@example.com",
            password_hash=pwd_context.hash("admin1234"),
            display_name="Admin",
            credits=1000,
            role="admin",
            is_active=True,
            storage_used_bytes=0,
        )
        demo_user = User(
            id=uuid.uuid4(),
            email="demo@example.com",
            password_hash=pwd_context.hash("demo1234"),
            display_name="Demo User",
            credits=10,
            role="user",
            is_active=True,
            storage_used_bytes=0,
        )

        session.add_all([admin, demo_user])
        await session.commit()
        print(f"Seeded admin user: admin@example.com (password: admin1234)")
        print(f"Seeded demo user:  demo@example.com  (password: demo1234)")


if __name__ == "__main__":
    asyncio.run(seed_data())
