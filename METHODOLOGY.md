# Carbon Accounting Methodology

All CO2e values in Handprint are produced by deterministic pure functions over the factor table below. This document records every factor, formula, benchmark constant, and honest limitation in one place.

---

## Calculation formulas

### Activity → CO2e

| Category | Formula | Unit |
|---|---|---|
| Transport | `co2e_kg = distance_km × factor_value` | kg CO2e per km |
| Food | `co2e_kg = weight_kg × factor_value` | kg CO2e per kg food |
| Home energy | `co2e_kg = quantity × factor_value` | kg CO2e per kWh (electricity) or per kg (LPG) |

All factors are applied without adjustment. No interpolation, scaling, or model-derived rounding is applied.

### Annual projection (simulator)

```
day_span = max(7, date_of_last_log - date_of_first_log + 1)  [in days]
annual_scaling_factor = 365 / day_span
projected_annual_co2e = sum_of_logged_co2e × annual_scaling_factor
```

A minimum span of 7 days is enforced to prevent extreme multipliers when a user has only a few days of history. The simulator uses this projection to estimate annual savings under each what-if scenario.

---

## Emission factor dataset

Dataset version: `api/app/domain/factors.py` (22 factors).  
Factor values are stored verbatim from the cited sources. None are rounded or adjusted.

### Transport factors (per km)

| Key | Label | kg CO2e / km | Source | Year |
|---|---|---|---|---|
| `transport.car.petrol` | Petrol car | 0.16489 | UK DESNZ/DEFRA Greenhouse Gas Conversion Factors | 2024 |
| `transport.car.diesel` | Diesel car | 0.16398 | UK DESNZ/DEFRA Greenhouse Gas Conversion Factors | 2024 |
| `transport.car.ev` | Electric car (EV) | 0.04690 | UK DESNZ/DEFRA Greenhouse Gas Conversion Factors | 2024 |
| `transport.car.hybrid` | Hybrid car | 0.11500 | UK DESNZ/DEFRA Greenhouse Gas Conversion Factors | 2024 |
| `transport.motorbike` | Motorbike / scooter | 0.11327 | UK DESNZ/DEFRA Greenhouse Gas Conversion Factors | 2024 |
| `transport.bus` | Public bus | 0.09658 | UK DESNZ/DEFRA Greenhouse Gas Conversion Factors | 2024 |
| `transport.train` | Train | 0.03549 | UK DESNZ/DEFRA Greenhouse Gas Conversion Factors | 2024 |
| `transport.metro` | Metro / light rail | 0.02781 | UK DESNZ/DEFRA Greenhouse Gas Conversion Factors | 2024 |
| `transport.bicycle` | Bicycle | 0.0 | Self-evident | 2026 |
| `transport.walking` | Walking | 0.0 | Self-evident | 2026 |

### Home energy factors

| Key | Label | kg CO2e / unit | Unit | Source | Year |
|---|---|---|---|---|---|
| `energy.electricity.india` | Electricity (Indian grid) | 0.72700 | kWh | CEA CO2 Baseline Database for the Indian Power Sector, Version 20.0 | 2024 |
| `energy.lpg` | LPG (cooking / heating) | 2.93890 | kg | UK DESNZ/DEFRA Greenhouse Gas Conversion Factors | 2024 |

### Food factors (per kg food)

| Key | Label | kg CO2e / kg | Source | Year |
|---|---|---|---|---|
| `food.beef` | Beef | 99.48 | Poore & Nemecek (2018) via Our World in Data | 2018 |
| `food.chicken` | Chicken (poultry) | 9.87 | Poore & Nemecek (2018) via Our World in Data | 2018 |
| `food.pork` | Pork | 12.31 | Poore & Nemecek (2018) via Our World in Data | 2018 |
| `food.fish` | Farmed fish | 13.63 | Poore & Nemecek (2018) via Our World in Data | 2018 |
| `food.milk` | Cow's milk | 3.15 | Poore & Nemecek (2018) via Our World in Data | 2018 |
| `food.eggs` | Eggs | 4.67 | Poore & Nemecek (2018) via Our World in Data | 2018 |
| `food.rice` | Rice | 4.45 | Poore & Nemecek (2018) via Our World in Data | 2018 |
| `food.wheat` | Wheat & rye | 1.40 | Poore & Nemecek (2018) via Our World in Data | 2018 |
| `food.vegetables` | Vegetables (average) | 0.53 | Poore & Nemecek (2018) via Our World in Data | 2018 |
| `food.fruit` | Fruit (average) | 0.43 | Poore & Nemecek (2018) via Our World in Data | 2018 |

---

## Benchmark constants

These are used on the dashboard to contextualise the user's footprint.

| Constant | Value | Source |
|---|---|---|
| 1.5 °C-aligned daily budget | 5.75 kg CO2e / day (~2099 kg/year) | IPCC AR6 (2023) |
| Global average daily footprint | ~10.96 kg CO2e / day (~4000 kg/year) | World Bank (2021) world average |

---

## Honest limitations and assumptions

- **DEFRA factors are UK-derived.** Transport factors come from the UK Department for Energy Security and Net Zero / DEFRA. India-specific per-mode published factors in a comparable format are not available from a single open government source. The DEFRA dataset is the most widely used open source for this purpose.

- **EV factor reflects UK grid intensity.** The EV factor (0.04690 kg CO2e/km) is based on UK grid electricity carbon intensity as of 2024. The Indian grid has a higher intensity (0.727 kg CO2e/kWh, CEA 2024). If the Indian grid intensity were applied to EV charging, the EV factor would be approximately `0.04690 × (0.727 / 0.233) ≈ 0.146 kg CO2e/km`, making it closer to a petrol car. This is a known limitation.

- **Food factors are global lifecycle averages.** Poore & Nemecek (2018) is the most cited open lifecycle assessment dataset. India-specific food supply chain emissions may differ, but no equivalent open dataset exists at the same breadth.

- **Short-history projections are estimates.** When fewer than 7 days of trips are logged, the simulator assumes the logged period is a weekly average (scaling factor = 52.14). This produces wide confidence intervals.

- **No scope 3 transport.** Vehicle manufacture, road construction, and supply chain emissions are not included. Only operational (tailpipe or grid-charging) emissions are counted.

- **Not suitable for compliance reporting.** These factors are educational estimates for personal awareness only. They are not certified for regulatory, procurement, or corporate carbon accounting purposes.

- **Gemini never produces a carbon number.** Vertex AI Gemini is used only to (a) parse a free-text trip description into structured fields, and (b) narrate pre-computed totals in 2-3 sentences. The prompt explicitly instructs the model not to compute, extrapolate, or invent values. The design boundary is enforced in code and tested in the eval harness.
