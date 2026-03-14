"""
Step 2: Spectral Noise Reduction (FIXED VERSION)
Remove artifacts using spectral gating with GENTLER settings.
"""
import numpy as np


def apply_spectral_denoise(
    audio: np.ndarray,
    sr: int = 44100,
    stem_type: str = "vocal",
    level: str = "medium",
) -> np.ndarray:
    """
    Spectral gating noise reduction using noisereduce library.

    FIXED: Reduced prop_decrease values - original was too aggressive.
    Model separation outputs are already quite clean, we just need light cleanup.
    """
    try:
        import noisereduce as nr
    except ImportError:
        print("Warning: noisereduce not installed, skipping spectral denoise")
        return audio

    # FIXED: Much gentler settings - reduce by 50%
    configs = {
        ("vocal", "light"):       {"stationary": False, "prop_decrease": 0.2, "n_fft": 2048},  # was 0.4
        ("vocal", "medium"):      {"stationary": False, "prop_decrease": 0.3, "n_fft": 2048},  # was 0.6
        ("vocal", "aggressive"):  {"stationary": False, "prop_decrease": 0.4, "n_fft": 2048},  # was 0.8
        ("instrumental", "light"):       {"stationary": True, "prop_decrease": 0.15, "n_fft": 2048},  # was 0.3
        ("instrumental", "medium"):      {"stationary": True, "prop_decrease": 0.25, "n_fft": 2048},  # was 0.5
        ("instrumental", "aggressive"):  {"stationary": True, "prop_decrease": 0.35, "n_fft": 2048},  # was 0.7
    }

    config = configs.get((stem_type, level), configs[("vocal", "medium")])

    # noisereduce processes mono, so separate channels if stereo
    if audio.ndim == 2:
        result = np.stack([
            nr.reduce_noise(y=audio[ch], sr=sr, **config)
            for ch in range(audio.shape[0])
        ])
    else:
        result = nr.reduce_noise(y=audio, sr=sr, **config)

    return result


if __name__ == "__main__":
    import soundfile as sf
    import sys

    if len(sys.argv) < 3:
        print("Usage: python step2_spectral_denoise_v2.py <input.wav> <output.wav> [vocal|instrumental] [light|medium|aggressive]")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    stem_type = sys.argv[3] if len(sys.argv) > 3 else "vocal"
    level = sys.argv[4] if len(sys.argv) > 4 else "medium"

    # Load audio
    audio, sr = sf.read(input_path)
    if audio.ndim == 2:
        audio = audio.T  # Convert to (channels, samples)

    print(f"Applying spectral denoise (FIXED) to {stem_type} (level={level})...")
    print(f"Input shape: {audio.shape}, SR: {sr}")

    # Apply denoise
    result = apply_spectral_denoise(audio, sr, stem_type, level)

    # Save
    if result.ndim == 2:
        result = result.T  # Back to (samples, channels)
    sf.write(output_path, result, sr)

    print(f"Saved to {output_path}")
