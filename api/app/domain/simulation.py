from abc import ABC, abstractmethod

from app.domain.models import TripLog
from app.domain.transport import TransportEstimator


def calculate_annual_scaling_factor(trips: list[TripLog]) -> float:
    """Calculate the multiplier to project the logged period to a full year.

    If the trip log span is less than 7 days, we assume the logs represent a weekly average
    (i.e., we scale by 365 / 7 = 52.14). If the logs span more than 7 days, we compute
    the exact span from the first trip timestamp to the last trip timestamp (minimum 7 days).

    Args:
        trips: List of logged travel trips.

    Returns:
        Annual scaling factor (float multiplier).
    """
    if not trips:
        return 0.0

    timestamps = [t.timestamp for t in trips]
    min_date = min(timestamps).date()
    max_date = max(timestamps).date()

    days_span = (max_date - min_date).days + 1
    # Minimum span of 7 days to prevent extreme multiplier scaling
    effective_days = max(7.0, float(days_span))

    return 365.0 / effective_days


class SimulationCommand(ABC):
    """Abstract base class representing a single what-if scenario command."""

    @abstractmethod
    def execute(self, trips: list[TripLog], estimator: TransportEstimator) -> float:
        """Execute the simulation scenario on the user's trip history.

        Args:
            trips: List of logged travel trips to simulate changes on.
            estimator: Transport carbon calculation engine.

        Returns:
            The projected annual carbon savings in kg CO2e.
        """
        pass


class EVCarSwapCommand(SimulationCommand):
    """Simulates swapping all combustion-engine car driving trips to electric vehicles (EVs)."""

    def execute(self, trips: list[TripLog], estimator: TransportEstimator) -> float:
        savings = 0.0
        ev_factor_meta = estimator.get_factor_metadata("ev_car")
        if ev_factor_meta is None:
            return 0.0

        ev_factor = ev_factor_meta.value

        for trip in trips:
            if trip.mode in ("petrol_car", "diesel_car", "hybrid_car"):
                original_co2e = trip.co2e_kg
                simulated_co2e = trip.distance_km * ev_factor
                savings += max(0.0, original_co2e - simulated_co2e)

        scale = calculate_annual_scaling_factor(trips)
        return savings * scale


class ModeShiftCommand(SimulationCommand):
    """Simulates shifting private motorized trips to public transit or active travel."""

    def __init__(self, target_mode: str, percentage: float) -> None:
        if not (0.0 <= percentage <= 1.0):
            raise ValueError("Percentage must be between 0.0 and 1.0")
        self.target_mode = target_mode
        self.percentage = percentage

    def execute(self, trips: list[TripLog], estimator: TransportEstimator) -> float:
        savings = 0.0
        target_factor_meta = estimator.get_factor_metadata(self.target_mode)
        if target_factor_meta is None:
            raise ValueError(f"Invalid target mode: '{self.target_mode}'")

        target_factor = target_factor_meta.value

        for trip in trips:
            if trip.mode in ("petrol_car", "diesel_car", "hybrid_car", "ev_car", "motorbike"):
                original_co2e = trip.co2e_kg
                simulated_co2e = trip.distance_km * target_factor
                savings += max(0.0, original_co2e - simulated_co2e) * self.percentage

        scale = calculate_annual_scaling_factor(trips)
        return savings * scale


class ReduceTripsCommand(SimulationCommand):
    """Simulates eliminating a percentage of all travel trips entirely (e.g. remote work days)."""

    def __init__(self, percentage: float) -> None:
        if not (0.0 <= percentage <= 1.0):
            raise ValueError("Percentage must be between 0.0 and 1.0")
        self.percentage = percentage

    def execute(self, trips: list[TripLog], estimator: TransportEstimator) -> float:
        savings = sum(trip.co2e_kg for trip in trips) * self.percentage
        scale = calculate_annual_scaling_factor(trips)
        return savings * scale
