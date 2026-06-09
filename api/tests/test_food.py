import pytest
from pydantic import ValidationError

from app.domain.food import FoodActivity, FoodEstimator


def test_food_estimator_success() -> None:
    """Test successful calculations for various food items."""
    estimator = FoodEstimator()

    # Beef calculation: 1.5 kg * 99.48 = 149.22
    act_beef = FoodActivity(item="beef", weight_kg=1.5)
    assert pytest.approx(estimator.estimate(act_beef)) == 149.22

    # Rice calculation: 2.0 kg * 4.45 = 8.90
    act_rice = FoodActivity(item="rice", weight_kg=2.0)
    assert pytest.approx(estimator.estimate(act_rice)) == 8.90

    # Vegetables calculation: 0.5 kg * 0.53 = 0.265
    act_veg = FoodActivity(item="food.vegetables", weight_kg=0.5)
    assert pytest.approx(estimator.estimate(act_veg)) == 0.265


def test_food_estimator_invalid_item() -> None:
    """Test estimation fails for unknown items."""
    estimator = FoodEstimator()
    act_invalid = FoodActivity(item="plastic", weight_kg=1.0)
    with pytest.raises(ValueError, match="Unknown food item or emission factor key"):
        estimator.estimate(act_invalid)


def test_food_estimator_invalid_category() -> None:
    """Test estimation fails for keys belonging to non-food categories."""
    estimator = FoodEstimator()
    # transport.bus is not a food item
    act_wrong = FoodActivity(item="transport.bus", weight_kg=1.0)
    with pytest.raises(ValueError, match="expected 'food'"):
        estimator.estimate(act_wrong)


def test_food_activity_validation() -> None:
    """Test validation constraints on FoodActivity."""
    # weight_kg must be > 0.0
    with pytest.raises(ValidationError):
        FoodActivity(item="beef", weight_kg=0.0)

    with pytest.raises(ValidationError):
        FoodActivity(item="beef", weight_kg=-5.0)
