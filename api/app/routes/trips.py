from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.clients.distance_matrix import DistanceMatrixClient
from app.core.dependencies import (
    get_distance_matrix_client,
    get_streak_repository,
    get_transport_estimator,
    get_trip_log_repository,
)
from app.domain.models import TripLog, UserStreak
from app.domain.transport import TransportActivity, TransportEstimator
from app.middleware.auth import get_current_user_id
from app.repositories.streak import StreakRepository
from app.repositories.trip_log import TripLogRepository

router = APIRouter(prefix="/trips", tags=["trips"])


class TripCreateRequest(BaseModel):
    """Request schema for creating a new trip log with strict validation bounds."""

    origin: str = Field(
        ..., min_length=1, max_length=256, description="Starting location name"
    )
    destination: str = Field(
        ..., min_length=1, max_length=256, description="Ending location name"
    )
    distance_km: float = Field(
        ..., gt=0.0, le=10000.0, description="Distance traveled in kilometers"
    )
    mode: str = Field(..., min_length=1, max_length=50, description="Mode of transport")


@router.post(
    "",
    response_model=TripLog,
    status_code=status.HTTP_201_CREATED,
    summary="Log a new travel trip",
)
async def create_trip(
    request: TripCreateRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    repo: Annotated[TripLogRepository, Depends(get_trip_log_repository)],
    estimator: Annotated[TransportEstimator, Depends(get_transport_estimator)],
    streak_repo: Annotated[StreakRepository, Depends(get_streak_repository)],
) -> TripLog:
    """Log a trip, calculate its emissions deterministically, and persist it to Firestore."""
    try:
        activity = TransportActivity(mode=request.mode, distance_km=request.distance_km)
        co2e_kg = estimator.estimate(activity)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e

    # Find the corresponding emission factor citation details
    factor_key = estimator._get_factor_key(request.mode)
    factor = estimator._factors.get(factor_key)

    citation = factor.source if factor else "Unknown"
    effective_year = factor.effective_year if factor else 2026

    trip = TripLog(
        user_id=user_id,
        origin=request.origin,
        destination=request.destination,
        distance_km=request.distance_km,
        mode=request.mode,
        co2e_kg=co2e_kg,
        citation=citation,
        effective_year=effective_year,
    )

    created_trip = await repo.create(trip)

    # Active Streak Roll-over & Increments
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
                    # Same day log: just refresh time
                    user_streak.last_active_at = now
                elif last_active_date == today - timedelta(days=1):
                    # Consecutive day log: increment streak
                    user_streak.current_streak += 1
                    user_streak.longest_streak = max(
                        user_streak.longest_streak, user_streak.current_streak
                    )
                    user_streak.last_active_at = now
                else:
                    # Streak broken or past log
                    if last_active_date < today - timedelta(days=1):
                        user_streak.current_streak = 1
                        user_streak.last_active_at = now

        await streak_repo.upsert(user_streak)
    except Exception:
        # Non-blocking soft degradation
        pass

    return created_trip


@router.get(
    "",
    response_model=list[TripLog],
    summary="Retrieve all logged trips for the authenticated user",
)
async def list_trips(
    user_id: Annotated[str, Depends(get_current_user_id)],
    repo: Annotated[TripLogRepository, Depends(get_trip_log_repository)],
) -> list[TripLog]:
    """Retrieve the trip history of the logged-in user."""
    return await repo.list_by_user(user_id)


class DistanceResponse(BaseModel):
    """Schema for driving distance calculation response."""

    origin: str
    destination: str
    distance_km: float


@router.get(
    "/distance",
    response_model=DistanceResponse,
    summary="Calculate driving distance between two locations",
)
async def get_trip_distance(
    origin: str,
    destination: str,
    user_id: Annotated[str, Depends(get_current_user_id)],
    client: Annotated[DistanceMatrixClient, Depends(get_distance_matrix_client)],
) -> DistanceResponse:
    """Calculate driving distance between origin and destination using Google Maps."""
    try:
        dist = await client.get_distance(origin, destination)
        return DistanceResponse(
            origin=origin,
            destination=destination,
            distance_km=dist,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
