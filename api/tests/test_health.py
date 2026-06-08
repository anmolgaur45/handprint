from __future__ import annotations

from typing import TYPE_CHECKING

import pytest

if TYPE_CHECKING:
    from httpx import AsyncClient


@pytest.mark.asyncio
async def test_healthz_returns_ok(client: AsyncClient) -> None:
    """GET /healthz returns 200 with status ok."""
    resp = await client.get("/healthz")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
