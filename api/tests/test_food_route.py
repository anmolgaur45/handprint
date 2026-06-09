from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import AsyncClient

from app.core.dependencies import (
    get_food_log_repository,
    get_streak_repository,
)
from app.domain.models import FoodLog
from app.main import app
from app.middleware.auth import get_current_user_id
from app.repositories.food_log import FoodLogRepository
from app.repositories.streak import StreakRepository


@pytest.fixture(autouse=True)
def cleanup_overrides() -> None:
    """Clear dependency overrides and mock repositories to prevent CI default credentials errors."""
    app.dependency_overrides.clear()

    mock_streak_repo = MagicMock(spec=StreakRepository)
    mock_streak_repo.get_by_user = AsyncMock(return_value=None)
    mock_streak_repo.upsert = AsyncMock()
    app.dependency_overrides[get_streak_repository] = lambda: mock_streak_repo

    mock_food_repo = MagicMock(spec=FoodLogRepository)
    app.dependency_overrides[get_food_log_repository] = lambda: mock_food_repo


@pytest.mark.asyncio
async def test_create_food_log_success(client: AsyncClient) -> None:
    """Test successful creation of a food log."""
    mock_repo = MagicMock(spec=FoodLogRepository)
    timestamp = datetime.utcnow()

    async def mock_create(log: FoodLog) -> FoodLog:
        return log.model_copy(update={"id": "food_123", "timestamp": timestamp})

    mock_repo.create = AsyncMock(side_effect=mock_create)

    app.dependency_overrides[get_current_user_id] = lambda: "user_123"
    app.dependency_overrides[get_food_log_repository] = lambda: mock_repo

    payload = {"item": "beef", "weight_kg": 1.5}
    headers = {"Authorization": "Bearer mock_token"}

    res = await client.post("/food", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()
    assert data["id"] == "food_123"
    assert data["user_id"] == "user_123"
    assert data["item"] == "beef"
    assert data["weight_kg"] == 1.5
    assert pytest.approx(data["co2e_kg"]) == 149.22
    assert data["citation"] == "Poore & Nemecek (2018) via Our World in Data"
    assert data["effective_year"] == 2018


@pytest.mark.asyncio
async def test_create_food_log_invalid_item(client: AsyncClient) -> None:
    """Test validation errors for unknown food items."""
    app.dependency_overrides[get_current_user_id] = lambda: "user_123"
    payload = {"item": "unknown_item", "weight_kg": 1.0}
    headers = {"Authorization": "Bearer mock_token"}

    res = await client.post("/food", json=payload, headers=headers)
    assert res.status_code == 400
    assert "Unknown food item" in res.json()["detail"]


@pytest.mark.asyncio
async def test_list_food_logs(client: AsyncClient) -> None:
    """Test retrieving food logs list for user."""
    mock_repo = MagicMock(spec=FoodLogRepository)
    timestamp = datetime.utcnow()
    mock_logs = [
        FoodLog(
            id="food_1",
            user_id="user_123",
            item="rice",
            weight_kg=2.0,
            co2e_kg=8.90,
            timestamp=timestamp,
            citation="Poore & Nemecek",
            effective_year=2018,
        )
    ]
    mock_repo.list_by_user = AsyncMock(return_value=mock_logs)

    app.dependency_overrides[get_current_user_id] = lambda: "user_123"
    app.dependency_overrides[get_food_log_repository] = lambda: mock_repo

    headers = {"Authorization": "Bearer mock_token"}
    res = await client.get("/food", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["id"] == "food_1"
    assert data[0]["item"] == "rice"
    assert data[0]["co2e_kg"] == 8.90


@pytest.mark.asyncio
async def test_create_food_log_streak_increment_consecutive(client: AsyncClient) -> None:
    """Test streak increment on consecutive day food log."""
    mock_food_repo = MagicMock(spec=FoodLogRepository)
    mock_food_repo.create = AsyncMock(
        return_value=FoodLog(
            id="food_1",
            user_id="user_123",
            item="beef",
            weight_kg=1.0,
            co2e_kg=99.48,
            citation="P",
            effective_year=2018,
        )
    )

    # Mock user streak from yesterday
    from datetime import timedelta

    from app.domain.models import UserStreak

    yesterday = datetime.utcnow() - timedelta(days=1)
    mock_streak_repo = MagicMock(spec=StreakRepository)
    mock_streak_repo.get_by_user = AsyncMock(
        return_value=UserStreak(
            user_id="user_123", current_streak=4, longest_streak=4, last_active_at=yesterday
        )
    )
    mock_streak_repo.upsert = AsyncMock()

    app.dependency_overrides[get_current_user_id] = lambda: "user_123"
    app.dependency_overrides[get_food_log_repository] = lambda: mock_food_repo
    app.dependency_overrides[get_streak_repository] = lambda: mock_streak_repo

    payload = {"item": "beef", "weight_kg": 1.0}
    headers = {"Authorization": "Bearer mock_token"}

    res = await client.post("/food", json=payload, headers=headers)
    assert res.status_code == 201

    mock_streak_repo.upsert.assert_called_once()
    saved_streak = mock_streak_repo.upsert.call_args[0][0]
    assert saved_streak.current_streak == 5
    assert saved_streak.longest_streak == 5


@pytest.mark.asyncio
async def test_create_food_log_streak_same_day(client: AsyncClient) -> None:
    """Test streak remains unchanged on same-day multiple food logs."""
    mock_food_repo = MagicMock(spec=FoodLogRepository)
    mock_food_repo.create = AsyncMock(
        return_value=FoodLog(
            id="food_1",
            user_id="user_123",
            item="beef",
            weight_kg=1.0,
            co2e_kg=99.48,
            citation="P",
            effective_year=2018,
        )
    )

    # Mock user streak from today
    from app.domain.models import UserStreak

    today = datetime.utcnow()
    mock_streak_repo = MagicMock(spec=StreakRepository)
    mock_streak_repo.get_by_user = AsyncMock(
        return_value=UserStreak(
            user_id="user_123", current_streak=4, longest_streak=4, last_active_at=today
        )
    )
    mock_streak_repo.upsert = AsyncMock()

    app.dependency_overrides[get_current_user_id] = lambda: "user_123"
    app.dependency_overrides[get_food_log_repository] = lambda: mock_food_repo
    app.dependency_overrides[get_streak_repository] = lambda: mock_streak_repo

    payload = {"item": "beef", "weight_kg": 1.0}
    headers = {"Authorization": "Bearer mock_token"}

    res = await client.post("/food", json=payload, headers=headers)
    assert res.status_code == 201

    mock_streak_repo.upsert.assert_called_once()
    saved_streak = mock_streak_repo.upsert.call_args[0][0]
    assert saved_streak.current_streak == 4


@pytest.mark.asyncio
async def test_create_food_log_streak_broken(client: AsyncClient) -> None:
    """Test streak resets on long gap since last active log."""
    mock_food_repo = MagicMock(spec=FoodLogRepository)
    mock_food_repo.create = AsyncMock(
        return_value=FoodLog(
            id="food_1",
            user_id="user_123",
            item="beef",
            weight_kg=1.0,
            co2e_kg=99.48,
            citation="P",
            effective_year=2018,
        )
    )

    # Mock user streak from 5 days ago
    from datetime import timedelta

    from app.domain.models import UserStreak

    long_ago = datetime.utcnow() - timedelta(days=5)
    mock_streak_repo = MagicMock(spec=StreakRepository)
    mock_streak_repo.get_by_user = AsyncMock(
        return_value=UserStreak(
            user_id="user_123", current_streak=4, longest_streak=4, last_active_at=long_ago
        )
    )
    mock_streak_repo.upsert = AsyncMock()

    app.dependency_overrides[get_current_user_id] = lambda: "user_123"
    app.dependency_overrides[get_food_log_repository] = lambda: mock_food_repo
    app.dependency_overrides[get_streak_repository] = lambda: mock_streak_repo

    payload = {"item": "beef", "weight_kg": 1.0}
    headers = {"Authorization": "Bearer mock_token"}

    res = await client.post("/food", json=payload, headers=headers)
    assert res.status_code == 201

    mock_streak_repo.upsert.assert_called_once()
    saved_streak = mock_streak_repo.upsert.call_args[0][0]
    assert saved_streak.current_streak == 1


@pytest.mark.asyncio
async def test_create_food_log_streak_soft_degradation(client: AsyncClient) -> None:
    """Test soft-degradation handles database failure during streak upsert non-blockingly."""
    mock_food_repo = MagicMock(spec=FoodLogRepository)
    mock_food_repo.create = AsyncMock(
        return_value=FoodLog(
            id="food_1",
            user_id="user_123",
            item="beef",
            weight_kg=1.0,
            co2e_kg=99.48,
            citation="P",
            effective_year=2018,
        )
    )

    mock_streak_repo = MagicMock(spec=StreakRepository)
    mock_streak_repo.get_by_user = AsyncMock(side_effect=Exception("Database connection error"))

    app.dependency_overrides[get_current_user_id] = lambda: "user_123"
    app.dependency_overrides[get_food_log_repository] = lambda: mock_food_repo
    app.dependency_overrides[get_streak_repository] = lambda: mock_streak_repo

    payload = {"item": "beef", "weight_kg": 1.0}
    headers = {"Authorization": "Bearer mock_token"}

    res = await client.post("/food", json=payload, headers=headers)
    assert res.status_code == 201
    assert res.json()["id"] == "food_1"
