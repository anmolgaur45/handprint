import os
from collections.abc import AsyncIterator
from datetime import datetime

import pytest
from google.cloud.firestore import AsyncClient

from app.domain.models import CommittedAction, TripLog, UserStreak
from app.repositories.committed_action import CommittedActionRepository
from app.repositories.streak import StreakRepository
from app.repositories.trip_log import TripLogRepository

# Skip all tests in this file if the Firestore emulator host is not set
pytestmark = pytest.mark.skipif(
    not os.environ.get("FIRESTORE_EMULATOR_HOST"),
    reason="FIRESTORE_EMULATOR_HOST environment variable not set",
)


@pytest.fixture
async def emulator_db() -> AsyncIterator[AsyncClient]:
    """Fixture to provide a clean AsyncClient connected to the Firestore Emulator."""
    # AsyncClient naturally routes requests to the emulator if FIRESTORE_EMULATOR_HOST is set
    db = AsyncClient(project="handprint-test")
    yield db

    # Clean up test collections
    for coll_name in ["trips", "committed_actions", "streaks"]:
        coll_ref = db.collection(coll_name)
        async for doc in coll_ref.stream():
            await doc.reference.delete()

    await db.close()  # type: ignore[no-untyped-call]


@pytest.mark.asyncio
async def test_trip_log_repository_with_emulator(emulator_db: AsyncClient) -> None:
    """Verify trip log creation and listing using a real Firestore instance (emulator)."""
    repo = TripLogRepository(db=emulator_db)

    # 1. Create a log
    trip = TripLog(
        user_id="user_emulator",
        origin="Bengaluru",
        destination="Chennai",
        distance_km=350.0,
        mode="train",
        co2e_kg=12.42,
        citation="DEFRA",
        effective_year=2024,
    )
    created = await repo.create(trip)
    assert created.id is not None

    # 2. List user logs
    trips = await repo.list_by_user("user_emulator")
    assert len(trips) == 1
    assert trips[0].id == created.id
    assert trips[0].origin == "Bengaluru"
    assert trips[0].co2e_kg == 12.42


@pytest.mark.asyncio
async def test_committed_action_repository_with_emulator(emulator_db: AsyncClient) -> None:
    """Verify committed action persistence using the Firestore emulator."""
    repo = CommittedActionRepository(db=emulator_db)

    # 1. Create commitment
    action = CommittedAction(
        user_id="user_emulator",
        action_key="car_free",
        title="Go car free",
        category="transport",
        projected_savings_kg=1200.0,
        status="active",
    )
    created = await repo.create(action)
    assert created.id is not None

    # 2. Update status
    updated = await repo.update_status(created.id, "completed")
    assert updated is True

    # 3. List and verify status change
    actions = await repo.list_by_user("user_emulator")
    assert len(actions) == 1
    assert actions[0].status == "completed"


@pytest.mark.asyncio
async def test_streak_repository_with_emulator(emulator_db: AsyncClient) -> None:
    """Verify streak tracking operations using the Firestore emulator."""
    repo = StreakRepository(db=emulator_db)
    timestamp = datetime.utcnow()

    # 1. Upsert streak
    streak = UserStreak(
        user_id="user_emulator", current_streak=4, longest_streak=6, last_active_at=timestamp
    )
    saved = await repo.upsert(streak)
    assert saved.current_streak == 4

    # 2. Retrieve streak
    fetched = await repo.get_by_user("user_emulator")
    assert fetched is not None
    assert fetched.current_streak == 4
    assert fetched.longest_streak == 6
