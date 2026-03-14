"""Step 4: Artifact Smoothing — remove musical noise via spectrogram smoothing."""
import numpy as np
from scipy.ndimage import median_filter
from scipy.signal import stft, istft


def smooth_artifacts(
    audio: np.ndarray,
    sr: int = 44100,
    stem_type: str = "vocal",
    level: str = "medium",
    filter_size: int = None,
    n_fft: int = 2048,
    hop_length: int = 512,
    mask_min: float = 0.5,
) -> np.ndarray:
    if filter_size is None:
        filter_size = {"light": 3, "medium": 3, "aggressive": 5}.get(level, 3)

    def process_channel(ch_audio):
        f, t, Zxx = stft(ch_audio, fs=sr, nperseg=n_fft, noverlap=n_fft - hop_length)
        magnitude = np.abs(Zxx)
        phase = np.angle(Zxx)

        mag_smoothed = median_filter(magnitude, size=(filter_size, filter_size))

        mask = mag_smoothed / (magnitude + 1e-10)
        mask = np.clip(mask, mask_min, 1.0)
        mask = median_filter(mask, size=(3, 3))

        Zxx_clean = magnitude * mask * np.exp(1j * phase)

        _, result = istft(Zxx_clean, fs=sr, nperseg=n_fft, noverlap=n_fft - hop_length)

        if len(result) > len(ch_audio):
            result = result[: len(ch_audio)]
        elif len(result) < len(ch_audio):
            result = np.pad(result, (0, len(ch_audio) - len(result)))

        return result

    if audio.ndim == 2:
        return np.stack([process_channel(audio[ch]) for ch in range(audio.shape[0])])
    return process_channel(audio)
