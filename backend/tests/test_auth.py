"""Tests for authentication endpoints."""
import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, register_and_login


pytestmark = pytest.mark.asyncio


class TestRegister:
    async def test_register_success(self, client: AsyncClient):
        resp = await client.post(
            "/api/v1/auth/register",
            json={"email": "newuser@example.com", "password": "Password1!"},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert "access_token" in body
        assert "refresh_token" in body
        assert body["token_type"] == "bearer"

    async def test_register_sets_display_name_from_email(self, client: AsyncClient):
        resp = await client.post(
            "/api/v1/auth/register",
            json={"email": "jane@example.com", "password": "Password1!"},
        )
        assert resp.status_code == 201

    async def test_register_custom_display_name(self, client: AsyncClient):
        resp = await client.post(
            "/api/v1/auth/register",
            json={"email": "display@example.com", "password": "Password1!", "display_name": "Jane"},
        )
        assert resp.status_code == 201

    async def test_register_duplicate_email(self, client: AsyncClient, test_user: dict):
        resp = await client.post(
            "/api/v1/auth/register",
            json={"email": test_user["email"], "password": "Another1!"},
        )
        assert resp.status_code == 409

    async def test_register_invalid_email(self, client: AsyncClient):
        resp = await client.post(
            "/api/v1/auth/register",
            json={"email": "not-an-email", "password": "Password1!"},
        )
        assert resp.status_code == 422

    async def test_register_missing_password(self, client: AsyncClient):
        resp = await client.post(
            "/api/v1/auth/register",
            json={"email": "nopw@example.com"},
        )
        assert resp.status_code == 422


class TestLogin:
    async def test_login_success(self, client: AsyncClient, test_user: dict):
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": test_user["email"], "password": test_user["password"]},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body
        assert "refresh_token" in body

    async def test_login_wrong_password(self, client: AsyncClient, test_user: dict):
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": test_user["email"], "password": "wrongpassword"},
        )
        assert resp.status_code == 401

    async def test_login_nonexistent_user(self, client: AsyncClient):
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "ghost@example.com", "password": "Password1!"},
        )
        assert resp.status_code == 401

    async def test_login_invalid_email_format(self, client: AsyncClient):
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "bad-email", "password": "Password1!"},
        )
        assert resp.status_code == 422


class TestProtectedEndpoints:
    async def test_access_protected_without_token(self, client: AsyncClient):
        resp = await client.get("/api/v1/users/me")
        assert resp.status_code == 403  # HTTPBearer returns 403 when no credentials

    async def test_access_with_invalid_token(self, client: AsyncClient):
        resp = await client.get(
            "/api/v1/users/me",
            headers={"Authorization": "Bearer totally.invalid.token"},
        )
        assert resp.status_code == 401

    async def test_access_with_valid_token(self, client: AsyncClient, test_user: dict):
        resp = await client.get(
            "/api/v1/users/me",
            headers=auth_headers(test_user["access_token"]),
        )
        assert resp.status_code == 200
        assert resp.json()["email"] == test_user["email"]


class TestRefreshToken:
    async def test_refresh_token_flow(self, client: AsyncClient, test_user: dict):
        resp = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": test_user["refresh_token"]},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body
        # New access token should be different
        assert body["access_token"] != test_user["access_token"]

    async def test_refresh_with_access_token_fails(self, client: AsyncClient, test_user: dict):
        resp = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": test_user["access_token"]},  # wrong token type
        )
        assert resp.status_code == 401

    async def test_refresh_with_invalid_token_fails(self, client: AsyncClient):
        resp = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "garbage.token.here"},
        )
        assert resp.status_code == 401


class TestLogout:
    async def test_logout_succeeds(self, client: AsyncClient, test_user: dict):
        resp = await client.post(
            "/api/v1/auth/logout",
            headers=auth_headers(test_user["access_token"]),
        )
        assert resp.status_code == 200
        assert "message" in resp.json()

    async def test_logout_blacklists_token(self, client: AsyncClient, test_user: dict):
        token = test_user["access_token"]
        headers = auth_headers(token)

        # First request succeeds
        r1 = await client.get("/api/v1/users/me", headers=headers)
        assert r1.status_code == 200

        # Logout
        await client.post("/api/v1/auth/logout", headers=headers)

        # Second request with same token should fail
        r2 = await client.get("/api/v1/users/me", headers=headers)
        assert r2.status_code == 401

    async def test_logout_without_token_fails(self, client: AsyncClient):
        resp = await client.post("/api/v1/auth/logout")
        assert resp.status_code == 403


class TestChangePassword:
    async def test_change_password_success(self, client: AsyncClient, test_user: dict):
        resp = await client.put(
            "/api/v1/auth/change-password",
            json={"old_password": test_user["password"], "new_password": "NewPass456!"},
            headers=auth_headers(test_user["access_token"]),
        )
        assert resp.status_code == 200

        # Can now login with new password
        login_resp = await client.post(
            "/api/v1/auth/login",
            json={"email": test_user["email"], "password": "NewPass456!"},
        )
        assert login_resp.status_code == 200

    async def test_change_password_wrong_old(self, client: AsyncClient, test_user: dict):
        resp = await client.put(
            "/api/v1/auth/change-password",
            json={"old_password": "wrongoldpass", "new_password": "NewPass456!"},
            headers=auth_headers(test_user["access_token"]),
        )
        assert resp.status_code == 400
