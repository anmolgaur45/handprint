# Handprint — Evaluation Harness Report

Generated on: `2026-06-09 10:44:44 UTC`

Extraction evaluation mode: `Mock (Credential-free)`

## Overall Summary

| Benchmark Suite | Total Cases | Passed / Score | Status |
| --- | --- | --- | --- |
| Calculator Golden Cases | 22 | 22 / 22 | ✅ PASS |
| Gemini Extraction Judge | 8 | Average Score: 100.0% | ✅ PASS |

## 1. Calculator Golden-Case Suite

Verifies pure calculations against official UK DEFRA, CEA, and Our World In Data factor citations.

| Category | Input Details | Expected CO2e | Actual CO2e | Status |
| --- | --- | --- | --- | --- |
| Transport | `petrol_car, 10.0 km` | 1.64890 kg | 1.64890 kg | ✅ PASSED |
| Transport | `diesel_car, 50.0 km` | 8.19900 kg | 8.19900 kg | ✅ PASSED |
| Transport | `ev_car, 100.0 km` | 4.69000 kg | 4.69000 kg | ✅ PASSED |
| Transport | `hybrid_car, 15.0 km` | 1.72500 kg | 1.72500 kg | ✅ PASSED |
| Transport | `motorbike, 20.0 km` | 2.26540 kg | 2.26540 kg | ✅ PASSED |
| Transport | `bus, 25.0 km` | 2.41450 kg | 2.41450 kg | ✅ PASSED |
| Transport | `train, 150.0 km` | 5.32350 kg | 5.32350 kg | ✅ PASSED |
| Transport | `metro, 8.0 km` | 0.22248 kg | 0.22248 kg | ✅ PASSED |
| Transport | `bicycle, 12.0 km` | 0.00000 kg | 0.00000 kg | ✅ PASSED |
| Transport | `walking, 3.0 km` | 0.00000 kg | 0.00000 kg | ✅ PASSED |
| Food | `beef, 0.5 kg` | 49.74000 kg | 49.74000 kg | ✅ PASSED |
| Food | `chicken, 1.2 kg` | 11.84400 kg | 11.84400 kg | ✅ PASSED |
| Food | `pork, 0.8 kg` | 9.84800 kg | 9.84800 kg | ✅ PASSED |
| Food | `fish, 0.6 kg` | 8.17800 kg | 8.17800 kg | ✅ PASSED |
| Food | `milk, 2.0 kg` | 6.30000 kg | 6.30000 kg | ✅ PASSED |
| Food | `eggs, 1.0 kg` | 4.67000 kg | 4.67000 kg | ✅ PASSED |
| Food | `rice, 1.5 kg` | 6.67500 kg | 6.67500 kg | ✅ PASSED |
| Food | `wheat, 2.5 kg` | 3.50000 kg | 3.50000 kg | ✅ PASSED |
| Food | `vegetables, 3.0 kg` | 1.59000 kg | 1.59000 kg | ✅ PASSED |
| Food | `fruit, 1.5 kg` | 0.64500 kg | 0.64500 kg | ✅ PASSED |
| Energy | `electricity, 100.0 units` | 72.70000 kg | 72.70000 kg | ✅ PASSED |
| Energy | `lpg, 14.2 units` | 41.73238 kg | 41.73238 kg | ✅ PASSED |

## 2. Gemini Extraction Evaluation

Extracts semantic attributes (origin, destination, mode) and validates correctness using Gemini-as-Judge.

| User Query | Expected Target | Actual Extraction | Correct | Judge Score | Reasoning |
| --- | --- | --- | --- | --- | --- |
| "took a bus from Indiranagar to Koramangala" | `{"origin": "Indiranagar", "destination": "Koramangala", "mode": "bus"}` | `{"origin": "Indiranagar", "destination": "Koramangala", "mode": "bus"}` | Yes | 100% | Mock: Evaluated in offline mode. Exact structural match confirmed. |
| "drove my petrol car from home to the airport" | `{"origin": "home", "destination": "the airport", "mode": "petrol_car"}` | `{"origin": "home", "destination": "the airport", "mode": "petrol_car"}` | Yes | 100% | Mock: Evaluated in offline mode. Exact structural match confirmed. |
| "took a train from Berlin to Paris" | `{"origin": "Berlin", "destination": "Paris", "mode": "train"}` | `{"origin": "Berlin", "destination": "Paris", "mode": "train"}` | Yes | 100% | Mock: Evaluated in offline mode. Exact structural match confirmed. |
| "walked around the park" | `{"origin": null, "destination": null, "mode": "walking"}` | `{"origin": null, "destination": null, "mode": "walking"}` | Yes | 100% | Mock: Evaluated in offline mode. Exact structural match confirmed. |
| "rode metro from station A to station B" | `{"origin": "station A", "destination": "station B", "mode": "metro"}` | `{"origin": "station A", "destination": "station B", "mode": "metro"}` | Yes | 100% | Mock: Evaluated in offline mode. Exact structural match confirmed. |
| "cycled 5km" | `{"origin": null, "destination": null, "mode": "bicycle"}` | `{"origin": null, "destination": null, "mode": "bicycle"}` | Yes | 100% | Mock: Evaluated in offline mode. Exact structural match confirmed. |
| "drove to the hospital in an EV car" | `{"origin": null, "destination": "the hospital", "mode": "ev_car"}` | `{"origin": null, "destination": "the hospital", "mode": "ev_car"}` | Yes | 100% | Mock: Evaluated in offline mode. Exact structural match confirmed. |
| "hybrid car drive from Mumbai to Pune" | `{"origin": "Mumbai", "destination": "Pune", "mode": "hybrid_car"}` | `{"origin": "Mumbai", "destination": "Pune", "mode": "hybrid_car"}` | Yes | 100% | Mock: Evaluated in offline mode. Exact structural match confirmed. |