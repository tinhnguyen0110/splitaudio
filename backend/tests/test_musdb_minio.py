"""
Test with real MUSDB18 audio data through the full API → MinIO pipeline.

Usage:
    pytest tests/test_musdb_minio.py -v --asyncio-mode=auto -s
"""
import io
import uuid
from pathlib import Path

import pytest
from httpx import AsyncClient
from minio import Minio

from tests.conftest import auth_headers, register_and_login

pytestmark = pytest.mark.asyncio

SEPARATE_URL = "/api/v1/separate"
MUSDB_ROOT = Path(__file__).resolve().parent.parent / "test_audio" / "musdb18"


def _require_musdb():
    pytest.importorskip("musdb")
    if not MUSDB_ROOT.exists():
        pytest.skip("MUSDB18 data not found")


@pytest.fixture(scope="module")
def musdb_tracks():
    """Load MUSDB18 test tracks."""
    _require_musdb()
    import musdb
    db = musdb.DB(root=str(MUSDB_ROOT), subsets="test")
    return db


@pytest.fixture(scope="module")
def minio_client() -> Minio:
    client = Minio("localhost:9002", access_key="testadmin", secret_key="testadmin123", secure=False)
    for bucket in ["audio-input", "audio-output"]:
        if not client.bucket_exists(bucket):
            client.make_bucket(bucket)
    return client


def track_to_wav_bytes(track) -> bytes:
    """Convert a MUSDB track mixture to WAV bytes."""
    import soundfile as sf
    buf = io.BytesIO()
    sf.write(buf, track.audio, track.rate, format="WAV")
    buf.seek(0)
    return buf.getvalue()


