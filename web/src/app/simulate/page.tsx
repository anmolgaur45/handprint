"use client";

import React, { useState } from "react";
import {
  Bike,
  Bus,
  Car,
  CheckCircle,
  Footprints,
  Fuel,
  Info,
  Leaf,
  Sparkles,
  Train,
  Trees,
  TrendingUp,
} from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { AppSidebar } from "@/components/app-sidebar";

interface SimulationResponse {
  scenario: string;
  base_annual_co2e_kg: number;
  projected_annual_co2e_kg: number;
  annual_savings_co2e_kg: number;
  percentage_reduction: number;
}

export default function SimulatePage() {
  const { user, loading, apiFetch } = useAuth();

  const [scenario, setScenario] = useState<"ev_swap" | "mode_shift" | "reduce_trips">("ev_swap");
  const [targetMode, setTargetMode] = useState<string>("bus");
  const [percentage, setPercentage] = useState<number>(50);

  const [isSimulating, setIsSimulating] = useState(false);
  const [results, setResults] = useState<SimulationResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const [isCommitted, setIsCommitted] = useState(false);
  const [isCommitSaving, setIsCommitSaving] = useState(false);

  const handleScenarioKeyDown = (
    e: React.KeyboardEvent,
    sc: "ev_swap" | "mode_shift" | "reduce_trips"
  ) => {
    const scKeys: ("ev_swap" | "mode_shift" | "reduce_trips")[] = [
      "ev_swap",
      "mode_shift",
      "reduce_trips",
    ];
    const index = scKeys.indexOf(sc);
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      const next = scKeys[(index + 1) % scKeys.length];
      setScenario(next);
      setTimeout(() => document.getElementById(`sc-radio-${next}`)?.focus(), 0);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = scKeys[(index - 1 + scKeys.length) % scKeys.length];
      setScenario(prev);
      setTimeout(() => document.getElementById(`sc-radio-${prev}`)?.focus(), 0);
    }
  };

  const handleTargetModeKeyDown = (e: React.KeyboardEvent, index: number) => {
    const modes = ["bus", "metro", "train", "bicycle", "walking"];
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      const next = modes[(index + 1) % modes.length];
      setTargetMode(next);
      setTimeout(() => document.getElementById(`target-mode-radio-${next}`)?.focus(), 0);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = modes[(index - 1 + modes.length) % modes.length];
      setTargetMode(prev);
      setTimeout(() => document.getElementById(`target-mode-radio-${prev}`)?.focus(), 0);
    }
  };

  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsSimulating(true);
    setIsCommitted(false);
    try {
      const payload = {
        scenario,
        target_mode: scenario === "mode_shift" ? targetMode : null,
        percentage: scenario === "ev_swap" ? 1.0 : percentage / 100.0,
      };
      const res = await apiFetch<SimulationResponse>("/trips/simulate", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setResults(res);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to calculate simulation savings. Please try again.";
      setErrorMsg(msg);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleCommitAction = async () => {
    if (!results) return;
    setIsCommitSaving(true);
    setErrorMsg("");
    try {
      let title = "";
      if (results.scenario === "ev_swap") {
        title = "Swap combustion car travel for Electric Vehicle";
      } else if (results.scenario === "mode_shift") {
        title = `Shift ${percentage}% of private trips to ${targetMode}`;
      } else {
        title = `Reduce total travel by ${percentage}%`;
      }
      await apiFetch("/committed_actions", {
        method: "POST",
        body: JSON.stringify({
          action_key: `${results.scenario}_${Date.now()}`,
          title,
          category: "transport",
          projected_savings_kg: results.annual_savings_co2e_kg,
        }),
      });
      setIsCommitted(true);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to commit reduction action. Please try again.";
      setErrorMsg(msg);
    } finally {
      setIsCommitSaving(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  const annualSavings = results?.annual_savings_co2e_kg ?? 0;
  const treesEquiv = annualSavings / 22.0;
  const petrolEquiv = annualSavings / 2.3;

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-50 font-sans">
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 focus:outline-none"
        >
          {/* Page heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Reduction Lab</h1>
            <p className="text-xs text-zinc-400 mt-1">
              Simulate low-carbon swaps and commit to action
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left: Configure */}
            <section className="lg:col-span-5 space-y-6">
              <div className="rounded-2xl border border-zinc-900 bg-zinc-900/20 p-6 shadow-xl relative overflow-hidden">
                <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                  Configure Scenario
                </h2>
                <p className="text-xs text-zinc-500 mb-6">Select a carbon reduction strategy to model</p>

                {errorMsg && (
                  <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-400">
                    {errorMsg}
                  </div>
                )}

                <form onSubmit={handleRunSimulation} className="space-y-6">
                  <div role="radiogroup" aria-label="Reduction Strategy Selection" className="space-y-3">
                    <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Reduction Strategy</span>

                    <button
                      id="sc-radio-ev_swap"
                      type="button"
                      role="radio"
                      aria-checked={scenario === "ev_swap"}
                      tabIndex={scenario === "ev_swap" ? 0 : -1}
                      onKeyDown={(e) => handleScenarioKeyDown(e, "ev_swap")}
                      onClick={() => setScenario("ev_swap")}
                      className={`w-full flex items-start gap-4 rounded-xl border p-4 text-left transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${scenario === "ev_swap" ? "border-emerald-500 bg-emerald-500/10" : "border-zinc-900 bg-zinc-950/40 hover:border-zinc-800 hover:bg-zinc-900/20"}`}
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${scenario === "ev_swap" ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" : "bg-zinc-900 border-zinc-800 text-zinc-400"}`}>
                        <Car className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className={`text-sm font-bold ${scenario === "ev_swap" ? "text-emerald-300" : "text-zinc-200"}`}>EV Swap (full fleet)</h3>
                        <p className="text-xs text-zinc-400 leading-normal mt-0.5">Model emissions if all petrol/diesel/hybrid driving switched to battery EVs.</p>
                      </div>
                    </button>

                    <button
                      id="sc-radio-mode_shift"
                      type="button"
                      role="radio"
                      aria-checked={scenario === "mode_shift"}
                      tabIndex={scenario === "mode_shift" ? 0 : -1}
                      onKeyDown={(e) => handleScenarioKeyDown(e, "mode_shift")}
                      onClick={() => setScenario("mode_shift")}
                      className={`w-full flex items-start gap-4 rounded-xl border p-4 text-left transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${scenario === "mode_shift" ? "border-emerald-500 bg-emerald-500/10" : "border-zinc-900 bg-zinc-950/40 hover:border-zinc-800 hover:bg-zinc-900/20"}`}
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${scenario === "mode_shift" ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" : "bg-zinc-900 border-zinc-800 text-zinc-400"}`}>
                        <Bus className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className={`text-sm font-bold ${scenario === "mode_shift" ? "text-emerald-300" : "text-zinc-200"}`}>Transit Mode Shift</h3>
                        <p className="text-xs text-zinc-400 leading-normal mt-0.5">Shift a percentage of private motorized travel to public transit or active travel.</p>
                      </div>
                    </button>

                    <button
                      id="sc-radio-reduce_trips"
                      type="button"
                      role="radio"
                      aria-checked={scenario === "reduce_trips"}
                      tabIndex={scenario === "reduce_trips" ? 0 : -1}
                      onKeyDown={(e) => handleScenarioKeyDown(e, "reduce_trips")}
                      onClick={() => setScenario("reduce_trips")}
                      className={`w-full flex items-start gap-4 rounded-xl border p-4 text-left transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${scenario === "reduce_trips" ? "border-emerald-500 bg-emerald-500/10" : "border-zinc-900 bg-zinc-950/40 hover:border-zinc-800 hover:bg-zinc-900/20"}`}
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${scenario === "reduce_trips" ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" : "bg-zinc-900 border-zinc-800 text-zinc-400"}`}>
                        <Footprints className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className={`text-sm font-bold ${scenario === "reduce_trips" ? "text-emerald-300" : "text-zinc-200"}`}>Reduce Travel</h3>
                        <p className="text-xs text-zinc-400 leading-normal mt-0.5">Eliminate a percentage of all travel journeys (e.g. telecommuting).</p>
                      </div>
                    </button>
                  </div>

                  {scenario === "mode_shift" && (
                    <div className="space-y-3 animate-scaleUp">
                      <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Target Mode</span>
                      <div role="radiogroup" aria-label="Alternate Transit Mode Selection" className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {[
                          { key: "bus",     label: "Bus",     icon: Bus },
                          { key: "metro",   label: "Metro",   icon: Train },
                          { key: "train",   label: "Train",   icon: Train },
                          { key: "bicycle", label: "Bicycle", icon: Bike },
                          { key: "walking", label: "Walking", icon: Footprints },
                        ].map((opt, idx) => {
                          const Icon = opt.icon;
                          const active = targetMode === opt.key;
                          return (
                            <button
                              key={opt.key}
                              id={`target-mode-radio-${opt.key}`}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              tabIndex={active ? 0 : -1}
                              onKeyDown={(e) => handleTargetModeKeyDown(e, idx)}
                              onClick={() => setTargetMode(opt.key)}
                              className={`flex flex-col items-center justify-center rounded-xl border p-3.5 text-xs font-semibold gap-2 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${active ? "border-emerald-500 bg-emerald-500/5 text-emerald-300" : "border-zinc-900 bg-zinc-950/40 text-zinc-400 hover:border-zinc-800 hover:text-zinc-200"}`}
                            >
                              <Icon className={`h-5 w-5 ${active ? "text-emerald-400" : "text-zinc-500"}`} />
                              <span>{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {scenario !== "ev_swap" && (
                    <div className="space-y-4 animate-scaleUp">
                      <div className="flex items-center justify-between">
                        <label
                          id="percentage-slider-label"
                          htmlFor="percentage-slider"
                          className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider cursor-pointer"
                        >
                          Target shift percentage
                        </label>
                        <span className="text-xs font-extrabold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                          {percentage}%
                        </span>
                      </div>
                      <input
                        id="percentage-slider"
                        type="range"
                        min="1"
                        max="100"
                        value={percentage}
                        aria-labelledby="percentage-slider-label"
                        aria-valuemin={1}
                        aria-valuemax={100}
                        aria-valuenow={percentage}
                        onChange={(e) => setPercentage(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-zinc-950 rounded-lg appearance-none cursor-pointer accent-emerald-500 border border-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                      />
                      <div className="flex justify-between text-[9px] text-zinc-600 font-bold uppercase tracking-wider">
                        <span>Conservative (1%)</span>
                        <span>Aggressive (100%)</span>
                      </div>
                    </div>
                  )}

                  {scenario === "ev_swap" && (
                    <div className="rounded-xl border border-emerald-950/20 bg-emerald-950/5 p-4 text-xs text-zinc-400 leading-relaxed animate-scaleUp">
                      <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-1">
                        <Info className="h-4 w-4" />
                        EV calculation
                      </div>
                      Matches all petrol, diesel, and hybrid trips and recalculates emissions using
                      the UK DESNZ/DEFRA 2024 lifecycle factor for battery EVs (0.04690 kg CO2e/km).
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSimulating}
                    className="w-full flex items-center justify-center rounded-xl bg-emerald-500 py-3.5 text-sm font-bold text-zinc-950 hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-lg shadow-emerald-500/15"
                  >
                    {isSimulating ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-50 border-t-transparent" />
                    ) : (
                      "Calculate projected savings"
                    )}
                  </button>
                </form>
              </div>
            </section>

            {/* Right: Results */}
            <section className="lg:col-span-7 flex flex-col">
              {!results ? (
                <div className="flex-1 rounded-2xl border border-zinc-900 bg-zinc-900/10 p-8 flex flex-col items-center justify-center text-center max-w-lg mx-auto w-full my-auto space-y-6">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500">
                    <TrendingUp className="h-8 w-8" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-lg font-bold">Configure a scenario</h2>
                    <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
                      Select a reduction strategy on the left and click calculate to see the CO2e
                      savings potential based on your logged travel history.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 rounded-2xl border border-zinc-900 bg-zinc-900/10 p-6 shadow-xl flex flex-col space-y-8 animate-scaleUp">
                  <div>
                    <h2 className="text-lg font-bold">Simulation Results</h2>
                    <p className="text-xs text-zinc-500">Projected annual reduction</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-zinc-950/40 border border-zinc-900 rounded-xl p-4 text-center">
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Base Annual</p>
                      <p className="mt-1 text-xl sm:text-2xl font-bold text-zinc-300">
                        {results.base_annual_co2e_kg.toFixed(1)} kg CO2e
                      </p>
                    </div>
                    <div className="bg-zinc-950/40 border border-zinc-900 rounded-xl p-4 text-center">
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Projected Annual</p>
                      <p className="mt-1 text-xl sm:text-2xl font-bold text-emerald-400">
                        {results.projected_annual_co2e_kg.toFixed(1)} kg CO2e
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center py-4 relative">
                    <div
                      role="progressbar"
                      aria-valuenow={results.percentage_reduction}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Annual carbon reduction percentage"
                      className="w-48 h-48 relative flex items-center justify-center"
                    >
                      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90" aria-hidden="true">
                        <circle cx="50" cy="50" r="45" fill="transparent" stroke="#18181b" strokeWidth="6.5" />
                        <circle
                          cx="50" cy="50" r="45"
                          fill="transparent" stroke="#10b981" strokeWidth="7"
                          strokeDasharray="282.7"
                          strokeDashoffset={282.7 - (282.7 * results.percentage_reduction) / 100}
                          strokeLinecap="round"
                          className="transition-all duration-1000 ease-out"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Reduces by</span>
                        <span className="text-2xl font-black text-emerald-400 tracking-tight">{results.percentage_reduction.toFixed(1)}%</span>
                      </div>
                    </div>

                    <div className="sr-only">
                      <table>
                        <caption>Simulation results</caption>
                        <thead><tr><th scope="col">Metric</th><th scope="col">Value</th></tr></thead>
                        <tbody>
                          <tr><th scope="row">Base Annual</th><td>{results.base_annual_co2e_kg.toFixed(1)} kg CO2e</td></tr>
                          <tr><th scope="row">Projected Annual</th><td>{results.projected_annual_co2e_kg.toFixed(1)} kg CO2e</td></tr>
                          <tr><th scope="row">Annual Savings</th><td>{results.annual_savings_co2e_kg.toFixed(1)} kg CO2e</td></tr>
                          <tr><th scope="row">Percentage Reduction</th><td>{results.percentage_reduction.toFixed(1)}%</td></tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="text-center mt-6 space-y-1">
                      <h3 className="text-2xl font-black text-emerald-400">
                        -{results.annual_savings_co2e_kg.toFixed(1)} kg CO2e
                      </h3>
                      <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wide">
                        Avoided annually
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3.5">
                    <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                      Equivalents
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex items-center gap-4 rounded-xl border border-zinc-900 bg-zinc-950/40 p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <Trees className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Trees grown</h4>
                          <p className="text-base font-extrabold text-zinc-100 mt-0.5">{treesEquiv.toFixed(1)} trees/yr</p>
                          <p className="text-[10px] text-zinc-500 mt-0.5">At 22 kg CO2 absorbed per mature tree per year.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 rounded-xl border border-zinc-900 bg-zinc-950/40 p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
                          <Fuel className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Petrol saved</h4>
                          <p className="text-base font-extrabold text-zinc-100 mt-0.5">{petrolEquiv.toFixed(1)} L</p>
                          <p className="text-[10px] text-zinc-500 mt-0.5">At 2.3 kg CO2 released per litre of petrol burned.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-zinc-900">
                    {isCommitted ? (
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 flex items-center gap-3.5 text-sm text-emerald-300 animate-scaleUp">
                        <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
                        <div>
                          <p className="font-bold">Commitment saved.</p>
                          <p className="text-xs text-emerald-400/80 mt-0.5">
                            This reduction pledge is now on your dashboard.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={handleCommitAction}
                        disabled={isCommitSaving}
                        className="w-full flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 text-sm font-bold text-zinc-950 hover:from-emerald-400 hover:to-teal-400 active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-lg shadow-emerald-500/15"
                      >
                        {isCommitSaving ? (
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-50 border-t-transparent" />
                        ) : (
                          <span className="flex items-center gap-2">
                            <Leaf className="h-4 w-4" />
                            Pledge this reduction
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
