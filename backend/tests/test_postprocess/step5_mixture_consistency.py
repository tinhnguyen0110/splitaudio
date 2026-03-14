"""
Step 5: Mixture Consistency
Ensure vocal + instrumental ≈ original.
"""
import numpy as np


def enforce_consistency(
    vocal: np.ndarray,
    instrumental: np.ndarray,
    original: np.ndarray,
    sr: int = 44100,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Ensure vocal + instrumental ≈ original.
    Distribute residual error to the stem with lower energy at each sample.

    This is an important constraint because post-processing steps
    can cause the sum of 2 stems to deviate from the original.

    Args:
        vocal: Vocal audio, shape (samples,) or (channels, samples)
        instrumental: Instrumental audio
        original: Original mixture
        sr: Sample rate
    """
    # Trim/pad to same length
    min_len = min(vocal.shape[-1], instrumental.shape[-1], original.shape[-1])
    if vocal.ndim == 2:
        vocal = vocal[:, :min_len]
        instrumental = instrumental[:, :min_len]
        original = original[:, :min_len]
    else:
        vocal = vocal[:min_len]
        instrumental = instrumental[:min_len]
        original = original[:min_len]

    # Calculate residual
    current_sum = vocal + instrumental
    residual = original - current_sum

    # Distribute residual based on energy ratio
    vocal_energy = np.abs(vocal) + 1e-10
    inst_energy = np.abs(instrumental) + 1e-10
    total_energy = vocal_energy + inst_energy

    vocal_ratio = vocal_energy / total_energy
    inst_ratio = inst_energy / total_energy

    # Stem with higher energy receives more residual
    # This is more natural because error typically occurs in dominant parts
    vocal_corrected = vocal + residual * vocal_ratio
    instrumental_corrected = instrumental + residual * inst_ratio

    return vocal_corrected, instrumental_corrected


if __name__ == "__main__":
    import soundfile as sf
    import sys

    if len(sys.argv) < 5:
        print("Usage: python step5_mixture_consistency.py <vocal.wav> <instrumental.wav> <original.wav> <output_vocal.wav> <output_inst.wav>")
        sys.exit(1)

    vocal_path = sys.argv[1]
    inst_path = sys.argv[2]
    orig_path = sys.argv[3]
    out_vocal = sys.argv[4]
    out_inst = sys.argv[5]

    # Load audio
    vocal, sr = sf.read(vocal_path)
    instrumental, _ = sf.read(inst_path)
    original, _ = sf.read(orig_path)

    # Convert to (channels, samples) if stereo
    if vocal.ndim == 2:
        vocal = vocal.T
    if instrumental.ndim == 2:
        instrumental = instrumental.T
    if original.ndim == 2:
        original = original.T

    print(f"Enforcing mixture consistency...")
    print(f"Vocal shape: {vocal.shape}, Inst shape: {instrumental.shape}, Original shape: {original.shape}")

    # Calculate error before
    if vocal.ndim == 2:
        before_error = np.mean(np.abs(original - (vocal + instrumental)))
    else:
        before_error = np.mean(np.abs(original - (vocal + instrumental)))
    print(f"Mean absolute error before: {before_error:.6f}")

    # Apply consistency
    vocal_result, inst_result = enforce_consistency(vocal, instrumental, original, sr)

    # Calculate error after
    if vocal_result.ndim == 2:
        after_error = np.mean(np.abs(original - (vocal_result + inst_result)))
    else:
        after_error = np.mean(np.abs(original - (vocal_result + inst_result)))
    print(f"Mean absolute error after: {after_error:.6f}")
    print(f"Improvement: {(before_error - after_error) / before_error * 100:.2f}%")

    # Save
    if vocal_result.ndim == 2:
        vocal_result = vocal_result.T
        inst_result = inst_result.T
    sf.write(out_vocal, vocal_result, sr)
    sf.write(out_inst, inst_result, sr)

    print(f"Saved to {out_vocal} and {out_inst}")
