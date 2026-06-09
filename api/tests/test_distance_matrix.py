from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from app.clients.distance_matrix import DistanceMatrixClient


@pytest.mark.asyncio
async def test_get_distance_fallback_no_api_key() -> None:
    """Verify that the client returns the fallback distance when no API key is set."""
    http_client = MagicMock(spec=httpx.AsyncClient)
    client = DistanceMatrixClient(api_key="", http_client=http_client)

    dist = await client.get_distance("origin_loc", "dest_loc")
    assert dist == 12.5
    http_client.get.assert_not_called()


@pytest.mark.asyncio
async def test_get_distance_success() -> None:
    """Verify successful driving distance retrieval from Distance Matrix API."""
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "status": "OK",
        "rows": [
            {
                "elements": [
                    {
                        "status": "OK",
                        "distance": {"text": "15.0 km", "value": 15000},
                    }
                ]
            }
        ],
    }

    http_client = MagicMock(spec=httpx.AsyncClient)
    http_client.get = AsyncMock(return_value=mock_response)

    client = DistanceMatrixClient(api_key="mock_key", http_client=http_client)
    dist = await client.get_distance("origin_loc", "dest_loc")

    assert dist == 15.0
    http_client.get.assert_called_once()


@pytest.mark.asyncio
async def test_get_distance_api_error_status() -> None:
    """Verify exception raising when API status is not OK."""
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "status": "REQUEST_DENIED",
        "error_message": "The provided API key is invalid.",
    }

    http_client = MagicMock(spec=httpx.AsyncClient)
    http_client.get = AsyncMock(return_value=mock_response)

    client = DistanceMatrixClient(api_key="mock_key", http_client=http_client)

    with pytest.raises(ValueError, match="Distance Matrix API status error"):
        await client.get_distance("origin_loc", "dest_loc")


@pytest.mark.asyncio
async def test_get_distance_route_error_status() -> None:
    """Verify exception raising when routing status is not OK (e.g. ZERO_RESULTS)."""
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "status": "OK",
        "rows": [{"elements": [{"status": "ZERO_RESULTS"}]}],
    }

    http_client = MagicMock(spec=httpx.AsyncClient)
    http_client.get = AsyncMock(return_value=mock_response)

    client = DistanceMatrixClient(api_key="mock_key", http_client=http_client)

    with pytest.raises(ValueError, match="Distance Matrix route error"):
        await client.get_distance("origin_loc", "dest_loc")


@pytest.mark.asyncio
async def test_get_distance_http_exception() -> None:
    """Verify exception raising on network/HTTP status errors."""
    http_client = MagicMock(spec=httpx.AsyncClient)
    http_client.get = AsyncMock(side_effect=httpx.HTTPError("Connection timed out"))

    client = DistanceMatrixClient(api_key="mock_key", http_client=http_client)

    with pytest.raises(ValueError, match="Failed to query Distance Matrix"):
        await client.get_distance("origin_loc", "dest_loc")
