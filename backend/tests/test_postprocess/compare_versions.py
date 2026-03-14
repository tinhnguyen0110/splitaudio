#!/usr/bin/env python3
"""
Compare original vs fixed post-processing steps.
"""
import os
import sys
import numpy as np
import soundfile as sf

# Import both versions
sys.path.insert(0, os.path.dirname(__file__))

from step1_silence_gate import apply_silence_gate
from step6_loudness_norm import normalize_loudness

# Import original versions
import step2_spectral_denoise as denoise_v1
import step4_artifact_smooth as smooth_v1

# Import fixed versions
import step2_spectral_denoise_v2 as denoise_v2
import step4_artifact_smooth_v2 as smooth_v2


def compute_snr(clean, noisy):
    """Compute Signal-to-Noise Ratio."""
    signal_power = np.mean(clean**2)
    noise_power = np.mean((clean - noisy)**2)
    if noise_power < 1e-10:
        return float('inf')
    return 10 * np.log10(signal_power / noise_power)


def compare_versions(vocal_path, output_dir):
    """Compare original vs fixed versions."""
    os.makedirs(output_dir, exist_ok=True)

    print("="*70)
    print("COMPARING ORIGINAL vs FIXED POST-PROCESSING")
    print("="*70)

    # Load audio
    vocal, sr = sf.read(vocal_path)
    if vocal.ndim == 2:
        vocal = vocal.T

    original = vocal.copy()

    # Step 1: Gate (same for both)
    print("\n[Step 1] Silence Gate (same for both)")
    step1 = apply_silence_gate(vocal, sr, "vocal")
    snr_gate = compute_snr(original.mean(0) if original.ndim == 2 else original,
                           step1.mean(0) if step1.ndim == 2 else step1)
    print(f"  SNR after gate: {snr_gate:.2f} dB")

    # Step 2: Spectral Denoise - ORIGINAL
    print("\n[Step 2a] Spectral Denoise - ORIGINAL (prop_decrease=0.6)")
    step2_v1 = denoise_v1.apply_spectral_denoise(step1, sr, "vocal", "medium")
    snr_v1 = compute_snr(original.mean(0) if original.ndim == 2 else original,
                         step2_v1.mean(0) if step2_v1.ndim == 2 else step2_v1)
    print(f"  SNR: {snr_v1:.2f} dB (vs original)")
    if step2_v1.ndim == 2:
        sf.write(os.path.join(output_dir, "v1_after_denoise.wav"), step2_v1.T, sr)
    else:
        sf.write(os.path.join(output_dir, "v1_after_denoise.wav"), step2_v1, sr)

    # Step 2: Spectral Denoise - FIXED
    print("\n[Step 2b] Spectral Denoise - FIXED (prop_decrease=0.3)")
    step2_v2 = denoise_v2.apply_spectral_denoise(step1, sr, "vocal", "medium")
    snr_v2 = compute_snr(original.mean(0) if original.ndim == 2 else original,
                         step2_v2.mean(0) if step2_v2.ndim == 2 else step2_v2)
    print(f"  SNR: {snr_v2:.2f} dB (vs original)")
    print(f"  Improvement: +{snr_v2 - snr_v1:.2f} dB")
    if step2_v2.ndim == 2:
        sf.write(os.path.join(output_dir, "v2_after_denoise.wav"), step2_v2.T, sr)
    else:
        sf.write(os.path.join(output_dir, "v2_after_denoise.wav"), step2_v2, sr)

    # Step 4: Artifact Smooth - ORIGINAL
    print("\n[Step 4a] Artifact Smoothing - ORIGINAL (mask 0.0-1.0)")
    step4_v1 = smooth_v1.smooth_artifacts(step2_v2, sr, "vocal", "medium")
    snr_smooth_v1 = compute_snr(original.mean(0) if original.ndim == 2 else original,
                                step4_v1.mean(0) if step4_v1.ndim == 2 else step4_v1)
    print(f"  SNR: {snr_smooth_v1:.2f} dB (vs original)")
    if step4_v1.ndim == 2:
        sf.write(os.path.join(output_dir, "v1_after_smooth.wav"), step4_v1.T, sr)
    else:
        sf.write(os.path.join(output_dir, "v1_after_smooth.wav"), step4_v1, sr)

    # Step 4: Artifact Smooth - FIXED
    print("\n[Step 4b] Artifact Smoothing - FIXED (mask 0.5-1.0)")
    step4_v2 = smooth_v2.smooth_artifacts(step2_v2, sr, "vocal", "medium")
    snr_smooth_v2 = compute_snr(original.mean(0) if original.ndim == 2 else original,
                                step4_v2.mean(0) if step4_v2.ndim == 2 else step4_v2)
    print(f"  SNR: {snr_smooth_v2:.2f} dB (vs original)")
    print(f"  Improvement: +{snr_smooth_v2 - snr_smooth_v1:.2f} dB")
    if step4_v2.ndim == 2:
        sf.write(os.path.join(output_dir, "v2_after_smooth.wav"), step4_v2.T, sr)
    else:
        sf.write(os.path.join(output_dir, "v2_after_smooth.wav"), step4_v2, sr)

    # Full pipeline with fixed versions
    print("\n[Full Pipeline] With FIXED steps")
    final = normalize_loudness(step4_v2, sr, "vocal")
    snr_final = compute_snr(original.mean(0) if original.ndim == 2 else original,
                            final.mean(0) if final.ndim == 2 else final)
    print(f"  Final SNR: {snr_final:.2f} dB")
    if final.ndim == 2:
        sf.write(os.path.join(output_dir, "final_fixed.wav"), final.T, sr)
    else:
        sf.write(os.path.join(output_dir, "final_fixed.wav"), final, sr)

    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    print(f"Original approach:")
    print(f"  After denoise (v1): {snr_v1:.2f} dB")
    print(f"  After smooth (v1):  {snr_smooth_v1:.2f} dB")
    print(f"\nFixed approach:")
    print(f"  After denoise (v2): {snr_v2:.2f} dB  (+{snr_v2-snr_v1:.2f} dB improvement)")
    print(f"  After smooth (v2):  {snr_smooth_v2:.2f} dB  (+{snr_smooth_v2-snr_smooth_v1:.2f} dB improvement)")
    print(f"  Final:              {snr_final:.2f} dB")
    print("\nListen to files in:", output_dir)
    print("="*70)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python compare_versions.py <vocal.wav> [output_dir]")
        sys.exit(1)

    vocal_path = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "./comparison_output"

    compare_versions(vocal_path, output_dir)
