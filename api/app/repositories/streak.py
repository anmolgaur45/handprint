from google.cloud.firestore import AsyncClient

from app.domain.models import UserStreak


class StreakRepository:
    """Repository for managing streaks in Cloud Firestore.

    Uses constructor dependency injection for the Firestore database client.
    """

    def __init__(self, db: AsyncClient) -> None:
        self.db = db
        self.collection_name = "streaks"

    async def get_by_user(self, user_id: str) -> UserStreak | None:
        """Fetch the streak record for a given user. Returns None if not found."""
        doc_ref = self.db.collection(self.collection_name).document(user_id)
        doc = await doc_ref.get()
        if not doc.exists:
            return None

        data = doc.to_dict()
        if data is None:
            return None

        # The document ID is the user_id
        data["user_id"] = user_id
        return UserStreak(**data)

    async def upsert(self, streak: UserStreak) -> UserStreak:
        """Create or update a user streak record."""
        doc_ref = self.db.collection(self.collection_name).document(streak.user_id)

        data = {
            "current_streak": streak.current_streak,
            "longest_streak": streak.longest_streak,
            "last_active_at": streak.last_active_at,
        }
        await doc_ref.set(data, merge=True)
        return streak
