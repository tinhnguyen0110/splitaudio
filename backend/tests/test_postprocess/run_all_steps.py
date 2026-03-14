#!/usr/bin/env python3
"""
Test runner for all post-processing steps.
Runs a complete enhancement pipeline on separated audio files.
"""
import os
import sys
import time
import numpy as np
import soundfile as sf

# Add parent dir to path to import step modules
sys.path.insert(0, os.path.dirname(__file__))

from step1_silence_gate import apply_silence_gate
from step2_spectral_denoise import apply_spectral_denoise
from step3_highfreq_restore import restore_high_frequencies
from step4_artifact_smooth import smooth_artifacts
from step5_mixture_consistency import enforce_consistency
from step6_loudness_norm import normalize_loudness
from step7_ai_denoise import apply_ai_denoise


def compute_metrics(audio: np.ndarray, name: str) -> dict:
    """Compute basic audio metrics."""
    if audio.ndim == 2:
        mono = np.mean(audio, axis=0)
    else:
        mono = audio

    peak = np.max(np.abs(mono))
    rms = np.sqrt(np.mean(mono**2))
    peak_db = 20 * np.log10(peak + 1e-10)
    rms_db = 20 * np.log10(rms + 1e-10)

    return {
        "name": name,
        "peak_db": round(peak_db, 2),
        "rms_db": round(rms_db, 2),
        "crest_factor": round(peak_db - rms_db, 2),
    }


