"""Router for retrieving context-aware carbon insights."""

from __future__ import annotations

import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.clients.vertex import VertexClient  # noqa: TCH001
from app.core.dependencies import (
    get_committed_action_repository,
    get_energy_log_repository,
    get_food_log_repository,
    get_trip_log_repository,
    get_vertex_client,
)
from app.middleware.auth import get_current_user_id
from app.repositories import (  # noqa: TCH001
    CommittedActionRepository,
    EnergyLogRepository,
    FoodLogRepository,
    TripLogRepository,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/insights", tags=["insights"])


def generate_rule_based_insights(
    total_co2e: float,
    category_breakdown: dict[str, float],
    commitments: list[dict[str, Any]],
) -> str:
    """Fallback generator to yield deterministic insights without calling Gemini.

    Ranks largest categories and suggests relative actions based on real computed values.
    """
    if total_co2e <= 0.0:
        return (
            "Your carbon footprint log is empty. Start logging travel, food, and energy "
            "to see personalized carbon insights and reduction recommendations."
        )

    highest_cat = max(category_breakdown, key=lambda k: category_breakdown[k])
    highest_val = category_breakdown.get(highest_cat, 0.0)

    if highest_cat == "transport":
        suggestion = (
            f"Your transit activities represent your largest emissions segment "
            f"({highest_val:.1f} kg CO2e). Swapping petrol car journeys for public transit, "
            f"EVs, or active cycling/walking can significantly lower this."
        )
    elif highest_cat == "food":
        suggestion = (
            f"Your food consumption represents your largest emissions segment "
            f"({highest_val:.1f} kg CO2e). Try reducing carbon intensity by substituting "
            f"high-impact red meats with low-impact options."
        )
    else:
        suggestion = (
            f"Your home energy consumption represents your largest emissions segment "
            f"({highest_val:.1f} kg CO2e). Lowering utility usage or shifting high-power "
            f"devices can reduce this footprint."
        )

    active_pledges = [c for c in commitments if c.get("status") == "active"]
    if active_pledges:
        pledge_text = (
            f" You have {len(active_pledges)} active reduction pledges. "
            f"Keeping these pledges will build your positive handprint impact!"
        )
    else:
        pledge_text = (
            " Visit the Reduction Lab to commit to small swaps and start "
            "tracking your carbon reduction streak."
        )

    return f"Your total carbon footprint is {total_co2e:.1f} kg CO2e. {suggestion}{pledge_text}"


@router.get(
    "",
    summary="Retrieve personalized carbon insights",
)
async def get_insights(
    user_id: Annotated[str, Depends(get_current_user_id)],
    trip_repo: Annotated[TripLogRepository, Depends(get_trip_log_repository)],
    food_repo: Annotated[FoodLogRepository, Depends(get_food_log_repository)],
    energy_repo: Annotated[EnergyLogRepository, Depends(get_energy_log_repository)],
    commitments_repo: Annotated[
        CommittedActionRepository, Depends(get_committed_action_repository)
    ],
    vertex_client: Annotated[VertexClient, Depends(get_vertex_client)],
) -> dict[str, str]:
    """Retrieve narrative summary of carbon footprint, falling back gracefully to rules."""
    # 1. Fetch user logs
    trips = await trip_repo.list_by_user(user_id)
    food_logs = await food_repo.list_by_user(user_id)
    energy_logs = await energy_repo.list_by_user(user_id)
    commitments = await commitments_repo.list_by_user(user_id)

    # 2. Compute category sums
    transport_sum = sum(t.co2e_kg for t in trips)
    food_sum = sum(f.co2e_kg for f in food_logs)
    energy_sum = sum(e.co2e_kg for e in energy_logs)
    total_co2e = transport_sum + food_sum + energy_sum

    category_breakdown = {
        "transport": transport_sum,
        "food": food_sum,
        "energy": energy_sum,
    }

    commitments_list = [{"title": c.title, "status": c.status} for c in commitments]

    # 3. Attempt Gemini narration, fallback to rule-based generation
    try:
        narration = await vertex_client.narrate_insights(
            total_co2e=total_co2e,
            category_breakdown=category_breakdown,
            commitments=commitments_list,
        )
        return {"narration": narration, "source": "gemini"}
    except Exception as e:
        logger.warning("Falling back to rule-based insights: %s", e)
        narration = generate_rule_based_insights(
            total_co2e=total_co2e,
            category_breakdown=category_breakdown,
            commitments=commitments_list,
        )
        return {"narration": narration, "source": "rules"}
