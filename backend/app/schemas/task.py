import uuid
from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, ConfigDict


# ── Separation request ────────────────────────────────────────────────────────

class SeparateRequest(BaseModel):
    model: str = "demucs"


# ── Task responses ────────────────────────────────────────────────────────────

class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: str
    model_used: Optional[str] = None
    credit_consumed: int
    duration_seconds: Optional[float] = None
    original_filename: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None


class DownloadURLs(BaseModel):
    vocals: Optional[str] = None
    instrumental: Optional[str] = None


class TaskDetailResponse(TaskResponse):
    download_urls: Optional[DownloadURLs] = None
    error_log: Optional[str] = None


class TaskHistoryResponse(BaseModel):
    items: List[TaskResponse]
    total: int
    page: int
    pages: int
    has_next: bool


# ── Separation submit response ────────────────────────────────────────────────

class SeparateResponse(BaseModel):
    task_id: uuid.UUID
    status: str
    credit_consumed: int
    credits_remaining: int


# ── Credit schemas ────────────────────────────────────────────────────────────

class CreditBalanceResponse(BaseModel):
    balance: int
    total_consumed: int
    total_purchased: int


class CreditTransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    amount: int
    type: str
    task_id: Optional[uuid.UUID] = None
    description: Optional[str] = None
    created_at: datetime


class CreditTransactionHistoryResponse(BaseModel):
    items: List[CreditTransactionResponse]
    total: int
    page: int
    pages: int
    has_next: bool


class PurchaseRequest(BaseModel):
    amount: int  # number of credits to purchase (mock payment)


class RedeemRequest(BaseModel):
    code: str
