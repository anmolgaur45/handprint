"use client";

import React, { useEffect, useState } from "react";
import {
  Apple,
  Car,
  CheckCircle,
  ChevronDown,
  Clock,
  Plus,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { AppSidebar } from "@/components/app-sidebar";

// ─── Emission factor tables (pinned from api/app/domain/factors.py) ───────────

const TRANSPORT_FACTORS: Record<string, {
  label: string; description: string; value: number; source: string; year: number;
}> = {
  petrol_car:  { label: "Petrol car",           description: "Average petrol car, per km driven (single occupant).",              value: 0.16489, source: "UK DESNZ/DEFRA GHG Conversion Factors", year: 2024 },
  diesel_car:  { label: "Diesel car",           description: "Average diesel car, per km driven (single occupant).",              value: 0.16398, source: "UK DESNZ/DEFRA GHG Conversion Factors", year: 2024 },
  ev_car:      { label: "Electric car (EV)",    description: "Battery EV, per km. Includes Indian grid carbon intensity.",        value: 0.04690, source: "UK DESNZ/DEFRA GHG Conversion Factors", year: 2024 },
  hybrid_car:  { label: "Hybrid car",           description: "Petrol-electric hybrid, per km driven (single occupant).",         value: 0.11500, source: "UK DESNZ/DEFRA GHG Conversion Factors", year: 2024 },
  motorbike:   { label: "Motorbike / scooter",  description: "Two-wheeler with internal combustion engine, per km.",             value: 0.11327, source: "UK DESNZ/DEFRA GHG Conversion Factors", year: 2024 },
  bus:         { label: "Public bus",           description: "Average public service bus, per passenger km.",                    value: 0.09658, source: "UK DESNZ/DEFRA GHG Conversion Factors", year: 2024 },
  train:       { label: "Train",                description: "Passenger train, per km. Includes traction grid carbon.",          value: 0.03549, source: "UK DESNZ/DEFRA GHG Conversion Factors", year: 2024 },
  metro:       { label: "Metro / light rail",   description: "Urban metro or light rail, per passenger km.",                     value: 0.02781, source: "UK DESNZ/DEFRA GHG Conversion Factors", year: 2024 },
  bicycle:     { label: "Bicycle",              description: "No direct CO2e emissions from operation.",                         value: 0.0,     source: "Self-evident", year: 2026 },
  walking:     { label: "Walking",              description: "No direct CO2e emissions from operation.",                         value: 0.0,     source: "Self-evident", year: 2026 },
};

const FOOD_FACTORS: Record<string, {
  label: string; description: string; value: number; source: string; year: number;
}> = {
  beef:        { label: "Beef",                 description: "Cattle beef, farm-to-retail lifecycle. Includes methane and land use.", value: 99.48, source: "Poore & Nemecek (2018) via Our World in Data", year: 2018 },
  chicken:     { label: "Chicken (poultry)",    description: "Broiler chicken, farm-to-retail lifecycle greenhouse gas emissions.",   value: 9.87,  source: "Poore & Nemecek (2018) via Our World in Data", year: 2018 },
  pork:        { label: "Pork",                 description: "Pig meat, farm-to-retail lifecycle emissions.",                         value: 12.31, source: "Poore & Nemecek (2018) via Our World in Data", year: 2018 },
  fish:        { label: "Farmed fish",          description: "Aquaculture fish, farm-to-retail lifecycle emissions.",                 value: 13.63, source: "Poore & Nemecek (2018) via Our World in Data", year: 2018 },
  milk:        { label: "Cow's milk",           description: "Dairy milk, per kg consumed (farm-to-retail lifecycle).",              value: 3.15,  source: "Poore & Nemecek (2018) via Our World in Data", year: 2018 },
  eggs:        { label: "Eggs",                 description: "Hen's eggs, per kg consumed (farm-to-retail lifecycle).",              value: 4.67,  source: "Poore & Nemecek (2018) via Our World in Data", year: 2018 },
  rice:        { label: "Rice",                 description: "White rice, farm-to-retail. Includes methane from paddy fields.",       value: 4.45,  source: "Poore & Nemecek (2018) via Our World in Data", year: 2018 },
  wheat:       { label: "Wheat & rye",          description: "Wheat and rye cereals, farm-to-retail lifecycle emissions.",           value: 1.40,  source: "Poore & Nemecek (2018) via Our World in Data", year: 2018 },
  vegetables:  { label: "Vegetables (average)", description: "Average mixed vegetables, farm-to-retail lifecycle.",                  value: 0.53,  source: "Poore & Nemecek (2018) via Our World in Data", year: 2018 },
  fruit:       { label: "Fruit (average)",      description: "Average mixed fruit, farm-to-retail lifecycle.",                       value: 0.43,  source: "Poore & Nemecek (2018) via Our World in Data", year: 2018 },
};

const ENERGY_FACTORS: Record<string, {
  label: string; description: string; value: number; unit: string; source: string; year: number;
}> = {
  electricity: { label: "Electricity (Indian grid)", description: "Average emission factor of the Indian power grid (CEA Version 20.0, 2024).", value: 0.727,   unit: "kWh", source: "CEA CO2 Baseline Database for the Indian Power Sector, Version 20.0", year: 2024 },
  lpg:         { label: "LPG (cooking / heating)",   description: "Liquefied petroleum gas direct combustion emissions per kg of fuel.",        value: 2.9389,  unit: "kg",  source: "UK DESNZ/DEFRA GHG Conversion Factors", year: 2024 },
};

// ─── History entry shape ──────────────────────────────────────────────────────

interface HistoryEntry {
  id: string;
  type: "travel" | "food" | "energy";
  label: string;
  amount: string;
  co2e_kg: number;
  timestamp: string;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LogActivityPage() {
  const { user, loading, apiFetch } = useAuth();

  const [activeTab, setActiveTab] = useState<"travel" | "food" | "energy">("travel");

  // Travel state
  const [mode, setMode]               = useState("petrol_car");
  const [distanceKm, setDistanceKm]   = useState<number | "">("");

  // Food state
  const [foodItem, setFoodItem]       = useState("beef");
  const [foodWeight, setFoodWeight]   = useState<number | "">("");

  // Energy state
  const [energySrc, setEnergySrc]     = useState("electricity");
  const [energyQty, setEnergyQty]     = useState<number | "">("");

  // AI autofill
  const [showAi, setShowAi]           = useState(false);
  const [aiText, setAiText]           = useState("");
  const [isAiParsing, setIsAiParsing] = useState(false);

  // Status
  const [isSaving, setIsSaving]       = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg]       = useState("");

  // History
  const [history, setHistory]         = useState<HistoryEntry[]>([]);
  const [historyTick, setHistoryTick] = useState(0);

  // ── Live emission previews ────────────────────────────────────────────────
  const travelCo2e = distanceKm !== "" && Number(distanceKm) > 0
    ? Number(distanceKm) * (TRANSPORT_FACTORS[mode]?.value ?? 0) : null;

  const foodCo2e = foodWeight !== "" && Number(foodWeight) > 0
    ? Number(foodWeight) * (FOOD_FACTORS[foodItem]?.value ?? 0) : null;

  const energyCo2e = energyQty !== "" && Number(energyQty) > 0
    ? Number(energyQty) * (ENERGY_FACTORS[energySrc]?.value ?? 0) : null;

  // ── History fetch ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    let active = true;

    Promise.allSettled([
      apiFetch<{ id: string; mode: string; distance_km: number; co2e_kg: number; timestamp: string }[]>("/trips"),
      apiFetch<{ id: string; item: string; weight_kg: number; co2e_kg: number; timestamp: string }[]>("/food"),
      apiFetch<{ id: string; source: string; quantity: number; co2e_kg: number; timestamp: string }[]>("/energy"),
    ]).then(([trips, foods, energies]) => {
      if (!active) return;
      const entries: HistoryEntry[] = [];
      if (trips.status === "fulfilled") {
        trips.value.forEach((t) => entries.push({
          id: t.id, type: "travel",
          label: TRANSPORT_FACTORS[t.mode]?.label ?? t.mode,
          amount: `${t.distance_km.toFixed(1)} km`,
          co2e_kg: t.co2e_kg, timestamp: t.timestamp,
        }));
      }
      if (foods.status === "fulfilled") {
        foods.value.forEach((f) => entries.push({
          id: f.id, type: "food",
          label: FOOD_FACTORS[f.item]?.label ?? f.item,
          amount: `${f.weight_kg.toFixed(2)} kg`,
          co2e_kg: f.co2e_kg, timestamp: f.timestamp,
        }));
      }
      if (energies.status === "fulfilled") {
        energies.value.forEach((e) => entries.push({
          id: e.id, type: "energy",
          label: ENERGY_FACTORS[e.source]?.label ?? e.source,
          amount: `${e.quantity.toFixed(2)} ${ENERGY_FACTORS[e.source]?.unit ?? ""}`,
          co2e_kg: e.co2e_kg, timestamp: e.timestamp,
        }));
      }
      entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setHistory(entries);
    }).catch(() => { /* non-critical */ });

    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, historyTick]);

  // ── Save handlers ────────────────────────────────────────────────────────
  const handleSaveTravel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!distanceKm || Number(distanceKm) <= 0) return;
    setIsSaving(true); setErrorMsg("");
    try {
      await apiFetch("/trips", {
        method: "POST",
        body: JSON.stringify({ distance_km: Number(distanceKm), mode }),
      });
      setDistanceKm(""); setSaveSuccess(true);
      setHistoryTick((n) => n + 1);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save. Please try again.");
    } finally { setIsSaving(false); }
  };

  const handleSaveFood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foodWeight || Number(foodWeight) <= 0) return;
    setIsSaving(true); setErrorMsg("");
    try {
      await apiFetch("/food", {
        method: "POST",
        body: JSON.stringify({ item: foodItem, weight_kg: Number(foodWeight) }),
      });
      setFoodWeight(""); setSaveSuccess(true);
      setHistoryTick((n) => n + 1);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save. Please try again.");
    } finally { setIsSaving(false); }
  };

  const handleSaveEnergy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!energyQty || Number(energyQty) <= 0) return;
    setIsSaving(true); setErrorMsg("");
    try {
      await apiFetch("/energy", {
        method: "POST",
        body: JSON.stringify({ source: energySrc, quantity: Number(energyQty) }),
      });
      setEnergyQty(""); setSaveSuccess(true);
      setHistoryTick((n) => n + 1);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save. Please try again.");
    } finally { setIsSaving(false); }
  };

  const handleAiParse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiText.trim()) return;
    setIsAiParsing(true); setErrorMsg("");
    try {
      const res = await apiFetch<{ mode: string | null }>("/trips/parse", {
        method: "POST", body: JSON.stringify({ text: aiText }),
      });
      if (res.mode && TRANSPORT_FACTORS[res.mode]) {
        setMode(res.mode); setShowAi(false); setAiText("");
      } else {
        setErrorMsg("AI could not extract a transport mode. Please select one manually.");
      }
    } catch {
      setErrorMsg("AI autofill failed. Please select mode manually.");
    } finally { setIsAiParsing(false); }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  const activeFactor  = TRANSPORT_FACTORS[mode];
  const activeFoodF   = FOOD_FACTORS[foodItem];
  const activeEnergyF = ENERGY_FACTORS[energySrc];

  const tabs = [
    { id: "travel" as const, icon: Car,   label: "Travel"  },
    { id: "food"   as const, icon: Apple, label: "Food"    },
    { id: "energy" as const, icon: Zap,   label: "Energy"  },
  ];

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-50">
      <AppSidebar />

      <div className="flex-1 min-w-0">
        <main
          id="main-content"
          tabIndex={-1}
          className="px-8 py-8 max-w-5xl w-full mx-auto focus:outline-none"
        >
          {/* Page header */}
          <div className="mb-8">
            <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-1.5">Log</p>
            <h1 className="text-2xl font-bold text-zinc-50">Log an activity</h1>
            <p className="text-sm text-zinc-400 mt-1.5 max-w-lg">
              Record the things you do — we convert them to CO₂e using documented emission factors.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

            {/* ── Form card (2/3 width) ─────────────────────────────────── */}
            <section
              aria-labelledby="form-heading"
              className="lg:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-5"
            >
              <h2 id="form-heading" className="sr-only">Activity log form</h2>

              {/* Tab list */}
              <div
                role="tablist"
                aria-label="Activity category"
                className="flex gap-1 rounded-xl bg-zinc-950/60 p-1 border border-zinc-800"
              >
                {tabs.map(({ id, icon: Icon, label }, idx) => {
                  const active = activeTab === id;
                  return (
                    <button
                      key={id}
                      id={`tab-${id}`}
                      role="tab"
                      aria-selected={active}
                      aria-controls={`panel-${id}`}
                      tabIndex={active ? 0 : -1}
                      type="button"
                      onClick={() => { setActiveTab(id); setErrorMsg(""); setSaveSuccess(false); }}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowRight") { e.preventDefault(); setActiveTab(tabs[(idx + 1) % 3].id); }
                        if (e.key === "ArrowLeft")  { e.preventDefault(); setActiveTab(tabs[(idx + 2) % 3].id); }
                      }}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                        active ? "bg-zinc-800 text-zinc-50 shadow" : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Alerts */}
              {errorMsg && (
                <div role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {errorMsg}
                </div>
              )}
              {saveSuccess && (
                <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
                  <CheckCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Activity logged successfully.
                </div>
              )}

              {/* ── Travel panel ──────────────────────────────────────────── */}
              {activeTab === "travel" && (
                <div id="panel-travel" role="tabpanel" aria-labelledby="tab-travel">
                <form onSubmit={handleSaveTravel} className="space-y-5">

                  {/* Mode select */}
                  <div className="space-y-1.5">
                    <label htmlFor="travel-mode" className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      Activity
                    </label>
                    <div className="relative">
                      <select
                        id="travel-mode"
                        value={mode}
                        onChange={(e) => setMode(e.target.value)}
                        className="w-full appearance-none rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-3 pr-10 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        {Object.entries(TRANSPORT_FACTORS).map(([k, f]) => (
                          <option key={k} value={k}>{f.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-snug">{activeFactor.description}</p>
                  </div>

                  {/* AI autofill (collapsible) */}
                  <div>
                    <button
                      type="button"
                      aria-expanded={showAi}
                      onClick={() => setShowAi(!showAi)}
                      className="flex items-center gap-2 text-xs font-medium text-zinc-500 hover:text-zinc-300 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-emerald-500/70" aria-hidden="true" />
                      AI autofill
                      <ChevronDown className={`h-3 w-3 transition-transform ${showAi ? "rotate-180" : ""}`} aria-hidden="true" />
                    </button>
                    {showAi && (
                      <div className="mt-2 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 space-y-2.5">
                        <p className="text-[11px] text-zinc-400">Describe your journey — we extract the transport mode:</p>
                        <div className="flex gap-2">
                          <input
                            id="ai-text-input"
                            type="text"
                            placeholder="e.g., Took the metro to work today"
                            value={aiText}
                            onChange={(e) => setAiText(e.target.value)}
                            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
                          />
                          <button
                            id="ai-autofill-button"
                            type="button"
                            onClick={handleAiParse}
                            disabled={isAiParsing || !aiText.trim()}
                            className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-4 py-2 text-xs font-bold transition disabled:opacity-50 min-w-[64px] flex items-center justify-center"
                          >
                            {isAiParsing
                              ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-950 border-t-transparent" />
                              : "Parse"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Amount */}
                  <div className="space-y-1.5">
                    <label htmlFor="travel-km" className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      Amount (km)
                    </label>
                    <input
                      id="travel-km"
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="20000"
                      placeholder="e.g. 12"
                      value={distanceKm}
                      onChange={(e) => setDistanceKm(e.target.value === "" ? "" : Number(e.target.value))}
                      required
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Live preview */}
                  <div aria-live="polite" aria-atomic="true">
                    {travelCo2e !== null && travelCo2e > 0 ? (
                      <div className="rounded-xl border border-zinc-700 bg-zinc-800/40 px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-[11px] text-zinc-500 mb-0.5">Emissions preview</p>
                          <p className="text-xl font-bold text-zinc-50">
                            {travelCo2e.toFixed(3)}&thinsp;<span className="text-sm font-normal text-zinc-400">kg CO₂e</span>
                          </p>
                        </div>
                        <div className="text-right text-[10px] text-zinc-600 space-y-0.5">
                          <p>{activeFactor.value.toFixed(5)} kg CO₂e/km</p>
                          <p>{activeFactor.year} · {activeFactor.source}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-600 text-center py-1 select-none">Enter an amount to preview</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSaving || !distanceKm || Number(distanceKm) <= 0}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 py-3 text-sm font-bold transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    {isSaving
                      ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-950 border-t-transparent" />
                      : <><Plus className="h-4 w-4" aria-hidden="true" /> Add to log</>}
                  </button>
                </form>
                </div>
              )}

              {/* ── Food panel ────────────────────────────────────────────── */}
              {activeTab === "food" && (
                <div id="panel-food" role="tabpanel" aria-labelledby="tab-food">
                <form onSubmit={handleSaveFood} className="space-y-5">

                  <div className="space-y-1.5">
                    <label htmlFor="food-item" className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      Activity
                    </label>
                    <div className="relative">
                      <select
                        id="food-item"
                        value={foodItem}
                        onChange={(e) => setFoodItem(e.target.value)}
                        className="w-full appearance-none rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-3 pr-10 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        {Object.entries(FOOD_FACTORS).map(([k, f]) => (
                          <option key={k} value={k}>{f.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-snug">{activeFoodF.description}</p>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="food-weight" className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      Amount (kg)
                    </label>
                    <input
                      id="food-weight"
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="1000"
                      placeholder="e.g. 0.25"
                      value={foodWeight}
                      onChange={(e) => setFoodWeight(e.target.value === "" ? "" : Number(e.target.value))}
                      required
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div aria-live="polite" aria-atomic="true">
                    {foodCo2e !== null && foodCo2e > 0 ? (
                      <div className="rounded-xl border border-zinc-700 bg-zinc-800/40 px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-[11px] text-zinc-500 mb-0.5">Emissions preview</p>
                          <p className="text-xl font-bold text-zinc-50">
                            {foodCo2e.toFixed(3)}&thinsp;<span className="text-sm font-normal text-zinc-400">kg CO₂e</span>
                          </p>
                        </div>
                        <div className="text-right text-[10px] text-zinc-600 space-y-0.5">
                          <p>{activeFoodF.value.toFixed(2)} kg CO₂e/kg</p>
                          <p>{activeFoodF.year} · {activeFoodF.source}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-600 text-center py-1 select-none">Enter an amount to preview</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSaving || !foodWeight || Number(foodWeight) <= 0}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 py-3 text-sm font-bold transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    {isSaving
                      ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-950 border-t-transparent" />
                      : <><Plus className="h-4 w-4" aria-hidden="true" /> Add to log</>}
                  </button>
                </form>
                </div>
              )}

              {/* ── Energy panel ──────────────────────────────────────────── */}
              {activeTab === "energy" && (
                <div id="panel-energy" role="tabpanel" aria-labelledby="tab-energy">
                <form onSubmit={handleSaveEnergy} className="space-y-5">

                  <div className="space-y-1.5">
                    <label htmlFor="energy-source" className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      Activity
                    </label>
                    <div className="relative">
                      <select
                        id="energy-source"
                        value={energySrc}
                        onChange={(e) => setEnergySrc(e.target.value)}
                        className="w-full appearance-none rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-3 pr-10 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        {Object.entries(ENERGY_FACTORS).map(([k, f]) => (
                          <option key={k} value={k}>{f.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-snug">{activeEnergyF.description}</p>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="energy-qty" className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      Amount ({activeEnergyF.unit})
                    </label>
                    <input
                      id="energy-qty"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="e.g. 5"
                      value={energyQty}
                      onChange={(e) => setEnergyQty(e.target.value === "" ? "" : Number(e.target.value))}
                      required
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div aria-live="polite" aria-atomic="true">
                    {energyCo2e !== null && energyCo2e > 0 ? (
                      <div className="rounded-xl border border-zinc-700 bg-zinc-800/40 px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-[11px] text-zinc-500 mb-0.5">Emissions preview</p>
                          <p className="text-xl font-bold text-zinc-50">
                            {energyCo2e.toFixed(3)}&thinsp;<span className="text-sm font-normal text-zinc-400">kg CO₂e</span>
                          </p>
                        </div>
                        <div className="text-right text-[10px] text-zinc-600 space-y-0.5">
                          <p>{activeEnergyF.value.toFixed(4)} kg CO₂e/{activeEnergyF.unit}</p>
                          <p>{activeEnergyF.year} · {activeEnergyF.source}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-600 text-center py-1 select-none">Enter an amount to preview</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSaving || !energyQty || Number(energyQty) <= 0}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 py-3 text-sm font-bold transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    {isSaving
                      ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-950 border-t-transparent" />
                      : <><Plus className="h-4 w-4" aria-hidden="true" /> Add to log</>}
                  </button>
                </form>
                </div>
              )}
            </section>

            {/* ── Daily target widget ───────────────────────────────────────── */}
            <aside
              aria-labelledby="target-heading"
              className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-4 self-start"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
                  <Target className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                </div>
                <h2 id="target-heading" className="text-sm font-bold text-zinc-50">Daily target</h2>
              </div>

              <p className="text-xs text-zinc-500 leading-snug">
                Science-based sustainable daily budget for a 1.5 °C-aligned lifestyle.
              </p>

              <div className="rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-3 text-center">
                <p
                  className="text-3xl font-bold text-emerald-400"
                  aria-label="5.75 kg CO2e per day"
                >
                  5.75
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">kg CO₂e / day</p>
              </div>

              <dl className="rounded-lg bg-zinc-800/40 px-3 py-2.5 space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Global average</dt>
                  <dd className="text-zinc-400 font-medium">~10.96 kg/day</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">1.5 °C target</dt>
                  <dd className="text-emerald-400 font-medium">≤ 5.75 kg/day</dd>
                </div>
              </dl>

              <p className="text-[10px] text-zinc-600 leading-snug">
                Source: IPCC AR6 (2023) · World Bank 2021 world average
              </p>
            </aside>
          </div>

          {/* ── History ──────────────────────────────────────────────────────── */}
          <section aria-labelledby="history-heading" className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex items-center gap-2.5 mb-5">
              <Clock className="h-4 w-4 text-zinc-500 shrink-0" aria-hidden="true" />
              <h2 id="history-heading" className="text-sm font-bold text-zinc-50">History</h2>
              <span className="ml-auto text-xs text-zinc-600">
                {history.length} logged {history.length === 1 ? "activity" : "activities"}
              </span>
            </div>

            {history.length === 0 ? (
              <p className="text-sm text-zinc-600 text-center py-6">No activities logged yet.</p>
            ) : (
              <ul className="space-y-2" aria-label="Recent activity history">
                {history.slice(0, 20).map((entry) => (
                  <li
                    key={`${entry.type}-${entry.id}`}
                    className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-800/30 px-4 py-3"
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        entry.type === "travel" ? "bg-blue-500/10 text-blue-400"
                        : entry.type === "food" ? "bg-amber-500/10 text-amber-400"
                        : "bg-violet-500/10 text-violet-400"
                      }`}
                      aria-hidden="true"
                    >
                      {entry.type === "travel" ? <Car className="h-3.5 w-3.5" />
                        : entry.type === "food" ? <Apple className="h-3.5 w-3.5" />
                        : <Zap className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-200 truncate">{entry.label}</p>
                      <p className="text-xs text-zinc-500">{entry.amount}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-zinc-200">
                        {entry.co2e_kg.toFixed(2)}&thinsp;<span className="text-xs font-normal text-zinc-500">kg</span>
                      </p>
                      <p className="text-[10px] text-zinc-600">
                        {new Date(entry.timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
