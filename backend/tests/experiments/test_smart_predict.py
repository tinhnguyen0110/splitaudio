#!/usr/bin/env python3
"""
Smart CPU Inference — Auto-selects optimal strategy per model & duration
========================================================================
Based on benchmark data:
  - Demucs HTDemucs:  INT8 always, + chunking if duration > 20s
  - Demucs HTDemucs FT: no INT8 (no benefit), + chunking if duration > 30s
  - BS-RoFormer:     INT8 always, NEVER chunk (internal chunking already optimal)
  - MelBand RoFormer: INT8 always, NEVER chunk

Usage:
  python test_smart_predict.py --audio /path/to/audio.mp3
  python test_smart_predict.py --audio /path/to/audio.mp3 --models demucs_htdemucs,bs_roformer
  python test_smart_predict.py --audio /path/to/audio.mp3 --output-dir /tmp/output
"""
import argparse
import gc
import os
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import soundfile as sf
import torch

os.environ["CUDA_VISIBLE_DEVICES"] = ""

# =========================================================================
# Strategy rules derived from benchmarks (60s + 5s tests)
#
#   Model             | INT8 gain | Chunk gain (long) | Chunk gain (short)
#   ------------------|-----------|-------------------|-------------------
#   demucs htdemucs   | 1.05-1.41x| 1.40x (60s)       | 1.17x (5s, overhead)
#   demucs htdemucs_ft| ~1.0x     | 1.34x (60s)       | 0.84x (5s, SLOWER)
#   bs_roformer       | 1.14-1.30x| SLOWER (padding)  | SLOWER
#   melband_roformer  | 0.99-1.18x| SLOWER (padding)  | SLOWER
# =========================================================================

STRATEGY_RULES = {
    "demucs_htdemucs": {
        "display_name": "Demucs HTDemucs",
        "type": "demucs",
        "model_id": "htdemucs",
        "use_int8": True,           # Always beneficial
        "chunk_threshold_sec": 20,  # Only chunk if audio > 20s
        "chunk_sec": 30,
        "overlap_sec": 1.0,
        "max_workers": 4,
    },
    "demucs_htdemucs_ft": {
        "display_name": "Demucs HTDemucs FT",
        "type": "demucs",
        "model_id": "htdemucs_ft",
        "use_int8": False,          # No benefit (bag of 4 models)
        "chunk_threshold_sec": 30,  # Only chunk if audio > 30s
        "chunk_sec": 30,
        "overlap_sec": 1.0,
        "max_workers": 4,
    },
    "bs_roformer": {
        "display_name": "BS-RoFormer",
        "type": "audio_separator",
        "model_id": "model_bs_roformer_ep_317_sdr_12.9755.ckpt",
        "use_int8": True,           # 1.14-1.30x speedup
        "chunk_threshold_sec": None,  # NEVER chunk (internal chunking)
        "chunk_sec": None,
        "overlap_sec": None,
        "max_workers": None,
    },
    "melband_roformer": {
        "display_name": "MelBand RoFormer",
        "type": "audio_separator",
        "model_id": "model_mel_band_roformer_ep_3005_sdr_11.4360.ckpt",
        "use_int8": True,           # Marginal but safe
        "chunk_threshold_sec": None,  # NEVER chunk
        "chunk_sec": None,
        "overlap_sec": None,
        "max_workers": None,
    },
}


# =========================================================================
# Audio I/O
# =========================================================================

def load_audio(audio_path: str) -> tuple[np.ndarray, int]:
    """Load audio file → (samples, sr). Always stereo float32."""
    data, sr = sf.read(audio_path, dtype="float32", always_2d=True)
    if data.shape[1] == 1:
        data = np.column_stack([data, data])
    elif data.shape[1] > 2:
        data = data[:, :2]
    return data, sr


def split_chunks(audio: np.ndarray, sr: int, chunk_sec: float,
                 overlap_sec: float) -> list[tuple[np.ndarray, int, int]]:
    chunk_samples = int(chunk_sec * sr)
    overlap_samples = int(overlap_sec * sr)
    step = chunk_samples - overlap_samples
    total = audio.shape[0]
    chunks = []
    start = 0
    while start < total:
        end = min(start + chunk_samples, total)
        chunks.append((audio[start:end].copy(), start, end))
        if end >= total:
            break
        start += step
    return chunks


