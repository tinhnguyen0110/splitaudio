import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from models.audio_task import AudioTask
from models.user import User
from schemas.task import EnhanceRequest
from services.storage_service import StorageService
from utils.dependencies import get_current_user, get_db
from postprocess.pipeline import run_enhance_pipeline, VALID_STEP_IDS

logger = logging.getLogger(__name__)

router = APIRouter(tags=["enhance"])

STEM_PATH_MAP = {
    "vocals": "output_vocals_path",
    "instrumental": "output_accompaniment_path",
}

OTHER_STEM = {
    "vocals": "instrumental",
    "instrumental": "vocals",
}


async def _get_completed_task(task_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> AudioTask:
    from sqlalchemy import select
    result = await db.execute(
        select(AudioTask).where(AudioTask.id == task_id, AudioTask.user_id == user_id)
    )
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if task.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task must be completed to enhance",
        )
    return task


@router.post("/tasks/{task_id}/enhance")
async def enhance_stem(
    task_id: uuid.UUID,
    body: EnhanceRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Validate request
    if body.stem_type not in STEM_PATH_MAP:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid stem_type. Choose from: {list(STEM_PATH_MAP.keys())}",
        )
    if not body.steps:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one step must be enabled",
        )
    for step in body.steps:
        if step.step_id not in VALID_STEP_IDS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid step_id '{step.step_id}'",
            )

    task = await _get_completed_task(task_id, current_user.id, db)

    # Download the stem to enhance
    path_attr = STEM_PATH_MAP[body.stem_type]
    object_key = getattr(task, path_attr, None)
    if not object_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stem '{body.stem_type}' not available for this task",
        )

    logger.info(f"[Enhance] Downloading {body.stem_type} for task {task_id}")
    audio_bytes = StorageService.download_file(settings.MINIO_BUCKET_OUTPUT, object_key)

    # Download original + other stem if mixture_consistency is enabled
    original_bytes = None
    other_stem_bytes = None
    needs_consistency = any(s.step_id == "mixture_consistency" for s in body.steps)

    if needs_consistency:
        # Download original
        if task.input_file_path:
            try:
                original_bytes = StorageService.download_file(
                    settings.MINIO_BUCKET_INPUT, task.input_file_path
                )
            except Exception:
                logger.warning("Could not download original for mixture consistency")

        # Download other stem
        other_stem_type = OTHER_STEM[body.stem_type]
        other_path_attr = STEM_PATH_MAP[other_stem_type]
        other_key = getattr(task, other_path_attr, None)
        if other_key:
            try:
                other_stem_bytes = StorageService.download_file(
                    settings.MINIO_BUCKET_OUTPUT, other_key
                )
            except Exception:
                logger.warning("Could not download other stem for mixture consistency")

    # Run pipeline
    steps_config = [{"step_id": s.step_id, "params": s.params} for s in body.steps]

    logger.info(f"[Enhance] Running pipeline with {len(steps_config)} steps")
    enhanced_bytes = run_enhance_pipeline(
        audio_bytes=audio_bytes,
        stem_type=body.stem_type,
        steps_config=steps_config,
        original_bytes=original_bytes,
        other_stem_bytes=other_stem_bytes,
    )

    filename = f"enhanced_{body.stem_type}.wav"
    return Response(
        content=enhanced_bytes,
        media_type="audio/wav",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )
