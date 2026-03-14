import uuid
import logging
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from models.audio_task import AudioTask
from models.user import User
from schemas.task import SeparateResponse
from services.audio_service import validate_audio_file, get_duration, get_file_size
from services.credit_service import CreditService
from services.storage_service import StorageService
from services.trace_service import trace_step
from utils.dependencies import get_current_user, get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/separate", tags=["separation"])


@router.post("", response_model=SeparateResponse, status_code=status.HTTP_202_ACCEPTED)
async def separate_audio(
    request: Request,
    file: UploadFile = File(...),
    model: str = Query(default="demucs", description="Model: 'demucs', 'demucs_ft', 'bs_roformer', or 'melband_roformer'"),
    device: str = Query(default="auto", description="Device: 'auto' (default), 'gpu', or 'cpu'"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit an audio file for source separation (11-step flow)."""

    # ── Validate device param ──────────────────────────────────────────────
    if device not in ("auto", "gpu", "cpu"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid device '{device}'. Must be 'auto', 'gpu', or 'cpu'.",
        )

    # ── Step 1: Validate file type ────────────────────────────────────────────
    if not validate_audio_file(file):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Unsupported file type. Allowed: wav, mp3, flac, ogg.",
        )

    # ── Step 2: Read file into memory ─────────────────────────────────────────
    file_data = await file.read()
    file_size = len(file_data)

    # ── Step 3: Check upload size ─────────────────────────────────────────────
    if file_size > settings.max_upload_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum is {settings.MAX_UPLOAD_SIZE_MB} MB.",
        )

    # ── Step 4: Get audio duration ────────────────────────────────────────────
    duration = get_duration(file_data, filename=file.filename or "audio")

    # ── Step 5: Check duration limit ─────────────────────────────────────────
    try:
        cost = CreditService.calculate_cost(duration)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    # ── Step 6: Check credit balance ──────────────────────────────────────────
    balance = await CreditService.check_balance(db, current_user.id)
    if balance < cost:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Insufficient credits. Need {cost}, have {balance}.",
        )

    # ── Step 7: Create task record (pending) ──────────────────────────────────
    task_id = uuid.uuid4()
    suffix = Path(file.filename or "audio.wav").suffix or ".wav"
    input_key = f"uploads/{current_user.id}/{task_id}/original{suffix}"

    task = AudioTask(
        id=task_id,
        user_id=current_user.id,
        status="pending",
        model_used=model,
        credit_consumed=cost,
        duration=duration,
        file_size=file_size,
        original_filename=file.filename,
        input_file_path=input_key,
    )
    db.add(task)
    await db.flush()

    # Log task creation step (after task row exists for FK)
    async with trace_step(db, task_id, "create_task", 7) as log_entry:
        if log_entry:
            log_entry.detail = f"{file.filename}, model={model}, device={device}, cost={cost}"

    # Set task_id on request state for middleware correlation
    request.state.task_id = task_id

    # ── Step 8: Deduct credits (atomic) ───────────────────────────────────────
    async with trace_step(db, task_id, "deduct_credits", 8) as log_entry:
        ok = await CreditService.deduct(
            db,
            user_id=current_user.id,
            amount=cost,
            task_id=task_id,
            description=f"Separation ({model}): {file.filename}",
        )
        if not ok:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Credit deduction failed (concurrent request may have used credits).",
            )
        if log_entry:
            log_entry.detail = f"Deducted {cost} credit(s)"

    # ── Step 9: Upload to MinIO ───────────────────────────────────────────────
    content_type = file.content_type or "application/octet-stream"
    async with trace_step(db, task_id, "upload_minio", 9) as log_entry:
        try:
            StorageService.upload_file(
                settings.MINIO_BUCKET_INPUT, input_key, file_data, content_type
            )
        except Exception as exc:
            logger.exception("MinIO upload failed: %s", exc)
            # Rollback credit deduction
            await CreditService.refund(db, user_id=current_user.id, task_id=task_id)
            task.status = "failed"
            task.error_log = f"Upload failed: {exc}"
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Storage upload failed. Credits have been refunded.",
            )
        if log_entry:
            size_mb = round(file_size / (1024 * 1024), 2)
            log_entry.detail = f"Uploaded {size_mb} MB to {input_key}"

    # ── Step 10: Queue Celery task ────────────────────────────────────────────
    async with trace_step(db, task_id, "queue_celery", 10) as log_entry:
        from celery_client import get_celery_app

        celery_app = get_celery_app()
        celery_app.send_task(
            "tasks.separation_task.separate_audio",
            kwargs={
                "task_id": str(task_id),
                "user_id": str(current_user.id),
                "input_bucket": settings.MINIO_BUCKET_INPUT,
                "input_key": input_key,
                "output_bucket": settings.MINIO_BUCKET_OUTPUT,
                "model": model,
                "device": device,
                "credit_cost": cost,
            },
        )
        if log_entry:
            log_entry.detail = f"Queued separation task, model={model}, device={device}"

    # ── Step 11: Commit and return ────────────────────────────────────────────
    async with trace_step(db, task_id, "commit_response", 11) as log_entry:
        new_balance = await CreditService.check_balance(db, current_user.id)
        if log_entry:
            log_entry.detail = f"Remaining credits: {new_balance}"

    return SeparateResponse(
        task_id=task_id,
        status="pending",
        credit_consumed=cost,
        credits_remaining=new_balance,
    )
