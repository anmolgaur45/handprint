import Link from "next/link";
import { ArrowLeft, Leaf } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Methodology — Handprint",
  description:
    "How Handprint calculates carbon emissions, which factor sources we use, and what the estimates cover.",
};

const TRANSPORT_FACTORS = [
  { mode: "Petrol car",           factor: "0.16489", unit: "kg CO2e / km",              source: "UK DESNZ/DEFRA GHG Conversion Factors", year: 2024 },
  { mode: "Diesel car",           factor: "0.16398", unit: "kg CO2e / km",              source: "UK DESNZ/DEFRA GHG Conversion Factors", year: 2024 },
  { mode: "Electric car (EV)",    factor: "0.04690", unit: "kg CO2e / km",              source: "UK DESNZ/DEFRA GHG Conversion Factors", year: 2024 },
  { mode: "Hybrid car",           factor: "0.11500", unit: "kg CO2e / km",              source: "UK DESNZ/DEFRA GHG Conversion Factors", year: 2024 },
  { mode: "Motorbike / scooter",  factor: "0.11327", unit: "kg CO2e / km",              source: "UK DESNZ/DEFRA GHG Conversion Factors", year: 2024 },
  { mode: "Public bus",           factor: "0.09658", unit: "kg CO2e / passenger-km",    source: "UK DESNZ/DEFRA GHG Conversion Factors", year: 2024 },
  { mode: "Passenger train",      factor: "0.03549", unit: "kg CO2e / passenger-km",    source: "UK DESNZ/DEFRA GHG Conversion Factors", year: 2024 },
  { mode: "Metro / light rail",   factor: "0.02781", unit: "kg CO2e / passenger-km",    source: "UK DESNZ/DEFRA GHG Conversion Factors", year: 2024 },
  { mode: "Bicycle",              factor: "0.00000", unit: "kg CO2e / km",              source: "Self-evident (zero operational carbon)", year: 2026 },
  { mode: "Walking",              factor: "0.00000", unit: "kg CO2e / km",              source: "Self-evident (zero operational carbon)", year: 2026 },
];

const ENERGY_FACTORS = [
  { source: "Indian grid electricity", factor: "0.72700", unit: "kg CO2e / kWh", citation: "CEA CO2 Baseline Database, Indian Power Sector v20.0", year: 2024 },
  { source: "LPG (cooking / heating)", factor: "2.93890", unit: "kg CO2e / kg",  citation: "UK DESNZ/DEFRA GHG Conversion Factors", year: 2024 },
];

