"""Tests for credit balance, transactions, and purchasing."""
import asyncio
import pytest
from httpx import AsyncClient
from unittest.mock import patch

from tests.conftest import auth_headers, make_wav_bytes, register_and_login


pytestmark = pytest.mark.asyncio

SEPARATE_URL = "/api/v1/separate"


def wav_upload(data: bytes, filename: str = "test.wav") -> dict:
    return {"file": (filename, data, "audio/wav")}


class TestInitialCredits:
    async def test_new_user_has_10_credits(self, client: AsyncClient, test_user: dict):
        resp = await client.get(
            "/api/v1/credits/balance",
            headers=auth_headers(test_user["access_token"]),
        )
        assert resp.status_code == 200
        assert resp.json()["balance"] == 10


class TestCreditCost:
    async def test_short_file_costs_1_credit(
        self, client: AsyncClient, test_user: dict
    ):
        with patch("routers.separate.get_duration", return_value=60.0):  # 1 min
            resp = await client.post(
                SEPARATE_URL,
                files=wav_upload(make_wav_bytes(1.0)),
                headers=auth_headers(test_user["access_token"]),
            )
        assert resp.status_code == 202
        assert resp.json()["credit_consumed"] == 1
        assert resp.json()["credits_remaining"] == 9

    async def test_medium_file_costs_2_credits(
        self, client: AsyncClient, test_user: dict
    ):
        with patch("routers.separate.get_duration", return_value=360.0):  # 6 min
            resp = await client.post(
                SEPARATE_URL,
                files=wav_upload(make_wav_bytes(1.0)),
                headers=auth_headers(test_user["access_token"]),
            )
        assert resp.status_code == 202
        assert resp.json()["credit_consumed"] == 2
        assert resp.json()["credits_remaining"] == 8

    async def test_zero_credits_rejected_402(
        self, client: AsyncClient, db_session, test_user: dict
    ):
        from sqlalchemy import text

        await db_session.execute(
            text("UPDATE users SET credits = 0 WHERE email = :email"),
            {"email": test_user["email"]},
        )
        await db_session.flush()

        with patch("routers.separate.get_duration", return_value=60.0):
            resp = await client.post(
                SEPARATE_URL,
                files=wav_upload(make_wav_bytes(1.0)),
                headers=auth_headers(test_user["access_token"]),
            )
        assert resp.status_code == 402

    async def test_1_credit_rejects_medium_file_when_only_1_credit_left(
        self, client: AsyncClient, db_session, test_user: dict
    ):
        from sqlalchemy import text

        await db_session.execute(
            text("UPDATE users SET credits = 1 WHERE email = :email"),
            {"email": test_user["email"]},
        )
        await db_session.flush()

        with patch("routers.separate.get_duration", return_value=360.0):  # costs 2
            resp = await client.post(
                SEPARATE_URL,
                files=wav_upload(make_wav_bytes(1.0)),
                headers=auth_headers(test_user["access_token"]),
            )
        assert resp.status_code == 402


class TestRefund:
    async def test_cancel_task_triggers_refund(
        self, client: AsyncClient, test_user: dict
    ):
        with patch("routers.separate.get_duration", return_value=60.0):
            upload = await client.post(
                SEPARATE_URL,
                files=wav_upload(make_wav_bytes(1.0)),
                headers=auth_headers(test_user["access_token"]),
            )
        assert upload.status_code == 202
        task_id = upload.json()["task_id"]
        credits_after = upload.json()["credits_remaining"]

        # Cancel → refund
        await client.delete(
            f"/api/v1/tasks/{task_id}",
            headers=auth_headers(test_user["access_token"]),
        )

        balance = await client.get(
            "/api/v1/credits/balance",
            headers=auth_headers(test_user["access_token"]),
        )
        assert balance.json()["balance"] == credits_after + 1