def merge_chunks(chunks_out: list[tuple[np.ndarray, int, int]], total_samples: int,
                 channels: int, overlap_samples: int) -> np.ndarray:
    merged = np.zeros((total_samples, channels), dtype=np.float32)
    weight = np.zeros(total_samples, dtype=np.float32)
    for chunk_audio, start, end in chunks_out:
        chunk_len = end - start
        if chunk_audio.shape[0] > chunk_len:
            chunk_audio = chunk_audio[:chunk_len]
        elif chunk_audio.shape[0] < chunk_len:
            pad = np.zeros((chunk_len - chunk_audio.shape[0], channels), dtype=np.float32)
            chunk_audio = np.concatenate([chunk_audio, pad])
        w = np.ones(chunk_len, dtype=np.float32)
        if overlap_samples > 0 and start > 0:
            ramp_len = min(overlap_samples, chunk_len)
            w[:ramp_len] = np.linspace(0, 1, ramp_len)
        if overlap_samples > 0 and end < total_samples:
            ramp_len = min(overlap_samples, chunk_len)
            w[-ramp_len:] = np.linspace(1, 0, ramp_len)
        merged[start:start + chunk_len] += chunk_audio * w[:, None]
        weight[start:start + chunk_len] += w
    mask = weight > 0
    merged[mask] /= weight[mask, None]
    return merged


# =========================================================================
# Model loaders
# =========================================================================

_model_cache = {}


def _load_demucs(model_id: str, use_int8: bool):
    key = ("demucs", model_id, use_int8)
    if key in _model_cache:
        return _model_cache[key]
    from demucs.pretrained import get_model
    from demucs.apply import apply_model
    model = get_model(model_id)
    model.cpu().eval()
    if use_int8:
        model = torch.quantization.quantize_dynamic(
            model, {torch.nn.Linear, torch.nn.LSTM}, dtype=torch.qint8
        )
    _model_cache[key] = (model, apply_model)
    return model, apply_model


def _load_separator(model_id: str, use_int8: bool):
    key = ("sep", model_id, use_int8)
    if key in _model_cache:
        return _model_cache[key]
    from audio_separator.separator import Separator
    sep = Separator(output_format="WAV", log_level=40)
    sep.load_model(model_id)
    if use_int8 and hasattr(sep, "model_instance"):
        mi = sep.model_instance
        if hasattr(mi, "model_run") and isinstance(mi.model_run, torch.nn.Module):
            mi.model_run = torch.quantization.quantize_dynamic(
                mi.model_run, {torch.nn.Linear}, dtype=torch.qint8
            )
    _model_cache[key] = sep
    return sep


# =========================================================================
# Inference runners
# =========================================================================

def _run_demucs(model, apply_fn, audio: np.ndarray, sr: int) -> dict[str, np.ndarray]:
    """Returns dict with 'vocals' and 'instrumental' arrays (samples, channels)."""
    waveform = torch.from_numpy(audio.T).float().unsqueeze(0)
    with torch.no_grad():
        sources = apply_fn(model, waveform, device=torch.device("cpu"))
    sources = sources.squeeze(0).numpy()
    source_map = {name: idx for idx, name in enumerate(model.sources)}
    vocals = sources[source_map["vocals"]].T[:audio.shape[0]]
    # Instrumental = everything except vocals
    inst_parts = [sources[idx].T[:audio.shape[0]]
                  for name, idx in source_map.items() if name != "vocals"]
    instrumental = sum(inst_parts)
    return {"vocals": vocals, "instrumental": instrumental}


def _run_separator(sep, audio: np.ndarray, sr: int) -> dict[str, np.ndarray]:
    """Returns dict with 'vocals' and 'instrumental' arrays."""
    MIN_SAMPLES = int(352800 * sr / 44100)
    original_len = audio.shape[0]
    if audio.shape[0] < MIN_SAMPLES:
        audio = np.pad(audio, ((0, MIN_SAMPLES - audio.shape[0]), (0, 0)), mode="constant")

    with tempfile.TemporaryDirectory(prefix="smart_") as tmpdir:
        input_path = os.path.join(tmpdir, "input.wav")
        sf.write(input_path, audio, sr)
        sep.output_dir = tmpdir
        output_files = sep.separate(input_path)

        result = {}
        for f in output_files:
            fname = os.path.basename(f).lower()
            data, _ = sf.read(f, dtype="float32", always_2d=True)
            data = data[:original_len]
            if "vocal" in fname and "no_vocal" not in fname and "instrument" not in fname:
                result["vocals"] = data
            elif "instrument" in fname or "no_vocal" in fname or "accompaniment" in fname:
                result["instrumental"] = data

        if "vocals" not in result and len(output_files) >= 2:
            for i, f in enumerate(output_files):
                data, _ = sf.read(f, dtype="float32", always_2d=True)
                data = data[:original_len]
                if i == 0:
                    result["vocals"] = data
                else:
                    result["instrumental"] = data

        return result


