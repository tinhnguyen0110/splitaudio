import asyncio
import logging
import os
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@postgres:5432/audio_separation",
)


def _make_session():
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

    engine = create_async_engine(DATABASE_URL, pool_pre_ping=True, pool_size=2)
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)()


async def _insert_step(task_id: str, step_name: str, step_order: int, status: str,
                       started_at: datetime, completed_at=None, duration_ms=None,
                       detail=None, source="worker"):
    from sqlalchemy import text

    async with _make_session() as session:
        await session.execute(
            text(
                "INSERT INTO task_process_logs "
                "(id, task_id, step_name, step_order, status, started_at, completed_at, duration_ms, detail, source) "
                "VALUES (gen_random_uuid(), :task_id, :step_name, :step_order, :status, "
                ":started_at, :completed_at, :duration_ms, :detail, :source)"
            ),
            {
                "task_id": uuid.UUID(task_id),
                "step_name": step_name,
                "step_order": step_order,
                "status": status,
                "started_at": started_at,
                "completed_at": completed_at,
                "duration_ms": duration_ms,
                "detail": detail,
                "source": source,
            },
        )
        await session.commit()


def _safe_log_step(task_id, step_name, step_order, status, started_at,
                   completed_at=None, duration_ms=None, detail=None):
    """Fire-and-forget step log. Never raises."""
    try:
        asyncio.run(_insert_step(
            task_id, step_name, step_order, status,
            started_at, completed_at, duration_ms, detail, source="worker",
        ))
    except Exception:
        logger.warning("Failed to log trace step %s for task %s", step_name, task_id, exc_info=True)


async def _insert_log(task_id: str, level: str, message: str):
    from sqlalchemy import text as sa_text

    async with _make_session() as session:
        await session.execute(
            sa_text(
                "INSERT INTO worker_logs (id, task_id, level, message, timestamp) "
                "VALUES (gen_random_uuid(), :task_id, :level, :message, now())"
            ),
            {
                "task_id": uuid.UUID(task_id),
                "level": level,
                "message": message,
            },
        )
        await session.commit()


def emit_log(task_id: str, level: str, message: str):
    """Fire-and-forget worker log. Never raises."""
    try:
        asyncio.run(_insert_log(task_id, level, message))
    except Exception:
        logger.warning("Failed to emit worker log for task %s: %s", task_id, message, exc_info=True)


@contextmanager
def trace_step(task_id: str, step_name: str, step_order: int):
    """Sync context manager for worker-side step logging.

    Yields a dict that callers can populate with a ``detail`` key to
    attach human-readable info to the completed step.

    Non-blocking: trace failures are logged but never propagate or
    interfere with the actual task processing.
    """
    ctx: dict = {}
    started_at = datetime.now(timezone.utc)
    try:
        yield ctx
    except Exception as exc:
        completed_at = datetime.now(timezone.utc)
        duration_ms = int((completed_at - started_at).total_seconds() * 1000)
        _safe_log_step(task_id, step_name, step_order, "failed",
                       started_at, completed_at, duration_ms, str(exc)[:1000])
        raise
    else:
        completed_at = datetime.now(timezone.utc)
        duration_ms = int((completed_at - started_at).total_seconds() * 1000)
        _safe_log_step(task_id, step_name, step_order, "completed",
                       started_at, completed_at, duration_ms, ctx.get("detail"))
