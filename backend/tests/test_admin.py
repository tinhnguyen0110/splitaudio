"""Tests for admin-only endpoints."""
import pytest
from httpx import AsyncClient
from sqlalchemy import text

from tests.conftest import auth_headers, register_and_login


pytestmark = pytest.mark.asyncio


class TestAdminUsers:
    async def test_admin_can_list_users(
        self, client: AsyncClient, admin_user: dict, test_user: dict
    ):
        resp = await client.get(
            "/api/v1/admin/users",
            headers=auth_headers(admin_user["access_token"]),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body, list)
        assert len(body) >= 1

    async def test_non_admin_gets_403(
        self, client: AsyncClient, test_user: dict
    ):
        resp = await client.get(
            "/api/v1/admin/users",
            headers=auth_headers(test_user["access_token"]),
        )
        assert resp.status_code == 403

    async def test_unauthenticated_gets_403(self, client: AsyncClient):
        resp = await client.get("/api/v1/admin/users")
        assert resp.status_code == 403

    async def test_admin_list_users_pagination(
        self, client: AsyncClient, admin_user: dict
    ):
        resp = await client.get(
            "/api/v1/admin/users?page=1&limit=10",
            headers=auth_headers(admin_user["access_token"]),
        )
        assert resp.status_code == 200


class TestAdminStats:
    async def test_admin_can_view_stats(
        self, client: AsyncClient, admin_user: dict
    ):
        resp = await client.get(
            "/api/v1/admin/stats",
            headers=auth_headers(admin_user["access_token"]),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "total_users" in body
        assert "total_tasks" in body
        assert "tasks_by_status" in body
        assert "total_credits_consumed" in body

    async def test_non_admin_cannot_view_stats(
        self, client: AsyncClient, test_user: dict
    ):
        resp = await client.get(
            "/api/v1/admin/stats",
            headers=auth_headers(test_user["access_token"]),
        )
        assert resp.status_code == 403

    async def test_stats_total_users_positive(
        self, client: AsyncClient, admin_user: dict, test_user: dict
    ):
        resp = await client.get(
            "/api/v1/admin/stats",
            headers=auth_headers(admin_user["access_token"]),
        )
        assert resp.json()["total_users"] >= 2  # at least admin + test_user


class TestAdminAdjustCredits:
    async def test_admin_can_add_credits(
        self, client: AsyncClient, admin_user: dict, test_user: dict, db_session
    ):
        # Get target user's DB id
        result = await db_session.execute(
            text("SELECT id FROM users WHERE email = :email"),
            {"email": test_user["email"]},
        )
        user_id = str(result.scalar_one())

        resp = await client.put(
            f"/api/v1/admin/users/{user_id}/credits",
            json={"amount": 5, "description": "Test bonus"},
            headers=auth_headers(admin_user["access_token"]),
        )
        assert resp.status_code == 200
        assert resp.json()["new_balance"] == 15

    async def test_admin_can_deduct_credits(
        self, client: AsyncClient, admin_user: dict, test_user: dict, db_session
    ):
        result = await db_session.execute(
            text("SELECT id FROM users WHERE email = :email"),
            {"email": test_user["email"]},
        )
        user_id = str(result.scalar_one())

        resp = await client.put(
            f"/api/v1/admin/users/{user_id}/credits",
            json={"amount": -3},
            headers=auth_headers(admin_user["access_token"]),
        )
        assert resp.status_code == 200
        assert resp.json()["new_balance"] == 7

    async def test_non_admin_cannot_adjust_credits(
        self, client: AsyncClient, test_user: dict, db_session
    ):
        result = await db_session.execute(
            text("SELECT id FROM users WHERE email = :email"),
            {"email": test_user["email"]},
        )
        user_id = str(result.scalar_one())

        resp = await client.put(
            f"/api/v1/admin/users/{user_id}/credits",
            json={"amount": 100},
            headers=auth_headers(test_user["access_token"]),
        )
        assert resp.status_code == 403

    async def test_adjust_nonexistent_user_returns_404(
        self, client: AsyncClient, admin_user: dict
    ):
        resp = await client.put(
            "/api/v1/admin/users/00000000-0000-0000-0000-000000000000/credits",
            json={"amount": 5},
            headers=auth_headers(admin_user["access_token"]),
        )
        assert resp.status_code == 404

    async def test_adjust_zero_returns_400(
        self, client: AsyncClient, admin_user: dict, test_user: dict, db_session
    ):
        result = await db_session.execute(
            text("SELECT id FROM users WHERE email = :email"),
            {"email": test_user["email"]},
        )
        user_id = str(result.scalar_one())

        resp = await client.put(
            f"/api/v1/admin/users/{user_id}/credits",
            json={"amount": 0},
            headers=auth_headers(admin_user["access_token"]),
        )
        assert resp.status_code == 400
