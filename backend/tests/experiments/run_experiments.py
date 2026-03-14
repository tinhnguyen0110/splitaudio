#!/usr/bin/env python3
"""
Audio Separation Model Evaluation Experiment
=============================================
Tests 4 models on MUSDB18 dataset and generates per-model reports + comparison.

Models:
  1. Demucs v4 HTDemucs (fast mode)
  2. Demucs v4 HTDemucs FT (fine-tuned, higher quality)
  3. BS-RoFormer (ViperX) — via audio-separator
  4. MelBand RoFormer (ViperX) — via audio-separator

Usage:
  python tests/experiments/run_experiments.py [--tracks N] [--models MODEL1,MODEL2]

Output:
  tests/experiments/<model_name>/report.json   — per-track metrics
  tests/experiments/<model_name>/report.txt    — human-readable report
  tests/experiments/comparison_report.txt      — side-by-side comparison
  tests/experiments/comparison_report.json     — machine-readable comparison
"""
import argparse
import io
import json
import os
import sys
import tempfile
import time
from pathlib import Path

import numpy as np
import soundfile as sf
import torch

# Paths
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent
MUSDB_ROOT = PROJECT_ROOT / "test_audio" / "musdb18"
EXPERIMENTS_DIR = SCRIPT_DIR

# Model configs
MODEL_CONFIGS = {
    "demucs_htdemucs": {
        "display_name": "Demucs v4 HTDemucs",
        "type": "demucs",
        "model_id": "htdemucs",
        "description": "Fast mode — hybrid transformer, good quality, near real-time",
        "stems": ["vocals", "drums", "bass", "other"],
    },
    "demucs_htdemucs_ft": {
        "display_name": "Demucs v4 HTDemucs FT",
        "type": "demucs",
        "model_id": "htdemucs_ft",
        "description": "Fine-tuned — higher quality, slower (bag of 4 models)",
        "stems": ["vocals", "drums", "bass", "other"],
    },
    "bs_roformer": {
        "display_name": "BS-RoFormer (ViperX-1297)",
        "type": "audio_separator",
        "model_id": "model_bs_roformer_ep_317_sdr_12.9755.ckpt",
        "description": "BS-RoFormer — SOTA vocal separation by ViperX",
        "stems": ["vocals", "instrumental"],
    },
    "melband_roformer": {
        "display_name": "MelBand RoFormer (ViperX-1143)",
        "type": "audio_separator",
        "model_id": "model_mel_band_roformer_ep_3005_sdr_11.4360.ckpt",
        "description": "Mel-Band RoFormer — best vocal separation quality",
        "stems": ["vocals", "instrumental"],
    },
}


def load_musdb(num_tracks=None):
    """Load MUSDB18 test set."""
    import musdb
    mus = musdb.DB(root=str(MUSDB_ROOT), subsets="test")
    if num_tracks:
        tracks = [mus[i] for i in range(min(num_tracks, len(mus)))]
    else:
        tracks = list(mus)
    return tracks


def export_track_to_wav(track, tmpdir):
    """Export MUSDB track mixture to WAV file."""
    wav_path = os.path.join(tmpdir, f"{track.name}.wav")
    sf.write(wav_path, track.audio, track.rate, format="WAV")
    return wav_path


# =========================================================================
# Demucs separation
# =========================================================================

_demucs_models = {}


def load_demucs_model(model_id):
    """Load and cache Demucs model."""
    if model_id not in _demucs_models:
        from demucs.pretrained import get_model
        model = get_model(model_id)
        model.eval()
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model.to(device)
        _demucs_models[model_id] = (model, device)
    return _demucs_models[model_id]


