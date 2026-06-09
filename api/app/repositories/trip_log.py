from google.cloud.firestore import AsyncClient, FieldFilter

from app.domain.models import TripLog


class TripLogRepository:
    """Repository for managing trip logs in Cloud Firestore.

    Uses constructor dependency injection for the Firestore database client.
    """

    def __init__(self, db: AsyncClient) -> None:
        self.db = db
        self.collection_name = "trips"

    async def create(self, trip: TripLog) -> TripLog:
        """Create a new trip log document in Firestore."""
        doc_ref = self.db.collection(self.collection_name).document()
        trip_id = doc_ref.id

        data = {
            "user_id": trip.user_id,
            "origin": trip.origin,
            "destination": trip.destination,
            "distance_km": trip.distance_km,
            "mode": trip.mode,
            "co2e_kg": trip.co2e_kg,
            "timestamp": trip.timestamp,
            "citation": trip.citation,
            "effective_year": trip.effective_year,
        }
        await doc_ref.set(data)

        return trip.model_copy(update={"id": trip_id})

    async def list_by_user(self, user_id: str) -> list[TripLog]:
        """Fetch all trip logs for a given user, ordered by timestamp descending."""
        query = (
            self.db.collection(self.collection_name)
            .where(filter=FieldFilter("user_id", "==", user_id))
            .order_by("timestamp", direction="DESCENDING")
        )

        trips = []
        async for doc in query.stream():
            data = doc.to_dict()
            if data is not None:
                # Inject document ID into dict before parsing with Pydantic
                data["id"] = doc.id
                trips.append(TripLog(**data))
        return trips
