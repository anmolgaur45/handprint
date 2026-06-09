"""Tests for application lifespan startup and shutdown."""

from __future__ import annotations

from typing import TYPE_CHECKING
from unittest.mock import MagicMock, patch

import pytest

import app.core.dependencies as deps
from app.core.dependencies import InMemoryAsyncClient

if TYPE_CHECKING:
    from collections.abc import Iterator


@pytest.fixture(autouse=True)
def _clean_singletons() -> Iterator[None]:
    """Reset shared singletons before and after every lifespan test."""
    deps._firestore_client = None
    deps._http_client = None
    yield
    deps._firestore_client = None
    deps._http_client = None


@pytest.mark.asyncio
async def test_lifespan_falls_back_to_in_memory_on_firestore_error() -> None:
    """Startup enables in-memory mode when the Firestore connectivity check raises."""
    from app.main import create_app, lifespan

    mock_db = MagicMock()
    mock_db.collection.return_value.limit.return_value.stream.side_effect = RuntimeError(
        "Simulated Firestore unreachable"
    )

    with (
        patch.object(deps, "get_firestore_client", return_value=mock_db),
        patch("app.middleware.auth.initialize_firebase"),
    ):
        fresh_app = create_app()
        async with lifespan(fresh_app):
            assert isinstance(deps._firestore_client, InMemoryAsyncClient)

    assert deps._firestore_client is None


@pytest.mark.asyncio
async def test_lifespan_clean_startup_when_firestore_responds() -> None:
    """Startup does NOT call enable_in_memory_mode when Firestore streams successfully."""
    from app.main import create_app, lifespan

    async def _empty():  # type: ignore[return]
        return
        yield  # pragma: no cover — makes this an async generator

    mock_db = MagicMock()
    mock_db.collection.return_value.limit.return_value.stream.return_value = _empty()

    with (
        patch.object(deps, "get_firestore_client", return_value=mock_db),
        patch("app.middleware.auth.initialize_firebase"),
        patch.object(deps, "enable_in_memory_mode") as mock_enable,
    ):
        fresh_app = create_app()
        async with lifespan(fresh_app):
            pass

    mock_enable.assert_not_called()


@pytest.mark.asyncio
async def test_close_clients_clears_both_singletons() -> None:
    """close_clients() sets _firestore_client and _http_client to None."""
    import httpx

    deps._firestore_client = InMemoryAsyncClient()  # type: ignore[assignment]
    deps._http_client = httpx.AsyncClient()

    await deps.close_clients()

    assert deps._firestore_client is None
    assert deps._http_client is None