def separate_demucs(track, model_id):
    """Run Demucs separation. Returns dict of stem_name -> audio array."""
    from demucs.apply import apply_model

    model, device = load_demucs_model(model_id)
    audio = torch.tensor(track.audio.T, dtype=torch.float32).unsqueeze(0).to(device)

    t0 = time.time()
    with torch.no_grad():
        if device.type == "cuda":
            with torch.amp.autocast("cuda"):
                estimates = apply_model(model, audio, device=device)
        else:
            estimates = apply_model(model, audio, device=device)
    elapsed = time.time() - t0

    estimates = estimates.squeeze(0).cpu().numpy()
    source_map = {name: idx for idx, name in enumerate(model.sources)}

    result = {}
    for name in ["vocals", "drums", "bass", "other"]:
        est = estimates[source_map[name]].T
        ref_len = len(track.targets[name].audio)
        result[name] = est[:ref_len]

    # Also compute instrumental (accompaniment) = drums + bass + other
    result["instrumental"] = result["drums"] + result["bass"] + result["other"]

    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    return result, elapsed


# =========================================================================
# Audio-Separator (RoFormer) separation
# =========================================================================

_separator_instances = {}


def load_separator_model(model_id):
    """Load and cache audio-separator model."""
    if model_id not in _separator_instances:
        from audio_separator.separator import Separator
        sep = Separator(
            output_format="WAV",
            log_level=30,  # WARNING only
        )
        sep.load_model(model_id)
        _separator_instances[model_id] = sep
    return _separator_instances[model_id]


def separate_audio_separator(track, model_id, tmpdir):
    """Run audio-separator. Returns dict with 'vocals' and 'instrumental'."""
    sep = load_separator_model(model_id)

    # Export track to WAV
    wav_path = export_track_to_wav(track, tmpdir)

    # Run separation
    t0 = time.time()
    output_files = sep.separate(wav_path)
    elapsed = time.time() - t0

    result = {}
    ref_len = len(track.audio)

    for f in output_files:
        f_lower = os.path.basename(f).lower()
        audio_data, sr = sf.read(f)

        # Ensure stereo
        if audio_data.ndim == 1:
            audio_data = np.stack([audio_data, audio_data], axis=-1)

        # Trim/pad to match reference length
        if len(audio_data) > ref_len:
            audio_data = audio_data[:ref_len]
        elif len(audio_data) < ref_len:
            pad = np.zeros((ref_len - len(audio_data), audio_data.shape[1]))
            audio_data = np.concatenate([audio_data, pad])

        if "vocal" in f_lower:
            result["vocals"] = audio_data
        elif "instrument" in f_lower or "no_vocal" in f_lower or "accompaniment" in f_lower:
            result["instrumental"] = audio_data

    # Fallback: if only 2 outputs, first is usually primary stem, second is secondary
    if "vocals" not in result or "instrumental" not in result:
        if len(output_files) >= 2:
            for f in output_files:
                audio_data, sr = sf.read(f)
                if audio_data.ndim == 1:
                    audio_data = np.stack([audio_data, audio_data], axis=-1)
                if len(audio_data) > ref_len:
                    audio_data = audio_data[:ref_len]
                elif len(audio_data) < ref_len:
                    pad = np.zeros((ref_len - len(audio_data), audio_data.shape[1]))
                    audio_data = np.concatenate([audio_data, pad])

                if "vocals" not in result:
                    result["vocals"] = audio_data
                elif "instrumental" not in result:
                    result["instrumental"] = audio_data

    # Clean up output files
    for f in output_files:
        try:
            os.remove(f)
        except OSError:
            pass

    return result, elapsed


# =========================================================================
# Evaluation
# =========================================================================

