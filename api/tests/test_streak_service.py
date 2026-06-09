"""Unit tests for the shared streak update service."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.domain.models import UserStreak
from app.repositories.streak import StreakRepository
from app.services.streak_service import update_streak


def _repo(
    *, existing: UserStreak | None = None, upsert_error: Exception | None = None
) -> StreakRepository:
    mock = MagicMock(spec=StreakRepository)
    mock.get_by_user = AsyncMock(return_value=existing)
    if upsert_error:
        mock.upsert = AsyncMock(side_effect=upsert_error)
    else:
        mock.upsert = AsyncMock()
    return mock


@pytest.mark.asyncio
async def test_new_user_initializes_streak() -> None:
    """First log for a user creates streak=1, longest=1."""
    repo = _repo(existing=None)
    await update_streak("user_1", repo)
    repo.upsert.assert_called_once()
    saved: UserStreak = repo.upsert.call_args[0][0]
    assert saved.current_streak == 1
    assert saved.longest_streak == 1


@pytest.mark.asyncio
async def test_same_day_refreshes_timestamp_only() -> None:
    """Second log on the same day keeps the streak count unchanged."""
    now = datetime.now(UTC)
    existing = UserStreak(user_id="u", current_streak=4, longest_streak=7, last_active_at=now)
    repo = _repo(existing=existing)

    await update_streak("u", repo)

    saved: UserStreak = repo.upsert.call_args[0][0]
    assert saved.current_streak == 4
    assert saved.longest_streak == 7


@pytest.mark.asyncio
async def test_consecutive_day_increments_streak() -> None:
    """Log on day N+1 increments current_streak and updates longest if needed."""
    yesterday = datetime.now(UTC) - timedelta(days=1)
    existing = UserStreak(user_id="u", current_streak=3, longest_streak=5, last_active_at=yesterday)
    repo = _repo(existing=existing)

    await update_streak("u", repo)

    saved: UserStreak = repo.upsert.call_args[0][0]
    assert saved.current_streak == 4
    assert saved.longest_streak == 5  # unchanged — 4 < 5


@pytest.mark.asyncio
async def test_consecutive_day_updates_longest_when_exceeded() -> None:
    """current_streak beating longest_streak updates longest_streak."""
    yesterday = datetime.now(UTC) - timedelta(days=1)
    existing = UserStreak(user_id="u", current_streak=5, longest_streak=5, last_active_at=yesterday)
    repo = _repo(existing=existing)

    await update_streak("u", repo)

    saved: UserStreak = repo.upsert.call_args[0][0]
    assert saved.current_streak == 6
    assert saved.longest_streak == 6  # updated


@pytest.mark.asyncio
async def test_broken_streak_resets_to_one() -> None:
    """Gap of more than one day resets current_streak to 1; longest is preserved."""
    long_ago = datetime.now(UTC) - timedelta(days=5)
    existing = UserStreak(
        user_id="u", current_streak=10, longest_streak=10, last_active_at=long_ago
    )
    repo = _repo(existing=existing)

    await update_streak("u", repo)

    saved: UserStreak = repo.upsert.call_args[0][0]
    assert saved.current_streak == 1
    assert saved.longest_streak == 10  # preserved


@pytest.mark.asyncio
async def test_null_last_active_resets_streak() -> None:
    """last_active_at=None resets streak to 1 and recalculates longest."""
    existing = UserStreak(user_id="u", current_streak=99, longest_streak=99, last_active_at=None)
    repo = _repo(existing=existing)

    await update_streak("u", repo)

    saved: UserStreak = repo.upsert.call_args[0][0]
    assert saved.current_streak == 1
    assert saved.longest_streak == 99  # max(99, 1) == 99


@pytest.mark.asyncio
async def test_exception_is_swallowed_and_does_not_raise() -> None:
    """A repo failure must not propagate out of update_streak."""
    repo = _repo(upsert_error=RuntimeError("DB is down"))
    # Should complete without raising
    await update_streak("u", repo)
    repo.upsert.assert_called_once()
