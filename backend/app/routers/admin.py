import uuid
import logging
import math
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from models.audio_task import AudioTask
from models.credit_transaction import CreditTransaction
from models.request_log import RequestLog
from models.task_process_log import TaskProcessLog
from models.user import User
from schemas.trace import (
    RequestLogResponse,
    RequestLogListResponse,
    TaskProcessStepResponse,
    TaskTraceResponse,
    TaskTraceListItem,
    TaskTraceListResponse,
    WorkerLogResponse,
)
from services.credit_service import CreditService
from utils.dependencies import get_current_admin, get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


class UserAdminResponse(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str
    credits: int
    role: str
    is_active: bool
    storage_used_bytes: int
    created_at: datetime
    total_files: int = 0

    class Config:
        from_attributes = True


class AdminStatsResponse(BaseModel):
    total_users: int
    total_tasks: int
    tasks_by_status: dict
    total_credits_consumed: int


class AdjustCreditsRequest(BaseModel):
    amount: int
    description: Optional[str] = None


@router.get("/users")
async def list_users(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).order_by(User.created_at.desc()).offset((page - 1) * limit).limit(limit)
    )
    users = result.scalars().all()

    # Count total tasks (files) per user
    user_ids = [u.id for u in users]
    if user_ids:
        counts_result = await db.execute(
            select(AudioTask.user_id, func.count()).where(AudioTask.user_id.in_(user_ids)).group_by(AudioTask.user_id)
        )
        task_counts = dict(counts_result.all())
    else:
        task_counts = {}

    return [
        UserAdminResponse(
            id=u.id,
            email=u.email,
            display_name=u.display_name,
            credits=u.credits,
            role=u.role,
            is_active=u.is_active,
            storage_used_bytes=u.storage_used_bytes,
            created_at=u.created_at,
            total_files=task_counts.get(u.id, 0),
        )
        for u in users
    ]