# =========================================================================
# Smart predict
# =========================================================================

def smart_predict(model_key: str, audio: np.ndarray, sr: int,
                  output_dir: str = None) -> dict:
    """
    Auto-select optimal CPU strategy and run separation.

    Returns:
        {
            "model": str,
            "strategy": str,        # e.g. "INT8 + chunked (30s, 4 workers)"
            "duration_sec": float,
            "inference_sec": float,
            "realtime_factor": float,
            "vocals_path": str | None,
            "instrumental_path": str | None,
        }
    """
    rule = STRATEGY_RULES[model_key]
    duration = audio.shape[0] / sr
    use_int8 = rule["use_int8"]

    # Decide: chunk or full?
    use_chunking = False
    if rule["chunk_threshold_sec"] is not None and duration > rule["chunk_threshold_sec"]:
        use_chunking = True

    # Build strategy description
    parts = []
    if use_int8:
        parts.append("INT8")
    else:
        parts.append("FP32")
    if use_chunking:
        parts.append(f"chunked ({rule['chunk_sec']}s, {rule['max_workers']} workers)")
    else:
        parts.append("full-audio")
    strategy = " + ".join(parts)

    print(f"  Strategy: {strategy}")

    # Load model
    t_load = time.perf_counter()
    if rule["type"] == "demucs":
        model, apply_fn = _load_demucs(rule["model_id"], use_int8)
    else:
        sep = _load_separator(rule["model_id"], use_int8)
    t_load = time.perf_counter() - t_load

    # Run inference
    t0 = time.perf_counter()

    if rule["type"] == "demucs":
        if use_chunking:
            chunks = split_chunks(audio, sr, rule["chunk_sec"], rule["overlap_sec"])
            overlap_samples = int(rule["overlap_sec"] * sr)

            def process_both(chunk_info):
                chunk_audio, start, end = chunk_info
                res = _run_demucs(model, apply_fn, chunk_audio, sr)
                return {"vocals": (res["vocals"], start, end),
                        "instrumental": (res["instrumental"], start, end)}

            with ThreadPoolExecutor(max_workers=rule["max_workers"]) as pool:
                both_results = list(pool.map(process_both, chunks))

            vocal_chunks = [r["vocals"] for r in both_results]
            inst_chunks = [r["instrumental"] for r in both_results]

            stems = {
                "vocals": merge_chunks(vocal_chunks, audio.shape[0], audio.shape[1], overlap_samples),
                "instrumental": merge_chunks(inst_chunks, audio.shape[0], audio.shape[1], overlap_samples),
            }
        else:
            stems = _run_demucs(model, apply_fn, audio, sr)
    else:
        stems = _run_separator(sep, audio, sr)

    inference_sec = time.perf_counter() - t0
    rt_factor = duration / inference_sec if inference_sec > 0 else 0

    # Save output
    vocals_path = None
    instrumental_path = None
    if output_dir:
        out = Path(output_dir) / model_key
        out.mkdir(parents=True, exist_ok=True)
        if "vocals" in stems:
            vocals_path = str(out / "vocals.wav")
            sf.write(vocals_path, stems["vocals"], sr)
        if "instrumental" in stems:
            instrumental_path = str(out / "instrumental.wav")
            sf.write(instrumental_path, stems["instrumental"], sr)

    return {
        "model": model_key,
        "display_name": rule["display_name"],
        "strategy": strategy,
        "duration_sec": duration,
        "load_sec": t_load,
        "inference_sec": inference_sec,
        "realtime_factor": rt_factor,
        "vocals_path": vocals_path,
        "instrumental_path": instrumental_path,
    }


# =========================================================================
# Main
# =========================================================================

