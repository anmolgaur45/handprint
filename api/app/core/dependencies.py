from __future__ import annotations

import os
import uuid
from collections import defaultdict
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

import google.auth
import google.auth.exceptions
import httpx
import structlog
from google.cloud.firestore import AsyncClient

from app.clients.distance_matrix import DistanceMatrixClient
from app.clients.vertex import VertexClient
from app.core.config import get_settings
from app.domain import EnergyEstimator, FoodEstimator, TransportEstimator
from app.repositories import (
    CommittedActionRepository,
    EnergyLogRepository,
    FoodLogRepository,
    StreakRepository,
    TripLogRepository,
)

# Singletons / cached clients
_firestore_client: AsyncClient | None = None
_http_client: httpx.AsyncClient | None = None

class InMemoryDocumentSnapshot:
    def __init__(self, doc_id: str, data: dict[str, Any] | None):
        self.id = doc_id
        self._data = data
        self.exists = data is not None

    def to_dict(self) -> dict[str, Any] | None:
        return self._data

class InMemoryDocumentReference:
    def __init__(self, collection: InMemoryCollectionReference, doc_id: str | None = None):
        self.collection = collection
        self.id = doc_id or str(uuid.uuid4())

    async def set(self, data: dict[str, Any]) -> None:
        self.collection.store[self.id] = dict(data)

    async def get(self) -> InMemoryDocumentSnapshot:
        data = self.collection.store.get(self.id)
        return InMemoryDocumentSnapshot(self.id, data)

    async def update(self, data: dict[str, Any]) -> None:
        if self.id in self.collection.store:
            self.collection.store[self.id].update(data)
        else:
            self.collection.store[self.id] = dict(data)

class InMemoryQuery:
    def __init__(
        self,
        store: dict[str, dict[str, Any]],
        filters: list[Any] | None = None,
        order_by_field: str | None = None,
        descending: bool = False,
    ):
        self.store = store
        self.filters = filters or []
        self.order_by_field = order_by_field
        self.descending = descending

    def where(self, filter: Any = None, **kwargs: Any) -> InMemoryQuery:  # noqa: A002
        new_filters = list(self.filters)
        if filter is not None:
            new_filters.append(filter)
        return InMemoryQuery(self.store, new_filters, self.order_by_field, self.descending)

    def order_by(self, field: str, direction: str = "ASCENDING") -> InMemoryQuery:
        desc = (direction == "DESCENDING")
        return InMemoryQuery(self.store, self.filters, field, desc)

    async def stream(self) -> AsyncIterator[InMemoryDocumentSnapshot]:
        results = []
        for doc_id, data in self.store.items():
            match = True
            for f in self.filters:
                field_path = getattr(f, "field_path", None)
                op = getattr(f, "op", getattr(f, "op_string", "=="))
                value = getattr(f, "value", None)
                if field_path:
                    field_val = data.get(field_path)
                    if op == "==" and field_val != value:
                        match = False
                        break
            if match:
                results.append(InMemoryDocumentSnapshot(doc_id, data))

        if self.order_by_field:
            def sort_key(snapshot: InMemoryDocumentSnapshot) -> Any:
                d = snapshot.to_dict()
                val = d.get(self.order_by_field) if (d and self.order_by_field) else None
                return val or ""
            results.sort(key=sort_key, reverse=self.descending)

        for res in results:
            yield res

class InMemoryCollectionReference:
    def __init__(self, client: InMemoryAsyncClient, name: str):
        self.client = client
        self.name = name
        self.store = client.databases[name]

    def document(self, doc_id: str | None = None) -> InMemoryDocumentReference:
        return InMemoryDocumentReference(self, doc_id)

    def where(self, filter: Any = None, **kwargs: Any) -> InMemoryQuery:  # noqa: A002
        return InMemoryQuery(self.store).where(filter=filter)

    def order_by(self, field: str, direction: str = "ASCENDING") -> InMemoryQuery:
        return InMemoryQuery(self.store).order_by(field, direction)

    async def stream(self) -> AsyncIterator[InMemoryDocumentSnapshot]:
        async for doc in InMemoryQuery(self.store).stream():
            yield doc

class InMemoryAsyncClient:
    def __init__(self) -> None:
        self.databases: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)

    def collection(self, name: str) -> InMemoryCollectionReference:
        return InMemoryCollectionReference(self, name)

    async def close(self) -> None:
        """No-op: in-memory client has no connections to close."""


def get_firestore_client() -> AsyncClient:
    """Provide a cached Firestore AsyncClient, falling back to InMemoryAsyncClient if needed."""
    global _firestore_client
    if _firestore_client is None:
        settings = get_settings()
        use_in_memory = False
        if not os.environ.get("FIRESTORE_EMULATOR_HOST"):
            try:
                google.auth.default()
            except google.auth.exceptions.DefaultCredentialsError:
                use_in_memory = True

        if use_in_memory:
            structlog.get_logger(__name__).warning(
                "No GCP credentials or Firestore Emulator found. "
                "Gracefully falling back to in-memory Firestore mockup."
            )
            _firestore_client = InMemoryAsyncClient()  # type: ignore[assignment]
        else:
            _firestore_client = AsyncClient(project=settings.gcp_project_id)
    assert _firestore_client is not None
    return _firestore_client


def enable_in_memory_mode() -> None:
    """Force the Firestore client singleton to InMemoryAsyncClient."""
    global _firestore_client
    _firestore_client = InMemoryAsyncClient()  # type: ignore[assignment]


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



def get_food_estimator() -> FoodEstimator:
    """Inject FoodEstimator instance."""
    return FoodEstimator()


def get_food_log_repository() -> FoodLogRepository:
    """Inject FoodLogRepository instance."""
    db = get_firestore_client()
    return FoodLogRepository(db=db)


def get_energy_estimator() -> EnergyEstimator:
    """Inject EnergyEstimator instance."""
    return EnergyEstimator()


def get_energy_log_repository() -> EnergyLogRepository:
    """Inject EnergyLogRepository instance."""
    db = get_firestore_client()
    return EnergyLogRepository(db=db)
