"""Tests that verify files are actually written to MinIO (local mount)."""
import uuid
from pathlib import Path

import pytest
from httpx import AsyncClient
from minio import Minio

from tests.conftest import auth_headers, make_wav_bytes, register_and_login

pytestmark = pytest.mark.asyncio

SEPARATE_URL = "/api/v1/separate"
MINIO_ENDPOINT = "localhost:9002"
MINIO_ACCESS_KEY = "testadmin"
MINIO_SECRET_KEY = "testadmin123"
MINIO_DATA_DIR = Path(__file__).resolve().parent.parent / "minio_data"


def get_minio_client() -> Minio:
    return Minio(MINIO_ENDPOINT, access_key=MINIO_ACCESS_KEY, secret_key=MINIO_SECRET_KEY, secure=False)


@pytest.fixture(scope="module")
def minio_client() -> Minio:
    client = get_minio_client()
    # Ensure buckets exist
    for bucket in ["audio-input", "audio-output"]:
        if not client.bucket_exists(bucket):
            client.make_bucket(bucket)
    return client


class TestMinIOUpload:
    """Verify that the /separate endpoint actually writes files to MinIO."""

    async def test_upload_writes_to_minio_input_bucket(
        self, client_real_minio: AsyncClient, db_session, minio_client: Minio
    ):
        """Upload audio via API and verify the file exists in MinIO input bucket."""
        # Register a user
        user = await register_and_login(client_real_minio, f"minio_test_{uuid.uuid4().hex[:8]}@test.com")

        wav_data = make_wav_bytes(1.0)

        resp = await client_real_minio.post(
            SEPARATE_URL,
            files={"file": ("test_song.wav", wav_data, "audio/wav")},
            headers=auth_headers(user["access_token"]),
        )
        assert resp.status_code == 202, resp.text
        task_id = resp.json()["task_id"]

        # Verify file exists in MinIO
        objects = list(minio_client.list_objects("audio-input", recursive=True))
        matching = [o for o in objects if task_id in o.object_name]
        assert len(matching) == 1, f"Expected 1 object for task {task_id}, found {len(matching)}: {[o.object_name for o in objects]}"

        obj = matching[0]
        assert obj.object_name.endswith(".wav")
        assert obj.size == len(wav_data)

    async def test_upload_file_readable_from_minio(
        self, client_real_minio: AsyncClient, db_session, minio_client: Minio
    ):
        """Upload audio and verify the data can be read back from MinIO."""
        user = await register_and_login(client_real_minio, f"minio_read_{uuid.uuid4().hex[:8]}@test.com")

        wav_data = make_wav_bytes(1.0)

        resp = await client_real_minio.post(
            SEPARATE_URL,
            files={"file": ("readable.wav", wav_data, "audio/wav")},
            headers=auth_headers(user["access_token"]),
        )
        assert resp.status_code == 202
        task_id = resp.json()["task_id"]

        # Read the file back from MinIO
        objects = list(minio_client.list_objects("audio-input", recursive=True))
        matching = [o for o in objects if task_id in o.object_name]
        assert len(matching) == 1

        response = minio_client.get_object("audio-input", matching[0].object_name)
        try:
            data = response.read()
        finally:
            response.close()
            response.release_conn()

        assert data == wav_data, "Data read from MinIO doesn't match uploaded data"

    async def test_upload_visible_on_local_filesystem(
        self, client_real_minio: AsyncClient, db_session, minio_client: Minio
    ):
        """Upload audio and verify the file appears in the local minio_data mount."""
        if not MINIO_DATA_DIR.exists():
            pytest.skip("minio_data directory not found (MinIO not mounted locally)")

        user = await register_and_login(client_real_minio, f"minio_local_{uuid.uuid4().hex[:8]}@test.com")

        wav_data = make_wav_bytes(1.0)

        resp = await client_real_minio.post(
            SEPARATE_URL,
            files={"file": ("local_check.wav", wav_data, "audio/wav")},
            headers=auth_headers(user["access_token"]),
        )
        assert resp.status_code == 202
        task_id = resp.json()["task_id"]

        # Check local filesystem
        input_dir = MINIO_DATA_DIR / "audio-input"
        assert input_dir.exists(), f"audio-input bucket dir not found at {input_dir}"

        # Find the uploaded file (MinIO stores with internal structure)
        found = list(input_dir.rglob(f"*{task_id}*"))
        assert len(found) > 0, f"No files found for task {task_id} in {input_dir}"

    async def test_multiple_models_upload_to_same_bucket(
        self, client_real_minio: AsyncClient, db_session, minio_client: Minio
    ):
        """Upload with different models and verify all land in input bucket."""
        user = await register_and_login(client_real_minio, f"minio_models_{uuid.uuid4().hex[:8]}@test.com")

        wav_data = make_wav_bytes(1.0)
        task_ids = []

        for model in ["demucs", "bs_roformer"]:
            resp = await client_real_minio.post(
                SEPARATE_URL + f"?model={model}",
                files={"file": (f"{model}_test.wav", wav_data, "audio/wav")},
                headers=auth_headers(user["access_token"]),
            )
            assert resp.status_code == 202, f"Failed for model={model}: {resp.text}"
            task_ids.append(resp.json()["task_id"])

        # Verify both files exist
        objects = list(minio_client.list_objects("audio-input", recursive=True))
        for tid in task_ids:
            matching = [o for o in objects if tid in o.object_name]
            assert len(matching) == 1, f"Missing object for task {tid}"


class TestMinIOOutputBucket:
    """Verify output bucket operations (simulating worker output)."""

    def test_output_bucket_exists(self, minio_client: Minio):
        assert minio_client.bucket_exists("audio-output")

    def test_write_and_read_output_stems(self, minio_client: Minio):
        """Simulate worker writing stems to output bucket."""
        import io

        task_id = str(uuid.uuid4())
        user_id = str(uuid.uuid4())
        wav_data = make_wav_bytes(1.0)

        stems = ["vocals.wav", "instrumental.wav"]
        for stem in stems:
            key = f"outputs/{user_id}/{task_id}/{stem}"
            minio_client.put_object(
                "audio-output", key, io.BytesIO(wav_data), len(wav_data), content_type="audio/wav"
            )

        # Verify all stems exist
        objects = list(minio_client.list_objects("audio-output", prefix=f"outputs/{user_id}/{task_id}/"))
        names = [Path(o.object_name).name for o in objects]
        for stem in stems:
            assert stem in names, f"Missing stem {stem} in output: {names}"

    def test_output_visible_on_local_mount(self, minio_client: Minio):
        """Verify output stems appear in local minio_data mount."""
        import io

        if not MINIO_DATA_DIR.exists():
            pytest.skip("minio_data directory not found")

        task_id = str(uuid.uuid4())
        wav_data = make_wav_bytes(0.5)

        key = f"outputs/localtest/{task_id}/vocals.wav"
        minio_client.put_object("audio-output", key, io.BytesIO(wav_data), len(wav_data))

        output_dir = MINIO_DATA_DIR / "audio-output"
        assert output_dir.exists()

        found = list(output_dir.rglob(f"*{task_id}*"))
        assert len(found) > 0, f"Output not found locally for task {task_id}"
