import asyncio
import io
import logging
import os
import shutil
import tempfile
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import httpx
from celery import Task
from celery.exceptions import SoftTimeLimitExceeded

from celery_app import celery_app
from tasks.trace_helpers import trace_step, emit_log

logger = logging.getLogger(__name__)

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@postgres:5432/audio_separation",
)
MINIO_ENDPOINT = os.environ.get("MINIO_ENDPOINT", "minio:9000")
MINIO_ACCESS_KEY = os.environ.get("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.environ.get("MINIO_SECRET_KEY", "minioadmin123")
MINIO_SECURE = os.environ.get("MINIO_SECURE", "false").lower() == "true"
MODEL_SERVING_URL = os.environ.get("MODEL_SERVING_URL", "http://model-serving:8001")


# ---------------------------------------------------------------------------
# Async DB helpers (self-contained — no app imports needed)
# ---------------------------------------------------------------------------

def _make_session():
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

    engine = create_async_engine(DATABASE_URL, pool_pre_ping=True, pool_size=2)
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)()


async def _update_task_db(task_id: str, **fields) -> None:
    """Directly update audio_tasks row without ORM model import."""
    from sqlalchemy import text

    set_clauses = ", ".join(f"{k} = :{k}" for k in fields)
    params = {"task_id": uuid.UUID(task_id), **fields}
    async with _make_session() as session:
        await session.execute(
            text(f"UPDATE audio_tasks SET {set_clauses}, updated_at = now() WHERE id = :task_id"),
            params,
        )
        await session.commit()


async def _refund_credits_db(user_id: str, task_id: str) -> None:
    """Find the original deduction and refund it atomically."""
    from sqlalchemy import text

    async with _make_session() as session:
        # Find original deduction amount
        result = await session.execute(
            text(
                "SELECT amount FROM credit_transactions "
                "WHERE user_id = :user_id AND task_id = :task_id AND type = 'deduction' "
                "LIMIT 1"
            ),
            {"user_id": uuid.UUID(user_id), "task_id": uuid.UUID(task_id)},
        )
        row = result.fetchone()
        if row is None:
            logger.warning("No deduction transaction found for task %s", task_id)
            return

        refund_amount = abs(row[0])

        # Atomic credit update + transaction log
        await session.execute(
            text("UPDATE users SET credits = credits + :amount WHERE id = :user_id"),
            {"amount": refund_amount, "user_id": uuid.UUID(user_id)},
        )
        await session.execute(
            text(
                "INSERT INTO credit_transactions (id, user_id, amount, type, task_id, description, created_at) "
                "VALUES (gen_random_uuid(), :user_id, :amount, 'refund', :task_id, :description, now())"
            ),
            {
                "user_id": uuid.UUID(user_id),
                "amount": refund_amount,
                "task_id": uuid.UUID(task_id),
                "description": f"Refund for failed task {task_id}",
            },
        )
        await session.commit()
        logger.info("Refunded %d credits for task %s", refund_amount, task_id)


# ---------------------------------------------------------------------------
# MinIO helpers
# ---------------------------------------------------------------------------

def _minio_client():
    from minio import Minio
    return Minio(MINIO_ENDPOINT, access_key=MINIO_ACCESS_KEY, secret_key=MINIO_SECRET_KEY, secure=MINIO_SECURE)


def _download_from_minio(bucket: str, key: str) -> bytes:
    client = _minio_client()
    response = client.get_object(bucket, key)
    try:
        return response.read()
    finally:
        response.close()
        response.release_conn()


def _upload_to_minio(bucket: str, key: str, data: bytes, content_type: str = "audio/wav") -> None:
    client = _minio_client()
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)
    client.put_object(bucket, key, io.BytesIO(data), len(data), content_type=content_type)


# ---------------------------------------------------------------------------
# Celery task
# ---------------------------------------------------------------------------