def evaluate_vocals_instrumental(track, estimates):
    """Evaluate vocals + instrumental (accompaniment) separation."""
    import museval

    vocals_ref = track.targets["vocals"].audio
    acc_ref = track.targets["accompaniment"].audio

    vocals_est = estimates.get("vocals")
    inst_est = estimates.get("instrumental")

    results = {}

    if vocals_est is not None:
        refs = np.stack([vocals_ref])
        ests = np.stack([vocals_est[:len(vocals_ref)]])
        sdr, isr, sir, sar = museval.evaluate(refs, ests)
        results["vocals"] = {
            "SDR": float(np.nanmedian(sdr[0])),
            "SIR": float(np.nanmedian(sir[0])),
            "SAR": float(np.nanmedian(sar[0])),
        }

    if inst_est is not None:
        refs = np.stack([acc_ref])
        ests = np.stack([inst_est[:len(acc_ref)]])
        sdr, isr, sir, sar = museval.evaluate(refs, ests)
        results["instrumental"] = {
            "SDR": float(np.nanmedian(sdr[0])),
            "SIR": float(np.nanmedian(sir[0])),
            "SAR": float(np.nanmedian(sar[0])),
        }

    return results


def evaluate_4stems(track, estimates):
    """Evaluate 4-stem separation (Demucs)."""
    import museval

    source_names = ["vocals", "drums", "bass", "other"]
    refs = np.stack([track.targets[s].audio for s in source_names])
    ests = np.stack([estimates[s][:len(track.targets[s].audio)] for s in source_names])

    sdr, isr, sir, sar = museval.evaluate(refs, ests)

    results = {}
    for j, name in enumerate(source_names):
        results[name] = {
            "SDR": float(np.nanmedian(sdr[j])),
            "SIR": float(np.nanmedian(sir[j])),
            "SAR": float(np.nanmedian(sar[j])),
        }

    # Also evaluate accompaniment
    acc_ref = track.targets["accompaniment"].audio
    inst_est = estimates.get("instrumental", estimates["drums"] + estimates["bass"] + estimates["other"])
    refs_acc = np.stack([acc_ref])
    ests_acc = np.stack([inst_est[:len(acc_ref)]])
    sdr_a, _, sir_a, sar_a = museval.evaluate(refs_acc, ests_acc)
    results["instrumental"] = {
        "SDR": float(np.nanmedian(sdr_a[0])),
        "SIR": float(np.nanmedian(sir_a[0])),
        "SAR": float(np.nanmedian(sar_a[0])),
    }

    return results


# =========================================================================
# Report generation
# =========================================================================

