"""Step 7: AI Denoise — placeholder, requires model serving endpoint."""
import numpy as np
import logging

logger = logging.getLogger(__name__)


def apply_ai_denoise(
    audio: np.ndarray,
    sr: int = 44100,
    stem_type: str = "vocal",
) -> np.ndarray:
    logger.info("AI Denoise: placeholder, returning input unchanged")
    return audio
