"""
Test 4 models via model-serving API on CPU and GPU.
Compares inference time and verifies output correctness.
"""
import io
import os
import sys
import time
import json
import zipfile
import tempfile
import subprocess
import signal

import httpx
import soundfile as sf
import numpy as np

AUDIO_PATH = "/home/watercry/Disk_C/Data/audio-separation/data/test_audio/test_5s.mp3"
MODELS = ["demucs", "demucs_ft", "bs_roformer", "melband_roformer"]
MODEL_SERVING_DIR = "/home/watercry/Disk_C/Data/audio-separation/backend/model_serving"


def test_predict(url: str, model: str, audio_path: str) -> dict:
    """POST to /predict and return timing + output info."""
    with open(audio_path, "rb") as f:
        audio_data = f.read()

    start = time.perf_counter()
    with httpx.Client(timeout=600.0) as client:
        resp = client.post(
            f"{url}/predict",
            params={"model": model},
            files={"file": ("test_5s.mp3", audio_data, "audio/mpeg")},
        )
    elapsed = time.perf_counter() - start

    if resp.status_code != 200:
        return {
            "model": model,
            "status": "FAILED",
            "error": resp.text[:200],
            "time_sec": elapsed,
        }

    # Verify ZIP contents
    try:
        zf = zipfile.ZipFile(io.BytesIO(resp.content))
        names = zf.namelist()
        has_vocals = "vocals.wav" in names
        has_instrumental = "instrumental.wav" in names

        # Read and check audio quality
        vocals_info = {}
        inst_info = {}
        if has_vocals:
            with zf.open("vocals.wav") as vf:
                data, sr = sf.read(io.BytesIO(vf.read()), dtype="float32")
                vocals_info = {
                    "samples": data.shape[0],
                    "channels": data.shape[1] if data.ndim > 1 else 1,
                    "sr": sr,
                    "duration_sec": round(data.shape[0] / sr, 2),
                    "max_abs": round(float(np.max(np.abs(data))), 4),
                    "rms": round(float(np.sqrt(np.mean(data**2))), 4),
                }
        if has_instrumental:
            with zf.open("instrumental.wav") as inf:
                data, sr = sf.read(io.BytesIO(inf.read()), dtype="float32")
                inst_info = {
                    "samples": data.shape[0],
                    "channels": data.shape[1] if data.ndim > 1 else 1,
                    "sr": sr,
                    "duration_sec": round(data.shape[0] / sr, 2),
                    "max_abs": round(float(np.max(np.abs(data))), 4),
                    "rms": round(float(np.sqrt(np.mean(data**2))), 4),
                }

        return {
            "model": model,
            "status": "OK",
            "time_sec": round(elapsed, 2),
            "zip_size_kb": round(len(resp.content) / 1024, 1),
            "files": names,
            "has_vocals": has_vocals,
            "has_instrumental": has_instrumental,
            "vocals": vocals_info,
            "instrumental": inst_info,
        }
    except Exception as e:
        return {
            "model": model,
            "status": "ZIP_ERROR",
            "error": str(e),
            "time_sec": round(elapsed, 2),
        }


def get_health(url: str) -> dict:
    try:
        resp = httpx.get(f"{url}/health", timeout=10)
        return resp.json()
    except Exception as e:
        return {"error": str(e)}


def start_server_cpu(port: int = 8002) -> subprocess.Popen:
    """Start model-serving on CPU (separate port)."""
    env = os.environ.copy()
    env["CUDA_VISIBLE_DEVICES"] = ""
    env["LOAD_MODELS"] = "all"
    env["MODEL_DIR"] = os.path.expanduser("~/.cache/torch")
    env["LOG_LEVEL"] = "INFO"

    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app",
         "--host", "0.0.0.0", "--port", str(port),
         "--workers", "1"],
        cwd=MODEL_SERVING_DIR,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    return proc