def main():
    parser = argparse.ArgumentParser(description="Smart CPU Inference Benchmark")
    parser.add_argument("--audio", type=str, required=True, help="Path to audio file")
    parser.add_argument("--models", type=str, default=None,
                        help="Comma-separated model keys (default: all)")
    parser.add_argument("--output-dir", type=str, default=None,
                        help="Save separated stems to this directory")
    parser.add_argument("--compare-baseline", action="store_true",
                        help="Also run baseline (no optimization) for comparison")
    args = parser.parse_args()

    if not os.path.exists(args.audio):
        print(f"ERROR: Audio file not found: {args.audio}")
        sys.exit(1)

    audio, sr = load_audio(args.audio)
    duration = audio.shape[0] / sr

    sep_line = "=" * 80
    print(sep_line)
    print("  SMART CPU INFERENCE")
    print(sep_line)
    print(f"  Audio: {args.audio}")
    print(f"  Duration: {duration:.1f}s | SR: {sr} | Channels: {audio.shape[1]}")
    print(f"  Device: CPU | Torch threads: {torch.get_num_threads()}")
    print(f"  PyTorch: {torch.__version__}")
    if args.output_dir:
        print(f"  Output: {args.output_dir}")
    print()

    model_keys = (
        [m.strip() for m in args.models.split(",")]
        if args.models
        else list(STRATEGY_RULES.keys())
    )

    results = []

    for model_key in model_keys:
        if model_key not in STRATEGY_RULES:
            print(f"  WARNING: Unknown model '{model_key}', skipping\n")
            continue

        rule = STRATEGY_RULES[model_key]
        print(f"  [{model_key}] {rule['display_name']}")

        # --- Baseline (optional) ---
        baseline_sec = None
        if args.compare_baseline:
            print(f"  Strategy: FP32 + full-audio (baseline)")
            _model_cache.clear()
            gc.collect()

            t0 = time.perf_counter()
            if rule["type"] == "demucs":
                model, apply_fn = _load_demucs(rule["model_id"], use_int8=False)
                _run_demucs(model, apply_fn, audio, sr)
            else:
                sep_model = _load_separator(rule["model_id"], use_int8=False)
                _run_separator(sep_model, audio, sr)
            baseline_sec = time.perf_counter() - t0
            print(f"  Baseline: {baseline_sec:.2f}s ({duration/baseline_sec:.2f}x RT)")

            _model_cache.clear()
            gc.collect()

        # --- Smart predict ---
        result = smart_predict(model_key, audio, sr, args.output_dir)
        results.append(result)

        line = f"  Result:  {result['inference_sec']:.2f}s ({result['realtime_factor']:.2f}x RT)"
        if baseline_sec:
            speedup = baseline_sec / result["inference_sec"]
            line += f" | vs baseline: {speedup:.2f}x faster"
            result["baseline_sec"] = baseline_sec
            result["speedup"] = speedup

        print(line)
        if result.get("vocals_path"):
            print(f"  Output:  {result['vocals_path']}")
            print(f"           {result['instrumental_path']}")
        print()

        _model_cache.clear()
        gc.collect()

    # Summary
    print(sep_line)
    print("  RESULTS SUMMARY")
    print(sep_line)
    print()

    header = f"  {'Model':<25s} | {'Strategy':<30s} | {'Time':>8s} | {'RT':>7s}"
    if args.compare_baseline:
        header += f" | {'Baseline':>8s} | {'Speedup':>7s}"
    print(header)
    print(f"  {'-'*25}-+-{'-'*30}-+-{'-'*8}-+-{'-'*7}", end="")
    if args.compare_baseline:
        print(f"-+-{'-'*8}-+-{'-'*7}", end="")
    print()

    for r in results:
        line = (f"  {r['display_name']:<25s} | {r['strategy']:<30s} | "
                f"{r['inference_sec']:>6.2f}s | {r['realtime_factor']:>5.2f}x")
        if args.compare_baseline and "baseline_sec" in r:
            line += f" | {r['baseline_sec']:>6.2f}s | {r['speedup']:>5.2f}x"
        print(line)

    print()
    print(sep_line)

    # Save results
    import json
    results_path = Path(__file__).parent / "smart_predict_results.json"
    results_path.write_text(json.dumps({
        "audio_file": args.audio,
        "audio_duration_sec": duration,
        "torch_version": torch.__version__,
        "torch_threads": torch.get_num_threads(),
        "results": results,
    }, indent=2, default=str))
    print(f"  Results saved to: {results_path}")


if __name__ == "__main__":
    main()
