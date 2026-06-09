from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import AsyncClient

from app.core.dependencies import (
    get_streak_repository,
    get_trip_log_repository,
)
from app.domain.models import TripLog
from app.main import app
from app.middleware.auth import get_current_user_id
from app.repositories.streak import StreakRepository
from app.repositories.trip_log import TripLogRepository


@pytest.fixture(autouse=True)
def cleanup_overrides() -> None:
    """Clear overrides and mock repositories to avoid CI credential errors."""
    app.dependency_overrides.clear()

    mock_streak_repo = MagicMock(spec=StreakRepository)
    mock_streak_repo.get_by_user = AsyncMock(return_value=None)
    mock_streak_repo.upsert = AsyncMock()
    app.dependency_overrides[get_streak_repository] = lambda: mock_streak_repo

    mock_trip_repo = MagicMock(spec=TripLogRepository)
    app.dependency_overrides[get_trip_log_repository] = lambda: mock_trip_repo


@pytest.mark.asyncio
async def test_create_trip_success(client: AsyncClient) -> None:
    """Test successful trip creation and emission estimation."""
    mock_repo = MagicMock(spec=TripLogRepository)
    timestamp = datetime.now(UTC)

    # Mock the save operation to return the saved trip log
    async def mock_create(trip: TripLog) -> TripLog:
        return trip.model_copy(update={"id": "trip_123", "timestamp": timestamp})

    mock_repo.create = AsyncMock(side_effect=mock_create)

    # Inject dependencies
    app.dependency_overrides[get_current_user_id] = lambda: "user_abc"
    app.dependency_overrides[get_trip_log_repository] = lambda: mock_repo

    payload = {
        "origin": "Bengaluru",
        "destination": "Mysuru",
        "distance_km": 150.0,
        "mode": "petrol_car",
    }
    headers = {"Authorization": "Bearer mock_token"}

    response = await client.post("/trips", json=payload, headers=headers)

    assert response.status_code == 201
    data = response.json()
    assert data["id"] == "trip_123"
    assert data["user_id"] == "user_abc"
    assert data["origin"] == "Bengaluru"
    assert data["distance_km"] == 150.0
    # Expected emissions: 150.0 * 0.16489 = 24.7335 kg CO2e
    assert pytest.approx(data["co2e_kg"]) == 24.7335
    assert data["citation"] == "UK DESNZ/DEFRA Greenhouse Gas Conversion Factors"
    assert data["effective_year"] == 2024


@pytest.mark.asyncio
async def test_create_trip_invalid_mode(client: AsyncClient) -> None:
    """Test trip creation failure with an invalid transport mode."""
    mock_repo = MagicMock(spec=TripLogRepository)

    app.dependency_overrides[get_current_user_id] = lambda: "user_abc"
    app.dependency_overrides[get_trip_log_repository] = lambda: mock_repo

    payload = {
        "origin": "A",
        "destination": "B",
        "distance_km": 10.0,
        "mode": "rocket",  # Invalid mode
    }
    headers = {"Authorization": "Bearer mock_token"}

    response = await client.post("/trips", json=payload, headers=headers)

    assert response.status_code == 400
    assert "Unknown transport mode" in response.json()["detail"]


@pytest.mark.asyncio
async def test_create_trip_validation_errors(client: AsyncClient) -> None:
    """Test Pydantic validation boundaries on POST /trips."""
    app.dependency_overrides[get_current_user_id] = lambda: "user_abc"
    headers = {"Authorization": "Bearer mock_token"}

    # Case 1: distance_km is 0
    payload_zero_dist = {
        "origin": "A",
        "destination": "B",
        "distance_km": 0.0,
        "mode": "bus",
    }
    res = await client.post("/trips", json=payload_zero_dist, headers=headers)
    assert res.status_code == 422

    # Case 2: distance_km exceeds 10,000 km limit
    payload_huge_dist = {
        "origin": "A",
        "destination": "B",
        "distance_km": 15000.0,
        "mode": "bus",
    }
    res = await client.post("/trips", json=payload_huge_dist, headers=headers)
    assert res.status_code == 422

    # Case 3: missing mode
    payload_no_mode = {
        "distance_km": 10.0,
    }
    res = await client.post("/trips", json=payload_no_mode, headers=headers)
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_list_trips_success(client: AsyncClient) -> None:
    """Test successful retrieval of trip logs."""
    mock_repo = MagicMock(spec=TripLogRepository)
    timestamp = datetime.now(UTC)
    mock_trips = [
        TripLog(
            id="trip_1",
            user_id="user_abc",
            origin="A",
            destination="B",
            distance_km=10.0,
            mode="bus",
            co2e_kg=0.96,
            timestamp=timestamp,
            citation="DEFRA",
            effective_year=2024,
        )
    ]
    mock_repo.list_by_user = AsyncMock(return_value=mock_trips)

    app.dependency_overrides[get_current_user_id] = lambda: "user_abc"
    app.dependency_overrides[get_trip_log_repository] = lambda: mock_repo

    headers = {"Authorization": "Bearer mock_token"}

    response = await client.get("/trips", headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == "trip_1"
    assert data[0]["origin"] == "A"
    assert data[0]["co2e_kg"] == 0.96
    mock_repo.list_by_user.assert_called_once_with("user_abc")


@pytest.mark.asyncio
async def test_trips_auth_missing(client: AsyncClient) -> None:
    """Test that requests without credentials are rejected."""
    # POST without Auth header
    res = await client.post("/trips", json={})
    assert res.status_code == 401

    # GET without Auth header
    res = await client.get("/trips")
    assert res.status_code == 401


