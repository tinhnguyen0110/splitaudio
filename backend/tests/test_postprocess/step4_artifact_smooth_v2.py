"""
Step 4: Artifact Smoothing (FIXED VERSION)
Remove musical noise by smoothing spectrogram mask with GENTLER settings.
"""
import numpy as np
from scipy.ndimage import median_filter
from scipy.signal import stft, istft


def smooth_artifacts(
    audio: np.ndarray,
    sr: int = 44100,
    stem_type: str = "vocal",
    level: str = "medium",
) -> np.ndarray:
    """
    Remove musical noise by smoothing spectrogram mask.

    FIXED: Reduced filter sizes and gentler mask application.
    Original was too aggressive, causing signal degradation.
    """
    n_fft = 2048
    hop_length = 512

    # FIXED: Smaller filter sizes - gentler smoothing
    filter_size = {"light": 3, "medium": 3, "aggressive": 5}.get(level, 3)  # was 3/5/7

    def process_channel(ch_audio):
        # STFT
        f, t, Zxx = stft(ch_audio, fs=sr, nperseg=n_fft, noverlap=n_fft - hop_length)
        magnitude = np.abs(Zxx)
        phase = np.angle(Zxx)

        # Median filter on magnitude to smooth musical noise
        mag_smoothed = median_filter(magnitude, size=(filter_size, filter_size))

        # FIXED: Soft mask with maximum limit to prevent over-suppression
        mask = mag_smoothed / (magnitude + 1e-10)
        mask = np.clip(mask, 0.5, 1.0)  # CHANGED: was 0.0-1.0, now 0.5-1.0 (less aggressive)

        # Smooth mask edges (smaller filter)
        mask = median_filter(mask, size=(3, 3))

        # Apply mask
        Zxx_clean = magnitude * mask * np.exp(1j * phase)

        # iSTFT
        _, result = istft(Zxx_clean, fs=sr, nperseg=n_fft, noverlap=n_fft - hop_length)

        # Trim or pad to original length
        if len(result) > len(ch_audio):
            result = result[: len(ch_audio)]
        elif len(result) < len(ch_audio):
            result = np.pad(result, (0, len(ch_audio) - len(result)))

        return result

    if audio.ndim == 2:
        return np.stack([process_channel(audio[ch]) for ch in range(audio.shape[0])])
    return process_channel(audio)


if __name__ == "__main__":
    import soundfile as sf
    import sys

    if len(sys.argv) < 3:
        print("Usage: python step4_artifact_smooth_v2.py <input.wav> <output.wav> [vocal|instrumental] [light|medium|aggressive]")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    stem_type = sys.argv[3] if len(sys.argv) > 3 else "vocal"
    level = sys.argv[4] if len(sys.argv) > 4 else "medium"

    # Load audio
    audio, sr = sf.read(input_path)
    if audio.ndim == 2:
        audio = audio.T  # Convert to (channels, samples)

    print(f"Applying artifact smoothing (FIXED) to {stem_type} (level={level})...")
    print(f"Input shape: {audio.shape}, SR: {sr}")

    # Apply smoothing
    result = smooth_artifacts(audio, sr, stem_type, level)

    # Save
    if result.ndim == 2:
        result = result.T  # Back to (samples, channels)
    sf.write(output_path, result, sr)

    print(f"Saved to {output_path}")
