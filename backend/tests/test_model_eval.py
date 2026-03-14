"""
Model quality evaluation tests using MUSDB18 with museval metrics (SDR/SIR/SAR).

Runs actual audio separation through Demucs and compares against ground-truth stems.
Tests assert that separation quality meets minimum thresholds.

Requires: pip install musdb museval demucs torch torchaudio soundfile
Data:     python -c "import musdb; musdb.DB(download=True, root='test_audio/musdb18')"

Usage:
    pytest tests/test_model_eval.py -v -m model_eval
    pytest tests/test_model_eval.py -v -k "test_demucs"
"""
import io
import time
from pathlib import Path

import numpy as np
import pytest

pytestmark = [
    pytest.mark.asyncio,
    pytest.mark.model_eval,
]

MUSDB_ROOT = Path(__file__).resolve().parent.parent / "test_audio" / "musdb18"

# Minimum acceptable SDR thresholds (dB) — below these = regression
MIN_VOCALS_SDR = 6.0
MIN_DRUMS_SDR = 5.0
MIN_BASS_SDR = 5.0
MIN_OTHER_SDR = 2.0


def _skip_if_no_gpu():
    torch = pytest.importorskip("torch")
    if not torch.cuda.is_available():
        pytest.skip("CUDA GPU required for model evaluation")


def _skip_if_no_musdb():
    pytest.importorskip("musdb")
    if not MUSDB_ROOT.exists():
        pytest.skip("MUSDB18 data not found — run: make musdb-download")


@pytest.fixture(scope="module")
def demucs_model():
    """Load Demucs htdemucs model once per module."""
    _skip_if_no_gpu()
    import torch
    from demucs.pretrained import get_model
    model = get_model("htdemucs")
    model.eval().to("cuda")
    return model


@pytest.fixture(scope="module")
def musdb_tracks():
    """Load all MUSDB test tracks."""
    _skip_if_no_musdb()
    import musdb
    return musdb.DB(root=str(MUSDB_ROOT), subsets="test")


def separate_track(model, track):
    """Run Demucs separation on a single track. Returns dict of stem arrays."""
    import torch
    from demucs.apply import apply_model

    audio = torch.tensor(track.audio.T, dtype=torch.float32).unsqueeze(0).to("cuda")

    with torch.no_grad():
        with torch.amp.autocast("cuda"):
            estimates = apply_model(model, audio, device="cuda")

    estimates = estimates.squeeze(0).cpu().numpy()
    source_map = {name: idx for idx, name in enumerate(model.sources)}

    result = {}
    for name in ["vocals", "drums", "bass", "other"]:
        est = estimates[source_map[name]].T  # (samples, channels)
        ref_len = len(track.targets[name].audio)
        result[name] = est[:ref_len]

    torch.cuda.empty_cache()
    return result


def evaluate_track(track, estimates):
    """Evaluate separation quality using museval. Returns per-source SDR/SIR/SAR."""
    import museval

    source_names = ["vocals", "drums", "bass", "other"]
    refs = np.stack([track.targets[s].audio for s in source_names])
    ests = np.stack([estimates[s] for s in source_names])

    sdr, isr, sir, sar = museval.evaluate(refs, ests)

    results = {}
    for j, name in enumerate(source_names):
        results[name] = {
            "SDR": float(np.nanmedian(sdr[j])),
            "SIR": float(np.nanmedian(sir[j])),
            "SAR": float(np.nanmedian(sar[j])),
        }
    return results


# -------------------------------------------------------------------------
# Single-track quality tests
# -------------------------------------------------------------------------


