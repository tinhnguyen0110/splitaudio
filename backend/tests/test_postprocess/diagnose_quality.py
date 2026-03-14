#!/usr/bin/env python3
"""
Diagnostic script to identify which post-processing step degrades quality.
Runs each step individually and saves outputs for listening comparison.
"""
import os
import sys
import numpy as np
import soundfile as sf

sys.path.insert(0, os.path.dirname(__file__))

from step1_silence_gate import apply_silence_gate
from step2_spectral_denoise import apply_spectral_denoise
from step3_highfreq_restore import restore_high_frequencies
from step4_artifact_smooth import smooth_artifacts
from step5_mixture_consistency import enforce_consistency
from step6_loudness_norm import normalize_loudness


def compute_snr(clean, noisy):
    """Compute Signal-to-Noise Ratio."""
    signal_power = np.mean(clean**2)
    noise_power = np.mean((clean - noisy)**2)
    if noise_power < 1e-10:
        return float('inf')
    return 10 * np.log10(signal_power / noise_power)


def diagnose_steps(vocal_path, output_dir, level="medium"):
    """Run each step individually and save outputs."""
    os.makedirs(output_dir, exist_ok=True)

    print("="*60)
    print("POST-PROCESSING DIAGNOSTIC")
    print("="*60)

    # Load audio
    vocal, sr = sf.read(vocal_path)
    if vocal.ndim == 2:
        vocal = vocal.T

    # Save original
    original = vocal.copy()
    if vocal.ndim == 2:
        sf.write(os.path.join(output_dir, "00_original.wav"), vocal.T, sr)
    else:
        sf.write(os.path.join(output_dir, "00_original.wav"), vocal, sr)

    print(f"\nOriginal: shape={vocal.shape}, peak={np.max(np.abs(vocal)):.4f}")

    # Step 1: Silence Gate
    print("\n[Step 1] Silence Gate...")
    step1 = apply_silence_gate(vocal, sr, "vocal")
    snr1 = compute_snr(original if original.ndim == 1 else original.mean(0),
                       step1 if step1.ndim == 1 else step1.mean(0))
    print(f"  Peak: {np.max(np.abs(step1)):.4f}, SNR vs original: {snr1:.2f} dB")
    if step1.ndim == 2:
        sf.write(os.path.join(output_dir, "01_after_gate.wav"), step1.T, sr)
    else:
        sf.write(os.path.join(output_dir, "01_after_gate.wav"), step1, sr)

    # Step 2: Spectral Denoise (starting from step1)
    print("\n[Step 2] Spectral Denoise...")
    step2 = apply_spectral_denoise(step1, sr, "vocal", level)
    snr2 = compute_snr(original if original.ndim == 1 else original.mean(0),
                       step2 if step2.ndim == 1 else step2.mean(0))
    print(f"  Peak: {np.max(np.abs(step2)):.4f}, SNR vs original: {snr2:.2f} dB")
    if step2.ndim == 2:
        sf.write(os.path.join(output_dir, "02_after_denoise.wav"), step2.T, sr)
    else:
        sf.write(os.path.join(output_dir, "02_after_denoise.wav"), step2, sr)

    if level in ("medium", "aggressive"):
        # Step 3: High-freq Restore
        print("\n[Step 3] High-Frequency Restoration...")
        step3 = restore_high_frequencies(step2, sr, "vocal")
        snr3 = compute_snr(original if original.ndim == 1 else original.mean(0),
                           step3 if step3.ndim == 1 else step3.mean(0))
        print(f"  Peak: {np.max(np.abs(step3)):.4f}, SNR vs original: {snr3:.2f} dB")
        if step3.ndim == 2:
            sf.write(os.path.join(output_dir, "03_after_highfreq.wav"), step3.T, sr)
        else:
            sf.write(os.path.join(output_dir, "03_after_highfreq.wav"), step3, sr)

        # Step 4: Artifact Smooth
        print("\n[Step 4] Artifact Smoothing...")
        step4 = smooth_artifacts(step3, sr, "vocal", level)
        snr4 = compute_snr(original if original.ndim == 1 else original.mean(0),
                           step4 if step4.ndim == 1 else step4.mean(0))
        print(f"  Peak: {np.max(np.abs(step4)):.4f}, SNR vs original: {snr4:.2f} dB")
        if step4.ndim == 2:
            sf.write(os.path.join(output_dir, "04_after_smooth.wav"), step4.T, sr)
        else:
            sf.write(os.path.join(output_dir, "04_after_smooth.wav"), step4, sr)

        # Step 6: Loudness Norm (skip step 5 for now since it needs original)
        print("\n[Step 6] Loudness Normalization...")
        step6 = normalize_loudness(step4, sr, "vocal")
        snr6 = compute_snr(original if original.ndim == 1 else original.mean(0),
                           step6 if step6.ndim == 1 else step6.mean(0))
        print(f"  Peak: {np.max(np.abs(step6)):.4f}, SNR vs original: {snr6:.2f} dB")
        if step6.ndim == 2:
            sf.write(os.path.join(output_dir, "06_after_loudness.wav"), step6.T, sr)
        else:
            sf.write(os.path.join(output_dir, "06_after_loudness.wav"), step6, sr)
    else:
        # Light mode: skip to loudness
        print("\n[Step 6] Loudness Normalization...")
        step6 = normalize_loudness(step2, sr, "vocal")
        snr6 = compute_snr(original if original.ndim == 1 else original.mean(0),
                           step6 if step6.ndim == 1 else step6.mean(0))
        print(f"  Peak: {np.max(np.abs(step6)):.4f}, SNR vs original: {snr6:.2f} dB")
        if step6.ndim == 2:
            sf.write(os.path.join(output_dir, "06_after_loudness.wav"), step6.T, sr)
        else:
            sf.write(os.path.join(output_dir, "06_after_loudness.wav"), step6, sr)

    print("\n" + "="*60)
    print("Diagnostic files saved to:", output_dir)
    print("Listen to each file to identify which step degrades quality.")
    print("="*60)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python diagnose_quality.py <vocal.wav> [output_dir] [level]")
        sys.exit(1)

    vocal_path = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "./diagnostic_output"
    level = sys.argv[3] if len(sys.argv) > 3 else "medium"

    diagnose_steps(vocal_path, output_dir, level)
