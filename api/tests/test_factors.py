from app.domain.factors import EMISSION_FACTORS


def test_emission_factors_validity() -> None:
    """Validate all emission factors in the dataset."""
    assert len(EMISSION_FACTORS) > 0

    for key, factor in EMISSION_FACTORS.items():
        assert factor.key == key
        assert factor.value >= 0.0
        assert factor.unit != ""
        assert factor.category in ("transport", "food", "energy")
        assert factor.source != ""
        assert factor.effective_year > 2000
        assert factor.description != ""


def test_specific_factors_exist() -> None:
    """Ensure key emission factors are present in the dataset."""
    # Transport keys
    assert "transport.car.petrol" in EMISSION_FACTORS
    assert "transport.car.ev" in EMISSION_FACTORS
    assert "transport.bus" in EMISSION_FACTORS
    assert "transport.train" in EMISSION_FACTORS
    assert "transport.metro" in EMISSION_FACTORS

    # Energy keys
    assert "energy.electricity.india" in EMISSION_FACTORS
    assert "energy.lpg" in EMISSION_FACTORS

    # Food keys
    assert "food.beef" in EMISSION_FACTORS
    assert "food.chicken" in EMISSION_FACTORS
    assert "food.rice" in EMISSION_FACTORS
    assert "food.milk" in EMISSION_FACTORS


def test_petrol_car_factor() -> None:
    """Verify the petrol car emission factor value and metadata."""
    factor = EMISSION_FACTORS["transport.car.petrol"]
    assert factor.value == 0.16489
    assert factor.unit == "kg CO2e / km"
    assert factor.category == "transport"


def test_ev_car_factor() -> None:
    """Verify the EV car emission factor value and metadata."""
    factor = EMISSION_FACTORS["transport.car.ev"]
    assert factor.value == 0.04690
    assert factor.unit == "kg CO2e / km"
    assert factor.category == "transport"


def test_india_electricity_factor() -> None:
    """Verify the Indian grid electricity emission factor value and metadata."""
    factor = EMISSION_FACTORS["energy.electricity.india"]
    assert factor.value == 0.72700
    assert factor.unit == "kg CO2e / kWh"
    assert factor.category == "energy"


def test_beef_factor() -> None:
    """Verify the beef emission factor value and metadata."""
    factor = EMISSION_FACTORS["food.beef"]
    assert factor.value == 99.48
    assert factor.unit == "kg CO2e / kg"
    assert factor.category == "food"


def test_vegetables_factor() -> None:
    """Verify the vegetables emission factor value and metadata."""
    factor = EMISSION_FACTORS["food.vegetables"]
    assert factor.value == 0.53
    assert factor.unit == "kg CO2e / kg"
    assert factor.category == "food"
