from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import AsyncClient

from app.core.dependencies import (
    get_committed_action_repository,
    get_streak_repository,
    get_trip_log_repository,
)
from app.domain.models import CommittedAction, TripLog, UserStreak
from app.main import app
from app.middleware.auth import get_current_user_id
from app.repositories.committed_action import CommittedActionRepository
from app.repositories.streak import StreakRepository
from app.repositories.trip_log import TripLogRepository

BASE_TIME = datetime(2026, 6, 8, 12, 0, 0)


@pytest.mark.asyncio
async def test_get_streak_empty(client: AsyncClient) -> None:
    """If no streak exists, return 0 counts."""
    mock_repo = MagicMock(spec=StreakRepository)
    mock_repo.get_by_user = AsyncMock(return_value=None)

    app.dependency_overrides[get_current_user_id] = lambda: "user_1"
    app.dependency_overrides[get_streak_repository] = lambda: mock_repo

    headers = {"Authorization": "Bearer mock_token"}
    res = await client.get("/streaks", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["current_streak"] == 0
    assert data["longest_streak"] == 0


@pytest.mark.asyncio
async def test_get_streak_exists(client: AsyncClient) -> None:
    """Return stored streak statistics."""
    streak = UserStreak(
        user_id="user_1",
        current_streak=5,
        longest_streak=10,
        last_active_at=BASE_TIME,
    )
    mock_repo = MagicMock(spec=StreakRepository)
    mock_repo.get_by_user = AsyncMock(return_value=streak)

    app.dependency_overrides[get_current_user_id] = lambda: "user_1"
    app.dependency_overrides[get_streak_repository] = lambda: mock_repo

    headers = {"Authorization": "Bearer mock_token"}
    res = await client.get("/streaks", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["current_streak"] == 5
    assert data["longest_streak"] == 10


@pytest.mark.asyncio
async def test_trip_logging_initializes_streak(client: AsyncClient) -> None:
    """Logging a trip when no streak exists should initialize it to 1."""
    mock_trip_repo = MagicMock(spec=TripLogRepository)

    async def mock_create(trip: TripLog) -> TripLog:
        return trip.model_copy(update={"id": "trip_123"})

    mock_trip_repo.create = AsyncMock(side_effect=mock_create)

    mock_streak_repo = MagicMock(spec=StreakRepository)
    mock_streak_repo.get_by_user = AsyncMock(return_value=None)
    mock_streak_repo.upsert = AsyncMock()

    app.dependency_overrides[get_current_user_id] = lambda: "user_1"
    app.dependency_overrides[get_trip_log_repository] = lambda: mock_trip_repo
    app.dependency_overrides[get_streak_repository] = lambda: mock_streak_repo

    headers = {"Authorization": "Bearer mock_token"}
    payload = {
        "origin": "Bengaluru",
        "destination": "Koramangala",
        "distance_km": 10.0,
        "mode": "petrol_car",
    }
    res = await client.post("/trips", json=payload, headers=headers)
    assert res.status_code == 201

    # Verify upsert was called with initial streak
    mock_streak_repo.upsert.assert_called_once()
    saved_streak = mock_streak_repo.upsert.call_args[0][0]
    assert saved_streak.current_streak == 1
    assert saved_streak.longest_streak == 1


@pytest.mark.asyncio
async def test_trip_logging_same_day_keeps_streak(client: AsyncClient) -> None:
    """Logging multiple trips on the same day should refresh timestamp but keep streak flat."""
    existing_streak = UserStreak(
        user_id="user_1",
        current_streak=3,
        longest_streak=5,
        last_active_at=datetime.utcnow(),
    )
    mock_trip_repo = MagicMock(spec=TripLogRepository)

    async def mock_create(trip: TripLog) -> TripLog:
        return trip.model_copy(update={"id": "trip_123"})

    mock_trip_repo.create = AsyncMock(side_effect=mock_create)

    mock_streak_repo = MagicMock(spec=StreakRepository)
    mock_streak_repo.get_by_user = AsyncMock(return_value=existing_streak)
    mock_streak_repo.upsert = AsyncMock()

    app.dependency_overrides[get_current_user_id] = lambda: "user_1"
    app.dependency_overrides[get_trip_log_repository] = lambda: mock_trip_repo
    app.dependency_overrides[get_streak_repository] = lambda: mock_streak_repo

    headers = {"Authorization": "Bearer mock_token"}
    payload = {
        "origin": "Bengaluru",
        "destination": "Koramangala",
        "distance_km": 10.0,
        "mode": "petrol_car",
    }
    res = await client.post("/trips", json=payload, headers=headers)
    assert res.status_code == 201

    mock_streak_repo.upsert.assert_called_once()
    saved_streak = mock_streak_repo.upsert.call_args[0][0]
    assert saved_streak.current_streak == 3  # Unchanged
    assert saved_streak.longest_streak == 5


@pytest.mark.asyncio
async def test_trip_logging_consecutive_day_increments_streak(client: AsyncClient) -> None:
    """Logging a trip on the consecutive day should increment the streak."""
    yesterday = datetime.utcnow() - timedelta(days=1)
    existing_streak = UserStreak(
        user_id="user_1",
        current_streak=3,
        longest_streak=5,
        last_active_at=yesterday,
    )
    mock_trip_repo = MagicMock(spec=TripLogRepository)

    async def mock_create(trip: TripLog) -> TripLog:
        return trip.model_copy(update={"id": "trip_123"})

    mock_trip_repo.create = AsyncMock(side_effect=mock_create)

    mock_streak_repo = MagicMock(spec=StreakRepository)
    mock_streak_repo.get_by_user = AsyncMock(return_value=existing_streak)
    mock_streak_repo.upsert = AsyncMock()

    app.dependency_overrides[get_current_user_id] = lambda: "user_1"
    app.dependency_overrides[get_trip_log_repository] = lambda: mock_trip_repo
    app.dependency_overrides[get_streak_repository] = lambda: mock_streak_repo

    headers = {"Authorization": "Bearer mock_token"}
    payload = {
        "origin": "Bengaluru",
        "destination": "Koramangala",
        "distance_km": 10.0,
        "mode": "petrol_car",
    }
    res = await client.post("/trips", json=payload, headers=headers)
    assert res.status_code == 201

    mock_streak_repo.upsert.assert_called_once()
    saved_streak = mock_streak_repo.upsert.call_args[0][0]
    assert saved_streak.current_streak == 4  # 3 + 1
    assert saved_streak.longest_streak == 5


@pytest.mark.asyncio
async def test_trip_logging_broken_streak_resets(client: AsyncClient) -> None:
    """Logging a trip after a gap of multiple days resets current streak to 1."""
    long_ago = datetime.utcnow() - timedelta(days=5)
    existing_streak = UserStreak(
        user_id="user_1",
        current_streak=3,
        longest_streak=5,
        last_active_at=long_ago,
    )
    mock_trip_repo = MagicMock(spec=TripLogRepository)

    async def mock_create(trip: TripLog) -> TripLog:
        return trip.model_copy(update={"id": "trip_123"})

    mock_trip_repo.create = AsyncMock(side_effect=mock_create)

    mock_streak_repo = MagicMock(spec=StreakRepository)
    mock_streak_repo.get_by_user = AsyncMock(return_value=existing_streak)
    mock_streak_repo.upsert = AsyncMock()

    app.dependency_overrides[get_current_user_id] = lambda: "user_1"
    app.dependency_overrides[get_trip_log_repository] = lambda: mock_trip_repo
    app.dependency_overrides[get_streak_repository] = lambda: mock_streak_repo

    headers = {"Authorization": "Bearer mock_token"}
    payload = {
        "origin": "Bengaluru",
        "destination": "Koramangala",
        "distance_km": 10.0,
        "mode": "petrol_car",
    }
    res = await client.post("/trips", json=payload, headers=headers)
    assert res.status_code == 201

    mock_streak_repo.upsert.assert_called_once()
    saved_streak = mock_streak_repo.upsert.call_args[0][0]
    assert saved_streak.current_streak == 1  # Reset
    assert saved_streak.longest_streak == 5  # Maintained longest


@pytest.mark.asyncio
async def test_committed_actions_crud(client: AsyncClient) -> None:
    """Verify posting, listing, and patching committed actions works correctly."""
    mock_repo = MagicMock(spec=CommittedActionRepository)

    # Mock listing return values
    mock_action = CommittedAction(
        id="act_123",
        user_id="user_1",
        action_key="ev_swap",
        title="Swap petrol car for EV",
        category="transport",
        projected_savings_kg=250.0,
        committed_at=BASE_TIME,
        status="active",
    )
    mock_repo.create = AsyncMock(return_value=mock_action)
    mock_repo.list_by_user = AsyncMock(return_value=[mock_action])
    mock_repo.update_status = AsyncMock(return_value=True)

    app.dependency_overrides[get_current_user_id] = lambda: "user_1"
    app.dependency_overrides[get_committed_action_repository] = lambda: mock_repo

    headers = {"Authorization": "Bearer mock_token"}

    # 1. POST (Create)
    payload = {
        "action_key": "ev_swap",
        "title": "Swap petrol car for EV",
        "category": "transport",
        "projected_savings_kg": 250.0,
    }
    res = await client.post("/committed_actions", json=payload, headers=headers)
    assert res.status_code == 201
    assert res.json()["action_key"] == "ev_swap"

    # 2. GET (List)
    res = await client.get("/committed_actions", headers=headers)
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["id"] == "act_123"

    # 3. PATCH (Update status)
    res = await client.patch(
        "/committed_actions/act_123", json={"status": "completed"}, headers=headers
    )
    assert res.status_code == 200
    assert res.json()["success"] is True
    mock_repo.update_status.assert_called_once_with("act_123", "completed")


@pytest.mark.asyncio
async def test_committed_actions_security(client: AsyncClient) -> None:
    """Ensure users cannot update commitments owned by other accounts."""
    mock_repo = MagicMock(spec=CommittedActionRepository)
    # Instantiate to verify model correctness without unused variable warnings
    _ = CommittedAction(
        id="act_123",
        user_id="other_user",  # owned by other user!
        action_key="ev_swap",
        title="Swap petrol car for EV",
        category="transport",
        projected_savings_kg=250.0,
        committed_at=BASE_TIME,
        status="active",
    )
    mock_repo.list_by_user = AsyncMock(return_value=[])  # Empty for current user_1

    app.dependency_overrides[get_current_user_id] = lambda: "user_1"
    app.dependency_overrides[get_committed_action_repository] = lambda: mock_repo

    headers = {"Authorization": "Bearer mock_token"}

    # Attempt to patch other_user's commitment
    res = await client.patch(
        "/committed_actions/act_123", json={"status": "completed"}, headers=headers
    )
    # Rejects as 404 (Not Found or Access Denied)
    assert res.status_code == 404
