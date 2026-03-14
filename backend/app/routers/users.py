from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from models.user import User
from schemas.user import UserResponse, UserUpdate, MessageResponse
from utils.dependencies import get_db, get_current_user

router = APIRouter()


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
):
    return UserResponse.from_orm_user(current_user)


@router.put("/me", response_model=UserResponse)
async def update_me(
    body: UserUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    if body.display_name is not None:
        current_user.display_name = body.display_name
    if body.email is not None:
        current_user.email = body.email
    db.add(current_user)
    await db.flush()
    return UserResponse.from_orm_user(current_user)


@router.delete("/me", response_model=MessageResponse)
async def delete_me(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    await db.delete(current_user)
    return MessageResponse(message="Account deleted successfully")
