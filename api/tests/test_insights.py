from __future__ import annotations

from typing import TYPE_CHECKING
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.clients.vertex import VertexClient
from app.core.dependencies import (
    get_committed_action_repository,
    get_energy_log_repository,
    get_food_log_repository,
    get_trip_log_repository,
    get_vertex_client,
)
from app.domain.models import CommittedAction, EnergyLog, FoodLog, TripLog
from app.main import app
from app.middleware.auth import get_current_user_id
from app.repositories import (
    CommittedActionRepository,
    EnergyLogRepository,
    FoodLogRepository,
    TripLogRepository,
)

if TYPE_CHECKING:
    from httpx import AsyncClient


@pytest.fixture(autouse=True)
def cleanup_overrides() -> None:
    """Clear dependency overrides to ensure clean slate."""
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_insights_gemini_success(client: AsyncClient) -> None:
    """Test retrieving insights when Vertex AI client successfully narrates."""
    mock_trip_repo = MagicMock(spec=TripLogRepository)
    mock_trip_repo.list_by_user = AsyncMock(
        return_value=[
            TripLog(
                id="trip_1",
                user_id="user_123",
                origin="A",
                destination="B",
                distance_km=10.0,
                mode="petrol_car",
                co2e_kg=1.65,
                citation="DEFRA",
                effective_year=2024,
            )
        ]
    )

    mock_food_repo = MagicMock(spec=FoodLogRepository)
    mock_food_repo.list_by_user = AsyncMock(
        return_value=[
            FoodLog(
                id="food_1",
                user_id="user_123",
                item="beef",
                weight_kg=0.5,
                co2e_kg=49.74,
                citation="Poore & Nemecek",
                effective_year=2018,
            )
        ]
    )

    mock_energy_repo = MagicMock(spec=EnergyLogRepository)
    mock_energy_repo.list_by_user = AsyncMock(
        return_value=[
            EnergyLog(
                id="energy_1",
                user_id="user_123",
                source="electricity",
                quantity=100.0,
                co2e_kg=72.7,
                citation="CEA",
                effective_year=2024,
            )
        ]
    )

    mock_commitments_repo = MagicMock(spec=CommittedActionRepository)
    mock_commitments_repo.list_by_user = AsyncMock(
        return_value=[
            CommittedAction(
                id="comm_1",
                user_id="user_123",
                action_key="car_free",
                title="Go car free",
                category="transport",
                projected_savings_kg=250.0,
                status="active",
            )
        ]
    )

    mock_vertex = MagicMock(spec=VertexClient)
    mock_vertex.narrate_insights = AsyncMock(return_value="Gemini narration output")

    app.dependency_overrides[get_current_user_id] = lambda: "user_123"
    app.dependency_overrides[get_trip_log_repository] = lambda: mock_trip_repo
    app.dependency_overrides[get_food_log_repository] = lambda: mock_food_repo
    app.dependency_overrides[get_energy_log_repository] = lambda: mock_energy_repo
    app.dependency_overrides[get_committed_action_repository] = lambda: mock_commitments_repo
    app.dependency_overrides[get_vertex_client] = lambda: mock_vertex

    headers = {"Authorization": "Bearer mock_token"}
    resp = await client.get("/insights", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["source"] == "gemini"
    assert data["narration"] == "Gemini narration output"

    mock_vertex.narrate_insights.assert_called_once_with(
        total_co2e=124.09,
        category_breakdown={"transport": 1.65, "food": 49.74, "energy": 72.7},
        commitments=[{"title": "Go car free", "status": "active"}],
    )


@pytest.mark.asyncio
async def test_get_insights_gemini_failure_fallback_to_rules(client: AsyncClient) -> None:
    """Test retrieving insights falls back to rule-based generation when Gemini fails."""
    mock_trip_repo = MagicMock(spec=TripLogRepository)
    mock_trip_repo.list_by_user = AsyncMock(return_value=[])

    mock_food_repo = MagicMock(spec=FoodLogRepository)
    mock_food_repo.list_by_user = AsyncMock(return_value=[])

    mock_energy_repo = MagicMock(spec=EnergyLogRepository)
    mock_energy_repo.list_by_user = AsyncMock(
        return_value=[
            EnergyLog(
                id="energy_1",
                user_id="user_123",
                source="electricity",
                quantity=100.0,
                co2e_kg=72.7,
                citation="CEA",
                effective_year=2024,
            )
        ]
    )

    mock_commitments_repo = MagicMock(spec=CommittedActionRepository)
    mock_commitments_repo.list_by_user = AsyncMock(return_value=[])

    mock_vertex = MagicMock(spec=VertexClient)
    mock_vertex.narrate_insights = AsyncMock(side_effect=ValueError("Gemini down"))

    app.dependency_overrides[get_current_user_id] = lambda: "user_123"
    app.dependency_overrides[get_trip_log_repository] = lambda: mock_trip_repo
    app.dependency_overrides[get_food_log_repository] = lambda: mock_food_repo
    app.dependency_overrides[get_energy_log_repository] = lambda: mock_energy_repo
    app.dependency_overrides[get_committed_action_repository] = lambda: mock_commitments_repo
    app.dependency_overrides[get_vertex_client] = lambda: mock_vertex

    headers = {"Authorization": "Bearer mock_token"}
    resp = await client.get("/insights", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["source"] == "rules"
    assert "home energy consumption represents your largest emissions segment" in data["narration"]
    assert "Visit the Reduction Lab to commit to small swaps" in data["narration"]


@pytest.mark.asyncio
async def test_get_insights_empty_logs(client: AsyncClient) -> None:
    """Test retrieving insights when user has no logged activities."""
    mock_trip_repo = MagicMock(spec=TripLogRepository)
    mock_trip_repo.list_by_user = AsyncMock(return_value=[])
    mock_food_repo = MagicMock(spec=FoodLogRepository)
    mock_food_repo.list_by_user = AsyncMock(return_value=[])
    mock_energy_repo = MagicMock(spec=EnergyLogRepository)
    mock_energy_repo.list_by_user = AsyncMock(return_value=[])
    mock_commitments_repo = MagicMock(spec=CommittedActionRepository)
    mock_commitments_repo.list_by_user = AsyncMock(return_value=[])

    mock_vertex = MagicMock(spec=VertexClient)
    # Even if Vertex succeeds or fails, empty list causes fallback logic or empty summary
    mock_vertex.narrate_insights = AsyncMock(side_effect=ValueError("No metrics"))

    app.dependency_overrides[get_current_user_id] = lambda: "user_123"
    app.dependency_overrides[get_trip_log_repository] = lambda: mock_trip_repo
    app.dependency_overrides[get_food_log_repository] = lambda: mock_food_repo
    app.dependency_overrides[get_energy_log_repository] = lambda: mock_energy_repo
    app.dependency_overrides[get_committed_action_repository] = lambda: mock_commitments_repo
    app.dependency_overrides[get_vertex_client] = lambda: mock_vertex

    headers = {"Authorization": "Bearer mock_token"}
    resp = await client.get("/insights", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["source"] == "rules"
    assert "Your carbon footprint log is empty" in data["narration"]


@pytest.mark.asyncio
async def test_get_insights_rules_fallback_transport_highest(client: AsyncClient) -> None:
    """Test rule-based fallback when Gemini fails and transit is the highest category."""
    mock_trip_repo = MagicMock(spec=TripLogRepository)
    mock_trip_repo.list_by_user = AsyncMock(
        return_value=[
            TripLog(
                id="trip_1",
                user_id="user_123",
                origin="A",
                destination="B",
                distance_km=100.0,
                mode="petrol_car",
                co2e_kg=16.5,
                citation="DEFRA",
                effective_year=2024,
            )
        ]
    )

    mock_food_repo = MagicMock(spec=FoodLogRepository)
    mock_food_repo.list_by_user = AsyncMock(return_value=[])

    mock_energy_repo = MagicMock(spec=EnergyLogRepository)
    mock_energy_repo.list_by_user = AsyncMock(return_value=[])

    mock_commitments_repo = MagicMock(spec=CommittedActionRepository)
    mock_commitments_repo.list_by_user = AsyncMock(
        return_value=[
            CommittedAction(
                id="comm_1",
                user_id="user_123",
                action_key="car_free",
                title="Go car free",
                category="transport",
                projected_savings_kg=250.0,
                status="active",
            )
        ]
    )

    mock_vertex = MagicMock(spec=VertexClient)
    mock_vertex.narrate_insights = AsyncMock(side_effect=ValueError("Gemini down"))

    app.dependency_overrides[get_current_user_id] = lambda: "user_123"
    app.dependency_overrides[get_trip_log_repository] = lambda: mock_trip_repo
    app.dependency_overrides[get_food_log_repository] = lambda: mock_food_repo
    app.dependency_overrides[get_energy_log_repository] = lambda: mock_energy_repo
    app.dependency_overrides[get_committed_action_repository] = lambda: mock_commitments_repo
    app.dependency_overrides[get_vertex_client] = lambda: mock_vertex

    headers = {"Authorization": "Bearer mock_token"}
    resp = await client.get("/insights", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["source"] == "rules"
    assert "Your transit activities represent your largest emissions segment" in data["narration"]
    assert "active reduction pledges" in data["narration"]


@pytest.mark.asyncio
async def test_get_insights_rules_fallback_food_highest(client: AsyncClient) -> None:
    """Test rule-based fallback when Gemini fails and food is the highest category."""
    mock_trip_repo = MagicMock(spec=TripLogRepository)
    mock_trip_repo.list_by_user = AsyncMock(return_value=[])

    mock_food_repo = MagicMock(spec=FoodLogRepository)
    mock_food_repo.list_by_user = AsyncMock(
        return_value=[
            FoodLog(
                id="food_1",
                user_id="user_123",
                item="beef",
                weight_kg=1.0,
                co2e_kg=99.48,
                citation="Poore & Nemecek",
                effective_year=2018,
            )
        ]
    )

    mock_energy_repo = MagicMock(spec=EnergyLogRepository)
    mock_energy_repo.list_by_user = MagicMock()
    mock_energy_repo.list_by_user = AsyncMock(
        return_value=[
            EnergyLog(
                id="energy_1",
                user_id="user_123",
                source="electricity",
                quantity=10.0,
                co2e_kg=7.27,
                citation="CEA",
                effective_year=2024,
            )
        ]
    )

    mock_commitments_repo = MagicMock(spec=CommittedActionRepository)
    mock_commitments_repo.list_by_user = AsyncMock(return_value=[])

    mock_vertex = MagicMock(spec=VertexClient)
    mock_vertex.narrate_insights = AsyncMock(side_effect=ValueError("Gemini down"))

    app.dependency_overrides[get_current_user_id] = lambda: "user_123"
    app.dependency_overrides[get_trip_log_repository] = lambda: mock_trip_repo
    app.dependency_overrides[get_food_log_repository] = lambda: mock_food_repo
    app.dependency_overrides[get_energy_log_repository] = lambda: mock_energy_repo
    app.dependency_overrides[get_committed_action_repository] = lambda: mock_commitments_repo
    app.dependency_overrides[get_vertex_client] = lambda: mock_vertex

    headers = {"Authorization": "Bearer mock_token"}
    resp = await client.get("/insights", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["source"] == "rules"
    assert "Your food consumption represents your largest emissions segment" in data["narration"]
    assert "Visit the Reduction Lab to commit to small swaps" in data["narration"]
