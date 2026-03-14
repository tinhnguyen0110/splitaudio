import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from models.task_process_log import TaskProcessLog

logger = logging.getLogger(__name__)


@asynccontextmanager
async def trace_step(
    db: AsyncSession,
    task_id: uuid.UUID,
    step_name: str,
    step_order: int,
    source: str = "api",
):
    """Async context manager for recording a task processing step.

    Non-blocking: trace failures are logged but never propagate or
    interfere with the actual request processing.
    """
    log_entry = None
    started_at = datetime.now(timezone.utc)

    # Best-effort insert of "started" row
    try:
        log_entry = TaskProcessLog(
            task_id=task_id,
            step_name=step_name,
            step_order=step_order,
            status="started",
            started_at=started_at,
            source=source,
        )
        db.add(log_entry)
        await db.flush()
    except Exception:
        logger.warning("trace_step: failed to insert started row for %s/%s", task_id, step_name, exc_info=True)
        log_entry = None

    # Yield control to the actual work — exceptions here are the caller's,
    # NOT trace errors, so they must propagate.
    exc_caught = None
    try:
        yield log_entry
    except Exception as exc:
        exc_caught = exc

    # Best-effort update of completed/failed row
    if log_entry is not None:
        try:
            now = datetime.now(timezone.utc)
            if exc_caught:
                log_entry.status = "failed"
                log_entry.detail = str(exc_caught)[:1000]
            else:
                log_entry.status = "completed"
            log_entry.completed_at = now
            log_entry.duration_ms = int((now - started_at).total_seconds() * 1000)
            await db.flush()
        except Exception:
            logger.warning("trace_step: failed to update row for %s/%s", task_id, step_name, exc_info=True)

    # Re-raise the caller's exception (not a trace error)
    if exc_caught:
        raise exc_caught
