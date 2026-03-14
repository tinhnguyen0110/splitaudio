import asyncio
import logging
import time
import uuid
from typing import Optional

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from config import settings

logger = logging.getLogger(__name__)

SKIP_PATHS = {"/health", "/docs", "/redoc", "/openapi.json"}


class RequestLogger(BaseHTTPMiddleware):
    """Logs every HTTP request to the request_logs table.

    Fully non-blocking: logging is fire-and-forget via background task.
    Never delays or breaks the actual request.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        if not settings.REQUEST_LOG_ENABLED:
            return await call_next(request)

        path = request.url.path
        if path in SKIP_PATHS:
            return await call_next(request)

        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        start = time.perf_counter()
        response: Optional[Response] = None
        error_detail: Optional[str] = None

        try:
            response = await call_next(request)
        except Exception as exc:
            error_detail = str(exc)[:2000]
            response = JSONResponse(
                status_code=500,
                content={"detail": "Internal server error"},
            )

        duration_ms = int((time.perf_counter() - start) * 1000)
        status_code = response.status_code if response else 500

        # Add X-Request-ID header
        response.headers["X-Request-ID"] = request_id

        # Fire-and-forget: schedule DB insert as background task
        try:
            asyncio.create_task(self._safe_log(
                request_id=request_id,
                user_id=self._extract_user_id(request),
                method=request.method,
                path=path,
                query_params=str(request.url.query) if request.url.query else None,
                status_code=status_code,
                duration_ms=duration_ms,
                client_ip=request.client.host if request.client else "unknown",
                user_agent=request.headers.get("user-agent", "")[:500],
                error_detail=error_detail,
                task_id=getattr(request.state, "task_id", None),
            ))
        except Exception:
            pass  # truly never block

        return response

    def _extract_user_id(self, request: Request) -> Optional[str]:
        """Best-effort JWT user_id extraction."""
        try:
            auth = request.headers.get("authorization", "")
            if not auth.startswith("Bearer "):
                return None
            from jose import jwt as jose_jwt
            token = auth[7:]
            payload = jose_jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            return payload.get("sub")
        except Exception:
            return None

    async def _safe_log(self, **kwargs):
        """Insert request log row. Never raises."""
        try:
            from sqlalchemy import text
            from database import AsyncSessionLocal

            async with AsyncSessionLocal() as session:
                user_id = kwargs.get("user_id")
                task_id = kwargs.get("task_id")
                if user_id:
                    kwargs["user_id"] = uuid.UUID(user_id) if isinstance(user_id, str) else user_id
                if task_id:
                    kwargs["task_id"] = uuid.UUID(str(task_id)) if not isinstance(task_id, uuid.UUID) else task_id

                columns = ", ".join(kwargs.keys())
                placeholders = ", ".join(f":{k}" for k in kwargs.keys())
                await session.execute(
                    text(f"INSERT INTO request_logs (id, {columns}) VALUES (gen_random_uuid(), {placeholders})"),
                    kwargs,
                )
                await session.commit()
        except Exception:
            logger.warning("Failed to log request", exc_info=True)
