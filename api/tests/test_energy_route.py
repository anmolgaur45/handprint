from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import AsyncClient

from app.core.dependencies import (
    get_energy_log_repository,
    get_streak_repository,
)
from app.domain.models import EnergyLog
from app.main import app
from app.middleware.auth import get_current_user_id
from app.repositories.energy_log import EnergyLogRepository
from app.repositories.streak import StreakRepository


@pytest.fixture(autouse=True)
def cleanup_overrides() -> None:
    """Clear dependency overrides and mock repositories to prevent CI default credentials errors."""
    app.dependency_overrides.clear()

    mock_streak_repo = MagicMock(spec=StreakRepository)
    mock_streak_repo.get_by_user = AsyncMock(return_value=None)
    mock_streak_repo.upsert = AsyncMock()
    app.dependency_overrides[get_streak_repository] = lambda: mock_streak_repo

    mock_energy_repo = MagicMock(spec=EnergyLogRepository)
    app.dependency_overrides[get_energy_log_repository] = lambda: mock_energy_repo


@pytest.mark.asyncio
async def test_create_energy_log_success(client: AsyncClient) -> None:
    """Test successful creation of an energy log."""
    mock_repo = MagicMock(spec=EnergyLogRepository)
    timestamp = datetime.now(UTC)

    async def mock_create(log: EnergyLog) -> EnergyLog:
        return log.model_copy(update={"id": "energy_123", "timestamp": timestamp})

    mock_repo.create = AsyncMock(side_effect=mock_create)

    app.dependency_overrides[get_current_user_id] = lambda: "user_123"
    app.dependency_overrides[get_energy_log_repository] = lambda: mock_repo

    payload = {"source": "electricity", "quantity": 100.0}
    headers = {"Authorization": "Bearer mock_token"}

    res = await client.post("/energy", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()
    assert data["id"] == "energy_123"
    assert data["user_id"] == "user_123"
    assert data["source"] == "electricity"
    assert data["quantity"] == 100.0
    assert pytest.approx(data["co2e_kg"]) == 72.70
    assert data["citation"] == "CEA CO2 Baseline Database for the Indian Power Sector, Version 20.0"
    assert data["effective_year"] == 2024


@pytest.mark.asyncio
async def test_create_energy_log_invalid_source(client: AsyncClient) -> None:
    """Test validation errors for unknown energy sources."""
    app.dependency_overrides[get_current_user_id] = lambda: "user_123"
    payload = {"source": "wood", "quantity": 10.0}
    headers = {"Authorization": "Bearer mock_token"}

    res = await client.post("/energy", json=payload, headers=headers)
    assert res.status_code == 400
    assert "Unknown energy source" in res.json()["detail"]


@pytest.mark.asyncio
async def test_list_energy_logs(client: AsyncClient) -> None:
    """Test retrieving energy logs list for user."""
    mock_repo = MagicMock(spec=EnergyLogRepository)
    timestamp = datetime.now(UTC)
    mock_logs = [
        EnergyLog(
            id="energy_1",
            user_id="user_123",
            source="lpg",
            quantity=15.0,
            co2e_kg=44.08,
            timestamp=timestamp,
            citation="DEFRA",
            effective_year=2024,
        )
    ]
    mock_repo.list_by_user = AsyncMock(return_value=mock_logs)

    app.dependency_overrides[get_current_user_id] = lambda: "user_123"
    app.dependency_overrides[get_energy_log_repository] = lambda: mock_repo

    headers = {"Authorization": "Bearer mock_token"}
    res = await client.get("/energy", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["id"] == "energy_1"
    assert data[0]["source"] == "lpg"
    assert data[0]["co2e_kg"] == 44.08


@pytest.mark.asyncio
async def test_create_energy_log_streak_increment_consecutive(client: AsyncClient) -> None:
    """Test streak increment on consecutive day energy log."""
    mock_energy_repo = MagicMock(spec=EnergyLogRepository)
    mock_energy_repo.create = AsyncMock(
        return_value=EnergyLog(
            id="energy_1",
            user_id="user_123",
            source="lpg",
            quantity=1.0,
            co2e_kg=2.93,
            citation="D",
            effective_year=2024,
        )
    )

    # Mock user streak from yesterday
    from app.domain.models import UserStreak

    yesterday = datetime.now(UTC) - timedelta(days=1)
    mock_streak_repo = MagicMock(spec=StreakRepository)
    mock_streak_repo.get_by_user = AsyncMock(
        return_value=UserStreak(
            user_id="user_123", current_streak=4, longest_streak=4, last_active_at=yesterday
        )
    )
    mock_streak_repo.upsert = AsyncMock()

    app.dependency_overrides[get_current_user_id] = lambda: "user_123"
    app.dependency_overrides[get_energy_log_repository] = lambda: mock_energy_repo
    app.dependency_overrides[get_streak_repository] = lambda: mock_streak_repo

    payload = {"source": "lpg", "quantity": 1.0}
    headers = {"Authorization": "Bearer mock_token"}

    res = await client.post("/energy", json=payload, headers=headers)
    assert res.status_code == 201

    mock_streak_repo.upsert.assert_called_once()
    saved_streak = mock_streak_repo.upsert.call_args[0][0]
    assert saved_streak.current_streak == 5
    assert saved_streak.longest_streak == 5


@pytest.mark.asyncio
async def test_create_energy_log_streak_same_day(client: AsyncClient) -> None:
    """Test streak remains unchanged on same-day multiple energy logs."""
    mock_energy_repo = MagicMock(spec=EnergyLogRepository)
    mock_energy_repo.create = AsyncMock(
        return_value=EnergyLog(
            id="energy_1",
            user_id="user_123",
            source="lpg",
            quantity=1.0,
            co2e_kg=2.93,
            citation="D",
            effective_year=2024,
        )
    )

    # Mock user streak from today
    from app.domain.models import UserStreak

    today = datetime.now(UTC)
    mock_streak_repo = MagicMock(spec=StreakRepository)
    mock_streak_repo.get_by_user = AsyncMock(
        return_value=UserStreak(
            user_id="user_123", current_streak=4, longest_streak=4, last_active_at=today
        )
    )
    mock_streak_repo.upsert = AsyncMock()

    app.dependency_overrides[get_current_user_id] = lambda: "user_123"
    app.dependency_overrides[get_energy_log_repository] = lambda: mock_energy_repo
    app.dependency_overrides[get_streak_repository] = lambda: mock_streak_repo

    payload = {"source": "lpg", "quantity": 1.0}
    headers = {"Authorization": "Bearer mock_token"}

    res = await client.post("/energy", json=payload, headers=headers)
    assert res.status_code == 201

    mock_streak_repo.upsert.assert_called_once()
    saved_streak = mock_streak_repo.upsert.call_args[0][0]
    assert saved_streak.current_streak == 4


@pytest.mark.asyncio
async def test_create_energy_log_streak_broken(client: AsyncClient) -> None:
    """Test streak resets on long gap since last active log."""
    mock_energy_repo = MagicMock(spec=EnergyLogRepository)
    mock_energy_repo.create = AsyncMock(
        return_value=EnergyLog(
            id="energy_1",
            user_id="user_123",
            source="lpg",
            quantity=1.0,
            co2e_kg=2.93,
            citation="D",
            effective_year=2024,
        )
    )

    # Mock user streak from 5 days ago
    from app.domain.models import UserStreak

    long_ago = datetime.now(UTC) - timedelta(days=5)
    mock_streak_repo = MagicMock(spec=StreakRepository)
    mock_streak_repo.get_by_user = AsyncMock(
        return_value=UserStreak(
            user_id="user_123", current_streak=4, longest_streak=4, last_active_at=long_ago
        )
    )
    mock_streak_repo.upsert = AsyncMock()

    app.dependency_overrides[get_current_user_id] = lambda: "user_123"
    app.dependency_overrides[get_energy_log_repository] = lambda: mock_energy_repo
    app.dependency_overrides[get_streak_repository] = lambda: mock_streak_repo

    payload = {"source": "lpg", "quantity": 1.0}
    headers = {"Authorization": "Bearer mock_token"}

    res = await client.post("/energy", json=payload, headers=headers)
    assert res.status_code == 201

    mock_streak_repo.upsert.assert_called_once()
    saved_streak = mock_streak_repo.upsert.call_args[0][0]
    assert saved_streak.current_streak == 1


@pytest.mark.asyncio
async def test_create_energy_log_streak_soft_degradation(client: AsyncClient) -> None:
    """Test soft-degradation handles database failure during streak upsert non-blockingly."""
    mock_energy_repo = MagicMock(spec=EnergyLogRepository)
    mock_energy_repo.create = AsyncMock(
        return_value=EnergyLog(
            id="energy_1",
            user_id="user_123",
            source="lpg",
            quantity=1.0,
            co2e_kg=2.93,
            citation="D",
            effective_year=2024,
        )
    )

    mock_streak_repo = MagicMock(spec=StreakRepository)
    mock_streak_repo.get_by_user = AsyncMock(side_effect=Exception("Database connection error"))

    app.dependency_overrides[get_current_user_id] = lambda: "user_123"
    app.dependency_overrides[get_energy_log_repository] = lambda: mock_energy_repo
    app.dependency_overrides[get_streak_repository] = lambda: mock_streak_repo

    payload = {"source": "lpg", "quantity": 1.0}
    headers = {"Authorization": "Bearer mock_token"}

    res = await client.post("/energy", json=payload, headers=headers)
    assert res.status_code == 201
    assert res.json()["id"] == "energy_1"
