"""
Comprehensive benchmark: 3 audio files × GPU/CPU × model-serving direct + API E2E
Tests both manual and Docker deployments.
"""
import time
import sys
import json
import httpx

MS_URL = "http://localhost:8001"
API_URL = "http://localhost:8000"
AUDIOS = {
    "5s": "/home/watercry/Disk_C/Data/audio-separation/data/test_audio/test_5s.mp3",
    "30s": "/home/watercry/Disk_C/Data/audio-separation/data/test_audio/test_30s.mp3",
    "60s": "/home/watercry/Disk_C/Data/audio-separation/data/test_audio/part1.mp3",
}
# GPU: all 4 models. CPU: only demucs (roformer disabled on CPU)
GPU_MODELS = ["demucs", "demucs_ft", "bs_roformer", "melband_roformer"]
CPU_MODELS = ["demucs", "demucs_ft"]


def load_audio():
    data = {}
    for label, path in AUDIOS.items():
        with open(path, "rb") as f:
            data[label] = f.read()
    return data


def test_model_serving(url, model, device, audio_data, timeout=600):
    """Direct model-serving /predict call."""
    t0 = time.perf_counter()
    try:
        r = httpx.post(
            f"{url}/predict",
            params={"model": model, "device": device},
            files={"file": ("test.mp3", audio_data, "audio/mpeg")},
            timeout=timeout,
        )
        t = time.perf_counter() - t0
        return t, "OK" if r.status_code == 200 else f"FAIL({r.status_code})"
    except Exception as e:
        return time.perf_counter() - t0, f"ERR:{str(e)[:30]}"


def get_api_token(api_url):
    """Register or login to get auth token."""
    with httpx.Client(timeout=30) as c:
        r = c.post(f"{api_url}/api/v1/auth/register",
                   json={"email": "bench99@t.com", "password": "bench1234", "username": "bench99"})
        if r.status_code in (200, 201):
            return r.json()["access_token"]
        r = c.post(f"{api_url}/api/v1/auth/login",
                   json={"email": "bench99@t.com", "password": "bench1234"})
        if r.status_code == 200:
            return r.json()["access_token"]
    return None


def test_api_e2e(api_url, token, model, device, audio_data, timeout=300):
    """Full API E2E: submit → poll status → completed."""
    h = {"Authorization": f"Bearer {token}"}
    t0 = time.perf_counter()
    try:
        r = httpx.post(
            f"{api_url}/api/v1/separate",
            params={"model": model, "device": device},
            files={"file": ("test.mp3", audio_data, "audio/mpeg")},
            headers=h, timeout=30,
        )
        if r.status_code != 202:
            return time.perf_counter() - t0, f"SUBMIT_{r.status_code}"
        task_id = r.json()["task_id"]
        while time.perf_counter() - t0 < timeout:
            r = httpx.get(f"{api_url}/api/v1/status/{task_id}", headers=h, timeout=10)
            st = r.json().get("status")
            if st == "completed":
                return time.perf_counter() - t0, "OK"
            elif st == "failed":
                return time.perf_counter() - t0, "FAILED"
            time.sleep(0.5)
        return time.perf_counter() - t0, "TIMEOUT"
    except Exception as e:
        return time.perf_counter() - t0, f"ERR:{str(e)[:30]}"


