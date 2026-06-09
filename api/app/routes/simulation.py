from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.dependencies import get_transport_estimator, get_trip_log_repository
from app.domain.simulation import (
    EVCarSwapCommand,
    ModeShiftCommand,
    ReduceTripsCommand,
    SimulationCommand,
    calculate_annual_scaling_factor,
)
from app.domain.transport import TransportEstimator
from app.middleware.auth import get_current_user_id
from app.repositories.trip_log import TripLogRepository

router = APIRouter(prefix="/trips/simulate", tags=["simulation"])


class SimulationRequest(BaseModel):
    """Schema for requesting a what-if simulation swap scenario."""

    scenario: Literal["ev_swap", "mode_shift", "reduce_trips"] = Field(
        ..., description="Simulation scenario identifier"
    )
    target_mode: str | None = Field(
        default=None,
        min_length=1,
        max_length=50,
        description="Target transport mode for mode_shift (e.g. 'bus', 'metro', 'walking')",
    )
    percentage: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Percentage of trips to affect (from 0.0 to 1.0)",
    )


class SimulationResponse(BaseModel):
    """Schema returning simulated annual footprint metrics and carbon savings."""

    scenario: str = Field(description="Scenario name")
    base_annual_co2e_kg: float = Field(
        ge=0.0, description="Base projected annual footprint in kg CO2e"
    )
    projected_annual_co2e_kg: float = Field(
        ge=0.0, description="Projected annual footprint after scenario in kg CO2e"
    )
    annual_savings_co2e_kg: float = Field(
        ge=0.0, description="Projected annual carbon savings in kg CO2e"
    )
    percentage_reduction: float = Field(
        ge=0.0, le=100.0, description="Percentage of footprint reduced"
    )


@router.post(
    "",
    response_model=SimulationResponse,
    summary="Simulate a reduction swap scenario on logged trip history",
)
async def simulate_scenario(
    request: SimulationRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    repo: Annotated[TripLogRepository, Depends(get_trip_log_repository)],
    estimator: Annotated[TransportEstimator, Depends(get_transport_estimator)],
) -> SimulationResponse:
    """Simulate a what-if transport swap scenario using historical trip logs."""
    trips = await repo.list_by_user(user_id)
    if not trips:
        return SimulationResponse(
            scenario=request.scenario,
            base_annual_co2e_kg=0.0,
            projected_annual_co2e_kg=0.0,
            annual_savings_co2e_kg=0.0,
            percentage_reduction=0.0,
        )

    # Resolve correct Command Pattern subclass
    command: SimulationCommand
    if request.scenario == "ev_swap":
        command = EVCarSwapCommand()
    elif request.scenario == "mode_shift":
        if not request.target_mode:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="target_mode is required for 'mode_shift' scenario",
            )
        try:
            command = ModeShiftCommand(
                target_mode=request.target_mode,
                percentage=request.percentage,
            )
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e),
            ) from e
    elif request.scenario == "reduce_trips":
        try:
            command = ReduceTripsCommand(percentage=request.percentage)
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e),
            ) from e
    else:
        # Fallback safeguard in case Pydantic literal bypass is attempted
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown simulation scenario: '{request.scenario}'",
        )

    try:
        savings = command.execute(trips, estimator)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e

    scale = calculate_annual_scaling_factor(trips)
    base_annual_emissions = sum(t.co2e_kg for t in trips) * scale
    projected_annual_emissions = max(0.0, base_annual_emissions - savings)

    pct_reduction = 0.0
    if base_annual_emissions > 0.0:
        pct_reduction = (savings / base_annual_emissions) * 100.0
        pct_reduction = max(0.0, min(100.0, pct_reduction))

    return SimulationResponse(
        scenario=request.scenario,
        base_annual_co2e_kg=base_annual_emissions,
        projected_annual_co2e_kg=projected_annual_emissions,
        annual_savings_co2e_kg=savings,
        percentage_reduction=pct_reduction,
    )