def wait_for_server(url: str, timeout: int = 600) -> bool:
    """Wait for server to become healthy with all models loaded."""
    start = time.time()
    while time.time() - start < timeout:
        try:
            resp = httpx.get(f"{url}/health", timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                loaded = data.get("loaded_models", [])
                print(f"  ... loaded models: {loaded}")
                if len(loaded) >= 4:
                    return True
        except Exception:
            pass
        time.sleep(5)
    return False


def print_results(title: str, results: list[dict]):
    print(f"\n{'=' * 70}")
    print(f"  {title}")
    print(f"{'=' * 70}")
    for r in results:
        status = r["status"]
        model = r["model"]
        t = r["time_sec"]
        if status == "OK":
            v = r.get("vocals", {})
            dur = v.get("duration_sec", "?")
            rms = v.get("rms", "?")
            print(f"  {model:<22} {t:>7.2f}s  OK  (vocal dur={dur}s, rms={rms})")
        else:
            err = r.get("error", "unknown")
            print(f"  {model:<22} {t:>7.2f}s  {status}: {err[:60]}")


def main():
    print(f"Audio: {AUDIO_PATH}")
    print(f"Models: {MODELS}")

    # ── Phase 1: Test GPU server (already running on :8001) ──
    gpu_url = "http://localhost:8001"
    print(f"\n--- GPU server at {gpu_url} ---")
    health = get_health(gpu_url)
    print(f"Health: {json.dumps(health, indent=2)}")

    gpu_results = []
    for model in MODELS:
        print(f"  Testing {model} on GPU...")
        result = test_predict(gpu_url, model, AUDIO_PATH)
        gpu_results.append(result)
        print(f"    → {result['status']} in {result['time_sec']}s")

    print_results("GPU Results (RTX 3060)", gpu_results)

    # ── Phase 2: Start CPU server on :8002 ──
    cpu_url = "http://localhost:8002"
    print(f"\n--- Starting CPU server at {cpu_url} ---")
    print("  Loading all 4 models on CPU with optimizations (this takes a while)...")

    cpu_proc = start_server_cpu(port=8002)
    try:
        if not wait_for_server(cpu_url, timeout=600):
            # Print server output for debugging
            cpu_proc.terminate()
            cpu_proc.wait(timeout=10)
            stdout = cpu_proc.stdout.read().decode() if cpu_proc.stdout else ""
            print(f"  FAILED to start CPU server. Output:\n{stdout[-2000:]}")
            return

        health = get_health(cpu_url)
        print(f"Health: {json.dumps(health, indent=2)}")

        cpu_results = []
        for model in MODELS:
            print(f"  Testing {model} on CPU...")
            result = test_predict(cpu_url, model, AUDIO_PATH)
            cpu_results.append(result)
            print(f"    → {result['status']} in {result['time_sec']}s")

        print_results("CPU Results (INT8 optimized)", cpu_results)

    finally:
        print("\n  Stopping CPU server...")
        cpu_proc.terminate()
        try:
            cpu_proc.wait(timeout=15)
        except subprocess.TimeoutExpired:
            cpu_proc.kill()
            cpu_proc.wait()
        print("  CPU server stopped.")

    # ── Phase 3: Comparison table ──
    print(f"\n{'=' * 70}")
    print(f"  COMPARISON: GPU vs CPU (optimized)")
    print(f"{'=' * 70}")
    print(f"  {'Model':<22} {'GPU':>8} {'CPU':>8} {'GPU/CPU':>8}  {'Status'}")
    print(f"  {'-'*22} {'-'*8} {'-'*8} {'-'*8}  {'-'*10}")

    for gpu_r, cpu_r in zip(gpu_results, cpu_results):
        model = gpu_r["model"]
        gpu_t = gpu_r["time_sec"]
        cpu_t = cpu_r["time_sec"]
        ratio = f"{gpu_t/cpu_t:.2f}x" if cpu_t > 0 else "N/A"
        gpu_s = gpu_r["status"]
        cpu_s = cpu_r["status"]
        status = f"GPU={gpu_s}, CPU={cpu_s}"
        print(f"  {model:<22} {gpu_t:>7.2f}s {cpu_t:>7.2f}s {ratio:>8}  {status}")

    # Save results
    results_file = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "api_benchmark_results.json"
    )
    with open(results_file, "w") as f:
        json.dump({
            "audio": AUDIO_PATH,
            "gpu_results": gpu_results,
            "cpu_results": cpu_results,
        }, f, indent=2)
    print(f"\nResults saved to {results_file}")


if __name__ == "__main__":
    main()
