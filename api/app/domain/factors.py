from pydantic import BaseModel, Field


class EmissionFactor(BaseModel):
    """Represents a single carbon emission factor with metadata, citation, and year."""

    key: str = Field(description="Unique lookup key, e.g., 'transport.car.petrol'")
    value: float = Field(description="Emission factor value (kg CO2e per unit)")
    unit: str = Field(description="Unit of measurement, e.g., 'kg CO2e / km'")
    category: str = Field(description="Top-level category: transport, food, or energy")
    source: str = Field(description="Official academic or government citation source")
    effective_year: int = Field(description="The year this factor is effective / published")
    description: str = Field(description="Brief explanation of what this factor represents")


# Versioned Emission Factors Dataset
# Sources:
# 1. UK DESNZ / DEFRA Greenhouse Gas Conversion Factors for Company Reporting (2024)
# 2. CEA (Central Electricity Authority, India) CO2 Baseline Database for the
#    Indian Power Sector, Version 20.0 (Dec 2024)
# 3. Poore, J., & Nemecek, T. (2018). Reducing food's environmental impacts
#    through producers and consumers. Science.
EMISSION_FACTORS: dict[str, EmissionFactor] = {
    # --- Transport (per passenger-km or vehicle-km) ---
    "transport.car.petrol": EmissionFactor(
        key="transport.car.petrol",
        value=0.16489,
        unit="kg CO2e / km",
        category="transport",
        source="UK DESNZ/DEFRA Greenhouse Gas Conversion Factors",
        effective_year=2024,
        description="Average petrol passenger car, including real-world driving adjustments.",
    ),
    "transport.car.diesel": EmissionFactor(
        key="transport.car.diesel",
        value=0.16398,
        unit="kg CO2e / km",
        category="transport",
        source="UK DESNZ/DEFRA Greenhouse Gas Conversion Factors",
        effective_year=2024,
        description="Average diesel passenger car, including real-world driving adjustments.",
    ),
    "transport.car.ev": EmissionFactor(
        key="transport.car.ev",
        value=0.04690,
        unit="kg CO2e / km",
        category="transport",
        source="UK DESNZ/DEFRA Greenhouse Gas Conversion Factors",
        effective_year=2024,
        description="Battery electric vehicle (EV), based on average UK grid charging mix.",
    ),
    "transport.car.hybrid": EmissionFactor(
        key="transport.car.hybrid",
        value=0.11500,
        unit="kg CO2e / km",
        category="transport",
        source="UK DESNZ/DEFRA Greenhouse Gas Conversion Factors",
        effective_year=2024,
        description="Average hybrid passenger car (petrol/diesel hybrid).",
    ),
    "transport.motorbike": EmissionFactor(
        key="transport.motorbike",
        value=0.11327,
        unit="kg CO2e / km",
        category="transport",
        source="UK DESNZ/DEFRA Greenhouse Gas Conversion Factors",
        effective_year=2024,
        description="Average motorbike / two-wheeler (all sizes).",
    ),
    "transport.bus": EmissionFactor(
        key="transport.bus",
        value=0.09658,
        unit="kg CO2e / passenger-km",
        category="transport",
        source="UK DESNZ/DEFRA Greenhouse Gas Conversion Factors",
        effective_year=2024,
        description="Average local bus transport emissions per passenger kilometer.",
    ),
    "transport.train": EmissionFactor(
        key="transport.train",
        value=0.03549,
        unit="kg CO2e / passenger-km",
        category="transport",
        source="UK DESNZ/DEFRA Greenhouse Gas Conversion Factors",
        effective_year=2024,
        description="National rail passenger train emissions per passenger kilometer.",
    ),
    "transport.metro": EmissionFactor(
        key="transport.metro",
        value=0.02781,
        unit="kg CO2e / passenger-km",
        category="transport",
        source="UK DESNZ/DEFRA Greenhouse Gas Conversion Factors",
        effective_year=2024,
        description="Light rail, metro, or tram transport emissions per passenger kilometer.",
    ),
    "transport.bicycle": EmissionFactor(
        key="transport.bicycle",
        value=0.0,
        unit="kg CO2e / km",
        category="transport",
        source="Self-evident",
        effective_year=2026,
        description="Bicycle or electric bicycle (zero operational carbon assumed).",
    ),
    "transport.walking": EmissionFactor(
        key="transport.walking",
        value=0.0,
        unit="kg CO2e / km",
        category="transport",
        source="Self-evident",
        effective_year=2026,
        description="Walking (zero operational carbon).",
    ),
    # --- Home Energy ---
    "energy.electricity.india": EmissionFactor(
        key="energy.electricity.india",
        value=0.72700,
        unit="kg CO2e / kWh",
        category="energy",
        source="CEA CO2 Baseline Database for the Indian Power Sector, Version 20.0",
        effective_year=2024,
        description=(
            "Weighted average emission factor for the Indian grid (combined margin / average)."
        ),
    ),
    "energy.lpg": EmissionFactor(
        key="energy.lpg",
        value=2.93890,
        unit="kg CO2e / kg",
        category="energy",
        source="UK DESNZ/DEFRA Greenhouse Gas Conversion Factors",
        effective_year=2024,
        description="Liquefied Petroleum Gas (LPG) for cooking or heating.",
    ),
    # --- Food (per kg of product) ---
    "food.beef": EmissionFactor(
        key="food.beef",
        value=99.48,
        unit="kg CO2e / kg",
        category="food",
        source="Poore & Nemecek (2018) via Our World in Data",
        effective_year=2018,
        description="Beef from beef herd, global lifecycle average.",
    ),
    "food.chicken": EmissionFactor(
        key="food.chicken",
        value=9.87,
        unit="kg CO2e / kg",
        category="food",
        source="Poore & Nemecek (2018) via Our World in Data",
        effective_year=2018,
        description="Poultry meat, global lifecycle average.",
    ),
    "food.pork": EmissionFactor(
        key="food.pork",
        value=12.31,
        unit="kg CO2e / kg",
        category="food",
        source="Poore & Nemecek (2018) via Our World in Data",
        effective_year=2018,
        description="Pig meat, global lifecycle average.",
    ),
    "food.fish": EmissionFactor(
        key="food.fish",
        value=13.63,
        unit="kg CO2e / kg",
        category="food",
        source="Poore & Nemecek (2018) via Our World in Data",
        effective_year=2018,
        description="Farmed fish, global lifecycle average.",
    ),
    "food.milk": EmissionFactor(
        key="food.milk",
        value=3.15,
        unit="kg CO2e / kg",
        category="food",
        source="Poore & Nemecek (2018) via Our World in Data",
        effective_year=2018,
        description="Cow's milk, global lifecycle average.",
    ),
    "food.eggs": EmissionFactor(
        key="food.eggs",
        value=4.67,
        unit="kg CO2e / kg",
        category="food",
        source="Poore & Nemecek (2018) via Our World in Data",
        effective_year=2018,
        description="Eggs, global lifecycle average.",
    ),
    "food.rice": EmissionFactor(
        key="food.rice",
        value=4.45,
        unit="kg CO2e / kg",
        category="food",
        source="Poore & Nemecek (2018) via Our World in Data",
        effective_year=2018,
        description="Rice, global lifecycle average.",
    ),
    "food.wheat": EmissionFactor(
        key="food.wheat",
        value=1.40,
        unit="kg CO2e / kg",
        category="food",
        source="Poore & Nemecek (2018) via Our World in Data",
        effective_year=2018,
        description="Wheat & Rye, global lifecycle average.",
    ),
    "food.vegetables": EmissionFactor(
        key="food.vegetables",
        value=0.53,
        unit="kg CO2e / kg",
        category="food",
        source="Poore & Nemecek (2018) via Our World in Data",
        effective_year=2018,
        description="Vegetables (average), global lifecycle average.",
    ),
    "food.fruit": EmissionFactor(
        key="food.fruit",
        value=0.43,
        unit="kg CO2e / kg",
        category="food",
        source="Poore & Nemecek (2018) via Our World in Data",
        effective_year=2018,
        description="Fruit (average), global lifecycle average.",
    ),
}
