"""Test with longer audio files through real MinIO."""
import io
import math
import struct
import uuid
import wave

import pytest
from httpx import AsyncClient
from minio import Minio

from tests.conftest import auth_headers, register_and_login

pytestmark = pytest.mark.asyncio

SEPARATE_URL = "/api/v1/separate"


def make_long_wav(duration: float = 30.0, sr: int = 44100, channels: int = 2) -> bytes:
    """Generate a stereo WAV file of given duration."""
    n_samples = int(sr * duration)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        samples = []
        for i in range(n_samples):
            val = int(5000 * math.sin(2 * math.pi * 440 * i / sr))
            samples.extend([val] * channels)
        wf.writeframes(struct.pack(f"<{len(samples)}h", *samples))
    return buf.getvalue()


@pytest.fixture(scope="module")
def minio_client() -> Minio:
    client = Minio("localhost:9002", access_key="testadmin", secret_key="testadmin123", secure=False)
    for bucket in ["audio-input", "audio-output"]:
        if not client.bucket_exists(bucket):
            client.make_bucket(bucket)
    return client


class TestLongAudioUpload:

    async def test_upload_30s_audio(
        self, client_real_minio: AsyncClient, db_session, minio_client: Minio
    ):
        """Upload 30-second audio and verify it lands in MinIO at full size."""
        user = await register_and_login(
            client_real_minio, f"long30_{uuid.uuid4().hex[:8]}@test.com"
        )

        wav_data = make_long_wav(duration=30.0)
        print(f"\n30s WAV size: {len(wav_data):,} bytes ({len(wav_data)/1024/1024:.1f} MB)")

        resp = await client_real_minio.post(
            SEPARATE_URL + "?model=demucs",
            files={"file": ("song_30s.wav", wav_data, "audio/wav")},
            headers=auth_headers(user["access_token"]),
        )
        assert resp.status_code == 202, resp.text
        task_id = resp.json()["task_id"]

        # Verify in MinIO
        objects = list(minio_client.list_objects("audio-input", recursive=True))
        matching = [o for o in objects if task_id in o.object_name]
        assert len(matching) == 1
        assert matching[0].size == len(wav_data), (
            f"Size mismatch: MinIO has {matching[0].size:,} bytes, expected {len(wav_data):,}"
        )
        print(f"MinIO object: {matching[0].object_name} ({matching[0].size:,} bytes)")

    async def test_upload_60s_audio(
        self, client_real_minio: AsyncClient, db_session, minio_client: Minio
    ):
        """Upload 60-second audio."""
        user = await register_and_login(
            client_real_minio, f"long60_{uuid.uuid4().hex[:8]}@test.com"
        )

        wav_data = make_long_wav(duration=60.0)
        print(f"\n60s WAV size: {len(wav_data):,} bytes ({len(wav_data)/1024/1024:.1f} MB)")

        resp = await client_real_minio.post(
            SEPARATE_URL + "?model=bs_roformer",
            files={"file": ("song_60s.wav", wav_data, "audio/wav")},
            headers=auth_headers(user["access_token"]),
        )
        assert resp.status_code == 202, resp.text
        task_id = resp.json()["task_id"]

        objects = list(minio_client.list_objects("audio-input", recursive=True))
        matching = [o for o in objects if task_id in o.object_name]
        assert len(matching) == 1
        assert matching[0].size == len(wav_data)
        print(f"MinIO object: {matching[0].object_name} ({matching[0].size:,} bytes)")

    async def test_upload_5min_audio(
        self, client_real_minio: AsyncClient, db_session, minio_client: Minio
    ):
        """Upload 5-minute audio (under the 10min limit). Use 16kHz mono to stay under 50MB."""
        user = await register_and_login(
            client_real_minio, f"long5m_{uuid.uuid4().hex[:8]}@test.com"
        )

        wav_data = make_long_wav(duration=300.0, sr=16000, channels=1)
        print(f"\n5min WAV size: {len(wav_data):,} bytes ({len(wav_data)/1024/1024:.1f} MB)")

        resp = await client_real_minio.post(
            SEPARATE_URL + "?model=melband_roformer",
            files={"file": ("song_5min.wav", wav_data, "audio/wav")},
            headers=auth_headers(user["access_token"]),
        )
        assert resp.status_code == 202, resp.text
        task_id = resp.json()["task_id"]

        objects = list(minio_client.list_objects("audio-input", recursive=True))
        matching = [o for o in objects if task_id in o.object_name]
        assert len(matching) == 1
        assert matching[0].size == len(wav_data)
        print(f"MinIO object: {matching[0].object_name} ({matching[0].size:,} bytes)")

        # Read back and verify data integrity
        response = minio_client.get_object("audio-input", matching[0].object_name)
        try:
            data = response.read()
        finally:
            response.close()
            response.release_conn()
        assert data == wav_data, "Data corrupted during upload"
        print("Data integrity check: OK")