@router.get("/stats", response_model=AdminStatsResponse)
async def get_stats(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    total_users_result = await db.execute(select(func.count()).select_from(User))
    total_users = total_users_result.scalar_one()

    total_tasks_result = await db.execute(select(func.count()).select_from(AudioTask))
    total_tasks = total_tasks_result.scalar_one()

    status_result = await db.execute(
        select(AudioTask.status, func.count()).group_by(AudioTask.status)
    )
    tasks_by_status = {row[0]: row[1] for row in status_result.all()}

    consumed_result = await db.execute(
        select(func.sum(CreditTransaction.amount)).where(
            CreditTransaction.type == "deduction"
        )
    )
    total_credits_consumed = abs(consumed_result.scalar_one() or 0)

    return AdminStatsResponse(
        total_users=total_users,
        total_tasks=total_tasks,
        tasks_by_status=tasks_by_status,
        total_credits_consumed=total_credits_consumed,
    )


@router.put("/users/{user_id}/credits")
async def adjust_user_credits(
    user_id: uuid.UUID,
    body: AdjustCreditsRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    if body.amount == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Amount must be non-zero.",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if body.amount > 0:
        new_balance = await CreditService.add_credits(
            db,
            user_id=user_id,
            amount=body.amount,
            tx_type="admin_adjustment",
            description=body.description or f"Admin credit adjustment by {admin.email}",
        )
    else:
        deducted = await CreditService.deduct(
            db,
            user_id=user_id,
            amount=abs(body.amount),
            description=body.description or f"Admin credit adjustment by {admin.email}",
        )
        if not deducted:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Insufficient credits for deduction.",
            )
        new_balance = await CreditService.check_balance(db, user_id)

    return {"user_id": str(user_id), "new_balance": new_balance}


# ── Trace Stats ──────────────────────────────────────────────────────────────

class TraceStatsResponse(BaseModel):
    total_requests_24h: int
    error_count_24h: int
    error_rate_24h: float
    avg_latency_ms: float
    p99_latency_ms: float
    active_tasks: int
    processing_tasks: int


@router.get("/trace-stats", response_model=TraceStatsResponse)
async def get_trace_stats(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    since = datetime.now(timezone.utc) - timedelta(hours=24)

    total_result = await db.execute(
        select(func.count()).select_from(RequestLog).where(RequestLog.created_at >= since)
    )
    total_24h = total_result.scalar_one()

    error_result = await db.execute(
        select(func.count()).select_from(RequestLog).where(
            and_(RequestLog.created_at >= since, RequestLog.status_code >= 400)
        )
    )
    error_count = error_result.scalar_one()

    latency_result = await db.execute(
        select(func.avg(RequestLog.duration_ms)).where(RequestLog.created_at >= since)
    )
    avg_latency = latency_result.scalar_one() or 0

    # p99 approximation via ordering
    p99_offset = max(0, int(total_24h * 0.99) - 1)
    p99_result = await db.execute(
        select(RequestLog.duration_ms)
        .where(RequestLog.created_at >= since)
        .order_by(RequestLog.duration_ms.asc())
        .offset(p99_offset)
        .limit(1)
    )
    p99_val = p99_result.scalar_one_or_none() or 0

    active_result = await db.execute(
        select(func.count()).select_from(AudioTask).where(
            AudioTask.status.in_(["pending", "processing"])
        )
    )
    active_tasks = active_result.scalar_one()

    processing_result = await db.execute(
        select(func.count()).select_from(AudioTask).where(AudioTask.status == "processing")
    )
    processing_tasks = processing_result.scalar_one()

    return TraceStatsResponse(
        total_requests_24h=total_24h,
        error_count_24h=error_count,
        error_rate_24h=round((error_count / total_24h * 100) if total_24h > 0 else 0, 1),
        avg_latency_ms=round(avg_latency, 1),
        p99_latency_ms=round(p99_val, 1),
        active_tasks=active_tasks,
        processing_tasks=processing_tasks,
    )


# ── Request Logs ─────────────────────────────────────────────────────────────

@router.get("/request-logs", response_model=RequestLogListResponse)
async def list_request_logs(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    method: Optional[str] = Query(default=None),
    path_contains: Optional[str] = Query(default=None),
    status_code_min: Optional[int] = Query(default=None),
    status_code_max: Optional[int] = Query(default=None),
    date_from: Optional[datetime] = Query(default=None),
    date_to: Optional[datetime] = Query(default=None),
    task_id: Optional[str] = Query(default=None),
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    filters = []
    if method:
        filters.append(RequestLog.method == method.upper())
    if path_contains:
        filters.append(RequestLog.path.ilike(f"%{path_contains}%"))
    if status_code_min is not None:
        filters.append(RequestLog.status_code >= status_code_min)
    if status_code_max is not None:
        filters.append(RequestLog.status_code <= status_code_max)
    if date_from:
        filters.append(RequestLog.created_at >= date_from)
    if date_to:
        filters.append(RequestLog.created_at <= date_to)
    if task_id:
        filters.append(RequestLog.task_id == task_id)

    where = and_(*filters) if filters else True

    count_result = await db.execute(
        select(func.count()).select_from(RequestLog).where(where)
    )
    total = count_result.scalar_one()
    pages = max(1, math.ceil(total / limit))

    result = await db.execute(
        select(RequestLog)
        .where(where)
        .order_by(RequestLog.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    items = result.scalars().all()

    return RequestLogListResponse(
        items=items,
        total=total,
        page=page,
        pages=pages,
        has_next=page < pages,
    )


@router.get("/request-logs/{request_id}", response_model=RequestLogResponse)
async def get_request_log(
    request_id: str,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RequestLog).where(RequestLog.request_id == request_id)
    )
    log = result.scalar_one_or_none()
    if log is None:
        raise HTTPException(status_code=404, detail="Request log not found")
    return log


# ── Task Traces ──────────────────────────────────────────────────────────────

@router.get("/task-traces", response_model=TaskTraceListResponse)
async def list_task_traces(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    task_status: Optional[str] = Query(default=None, alias="status"),
    date_from: Optional[datetime] = Query(default=None),
    date_to: Optional[datetime] = Query(default=None),
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    filters = []
    if task_status:
        filters.append(AudioTask.status == task_status)
    if date_from:
        filters.append(AudioTask.created_at >= date_from)
    if date_to:
        filters.append(AudioTask.created_at <= date_to)

    where = and_(*filters) if filters else True

    count_result = await db.execute(
        select(func.count()).select_from(AudioTask).where(where)
    )
    total = count_result.scalar_one()
    pages = max(1, math.ceil(total / limit))

    tasks_result = await db.execute(
        select(AudioTask)
        .where(where)
        .order_by(AudioTask.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    tasks = tasks_result.scalars().all()

    items = []
    for task in tasks:
        steps_result = await db.execute(
            select(func.count(), func.sum(TaskProcessLog.duration_ms))
            .where(TaskProcessLog.task_id == task.id)
        )
        row = steps_result.one()
        steps_count = row[0] or 0
        total_duration = row[1]

        items.append(TaskTraceListItem(
            task_id=task.id,
            original_filename=task.original_filename,
            model_used=task.model_used,
            task_status=task.status,
            created_at=task.created_at,
            steps_count=steps_count,
            total_duration_ms=total_duration,
        ))

    return TaskTraceListResponse(
        items=items,
        total=total,
        page=page,
        pages=pages,
        has_next=page < pages,
    )


@router.get("/task-traces/{task_id}", response_model=TaskTraceResponse)
async def get_task_trace(
    task_id: uuid.UUID,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    task_result = await db.execute(
        select(AudioTask).where(AudioTask.id == task_id)
    )
    task = task_result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    steps_result = await db.execute(
        select(TaskProcessLog)
        .where(TaskProcessLog.task_id == task_id)
        .order_by(TaskProcessLog.step_order, TaskProcessLog.started_at)
    )
    steps = steps_result.scalars().all()

    total_duration = sum(s.duration_ms for s in steps if s.duration_ms) or None

    return TaskTraceResponse(
        task_id=task.id,
        original_filename=task.original_filename,
        model_used=task.model_used,
        task_status=task.status,
        created_at=task.created_at,
        steps=steps,
        total_duration_ms=total_duration,
    )


# ── Worker Logs ──────────────────────────────────────────────────────────────

@router.get("/task-traces/{task_id}/logs", response_model=list[WorkerLogResponse])
async def get_worker_logs(
    task_id: uuid.UUID,
    level: Optional[str] = Query(default=None),
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    from models.worker_log import WorkerLog

    filters = [WorkerLog.task_id == task_id]
    if level:
        filters.append(WorkerLog.level == level.upper())

    result = await db.execute(
        select(WorkerLog)
        .where(and_(*filters))
        .order_by(WorkerLog.timestamp.asc())
        .limit(500)
    )
    return result.scalars().all()