class TestTransactionHistory:
    async def test_transaction_history_accurate(
        self, client: AsyncClient, test_user: dict
    ):
        # Should have the initial "welcome credits" transaction
        resp = await client.get(
            "/api/v1/credits/transactions",
            headers=auth_headers(test_user["access_token"]),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] >= 1
        types = {t["type"] for t in body["items"]}
        assert "initial" in types

    async def test_transaction_logged_after_upload(
        self, client: AsyncClient, test_user: dict
    ):
        with patch("routers.separate.get_duration", return_value=60.0):
            await client.post(
                SEPARATE_URL,
                files=wav_upload(make_wav_bytes(1.0)),
                headers=auth_headers(test_user["access_token"]),
            )

        resp = await client.get(
            "/api/v1/credits/transactions",
            headers=auth_headers(test_user["access_token"]),
        )
        types = [t["type"] for t in resp.json()["items"]]
        assert "deduction" in types

    async def test_transaction_pagination(
        self, client: AsyncClient, test_user: dict
    ):
        resp = await client.get(
            "/api/v1/credits/transactions?page=1&limit=5",
            headers=auth_headers(test_user["access_token"]),
        )
        assert resp.status_code == 200
        assert "has_next" in resp.json()


class TestPurchase:
    async def test_purchase_credits(self, client: AsyncClient, test_user: dict):
        resp = await client.post(
            "/api/v1/credits/purchase",
            json={"amount": 5},
            headers=auth_headers(test_user["access_token"]),
        )
        assert resp.status_code == 200
        # Balance check
        balance = await client.get(
            "/api/v1/credits/balance",
            headers=auth_headers(test_user["access_token"]),
        )
        assert balance.json()["balance"] == 15

    async def test_purchase_zero_credits_rejected(
        self, client: AsyncClient, test_user: dict
    ):
        resp = await client.post(
            "/api/v1/credits/purchase",
            json={"amount": 0},
            headers=auth_headers(test_user["access_token"]),
        )
        assert resp.status_code == 400

    async def test_purchase_too_many_credits_rejected(
        self, client: AsyncClient, test_user: dict
    ):
        resp = await client.post(
            "/api/v1/credits/purchase",
            json={"amount": 9999},
            headers=auth_headers(test_user["access_token"]),
        )
        assert resp.status_code == 400


class TestRedeemCode:
    async def test_redeem_valid_promo_code(self, client: AsyncClient, test_user: dict):
        resp = await client.post(
            "/api/v1/credits/redeem",
            json={"code": "WELCOME10"},
            headers=auth_headers(test_user["access_token"]),
        )
        assert resp.status_code == 200
        balance = await client.get(
            "/api/v1/credits/balance",
            headers=auth_headers(test_user["access_token"]),
        )
        assert balance.json()["balance"] == 20

    async def test_redeem_invalid_code(self, client: AsyncClient, test_user: dict):
        resp = await client.post(
            "/api/v1/credits/redeem",
            json={"code": "DOESNOTEXIST"},
            headers=auth_headers(test_user["access_token"]),
        )
        assert resp.status_code == 400

    async def test_redeem_case_insensitive(self, client: AsyncClient, test_user: dict):
        resp = await client.post(
            "/api/v1/credits/redeem",
            json={"code": "bonus5"},
            headers=auth_headers(test_user["access_token"]),
        )
        assert resp.status_code == 200


class TestConcurrentUploads:
    async def test_concurrent_uploads_no_double_deduction(
        self, client: AsyncClient, db_session
    ):
        """Race condition test: 5 concurrent uploads for a user with 3 credits.
        Only 3 should succeed (at 1 credit each), rest should get 402."""
        from sqlalchemy import text

        user = await register_and_login(client, "race_test@test.com")

        # Set to 3 credits
        await db_session.execute(
            text("UPDATE users SET credits = 3 WHERE email = :email"),
            {"email": user["email"]},
        )
        await db_session.flush()

        async def upload():
            with patch("routers.separate.get_duration", return_value=60.0):
                return await client.post(
                    SEPARATE_URL,
                    files={"file": ("t.wav", make_wav_bytes(1.0), "audio/wav")},
                    headers=auth_headers(user["access_token"]),
                )

        responses = await asyncio.gather(*[upload() for _ in range(5)])
        statuses = [r.status_code for r in responses]

        successes = statuses.count(202)
        failures = statuses.count(402)

        # Exactly 3 should succeed (3 credits), 2 should fail with 402
        assert successes == 3
        assert failures == 2

        # Final balance should be 0
        balance_resp = await client.get(
            "/api/v1/credits/balance",
            headers=auth_headers(user["access_token"]),
        )
        assert balance_resp.json()["balance"] == 0
