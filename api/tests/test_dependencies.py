from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from google.cloud.firestore import AsyncClient

from app.clients.air_quality import AirQualityClient
from app.clients.distance_matrix import DistanceMatrixClient
from app.clients.places import PlacesClient
from app.clients.vertex import VertexClient
from app.core import dependencies
from app.domain.transport import TransportEstimator
from app.repositories.committed_action import CommittedActionRepository
from app.repositories.streak import StreakRepository
from app.repositories.trip_log import TripLogRepository


@pytest.mark.asyncio
async def test_dependencies_wiring_and_stubs() -> None:
    """Test all dependency injection providers, repositories, and client stubs."""
    # Reset singletons/cached clients
    dependencies._firestore_client = None
    dependencies._http_client = None

    # Mock firestore AsyncClient
    with patch("app.core.dependencies.AsyncClient") as mock_firestore_class:
        mock_db = MagicMock(spec=AsyncClient)
        mock_db.close = AsyncMock()
        mock_firestore_class.return_value = mock_db

        # 1. Firestore Client
        db = dependencies.get_firestore_client()
        assert db == mock_db

        # 2. Repositories
        trip_repo = dependencies.get_trip_log_repository()
        assert isinstance(trip_repo, TripLogRepository)
        assert trip_repo.db == mock_db

        comm_repo = dependencies.get_committed_action_repository()
        assert isinstance(comm_repo, CommittedActionRepository)
        assert comm_repo.db == mock_db

        streak_repo = dependencies.get_streak_repository()
        assert isinstance(streak_repo, StreakRepository)
        assert streak_repo.db == mock_db

    # 3. HTTP Client
    http_client = await dependencies.get_http_client()
    assert isinstance(http_client, httpx.AsyncClient)

    # 4. Estimators
    transport_est = dependencies.get_transport_estimator()
    assert isinstance(transport_est, TransportEstimator)

    # 5. Vertex Client
    vertex = dependencies.get_vertex_client()
    assert isinstance(vertex, VertexClient)
    assert vertex.project_id == "handprint"
    assert vertex.location == "asia-south1"
    assert vertex.model_name == "gemini-2.0-flash"

    # 6. Integration Clients
    dm_client = await dependencies.get_distance_matrix_client()
    assert isinstance(dm_client, DistanceMatrixClient)
    assert dm_client.http_client == http_client

    places_client = await dependencies.get_places_client()
    assert isinstance(places_client, PlacesClient)
    assert places_client.http_client == http_client

    aq_client = await dependencies.get_air_quality_client()
    assert isinstance(aq_client, AirQualityClient)
    assert aq_client.http_client == http_client

    # 7. Lifespan Cleanup / close_clients
    # Set firestore mock client back
    dependencies._firestore_client = mock_db
    await dependencies.close_clients()

    assert dependencies._http_client is None
    assert dependencies._firestore_client is None
    mock_db.close.assert_called_once()
