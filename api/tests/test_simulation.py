from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import AsyncClient

from app.core.dependencies import get_trip_log_repository
from app.domain.models import TripLog
from app.domain.simulation import (
    EVCarSwapCommand,
    ModeShiftCommand,
    ReduceTripsCommand,
    calculate_annual_scaling_factor,
)
from app.domain.transport import TransportEstimator
from app.main import app
from app.middleware.auth import get_current_user_id
from app.repositories.trip_log import TripLogRepository

# Standard datetime objects for predictable date spans
BASE_TIME = datetime(2026, 6, 1, 12, 0, 0)


def test_annual_scaling_factor_empty() -> None:
    """Empty list should return 0.0."""
    assert calculate_annual_scaling_factor([]) == 0.0


def test_annual_scaling_factor_single_day() -> None:
    """A single day (or < 7 days span) should scale as weekly average (7 days)."""
    trips = [
        TripLog(
            user_id="u1",
            origin="A",
            destination="B",
            distance_km=10.0,
            mode="petrol_car",
            co2e_kg=1.65,
            timestamp=BASE_TIME,
            citation="C",
            effective_year=2024,
        )
    ]
    # Span is 1 day. Enforced min is 7 days.
    # 365 / 7 = 52.142857...
    assert pytest.approx(calculate_annual_scaling_factor(trips)) == 365.0 / 7.0


def test_annual_scaling_factor_longer_span() -> None:
    """Span of 10 days should scale by 365 / 10 = 36.5."""
    trips = [
        TripLog(
            user_id="u1",
            origin="A",
            destination="B",
            distance_km=10.0,
            mode="petrol_car",
            co2e_kg=1.65,
            timestamp=BASE_TIME,
            citation="C",
            effective_year=2024,
        ),
        TripLog(
            user_id="u1",
            origin="B",
            destination="C",
            distance_km=10.0,
            mode="petrol_car",
            co2e_kg=1.65,
            timestamp=BASE_TIME + timedelta(days=9),  # 10 days inclusive span
            citation="C",
            effective_year=2024,
        ),
    ]
    assert calculate_annual_scaling_factor(trips) == 36.5


def test_ev_swap_command() -> None:
    """Petrol, Diesel, and Hybrid cars should swap to EV emissions; motorbike/train ignored."""
    estimator = TransportEstimator()
    # Factors:
    # petrol = 0.16489
    # diesel = 0.16398
    # hybrid = 0.11500
    # ev = 0.04690
    trips = [
        # Petrol: distance 10km. Original: 1.6489. EV: 0.4690. Saving: 1.1799
        TripLog(
            user_id="u1",
            origin="A",
            destination="B",
            distance_km=10.0,
            mode="petrol_car",
            co2e_kg=10.0 * 0.16489,
            timestamp=BASE_TIME,
            citation="C",
            effective_year=2024,
        ),
        # Train: distance 100km. Original: 3.549. EV: ignored. Saving: 0.0
        TripLog(
            user_id="u1",
            origin="A",
            destination="B",
            distance_km=100.0,
            mode="train",
            co2e_kg=100.0 * 0.03549,
            timestamp=BASE_TIME,
            citation="C",
            effective_year=2024,
        ),
    ]
    command = EVCarSwapCommand()
    raw_saving = 1.1799
    expected_annual_saving = raw_saving * (365.0 / 7.0)

    assert pytest.approx(command.execute(trips, estimator)) == expected_annual_saving


def test_mode_shift_command() -> None:
    """Simulate shifting 50% of car trips to bus."""
    estimator = TransportEstimator()
    # petrol = 0.16489, bus = 0.09658
    trips = [
        # Original: 10km * 0.16489 = 1.6489. Bus: 10 * 0.09658 = 0.9658.
        # Savings: 1.6489 - 0.9658 = 0.6831. With 50% shift = 0.34155
        TripLog(
            user_id="u1",
            origin="A",
            destination="B",
            distance_km=10.0,
            mode="petrol_car",
            co2e_kg=10.0 * 0.16489,
            timestamp=BASE_TIME,
            citation="C",
            effective_year=2024,
        )
    ]
    command = ModeShiftCommand(target_mode="bus", percentage=0.5)
    expected_saving = 0.34155 * (365.0 / 7.0)
    assert pytest.approx(command.execute(trips, estimator)) == expected_saving


def test_reduce_trips_command() -> None:
    """Simulate reducing travel by 20% overall."""
    estimator = TransportEstimator()
    trips = [
        TripLog(
            user_id="u1",
            origin="A",
            destination="B",
            distance_km=10.0,
            mode="petrol_car",
            co2e_kg=10.0 * 0.16489,
            timestamp=BASE_TIME,
            citation="C",
            effective_year=2024,
        )
    ]
    command = ReduceTripsCommand(percentage=0.2)
    expected_saving = (10.0 * 0.16489 * 0.2) * (365.0 / 7.0)
    assert pytest.approx(command.execute(trips, estimator)) == expected_saving


