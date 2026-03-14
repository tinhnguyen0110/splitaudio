"""End-to-end tests covering complete user flows."""
import pytest
from httpx import AsyncClient
from sqlalchemy import text
from unittest.mock import patch

from tests.conftest import auth_headers, make_wav_bytes, register_and_login


pytestmark = pytest.mark.asyncio


class TestFullSeparationFlow:
    async def test_full_flow_register_upload_verify_credits(
        self, client: AsyncClient, db_session
    ):
        """
        Full happy path:
        register → login → check credits (10) → upload → verify credits deducted → check status
        """
        # 1. Register
        user = await register_and_login(client, "e2e_full@test.com")

        # 2. Check initial credits
        balance_resp = await client.get(
            "/api/v1/credits/balance",
            headers=auth_headers(user["access_token"]),
        )
        assert balance_resp.status_code == 200
        assert balance_resp.json()["balance"] == 10

        # 3. Upload audio (1-minute → 1 credit)
        with patch("routers.separate.get_duration", return_value=60.0):
            upload_resp = await client.post(
                "/api/v1/separate",
                files={"file": ("song.wav", make_wav_bytes(1.0), "audio/wav")},
                headers=auth_headers(user["access_token"]),
            )
        assert upload_resp.status_code == 202
        body = upload_resp.json()
        task_id = body["task_id"]
        assert body["credit_consumed"] == 1
        assert body["credits_remaining"] == 9

        # 4. Check balance reflects deduction
        balance_after = await client.get(
            "/api/v1/credits/balance",
            headers=auth_headers(user["access_token"]),
        )
        assert balance_after.json()["balance"] == 9

        # 5. Check task status
        status_resp = await client.get(
            f"/api/v1/status/{task_id}",
            headers=auth_headers(user["access_token"]),
        )
        assert status_resp.status_code == 200
        assert status_resp.json()["id"] == task_id

        # 6. Task appears in history
        history_resp = await client.get(
            "/api/v1/history",
            headers=auth_headers(user["access_token"]),
        )
        assert history_resp.status_code == 200
        assert history_resp.json()["total"] >= 1

    async def test_failure_refund_flow(
        self, client: AsyncClient, db_session
    ):
        """
        Upload → simulate processing failure → verify credits refunded.
        """
        user = await register_and_login(client, "e2e_refund@test.com")

        with patch("routers.separate.get_duration", return_value=60.0):
            upload_resp = await client.post(
                "/api/v1/separate",
                files={"file": ("audio.wav", make_wav_bytes(1.0), "audio/wav")},
                headers=auth_headers(user["access_token"]),
            )
        assert upload_resp.status_code == 202
        task_id = upload_resp.json()["task_id"]
        credits_after_upload = upload_resp.json()["credits_remaining"]  # 9

        # Simulate worker failure: cancel task (which triggers refund)
        cancel_resp = await client.delete(
            f"/api/v1/tasks/{task_id}",
            headers=auth_headers(user["access_token"]),
        )
        assert cancel_resp.status_code == 200

        # Credits restored
        balance = await client.get(
            "/api/v1/credits/balance",
            headers=auth_headers(user["access_token"]),
        )
        assert balance.json()["balance"] == credits_after_upload + 1  # back to 10

    async def test_multiple_uploads_credit_tracking(
        self, client: AsyncClient, db_session
    ):
        """
        Multiple uploads correctly track credit deductions in transaction history.
        """
        user = await register_and_login(client, "e2e_multi@test.com")

        # Upload 3 short files (3 credits total)
        for i in range(3):
            with patch("routers.separate.get_duration", return_value=60.0):
                resp = await client.post(
                    "/api/v1/separate",
                    files={"file": (f"track{i}.wav", make_wav_bytes(1.0), "audio/wav")},
                    headers=auth_headers(user["access_token"]),
                )
            assert resp.status_code == 202

        balance = await client.get(
            "/api/v1/credits/balance",
            headers=auth_headers(user["access_token"]),
        )
        assert balance.json()["balance"] == 7  # 10 - 3

        # Transaction history should show 3 deductions + 1 initial
        txns = await client.get(
            "/api/v1/credits/transactions",
            headers=auth_headers(user["access_token"]),
        )
        types = [t["type"] for t in txns.json()["items"]]
        assert types.count("deduction") == 3
        assert "initial" in types


class TestAuthLifecycle:
    async def test_register_login_logout_flow(self, client: AsyncClient):
        """Full auth lifecycle: register → access protected → logout → blocked."""
        user = await register_and_login(client, "e2e_auth@test.com")
        token = user["access_token"]

        # Access protected endpoint
        me_resp = await client.get(
            "/api/v1/users/me",
            headers=auth_headers(token),
        )
        assert me_resp.status_code == 200
        assert me_resp.json()["email"] == user["email"]

        # Logout
        logout_resp = await client.post(
            "/api/v1/auth/logout",
            headers=auth_headers(token),
        )
        assert logout_resp.status_code == 200

        # Token is now blacklisted
        me_after = await client.get(
            "/api/v1/users/me",
            headers=auth_headers(token),
        )
        assert me_after.status_code == 401

    async def test_refresh_and_use_new_token(self, client: AsyncClient):
        """Refresh token flow: get new access token and use it."""
        user = await register_and_login(client, "e2e_refresh@test.com")

        refresh_resp = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": user["refresh_token"]},
        )
        assert refresh_resp.status_code == 200
        new_token = refresh_resp.json()["access_token"]

        # New token works
        me_resp = await client.get(
            "/api/v1/users/me",
            headers=auth_headers(new_token),
        )
        assert me_resp.status_code == 200


class TestCreditPurchaseAndUse:
    async def test_purchase_then_upload(self, client: AsyncClient, db_session):
        """Purchase credits, then use them for separation."""
        user = await register_and_login(client, "e2e_purchase@test.com")

        # Drain credits to 0
        await db_session.execute(
            text("UPDATE users SET credits = 0 WHERE email = :email"),
            {"email": user["email"]},
        )
        await db_session.flush()

        # Try upload → should fail
        with patch("routers.separate.get_duration", return_value=60.0):
            no_credit_resp = await client.post(
                "/api/v1/separate",
                files={"file": ("a.wav", make_wav_bytes(1.0), "audio/wav")},
                headers=auth_headers(user["access_token"]),
            )
        assert no_credit_resp.status_code == 402

        # Purchase credits
        purchase_resp = await client.post(
            "/api/v1/credits/purchase",
            json={"amount": 5},
            headers=auth_headers(user["access_token"]),
        )
        assert purchase_resp.status_code == 200

        # Now upload succeeds
        with patch("routers.separate.get_duration", return_value=60.0):
            upload_resp = await client.post(
                "/api/v1/separate",
                files={"file": ("b.wav", make_wav_bytes(1.0), "audio/wav")},
                headers=auth_headers(user["access_token"]),
            )
        assert upload_resp.status_code == 202
        assert upload_resp.json()["credits_remaining"] == 4
