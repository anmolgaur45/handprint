import pytest
from pydantic import ValidationError

from app.domain.energy import EnergyActivity, EnergyEstimator


def test_energy_estimator_success() -> None:
    """Test successful calculations for home energy sources."""
    estimator = EnergyEstimator()

    # Electricity India: 100 kWh * 0.727 = 72.70
    act_elec = EnergyActivity(source="electricity", quantity=100.0)
    assert pytest.approx(estimator.estimate(act_elec)) == 72.70

    # LPG: 15.0 kg * 2.93890 = 44.0835
    act_lpg = EnergyActivity(source="energy.lpg", quantity=15.0)
    assert pytest.approx(estimator.estimate(act_lpg)) == 44.0835


def test_energy_estimator_invalid_source() -> None:
    """Test estimation fails for unknown energy sources."""
    estimator = EnergyEstimator()
    act_invalid = EnergyActivity(source="coal", quantity=10.0)
    with pytest.raises(ValueError, match="Unknown energy source or emission factor key"):
        estimator.estimate(act_invalid)


def test_energy_estimator_invalid_category() -> None:
    """Test estimation fails for keys belonging to non-energy categories."""
    estimator = EnergyEstimator()
    # transport.bus is not an energy source
    act_wrong = EnergyActivity(source="transport.bus", quantity=1.0)
    with pytest.raises(ValueError, match="expected 'energy'"):
        estimator.estimate(act_wrong)


def test_energy_activity_validation() -> None:
    """Test validation constraints on EnergyActivity."""
    # quantity must be > 0.0
    with pytest.raises(ValidationError):
        EnergyActivity(source="electricity", quantity=0.0)

    with pytest.raises(ValidationError):
        EnergyActivity(source="electricity", quantity=-10.0)
