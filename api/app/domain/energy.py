from collections.abc import Mapping

from pydantic import BaseModel, Field

from app.domain.estimator import EmissionEstimator
from app.domain.factors import EMISSION_FACTORS, EmissionFactor


class EnergyActivity(BaseModel):
    """Input activity model for home energy carbon calculations."""

    source: str = Field(description="Type of energy source, e.g., 'electricity', 'lpg'")
    quantity: float = Field(
        gt=0.0, description="Quantity consumed (kWh for electricity, kg for LPG)"
    )


class EnergyEstimator(EmissionEstimator[EnergyActivity]):
    """Estimates carbon emissions for home energy usage using deterministic factors."""

    def __init__(self, factors: Mapping[str, EmissionFactor] = EMISSION_FACTORS) -> None:
        """Initialize the energy estimator with a mapping of emission factors."""
        self._factors = factors

    def _get_factor_key(self, source: str) -> str:
        """Map common energy sources or shorthands to standard dataset keys."""
        if (
            source.startswith("energy.")
            or source.startswith("transport.")
            or source.startswith("food.")
        ):
            return source

        # Normalize shorthands
        mapping = {
            "electricity": "energy.electricity.india",
            "lpg": "energy.lpg",
        }
        return mapping.get(source.lower(), f"energy.{source.lower()}")

    def estimate(self, activity: EnergyActivity) -> float:
        """Calculate the carbon emissions in kg CO2e for a given energy activity.

        Emissions = quantity * factor_value (kg CO2e / unit)

        Args:
            activity: The energy activity details.

        Returns:
            The calculated footprint in kg CO2e.
        """
        key = self._get_factor_key(activity.source)

        if key not in self._factors:
            raise ValueError(f"Unknown energy source or emission factor key: '{activity.source}'")

        factor = self._factors[key]
        if factor.category != "energy":
            raise ValueError(
                f"Emission factor key '{key}' has category '{factor.category}', expected 'energy'"
            )

        return activity.quantity * factor.value
