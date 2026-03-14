"""Step 3: High-Frequency Restoration — detect and restore lost high frequencies."""
import numpy as np
from scipy.signal import butter, sosfilt


def restore_high_frequencies(
    audio: np.ndarray,
    sr: int = 44100,
    stem_type: str = "vocal",
    cutoff_detect_threshold_db: float = -40.0,
    mirror_gain_db: float = -12.0,
    filter_order: int = 4,
) -> np.ndarray:
    if sr < 44100:
        return audio

    mono = np.mean(audio, axis=0) if audio.ndim == 2 else audio

    n_fft = 8192
    spectrum = np.abs(np.fft.rfft(mono[:n_fft * 4]))

    band_size = sr // 1000
    n_bands = len(spectrum) // band_size

    band_energy_db = []
    for i in range(n_bands):
        band = spectrum[i * band_size : (i + 1) * band_size]
        energy = np.mean(band**2)
        band_energy_db.append(20 * np.log10(energy + 1e-10))

    cutoff_band = None
    if len(band_energy_db) > 10:
        avg_low = np.mean(band_energy_db[2:8])
        for i in range(8, len(band_energy_db)):
            if band_energy_db[i] < avg_low + cutoff_detect_threshold_db:
                cutoff_band = i
                break

    if cutoff_band is None or cutoff_band * 1000 > 20000:
        return audio

    cutoff_freq = cutoff_band * 1000
    mirror_from = max(cutoff_freq - 2000, 8000)

    nyq = sr / 2
    low = mirror_from / nyq
    high = min(cutoff_freq / nyq, 0.99)

    if low >= high or high >= 1.0:
        return audio

    sos = butter(filter_order, [low, high], btype="band", output="sos")
    gain = 10 ** (mirror_gain_db / 20)

    def process_channel(ch_audio):
        mirror_band = sosfilt(sos, ch_audio)
        t = np.arange(len(mirror_band)) / sr
        shift_freq = cutoff_freq - mirror_from
        shifted = mirror_band * np.cos(2 * np.pi * shift_freq * t)
        return ch_audio + shifted * gain

    if audio.ndim == 2:
        return np.stack([process_channel(audio[ch]) for ch in range(audio.shape[0])])
    return process_channel(audio)
