"""
Step 3: High-Frequency Restoration
Detect and restore lost high frequencies.
"""
import numpy as np
from scipy.signal import butter, sosfilt


def restore_high_frequencies(
    audio: np.ndarray,
    sr: int = 44100,
    stem_type: str = "vocal",
    cutoff_detect_threshold_db: float = -40.0,
) -> np.ndarray:
    """
    Detect if model has cut high frequencies (typically around ~16kHz)
    and mirror high-frequency portion to restore sibilance.

    Only applies if bandwidth limitation is detected.

    Args:
        audio: Audio array, shape (samples,) or (channels, samples)
        sr: Sample rate
        stem_type: "vocal" or "instrumental"
        cutoff_detect_threshold_db: Threshold for detecting cutoff
    """
    if sr < 44100:
        return audio  # Don't restore if sample rate is low

    # Analyze spectrum to detect cutoff
    if audio.ndim == 2:
        mono = np.mean(audio, axis=0)
    else:
        mono = audio

    # FFT to find cutoff frequency
    n_fft = 8192
    spectrum = np.abs(np.fft.rfft(mono[:n_fft * 4]))
    freqs = np.fft.rfftfreq(n_fft * 4, d=1.0 / sr)

    # Calculate average energy by band
    band_size = sr // 1000  # ~1kHz per band
    n_bands = len(spectrum) // band_size

    band_energy_db = []
    for i in range(n_bands):
        band = spectrum[i * band_size : (i + 1) * band_size]
        energy = np.mean(band**2)
        band_energy_db.append(20 * np.log10(energy + 1e-10))

    # Detect cutoff: find first band with energy drop > threshold
    cutoff_band = None
    if len(band_energy_db) > 10:
        avg_low = np.mean(band_energy_db[2:8])  # 2-8 kHz reference
        for i in range(8, len(band_energy_db)):
            if band_energy_db[i] < avg_low + cutoff_detect_threshold_db:
                cutoff_band = i
                break

    if cutoff_band is None or cutoff_band * 1000 > 20000:
        print(f"No cutoff detected, skipping high-freq restoration")
        return audio  # No cutoff detected, skip

    cutoff_freq = cutoff_band * 1000
    mirror_from = max(cutoff_freq - 2000, 8000)  # Mirror from 2kHz below cutoff

    print(f"Detected cutoff at {cutoff_freq}Hz, restoring from {mirror_from}Hz")

    # Bandpass filter to extract portion to mirror
    nyq = sr / 2
    low = mirror_from / nyq
    high = min(cutoff_freq / nyq, 0.99)

    if low >= high or high >= 1.0:
        return audio

    sos = butter(4, [low, high], btype="band", output="sos")

    def process_channel(ch_audio):
        mirror_band = sosfilt(sos, ch_audio)
        # Frequency shift up via modulation
        t = np.arange(len(mirror_band)) / sr
        shift_freq = cutoff_freq - mirror_from
        shifted = mirror_band * np.cos(2 * np.pi * shift_freq * t)
        # Mix lightly into original (-12dB for natural sound)
        gain = 10 ** (-12 / 20)
        return ch_audio + shifted * gain

    if audio.ndim == 2:
        return np.stack([process_channel(audio[ch]) for ch in range(audio.shape[0])])
    return process_channel(audio)


if __name__ == "__main__":
    import soundfile as sf
    import sys

    if len(sys.argv) < 3:
        print("Usage: python step3_highfreq_restore.py <input.wav> <output.wav> [vocal|instrumental]")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    stem_type = sys.argv[3] if len(sys.argv) > 3 else "vocal"

    # Load audio
    audio, sr = sf.read(input_path)
    if audio.ndim == 2:
        audio = audio.T  # Convert to (channels, samples)

    print(f"Applying high-frequency restoration to {stem_type}...")
    print(f"Input shape: {audio.shape}, SR: {sr}")

    # Apply restoration
    result = restore_high_frequencies(audio, sr, stem_type)

    # Save
    if result.ndim == 2:
        result = result.T  # Back to (samples, channels)
    sf.write(output_path, result, sr)

    print(f"Saved to {output_path}")
