from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.dependencies import (
    get_food_estimator,
    get_food_log_repository,
    get_streak_repository,
)
from app.domain.food import FoodActivity, FoodEstimator
from app.domain.models import FoodLog
from app.middleware.auth import get_current_user_id
from app.repositories.food_log import FoodLogRepository
from app.repositories.streak import StreakRepository
from app.services.streak_service import update_streak

router = APIRouter(prefix="/food", tags=["food"])
logger = structlog.get_logger(__name__)


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

    factor = estimator.get_factor_metadata(request.item)
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
    await update_streak(user_id, streak_repo)
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