@celery_app.task(
    bind=True,
    name="tasks.separation_task.separate_audio",
    max_retries=1,
    time_limit=600,
    soft_time_limit=540,
    acks_late=True,
)
def separate_audio(
    self: Task,
    task_id: str,
    user_id: str,
    input_bucket: str,
    input_key: str,
    output_bucket: str,
    model: str = "demucs",
    device: str = "auto",
    credit_cost: int = 1,
) -> dict:
    """
    Core separation Celery task:
      1. Mark task 'processing'
      2. Download audio from MinIO
      3. POST to model-serving /predict
      4. Unzip stems and upload to MinIO
      5. Mark task 'completed'
      On any error: refund credits and mark 'failed'
    """
    tmp_dir = Path(tempfile.mkdtemp(prefix="worker_sep_"))

    try:
        # ── Step 1: Mark processing ───────────────────────────────────────────
        with trace_step(task_id, "mark_processing", 1) as ctx:
            asyncio.run(_update_task_db(task_id, status="processing"))
            emit_log(task_id, "INFO", f"Task {task_id} received, model={model}, device={device}")
            ctx["detail"] = f"Task {task_id[:8]}, model={model}, device={device}"

        # ── Step 2: Download original audio ───────────────────────────────────
        with trace_step(task_id, "download_audio", 2) as ctx:
            emit_log(task_id, "INFO", f"Downloading from MinIO: {input_key}")
            audio_data = _download_from_minio(input_bucket, input_key)
            suffix = Path(input_key).suffix or ".wav"
            input_path = tmp_dir / f"input{suffix}"
            input_path.write_bytes(audio_data)
            size_mb = round(len(audio_data) / (1024 * 1024), 2)
            emit_log(task_id, "INFO", f"File downloaded ({size_mb} MB)")
            ctx["detail"] = f"Downloaded {size_mb} MB from {input_key}"

        # ── Step 3: POST to model-serving /predict ────────────────────────────
        with trace_step(task_id, "model_inference", 3) as ctx:
            emit_log(task_id, "INFO", f"Starting model inference ({model}, device={device})")
            inference_start = datetime.now(timezone.utc)
            with httpx.Client(timeout=480.0) as http:
                with open(input_path, "rb") as fh:
                    response = http.post(
                        f"{MODEL_SERVING_URL}/predict",
                        params={"model": model, "device": device},
                        files={"file": (input_path.name, fh, "audio/wav")},
                    )
            response.raise_for_status()
            inference_duration = round((datetime.now(timezone.utc) - inference_start).total_seconds(), 1)
            response_mb = round(len(response.content) / (1024 * 1024), 2)
            emit_log(task_id, "INFO", f"Inference complete ({response_mb} MB, {inference_duration}s)")
            ctx["detail"] = f"Model: {model}, output: {response_mb} MB, took {inference_duration}s"

        # ── Step 4: Unzip stems and upload to MinIO ────────────────────────────
        with trace_step(task_id, "upload_stems", 4) as ctx:
            stems_dir = tmp_dir / "stems"
            stems_dir.mkdir()

            with zipfile.ZipFile(io.BytesIO(response.content)) as zf:
                zf.extractall(stems_dir)

            stem_files = [f for f in stems_dir.iterdir() if f.is_file()]
            emit_log(task_id, "DEBUG", f"Extracted {len(stem_files)} stems from ZIP")

            base_key = f"outputs/{user_id}/{task_id}"
            vocal_key: str | None = None
            instrumental_key: str | None = None
            stem_names = []

            for stem_file in stem_files:
                data = stem_file.read_bytes()
                obj_key = f"{base_key}/{stem_file.name}"
                emit_log(task_id, "DEBUG", f"Uploading stem: {stem_file.name}")
                _upload_to_minio(output_bucket, obj_key, data, "audio/wav")
                stem_names.append(stem_file.name)
                name_lower = stem_file.name.lower()
                if "vocal" in name_lower:
                    vocal_key = obj_key
                elif "instrumental" in name_lower or "accomp" in name_lower:
                    instrumental_key = obj_key

            emit_log(task_id, "INFO", "All stems uploaded to MinIO")
            ctx["detail"] = f"Uploaded {len(stem_files)} stems: {', '.join(stem_names)}"

        # ── Step 5: Mark completed ────────────────────────────────────────────
        with trace_step(task_id, "mark_completed", 5) as ctx:
            asyncio.run(_update_task_db(
                task_id,
                status="completed",
                output_vocals_path=vocal_key,
                output_accompaniment_path=instrumental_key,
                completed_at=datetime.utcnow(),
            ))
            emit_log(task_id, "INFO", "Separation completed successfully")
            ctx["detail"] = "Task marked completed, output paths saved"

        return {"task_id": task_id, "status": "completed"}

    except SoftTimeLimitExceeded:
        emit_log(task_id, "ERROR", "Soft time limit exceeded")
        with trace_step(task_id, "refund_credits", 6) as ctx:
            emit_log(task_id, "INFO", "Initiating credit refund")
            asyncio.run(_refund_credits_db(user_id, task_id))
            ctx["detail"] = "Credits refunded due to timeout"
        with trace_step(task_id, "mark_failed", 7) as ctx:
            asyncio.run(_update_task_db(task_id, status="failed", error_log="Task timed out"))
            ctx["detail"] = "Task timed out"
        raise

    except Exception as exc:
        emit_log(task_id, "ERROR", f"Separation failed: {exc}")
        with trace_step(task_id, "refund_credits", 6) as ctx:
            emit_log(task_id, "INFO", "Initiating credit refund")
            asyncio.run(_refund_credits_db(user_id, task_id))
            ctx["detail"] = f"Credits refunded due to error"
        with trace_step(task_id, "mark_failed", 7) as ctx:
            asyncio.run(_update_task_db(task_id, status="failed", error_log=str(exc)[:1000]))
            ctx["detail"] = str(exc)[:200]
        raise

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
