from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, ConfigDict


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    display_name: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    display_name: str
    credits: int
    role: str
    is_active: bool
    storage_used_bytes: int
    created_at: datetime

    @classmethod
    def from_orm_user(cls, user) -> "UserResponse":
        return cls(
            id=str(user.id),
            email=user.email,
            display_name=user.display_name,
            credits=user.credits,
            role=user.role,
            is_active=user.is_active,
            storage_used_bytes=user.storage_used_bytes,
            created_at=user.created_at,
        )


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class ChangePassword(BaseModel):
    old_password: str
    new_password: str


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    email: Optional[EmailStr] = None


class MessageResponse(BaseModel):
    message: str


class RefreshRequest(BaseModel):
    refresh_token: str
