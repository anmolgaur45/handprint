"use client";

import React, { useState } from "react";


import Link from "next/link";
import {
  ArrowLeft,
  Bike,
  Bus,
  Car,
  CheckCircle,
  Footprints,
  Fuel,
  Info,
  Leaf,
  LogOut,
  Sparkles,
  Train,
  Trees,
  TrendingUp,
} from "lucide-react";

import { useAuth } from "@/lib/auth-context";

interface SimulationResponse {
  scenario: string;
  base_annual_co2e_kg: number;
  projected_annual_co2e_kg: number;
  annual_savings_co2e_kg: number;
  percentage_reduction: number;
}

export default function SimulatePage() {
  const { user, loading, logout, apiFetch, isAnonymous } = useAuth();

  const [scenario, setScenario] = useState<"ev_swap" | "mode_shift" | "reduce_trips">("ev_swap");
  const [targetMode, setTargetMode] = useState<string>("bus");
  const [percentage, setPercentage] = useState<number>(50);

  const [isSimulating, setIsSimulating] = useState(false);
  const [results, setResults] = useState<SimulationResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const [isCommitted, setIsCommitted] = useState(false);
  const [isCommitSaving, setIsCommitSaving] = useState(false);




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
      console.error(err);
      const msg = err instanceof Error ? err.message : "Failed to calculate simulation savings. Please try again.";
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
      console.error(err);
      const msg = err instanceof Error ? err.message : "Failed to commit reduction action. Please try again.";
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

  // Equivalents calculations
  const annualSavings = results?.annual_savings_co2e_kg ?? 0;
  // An average mature tree absorbs ~22 kg CO2 per year
  const treesEquiv = annualSavings / 22.0;
  // 1 Liter of petrol releases ~2.3 kg CO2 when burned
  const petrolEquiv = annualSavings / 2.3;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col font-sans">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Reduction Lab</h1>
            <p className="text-xs text-zinc-400">Simulate low-carbon swaps and commit to action</p>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-1.5 border border-zinc-900 bg-zinc-950/50 p-1.5 rounded-xl">
          <Link href="/" className="px-4 py-1.5 text-xs font-medium rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40 transition">
            Dashboard
          </Link>
          <Link href="/trips/new" className="px-4 py-1.5 text-xs font-medium rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40 transition">
            Log Travel
          </Link>
          <Link href="/simulate" className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-zinc-900 text-zinc-200 border border-zinc-800">
            Reduction Lab
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            {isAnonymous ? (
              <>
                <p className="text-xs text-zinc-500">Guest session</p>
                <Link href="/login" className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition">
                  Create account
                </Link>
              </>
            ) : (
              <>
                <p className="text-xs text-zinc-400">Signed in</p>
                <p className="text-xs font-semibold text-zinc-200">{user.email}</p>
              </>
            )}
          </div>
          <button
            onClick={() => logout()}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:text-red-400 hover:bg-red-500/5 hover:border-red-500/20 transition cursor-pointer"
            title={isAnonymous ? "Reset session" : "Log Out"}
          >
            <LogOut className="h-4.5 w-4.5" />
          </button>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Configure Simulation */}
        <section className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl border border-zinc-900 bg-zinc-900/20 p-6 shadow-xl relative overflow-hidden">
            <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
              <Sparkles className="h-4.5 w-4.5 text-emerald-400" />
              <span>Configure Scenario</span>
            </h3>
            <p className="text-xs text-zinc-500 mb-6">Select a carbon reduction swap strategy to model</p>

            {errorMsg && (
              <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-400">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleRunSimulation} className="space-y-6">
              {/* Scenario Cards */}
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  Reduction Strategy
                </label>
                
                {/* EV Swap Card */}
                <button
                  type="button"
                  onClick={() => setScenario("ev_swap")}
                  className={`w-full flex items-start gap-4 rounded-xl border p-4 text-left transition cursor-pointer ${
                    scenario === "ev_swap"
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-zinc-900 bg-zinc-950/40 hover:border-zinc-800 hover:bg-zinc-900/20"
                  }`}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                    scenario === "ev_swap" ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" : "bg-zinc-900 border-zinc-800 text-zinc-400"
                  }`}>
                    <Car className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className={`text-sm font-bold ${scenario === "ev_swap" ? "text-emerald-300" : "text-zinc-200"}`}>
                      EV Swap (Full fleet transition)
                    </h4>
                    <p className="text-xs text-zinc-400 leading-normal mt-0.5">
                      Model emissions if all petrol/diesel/hybrid driving switched to battery EVs.
                    </p>
                  </div>
                </button>

                {/* Mode Shift Card */}
                <button
                  type="button"
                  onClick={() => setScenario("mode_shift")}
                  className={`w-full flex items-start gap-4 rounded-xl border p-4 text-left transition cursor-pointer ${
                    scenario === "mode_shift"
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-zinc-900 bg-zinc-950/40 hover:border-zinc-800 hover:bg-zinc-900/20"
                  }`}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                    scenario === "mode_shift" ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" : "bg-zinc-900 border-zinc-800 text-zinc-400"
                  }`}>
                    <Bus className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className={`text-sm font-bold ${scenario === "mode_shift" ? "text-emerald-300" : "text-zinc-200"}`}>
                      Transit Mode Shift
                    </h4>
                    <p className="text-xs text-zinc-400 leading-normal mt-0.5">
                      Shift a percentage of private motorized travel to public transit or cycling/walking.
                    </p>
                  </div>
                </button>

                {/* Trip Reduction Card */}
                <button
                  type="button"
                  onClick={() => setScenario("reduce_trips")}
                  className={`w-full flex items-start gap-4 rounded-xl border p-4 text-left transition cursor-pointer ${
                    scenario === "reduce_trips"
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-zinc-900 bg-zinc-950/40 hover:border-zinc-800 hover:bg-zinc-900/20"
                  }`}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                    scenario === "reduce_trips" ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" : "bg-zinc-900 border-zinc-800 text-zinc-400"
                  }`}>
                    <Footprints className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className={`text-sm font-bold ${scenario === "reduce_trips" ? "text-emerald-300" : "text-zinc-200"}`}>
                      Reduce Travel Trips
                    </h4>
                    <p className="text-xs text-zinc-400 leading-normal mt-0.5">
                      Eliminate a percentage of all travel journeys entirely (e.g. telecommuting/WFH).
                    </p>
                  </div>
                </button>
              </div>

              {/* Mode Shift target mode selector */}
              {scenario === "mode_shift" && (
                <div className="space-y-3 animate-scaleUp">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    Target Alternate Mode
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {[
                      { key: "bus", label: "Bus", icon: Bus },
                      { key: "metro", label: "Metro", icon: Train },
                      { key: "train", label: "Train", icon: Train },
                      { key: "bicycle", label: "Bicycle", icon: Bike },
                      { key: "walking", label: "Walking", icon: Footprints },
                    ].map((opt) => {
                      const Icon = opt.icon;
                      const active = targetMode === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setTargetMode(opt.key)}
                          className={`flex flex-col items-center justify-center rounded-xl border p-3.5 text-xs font-semibold gap-2 transition cursor-pointer ${
                            active
                              ? "border-emerald-500 bg-emerald-500/5 text-emerald-300"
                              : "border-zinc-900 bg-zinc-950/40 text-zinc-400 hover:border-zinc-800 hover:bg-zinc-900/10 hover:text-zinc-200"
                          }`}
                        >
                          <Icon className={`h-5 w-5 ${active ? "text-emerald-400" : "text-zinc-500"}`} />
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Percentage Sliders */}
              {scenario !== "ev_swap" && (
                <div className="space-y-4 animate-scaleUp">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                      Target Shift Percentage
                    </label>
                    <span className="text-xs font-extrabold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                      {percentage}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={percentage}
                    onChange={(e) => setPercentage(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-zinc-950 rounded-lg appearance-none cursor-pointer accent-emerald-500 border border-zinc-900"
                  />
                  <div className="flex justify-between text-[9px] text-zinc-600 font-bold uppercase tracking-wider">
                    <span>Conservative (1%)</span>
                    <span>Aggressive (100%)</span>
                  </div>
                </div>
              )}

              {/* EV Swap Description Callout */}
              {scenario === "ev_swap" && (
                <div className="rounded-xl border border-emerald-950/20 bg-emerald-950/5 p-4 text-xs text-zinc-400 leading-relaxed animate-scaleUp">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-1">
                    <Info className="h-4.5 w-4.5" />
                    <span>EV Shift Calculations</span>
                  </div>
                  Matches all logged trips with vehicle modes (`petrol_car`, `diesel_car`, `hybrid_car`) and recalculates emissions using the UK DESNZ/DEFRA lifecycle factor for battery electric vehicles.
                </div>
              )}

              {/* Run button */}
              <button
                type="submit"
                disabled={isSimulating}
                className="w-full flex items-center justify-center rounded-xl bg-emerald-600 py-3.5 text-sm font-semibold text-zinc-50 hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-lg shadow-emerald-700/15"
              >
                {isSimulating ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-50 border-t-transparent" />
                ) : (
                  "Calculate Projected Savings"
                )}
              </button>
            </form>
          </div>
        </section>

        {/* Right Column: Results Visualization */}
        <section className="lg:col-span-7 flex flex-col">
          {!results ? (
            /* Idle Placeholder State */
            <div className="flex-1 rounded-2xl border border-zinc-900 bg-zinc-900/10 p-8 flex flex-col items-center justify-center text-center max-w-lg mx-auto w-full my-auto space-y-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500">
                <TrendingUp className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold">Awaiting Simulation Configuration</h3>
                <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
                  Adjust parameters on the left panel and click calculate to view the carbon savings potential of your travel choices.
                </p>
              </div>
            </div>
          ) : (
            /* Live Simulation Results */
            <div className="flex-1 rounded-2xl border border-zinc-900 bg-zinc-900/10 p-6 shadow-xl flex flex-col space-y-8 animate-scaleUp">
              <div>
                <h3 className="text-lg font-bold">Simulation Forecast Analysis</h3>
                <p className="text-xs text-zinc-500">Projected annual reduction metrics</p>
              </div>

              {/* Top Numbers Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-950/40 border border-zinc-900 rounded-xl p-4 text-center">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Base Annual Footprint</p>
                  <p className="mt-1 text-xl sm:text-2xl font-bold text-zinc-300">
                    {results.base_annual_co2e_kg.toFixed(1)} kg CO2e
                  </p>
                </div>
                <div className="bg-zinc-950/40 border border-zinc-900 rounded-xl p-4 text-center">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Projected Annual Footprint</p>
                  <p className="mt-1 text-xl sm:text-2xl font-bold text-emerald-400">
                    {results.projected_annual_co2e_kg.toFixed(1)} kg CO2e
                  </p>
                </div>
              </div>

              {/* SVG radial Progress Gauge */}
              <div className="flex flex-col items-center justify-center py-4 relative">
                <div className="w-48 h-48 relative flex items-center justify-center">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="45" fill="transparent" stroke="#18181b" strokeWidth="6.5" />
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      fill="transparent"
                      stroke="#10b981"
                      strokeWidth="7"
                      strokeDasharray="282.7"
                      strokeDashoffset={282.7 - (282.7 * results.percentage_reduction) / 100}
                      strokeLinecap="round"
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Reduces By</span>
                    <span className="text-2xl font-black text-emerald-400 tracking-tight">
                      {results.percentage_reduction.toFixed(1)}%
                    </span>
                    <span className="text-[9px] font-bold text-zinc-400 mt-0.5">Annual Saved</span>
                  </div>
                </div>

                <div className="text-center mt-6 space-y-1">
                  <h4 className="text-2xl font-black text-emerald-400">
                    -{results.annual_savings_co2e_kg.toFixed(1)} kg CO2e
                  </h4>
                  <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wide">
                    Carbon emissions avoided annually
                  </p>
                </div>
              </div>

              {/* Environmental Equivalents Cards */}
              <div className="space-y-3.5">
                <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  Environmental Equivalent Impact
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Trees equivalence */}
                  <div className="flex items-center gap-4 rounded-xl border border-zinc-900 bg-zinc-950/40 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <Trees className="h-5 w-5" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Trees Grown</h5>
                      <p className="text-base font-extrabold text-zinc-100 mt-0.5">
                        {treesEquiv.toFixed(1)} trees / year
                      </p>
                      <p className="text-[10px] text-zinc-500 leading-normal mt-0.5">
                        Carbon absorbed by mature trees.
                      </p>
                    </div>
                  </div>

                  {/* Petrol Equivalence */}
                  <div className="flex items-center gap-4 rounded-xl border border-zinc-900 bg-zinc-950/40 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
                      <Fuel className="h-5 w-5" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Petrol Saved</h5>
                      <p className="text-base font-extrabold text-zinc-100 mt-0.5">
                        {petrolEquiv.toFixed(1)} Liters
                      </p>
                      <p className="text-[10px] text-zinc-500 leading-normal mt-0.5">
                        Fossil fuel usage avoided.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Commit Action Section */}
              <div className="pt-6 border-t border-zinc-900">
                {isCommitted ? (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 flex items-center gap-3.5 text-sm text-emerald-300 animate-scaleUp">
                    <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
                    <div>
                      <p className="font-bold">Emissions Pledged Successfully!</p>
                      <p className="text-xs text-emerald-400/80 mt-0.5">
                        This commitment has been recorded. Complete tasks consecutively to keep your streak glowing!
                      </p>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleCommitAction}
                    disabled={isCommitSaving}
                    className="w-full flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3.5 text-sm font-semibold text-zinc-50 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-lg shadow-emerald-700/15"
                  >
                    {isCommitSaving ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-50 border-t-transparent" />
                    ) : (
                      <span className="flex items-center gap-2">
                        <Leaf className="h-4.5 w-4.5" />
                        Pledge and Commit to this Action
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Styled custom animations */}
      <style jsx global>{`
        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-scaleUp {
          animation: scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
