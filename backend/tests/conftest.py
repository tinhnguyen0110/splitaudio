"""
Comprehensive pytest fixtures for the audio-separation test suite.

Run from the repo root:
    pytest tests/ --asyncio-mode=auto

Or via Makefile:
    make test
"""
import io
import struct
import uuid
import wave
from pathlib import Path
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

# ---------------------------------------------------------------------------
# Re-use the application but override settings BEFORE importing app modules
# ---------------------------------------------------------------------------
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-chars-long!!")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test_user:test_pass@localhost:5433/audio_sep_test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6380/1")
os.environ.setdefault("CELERY_BROKER_URL", "redis://localhost:6380/1")
os.environ.setdefault("CELERY_RESULT_BACKEND", "redis://localhost:6380/2")
os.environ.setdefault("MINIO_ENDPOINT", "localhost:9002")
os.environ.setdefault("MINIO_ACCESS_KEY", "testadmin")
os.environ.setdefault("MINIO_SECRET_KEY", "testadmin123")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "5")
os.environ.setdefault("LOG_LEVEL", "WARNING")

from database import Base  # noqa: E402
from main import app  # noqa: E402
from utils.dependencies import get_db  # noqa: E402

# Disable rate limiter in tests
from middleware.rate_limiter import RateLimiter  # noqa: E402

async def _noop_dispatch(self, request, call_next):
    return await call_next(request)

RateLimiter.dispatch = _noop_dispatch

# ---------------------------------------------------------------------------
# Test database engine
# ---------------------------------------------------------------------------

TEST_DATABASE_URL = os.environ["DATABASE_URL"]

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False, poolclass=NullPool)
TestSessionFactory = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


