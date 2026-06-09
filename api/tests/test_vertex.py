from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.clients.vertex import VertexClient


@pytest.mark.asyncio
async def test_vertex_client_init() -> None:
    """Test VertexClient initializes vertexai SDK on-demand."""
    client = VertexClient(project_id="test-proj", location="us-central1", model_name="gemini-test")
    assert client.project_id == "test-proj"
    assert client.location == "us-central1"
    assert client.model_name == "gemini-test"
    assert not client._initialized

    with patch("vertexai.init") as mock_init:
        client._ensure_initialized()
        assert client._initialized
        mock_init.assert_called_once_with(project="test-proj", location="us-central1")


@pytest.mark.asyncio
async def test_vertex_client_init_failure() -> None:
    """Test VertexClient initialization failures raise RuntimeError."""
    client = VertexClient(project_id="test-proj", location="us-central1", model_name="gemini-test")
    with patch("vertexai.init", side_effect=Exception("Connection failed")):
        with pytest.raises(RuntimeError) as exc_info:
            client._ensure_initialized()
        assert "Vertex AI initialization failed" in str(exc_info.value)


@pytest.mark.asyncio
async def test_parse_trip_success() -> None:
    """Test VertexClient.parse_trip successfully extracts locations and transport mode."""
    client = VertexClient(project_id="test-proj", location="us-central1", model_name="gemini-test")

    mock_response = MagicMock()
    mock_response.text = '{"origin": "Paris", "destination": "Berlin", "mode": "train"}'

    mock_model = MagicMock()
    mock_model.generate_content.return_value = mock_response

    with (
        patch("vertexai.init"),
        patch("app.clients.vertex.GenerativeModel", return_value=mock_model),
    ):
        res = await client.parse_trip("Took a train from Paris to Berlin")
        assert res["origin"] == "Paris"
        assert res["destination"] == "Berlin"
        assert res["mode"] == "train"


@pytest.mark.asyncio
async def test_parse_trip_empty_response() -> None:
    """Test VertexClient.parse_trip handles empty text response from model."""
    client = VertexClient(project_id="test-proj", location="us-central1", model_name="gemini-test")

    mock_response = MagicMock()
    mock_response.text = ""

    mock_model = MagicMock()
    mock_model.generate_content.return_value = mock_response

    with (
        patch("vertexai.init"),
        patch("app.clients.vertex.GenerativeModel", return_value=mock_model),
    ):
        with pytest.raises(ValueError) as exc_info:
            await client.parse_trip("Drove home")
        assert "Gemini trip parsing failed" in str(exc_info.value)


@pytest.mark.asyncio
async def test_narrate_insights_success() -> None:
    """Test VertexClient.narrate_insights compiles valid output summary."""
    client = VertexClient(project_id="test-proj", location="us-central1", model_name="gemini-test")

    mock_response = MagicMock()
    mock_response.text = "Great job on keeping pledges!"

    mock_model = MagicMock()
    mock_model.generate_content.return_value = mock_response

    with (
        patch("vertexai.init"),
        patch("app.clients.vertex.GenerativeModel", return_value=mock_model),
    ):
        res = await client.narrate_insights(
            total_co2e=10.5,
            category_breakdown={"transport": 5.0, "food": 5.5},
            commitments=[{"title": "Eat less beef", "status": "active"}],
        )
        assert res == "Great job on keeping pledges!"


@pytest.mark.asyncio
async def test_narrate_insights_failure() -> None:
    """Test VertexClient.narrate_insights exceptions raise ValueError."""
    client = VertexClient(project_id="test-proj", location="us-central1", model_name="gemini-test")

    mock_model = MagicMock()
    mock_model.generate_content.side_effect = Exception("Model service down")

    with (
        patch("vertexai.init"),
        patch("app.clients.vertex.GenerativeModel", return_value=mock_model),
    ):
        with pytest.raises(ValueError) as exc_info:
            await client.narrate_insights(total_co2e=10.5, category_breakdown={}, commitments=[])
        assert "Gemini narration failed" in str(exc_info.value)
