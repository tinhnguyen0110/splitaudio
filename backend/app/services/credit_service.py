import uuid
from typing import Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert

from models.user import User
from models.credit_transaction import CreditTransaction


class CreditService:

    @staticmethod
    async def check_balance(db: AsyncSession, user_id: uuid.UUID) -> int:
        result = await db.execute(select(User.credits).where(User.id == user_id))
        return result.scalar_one_or_none() or 0

    @staticmethod
    def calculate_cost(duration_seconds: float) -> int:
        """
        < 300 s  (5 min)  → 1 credit
        300–600 s (5–10 min) → 2 credits
        > 600 s  (10 min) → raises ValueError
        """
        if duration_seconds > 600:
            raise ValueError(
                f"Audio too long ({duration_seconds:.0f}s). Maximum is 10 minutes."
            )
        return 1 if duration_seconds < 300 else 2

    @staticmethod
    async def deduct(
        db: AsyncSession,
        user_id: uuid.UUID,
        amount: int,
        task_id: Optional[uuid.UUID] = None,
        description: str = "Audio separation",
    ) -> bool:
        """Atomically deduct credits using SELECT ... FOR UPDATE. Returns False if insufficient."""
        from sqlalchemy import text

        result = await db.execute(
            select(User).where(User.id == user_id).with_for_update()
        )
        user = result.scalar_one_or_none()
        if user is None or user.credits < amount:
            return False

        user.credits -= amount

        tx = CreditTransaction(
            user_id=user_id,
            amount=-amount,
            type="deduction",
            task_id=task_id,
            description=description,
        )
        db.add(tx)
        await db.flush()
        return True

    @staticmethod
    async def refund(
        db: AsyncSession,
        user_id: uuid.UUID,
        task_id: uuid.UUID,
    ) -> bool:
        """Refund credits for a given task by reversing the original deduction."""
        # Find the original deduction transaction
        result = await db.execute(
            select(CreditTransaction).where(
                CreditTransaction.user_id == user_id,
                CreditTransaction.task_id == task_id,
                CreditTransaction.type == "deduction",
            )
        )
        original = result.scalar_one_or_none()
        if original is None:
            return False

        refund_amount = abs(original.amount)

        # Lock user row
        user_result = await db.execute(
            select(User).where(User.id == user_id).with_for_update()
        )
        user = user_result.scalar_one_or_none()
        if user is None:
            return False

        user.credits += refund_amount

        tx = CreditTransaction(
            user_id=user_id,
            amount=refund_amount,
            type="refund",
            task_id=task_id,
            description=f"Refund for task {task_id}",
        )
        db.add(tx)
        await db.flush()
        return True

    @staticmethod
    async def add_credits(
        db: AsyncSession,
        user_id: uuid.UUID,
        amount: int,
        tx_type: str = "purchase",
        description: str = "",
    ) -> int:
        """Add credits and log a transaction. Returns new balance."""
        user_result = await db.execute(
            select(User).where(User.id == user_id).with_for_update()
        )
        user = user_result.scalar_one_or_none()
        if user is None:
            raise ValueError("User not found")

        user.credits += amount
        tx = CreditTransaction(
            user_id=user_id,
            amount=amount,
            type=tx_type,
            description=description or f"Credit {tx_type}",
        )
        db.add(tx)
        await db.flush()
        return user.credits

    @staticmethod
    async def get_transactions(
        db: AsyncSession,
        user_id: uuid.UUID,
        page: int = 1,
        limit: int = 20,
    ) -> tuple[list, int]:
        """Return (transactions, total_count)."""
        offset = (page - 1) * limit

        total_result = await db.execute(
            select(func.count()).where(CreditTransaction.user_id == user_id)
        )
        total = total_result.scalar_one()

        result = await db.execute(
            select(CreditTransaction)
            .where(CreditTransaction.user_id == user_id)
            .order_by(CreditTransaction.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return result.scalars().all(), total
