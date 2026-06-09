from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from google.cloud.firestore import AsyncClient

from app.domain.models import CommittedAction, EnergyLog, FoodLog, TripLog, UserStreak
from app.repositories.committed_action import CommittedActionRepository
from app.repositories.energy_log import EnergyLogRepository
from app.repositories.food_log import FoodLogRepository
from app.repositories.streak import StreakRepository
from app.repositories.trip_log import TripLogRepository


class MockDocument:
    """Mock representing a Firestore document snapshot."""

    def __init__(self, doc_id: str, data: dict | None) -> None:
        self.id = doc_id
        self._data = data
        self.exists = data is not None

    def to_dict(self) -> dict | None:
        return self._data


class MockStream:
    """Mock representing a Firestore async query stream."""

    def __init__(self, docs: list[MockDocument]) -> None:
        self.docs = docs

    async def __aiter__(self):
        for doc in self.docs:
            yield doc


@pytest.mark.asyncio
async def test_trip_log_repository_create() -> None:
    """Test creating a trip log in TripLogRepository."""
    mock_db = MagicMock(spec=AsyncClient)
    mock_collection = MagicMock()
    mock_doc_ref = MagicMock()
    mock_doc_ref.id = "mock_trip_123"
    mock_doc_ref.set = AsyncMock()

    mock_db.collection.return_value = mock_collection
    mock_collection.document.return_value = mock_doc_ref

    repo = TripLogRepository(db=mock_db)
    trip = TripLog(
        user_id="user_abc",
        origin="Bengaluru",
        destination="Mysuru",
        distance_km=150.0,
        mode="petrol_car",
        co2e_kg=24.73,
        citation="DEFRA",
        effective_year=2024,
    )

    result = await repo.create(trip)

    assert result.id == "mock_trip_123"
    mock_db.collection.assert_called_once_with("trips")
    mock_collection.document.assert_called_once()
    mock_doc_ref.set.assert_called_once()


@pytest.mark.asyncio
async def test_trip_log_repository_list() -> None:
    """Test listing trip logs by user in TripLogRepository."""
    mock_db = MagicMock(spec=AsyncClient)
    mock_collection = MagicMock()
    mock_query = MagicMock()
    mock_ordered_query = MagicMock()

    mock_db.collection.return_value = mock_collection
    mock_collection.where.return_value = mock_query
    mock_query.order_by.return_value = mock_ordered_query

    # Setup mock stream docs
    timestamp = datetime.now(UTC)
    mock_doc_1 = MockDocument(
        "trip_1",
        {
            "user_id": "user_abc",
            "origin": "A",
            "destination": "B",
            "distance_km": 10.0,
            "mode": "bus",
            "co2e_kg": 0.96,
            "timestamp": timestamp,
            "citation": "DEFRA",
            "effective_year": 2024,
        },
    )
    mock_ordered_query.stream.return_value = MockStream([mock_doc_1])

    repo = TripLogRepository(db=mock_db)
    trips = await repo.list_by_user("user_abc")

    assert len(trips) == 1
    assert trips[0].id == "trip_1"
    assert trips[0].origin == "A"
    assert trips[0].co2e_kg == 0.96
    mock_db.collection.assert_called_once_with("trips")


@pytest.mark.asyncio
async def test_committed_action_repository_create() -> None:
    """Test creating a committed action in CommittedActionRepository."""
    mock_db = MagicMock(spec=AsyncClient)
    mock_collection = MagicMock()
    mock_doc_ref = MagicMock()
    mock_doc_ref.id = "mock_action_456"
    mock_doc_ref.set = AsyncMock()

    mock_db.collection.return_value = mock_collection
    mock_collection.document.return_value = mock_doc_ref

    repo = CommittedActionRepository(db=mock_db)
    action = CommittedAction(
        user_id="user_abc",
        action_key="mode_shift_car_to_bus",
        title="Take bus instead of car",
        category="transport",
        projected_savings_kg=350.0,
        status="active",
    )

    result = await repo.create(action)

    assert result.id == "mock_action_456"
    mock_db.collection.assert_called_once_with("committed_actions")
    mock_collection.document.assert_called_once()
    mock_doc_ref.set.assert_called_once()


@pytest.mark.asyncio
async def test_committed_action_repository_list() -> None:
    """Test listing committed actions in CommittedActionRepository."""
    mock_db = MagicMock(spec=AsyncClient)
    mock_collection = MagicMock()
    mock_query = MagicMock()
    mock_ordered_query = MagicMock()

    mock_db.collection.return_value = mock_collection
    mock_collection.where.return_value = mock_query
    mock_query.order_by.return_value = mock_ordered_query

    mock_doc = MockDocument(
        "action_1",
        {
            "user_id": "user_abc",
            "action_key": "x",
            "title": "Do X",
            "category": "energy",
            "projected_savings_kg": 100.0,
            "committed_at": datetime.now(UTC),
            "status": "active",
        },
    )
    mock_ordered_query.stream.return_value = MockStream([mock_doc])

    repo = CommittedActionRepository(db=mock_db)
    actions = await repo.list_by_user("user_abc")

    assert len(actions) == 1
    assert actions[0].id == "action_1"
    assert actions[0].action_key == "x"


@pytest.mark.asyncio
async def test_committed_action_repository_update_status() -> None:
    """Test updating action status in CommittedActionRepository."""
    mock_db = MagicMock(spec=AsyncClient)
    mock_collection = MagicMock()
    mock_doc_ref = MagicMock()

    mock_db.collection.return_value = mock_collection
    mock_collection.document.return_value = mock_doc_ref

    # Doc exists
    mock_doc_ref.get = AsyncMock(return_value=MockDocument("action_1", {"status": "active"}))
    mock_doc_ref.update = AsyncMock()

    repo = CommittedActionRepository(db=mock_db)

    # Update exists
    success = await repo.update_status("action_1", "completed")
    assert success is True
    mock_doc_ref.update.assert_called_once_with({"status": "completed"})

    # Update not exists
    mock_doc_ref.get = AsyncMock(return_value=MockDocument("action_2", None))
    success = await repo.update_status("action_2", "completed")
    assert success is False