class TestDemucsQuality:
    """Test that Demucs separation meets minimum quality thresholds."""

    async def test_vocals_sdr_above_threshold(self, demucs_model, musdb_tracks):
        """Vocals SDR should be >= 6.0 dB on at least 80% of tracks."""
        _skip_if_no_musdb()
        tracks = musdb_tracks[:10]  # use 10 tracks for speed
        pass_count = 0
        for track in tracks:
            ests = separate_track(demucs_model, track)
            metrics = evaluate_track(track, ests)
            if metrics["vocals"]["SDR"] >= MIN_VOCALS_SDR:
                pass_count += 1

        pass_rate = pass_count / len(tracks)
        assert pass_rate >= 0.8, f"Only {pass_rate:.0%} of tracks met vocals SDR threshold ({MIN_VOCALS_SDR} dB)"

    async def test_drums_sdr_above_threshold(self, demucs_model, musdb_tracks):
        """Drums SDR should be >= 5.0 dB on at least 80% of tracks."""
        _skip_if_no_musdb()
        tracks = musdb_tracks[:10]
        pass_count = 0
        for track in tracks:
            ests = separate_track(demucs_model, track)
            metrics = evaluate_track(track, ests)
            if metrics["drums"]["SDR"] >= MIN_DRUMS_SDR:
                pass_count += 1

        pass_rate = pass_count / len(tracks)
        assert pass_rate >= 0.8, f"Only {pass_rate:.0%} of tracks met drums SDR threshold ({MIN_DRUMS_SDR} dB)"

    async def test_bass_sdr_above_threshold(self, demucs_model, musdb_tracks):
        """Bass SDR should be >= 5.0 dB on at least 80% of tracks."""
        _skip_if_no_musdb()
        tracks = musdb_tracks[:10]
        pass_count = 0
        for track in tracks:
            ests = separate_track(demucs_model, track)
            metrics = evaluate_track(track, ests)
            if metrics["bass"]["SDR"] >= MIN_BASS_SDR:
                pass_count += 1

        pass_rate = pass_count / len(tracks)
        assert pass_rate >= 0.8, f"Only {pass_rate:.0%} of tracks met bass SDR threshold ({MIN_BASS_SDR} dB)"

    async def test_other_sdr_above_threshold(self, demucs_model, musdb_tracks):
        """Other SDR should be >= 2.0 dB on at least 70% of tracks."""
        _skip_if_no_musdb()
        tracks = musdb_tracks[:10]
        pass_count = 0
        for track in tracks:
            ests = separate_track(demucs_model, track)
            metrics = evaluate_track(track, ests)
            if metrics["other"]["SDR"] >= MIN_OTHER_SDR:
                pass_count += 1

        pass_rate = pass_count / len(tracks)
        assert pass_rate >= 0.7, f"Only {pass_rate:.0%} of tracks met other SDR threshold ({MIN_OTHER_SDR} dB)"


# -------------------------------------------------------------------------
# Aggregate quality tests
# -------------------------------------------------------------------------


class TestDemucsAggregateMetrics:
    """Test aggregate metrics across all MUSDB tracks."""

    @pytest.fixture(scope="class")
    def aggregate_results(self, demucs_model, musdb_tracks):
        """Run separation on all tracks and collect metrics."""
        _skip_if_no_musdb()
        all_metrics = []
        for track in musdb_tracks:
            ests = separate_track(demucs_model, track)
            metrics = evaluate_track(track, ests)
            all_metrics.append(metrics)
        return all_metrics

    async def test_median_vocals_sdr(self, aggregate_results):
        """Median vocals SDR across all tracks should be >= 7.0 dB."""
        sdrs = [m["vocals"]["SDR"] for m in aggregate_results]
        median = np.median(sdrs)
        assert median >= 7.0, f"Median vocals SDR {median:.2f} dB < 7.0 dB"

    async def test_median_drums_sdr(self, aggregate_results):
        """Median drums SDR across all tracks should be >= 7.0 dB."""
        sdrs = [m["drums"]["SDR"] for m in aggregate_results]
        median = np.median(sdrs)
        assert median >= 7.0, f"Median drums SDR {median:.2f} dB < 7.0 dB"

    async def test_median_bass_sdr(self, aggregate_results):
        """Median bass SDR across all tracks should be >= 7.0 dB."""
        sdrs = [m["bass"]["SDR"] for m in aggregate_results]
        median = np.median(sdrs)
        assert median >= 7.0, f"Median bass SDR {median:.2f} dB < 7.0 dB"

    async def test_median_other_sdr(self, aggregate_results):
        """Median other SDR across all tracks should be >= 4.0 dB."""
        sdrs = [m["other"]["SDR"] for m in aggregate_results]
        median = np.median(sdrs)
        assert median >= 4.0, f"Median other SDR {median:.2f} dB < 4.0 dB"

    async def test_no_severely_negative_sdr_vocals(self, aggregate_results):
        """No track should have vocals SDR below -1.0 dB (catastrophic failure).
        Marginal negatives (> -1.0) can occur on tracks with very quiet vocals."""
        sdrs = [m["vocals"]["SDR"] for m in aggregate_results]
        severe = [s for s in sdrs if s < -1.0]
        assert len(severe) == 0, f"{len(severe)} tracks had severely negative vocals SDR (< -1.0 dB): {severe}"

    async def test_sir_higher_than_sdr(self, aggregate_results):
        """SIR should generally be higher than SDR (interference well-suppressed)."""
        vocals_sdr = np.median([m["vocals"]["SDR"] for m in aggregate_results])
        vocals_sir = np.median([m["vocals"]["SIR"] for m in aggregate_results])
        assert vocals_sir > vocals_sdr, f"SIR ({vocals_sir:.2f}) should be > SDR ({vocals_sdr:.2f})"


