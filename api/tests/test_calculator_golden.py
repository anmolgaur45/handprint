from __future__ import annotations

import json
import os
from typing import Any

import pytest

from app.domain.energy import EnergyActivity, EnergyEstimator
from app.domain.food import FoodActivity, FoodEstimator
from app.domain.transport import TransportActivity, TransportEstimator

# Locate the golden cases json
GOLDEN_CASES_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "eval", "data", "calculator_golden_cases.json")
)


def load_golden_cases(category: str) -> list[dict[str, Any]]:
    """Helper to load specific category cases from the golden JSON."""
    if not os.path.exists(GOLDEN_CASES_PATH):
        return []
    with open(GOLDEN_CASES_PATH, encoding="utf-8") as f:
        data = json.load(f)
    return data.get(category, [])


# Load cases for parametrization
transport_cases = load_golden_cases("transport")
food_cases = load_golden_cases("food")
energy_cases = load_golden_cases("energy")


@pytest.mark.parametrize("case", transport_cases)
def test_transport_golden_cases(case: dict[str, Any]) -> None:
    """Verify transport calculator matches regression targets."""
    est = TransportEstimator()
    activity = TransportActivity(mode=case["mode"], distance_km=case["distance_km"])
    actual = est.estimate(activity)
    assert actual == pytest.approx(case["expected_co2e_kg"], abs=1e-4)


@pytest.mark.parametrize("case", food_cases)
def test_food_golden_cases(case: dict[str, Any]) -> None:
    """Verify food calculator matches regression targets."""
    est = FoodEstimator()
    activity = FoodActivity(item=case["item"], weight_kg=case["weight_kg"])
    actual = est.estimate(activity)
    assert actual == pytest.approx(case["expected_co2e_kg"], abs=1e-4)


@pytest.mark.parametrize("case", energy_cases)
def test_energy_golden_cases(case: dict[str, Any]) -> None:
    """Verify energy calculator matches regression targets."""
    est = EnergyEstimator()
    activity = EnergyActivity(source=case["source"], quantity=case["quantity"])
    actual = est.estimate(activity)
    assert actual == pytest.approx(case["expected_co2e_kg"], abs=1e-4)