def run_full_benchmark(label="MANUAL"):
    audio = load_audio()
    results = {"label": label, "model_serving": [], "api_e2e": []}

    # ── Part 1: Direct model-serving ──
    print(f"\n{'='*80}")
    print(f"  [{label}] DIRECT MODEL-SERVING (port 8001)")
    print(f"{'='*80}")
    print(f"  {'Model':<22} {'Device':<6} {'5s':>8} {'30s':>8} {'60s':>8}")
    print(f"  {'-'*22} {'-'*6} {'-'*8} {'-'*8} {'-'*8}")

    # Warmup all GPU models
    for m in GPU_MODELS:
        httpx.post(f"{MS_URL}/predict", params={"model": m, "device": "gpu"},
                   files={"file": ("t.mp3", audio["5s"], "audio/mpeg")}, timeout=600)

    # GPU tests
    for m in GPU_MODELS:
        times = {}
        for dur in ["5s", "30s", "60s"]:
            t, s = test_model_serving(MS_URL, m, "gpu", audio[dur])
            times[dur] = (t, s)
            time.sleep(0.5)
        row = {"model": m, "device": "gpu", **{d: {"time": round(t, 2), "status": s} for d, (t, s) in times.items()}}
        results["model_serving"].append(row)
        t5, t30, t60 = times["5s"][0], times["30s"][0], times["60s"][0]
        print(f"  {m:<22} {'gpu':<6} {t5:>7.2f}s {t30:>7.2f}s {t60:>7.2f}s")

    # CPU tests (demucs only)
    # Warmup CPU
    for m in CPU_MODELS:
        httpx.post(f"{MS_URL}/predict", params={"model": m, "device": "cpu"},
                   files={"file": ("t.mp3", audio["5s"], "audio/mpeg")}, timeout=600)

    for m in CPU_MODELS:
        times = {}
        for dur in ["5s", "30s", "60s"]:
            t, s = test_model_serving(MS_URL, m, "cpu", audio[dur])
            times[dur] = (t, s)
            time.sleep(0.5)
        row = {"model": m, "device": "cpu", **{d: {"time": round(t, 2), "status": s} for d, (t, s) in times.items()}}
        results["model_serving"].append(row)
        t5, t30, t60 = times["5s"][0], times["30s"][0], times["60s"][0]
        print(f"  {m:<22} {'cpu':<6} {t5:>7.2f}s {t30:>7.2f}s {t60:>7.2f}s")

    # ── Part 2: API E2E ──
    print(f"\n{'='*80}")
    print(f"  [{label}] API E2E (port 8000 → Celery → model-serving)")
    print(f"{'='*80}")

    token = get_api_token(API_URL)
    if not token:
        print("  AUTH FAILED — skipping API E2E")
        return results

    # Top up credits
    h = {"Authorization": f"Bearer {token}"}
    httpx.post(f"{API_URL}/api/v1/credits/purchase", json={"amount": 100}, headers=h, timeout=10)

    print(f"  {'Model':<22} {'Device':<6} {'5s':>8} {'30s':>8} {'60s':>8}")
    print(f"  {'-'*22} {'-'*6} {'-'*8} {'-'*8} {'-'*8}")

    # GPU E2E (test 2 models to save time)
    for m in ["demucs", "melband_roformer"]:
        times = {}
        for dur in ["5s", "30s", "60s"]:
            time.sleep(2)  # let queue drain
            t, s = test_api_e2e(API_URL, token, m, "auto", audio[dur])
            times[dur] = (t, s)
        row = {"model": m, "device": "gpu", **{d: {"time": round(t, 2), "status": s} for d, (t, s) in times.items()}}
        results["api_e2e"].append(row)
        t5, t30, t60 = times["5s"][0], times["30s"][0], times["60s"][0]
        s5, s30, s60 = times["5s"][1], times["30s"][1], times["60s"][1]
        print(f"  {m:<22} {'gpu':<6} {t5:>7.2f}s {t30:>7.2f}s {t60:>7.2f}s  [{s5},{s30},{s60}]")

    # CPU E2E (demucs only)
    for m in ["demucs"]:
        times = {}
        for dur in ["5s", "30s", "60s"]:
            time.sleep(2)
            t, s = test_api_e2e(API_URL, token, m, "cpu", audio[dur])
            times[dur] = (t, s)
        row = {"model": m, "device": "cpu", **{d: {"time": round(t, 2), "status": s} for d, (t, s) in times.items()}}
        results["api_e2e"].append(row)
        t5, t30, t60 = times["5s"][0], times["30s"][0], times["60s"][0]
        s5, s30, s60 = times["5s"][1], times["30s"][1], times["60s"][1]
        print(f"  {m:<22} {'cpu':<6} {t5:>7.2f}s {t30:>7.2f}s {t60:>7.2f}s  [{s5},{s30},{s60}]")

    return results


if __name__ == "__main__":
    label = sys.argv[1] if len(sys.argv) > 1 else "MANUAL"
    results = run_full_benchmark(label)

    out_file = f"/home/watercry/Disk_C/Data/audio-separation/backend/tests/experiments/benchmark_{label.lower()}.json"
    with open(out_file, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nResults saved to {out_file}")
