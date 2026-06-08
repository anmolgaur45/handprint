"""Tests for security-headers middleware."""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest

if TYPE_CHECKING:
    from httpx import AsyncClient


@pytest.mark.asyncio
async def test_security_headers_present(client: AsyncClient) -> None:
    """Every response carries the full security header set."""
    resp = await client.get("/healthz")
    assert resp.status_code == 200

    assert resp.headers["content-security-policy"].startswith("default-src 'none'")
    assert "max-age=" in resp.headers["strict-transport-security"]
    assert resp.headers["x-frame-options"] == "DENY"
    assert resp.headers["x-content-type-options"] == "nosniff"
    assert resp.headers["referrer-policy"] == "strict-origin-when-cross-origin"
    assert "camera=()" in resp.headers["permissions-policy"]
    assert resp.headers["cross-origin-opener-policy"] == "same-origin"
    assert resp.headers["cross-origin-resource-policy"] == "same-origin"


@pytest.mark.asyncio
async def test_x_request_id_generated(client: AsyncClient) -> None:
    """A fresh X-Request-ID is generated when none is provided."""
    resp = await client.get("/healthz")
    request_id = resp.headers.get("x-request-id")
    assert request_id is not None
    assert len(request_id) == 32  # uuid4 hex


@pytest.mark.asyncio
async def test_x_request_id_forwarded(client: AsyncClient) -> None:
    """An incoming X-Request-ID is forwarded through."""
    resp = await client.get("/healthz", headers={"x-request-id": "test-id-123"})
    assert resp.headers["x-request-id"] == "test-id-123"