const FOOD_FACTORS = [
  { item: "Beef",                    factor: "99.48", unit: "kg CO2e / kg", source: "Poore & Nemecek (2018) via Our World in Data", year: 2018 },
  { item: "Farmed fish",             factor: "13.63", unit: "kg CO2e / kg", source: "Poore & Nemecek (2018) via Our World in Data", year: 2018 },
  { item: "Pork",                    factor: "12.31", unit: "kg CO2e / kg", source: "Poore & Nemecek (2018) via Our World in Data", year: 2018 },
  { item: "Chicken (poultry)",       factor: "9.87",  unit: "kg CO2e / kg", source: "Poore & Nemecek (2018) via Our World in Data", year: 2018 },
  { item: "Eggs",                    factor: "4.67",  unit: "kg CO2e / kg", source: "Poore & Nemecek (2018) via Our World in Data", year: 2018 },
  { item: "Rice",                    factor: "4.45",  unit: "kg CO2e / kg", source: "Poore & Nemecek (2018) via Our World in Data", year: 2018 },
  { item: "Milk",                    factor: "3.15",  unit: "kg CO2e / kg", source: "Poore & Nemecek (2018) via Our World in Data", year: 2018 },
  { item: "Wheat & rye",             factor: "1.40",  unit: "kg CO2e / kg", source: "Poore & Nemecek (2018) via Our World in Data", year: 2018 },
  { item: "Vegetables (average)",    factor: "0.53",  unit: "kg CO2e / kg", source: "Poore & Nemecek (2018) via Our World in Data", year: 2018 },
  { item: "Fruit (average)",         factor: "0.43",  unit: "kg CO2e / kg", source: "Poore & Nemecek (2018) via Our World in Data", year: 2018 },
];

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans">
      <header className="sticky top-0 z-40 border-b border-zinc-900 bg-zinc-950/90 backdrop-blur-md px-6 py-4 flex items-center gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
          aria-label="Back to home"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/20 border border-emerald-500/30">
            <Leaf className="h-3 w-3 text-emerald-400" aria-hidden="true" />
          </div>
          <span className="text-base font-bold text-zinc-50 font-[family-name:var(--font-sora)]">Handprint</span>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="max-w-3xl mx-auto px-6 py-16 space-y-12 focus:outline-none">
        <div>
          <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-3">Methodology</p>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-50 font-[family-name:var(--font-sora)]">How the numbers are computed</h1>
          <p className="mt-4 text-zinc-400 leading-relaxed">
            Handprint uses a single formula for all categories. The factors are pinned from
            government and peer-reviewed sources and versioned in the application code.
            They do not change between sessions and are never influenced by the AI model.
          </p>
        </div>

        <section aria-labelledby="the-formula">
          <h2 id="the-formula" className="text-lg font-bold text-zinc-100 mb-4">The formula</h2>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 font-mono text-sm text-emerald-400 mb-4">
            Emissions (kg CO2e) = Activity Amount &times; Emission Factor
          </div>
          <div className="space-y-2 text-sm text-zinc-400">
            <p><span className="text-zinc-200 font-medium">Transport:</span> distance_km &times; factor (kg CO2e/km)</p>
            <p><span className="text-zinc-200 font-medium">Food:</span> weight_kg &times; factor (kg CO2e/kg of food)</p>
            <p><span className="text-zinc-200 font-medium">Electricity:</span> quantity_kwh &times; 0.727 (kg CO2e/kWh)</p>
            <p><span className="text-zinc-200 font-medium">LPG:</span> quantity_kg &times; 2.9389 (kg CO2e/kg)</p>
          </div>
        </section>

        <section aria-labelledby="sources">
          <h2 id="sources" className="text-lg font-bold text-zinc-100 mb-4">Factor sources</h2>
          <div className="space-y-4 text-sm text-zinc-400">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
              <p className="text-zinc-100 font-semibold mb-1">UK DESNZ / DEFRA — Greenhouse Gas Conversion Factors for Company Reporting, 2024</p>
              <p className="leading-relaxed">
                Annual publication from the UK government used for mandatory GHG reporting. Handprint
                uses the passenger transport factors (average occupancy) and the stationary combustion
                factor for LPG. Covers all transport modes and LPG in Handprint.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
              <p className="text-zinc-100 font-semibold mb-1">Central Electricity Authority (India) — CO2 Baseline Database, Version 20.0, December 2024</p>
              <p className="leading-relaxed">
                Official emission factor database published by India&apos;s CEA for use in carbon
                accounting projects. Handprint uses the combined margin factor: 0.727 kg CO2e/kWh.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
              <p className="text-zinc-100 font-semibold mb-1">Poore &amp; Nemecek (2018) — Science 360(6392), via Our World in Data</p>
              <p className="leading-relaxed">
                Lifecycle assessment covering the full supply chain of each food product from land use
                change through processing. Handprint uses the global average value for each food type.
                This paper covers all food categories in Handprint.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="transport-table">
          <h2 id="transport-table" className="text-lg font-bold text-zinc-100 mb-4">Transport factors</h2>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-900/60 text-xs text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-4 py-3">Mode</th>
                  <th scope="col" className="px-4 py-3">Factor</th>
                  <th scope="col" className="px-4 py-3">Unit</th>
                  <th scope="col" className="px-4 py-3">Year</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {TRANSPORT_FACTORS.map((f) => (
                  <tr key={f.mode} className="bg-zinc-950/30 hover:bg-zinc-900/20 transition">
                    <td className="px-4 py-3 text-zinc-200 font-medium">{f.mode}</td>
                    <td className="px-4 py-3 text-emerald-400 font-mono">{f.factor}</td>
                    <td className="px-4 py-3 text-zinc-400">{f.unit}</td>
                    <td className="px-4 py-3 text-zinc-500">{f.year}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="energy-table">
          <h2 id="energy-table" className="text-lg font-bold text-zinc-100 mb-4">Energy factors</h2>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-900/60 text-xs text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-4 py-3">Source</th>
                  <th scope="col" className="px-4 py-3">Factor</th>
                  <th scope="col" className="px-4 py-3">Unit</th>
                  <th scope="col" className="px-4 py-3">Year</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {ENERGY_FACTORS.map((f) => (
                  <tr key={f.source} className="bg-zinc-950/30 hover:bg-zinc-900/20 transition">
                    <td className="px-4 py-3 text-zinc-200 font-medium">{f.source}</td>
                    <td className="px-4 py-3 text-emerald-400 font-mono">{f.factor}</td>
                    <td className="px-4 py-3 text-zinc-400">{f.unit}</td>
                    <td className="px-4 py-3 text-zinc-500">{f.year}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="food-table">
          <h2 id="food-table" className="text-lg font-bold text-zinc-100 mb-4">Food factors</h2>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-900/60 text-xs text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-4 py-3">Item</th>
                  <th scope="col" className="px-4 py-3">Factor</th>
                  <th scope="col" className="px-4 py-3">Unit</th>
                  <th scope="col" className="px-4 py-3">Year</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {FOOD_FACTORS.map((f) => (
                  <tr key={f.item} className="bg-zinc-950/30 hover:bg-zinc-900/20 transition">
                    <td className="px-4 py-3 text-zinc-200 font-medium">{f.item}</td>
                    <td className="px-4 py-3 text-emerald-400 font-mono">{f.factor}</td>
                    <td className="px-4 py-3 text-zinc-400">{f.unit}</td>
                    <td className="px-4 py-3 text-zinc-500">{f.year}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="benchmarks">
          <h2 id="benchmarks" className="text-lg font-bold text-zinc-100 mb-4">Benchmarks</h2>
          <div className="space-y-3 text-sm text-zinc-400">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
              <p className="text-zinc-100 font-semibold mb-1">1.5°C compatible target: 2.1 t CO2e/year (5.75 kg/day)</p>
              <p>
                Derived from the IPCC AR6 Working Group III 1.5°C-compatible per-capita pathway.
                The daily budget is 2,100 kg / 365 = 5.75 kg CO2e per day.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="scope">
          <h2 id="scope" className="text-lg font-bold text-zinc-100 mb-4">Scope and assumptions</h2>
          <div className="space-y-3 text-sm text-zinc-400">
            <div>
              <p className="text-zinc-100 font-medium mb-1">What is included</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Personal travel by the specified transport mode, single-occupant basis for cars</li>
                <li>Dietary choices for 10 common food categories, global lifecycle average</li>
                <li>Indian grid electricity consumption and LPG cooking fuel</li>
              </ul>
            </div>
            <div>
              <p className="text-zinc-100 font-medium mb-1">What is not included</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Aviation and international shipping</li>
                <li>Embodied carbon in goods, services, and capital equipment</li>
                <li>Upstream emissions outside the selected lifecycle scope</li>
              </ul>
            </div>
            <p className="mt-2">
              These exclusions mean Handprint likely underestimates a complete personal footprint.
              Results are educational estimates intended to inform relative comparisons and
              reduction decisions. They do not constitute a certified carbon audit.
            </p>
          </div>
        </section>

        <footer className="border-t border-zinc-900 pt-8 flex flex-wrap gap-4 text-xs text-zinc-500">
          <Link href="/" className="hover:text-zinc-300 transition">Home</Link>
          <Link href="/about" className="hover:text-zinc-300 transition">About</Link>
          <Link href="/dashboard" className="hover:text-zinc-300 transition">Dashboard</Link>
        </footer>
      </main>
    </div>
  );
}
