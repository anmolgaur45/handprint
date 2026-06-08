from typing import Protocol, TypeVar

ActivityT = TypeVar("ActivityT", contravariant=True)


class EmissionEstimator(Protocol[ActivityT]):
    """Protocol for emission estimators across different categories (transport, food, energy)."""

    def estimate(self, activity: ActivityT) -> float:
        """Calculate the carbon emissions in kg CO2e for the given activity.

        Args:
            activity: The activity details.

        Returns:
            The calculated carbon footprint in kilograms of CO2 equivalent (kg CO2e).
        """
        ...
