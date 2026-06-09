from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.dependencies import get_streak_repository
from app.domain.models import UserStreak
from app.middleware.auth import get_current_user_id
from app.repositories.streak import StreakRepository

router = APIRouter(prefix="/streaks", tags=["streaks"])


@router.get(
    "",
    response_model=UserStreak,
    summary="Retrieve logging streak metrics for the authenticated user",
)
async def get_user_streak(
    user_id: Annotated[str, Depends(get_current_user_id)],
    repo: Annotated[StreakRepository, Depends(get_streak_repository)],
) -> UserStreak:
    """Fetch consecutive day carbon logging streak statistics for the user."""
    streak = await repo.get_by_user(user_id)
    if streak is None:
        return UserStreak(
            user_id=user_id,
            current_streak=0,
            longest_streak=0,
            last_active_at=None,
        )
    return streak