# ---------------------------------------------------------------------------
# Session-scoped DB setup / teardown
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture(scope="session")
async def db_setup():
    """Create all tables once per test session, drop after."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()


# ---------------------------------------------------------------------------
# Function-scoped DB session that rolls back after each test
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def db_session(db_setup) -> AsyncGenerator[AsyncSession, None]:
    """
    Each test gets a fresh transaction that is rolled back on completion,
    keeping the DB clean without recreating tables.
    """
    async with test_engine.connect() as conn:
        await conn.begin()
        session = AsyncSession(bind=conn, expire_on_commit=False)
        try:
            yield session
        finally:
            await session.close()
            await conn.rollback()


# ---------------------------------------------------------------------------
# HTTP client with dependency override
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """AsyncClient bound to the FastAPI app, using the test DB session."""

    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db

    # Mock Celery send_task so tests don't need a running broker
    with patch("celery_client.get_celery_app") as mock_celery_factory:
        mock_celery = MagicMock()
        mock_celery.send_task = MagicMock(return_value=MagicMock(id="mock-celery-id"))
        mock_celery_factory.return_value = mock_celery

        # Mock MinIO to avoid real storage calls
        with patch("services.storage_service.StorageService.upload_file", return_value="mocked/key"), \
             patch("services.storage_service.StorageService.download_file", return_value=b""), \
             patch("services.storage_service.StorageService.delete_file"), \
             patch("services.storage_service.StorageService.generate_presigned_url",
                   return_value="http://minio/presigned/url"):
            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="http://test",
            ) as ac:
                yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client_real_minio(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """AsyncClient that uses real MinIO storage (no storage mocks)."""

    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db

    # Mock only Celery — let MinIO calls go through
    with patch("celery_client.get_celery_app") as mock_celery_factory:
        mock_celery = MagicMock()
        mock_celery.send_task = MagicMock(return_value=MagicMock(id="mock-celery-id"))
        mock_celery_factory.return_value = mock_celery

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as ac:
            yield ac

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Audio file helpers
# ---------------------------------------------------------------------------

def make_wav_bytes(duration_seconds: float = 1.0, sample_rate: int = 44100) -> bytes:
    """Generate a minimal valid WAV file in memory."""
    num_samples = int(sample_rate * duration_seconds)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(sample_rate)
        wf.writeframes(struct.pack(f"<{num_samples}h", *([0] * num_samples)))
    return buf.getvalue()


@pytest.fixture
def short_wav() -> bytes:
    """1-second WAV → costs 1 credit."""
    return make_wav_bytes(duration_seconds=1.0)


@pytest.fixture
def medium_wav() -> bytes:
    """6-minute WAV → costs 2 credits (> 300s)."""
    return make_wav_bytes(duration_seconds=361.0)


@pytest.fixture
def long_wav() -> bytes:
    """11-minute WAV → should be rejected (> 600s)."""
    return make_wav_bytes(duration_seconds=661.0)


@pytest.fixture
def invalid_audio() -> bytes:
    """Not a valid audio file."""
    return b"this is not audio data at all"


# ---------------------------------------------------------------------------
# User registration / login helpers
# ---------------------------------------------------------------------------

async def register_and_login(
    client: AsyncClient,
    email: str,
    password: str = "TestPass123!",
    display_name: str | None = None,
) -> dict:
    """Register a user and return {access_token, refresh_token, email, password}."""
    payload: dict = {"email": email, "password": password}
    if display_name:
        payload["display_name"] = display_name

    resp = await client.post("/api/v1/auth/register", json=payload)
    assert resp.status_code == 201, resp.text
    tokens = resp.json()
    return {
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "email": email,
        "password": password,
    }


@pytest_asyncio.fixture
async def test_user(client: AsyncClient) -> dict:
    """Regular user fixture. Returns tokens + credentials."""
    return await register_and_login(client, f"user_{uuid.uuid4().hex[:8]}@test.com")


@pytest_asyncio.fixture
async def admin_user(client: AsyncClient, db_session: AsyncSession) -> dict:
    """Admin user fixture. Registers, upgrades role to admin, re-logs in."""
    data = await register_and_login(client, f"admin_{uuid.uuid4().hex[:8]}@test.com")

    # Promote to admin directly in DB
    await db_session.execute(
        text("UPDATE users SET role = 'admin' WHERE email = :email"),
        {"email": data["email"]},
    )
    await db_session.flush()

    # Re-login to get fresh tokens (role is embedded in DB, not token — but
    # get_current_admin re-fetches from DB so no re-login needed)
    return data


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# MUSDB18 fixtures – real audio from the MUSDB sample dataset
# ---------------------------------------------------------------------------

MUSDB_ROOT = Path(__file__).resolve().parent.parent / "test_audio" / "musdb18"


def _musdb_available() -> bool:
    """Check if musdb package and sample data are available."""
    try:
        import musdb
        return MUSDB_ROOT.exists()
    except ImportError:
        return False


@pytest.fixture(scope="session")
def musdb_db():
    """Session-scoped musdb.DB pointing at the sample dataset.
    Skips if musdb is not installed or data is not downloaded."""
    pytest.importorskip("musdb")
    if not MUSDB_ROOT.exists():
        pytest.skip("MUSDB18 sample data not found – run: python -c \"import musdb; musdb.DB(download=True, root='test_audio/musdb18')\"")
    import musdb
    return musdb.DB(root=str(MUSDB_ROOT))


@pytest.fixture(scope="session")
def musdb_track(musdb_db):
    """Return the first track from MUSDB18 for testing."""
    return musdb_db[0]


@pytest.fixture
def musdb_wav_bytes(musdb_track) -> bytes:
    """Export a MUSDB track's mixture to WAV bytes for upload testing.
    Uses the real 7-second sample audio."""
    import soundfile as sf
    buf = io.BytesIO()
    sf.write(buf, musdb_track.audio, musdb_track.rate, format="WAV")
    buf.seek(0)
    return buf.getvalue()


@pytest.fixture
def musdb_vocals_reference(musdb_track):
    """Return the ground-truth vocals array for quality comparison."""
    return musdb_track.targets["vocals"].audio


@pytest.fixture
def musdb_accompaniment_reference(musdb_track):
    """Return the ground-truth accompaniment array for quality comparison."""
    return musdb_track.targets["accompaniment"].audio


@pytest.fixture(scope="session")
def musdb_track_info(musdb_track) -> dict:
    """Track metadata for assertions."""
    return {
        "name": musdb_track.name,
        "duration": musdb_track.duration,
        "rate": musdb_track.rate,
        "sources": list(musdb_track.sources.keys()),
    }