class TestMusdbUpload:

    async def test_upload_first_track(
        self, client_real_minio: AsyncClient, db_session, minio_client: Minio, musdb_tracks
    ):
        """Upload first MUSDB18 test track through API to MinIO."""
        track = musdb_tracks[0]
        wav_data = track_to_wav_bytes(track)
        print(f"\nTrack: {track.name}")
        print(f"Duration: {track.duration:.1f}s, Rate: {track.rate}Hz")
        print(f"WAV size: {len(wav_data):,} bytes ({len(wav_data)/1024/1024:.1f} MB)")

        user = await register_and_login(
            client_real_minio, f"musdb1_{uuid.uuid4().hex[:8]}@test.com"
        )

        resp = await client_real_minio.post(
            SEPARATE_URL + "?model=demucs",
            files={"file": (f"{track.name}.wav", wav_data, "audio/wav")},
            headers=auth_headers(user["access_token"]),
        )
        assert resp.status_code == 202, resp.text
        task_id = resp.json()["task_id"]
        print(f"Task ID: {task_id}")
        print(f"Credits consumed: {resp.json()['credit_consumed']}")

        # Verify in MinIO
        objects = list(minio_client.list_objects("audio-input", recursive=True))
        matching = [o for o in objects if task_id in o.object_name]
        assert len(matching) == 1
        assert matching[0].size == len(wav_data)
        print(f"MinIO: {matching[0].object_name} ({matching[0].size:,} bytes) ✓")

    async def test_upload_three_tracks_different_models(
        self, client_real_minio: AsyncClient, db_session, minio_client: Minio, musdb_tracks
    ):
        """Upload 3 different MUSDB tracks with different models."""
        models = ["demucs", "demucs_ft", "bs_roformer"]
        results = []

        user = await register_and_login(
            client_real_minio, f"musdb3_{uuid.uuid4().hex[:8]}@test.com"
        )

        for i, model in enumerate(models):
            track = musdb_tracks[i]
            wav_data = track_to_wav_bytes(track)
            print(f"\n[{model}] Track: {track.name} ({track.duration:.1f}s, {len(wav_data)/1024/1024:.1f} MB)")

            resp = await client_real_minio.post(
                SEPARATE_URL + f"?model={model}",
                files={"file": (f"{track.name}.wav", wav_data, "audio/wav")},
                headers=auth_headers(user["access_token"]),
            )
            assert resp.status_code == 202, f"Failed for {model}: {resp.text}"
            task_id = resp.json()["task_id"]
            results.append((model, track.name, task_id, len(wav_data)))
            print(f"  Task: {task_id}, credits: {resp.json()['credit_consumed']}")

        # Verify all in MinIO
        objects = list(minio_client.list_objects("audio-input", recursive=True))
        for model, name, task_id, size in results:
            matching = [o for o in objects if task_id in o.object_name]
            assert len(matching) == 1, f"Missing {model}/{name} in MinIO"
            assert matching[0].size == size
            print(f"[{model}] {name}: {matching[0].object_name} ✓")

    async def test_upload_longest_track(
        self, client_real_minio: AsyncClient, db_session, minio_client: Minio, musdb_tracks
    ):
        """Find and upload the longest MUSDB test track."""
        # Find longest track
        longest = max(musdb_tracks, key=lambda t: t.duration)
        wav_data = track_to_wav_bytes(longest)
        size_mb = len(wav_data) / 1024 / 1024

        print(f"\nLongest track: {longest.name}")
        print(f"Duration: {longest.duration:.1f}s, WAV size: {size_mb:.1f} MB")

        if size_mb > 50:
            pytest.skip(f"Track too large ({size_mb:.1f} MB > 50 MB limit)")

        user = await register_and_login(
            client_real_minio, f"musdb_long_{uuid.uuid4().hex[:8]}@test.com"
        )

        resp = await client_real_minio.post(
            SEPARATE_URL + "?model=melband_roformer",
            files={"file": (f"{longest.name}.wav", wav_data, "audio/wav")},
            headers=auth_headers(user["access_token"]),
        )
        assert resp.status_code == 202, resp.text
        task_id = resp.json()["task_id"]
        print(f"Task: {task_id}, credits: {resp.json()['credit_consumed']}")

        # Verify and read back
        objects = list(minio_client.list_objects("audio-input", recursive=True))
        matching = [o for o in objects if task_id in o.object_name]
        assert len(matching) == 1
        assert matching[0].size == len(wav_data)

        response = minio_client.get_object("audio-input", matching[0].object_name)
        try:
            data = response.read()
        finally:
            response.close()
            response.release_conn()
        assert data == wav_data, "Data integrity check failed"
        print(f"MinIO: {matching[0].size:,} bytes, integrity OK ✓")

    async def test_upload_and_simulate_worker_output(
        self, client_real_minio: AsyncClient, db_session, minio_client: Minio, musdb_tracks
    ):
        """Upload a MUSDB track, then simulate worker writing real stems to output bucket."""
        import soundfile as sf

        track = musdb_tracks[0]
        wav_data = track_to_wav_bytes(track)
        print(f"\nTrack: {track.name} ({track.duration:.1f}s)")

        user = await register_and_login(
            client_real_minio, f"musdb_out_{uuid.uuid4().hex[:8]}@test.com"
        )

        resp = await client_real_minio.post(
            SEPARATE_URL + "?model=demucs",
            files={"file": (f"{track.name}.wav", wav_data, "audio/wav")},
            headers=auth_headers(user["access_token"]),
        )
        assert resp.status_code == 202
        task_id = resp.json()["task_id"]

        # Simulate worker: write real vocals and accompaniment stems from ground truth
        vocals = track.targets["vocals"].audio
        accompaniment = track.targets["accompaniment"].audio

        for stem_name, stem_audio in [("vocals.wav", vocals), ("instrumental.wav", accompaniment)]:
            buf = io.BytesIO()
            sf.write(buf, stem_audio, track.rate, format="WAV")
            stem_bytes = buf.getvalue()

            out_key = f"outputs/{task_id}/{stem_name}"
            minio_client.put_object(
                "audio-output", out_key, io.BytesIO(stem_bytes), len(stem_bytes), content_type="audio/wav"
            )
            print(f"  Output: {out_key} ({len(stem_bytes):,} bytes)")

        # Verify output
        out_objects = list(minio_client.list_objects("audio-output", prefix=f"outputs/{task_id}/", recursive=True))
        assert len(out_objects) == 2
        names = [Path(o.object_name).name for o in out_objects]
        assert "vocals.wav" in names
        assert "instrumental.wav" in names
        for o in out_objects:
            assert o.size > 10000, f"{o.object_name} too small ({o.size} bytes)"
        print(f"Output stems verified ✓ ({len(out_objects)} files)")
