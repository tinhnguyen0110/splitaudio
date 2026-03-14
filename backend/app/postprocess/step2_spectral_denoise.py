"""Step 2: Spectral Noise Reduction — remove artifacts using spectral gating."""
import numpy as np


def apply_spectral_denoise(
    audio: np.ndarray,
    sr: int = 44100,
    stem_type: str = "vocal",
    level: str = "medium",
    prop_decrease: float = None,
    stationary: str = "auto",
    n_fft: int = 2048,
    freq_mask_smooth_hz: int = None,
    time_mask_smooth_ms: int = None,
    n_std_thresh: float = None,
) -> np.ndarray:
    try:
        import noisereduce as nr
    except ImportError:
        return audio

    # Build config from explicit params or fall back to presets
    if prop_decrease is not None:
        # User provided fine-grained params
        if stationary == "auto":
            use_stationary = stem_type != "vocal"
        else:
            use_stationary = stationary == "stationary"

        config = {"stationary": use_stationary, "prop_decrease": prop_decrease, "n_fft": n_fft}

        if freq_mask_smooth_hz is not None:
            config["freq_mask_smooth_hz"] = freq_mask_smooth_hz
        if time_mask_smooth_ms is not None:
            config["time_mask_smooth_ms"] = time_mask_smooth_ms
        if n_std_thresh is not None:
            config["n_std_thresh_stationary" if use_stationary else "n_std_thresh_nonstationary"] = n_std_thresh
    else:
        # Use preset-based config (fixed gentle values)
        configs = {
            ("vocal", "light"):       {"stationary": False, "prop_decrease": 0.2, "n_fft": 2048},
            ("vocal", "medium"):      {"stationary": False, "prop_decrease": 0.3, "n_fft": 2048},
            ("vocal", "aggressive"):  {"stationary": False, "prop_decrease": 0.4, "n_fft": 2048},
            ("instrumental", "light"):       {"stationary": True, "prop_decrease": 0.15, "n_fft": 2048},
            ("instrumental", "medium"):      {"stationary": True, "prop_decrease": 0.25, "n_fft": 2048},
            ("instrumental", "aggressive"):  {"stationary": True, "prop_decrease": 0.35, "n_fft": 2048},
        }
        config = configs.get((stem_type, level), configs[("vocal", "medium")])

    if audio.ndim == 2:
        result = np.stack([
            nr.reduce_noise(y=audio[ch], sr=sr, **config)
            for ch in range(audio.shape[0])
        ])
    else:
        result = nr.reduce_noise(y=audio, sr=sr, **config)

    return result
