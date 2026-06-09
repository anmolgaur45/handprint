from collections.abc import Mapping

from pydantic import BaseModel, Field

from app.domain.estimator import EmissionEstimator
from app.domain.factors import EMISSION_FACTORS, EmissionFactor


class FoodActivity(BaseModel):
    """Input activity model for food carbon calculations."""

    item: str = Field(
        description="Type of food item, e.g., 'beef', 'chicken', 'rice', 'vegetables'"
    )
    weight_kg: float = Field(gt=0.0, description="Weight of the food item in kilograms")


class FoodEstimator(EmissionEstimator[FoodActivity]):
    """Estimates carbon emissions for food consumption using deterministic life cycle factors."""

    def __init__(self, factors: Mapping[str, EmissionFactor] = EMISSION_FACTORS) -> None:
        """Initialize the food estimator with a mapping of emission factors."""
        self._factors = factors

    def _get_factor_key(self, item: str) -> str:
        """Map common food items or shorthands to standard dataset keys."""
        if item.startswith("food.") or item.startswith("transport.") or item.startswith("energy."):
            return item

        # Normalize shorthands
        mapping = {
            "beef": "food.beef",
            "chicken": "food.chicken",
            "pork": "food.pork",
            "fish": "food.fish",
            "milk": "food.milk",
            "eggs": "food.eggs",
            "rice": "food.rice",
            "wheat": "food.wheat",
            "vegetables": "food.vegetables",
            "fruit": "food.fruit",
        }
        return mapping.get(item.lower(), f"food.{item.lower()}")

    def get_factor_metadata(self, key: str) -> EmissionFactor | None:
        """Return the EmissionFactor for *key* (shorthand or full), or None if not found."""
        return self._factors.get(self._get_factor_key(key))

    def estimate(self, activity: FoodActivity) -> float:
        """Calculate the carbon emissions in kg CO2e for a given food activity.

        Emissions = weight_kg * factor_value (kg CO2e / kg)

        Args:
            activity: The food activity details.

        Returns:
            The calculated footprint in kg CO2e.
        """
        key = self._get_factor_key(activity.item)

        if key not in self._factors:
            raise ValueError(f"Unknown food item or emission factor key: '{activity.item}'")

        factor = self._factors[key]
        if factor.category != "food":
            raise ValueError(
                f"Emission factor key '{key}' has category '{factor.category}', expected 'food'"
            )

        return activity.weight_kg * factor.value
