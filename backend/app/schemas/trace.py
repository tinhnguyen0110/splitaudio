import uuid
from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, ConfigDict


# ── Request Log schemas ──────────────────────────────────────────────────────

class RequestLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    request_id: str
    user_id: Optional[uuid.UUID] = None
    method: str
    path: str
    query_params: Optional[str] = None
    status_code: int
    duration_ms: int
    client_ip: str
    user_agent: Optional[str] = None
    error_detail: Optional[str] = None
    task_id: Optional[uuid.UUID] = None
    created_at: datetime


class RequestLogListResponse(BaseModel):
    items: List[RequestLogResponse]
    total: int
    page: int
    pages: int
    has_next: bool


# ── Task Process Log schemas ─────────────────────────────────────────────────

class TaskProcessStepResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    task_id: uuid.UUID
    step_name: str
    step_order: int
    status: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    duration_ms: Optional[int] = None
    detail: Optional[str] = None
    source: str


class TaskTraceResponse(BaseModel):
    task_id: uuid.UUID
    original_filename: Optional[str] = None
    model_used: Optional[str] = None
    task_status: str
    created_at: datetime
    steps: List[TaskProcessStepResponse]
    total_duration_ms: Optional[int] = None


class TaskTraceListItem(BaseModel):
    task_id: uuid.UUID
    original_filename: Optional[str] = None
    model_used: Optional[str] = None
    task_status: str
    created_at: datetime
    steps_count: int
    total_duration_ms: Optional[int] = None


class TaskTraceListResponse(BaseModel):
    items: List[TaskTraceListItem]
    total: int
    page: int
    pages: int
    has_next: bool


# ── Worker Log schemas ──────────────────────────────────────────────────────

class WorkerLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    task_id: uuid.UUID
    level: str
    message: str
    timestamp: datetime