@pytest.mark.asyncio
async def test_streak_repository_get() -> None:
    """Test get_by_user in StreakRepository."""
    mock_db = MagicMock(spec=AsyncClient)
    mock_collection = MagicMock()
    mock_doc_ref = MagicMock()

    mock_db.collection.return_value = mock_collection
    mock_collection.document.return_value = mock_doc_ref

    repo = StreakRepository(db=mock_db)

    # 1. Streak exists
    timestamp = datetime.now(UTC)
    mock_doc_ref.get = AsyncMock(
        return_value=MockDocument(
            "user_123", {"current_streak": 5, "longest_streak": 10, "last_active_at": timestamp}
        )
    )

    streak = await repo.get_by_user("user_123")
    assert streak is not None
    assert streak.user_id == "user_123"
    assert streak.current_streak == 5
    assert streak.longest_streak == 10
    assert streak.last_active_at == timestamp

    # 2. Streak does not exist
    mock_doc_ref.get = AsyncMock(return_value=MockDocument("user_456", None))
    streak = await repo.get_by_user("user_456")
    assert streak is None


@pytest.mark.asyncio
async def test_streak_repository_upsert() -> None:
    """Test upsert in StreakRepository."""
    mock_db = MagicMock(spec=AsyncClient)
    mock_collection = MagicMock()
    mock_doc_ref = MagicMock()
    mock_doc_ref.set = AsyncMock()

    mock_db.collection.return_value = mock_collection
    mock_collection.document.return_value = mock_doc_ref

    repo = StreakRepository(db=mock_db)
    streak = UserStreak(
        user_id="user_123", current_streak=3, longest_streak=5, last_active_at=datetime.now(UTC)
    )

    result = await repo.upsert(streak)

    assert result.current_streak == 3
    mock_db.collection.assert_called_once_with("streaks")
    mock_collection.document.assert_called_once_with("user_123")
    mock_doc_ref.set.assert_called_once()


@pytest.mark.asyncio
async def test_food_log_repository_create_and_list() -> None:
    """Test creating and listing in FoodLogRepository."""
    mock_db = MagicMock(spec=AsyncClient)
    mock_collection = MagicMock()
    mock_doc_ref = MagicMock()
    mock_doc_ref.id = "mock_food_123"
    mock_doc_ref.set = AsyncMock()

    mock_db.collection.return_value = mock_collection
    mock_collection.document.return_value = mock_doc_ref

    repo = FoodLogRepository(db=mock_db)
    food = FoodLog(
        user_id="user_123",
        item="beef",
        weight_kg=1.0,
        co2e_kg=99.48,
        citation="Poore",
        effective_year=2018,
    )

    created = await repo.create(food)
    assert created.id == "mock_food_123"
    mock_db.collection.assert_called_once_with("food_logs")
    mock_doc_ref.set.assert_called_once()

    # Test list_by_user
    mock_query = MagicMock()
    mock_ordered = MagicMock()
    mock_collection.where.return_value = mock_query
    mock_query.order_by.return_value = mock_ordered

    timestamp = datetime.now(UTC)
    mock_ordered.stream.return_value = MockStream(
        [
            MockDocument(
                "food_1",
                {
                    "user_id": "user_123",
                    "item": "beef",
                    "weight_kg": 1.0,
                    "co2e_kg": 99.48,
                    "timestamp": timestamp,
                    "citation": "Poore",
                    "effective_year": 2018,
                },
            )
        ]
    )

    logs = await repo.list_by_user("user_123")
    assert len(logs) == 1
    assert logs[0].id == "food_1"
    assert logs[0].item == "beef"


@pytest.mark.asyncio
async def test_energy_log_repository_create_and_list() -> None:
    """Test creating and listing in EnergyLogRepository."""
    mock_db = MagicMock(spec=AsyncClient)
    mock_collection = MagicMock()
    mock_doc_ref = MagicMock()
    mock_doc_ref.id = "mock_energy_123"
    mock_doc_ref.set = AsyncMock()

    mock_db.collection.return_value = mock_collection
    mock_collection.document.return_value = mock_doc_ref

    repo = EnergyLogRepository(db=mock_db)
    energy = EnergyLog(
        user_id="user_123",
        source="electricity",
        quantity=50.0,
        co2e_kg=36.35,
        citation="CEA",
        effective_year=2024,
    )

    created = await repo.create(energy)
    assert created.id == "mock_energy_123"
    mock_db.collection.assert_called_once_with("energy_logs")
    mock_doc_ref.set.assert_called_once()

    # Test list_by_user
    mock_query = MagicMock()
    mock_ordered = MagicMock()
    mock_collection.where.return_value = mock_query
    mock_query.order_by.return_value = mock_ordered

    timestamp = datetime.now(UTC)
    mock_ordered.stream.return_value = MockStream(
        [
            MockDocument(
                "energy_1",
                {
                    "user_id": "user_123",
                    "source": "electricity",
                    "quantity": 50.0,
                    "co2e_kg": 36.35,
                    "timestamp": timestamp,
                    "citation": "CEA",
                    "effective_year": 2024,
                },
            )
        ]
    )

    logs = await repo.list_by_user("user_123")
    assert len(logs) == 1
    assert logs[0].id == "energy_1"
    assert logs[0].source == "electricity"
