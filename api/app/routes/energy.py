from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.dependencies import (
    get_energy_estimator,
    get_energy_log_repository,
    get_streak_repository,
)
from app.domain.energy import EnergyActivity, EnergyEstimator
from app.domain.models import EnergyLog
from app.middleware.auth import get_current_user_id
from app.repositories.energy_log import EnergyLogRepository
from app.repositories.streak import StreakRepository
from app.services.streak_service import update_streak

router = APIRouter(prefix="/energy", tags=["energy"])
logger = structlog.get_logger(__name__)


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

    factor = estimator.get_factor_metadata(request.source)
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
    await update_streak(user_id, streak_repo)
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
