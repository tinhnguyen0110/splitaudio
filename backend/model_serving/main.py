import asyncio
import io
import logging
import os
import shutil
import tempfile
import threading
import zipfile
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import psutil
import torch
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.responses import Response, StreamingResponse

from models.demucs_handler import DemucsHandler
from models.audio_separator_handler import AudioSeparatorHandler

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Global state
# ---------------------------------------------------------------------------

MODEL_DIR = os.getenv("MODEL_DIR", "/models")

# Which models to load (comma-separated, or "all")
# e.g. LOAD_MODELS=demucs,bs_roformer  or  LOAD_MODELS=all
LOAD_MODELS = os.getenv("LOAD_MODELS", "all")

_handlers: dict = {}          # default device (GPU if available, else CPU)
_cpu_handlers: dict = {}      # lazy-loaded CPU handlers (only when GPU is default)
_cpu_lock = threading.Lock()  # protect lazy CPU handler creation

_inference_semaphore = asyncio.Semaphore(2)

# Models that are too slow on CPU to be practical
_CPU_DISABLED_MODELS = {"bs_roformer", "melband_roformer"}

# All available model definitions
ALL_MODELS = {
    "demucs": ("demucs", "htdemucs"),
    "demucs_ft": ("demucs", "htdemucs_ft"),
    "bs_roformer": ("audio_separator", "bs_roformer"),
    "melband_roformer": ("audio_separator", "melband_roformer"),
}


# ---------------------------------------------------------------------------
# Lifespan: load models at startup
# ---------------------------------------------------------------------------


def _should_load(model_key: str) -> bool:
    if LOAD_MODELS == "all":
        return True
    return model_key in [m.strip() for m in LOAD_MODELS.split(",")]


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting model-serving — loading models from %s", MODEL_DIR)

    # Demucs HTDemucs (fast)
    if _should_load("demucs"):
        try:
            handler = DemucsHandler(model_name="htdemucs", model_dir=MODEL_DIR)
            handler.load_model()
            _handlers["demucs"] = handler
            logger.info("demucs (htdemucs) ready")
        except Exception as exc:
            logger.error("Failed to load demucs: %s", exc)

    # Demucs HTDemucs FT (fine-tuned)
    if _should_load("demucs_ft"):
        try:
            handler = DemucsHandler(model_name="htdemucs_ft", model_dir=MODEL_DIR)
            handler.load_model()
            _handlers["demucs_ft"] = handler
            logger.info("demucs_ft (htdemucs_ft) ready")
        except Exception as exc:
            logger.error("Failed to load demucs_ft: %s", exc)

    # BS-RoFormer (best quality)
    if _should_load("bs_roformer"):
        try:
            handler = AudioSeparatorHandler(model_key="bs_roformer", model_dir=MODEL_DIR)
            handler.load_model()
            if handler.is_loaded:
                _handlers["bs_roformer"] = handler
                logger.info("bs_roformer ready")
            else:
                logger.warning("bs_roformer skipped (package unavailable or weights missing)")
        except Exception as exc:
            logger.error("Failed to load bs_roformer: %s", exc)

    # MelBand RoFormer (good quality + faster)
    if _should_load("melband_roformer"):
        try:
            handler = AudioSeparatorHandler(model_key="melband_roformer", model_dir=MODEL_DIR)
            handler.load_model()
            if handler.is_loaded:
                _handlers["melband_roformer"] = handler
                logger.info("melband_roformer ready")
            else:
                logger.warning("melband_roformer skipped (package unavailable or weights missing)")
        except Exception as exc:
            logger.error("Failed to load melband_roformer: %s", exc)

    logger.info("Model-serving started. Loaded models: %s", list(_handlers.keys()))
    yield

    logger.info("Shutting down model-serving")
    _handlers.clear()
    _cpu_handlers.clear()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Audio Separation — Model Serving",
    version="2.0.0",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Lazy CPU handler loading
# ---------------------------------------------------------------------------


def _get_cpu_handler(model_key: str):
    """Get or lazily create a CPU handler for the given model key."""
    if model_key in _cpu_handlers:
        return _cpu_handlers[model_key]

    with _cpu_lock:
        # Double-check after acquiring lock
        if model_key in _cpu_handlers:
            return _cpu_handlers[model_key]

        if model_key not in ALL_MODELS:
            return None

        handler_type, model_id = ALL_MODELS[model_key]
        logger.info("Lazy-loading CPU handler for %s (%s)", model_key, model_id)

        try:
            if handler_type == "demucs":
                handler = DemucsHandler(model_name=model_id, model_dir=MODEL_DIR, device="cpu")
                handler.load_model()
            else:
                handler = AudioSeparatorHandler(model_key=model_key, model_dir=MODEL_DIR, device="cpu")
                handler.load_model()
                if not handler.is_loaded:
                    logger.error("Failed to lazy-load CPU handler for %s", model_key)
                    return None

            _cpu_handlers[model_key] = handler
            logger.info("CPU handler for %s ready (optimized=%s)", model_key, handler.metadata().get("cpu_optimized"))
            return handler
        except Exception as exc:
            logger.error("Failed to lazy-load CPU handler for %s: %s", model_key, exc)
            return None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/health")