def run_pipeline(
    vocal_path: str,
    instrumental_path: str,
    original_path: str,
    output_dir: str,
    level: str = "medium",
):
    """
    Run the complete post-processing pipeline.

    Args:
        vocal_path: Path to separated vocal WAV
        instrumental_path: Path to separated instrumental WAV
        original_path: Path to original mixture WAV
        output_dir: Directory to save enhanced outputs
        level: Enhancement level (light, medium, aggressive)
    """
    os.makedirs(output_dir, exist_ok=True)

    print("="*60)
    print(f"POST-PROCESSING PIPELINE TEST (level={level})")
    print("="*60)

    # Load audio files
    print("\n[1/8] Loading audio files...")
    vocal, sr = sf.read(vocal_path)
    instrumental, _ = sf.read(instrumental_path)
    original, _ = sf.read(original_path)

    # Convert to (channels, samples) if stereo
    if vocal.ndim == 2:
        vocal = vocal.T
    if instrumental.ndim == 2:
        instrumental = instrumental.T
    if original.ndim == 2:
        original = original.T

    print(f"   Vocal: {vocal.shape}, Instrumental: {instrumental.shape}")
    print(f"   Sample rate: {sr} Hz")

    # Track metrics at each step
    results = []
    results.append(compute_metrics(vocal, "0_vocal_raw"))
    results.append(compute_metrics(instrumental, "0_inst_raw"))

    total_start = time.time()

    # Step 1: Silence Gate
    print("\n[2/8] Step 1: Silence Gate")
    start = time.time()
    vocal = apply_silence_gate(vocal, sr, "vocal")
    instrumental = apply_silence_gate(instrumental, sr, "instrumental")
    step1_time = time.time() - start
    print(f"   Completed in {step1_time:.2f}s")
    results.append(compute_metrics(vocal, "1_vocal_gate"))
    results.append(compute_metrics(instrumental, "1_inst_gate"))

    # Step 2: Spectral Denoise
    print("\n[3/8] Step 2: Spectral Noise Reduction")
    start = time.time()
    vocal = apply_spectral_denoise(vocal, sr, "vocal", level)
    instrumental = apply_spectral_denoise(instrumental, sr, "instrumental", level)
    step2_time = time.time() - start
    print(f"   Completed in {step2_time:.2f}s")
    results.append(compute_metrics(vocal, "2_vocal_denoise"))
    results.append(compute_metrics(instrumental, "2_inst_denoise"))

    # Step 3: High-Frequency Restoration
    if level in ("medium", "aggressive"):
        print("\n[4/8] Step 3: High-Frequency Restoration")
        start = time.time()
        vocal = restore_high_frequencies(vocal, sr, "vocal")
        instrumental = restore_high_frequencies(instrumental, sr, "instrumental")
        step3_time = time.time() - start
        print(f"   Completed in {step3_time:.2f}s")
        results.append(compute_metrics(vocal, "3_vocal_highfreq"))
        results.append(compute_metrics(instrumental, "3_inst_highfreq"))
    else:
        print("\n[4/8] Step 3: High-Frequency Restoration (skipped - light mode)")
        step3_time = 0

    # Step 4: Artifact Smoothing
    if level in ("medium", "aggressive"):
        print("\n[5/8] Step 4: Artifact Smoothing")
        start = time.time()
        vocal = smooth_artifacts(vocal, sr, "vocal", level)
        instrumental = smooth_artifacts(instrumental, sr, "instrumental", level)
        step4_time = time.time() - start
        print(f"   Completed in {step4_time:.2f}s")
        results.append(compute_metrics(vocal, "4_vocal_smooth"))
        results.append(compute_metrics(instrumental, "4_inst_smooth"))
    else:
        print("\n[5/8] Step 4: Artifact Smoothing (skipped - light mode)")
        step4_time = 0

    # Step 5: Mixture Consistency
    if level in ("medium", "aggressive"):
        print("\n[6/8] Step 5: Mixture Consistency")
        start = time.time()

        # Calculate error before
        min_len = min(vocal.shape[-1], instrumental.shape[-1], original.shape[-1])
        v_trim = vocal[..., :min_len]
        i_trim = instrumental[..., :min_len]
        o_trim = original[..., :min_len]
        before_error = np.mean(np.abs(o_trim - (v_trim + i_trim)))

        vocal, instrumental = enforce_consistency(vocal, instrumental, original, sr)

        # Calculate error after
        min_len = min(vocal.shape[-1], instrumental.shape[-1], original.shape[-1])
        v_trim = vocal[..., :min_len]
        i_trim = instrumental[..., :min_len]
        o_trim = original[..., :min_len]
        after_error = np.mean(np.abs(o_trim - (v_trim + i_trim)))

        step5_time = time.time() - start
        improvement = (before_error - after_error) / before_error * 100 if before_error > 0 else 0
        print(f"   Completed in {step5_time:.2f}s")
        print(f"   Error before: {before_error:.6f}, after: {after_error:.6f}")
        print(f"   Improvement: {improvement:.2f}%")
        results.append(compute_metrics(vocal, "5_vocal_consistency"))
        results.append(compute_metrics(instrumental, "5_inst_consistency"))
    else:
        print("\n[6/8] Step 5: Mixture Consistency (skipped - light mode)")
        step5_time = 0

    # Step 6: Loudness Normalization
    print("\n[7/8] Step 6: Loudness Normalization")
    start = time.time()
    vocal = normalize_loudness(vocal, sr, "vocal")
    instrumental = normalize_loudness(instrumental, sr, "instrumental")
    step6_time = time.time() - start
    print(f"   Completed in {step6_time:.2f}s")
    results.append(compute_metrics(vocal, "6_vocal_loudness"))
    results.append(compute_metrics(instrumental, "6_inst_loudness"))

    # Step 7: AI Denoise (only for aggressive mode)
    if level == "aggressive":
        print("\n[8/8] Step 7: AI Denoise")
        start = time.time()
        vocal = apply_ai_denoise(vocal, sr, "vocal")
        instrumental = apply_ai_denoise(instrumental, sr, "instrumental")
        step7_time = time.time() - start
        print(f"   Completed in {step7_time:.2f}s")
        results.append(compute_metrics(vocal, "7_vocal_ai_denoise"))
        results.append(compute_metrics(instrumental, "7_inst_ai_denoise"))
    else:
        print("\n[8/8] Step 7: AI Denoise (skipped - not aggressive mode)")
        step7_time = 0

    total_time = time.time() - total_start

    # Save enhanced audio
    print(f"\nSaving enhanced audio to {output_dir}...")
    if vocal.ndim == 2:
        vocal = vocal.T
        instrumental = instrumental.T
    sf.write(os.path.join(output_dir, "vocal_enhanced.wav"), vocal, sr)
    sf.write(os.path.join(output_dir, "instrumental_enhanced.wav"), instrumental, sr)

    # Print summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"Enhancement level: {level}")
    print(f"\nTiming:")
    print(f"  Step 1 (Silence Gate):       {step1_time:6.2f}s")
    print(f"  Step 2 (Spectral Denoise):   {step2_time:6.2f}s")
    print(f"  Step 3 (HighFreq Restore):   {step3_time:6.2f}s")
    print(f"  Step 4 (Artifact Smooth):    {step4_time:6.2f}s")
    print(f"  Step 5 (Mixture Consist):    {step5_time:6.2f}s")
    print(f"  Step 6 (Loudness Norm):      {step6_time:6.2f}s")
    print(f"  Step 7 (AI Denoise):         {step7_time:6.2f}s")
    print(f"  {'─'*40}")
    print(f"  Total:                       {total_time:6.2f}s")

    print(f"\nMetrics (Peak/RMS in dB):")
    print(f"  {'Step':<25} {'Peak dB':>10} {'RMS dB':>10} {'Crest':>8}")
    print(f"  {'-'*55}")
    for m in results:
        print(f"  {m['name']:<25} {m['peak_db']:>10.2f} {m['rms_db']:>10.2f} {m['crest_factor']:>8.2f}")

    print("\n" + "="*60)
    print("Test completed successfully!")
    print("="*60)


if __name__ == "__main__":
    if len(sys.argv) < 5:
        print("Usage: python run_all_steps.py <vocal.wav> <instrumental.wav> <original.wav> <output_dir> [level]")
        print("  level: light | medium | aggressive (default: medium)")
        sys.exit(1)

    vocal_path = sys.argv[1]
    inst_path = sys.argv[2]
    orig_path = sys.argv[3]
    output_dir = sys.argv[4]
    level = sys.argv[5] if len(sys.argv) > 5 else "medium"

    if level not in ("light", "medium", "aggressive"):
        print(f"Error: Invalid level '{level}'. Must be light, medium, or aggressive.")
        sys.exit(1)

    run_pipeline(vocal_path, inst_path, orig_path, output_dir, level)
