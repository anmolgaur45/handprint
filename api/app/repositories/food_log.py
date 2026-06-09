from google.cloud.firestore import AsyncClient, FieldFilter

from app.domain.models import FoodLog


class FoodLogRepository:
    """Repository for managing food logs in Cloud Firestore.

    Uses constructor dependency injection for the Firestore database client.
    """

    def __init__(self, db: AsyncClient) -> None:
        self.db = db
        self.collection_name = "food_logs"

    async def create(self, log: FoodLog) -> FoodLog:
        """Create a new food log document in Firestore."""
        doc_ref = self.db.collection(self.collection_name).document()
        log_id = doc_ref.id

        data = {
            "user_id": log.user_id,
            "item": log.item,
            "weight_kg": log.weight_kg,
            "co2e_kg": log.co2e_kg,
            "timestamp": log.timestamp,
            "citation": log.citation,
            "effective_year": log.effective_year,
        }
        await doc_ref.set(data)

        return log.model_copy(update={"id": log_id})

    async def list_by_user(self, user_id: str) -> list[FoodLog]:
        """Fetch all food logs for a given user, ordered by timestamp descending."""
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
                logs.append(FoodLog(**data))
        return logs
