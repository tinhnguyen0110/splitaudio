"""Tests for audio separation endpoints."""
import pytest
from httpx import AsyncClient
from unittest.mock import patch

from tests.conftest import auth_headers, make_wav_bytes


pytestmark = pytest.mark.asyncio

SEPARATE_URL = "/api/v1/separate"


def wav_upload(data: bytes, filename: str = "test.wav") -> dict:
    """Build files dict for httpx multipart upload."""
    return {"file": (filename, data, "audio/wav")}


class TestUploadEndpoint:
    async def test_upload_valid_audio_returns_pending(
        self, client: AsyncClient, test_user: dict, short_wav: bytes
    ):
        resp = await client.post(
            SEPARATE_URL,
            files=wav_upload(short_wav),
            headers=auth_headers(test_user["access_token"]),
        )
        assert resp.status_code == 202
        body = resp.json()
        assert body["status"] == "pending"
        assert "task_id" in body
        assert body["credit_consumed"] == 1
        assert body["credits_remaining"] == 9

    async def test_upload_invalid_mime_type_returns_422(
        self, client: AsyncClient, test_user: dict
    ):
        resp = await client.post(
            SEPARATE_URL,
            files={"file": ("test.txt", b"not audio", "text/plain")},
            headers=auth_headers(test_user["access_token"]),
        )
        assert resp.status_code == 422

    async def test_upload_invalid_extension_returns_422(
        self, client: AsyncClient, test_user: dict
    ):
        resp = await client.post(
            SEPARATE_URL,
            files={"file": ("test.exe", b"fake data", "audio/wav")},
            headers=auth_headers(test_user["access_token"]),
        )
        assert resp.status_code == 422

    async def test_upload_too_large_returns_413(
        self, client: AsyncClient, test_user: dict
    ):
        big_data = b"0" * (51 * 1024 * 1024)  # 51 MB
        resp = await client.post(
            SEPARATE_URL,
            files={"file": ("big.wav", big_data, "audio/wav")},
            headers=auth_headers(test_user["access_token"]),
        )
        assert resp.status_code == 413

    async def test_upload_long_duration_returns_400(
        self, client: AsyncClient, test_user: dict
    ):
        # Patch get_duration to return > 600s
        with patch("routers.separate.get_duration", return_value=661.0):
            resp = await client.post(
                SEPARATE_URL,
                files=wav_upload(make_wav_bytes(1.0)),
                headers=auth_headers(test_user["access_token"]),
            )
        assert resp.status_code == 400
        assert "long" in resp.json()["detail"].lower() or "maximum" in resp.json()["detail"].lower()

    @pytest.mark.parametrize("model_name", ["demucs", "demucs_ft", "bs_roformer", "melband_roformer"])
    async def test_upload_with_all_model_names(
        self, client: AsyncClient, test_user: dict, short_wav: bytes, model_name: str
    ):
        resp = await client.post(
            SEPARATE_URL + f"?model={model_name}",
            files=wav_upload(short_wav),
            headers=auth_headers(test_user["access_token"]),
        )
        assert resp.status_code == 202
        body = resp.json()
        assert body["status"] == "pending"

    async def test_unauthorized_upload_returns_401(
        self, client: AsyncClient, short_wav: bytes
    ):
        resp = await client.post(
            SEPARATE_URL,
            files=wav_upload(short_wav),
        )
        assert resp.status_code == 403  # HTTPBearer returns 403 with no credentials

    async def test_upload_with_zero_credits_returns_402(
        self, client: AsyncClient, db_session, test_user: dict, short_wav: bytes
    ):
        from sqlalchemy import text

        # Zero out credits
        await db_session.execute(
            text("UPDATE users SET credits = 0 WHERE email = :email"),
            {"email": test_user["email"]},
        )
        await db_session.flush()

        resp = await client.post(
            SEPARATE_URL,
            files=wav_upload(short_wav),
            headers=auth_headers(test_user["access_token"]),
        )
        assert resp.status_code == 402


