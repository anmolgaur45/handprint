from google.cloud.firestore import AsyncClient


class CommittedActionRepository:
    """Repository for managing committed actions in Cloud Firestore.

    Uses constructor dependency injection for the Firestore database client.
    """

    def __init__(self, db: AsyncClient) -> None:
        self.db = db
