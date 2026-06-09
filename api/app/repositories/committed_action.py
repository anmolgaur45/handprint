from google.cloud.firestore import AsyncClient, FieldFilter

from app.domain.models import CommittedAction


class CommittedActionRepository:
    """Repository for managing committed actions in Cloud Firestore.

    Uses constructor dependency injection for the Firestore database client.
    """

    def __init__(self, db: AsyncClient) -> None:
        self.db = db
        self.collection_name = "committed_actions"

    async def create(self, action: CommittedAction) -> CommittedAction:
        """Create a new committed action document in Firestore."""
        doc_ref = self.db.collection(self.collection_name).document()
        action_id = doc_ref.id

        data = {
            "user_id": action.user_id,
            "action_key": action.action_key,
            "title": action.title,
            "category": action.category,
            "projected_savings_kg": action.projected_savings_kg,
            "committed_at": action.committed_at,
            "status": action.status,
        }
        await doc_ref.set(data)

        return action.model_copy(update={"id": action_id})

    async def list_by_user(self, user_id: str) -> list[CommittedAction]:
        """Fetch all committed actions for a given user, ordered by committed_at descending."""
        query = (
            self.db.collection(self.collection_name)
            .where(filter=FieldFilter("user_id", "==", user_id))
            .order_by("committed_at", direction="DESCENDING")
        )

        actions = []
        async for doc in query.stream():
            data = doc.to_dict()
            if data is not None:
                data["id"] = doc.id
                actions.append(CommittedAction(**data))
        return actions

    async def update_status(self, action_id: str, status: str) -> bool:
        """Update the status of a committed action document. Returns True if successful."""
        doc_ref = self.db.collection(self.collection_name).document(action_id)
        doc = await doc_ref.get()
        if not doc.exists:
            return False

        await doc_ref.update({"status": status})
        return True