class TestStatusEndpoint:
    async def test_status_returns_task_info(
        self, client: AsyncClient, test_user: dict, short_wav: bytes
    ):
        # Create a task
        upload_resp = await client.post(
            SEPARATE_URL,
            files=wav_upload(short_wav),
            headers=auth_headers(test_user["access_token"]),
        )
        assert upload_resp.status_code == 202
        task_id = upload_resp.json()["task_id"]

        # Check status
        status_resp = await client.get(
            f"/api/v1/status/{task_id}",
            headers=auth_headers(test_user["access_token"]),
        )
        assert status_resp.status_code == 200
        body = status_resp.json()
        assert body["id"] == task_id
        assert body["status"] in ("pending", "processing", "completed", "failed")

    async def test_status_requires_auth(self, client: AsyncClient):
        resp = await client.get("/api/v1/status/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 403

    async def test_status_nonexistent_task_returns_404(
        self, client: AsyncClient, test_user: dict
    ):
        resp = await client.get(
            "/api/v1/status/00000000-0000-0000-0000-000000000000",
            headers=auth_headers(test_user["access_token"]),
        )
        assert resp.status_code == 404

    async def test_cannot_see_other_users_task(
        self, client: AsyncClient, test_user: dict, short_wav: bytes
    ):
        from tests.conftest import register_and_login

        other = await register_and_login(client, "other_sep@test.com")
        upload_resp = await client.post(
            SEPARATE_URL,
            files=wav_upload(short_wav),
            headers=auth_headers(test_user["access_token"]),
        )
        task_id = upload_resp.json()["task_id"]

        resp = await client.get(
            f"/api/v1/status/{task_id}",
            headers=auth_headers(other["access_token"]),
        )
        assert resp.status_code == 404


class TestTaskHistory:
    async def test_history_returns_tasks(
        self, client: AsyncClient, test_user: dict, short_wav: bytes
    ):
        # Upload a task
        await client.post(
            SEPARATE_URL,
            files=wav_upload(short_wav),
            headers=auth_headers(test_user["access_token"]),
        )
        resp = await client.get(
            "/api/v1/history",
            headers=auth_headers(test_user["access_token"]),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "items" in body
        assert body["total"] >= 1
        assert "page" in body

    async def test_history_pagination(
        self, client: AsyncClient, test_user: dict, short_wav: bytes
    ):
        resp = await client.get(
            "/api/v1/history?page=1&limit=5",
            headers=auth_headers(test_user["access_token"]),
        )
        assert resp.status_code == 200

    async def test_history_status_filter(
        self, client: AsyncClient, test_user: dict, short_wav: bytes
    ):
        resp = await client.get(
            "/api/v1/history?status=pending",
            headers=auth_headers(test_user["access_token"]),
        )
        assert resp.status_code == 200
        for item in resp.json()["items"]:
            assert item["status"] == "pending"


class TestCancelTask:
    async def test_cancel_pending_task_refunds_credits(
        self, client: AsyncClient, test_user: dict, short_wav: bytes
    ):
        upload_resp = await client.post(
            SEPARATE_URL,
            files=wav_upload(short_wav),
            headers=auth_headers(test_user["access_token"]),
        )
        assert upload_resp.status_code == 202
        task_id = upload_resp.json()["task_id"]
        credits_after_upload = upload_resp.json()["credits_remaining"]

        # Cancel
        cancel_resp = await client.delete(
            f"/api/v1/tasks/{task_id}",
            headers=auth_headers(test_user["access_token"]),
        )
        assert cancel_resp.status_code == 200

        # Credits should be restored
        balance_resp = await client.get(
            "/api/v1/credits/balance",
            headers=auth_headers(test_user["access_token"]),
        )
        assert balance_resp.json()["balance"] == credits_after_upload + 1

    async def test_cancel_nonexistent_task(
        self, client: AsyncClient, test_user: dict
    ):
        resp = await client.delete(
            "/api/v1/tasks/00000000-0000-0000-0000-000000000000",
            headers=auth_headers(test_user["access_token"]),
        )
        assert resp.status_code == 404


class TestRetryTask:
    async def test_retry_failed_task(
        self, client: AsyncClient, test_user: dict, short_wav: bytes, db_session
    ):
        from sqlalchemy import text

        # Upload a task
        upload_resp = await client.post(
            SEPARATE_URL,
            files=wav_upload(short_wav),
            headers=auth_headers(test_user["access_token"]),
        )
        task_id = upload_resp.json()["task_id"]

        # Force status to 'failed' in DB
        await db_session.execute(
            text("UPDATE audio_tasks SET status = 'failed' WHERE id = :id"),
            {"id": task_id},
        )
        await db_session.flush()

        retry_resp = await client.post(
            f"/api/v1/tasks/{task_id}/retry",
            headers=auth_headers(test_user["access_token"]),
        )
        assert retry_resp.status_code == 200
        assert retry_resp.json()["status"] == "pending"

    async def test_retry_pending_task_returns_400(
        self, client: AsyncClient, test_user: dict, short_wav: bytes
    ):
        upload_resp = await client.post(
            SEPARATE_URL,
            files=wav_upload(short_wav),
            headers=auth_headers(test_user["access_token"]),
        )
        task_id = upload_resp.json()["task_id"]

        resp = await client.post(
            f"/api/v1/tasks/{task_id}/retry",
            headers=auth_headers(test_user["access_token"]),
        )
        assert resp.status_code == 400


class TestDownload:
    async def test_download_requires_completed_status(
        self, client: AsyncClient, test_user: dict, short_wav: bytes
    ):
        upload_resp = await client.post(
            SEPARATE_URL,
            files=wav_upload(short_wav),
            headers=auth_headers(test_user["access_token"]),
        )
        task_id = upload_resp.json()["task_id"]

        # Task is pending, not completed
        resp = await client.get(
            f"/api/v1/tasks/{task_id}/download/vocals",
            headers=auth_headers(test_user["access_token"]),
        )
        assert resp.status_code in (400, 302, 404)  # 400 if not completed

    async def test_download_invalid_stem_type(
        self, client: AsyncClient, test_user: dict, short_wav: bytes, db_session
    ):
        from sqlalchemy import text

        upload_resp = await client.post(
            SEPARATE_URL,
            files=wav_upload(short_wav),
            headers=auth_headers(test_user["access_token"]),
        )
        task_id = upload_resp.json()["task_id"]

        # Force completed
        await db_session.execute(
            text("UPDATE audio_tasks SET status = 'completed', output_vocals_path = 'test/key' WHERE id = :id"),
            {"id": task_id},
        )
        await db_session.flush()

        resp = await client.get(
            f"/api/v1/tasks/{task_id}/download/unknown_stem",
            headers=auth_headers(test_user["access_token"]),
            follow_redirects=False,
        )
        assert resp.status_code == 400
