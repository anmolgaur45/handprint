import httpx
from google.cloud.firestore import AsyncClient

from app.clients.air_quality import AirQualityClient
from app.clients.distance_matrix import DistanceMatrixClient
from app.clients.places import PlacesClient
from app.clients.vertex import VertexClient
from app.core.config import get_settings
from app.domain.transport import TransportEstimator
from app.repositories.committed_action import CommittedActionRepository
from app.repositories.streak import StreakRepository
from app.repositories.trip_log import TripLogRepository

# Singletons / cached clients
_firestore_client: AsyncClient | None = None
_http_client: httpx.AsyncClient | None = None


def get_firestore_client() -> AsyncClient:
    """Provide a cached Firestore AsyncClient."""
    global _firestore_client
    if _firestore_client is None:
        settings = get_settings()
        _firestore_client = AsyncClient(project=settings.gcp_project_id)
    return _firestore_client


async def get_http_client() -> httpx.AsyncClient:
    """Provide a cached HTTPX AsyncClient."""
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient()
    return _http_client


async def close_clients() -> None:
    """Clean up and close any open global clients."""
    global _firestore_client, _http_client
    if _http_client is not None:
        await _http_client.aclose()
        _http_client = None
    if _firestore_client is not None:
        await _firestore_client.close()  # type: ignore[no-untyped-call]
        _firestore_client = None


def get_transport_estimator() -> TransportEstimator:
    """Inject TransportEstimator instance."""
    return TransportEstimator()


def get_trip_log_repository() -> TripLogRepository:
    """Inject TripLogRepository instance."""
    db = get_firestore_client()
    return TripLogRepository(db=db)


def get_committed_action_repository() -> CommittedActionRepository:
    """Inject CommittedActionRepository instance."""
    db = get_firestore_client()
    return CommittedActionRepository(db=db)


def get_streak_repository() -> StreakRepository:
    """Inject StreakRepository instance."""
    db = get_firestore_client()
    return StreakRepository(db=db)


def get_vertex_client() -> VertexClient:
    """Inject VertexClient instance."""
    settings = get_settings()
    return VertexClient(
        project_id=settings.gcp_project_id,
        location=settings.gcp_region,
        model_name=settings.vertex_model,
    )


async def get_distance_matrix_client() -> DistanceMatrixClient:
    """Inject DistanceMatrixClient instance."""
    settings = get_settings()
    http_client = await get_http_client()
    return DistanceMatrixClient(
        api_key=settings.maps_api_key,
        http_client=http_client,
    )


async def get_places_client() -> PlacesClient:
    """Inject PlacesClient instance."""
    settings = get_settings()
    http_client = await get_http_client()
    return PlacesClient(
        api_key=settings.maps_api_key,
        http_client=http_client,
    )


async def get_air_quality_client() -> AirQualityClient:
    """Inject AirQualityClient instance."""
    settings = get_settings()
    http_client = await get_http_client()
    return AirQualityClient(
        api_key=settings.maps_api_key,
        http_client=http_client,
    )
