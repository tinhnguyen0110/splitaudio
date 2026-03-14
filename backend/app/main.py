import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from middleware.rate_limiter import RateLimiter
from middleware.request_logger import RequestLogger
from routers import auth, users, separate, tasks, credits, admin, enhance

logging.basicConfig(level=settings.LOG_LEVEL)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    RateLimiter,
    limits={
        "/api/v1/auth/login": (10, 60),
        "/api/v1/auth/register": (5, 60),
        "/api/v1/auth/refresh": (20, 60),
    },
)

app.add_middleware(RequestLogger)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(separate.router, prefix="/api/v1")
app.include_router(tasks.router, prefix="/api/v1")
app.include_router(credits.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(enhance.router, prefix="/api/v1")


@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok", "version": settings.APP_VERSION}
