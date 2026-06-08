from collections.abc import Mapping

from pydantic import BaseModel, Field

from app.domain.estimator import EmissionEstimator
from app.domain.factors import EMISSION_FACTORS, EmissionFactor


class TransportActivity(BaseModel):
    """Input activity model for transport emission calculations."""

    mode: str = Field(
        description="Mode of transport, e.g., 'petrol_car', 'bus', 'train', 'walking'"
    )
    distance_km: float = Field(gt=0.0, description="Distance traveled in kilometers")


class TransportEstimator(EmissionEstimator[TransportActivity]):
    """Estimates carbon emissions for transport trips using deterministic pure calculation."""

    def __init__(self, factors: Mapping[str, EmissionFactor] = EMISSION_FACTORS) -> None:
        """Initialize the transport estimator with a mapping of emission factors.

        Supports constructor dependency injection.
        """
        self._factors = factors

    def _get_factor_key(self, mode: str) -> str:
        """Map common transport mode shorthand names to standard dataset keys."""
        if (
            mode.startswith("transport.")
            or mode.startswith("energy.")
            or mode.startswith("food.")
        ):
            return mode

        # Normalize shorthands
        mapping = {
            "petrol_car": "transport.car.petrol",
            "diesel_car": "transport.car.diesel",
            "ev_car": "transport.car.ev",
            "ev": "transport.car.ev",
            "hybrid_car": "transport.car.hybrid",
            "hybrid": "transport.car.hybrid",
            "motorbike": "transport.motorbike",
            "two_wheeler": "transport.motorbike",
            "bus": "transport.bus",
            "train": "transport.train",
            "metro": "transport.metro",
            "bicycle": "transport.bicycle",
            "walking": "transport.walking",
        }
        return mapping.get(mode.lower(), f"transport.{mode.lower()}")

    def estimate(self, activity: TransportActivity) -> float:
        """Calculate the carbon emissions in kg CO2e for a given transport activity.

        Emissions = distance_km * factor_value (kg CO2e / km)

        Args:
            activity: The transport activity details.

        Returns:
            The calculated footprint in kg CO2e.
        """
        key = self._get_factor_key(activity.mode)

        if key not in self._factors:
            raise ValueError(f"Unknown transport mode or emission factor key: '{activity.mode}'")

        factor = self._factors[key]
        if factor.category != "transport":
            raise ValueError(
                f"Emission factor key '{key}' has category '{factor.category}', "
                "expected 'transport'"
            )

        return activity.distance_km * factor.value
