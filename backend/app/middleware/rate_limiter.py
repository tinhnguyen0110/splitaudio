import time
from typing import Optional

import redis.asyncio as aioredis
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from config import settings


class RateLimiter(BaseHTTPMiddleware):
    """
    Redis sliding-window rate limiter.

    Default: 60 requests per 60 seconds per IP.
    Per-endpoint overrides can be passed via `limits` dict:
        { "/api/v1/auth/login": (5, 60) }   # 5 req / 60 s
    """

    def __init__(self, app, limits: Optional[dict] = None):
        super().__init__(app)
        self.default_max_requests = 60
        self.default_window_seconds = 60
        self.limits: dict[str, tuple[int, int]] = limits or {}
        self._redis: Optional[aioredis.Redis] = None

    async def _get_redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        return self._redis

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path
        max_requests, window = self.limits.get(path, (self.default_max_requests, self.default_window_seconds))

        client_ip = request.client.host if request.client else "unknown"
        key = f"rate_limit:{path}:{client_ip}"
        now = int(time.time())

        try:
            redis = await self._get_redis()
            current = await redis.incr(key)
            if current == 1:
                await redis.expire(key, window)

            if current > max_requests:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Too many requests. Please try again later."},
                    headers={"Retry-After": str(window)},
                )
        except Exception:
            # Fail open: if Redis is unavailable, don't block requests
            pass

        return await call_next(request)
