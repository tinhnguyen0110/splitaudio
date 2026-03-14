"""
Tests for the model-serving API endpoints.

Requires: GPU (CUDA), audio-separator, demucs, MUSDB18 dataset
These tests load actual ML models and run real inference.

Usage:
    pytest tests/test_model_serving.py -v --asyncio-mode=auto
    pytest tests/test_model_serving.py -v -k "test_predict_demucs"
"""
import io
import os
import sys
import time
import wave
import struct
import zipfile
from pathlib import Path

import numpy as np
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

pytestmark = [
    pytest.mark.asyncio,
    pytest.mark.model_eval,
]

MUSDB_ROOT = Path(__file__).resolve().parent.parent / "test_audio" / "musdb18"


# ---------------------------------------------------------------------------
# Skip helpers
# ---------------------------------------------------------------------------

def _require_gpu():
    torch = pytest.importorskip("torch")
    if not torch.cuda.is_available():
        pytest.skip("CUDA GPU required for model serving tests")


def _require_audio_separator():
    pytest.importorskip("audio_separator")


def _require_musdb():
    pytest.importorskip("musdb")
    if not MUSDB_ROOT.exists():
        pytest.skip("MUSDB18 data not found — run: make musdb-download")


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _make_wav_bytes(duration: float = 2.0, sr: int = 44100, channels: int = 2) -> bytes:
    """Generate a valid stereo WAV file."""
    n_samples = int(sr * duration)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        # Write silence (or near-silence with slight noise to avoid degenerate case)
        samples = [int(100 * np.sin(2 * np.pi * 440 * i / sr)) for i in range(n_samples * channels)]
        wf.writeframes(struct.pack(f"<{len(samples)}h", *samples))
    return buf.getvalue()


def _musdb_wav_bytes() -> bytes:
    """Export first MUSDB track's mixture to WAV bytes."""
    import musdb
    import soundfile as sf

    db = musdb.DB(root=str(MUSDB_ROOT), subsets="test")
    track = db[0]
    buf = io.BytesIO()
    sf.write(buf, track.audio, track.rate, format="WAV")
    buf.seek(0)
    return buf.getvalue()


@pytest.fixture(scope="module")
def model_serving_app():
    """Create the model-serving FastAPI app with models loaded."""
    _require_gpu()

    # Set environment for loading only demucs by default (fast)
    # For full tests, set LOAD_MODELS=all
    os.environ.setdefault("MODEL_DIR", "/tmp/test_model_serving_weights")
    os.environ.setdefault("LOG_LEVEL", "WARNING")

    # Add model_serving to path
    model_serving_dir = str(Path(__file__).resolve().parent.parent / "model_serving")
    if model_serving_dir not in sys.path:
        sys.path.insert(0, model_serving_dir)

    from main import app
    return app


@pytest_asyncio.fixture(scope="module")
async def ms_client(model_serving_app):
    """AsyncClient bound to the model-serving app."""
    async with AsyncClient(
        transport=ASGITransport(app=model_serving_app),
        base_url="http://test",
    ) as ac:
        yield ac


@pytest.fixture(scope="module")
def synth_wav() -> bytes:
    """Synthetic 2-second stereo WAV."""
    return _make_wav_bytes(2.0)


@pytest.fixture(scope="module")
def musdb_wav() -> bytes:
    """Real MUSDB track WAV (if available)."""
    _require_musdb()
    return _musdb_wav_bytes()


# ---------------------------------------------------------------------------
# Health & Models endpoints
# ---------------------------------------------------------------------------


