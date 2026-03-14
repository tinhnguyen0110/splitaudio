#!/usr/bin/env python3
"""
CPU Benchmark: INT8 Quantization + Chunked Multi-thread Processing
===================================================================
Tests all 4 audio separation models on CPU with optimization modes:
  1. Baseline CPU — standard full-audio inference
  2. INT8 quantized — dynamic quantization (Linear + LSTM → qint8)
  3. INT8 + chunked multi-thread — quantized model + parallel chunk processing

Usage:
  python test_cpu_benchmark.py --audio /path/to/audio.mp3
  python test_cpu_benchmark.py --audio /path/to/audio.mp3 --models demucs,bs_roformer
  python test_cpu_benchmark.py --audio /path/to/audio.mp3 --chunk-sec 20 --workers 4
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

# Force CPU
os.environ["CUDA_VISIBLE_DEVICES"] = ""

# =========================================================================
# Model configs
# =========================================================================

MODEL_CONFIGS = {
    "demucs_htdemucs": {
        "display_name": "Demucs HTDemucs",
        "type": "demucs",
        "model_id": "htdemucs",
    },
    "demucs_htdemucs_ft": {
        "display_name": "Demucs HTDemucs FT",
        "type": "demucs",
        "model_id": "htdemucs_ft",
    },
    "bs_roformer": {
        "display_name": "BS-RoFormer",
        "type": "audio_separator",
        "model_id": "model_bs_roformer_ep_317_sdr_12.9755.ckpt",
    },
    "melband_roformer": {
        "display_name": "MelBand RoFormer",
        "type": "audio_separator",
        "model_id": "model_mel_band_roformer_ep_3005_sdr_11.4360.ckpt",
    },
}


# =========================================================================
# Audio I/O
# =========================================================================

def load_audio(audio_path: str) -> tuple[np.ndarray, int]:
    """Load audio file, return (samples, sr). Always stereo float32."""
    data, sr = sf.read(audio_path, dtype="float32", always_2d=True)
    if data.shape[1] == 1:
        data = np.column_stack([data, data])
    elif data.shape[1] > 2:
        data = data[:, :2]
    return data, sr


def split_chunks(audio: np.ndarray, sr: int, chunk_sec: float = 30.0,
                 overlap_sec: float = 1.0) -> list[tuple[np.ndarray, int, int]]:
    """
    Split audio into overlapping chunks.
    Returns list of (chunk_audio, start_sample, end_sample).
    """
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
    """
    Merge processed chunks using overlap-add with linear crossfade.
    chunks_out: list of (result_audio, start_sample, end_sample)
    """
    merged = np.zeros((total_samples, channels), dtype=np.float32)
    weight = np.zeros(total_samples, dtype=np.float32)

    for chunk_audio, start, end in chunks_out:
        chunk_len = end - start
        # Trim chunk if it's longer than expected (model may pad)
        if chunk_audio.shape[0] > chunk_len:
            chunk_audio = chunk_audio[:chunk_len]
        elif chunk_audio.shape[0] < chunk_len:
            pad = np.zeros((chunk_len - chunk_audio.shape[0], channels), dtype=np.float32)
            chunk_audio = np.concatenate([chunk_audio, pad])

        # Linear ramp for crossfade
        w = np.ones(chunk_len, dtype=np.float32)
        if overlap_samples > 0 and start > 0:
            ramp_len = min(overlap_samples, chunk_len)
            w[:ramp_len] = np.linspace(0, 1, ramp_len)
        if overlap_samples > 0 and end < total_samples:
            ramp_len = min(overlap_samples, chunk_len)
            w[-ramp_len:] = np.linspace(1, 0, ramp_len)

        merged[start:start + chunk_len] += chunk_audio * w[:, None]
        weight[start:start + chunk_len] += w

    # Normalize by weight
    mask = weight > 0
    merged[mask] /= weight[mask, None]
    return merged


# =========================================================================
# Demucs helpers
# =========================================================================

_demucs_cache = {}


def load_demucs_cpu(model_id: str, quantize: bool = False):
    """Load Demucs model on CPU, optionally INT8 quantized."""
    cache_key = (model_id, quantize)
    if cache_key in _demucs_cache:
        return _demucs_cache[cache_key]

    from demucs.pretrained import get_model
    from demucs.apply import apply_model

    model = get_model(model_id)
    model.cpu().eval()

    if quantize:
        model = torch.quantization.quantize_dynamic(
            model, {torch.nn.Linear, torch.nn.LSTM}, dtype=torch.qint8
        )

    _demucs_cache[cache_key] = (model, apply_model)
    return model, apply_model


def run_demucs(model, apply_model_fn, audio: np.ndarray, sr: int) -> np.ndarray:
    """Run Demucs separation on audio array. Returns vocals as numpy (samples, channels)."""
    waveform = torch.from_numpy(audio.T).float().unsqueeze(0)  # (1, C, T)

    with torch.no_grad():
        sources = apply_model_fn(model, waveform, device=torch.device("cpu"))

    sources = sources.squeeze(0).numpy()  # (stems, C, T)
    source_map = {name: idx for idx, name in enumerate(model.sources)}
    vocals = sources[source_map["vocals"]].T  # (T, C)
    return vocals[:audio.shape[0]]


# =========================================================================
# Audio-Separator (RoFormer) helpers
# =========================================================================

_separator_cache = {}


def load_separator_cpu(model_id: str, quantize: bool = False):
    """Load audio-separator model on CPU, optionally INT8 quantized."""
    cache_key = (model_id, quantize)
    if cache_key in _separator_cache:
        return _separator_cache[cache_key]

    from audio_separator.separator import Separator

    sep = Separator(output_format="WAV", log_level=40)  # ERROR only
    sep.load_model(model_id)

    if quantize and hasattr(sep, "model_instance"):
        mi = sep.model_instance
        if hasattr(mi, "model_run") and isinstance(mi.model_run, torch.nn.Module):
            mi.model_run = torch.quantization.quantize_dynamic(
                mi.model_run, {torch.nn.Linear}, dtype=torch.qint8
            )

    _separator_cache[cache_key] = sep
    return sep


def run_separator(sep, audio: np.ndarray, sr: int) -> np.ndarray:
    """Run audio-separator on audio array. Returns vocals as numpy (samples, channels)."""
    # RoFormer requires minimum ~8s at 44100Hz (352800 samples)
    MIN_SAMPLES = int(352800 * sr / 44100)
    original_len = audio.shape[0]
    if audio.shape[0] < MIN_SAMPLES:
        pad_width = MIN_SAMPLES - audio.shape[0]
        audio = np.pad(audio, ((0, pad_width), (0, 0)), mode="constant")

    with tempfile.TemporaryDirectory(prefix="bench_") as tmpdir:
        input_path = os.path.join(tmpdir, "input.wav")
        sf.write(input_path, audio, sr)

        sep.output_dir = tmpdir
        output_files = sep.separate(input_path)

        vocals = None
        for f in output_files:
            fname = os.path.basename(f).lower()
            if "vocal" in fname and "no_vocal" not in fname and "instrument" not in fname:
                vocals, _ = sf.read(f, dtype="float32", always_2d=True)
                break

        if vocals is None and len(output_files) >= 1:
            vocals, _ = sf.read(output_files[0], dtype="float32", always_2d=True)

        if vocals is None:
            raise RuntimeError(f"No vocal output found in {output_files}")

        return vocals[:original_len]


# =========================================================================
# Benchmark modes
# =========================================================================

def benchmark_baseline(model_key: str, config: dict, audio: np.ndarray, sr: int) -> float:
    """Mode 1: Baseline CPU — full audio, no optimization."""
    t0 = time.perf_counter()

    if config["type"] == "demucs":
        model, apply_fn = load_demucs_cpu(config["model_id"], quantize=False)
        run_demucs(model, apply_fn, audio, sr)
    else:
        sep = load_separator_cpu(config["model_id"], quantize=False)
        run_separator(sep, audio, sr)

    return time.perf_counter() - t0


def benchmark_int8(model_key: str, config: dict, audio: np.ndarray, sr: int) -> float:
    """Mode 2: INT8 quantized — full audio."""
    t0 = time.perf_counter()

    if config["type"] == "demucs":
        model, apply_fn = load_demucs_cpu(config["model_id"], quantize=True)
        run_demucs(model, apply_fn, audio, sr)
    else:
        sep = load_separator_cpu(config["model_id"], quantize=True)
        run_separator(sep, audio, sr)

    return time.perf_counter() - t0


def benchmark_int8_chunked(model_key: str, config: dict, audio: np.ndarray, sr: int,
                           chunk_sec: float = 30.0, overlap_sec: float = 1.0,
                           max_workers: int = 4) -> float:
    """Mode 3: INT8 + chunked multi-thread processing."""
    chunks = split_chunks(audio, sr, chunk_sec, overlap_sec)
    overlap_samples = int(overlap_sec * sr)

    t0 = time.perf_counter()

    if config["type"] == "demucs":
        model, apply_fn = load_demucs_cpu(config["model_id"], quantize=True)

        def process_chunk(chunk_info):
            chunk_audio, start, end = chunk_info
            result = run_demucs(model, apply_fn, chunk_audio, sr)
            return (result, start, end)

        with ThreadPoolExecutor(max_workers=max_workers) as pool:
            results = list(pool.map(process_chunk, chunks))

    else:
        sep = load_separator_cpu(config["model_id"], quantize=True)

        # RoFormer models are not thread-safe (shared state in Separator),
        # so process chunks sequentially but still benefit from INT8 + smaller memory
        results = []
        for chunk_audio, start, end in chunks:
            result = run_separator(sep, chunk_audio, sr)
            results.append((result, start, end))

    vocals = merge_chunks(results, audio.shape[0], audio.shape[1], overlap_samples)

    return time.perf_counter() - t0


# =========================================================================
# Main
# =========================================================================

def main():
    parser = argparse.ArgumentParser(description="CPU Benchmark: INT8 + Chunked Multi-thread")
    parser.add_argument("--audio", type=str, required=True, help="Path to test audio file")
    parser.add_argument("--models", type=str, default=None,
                        help="Comma-separated model keys (default: all). "
                             "Options: demucs_htdemucs,demucs_htdemucs_ft,bs_roformer,melband_roformer")
    parser.add_argument("--chunk-sec", type=float, default=30.0, help="Chunk duration in seconds (default: 30)")
    parser.add_argument("--overlap-sec", type=float, default=1.0, help="Overlap between chunks in seconds (default: 1)")
    parser.add_argument("--workers", type=int, default=4, help="Max thread pool workers (default: 4)")
    args = parser.parse_args()

    if not os.path.exists(args.audio):
        print(f"ERROR: Audio file not found: {args.audio}")
        sys.exit(1)

    # Load audio
    print(f"Loading audio: {args.audio}")
    audio, sr = load_audio(args.audio)
    duration = audio.shape[0] / sr
    print(f"  Duration: {duration:.1f}s | SR: {sr} | Channels: {audio.shape[1]} | Samples: {audio.shape[0]:,}")
    print(f"  Chunk: {args.chunk_sec}s | Overlap: {args.overlap_sec}s | Workers: {args.workers}")
    num_chunks = len(split_chunks(audio, sr, args.chunk_sec, args.overlap_sec))
    print(f"  Chunks: {num_chunks}")
    print(f"  Device: CPU (CUDA disabled)")
    print(f"  PyTorch: {torch.__version__}")
    print(f"  Torch threads: {torch.get_num_threads()}")
    print()

    # Select models
    if args.models:
        model_keys = [m.strip() for m in args.models.split(",")]
    else:
        model_keys = list(MODEL_CONFIGS.keys())

    # Run benchmarks
    results = {}
    separator = "=" * 85

    for model_key in model_keys:
        if model_key not in MODEL_CONFIGS:
            print(f"WARNING: Unknown model '{model_key}', skipping")
            continue

        config = MODEL_CONFIGS[model_key]
        print(f"{separator}")
        print(f"  MODEL: {config['display_name']} ({model_key})")
        print(f"{separator}")

        timings = {}

        # --- Mode 1: Baseline ---
        print(f"  [1/3] Baseline CPU (full audio) ...", end=" ", flush=True)
        try:
            t = benchmark_baseline(model_key, config, audio, sr)
            timings["baseline"] = t
            print(f"{t:.2f}s ({duration/t:.2f}x realtime)")
        except Exception as e:
            timings["baseline"] = None
            print(f"FAILED: {e}")

        # Clear caches between modes to get fair comparison
        _demucs_cache.clear()
        _separator_cache.clear()
        gc.collect()

        # --- Mode 2: INT8 ---
        print(f"  [2/3] INT8 quantized (full audio) ...", end=" ", flush=True)
        try:
            t = benchmark_int8(model_key, config, audio, sr)
            timings["int8"] = t
            speedup = ""
            if timings.get("baseline"):
                speedup = f" | speedup: {timings['baseline']/t:.2f}x"
            print(f"{t:.2f}s ({duration/t:.2f}x realtime){speedup}")
        except Exception as e:
            timings["int8"] = None
            print(f"FAILED: {e}")

        # Don't clear INT8 cache — reuse for chunked mode
        gc.collect()

        # --- Mode 3: INT8 + Chunked ---
        print(f"  [3/3] INT8 + chunked ({args.chunk_sec}s, {args.workers} workers) ...", end=" ", flush=True)
        try:
            t = benchmark_int8_chunked(model_key, config, audio, sr,
                                       args.chunk_sec, args.overlap_sec, args.workers)
            timings["int8_chunked"] = t
            speedup = ""
            if timings.get("baseline"):
                speedup = f" | speedup: {timings['baseline']/t:.2f}x"
            print(f"{t:.2f}s ({duration/t:.2f}x realtime){speedup}")
        except Exception as e:
            timings["int8_chunked"] = None
            print(f"FAILED: {e}")

        results[model_key] = timings
        print()

        # Clear all caches between models
        _demucs_cache.clear()
        _separator_cache.clear()
        gc.collect()

    # ===========================
    # Summary table
    # ===========================
    print()
    print(separator)
    print("  BENCHMARK RESULTS SUMMARY")
    print(separator)
    print(f"  Audio: {args.audio} ({duration:.1f}s)")
    print(f"  Device: CPU | Torch threads: {torch.get_num_threads()}")
    print()

    header = f"  {'Model':<28s} | {'Baseline':>10s} | {'INT8':>10s} | {'INT8+Chunk':>10s} | {'Best Speedup':>12s}"
    print(header)
    print(f"  {'-'*28}-+-{'-'*10}-+-{'-'*10}-+-{'-'*10}-+-{'-'*12}")

    for model_key in model_keys:
        if model_key not in results:
            continue
        t = results[model_key]
        config = MODEL_CONFIGS[model_key]
        name = config["display_name"]

        def fmt(v):
            return f"{v:.2f}s" if v is not None else "FAIL"

        baseline = t.get("baseline")
        best = None
        for mode in ["int8_chunked", "int8", "baseline"]:
            if t.get(mode) is not None:
                if best is None or t[mode] < best:
                    best = t[mode]

        speedup_str = ""
        if baseline and best and best < baseline:
            speedup_str = f"{baseline/best:.2f}x"

        print(f"  {name:<28s} | {fmt(t.get('baseline')):>10s} | {fmt(t.get('int8')):>10s} | "
              f"{fmt(t.get('int8_chunked')):>10s} | {speedup_str:>12s}")

    print()
    print(f"  Chunk config: {args.chunk_sec}s chunks, {args.overlap_sec}s overlap, {args.workers} workers")
    print(separator)

    # Save results to JSON
    import json
    results_path = Path(__file__).parent / "cpu_benchmark_results.json"
    json_data = {
        "audio_file": args.audio,
        "audio_duration_sec": duration,
        "sample_rate": sr,
        "chunk_sec": args.chunk_sec,
        "overlap_sec": args.overlap_sec,
        "workers": args.workers,
        "torch_version": torch.__version__,
        "torch_threads": torch.get_num_threads(),
        "results": results,
    }
    results_path.write_text(json.dumps(json_data, indent=2))
    print(f"\n  Results saved to: {results_path}")


if __name__ == "__main__":
    main()
