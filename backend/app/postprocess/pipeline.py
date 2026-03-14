"""Post-processing pipeline orchestrator."""
import io
import logging
import time

import numpy as np
import soundfile as sf

from .step1_silence_gate import apply_silence_gate
from .step2_spectral_denoise import apply_spectral_denoise
from .step3_highfreq_restore import restore_high_frequencies
from .step4_artifact_smooth import smooth_artifacts
from .step5_mixture_consistency import enforce_consistency
from .step6_loudness_norm import normalize_loudness
from .step7_ai_denoise import apply_ai_denoise

logger = logging.getLogger(__name__)

STEP_FUNCTIONS = {
    "silence_gate": apply_silence_gate,
    "spectral_denoise": apply_spectral_denoise,
    "highfreq_restore": restore_high_frequencies,
    "artifact_smooth": smooth_artifacts,
    "loudness_norm": normalize_loudness,
    "ai_denoise": apply_ai_denoise,
}

VALID_STEP_IDS = set(STEP_FUNCTIONS.keys()) | {"mixture_consistency"}


def _load_audio(audio_bytes: bytes) -> tuple[np.ndarray, int]:
    buf = io.BytesIO(audio_bytes)
    audio, sr = sf.read(buf)
    if audio.ndim == 2:
        audio = audio.T  # (samples, channels) -> (channels, samples)
    return audio, sr


def _encode_wav(audio: np.ndarray, sr: int) -> bytes:
    if audio.ndim == 2:
        audio = audio.T  # (channels, samples) -> (samples, channels)
    buf = io.BytesIO()
    sf.write(buf, audio, sr, format="WAV")
    return buf.getvalue()


def run_enhance_pipeline(
    audio_bytes: bytes,
    stem_type: str,
    steps_config: list[dict],
    original_bytes: bytes | None = None,
    other_stem_bytes: bytes | None = None,
) -> bytes:
    """
    Run enhancement pipeline on audio.

    Args:
        audio_bytes: WAV bytes of the stem to enhance
        stem_type: "vocals" or "instrumental"
        steps_config: list of {"step_id": str, "params": dict}
        original_bytes: WAV bytes of original mix (needed for mixture_consistency)
        other_stem_bytes: WAV bytes of the other stem (needed for mixture_consistency)

    Returns:
        Enhanced WAV bytes
    """
    audio, sr = _load_audio(audio_bytes)
    stem_label = "vocal" if stem_type == "vocals" else "instrumental"

    total_start = time.time()
    steps_applied = []

    for step_cfg in steps_config:
        step_id = step_cfg["step_id"]
        params = step_cfg.get("params", {})

        if step_id not in VALID_STEP_IDS:
            logger.warning(f"Unknown step '{step_id}', skipping")
            continue

        try:
            step_start = time.time()

            if step_id == "mixture_consistency":
                if original_bytes is None or other_stem_bytes is None:
                    logger.warning("Skipping mixture_consistency: missing original or other stem")
                    continue

                original, _ = _load_audio(original_bytes)
                other_stem, _ = _load_audio(other_stem_bytes)

                if stem_label == "vocal":
                    audio, other_stem = enforce_consistency(
                        audio, other_stem, original, sr=sr, **params
                    )
                else:
                    other_stem, audio = enforce_consistency(
                        other_stem, audio, original, sr=sr, **params
                    )
            else:
                fn = STEP_FUNCTIONS[step_id]
                audio = fn(audio, sr=sr, stem_type=stem_label, **params)

            step_ms = (time.time() - step_start) * 1000
            steps_applied.append({"step": step_id, "duration_ms": round(step_ms, 1)})
            logger.info(f"[Enhance] {step_id} completed in {step_ms:.1f}ms")

        except Exception as e:
            logger.error(f"[Enhance] {step_id} failed: {e}")
            steps_applied.append({"step": step_id, "error": str(e)})
            continue

    total_ms = (time.time() - total_start) * 1000
    logger.info(f"[Enhance] Pipeline completed in {total_ms:.1f}ms, {len(steps_applied)} steps")

    return _encode_wav(audio, sr)