class TestModelServingHealth:

    async def test_health_returns_ok(self, ms_client: AsyncClient):
        resp = await ms_client.get("/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert "loaded_models" in body
        assert isinstance(body["loaded_models"], list)
        assert "gpu" in body

    async def test_health_shows_gpu(self, ms_client: AsyncClient):
        resp = await ms_client.get("/health")
        body = resp.json()
        assert body["gpu"]["available"] is True
        assert "memory_total_mb" in body["gpu"]

    async def test_models_lists_available(self, ms_client: AsyncClient):
        resp = await ms_client.get("/models")
        assert resp.status_code == 200
        body = resp.json()
        assert "models" in body
        models = body["models"]
        assert len(models) >= 1

        # At least some models should be loaded
        loaded = [m for m in models if m.get("loaded")]
        assert len(loaded) >= 1

    async def test_models_have_metadata(self, ms_client: AsyncClient):
        resp = await ms_client.get("/models")
        models = resp.json()["models"]
        for m in models:
            if m.get("loaded"):
                assert "name" in m
                assert "description" in m


# ---------------------------------------------------------------------------
# Predict endpoint — Demucs
# ---------------------------------------------------------------------------


class TestPredictDemucs:

    async def test_predict_demucs_returns_zip(self, ms_client: AsyncClient, synth_wav: bytes):
        resp = await ms_client.post(
            "/predict?model=demucs",
            files={"file": ("test.wav", synth_wav, "audio/wav")},
        )
        if resp.status_code == 422 and "not loaded" in resp.json().get("detail", ""):
            pytest.skip("demucs model not loaded")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/zip"

    async def test_predict_demucs_zip_contains_stems(self, ms_client: AsyncClient, synth_wav: bytes):
        resp = await ms_client.post(
            "/predict?model=demucs",
            files={"file": ("test.wav", synth_wav, "audio/wav")},
        )
        if resp.status_code == 422:
            pytest.skip("demucs model not loaded")
        assert resp.status_code == 200

        zf = zipfile.ZipFile(io.BytesIO(resp.content))
        names = zf.namelist()
        assert "vocals.wav" in names
        assert "instrumental.wav" in names

    async def test_predict_demucs_with_musdb(self, ms_client: AsyncClient, musdb_wav: bytes):
        resp = await ms_client.post(
            "/predict?model=demucs",
            files={"file": ("musdb_track.wav", musdb_wav, "audio/wav")},
        )
        if resp.status_code == 422:
            pytest.skip("demucs model not loaded")
        assert resp.status_code == 200

        zf = zipfile.ZipFile(io.BytesIO(resp.content))
        # Check stems are non-empty
        for name in ["vocals.wav", "instrumental.wav"]:
            data = zf.read(name)
            assert len(data) > 1000, f"{name} is too small ({len(data)} bytes)"


# ---------------------------------------------------------------------------
# Predict endpoint — BS-RoFormer
# ---------------------------------------------------------------------------


class TestPredictBSRoFormer:

    async def test_predict_bs_roformer_returns_zip(self, ms_client: AsyncClient, synth_wav: bytes):
        _require_audio_separator()
        resp = await ms_client.post(
            "/predict?model=bs_roformer",
            files={"file": ("test.wav", synth_wav, "audio/wav")},
        )
        if resp.status_code == 422 and "not loaded" in resp.json().get("detail", ""):
            pytest.skip("bs_roformer model not loaded")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/zip"

    async def test_predict_bs_roformer_zip_contains_stems(self, ms_client: AsyncClient, synth_wav: bytes):
        _require_audio_separator()
        resp = await ms_client.post(
            "/predict?model=bs_roformer",
            files={"file": ("test.wav", synth_wav, "audio/wav")},
        )
        if resp.status_code == 422:
            pytest.skip("bs_roformer model not loaded")
        assert resp.status_code == 200

        zf = zipfile.ZipFile(io.BytesIO(resp.content))
        names = zf.namelist()
        assert "vocals.wav" in names
        assert "instrumental.wav" in names

    async def test_predict_bs_roformer_with_musdb(self, ms_client: AsyncClient, musdb_wav: bytes):
        _require_audio_separator()
        resp = await ms_client.post(
            "/predict?model=bs_roformer",
            files={"file": ("musdb_track.wav", musdb_wav, "audio/wav")},
        )
        if resp.status_code == 422:
            pytest.skip("bs_roformer model not loaded")
        assert resp.status_code == 200

        zf = zipfile.ZipFile(io.BytesIO(resp.content))
        for name in ["vocals.wav", "instrumental.wav"]:
            data = zf.read(name)
            assert len(data) > 1000, f"{name} is too small ({len(data)} bytes)"


# ---------------------------------------------------------------------------
# Predict endpoint — MelBand RoFormer
# ---------------------------------------------------------------------------


class TestPredictMelBandRoFormer:

    async def test_predict_melband_returns_zip(self, ms_client: AsyncClient, synth_wav: bytes):
        _require_audio_separator()
        resp = await ms_client.post(
            "/predict?model=melband_roformer",
            files={"file": ("test.wav", synth_wav, "audio/wav")},
        )
        if resp.status_code == 422 and "not loaded" in resp.json().get("detail", ""):
            pytest.skip("melband_roformer model not loaded")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/zip"

    async def test_predict_melband_zip_contains_stems(self, ms_client: AsyncClient, synth_wav: bytes):
        _require_audio_separator()
        resp = await ms_client.post(
            "/predict?model=melband_roformer",
            files={"file": ("test.wav", synth_wav, "audio/wav")},
        )
        if resp.status_code == 422:
            pytest.skip("melband_roformer model not loaded")
        assert resp.status_code == 200

        zf = zipfile.ZipFile(io.BytesIO(resp.content))
        names = zf.namelist()
        assert "vocals.wav" in names
        assert "instrumental.wav" in names


# ---------------------------------------------------------------------------
# Predict endpoint — Demucs FT
# ---------------------------------------------------------------------------


class TestPredictDemucsFT:

    async def test_predict_demucs_ft_returns_zip(self, ms_client: AsyncClient, synth_wav: bytes):
        resp = await ms_client.post(
            "/predict?model=demucs_ft",
            files={"file": ("test.wav", synth_wav, "audio/wav")},
        )
        if resp.status_code == 422 and "not loaded" in resp.json().get("detail", ""):
            pytest.skip("demucs_ft model not loaded")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/zip"

    async def test_predict_demucs_ft_zip_contains_stems(self, ms_client: AsyncClient, synth_wav: bytes):
        resp = await ms_client.post(
            "/predict?model=demucs_ft",
            files={"file": ("test.wav", synth_wav, "audio/wav")},
        )
        if resp.status_code == 422:
            pytest.skip("demucs_ft model not loaded")
        assert resp.status_code == 200

        zf = zipfile.ZipFile(io.BytesIO(resp.content))
        names = zf.namelist()
        assert "vocals.wav" in names
        assert "instrumental.wav" in names


# ---------------------------------------------------------------------------
# Error cases
# ---------------------------------------------------------------------------


class TestPredictErrors:

    async def test_invalid_model_returns_422(self, ms_client: AsyncClient, synth_wav: bytes):
        resp = await ms_client.post(
            "/predict?model=nonexistent_model",
            files={"file": ("test.wav", synth_wav, "audio/wav")},
        )
        assert resp.status_code == 422
        assert "not loaded" in resp.json()["detail"]

    async def test_no_file_returns_422(self, ms_client: AsyncClient):
        resp = await ms_client.post("/predict?model=demucs")
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Performance
# ---------------------------------------------------------------------------


class TestModelServingPerformance:

    async def test_demucs_speed(self, ms_client: AsyncClient, synth_wav: bytes):
        """Demucs should process a 2s clip in under 5 seconds."""
        t0 = time.time()
        resp = await ms_client.post(
            "/predict?model=demucs",
            files={"file": ("test.wav", synth_wav, "audio/wav")},
        )
        elapsed = time.time() - t0
        if resp.status_code == 422:
            pytest.skip("demucs model not loaded")
        assert resp.status_code == 200
        assert elapsed < 5.0, f"Demucs took {elapsed:.2f}s for 2s audio (too slow)"
