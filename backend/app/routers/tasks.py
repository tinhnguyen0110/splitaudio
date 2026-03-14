import uuid
import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse, Response
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from models.audio_task import AudioTask
from models.user import User
from schemas.task import TaskDetailResponse, TaskHistoryResponse, TaskResponse, DownloadURLs, SeparateResponse
from services.credit_service import CreditService
from services.storage_service import StorageService
from utils.dependencies import get_current_user, get_db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["tasks"])

STEM_PATH_MAP = {
    "vocals": "output_vocals_path",
    "instrumental": "output_accompaniment_path",
    "drums": "output_drums_path",
    "bass": "output_bass_path",
    "other": "output_other_path",
}


async def _get_task_for_user(task_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> AudioTask:
    result = await db.execute(
        select(AudioTask).where(AudioTask.id == task_id, AudioTask.user_id == user_id)
    )
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


def _build_download_urls(task: AudioTask) -> Optional[DownloadURLs]:
    if task.status != "completed":
        return None
    urls = {}
    if task.output_vocals_path:
        try:
            urls["vocals"] = StorageService.generate_presigned_url(
                settings.MINIO_BUCKET_OUTPUT, task.output_vocals_path
            )
        except Exception:
            pass
    if task.output_accompaniment_path:
        try:
            urls["instrumental"] = StorageService.generate_presigned_url(
                settings.MINIO_BUCKET_OUTPUT, task.output_accompaniment_path
            )
        except Exception:
            pass
    return DownloadURLs(**urls) if urls else None


@router.get("/status/{task_id}", response_model=TaskDetailResponse)
async def get_task_status(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await _get_task_for_user(task_id, current_user.id, db)
    return TaskDetailResponse(
        id=task.id,
        status=task.status,
        model_used=task.model_used,
        credit_consumed=task.credit_consumed,
        duration_seconds=task.duration,
        original_filename=task.original_filename,
        created_at=task.created_at,
        updated_at=task.updated_at,
        completed_at=task.completed_at,
        download_urls=_build_download_urls(task),
        error_log=task.error_log if task.status == "failed" else None,
    )


@router.get("/history", response_model=TaskHistoryResponse)
async def get_task_history(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    task_status: Optional[str] = Query(default=None, alias="status"),
    sort_by: str = Query(default="created_at"),
    order: str = Query(default="desc"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    filters = [AudioTask.user_id == current_user.id]
    if task_status:
        filters.append(AudioTask.status == task_status)

    sort_col = getattr(AudioTask, sort_by, AudioTask.created_at)
    sort_expr = sort_col.desc() if order == "desc" else sort_col.asc()

    total_result = await db.execute(
        select(func.count()).select_from(AudioTask).where(*filters)
    )
    total = total_result.scalar_one()

    result = await db.execute(
        select(AudioTask).where(*filters).order_by(sort_expr).offset((page - 1) * limit).limit(limit)
    )
    tasks = result.scalars().all()
    pages = max(1, (total + limit - 1) // limit)

    return TaskHistoryResponse(
        items=[
            TaskResponse(
                id=t.id,
                status=t.status,
                model_used=t.model_used,
                credit_consumed=t.credit_consumed,
                duration_seconds=t.duration,
                original_filename=t.original_filename,
                created_at=t.created_at,
                updated_at=t.updated_at,
                completed_at=t.completed_at,
            )
            for t in tasks
        ],
        total=total,
        page=page,
        pages=pages,
        has_next=page < pages,
    )


@router.delete("/tasks/{task_id}", status_code=status.HTTP_200_OK)
async def cancel_task(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await _get_task_for_user(task_id, current_user.id, db)
    if task.status not in ("pending",):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel task with status '{task.status}'.",
        )
    task.status = "cancelled"
    await CreditService.refund(db, user_id=current_user.id, task_id=task_id)
    return {"message": "Task cancelled and credits refunded"}


@router.post("/tasks/{task_id}/retry", response_model=SeparateResponse)
async def retry_task(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await _get_task_for_user(task_id, current_user.id, db)
    if task.status != "failed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only failed tasks can be retried.",
        )

    cost = task.credit_consumed
    ok = await CreditService.deduct(
        db,
        user_id=current_user.id,
        amount=cost,
        task_id=task_id,
        description=f"Retry separation ({task.model_used})",
    )
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Insufficient credits. Need {cost}.",
        )

    task.status = "pending"
    task.error_log = None
    task.completed_at = None

    from celery_client import get_celery_app

    celery_app = get_celery_app()
    celery_app.send_task(
        "tasks.separation_task.separate_audio",
        kwargs={
            "task_id": str(task_id),
            "user_id": str(current_user.id),
            "input_bucket": settings.MINIO_BUCKET_INPUT,
            "input_key": task.input_file_path,
            "output_bucket": settings.MINIO_BUCKET_OUTPUT,
            "model": task.model_used or "demucs",
            "credit_cost": cost,
        },
    )

    new_balance = await CreditService.check_balance(db, current_user.id)
    return SeparateResponse(
        task_id=task_id,
        status="pending",
        credit_consumed=cost,
        credits_remaining=new_balance,
    )


@router.get("/tasks/{task_id}/download/{stem_type}")
async def download_stem(
    task_id: uuid.UUID,
    stem_type: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await _get_task_for_user(task_id, current_user.id, db)

    # Original audio (input file)
    if stem_type == "original":
        if not task.input_file_path:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Original file not found.")
        file_data = StorageService.download_file(settings.MINIO_BUCKET_INPUT, task.input_file_path)
        ext = task.input_file_path.rsplit(".", 1)[-1] if "." in task.input_file_path else "wav"
        mime = {"mp3": "audio/mpeg", "flac": "audio/flac", "ogg": "audio/ogg"}.get(ext, "audio/wav")
        return Response(
            content=file_data,
            media_type=mime,
            headers={"Content-Disposition": f'inline; filename="original.{ext}"'},
        )

    # Separated stems
    if stem_type not in STEM_PATH_MAP:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid stem type. Choose from: {list(STEM_PATH_MAP.keys())}",
        )
    task = await _get_task_for_user(task_id, current_user.id, db)
    if task.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task is not completed yet.",
        )
    path_attr = STEM_PATH_MAP[stem_type]
    object_key = getattr(task, path_attr, None)
    if not object_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stem '{stem_type}' is not available for this task.",
        )
    url = StorageService.generate_presigned_url(settings.MINIO_BUCKET_OUTPUT, object_key)

    # If client requests inline playback (Accept: audio/*), stream directly to avoid CORS
    # For regular downloads (browser navigation), redirect to presigned URL
    file_data = StorageService.download_file(settings.MINIO_BUCKET_OUTPUT, object_key)
    filename = object_key.rsplit("/", 1)[-1] if "/" in object_key else object_key
    return Response(
        content=file_data,
        media_type="audio/wav",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
        },
    )
