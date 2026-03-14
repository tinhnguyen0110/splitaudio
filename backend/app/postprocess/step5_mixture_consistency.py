"""Step 5: Mixture Consistency — ensure vocal + instrumental ≈ original."""
import numpy as np


def enforce_consistency(
    vocal: np.ndarray,
    instrumental: np.ndarray,
    original: np.ndarray,
    sr: int = 44100,
    method: str = "energy_ratio",
    max_correction_db: float = 6.0,
) -> tuple[np.ndarray, np.ndarray]:
    min_len = min(vocal.shape[-1], instrumental.shape[-1], original.shape[-1])
    if vocal.ndim == 2:
        vocal = vocal[:, :min_len]
        instrumental = instrumental[:, :min_len]
        original = original[:, :min_len]
    else:
        vocal = vocal[:min_len]
        instrumental = instrumental[:min_len]
        original = original[:min_len]

    current_sum = vocal + instrumental
    residual = original - current_sum

    # Clamp residual if max_correction_db is set
    if max_correction_db < 100:
        max_amp = 10 ** (max_correction_db / 20)
        residual = np.clip(residual, -max_amp, max_amp)

    if method == "equal":
        vocal_corrected = vocal + residual * 0.5
        instrumental_corrected = instrumental + residual * 0.5
    elif method == "target_only":
        vocal_corrected = vocal + residual
        instrumental_corrected = instrumental
    else:
        # energy_ratio (default)
        vocal_energy = np.abs(vocal) + 1e-10
        inst_energy = np.abs(instrumental) + 1e-10
        total_energy = vocal_energy + inst_energy
        vocal_corrected = vocal + residual * (vocal_energy / total_energy)
        instrumental_corrected = instrumental + residual * (inst_energy / total_energy)

    return vocal_corrected, instrumental_corrected
