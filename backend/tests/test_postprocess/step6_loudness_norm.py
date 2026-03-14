"""
Step 6: Loudness Normalization
Normalize loudness per ITU-R BS.1770 (LUFS).
"""
import numpy as np


def normalize_loudness(
    audio: np.ndarray,
    sr: int = 44100,
    stem_type: str = "vocal",
    target_lufs: float = None,
) -> np.ndarray:
    """
    Normalize loudness per ITU-R BS.1770 (LUFS).
    Target -14 LUFS is suitable for streaming platforms.

    Vocal: -14 LUFS (default)
    Instrumental: -16 LUFS (slightly lower, sounds natural when remixed)

    Args:
        audio: Audio array, shape (samples,) or (channels, samples)
        sr: Sample rate
        stem_type: "vocal" or "instrumental"
        target_lufs: Target loudness in LUFS
    """
    try:
        import pyloudnorm as pyln
    except ImportError:
        print("Warning: pyloudnorm not installed, using simple peak normalization")
        # Fallback: simple peak normalization
        peak = np.max(np.abs(audio))
        if peak > 0:
            return audio * (0.95 / peak)
        return audio

    # Set target based on stem type if not provided
    if target_lufs is None:
        if stem_type == "instrumental":
            target_lufs = -16.0
        else:
            target_lufs = -14.0

    meter = pyln.Meter(sr)

    # pyloudnorm expects (samples, channels) format
    if audio.ndim == 2:
        audio_for_meter = audio.T  # (channels, samples) -> (samples, channels)
    else:
        audio_for_meter = audio

    try:
        current_loudness = meter.integrated_loudness(audio_for_meter)

        if np.isinf(current_loudness) or current_loudness < -70:
            # Audio too quiet or silence, skip normalization
            print(f"Audio too quiet (LUFS={current_loudness:.1f}), skipping normalization")
            return audio

        print(f"Current loudness: {current_loudness:.1f} LUFS, target: {target_lufs:.1f} LUFS")

        normalized = pyln.normalize.loudness(audio_for_meter, current_loudness, target_lufs)

        if audio.ndim == 2:
            return normalized.T  # Back to (channels, samples)
        return normalized

    except Exception as e:
        print(f"Error in loudness normalization: {e}, using peak normalization")
        # Fallback: simple peak normalization
        peak = np.max(np.abs(audio))
        if peak > 0:
            return audio * (0.95 / peak)
        return audio


if __name__ == "__main__":
    import soundfile as sf
    import sys

    if len(sys.argv) < 3:
        print("Usage: python step6_loudness_norm.py <input.wav> <output.wav> [vocal|instrumental]")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    stem_type = sys.argv[3] if len(sys.argv) > 3 else "vocal"

    # Load audio
    audio, sr = sf.read(input_path)
    if audio.ndim == 2:
        audio = audio.T  # Convert to (channels, samples)

    print(f"Applying loudness normalization to {stem_type}...")
    print(f"Input shape: {audio.shape}, SR: {sr}")

    # Apply normalization
    result = normalize_loudness(audio, sr, stem_type)

    # Save
    if result.ndim == 2:
        result = result.T  # Back to (samples, channels)
    sf.write(output_path, result, sr)

    print(f"Saved to {output_path}")
