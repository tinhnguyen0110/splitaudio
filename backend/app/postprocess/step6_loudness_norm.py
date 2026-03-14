"""Step 6: Loudness Normalization — ITU-R BS.1770 (LUFS)."""
import numpy as np


def normalize_loudness(
    audio: np.ndarray,
    sr: int = 44100,
    stem_type: str = "vocal",
    target_lufs: float = None,
    peak_limit_db: float = -1.0,
) -> np.ndarray:
    try:
        import pyloudnorm as pyln
    except ImportError:
        peak = np.max(np.abs(audio))
        if peak > 0:
            return audio * (0.95 / peak)
        return audio

    if target_lufs is None:
        target_lufs = -16.0 if stem_type == "instrumental" else -14.0

    meter = pyln.Meter(sr)

    if audio.ndim == 2:
        audio_for_meter = audio.T
    else:
        audio_for_meter = audio

    try:
        current_loudness = meter.integrated_loudness(audio_for_meter)

        if np.isinf(current_loudness) or current_loudness < -70:
            return audio

        normalized = pyln.normalize.loudness(audio_for_meter, current_loudness, target_lufs)

        # Apply true peak limiting
        if peak_limit_db < 0:
            peak_limit = 10 ** (peak_limit_db / 20)
            peak = np.max(np.abs(normalized))
            if peak > peak_limit:
                normalized = normalized * (peak_limit / peak)

        if audio.ndim == 2:
            return normalized.T
        return normalized

    except Exception:
        peak = np.max(np.abs(audio))
        if peak > 0:
            return audio * (0.95 / peak)
        return audio
