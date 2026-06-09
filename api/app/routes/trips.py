from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.clients.vertex import VertexClient
from app.core.dependencies import (
    get_streak_repository,
    get_transport_estimator,
    get_trip_log_repository,
    get_vertex_client,
)
from app.domain.models import TripLog
from app.domain.transport import TransportActivity, TransportEstimator
from app.middleware.auth import get_current_user_id
from app.repositories.streak import StreakRepository
from app.repositories.trip_log import TripLogRepository
from app.services.streak_service import update_streak

router = APIRouter(prefix="/trips", tags=["trips"])
logger = structlog.get_logger(__name__)


class TripCreateRequest(BaseModel):
    """Request schema for creating a new trip log with strict validation bounds."""

    origin: str = Field(default="", max_length=256, description="Starting location (optional)")
    destination: str = Field(default="", max_length=256, description="Ending location (optional)")
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

    factor = estimator.get_factor_metadata(request.mode)
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
    await update_streak(user_id, streak_repo)
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


class TripParseRequest(BaseModel):
    """Payload for natural language travel parser."""

    text: str = Field(..., min_length=1, max_length=1000, description="Description of the journey")


class TripParseResponse(BaseModel):
    """Structured response containing extracted journey fields."""

    origin: str | None = Field(default=None, description="Extracted starting location")
    destination: str | None = Field(default=None, description="Extracted ending location")
    mode: str | None = Field(default=None, description="Extracted transportation mode")


@router.post(
    "/parse",
    response_model=TripParseResponse,
    summary="Parse travel details from description",
)
async def parse_trip_text(
    request: TripParseRequest,
    _user_id: Annotated[str, Depends(get_current_user_id)],
    vertex_client: Annotated[VertexClient, Depends(get_vertex_client)],
) -> TripParseResponse:
    """Parse travel info using Vertex AI Gemini, falling back gracefully to nulls."""
    try:
        parsed = await vertex_client.parse_trip(request.text)
        return TripParseResponse(
            origin=parsed.get("origin"),
            destination=parsed.get("destination"),
            mode=parsed.get("mode"),
        )
    except Exception:
        return TripParseResponse()
