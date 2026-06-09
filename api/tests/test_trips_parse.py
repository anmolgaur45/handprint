from __future__ import annotations

from typing import TYPE_CHECKING
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.clients.vertex import VertexClient
from app.core.dependencies import get_vertex_client
from app.main import app
from app.middleware.auth import get_current_user_id

if TYPE_CHECKING:
    from httpx import AsyncClient


@pytest.fixture(autouse=True)
def cleanup_overrides() -> None:
    """Clear dependency overrides to ensure clean slate."""
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_parse_trip_success(client: AsyncClient) -> None:
    """Test successful natural language trip details parsing."""
    mock_vertex = MagicMock(spec=VertexClient)
    mock_vertex.parse_trip = AsyncMock(
        return_value={
            "origin": "Paris",
            "destination": "London",
            "mode": "train",
        }
    )

    app.dependency_overrides[get_current_user_id] = lambda: "user_123"
    app.dependency_overrides[get_vertex_client] = lambda: mock_vertex

    payload = {"text": "I took a train from Paris to London"}
    headers = {"Authorization": "Bearer mock_token"}

    resp = await client.post("/trips/parse", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["origin"] == "Paris"
    assert data["destination"] == "London"
    assert data["mode"] == "train"

    mock_vertex.parse_trip.assert_called_once_with("I took a train from Paris to London")


@pytest.mark.asyncio
async def test_parse_trip_failure_fallback(client: AsyncClient) -> None:
    """Test that parsing fallback returns nulls if the Vertex AI call fails."""
    mock_vertex = MagicMock(spec=VertexClient)
    mock_vertex.parse_trip = AsyncMock(side_effect=ValueError("Gemini quota exceeded"))

    app.dependency_overrides[get_current_user_id] = lambda: "user_123"
    app.dependency_overrides[get_vertex_client] = lambda: mock_vertex

    payload = {"text": "I drove home"}
    headers = {"Authorization": "Bearer mock_token"}

    resp = await client.post("/trips/parse", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["origin"] is None
    assert data["destination"] is None
    assert data["mode"] is None

    mock_vertex.parse_trip.assert_called_once_with("I drove home")