# -------------------------------------------------------------------------
# Performance tests
# -------------------------------------------------------------------------


class TestDemucsPerformance:
    """Test separation speed meets production requirements."""

    async def test_processing_speed(self, demucs_model, musdb_tracks):
        """Each 7s track should process in under 2 seconds on GPU."""
        _skip_if_no_musdb()
        import torch

        track = musdb_tracks[0]
        audio = torch.tensor(track.audio.T, dtype=torch.float32).unsqueeze(0).to("cuda")

        from demucs.apply import apply_model

        # Warmup
        with torch.no_grad():
            with torch.amp.autocast("cuda"):
                apply_model(demucs_model, audio, device="cuda")

        # Timed run
        t0 = time.time()
        with torch.no_grad():
            with torch.amp.autocast("cuda"):
                apply_model(demucs_model, audio, device="cuda")
        elapsed = time.time() - t0

        assert elapsed < 2.0, f"Separation took {elapsed:.2f}s (> 2s threshold)"

    async def test_batch_throughput(self, demucs_model, musdb_tracks):
        """Process 5 tracks sequentially, should average < 0.5s per track."""
        _skip_if_no_musdb()
        import torch
        from demucs.apply import apply_model

        times = []
        for track in musdb_tracks[:5]:
            audio = torch.tensor(track.audio.T, dtype=torch.float32).unsqueeze(0).to("cuda")
            t0 = time.time()
            with torch.no_grad():
                with torch.amp.autocast("cuda"):
                    apply_model(demucs_model, audio, device="cuda")
            times.append(time.time() - t0)
            torch.cuda.empty_cache()

        avg = np.mean(times)
        assert avg < 0.5, f"Average processing time {avg:.2f}s (> 0.5s threshold)"

    async def test_output_shape_matches_input(self, demucs_model, musdb_tracks):
        """Separated stems should have same length and channels as input."""
        _skip_if_no_musdb()
        track = musdb_tracks[0]
        ests = separate_track(demucs_model, track)

        input_shape = track.audio.shape  # (samples, channels)
        for stem_name, stem_audio in ests.items():
            assert stem_audio.shape == input_shape, (
                f"{stem_name} shape {stem_audio.shape} != input {input_shape}"
            )

    async def test_stems_sum_to_mixture(self, demucs_model, musdb_tracks):
        """Sum of all separated stems should approximately equal the mixture."""
        _skip_if_no_musdb()
        track = musdb_tracks[0]
        ests = separate_track(demucs_model, track)

        reconstructed = sum(ests[s] for s in ["vocals", "drums", "bass", "other"])
        mixture = track.audio

        # RMS error should be small (< 1e-3 for lossless reconstruction)
        rms_error = np.sqrt(np.mean((reconstructed - mixture) ** 2))
        assert rms_error < 0.01, f"Reconstruction RMS error {rms_error:.6f} too high"
