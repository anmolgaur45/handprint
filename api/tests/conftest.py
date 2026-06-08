"""Shared test fixtures."""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest
from httpx import ASGITransport, AsyncClient

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

from app.main import app


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    """Async HTTP client wired to the FastAPI test app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
