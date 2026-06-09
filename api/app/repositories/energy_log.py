from google.cloud.firestore import AsyncClient, FieldFilter

from app.domain.models import EnergyLog


class EnergyLogRepository:
    """Repository for managing home energy logs in Cloud Firestore.

    Uses constructor dependency injection for the Firestore database client.
    """

    def __init__(self, db: AsyncClient) -> None:
        self.db = db
        self.collection_name = "energy_logs"

    async def create(self, log: EnergyLog) -> EnergyLog:
        """Create a new energy log document in Firestore."""
        doc_ref = self.db.collection(self.collection_name).document()
        log_id = doc_ref.id

        data = {
            "user_id": log.user_id,
            "source": log.source,
            "quantity": log.quantity,
            "co2e_kg": log.co2e_kg,
            "timestamp": log.timestamp,
            "citation": log.citation,
            "effective_year": log.effective_year,
        }
        await doc_ref.set(data)

        return log.model_copy(update={"id": log_id})

    async def list_by_user(self, user_id: str) -> list[EnergyLog]:
        """Fetch all energy logs for a given user, ordered by timestamp descending."""
        query = (
            self.db.collection(self.collection_name)
            .where(filter=FieldFilter("user_id", "==", user_id))
            .order_by("timestamp", direction="DESCENDING")
        )

        logs = []
        async for doc in query.stream():
            data = doc.to_dict()
            if data is not None:
                data["id"] = doc.id
                logs.append(EnergyLog(**data))
        return logs
