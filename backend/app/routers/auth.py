from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Cookie, Request, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.user import User
from models.credit_transaction import CreditTransaction
from schemas.user import (
    UserRegister,
    UserLogin,
    TokenResponse,
    MessageResponse,
    ChangePassword,
    RefreshRequest,
)
from services.auth_service import (
    verify_password,
    hash_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    is_token_blacklisted,
    blacklist_token,
)
from utils.dependencies import get_db, get_current_user

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    body: UserRegister,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    display_name = body.display_name or body.email.split("@")[0]
    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        display_name=display_name,
        credits=10,
    )
    db.add(user)
    await db.flush()

    tx = CreditTransaction(
        user_id=user.id,
        amount=10,
        type="initial",
        description="Welcome credits",
    )
    db.add(tx)

    user_id = str(user.id)
    return TokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    body: UserLogin,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

    user_id = str(user.id)
    return TokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    db: Annotated[AsyncSession, Depends(get_db)],
    body: Optional[RefreshRequest] = None,
    refresh_token_cookie: Optional[str] = Cookie(default=None, alias="refresh_token"),
):
    token = (body.refresh_token if body else None) or refresh_token_cookie
    if not token:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="refresh_token required in body or cookie",
        )

    try:
        payload = decode_token(token)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not a refresh token")

    jti = payload.get("jti")
    if await is_token_blacklisted(jti, db):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or disabled")

    return TokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
    )


@router.post("/logout", response_model=MessageResponse)
async def logout(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.removeprefix("Bearer ").strip()
    try:
        payload = decode_token(token)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    jti = payload["jti"]
    exp_ts = payload["exp"]
    expires_at = datetime.fromtimestamp(exp_ts, tz=timezone.utc)
    await blacklist_token(jti, expires_at, db)
    return MessageResponse(message="Logged out successfully")


@router.put("/change-password", response_model=MessageResponse)
async def change_password(
    body: ChangePassword,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    if not verify_password(body.old_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Old password is incorrect")

    current_user.password_hash = hash_password(body.new_password)
    db.add(current_user)
    return MessageResponse(message="Password changed successfully")
