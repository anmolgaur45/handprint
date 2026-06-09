from datetime import UTC, datetime

from pydantic import BaseModel, Field


class TripLog(BaseModel):
    """Domain model representing a logged travel trip."""

    id: str | None = Field(default=None, description="Firestore document ID")
    user_id: str = Field(description="Firebase Auth UID of the owner user")
    origin: str = Field(default="", max_length=256, description="Starting location name")
    destination: str = Field(default="", max_length=256, description="Ending location name")
    distance_km: float = Field(gt=0.0, description="Distance traveled in kilometers")
    mode: str = Field(description="Mode of transport, matching emission factors")
    co2e_kg: float = Field(ge=0.0, description="Calculated carbon footprint in kg CO2e")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(UTC), description="Time the trip was logged"
    )
    citation: str = Field(description="Source citation for the factor used")
    effective_year: int = Field(description="Effective year of the factor used")


class CommittedAction(BaseModel):
    """Domain model representing a reduction commitment by a user."""

    id: str | None = Field(default=None, description="Firestore document ID")
    user_id: str = Field(description="Firebase Auth UID of the owner user")
    action_key: str = Field(description="Action identifier key")
    title: str = Field(min_length=1, max_length=256, description="Description of the action")
    category: str = Field(description="Category of commitment: transport, food, energy")
    projected_savings_kg: float = Field(ge=0.0, description="Projected annual kg CO2e saved")
    committed_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    status: str = Field(default="active", description="Status: 'active', 'completed', 'abandoned'")


class UserStreak(BaseModel):
    """Domain model representing user activity streak metrics."""

    user_id: str = Field(description="Firebase Auth UID of the owner user")
    current_streak: int = Field(default=0, ge=0, description="Current consecutive active periods")
    longest_streak: int = Field(default=0, ge=0, description="Longest consecutive active periods")
    last_active_at: datetime | None = Field(
        default=None, description="Time of last logging activity"
    )


class FoodLog(BaseModel):
    """Domain model representing a logged food consumption activity."""

    id: str | None = Field(default=None, description="Firestore document ID")
    user_id: str = Field(description="Firebase Auth UID of the owner user")
    item: str = Field(min_length=1, max_length=256, description="Food item name shorthand or key")
    weight_kg: float = Field(gt=0.0, description="Weight of the food item in kilograms")
    co2e_kg: float = Field(ge=0.0, description="Calculated carbon footprint in kg CO2e")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(UTC), description="Time the food was logged"
    )
    citation: str = Field(description="Source citation for the factor used")
    effective_year: int = Field(description="Effective year of the factor used")


class EnergyLog(BaseModel):
    """Domain model representing a logged utility energy activity."""

    id: str | None = Field(default=None, description="Firestore document ID")
    user_id: str = Field(description="Firebase Auth UID of the owner user")
    source: str = Field(min_length=1, max_length=256, description="Energy source shorthand or key")
    quantity: float = Field(
        gt=0.0, description="Quantity consumed (kWh for electricity, kg for LPG)"
    )
    co2e_kg: float = Field(ge=0.0, description="Calculated carbon footprint in kg CO2e")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(UTC), description="Time the energy was logged"
    )
    citation: str = Field(description="Source citation for the factor used")
    effective_year: int = Field(description="Effective year of the factor used")