async def health():
    """Return service health, loaded models, GPU availability, and memory stats."""
    gpu_info: Optional[dict] = None
    if torch.cuda.is_available():
        mem = torch.cuda.mem_get_info()  # (free, total) in bytes
        gpu_info = {
            "available": True,
            "device": torch.cuda.get_device_name(0),
            "memory_free_mb": round(mem[0] / 1024**2, 1),
            "memory_total_mb": round(mem[1] / 1024**2, 1),
        }
    else:
        gpu_info = {"available": False}

    ram = psutil.virtual_memory()
    default_device = "gpu" if torch.cuda.is_available() else "cpu"
    return {
        "status": "ok",
        "loaded_models": list(_handlers.keys()),
        "cpu_loaded_models": list(_cpu_handlers.keys()),
        "default_device": default_device,
        "gpu": gpu_info,
        "ram_used_mb": round(ram.used / 1024**2, 1),
        "ram_total_mb": round(ram.total / 1024**2, 1),
    }


@app.get("/models")
async def list_models():
    """List all models with metadata and load status."""
    results = []

    # Show loaded models first
    for key, handler in _handlers.items():
        results.append(handler.metadata())

    # Show unloaded models as stubs
    loaded_keys = set(_handlers.keys())
    for key, (handler_type, model_id) in ALL_MODELS.items():
        if key not in loaded_keys:
            results.append({
                "name": key,
                "description": f"{key} (not loaded)",
                "loaded": False,
            })

    return {"models": results}


@app.post("/predict")
async def predict(
    file: UploadFile = File(...),
    model: str = Query(
        default="demucs",
        description="Model key: 'demucs', 'demucs_ft', 'bs_roformer', or 'melband_roformer'",
    ),
    device: str = Query(
        default="auto",
        description="Device: 'auto' (default GPU if available), 'gpu', or 'cpu'",
    ),
):
    """
    Receive an audio file and return separated stems as a ZIP archive.

    - **file**: audio file (wav, mp3, flac, …)
    - **model**: which model to use (default: demucs)
    - **device**: 'auto' (GPU if available), 'gpu', or 'cpu'

    Available models:
    - demucs: Fastest (24.6x RT), 4-stem, good quality
    - demucs_ft: Fine-tuned Demucs (6.3x RT), 4-stem
    - bs_roformer: Best vocal quality (12.39 dB SDR), 2-stem
    - melband_roformer: Excellent vocals (10.18 dB SDR), faster than BS-RoFormer
    """
    if device not in ("auto", "gpu", "cpu"):
        raise HTTPException(status_code=422, detail=f"Invalid device '{device}'. Must be 'auto', 'gpu', or 'cpu'.")

    if model not in _handlers:
        available = list(_handlers.keys())
        raise HTTPException(
            status_code=422,
            detail=f"Model '{model}' is not loaded. Available: {available}",
        )

    # Resolve device → handler
    if device == "gpu":
        if not torch.cuda.is_available():
            raise HTTPException(status_code=422, detail="GPU requested but CUDA is not available.")
        handler = _handlers[model]
        if handler.device.type != "cuda":
            raise HTTPException(status_code=422, detail="Server started without GPU. Use device=cpu.")
    elif device == "cpu":
        if model in _CPU_DISABLED_MODELS:
            raise HTTPException(
                status_code=422,
                detail=f"Model '{model}' is not available on CPU (too slow). Use device=gpu or device=auto.",
            )
        default_handler = _handlers[model]
        if default_handler.device.type == "cpu":
            # Default handler is already CPU
            handler = default_handler
        else:
            # Lazy-load CPU variant
            handler = await asyncio.get_event_loop().run_in_executor(
                None, _get_cpu_handler, model
            )
            if handler is None:
                raise HTTPException(status_code=500, detail=f"Failed to load CPU handler for '{model}'.")
    else:
        # auto — use default handler
        handler = _handlers[model]

    tmp_dir = Path(tempfile.mkdtemp(prefix="sep_"))
    try:
        # Save uploaded audio
        suffix = Path(file.filename or "audio.wav").suffix or ".wav"
        input_path = tmp_dir / f"input{suffix}"
        content = await file.read()
        input_path.write_bytes(content)

        output_dir = tmp_dir / "output"

        # Run inference in thread pool — semaphore limits concurrent GPU/CPU usage
        async with _inference_semaphore:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None, handler.separate, str(input_path), str(output_dir)
            )

        # Pack stems into a ZIP
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.write(result["vocal_path"], "vocals.wav")
            zf.write(result["instrumental_path"], "instrumental.wav")
        zip_buffer.seek(0)

        return Response(
            content=zip_buffer.read(),
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=stems.zip"},
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Separation failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Separation failed: {exc}")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
