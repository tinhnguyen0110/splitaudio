"""Step 1: Silence Gate — reduce noise in silent sections."""
import numpy as np
from scipy.signal import medfilt


def apply_silence_gate(
    audio: np.ndarray,
    sr: int = 44100,
    stem_type: str = "vocal",
    threshold_db: float = None,
    attack_ms: float = 5.0,
    release_ms: float = 50.0,
    floor_gain: float = 0.05,
    frame_ms: float = 25.0,
) -> np.ndarray:
    if threshold_db is None:
        threshold_db = -50.0 if stem_type == "vocal" else -55.0

    frame_length = int(sr * frame_ms / 1000)
    hop_length = int(sr * 0.010)

    is_stereo = audio.ndim == 2
    mono = np.mean(audio, axis=0) if is_stereo else audio

    n_frames = 1 + (len(mono) - frame_length) // hop_length
    energy_db = np.full(n_frames, -100.0)

    for i in range(n_frames):
        start = i * hop_length
        frame = mono[start : start + frame_length]
        rms = np.sqrt(np.mean(frame**2) + 1e-10)
        energy_db[i] = 20 * np.log10(rms)

    energy_db = medfilt(energy_db, kernel_size=5)
    gate = np.where(energy_db > threshold_db, 1.0, floor_gain)

    attack_samples = max(1, int(attack_ms / 10))
    release_samples = max(1, int(release_ms / 10))

    smoothed_gate = np.copy(gate)
    for i in range(1, len(smoothed_gate)):
        if smoothed_gate[i] > smoothed_gate[i - 1]:
            smoothed_gate[i] = min(1.0, smoothed_gate[i - 1] + 1.0 / attack_samples)
        else:
            smoothed_gate[i] = max(floor_gain, smoothed_gate[i - 1] - 1.0 / release_samples)

    gate_samples = np.interp(
        np.arange(mono.shape[-1]),
        np.arange(n_frames) * hop_length,
        smoothed_gate,
    )

    if is_stereo:
        return audio * gate_samples[np.newaxis, :]
    return audio * gate_samples
