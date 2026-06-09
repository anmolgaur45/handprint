from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.dependencies import (
    get_food_estimator,
    get_food_log_repository,
    get_streak_repository,
)
from app.domain.food import FoodActivity, FoodEstimator
from app.domain.models import FoodLog, UserStreak
from app.middleware.auth import get_current_user_id
from app.repositories.food_log import FoodLogRepository
from app.repositories.streak import StreakRepository

router = APIRouter(prefix="/food", tags=["food"])


class FoodLogCreateRequest(BaseModel):
    """Request schema for logging food consumption."""

    item: str = Field(
        ..., min_length=1, max_length=256, description="Food item shorthand or full key"
    )
    weight_kg: float = Field(
        ..., gt=0.0, le=1000.0, description="Weight of the consumed food in kilograms"
    )


@router.post(
    "",
    response_model=FoodLog,
    status_code=status.HTTP_201_CREATED,
    summary="Log a food consumption activity",
)
async def create_food_log(
    request: FoodLogCreateRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    repo: Annotated[FoodLogRepository, Depends(get_food_log_repository)],
    estimator: Annotated[FoodEstimator, Depends(get_food_estimator)],
    streak_repo: Annotated[StreakRepository, Depends(get_streak_repository)],
) -> FoodLog:
    """Log a food meal, calculate emissions, and persist it to Firestore."""
    try:
        activity = FoodActivity(item=request.item, weight_kg=request.weight_kg)
        co2e_kg = estimator.estimate(activity)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e

    factor_key = estimator._get_factor_key(request.item)
    factor = estimator._factors.get(factor_key)

    citation = factor.source if factor else "Unknown"
    effective_year = factor.effective_year if factor else 2026

    log = FoodLog(
        user_id=user_id,
        item=request.item,
        weight_kg=request.weight_kg,
        co2e_kg=co2e_kg,
        citation=citation,
        effective_year=effective_year,
    )

    created_log = await repo.create(log)

    # Maintain logging streak
    try:
        user_streak = await streak_repo.get_by_user(user_id)
        now = datetime.utcnow()
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
        pass

    return created_log


@router.get(
    "",
    response_model=list[FoodLog],
    summary="Retrieve all food logs for the authenticated user",
)
async def list_food_logs(
    user_id: Annotated[str, Depends(get_current_user_id)],
    repo: Annotated[FoodLogRepository, Depends(get_food_log_repository)],
) -> list[FoodLog]:
    """Retrieve food history for the authenticated user."""
    return await repo.list_by_user(user_id)
