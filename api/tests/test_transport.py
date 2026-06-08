import pytest
from pydantic import ValidationError

from app.domain.factors import EMISSION_FACTORS, EmissionFactor
from app.domain.transport import TransportActivity, TransportEstimator


def test_transport_activity_validation() -> None:
    """Validate TransportActivity input requirements."""
    # Valid activity
    activity = TransportActivity(mode="petrol_car", distance_km=10.5)
    assert activity.mode == "petrol_car"
    assert activity.distance_km == 10.5

    # Distance must be greater than 0
    with pytest.raises(ValidationError):
        TransportActivity(mode="petrol_car", distance_km=0.0)

    with pytest.raises(ValidationError):
        TransportActivity(mode="petrol_car", distance_km=-5.0)


def test_transport_estimator_happy_paths() -> None:
    """Verify emissions for standard transport modes using default factors."""
    estimator = TransportEstimator()

    # Petrol car
    activity = TransportActivity(mode="petrol_car", distance_km=10.0)
    expected = 10.0 * EMISSION_FACTORS["transport.car.petrol"].value
    assert pytest.approx(estimator.estimate(activity)) == expected

    # Electric car
    activity = TransportActivity(mode="ev", distance_km=50.0)
    expected = 50.0 * EMISSION_FACTORS["transport.car.ev"].value
    assert pytest.approx(estimator.estimate(activity)) == expected

    # Bus
    activity = TransportActivity(mode="bus", distance_km=5.0)
    expected = 5.0 * EMISSION_FACTORS["transport.bus"].value
    assert pytest.approx(estimator.estimate(activity)) == expected

    # Walking (zero emissions)
    activity = TransportActivity(mode="walking", distance_km=15.0)
    assert estimator.estimate(activity) == 0.0


def test_transport_estimator_fully_qualified_keys() -> None:
    """Verify estimator accepts fully qualified keys directly."""
    estimator = TransportEstimator()
    activity = TransportActivity(mode="transport.car.diesel", distance_km=100.0)
    expected = 100.0 * EMISSION_FACTORS["transport.car.diesel"].value
    assert pytest.approx(estimator.estimate(activity)) == expected


def test_transport_estimator_invalid_modes() -> None:
    """Verify exceptions are raised for unknown modes or wrong categories."""
    estimator = TransportEstimator()

    # Unknown mode
    with pytest.raises(ValueError, match="Unknown transport mode"):
        estimator.estimate(TransportActivity(mode="rocket", distance_km=100.0))

    # Wrong category factor
    with pytest.raises(ValueError, match="expected 'transport'"):
        estimator.estimate(TransportActivity(mode="energy.electricity.india", distance_km=10.0))


def test_transport_estimator_dependency_injection() -> None:
    """Verify estimator uses injected custom emission factors."""
    custom_factors = {
        "transport.car.petrol": EmissionFactor(
            key="transport.car.petrol",
            value=0.5,
            unit="kg CO2e / km",
            category="transport",
            source="Custom Study",
            effective_year=2026,
            description="Highly polluting custom car.",
        )
    }

    estimator = TransportEstimator(factors=custom_factors)
    activity = TransportActivity(mode="petrol_car", distance_km=10.0)
    # Uses custom factor (0.5) instead of default (0.16489)
    assert estimator.estimate(activity) == 5.0
