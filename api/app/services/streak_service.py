"""Shared streak update logic for all activity log routes."""

from datetime import UTC, datetime, timedelta

import structlog

from app.domain.models import UserStreak
from app.repositories.streak import StreakRepository

logger = structlog.get_logger(__name__)


async def update_streak(user_id: str, streak_repo: StreakRepository) -> None:
    """Update the user's activity streak for today.

    Soft-failure: exceptions are logged and swallowed so a streak failure
    never rolls back the primary activity log entry.
    """
    try:
        user_streak = await streak_repo.get_by_user(user_id)
        now = datetime.now(UTC)
        today = now.date()

        if user_streak is None:
            user_streak = UserStreak(
                user_id=user_id,
                current_streak=1,
                longest_streak=1,
                last_active_at=now,
            )
        else:
            last_active = user_streak.last_active_at
            if last_active is None:
                user_streak.current_streak = 1
                user_streak.longest_streak = max(user_streak.longest_streak, 1)
                user_streak.last_active_at = now
            else:
                last_active_date = last_active.date()
                if last_active_date == today:
                    user_streak.last_active_at = now
                elif last_active_date == today - timedelta(days=1):
                    user_streak.current_streak += 1
                    user_streak.longest_streak = max(
                        user_streak.longest_streak, user_streak.current_streak
                    )
                    user_streak.last_active_at = now
                else:
                    if last_active_date < today - timedelta(days=1):
                        user_streak.current_streak = 1
                        user_streak.last_active_at = now

        await streak_repo.upsert(user_streak)
    except Exception:
        logger.warning("Streak update failed", user_id=user_id, exc_info=True)
