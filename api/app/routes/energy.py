from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.dependencies import (
    get_energy_estimator,
    get_energy_log_repository,
    get_streak_repository,
)
from app.domain.energy import EnergyActivity, EnergyEstimator
from app.domain.models import EnergyLog, UserStreak
from app.middleware.auth import get_current_user_id
from app.repositories.energy_log import EnergyLogRepository
from app.repositories.streak import StreakRepository

router = APIRouter(prefix="/energy", tags=["energy"])


class EnergyLogCreateRequest(BaseModel):
    """Request schema for logging utility energy usage."""

    source: str = Field(
        ..., min_length=1, max_length=256, description="Energy source shorthand or full key"
    )
    quantity: float = Field(..., gt=0.0, le=100000.0, description="Quantity consumed (kWh or kg)")


@router.post(
    "",
    response_model=EnergyLog,
    status_code=status.HTTP_201_CREATED,
    summary="Log a utility energy consumption activity",
)
async def create_energy_log(
    request: EnergyLogCreateRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    repo: Annotated[EnergyLogRepository, Depends(get_energy_log_repository)],
    estimator: Annotated[EnergyEstimator, Depends(get_energy_estimator)],
    streak_repo: Annotated[StreakRepository, Depends(get_streak_repository)],
) -> EnergyLog:
    """Log an energy utility, calculate emissions, and persist it to Firestore."""
    try:
        activity = EnergyActivity(source=request.source, quantity=request.quantity)
        co2e_kg = estimator.estimate(activity)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e

    factor_key = estimator._get_factor_key(request.source)
    factor = estimator._factors.get(factor_key)

    citation = factor.source if factor else "Unknown"
    effective_year = factor.effective_year if factor else 2026

    log = EnergyLog(
        user_id=user_id,
        source=request.source,
        quantity=request.quantity,
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
    response_model=list[EnergyLog],
    summary="Retrieve all utility energy logs for the authenticated user",
)
async def list_energy_logs(
    user_id: Annotated[str, Depends(get_current_user_id)],
    repo: Annotated[EnergyLogRepository, Depends(get_energy_log_repository)],
) -> list[EnergyLog]:
    """Retrieve energy utility history for the authenticated user."""
    return await repo.list_by_user(user_id)
