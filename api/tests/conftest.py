"""Shared test fixtures."""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest
from httpx import ASGITransport, AsyncClient

if TYPE_CHECKING:
    from collections.abc import AsyncIterator, Iterator

import app.core.dependencies as _deps
from app.main import app


@pytest.fixture(autouse=True)
def _reset_firestore_singleton() -> Iterator[None]:
    """Reset the _firestore_client global before and after each test.

    Prevents singleton state from leaking between tests that directly exercise
    get_firestore_client() rather than injecting mock repositories.
    """
    _deps._firestore_client = None
    _deps._http_client = None
    app.state.rate_limiter._hits.clear()
    yield
    _deps._firestore_client = None
    _deps._http_client = None
    app.state.rate_limiter._hits.clear()


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    """Async HTTP client wired to the FastAPI test app.

    Sends 'origin: http://test' on every request so the CSRF middleware
    (which now requires at least one of Origin/Referer) does not block
    tests that exercise state-changing routes.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"origin": "http://test"},
    ) as ac:
        yield ac