def generate_text_report(model_key, config, track_results, output_dir):
    """Generate human-readable report."""
    lines = []
    lines.append("=" * 70)
    lines.append(f"MODEL EVALUATION REPORT: {config['display_name']}")
    lines.append("=" * 70)
    lines.append(f"Description: {config['description']}")
    lines.append(f"Tracks evaluated: {len(track_results)}")
    lines.append(f"Available stems: {', '.join(config['stems'])}")
    lines.append("")

    # Per-track results
    lines.append("-" * 70)
    lines.append("PER-TRACK RESULTS")
    lines.append("-" * 70)

    for tr in track_results:
        lines.append(f"\n  Track: {tr['track']}")
        lines.append(f"  Processing time: {tr['time']:.3f}s ({tr['duration']/tr['time']:.1f}x realtime)")
        for stem, metrics in tr["results"].items():
            lines.append(f"    {stem:>14s}: SDR={metrics['SDR']:7.2f} dB | SIR={metrics['SIR']:7.2f} dB | SAR={metrics['SAR']:7.2f} dB")

    # Aggregate
    lines.append("")
    lines.append("-" * 70)
    lines.append("AGGREGATE RESULTS (median across all tracks)")
    lines.append("-" * 70)

    all_stems = set()
    for tr in track_results:
        all_stems.update(tr["results"].keys())

    aggregate = {}
    for stem in sorted(all_stems):
        sdrs = [tr["results"][stem]["SDR"] for tr in track_results if stem in tr["results"]]
        sirs = [tr["results"][stem]["SIR"] for tr in track_results if stem in tr["results"]]
        sars = [tr["results"][stem]["SAR"] for tr in track_results if stem in tr["results"]]
        if sdrs:
            aggregate[stem] = {
                "SDR_median": float(np.median(sdrs)),
                "SDR_mean": float(np.mean(sdrs)),
                "SDR_std": float(np.std(sdrs)),
                "SIR_median": float(np.median(sirs)),
                "SAR_median": float(np.median(sars)),
            }
            lines.append(
                f"  {stem:>14s}: SDR={np.median(sdrs):7.2f} dB (mean={np.mean(sdrs):.2f}, std={np.std(sdrs):.2f}) "
                f"| SIR={np.median(sirs):7.2f} dB | SAR={np.median(sars):7.2f} dB"
            )

    # Performance
    total_audio = sum(tr["duration"] for tr in track_results)
    total_time = sum(tr["time"] for tr in track_results)
    avg_time = total_time / len(track_results) if track_results else 0

    lines.append("")
    lines.append("-" * 70)
    lines.append("PERFORMANCE")
    lines.append("-" * 70)
    lines.append(f"  Total audio:       {total_audio:.1f}s")
    lines.append(f"  Total processing:  {total_time:.1f}s")
    lines.append(f"  Avg per track:     {avg_time:.3f}s")
    lines.append(f"  Realtime factor:   {total_audio/total_time:.1f}x" if total_time > 0 else "  N/A")
    lines.append(f"  GPU:               {torch.cuda.get_device_name(0)}" if torch.cuda.is_available() else "  GPU: N/A (CPU)")
    lines.append("")

    report_text = "\n".join(lines)

    # Write text report
    report_path = output_dir / "report.txt"
    report_path.write_text(report_text)

    # Write JSON report
    json_report = {
        "model": model_key,
        "display_name": config["display_name"],
        "description": config["description"],
        "num_tracks": len(track_results),
        "aggregate": aggregate,
        "performance": {
            "total_audio_seconds": total_audio,
            "total_processing_seconds": total_time,
            "avg_per_track_seconds": avg_time,
            "realtime_factor": total_audio / total_time if total_time > 0 else 0,
            "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU",
        },
        "tracks": track_results,
    }
    json_path = output_dir / "report.json"
    json_path.write_text(json.dumps(json_report, indent=2))

    return report_text, aggregate


