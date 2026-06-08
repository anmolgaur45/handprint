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