@pytest.mark.asyncio
async def test_simulate_endpoint_unauthorized(client: AsyncClient) -> None:
    """Post to /trips/simulate without token returns 401."""
    # Temporarily remove auth override if set
    if get_current_user_id in app.dependency_overrides:
        del app.dependency_overrides[get_current_user_id]

    res = await client.post("/trips/simulate", json={"scenario": "ev_swap"})
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_simulate_endpoint_empty_logs(client: AsyncClient) -> None:
    """User with no logs returns zeroed metrics."""
    mock_repo = MagicMock(spec=TripLogRepository)
    mock_repo.list_by_user = AsyncMock(return_value=[])

    app.dependency_overrides[get_current_user_id] = lambda: "user_abc"
    app.dependency_overrides[get_trip_log_repository] = lambda: mock_repo

    headers = {"Authorization": "Bearer mock_token"}
    res = await client.post("/trips/simulate", json={"scenario": "ev_swap"}, headers=headers)

    assert res.status_code == 200
    data = res.json()
    assert data["scenario"] == "ev_swap"
    assert data["base_annual_co2e_kg"] == 0.0
    assert data["annual_savings_co2e_kg"] == 0.0


@pytest.mark.asyncio
async def test_simulate_endpoint_success_ev_swap(client: AsyncClient) -> None:
    """EV Swap scenario calculates successfully."""
    trips = [
        TripLog(
            id="1",
            user_id="user_abc",
            origin="Origin",
            destination="Dest",
            distance_km=10.0,
            mode="petrol_car",
            co2e_kg=10.0 * 0.16489,
            timestamp=BASE_TIME,
            citation="C",
            effective_year=2024,
        )
    ]
    mock_repo = MagicMock(spec=TripLogRepository)
    mock_repo.list_by_user = AsyncMock(return_value=trips)

    app.dependency_overrides[get_current_user_id] = lambda: "user_abc"
    app.dependency_overrides[get_trip_log_repository] = lambda: mock_repo

    headers = {"Authorization": "Bearer mock_token"}
    res = await client.post("/trips/simulate", json={"scenario": "ev_swap"}, headers=headers)

    assert res.status_code == 200
    data = res.json()
    assert data["scenario"] == "ev_swap"

    scale = 365.0 / 7.0
    expected_base = (10.0 * 0.16489) * scale
    expected_savings = (10.0 * (0.16489 - 0.04690)) * scale

    assert pytest.approx(data["base_annual_co2e_kg"]) == expected_base
    assert pytest.approx(data["annual_savings_co2e_kg"]) == expected_savings
    assert pytest.approx(data["percentage_reduction"]) == (
        (0.16489 - 0.04690) / 0.16489 * 100.0
    )


@pytest.mark.asyncio
async def test_simulate_endpoint_success_mode_shift(client: AsyncClient) -> None:
    """Mode shift scenario shifts 100% of trips to walking."""
    trips = [
        TripLog(
            id="1",
            user_id="user_abc",
            origin="Origin",
            destination="Dest",
            distance_km=10.0,
            mode="petrol_car",
            co2e_kg=10.0 * 0.16489,
            timestamp=BASE_TIME,
            citation="C",
            effective_year=2024,
        )
    ]
    mock_repo = MagicMock(spec=TripLogRepository)
    mock_repo.list_by_user = AsyncMock(return_value=trips)

    app.dependency_overrides[get_current_user_id] = lambda: "user_abc"
    app.dependency_overrides[get_trip_log_repository] = lambda: mock_repo

    headers = {"Authorization": "Bearer mock_token"}
    payload = {"scenario": "mode_shift", "target_mode": "walking", "percentage": 1.0}
    res = await client.post("/trips/simulate", json=payload, headers=headers)

    assert res.status_code == 200
    data = res.json()
    assert data["scenario"] == "mode_shift"
    # Walking is 0.0 factor. Shifting 100% should save 100%
    assert pytest.approx(data["percentage_reduction"]) == 100.0


@pytest.mark.asyncio
async def test_simulate_endpoint_bad_requests(client: AsyncClient) -> None:
    """Verify endpoint rejects invalid payloads."""
    app.dependency_overrides[get_current_user_id] = lambda: "user_abc"
    headers = {"Authorization": "Bearer mock_token"}

    # 1. Mode shift missing target_mode
    res = await client.post(
        "/trips/simulate", json={"scenario": "mode_shift", "percentage": 0.5}, headers=headers
    )
    assert res.status_code == 400
    assert "target_mode is required" in res.json()["detail"]

    # 2. Invalid target mode
    res = await client.post(
        "/trips/simulate",
        json={"scenario": "mode_shift", "target_mode": "invalid_mode", "percentage": 0.5},
        headers=headers,
    )
    assert res.status_code == 400

    # 3. Percentage out of bounds
    res = await client.post(
        "/trips/simulate", json={"scenario": "reduce_trips", "percentage": 1.5}, headers=headers
    )
    assert res.status_code == 422  # Pydantic validation error for le=1.0