def generate_comparison_report(all_reports):
    """Generate side-by-side comparison of all models."""
    lines = []
    lines.append("=" * 90)
    lines.append("MODEL COMPARISON REPORT — Audio Separation Evaluation")
    lines.append("=" * 90)
    lines.append(f"Date: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"GPU: {torch.cuda.get_device_name(0)}" if torch.cuda.is_available() else "GPU: N/A")
    lines.append("")

    # Vocals SDR comparison (main metric)
    lines.append("-" * 90)
    lines.append("VOCALS SEPARATION QUALITY (SDR dB — higher is better)")
    lines.append("-" * 90)
    lines.append(f"  {'Model':<35s} {'Median SDR':>12s} {'Mean SDR':>10s} {'Std':>8s} {'Speed':>10s}")
    lines.append(f"  {'-'*35} {'-'*12} {'-'*10} {'-'*8} {'-'*10}")

    comparison_data = {}
    for model_key, data in all_reports.items():
        agg = data["aggregate"]
        perf = data["performance"]
        vocals = agg.get("vocals", {})
        comparison_data[model_key] = {
            "display_name": data["display_name"],
            "vocals_sdr": vocals.get("SDR_median", 0),
            "vocals_sdr_mean": vocals.get("SDR_mean", 0),
            "vocals_sdr_std": vocals.get("SDR_std", 0),
            "speed": perf["realtime_factor"],
        }
        lines.append(
            f"  {data['display_name']:<35s} "
            f"{vocals.get('SDR_median', 0):>10.2f} dB "
            f"{vocals.get('SDR_mean', 0):>8.2f} dB "
            f"{vocals.get('SDR_std', 0):>6.2f} "
            f"{perf['realtime_factor']:>8.1f}x RT"
        )

    # Instrumental SDR comparison
    lines.append("")
    lines.append("-" * 90)
    lines.append("INSTRUMENTAL SEPARATION QUALITY (SDR dB — higher is better)")
    lines.append("-" * 90)
    lines.append(f"  {'Model':<35s} {'Median SDR':>12s} {'Mean SDR':>10s} {'Speed':>10s}")
    lines.append(f"  {'-'*35} {'-'*12} {'-'*10} {'-'*10}")

    for model_key, data in all_reports.items():
        agg = data["aggregate"]
        perf = data["performance"]
        inst = agg.get("instrumental", {})
        lines.append(
            f"  {data['display_name']:<35s} "
            f"{inst.get('SDR_median', 0):>10.2f} dB "
            f"{inst.get('SDR_mean', 0):>8.2f} dB "
            f"{perf['realtime_factor']:>8.1f}x RT"
        )

    # 4-stem comparison (Demucs only)
    demucs_models = {k: v for k, v in all_reports.items() if "demucs" in k}
    if demucs_models:
        lines.append("")
        lines.append("-" * 90)
        lines.append("4-STEM BREAKDOWN (Demucs models only)")
        lines.append("-" * 90)
        lines.append(f"  {'Model':<30s} {'Vocals':>10s} {'Drums':>10s} {'Bass':>10s} {'Other':>10s}")
        lines.append(f"  {'-'*30} {'-'*10} {'-'*10} {'-'*10} {'-'*10}")

        for model_key, data in demucs_models.items():
            agg = data["aggregate"]
            lines.append(
                f"  {data['display_name']:<30s} "
                f"{agg.get('vocals', {}).get('SDR_median', 0):>8.2f} dB "
                f"{agg.get('drums', {}).get('SDR_median', 0):>8.2f} dB "
                f"{agg.get('bass', {}).get('SDR_median', 0):>8.2f} dB "
                f"{agg.get('other', {}).get('SDR_median', 0):>8.2f} dB"
            )

    # Performance comparison
    lines.append("")
    lines.append("-" * 90)
    lines.append("PERFORMANCE COMPARISON")
    lines.append("-" * 90)
    lines.append(f"  {'Model':<35s} {'Avg/Track':>10s} {'RT Factor':>10s} {'GPU VRAM':>10s}")
    lines.append(f"  {'-'*35} {'-'*10} {'-'*10} {'-'*10}")

    for model_key, data in all_reports.items():
        perf = data["performance"]
        lines.append(
            f"  {data['display_name']:<35s} "
            f"{perf['avg_per_track_seconds']:>8.3f}s "
            f"{perf['realtime_factor']:>8.1f}x "
            f"{'~4 GB':>10s}"
        )

    # Recommendations
    lines.append("")
    lines.append("=" * 90)
    lines.append("RECOMMENDATIONS")
    lines.append("=" * 90)

    # Find best vocal SDR
    best_vocal = max(comparison_data.items(), key=lambda x: x[1]["vocals_sdr"])
    fastest = max(comparison_data.items(), key=lambda x: x[1]["speed"])

    lines.append(f"  Best vocal quality:  {best_vocal[1]['display_name']} (SDR: {best_vocal[1]['vocals_sdr']:.2f} dB)")
    lines.append(f"  Fastest processing:  {fastest[1]['display_name']} ({fastest[1]['speed']:.1f}x realtime)")
    lines.append("")
    lines.append("  Fast mode (production):   Use Demucs v4 HTDemucs for speed + 4-stem support")
    lines.append("  Quality mode (premium):   Use MelBand/BS-RoFormer for best vocal separation")
    lines.append("")

    report_text = "\n".join(lines)

    # Write comparison reports
    comp_txt = EXPERIMENTS_DIR / "comparison_report.txt"
    comp_txt.write_text(report_text)

    comp_json = EXPERIMENTS_DIR / "comparison_report.json"
    comp_json.write_text(json.dumps({
        "date": time.strftime("%Y-%m-%d %H:%M:%S"),
        "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU",
        "models": {k: v for k, v in all_reports.items()},
    }, indent=2))

    return report_text


# =========================================================================
# Main
# =========================================================================

def run_experiment(model_key, config, tracks, tmpdir):
    """Run evaluation for a single model."""
    output_dir = EXPERIMENTS_DIR / model_key
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n{'='*70}")
    print(f"EVALUATING: {config['display_name']}")
    print(f"{'='*70}")

    track_results = []

    for i, track in enumerate(tracks):
        print(f"  [{i+1}/{len(tracks)}] {track.name} ({track.duration:.1f}s) ...", end=" ", flush=True)

        try:
            if config["type"] == "demucs":
                estimates, elapsed = separate_demucs(track, config["model_id"])
                metrics = evaluate_4stems(track, estimates)
            elif config["type"] == "audio_separator":
                estimates, elapsed = separate_audio_separator(track, config["model_id"], tmpdir)
                metrics = evaluate_vocals_instrumental(track, estimates)
            else:
                raise ValueError(f"Unknown model type: {config['type']}")

            track_results.append({
                "track": track.name,
                "duration": track.duration,
                "time": elapsed,
                "results": metrics,
            })

            # Print vocals SDR
            v_sdr = metrics.get("vocals", {}).get("SDR", 0)
            print(f"vocals SDR={v_sdr:.2f} dB | {elapsed:.3f}s")

        except Exception as e:
            print(f"ERROR: {e}")
            track_results.append({
                "track": track.name,
                "duration": track.duration,
                "time": 0,
                "results": {},
                "error": str(e),
            })

    # Generate reports
    report_text, aggregate = generate_text_report(model_key, config, track_results, output_dir)
    print(f"\n{report_text}")

    return {
        "display_name": config["display_name"],
        "aggregate": aggregate,
        "performance": {
            "total_audio_seconds": sum(tr["duration"] for tr in track_results),
            "total_processing_seconds": sum(tr["time"] for tr in track_results),
            "avg_per_track_seconds": sum(tr["time"] for tr in track_results) / len(track_results) if track_results else 0,
            "realtime_factor": sum(tr["duration"] for tr in track_results) / sum(tr["time"] for tr in track_results) if sum(tr["time"] for tr in track_results) > 0 else 0,
            "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU",
        },
        "tracks": track_results,
    }


def main():
    parser = argparse.ArgumentParser(description="Audio Separation Model Evaluation")
    parser.add_argument("--tracks", type=int, default=None, help="Number of tracks to evaluate (default: all)")
    parser.add_argument("--models", type=str, default=None,
                        help="Comma-separated model keys to evaluate (default: all). "
                             "Options: demucs_htdemucs,demucs_htdemucs_ft,bs_roformer,melband_roformer")
    args = parser.parse_args()

    # Load tracks
    print("Loading MUSDB18 dataset...")
    tracks = load_musdb(args.tracks)
    print(f"Loaded {len(tracks)} tracks")

    # Select models
    if args.models:
        model_keys = [m.strip() for m in args.models.split(",")]
    else:
        model_keys = list(MODEL_CONFIGS.keys())

    # Run experiments
    all_reports = {}

    with tempfile.TemporaryDirectory() as tmpdir:
        for model_key in model_keys:
            if model_key not in MODEL_CONFIGS:
                print(f"WARNING: Unknown model '{model_key}', skipping")
                continue

            config = MODEL_CONFIGS[model_key]
            result = run_experiment(model_key, config, tracks, tmpdir)
            all_reports[model_key] = result

    # Generate comparison
    if len(all_reports) > 1:
        print("\n\n")
        comparison = generate_comparison_report(all_reports)
        print(comparison)
    else:
        print("\nOnly one model evaluated — skipping comparison report.")

    print(f"\nReports saved to: {EXPERIMENTS_DIR}/")
    print("Done!")


if __name__ == "__main__":
    main()
