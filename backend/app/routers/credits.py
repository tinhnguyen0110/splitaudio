import json
import logging
import os
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.credit_transaction import CreditTransaction
from models.user import User
from schemas.task import (
    CreditBalanceResponse,
    CreditTransactionHistoryResponse,
    CreditTransactionResponse,
    PurchaseRequest,
    RedeemRequest,
)
from services.credit_service import CreditService
from utils.dependencies import get_current_user, get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/credits", tags=["credits"])

# Load promo codes from env variable (JSON format), fallback to empty
# Example: PROMO_CODES='{"WELCOME10":10,"BONUS5":5}'
PROMO_CODES: dict[str, int] = json.loads(os.getenv("PROMO_CODES", "{}"))


@router.get("/balance", response_model=CreditBalanceResponse)
async def get_balance(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    balance = await CreditService.check_balance(db, current_user.id)

    consumed_result = await db.execute(
        select(func.sum(CreditTransaction.amount).filter(
            CreditTransaction.user_id == current_user.id,
            CreditTransaction.type == "deduction",
        ))
    )
    consumed = abs(consumed_result.scalar_one() or 0)

    purchased_result = await db.execute(
        select(func.sum(CreditTransaction.amount).filter(
            CreditTransaction.user_id == current_user.id,
            CreditTransaction.type.in_(["purchase", "redeem"]),
        ))
    )
    purchased = purchased_result.scalar_one() or 0

    return CreditBalanceResponse(
        balance=balance,
        total_consumed=consumed,
        total_purchased=purchased,
    )


@router.get("/transactions", response_model=CreditTransactionHistoryResponse)
async def get_transactions(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    txs, total = await CreditService.get_transactions(db, current_user.id, page, limit)
    pages = max(1, (total + limit - 1) // limit)
    return CreditTransactionHistoryResponse(
        items=[CreditTransactionResponse.model_validate(t) for t in txs],
        total=total,
        page=page,
        pages=pages,
        has_next=page < pages,
    )


@router.post("/purchase", response_model=CreditBalanceResponse)
async def purchase_credits(
    body: PurchaseRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.amount <= 0 or body.amount > 1000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Purchase amount must be between 1 and 1000.",
        )
    new_balance = await CreditService.add_credits(
        db,
        user_id=current_user.id,
        amount=body.amount,
        tx_type="purchase",
        description=f"Purchased {body.amount} credits",
    )
    return CreditBalanceResponse(balance=new_balance, total_consumed=0, total_purchased=body.amount)


@router.post("/redeem", response_model=CreditBalanceResponse)
async def redeem_code(
    body: RedeemRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    code = body.code.strip().upper()
    credits = PROMO_CODES.get(code)
    if credits is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired promo code.",
        )
    new_balance = await CreditService.add_credits(
        db,
        user_id=current_user.id,
        amount=credits,
        tx_type="redeem",
        description=f"Redeemed code '{code}' for {credits} credits",
    )
    return CreditBalanceResponse(balance=new_balance, total_consumed=0, total_purchased=credits)
