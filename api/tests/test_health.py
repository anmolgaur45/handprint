from __future__ import annotations

from typing import TYPE_CHECKING

import pytest

if TYPE_CHECKING:
    from httpx import AsyncClient


@pytest.mark.asyncio
async def test_healthz_returns_ok(client: AsyncClient) -> None:
    """GET /health returns 200 with status ok."""
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_security_txt_returns_text(client: AsyncClient) -> None:
    """GET /.well-known/security.txt returns contact info."""
    resp = await client.get("/.well-known/security.txt")
    assert resp.status_code == 200
    assert "Contact:" in resp.text
