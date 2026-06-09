"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart2,
  Bike,
  Bus,
  Calendar,
  Car,
  Check,
  ChevronRight,
  Footprints,
  Globe,
  Info,
  Flame,
  LogOut,
  MapPin,
  Navigation,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
  Train,
  Trash2,
  X,
} from "lucide-react";

import { useAuth } from "@/lib/auth-context";

// Pinned factors from Phase 3 for the methodology transparency modal
const CITATION_DATA = [
  {
    mode: "Petrol Car",
    factor: "0.16489 kg CO2e/km",
    source: "UK DESNZ/DEFRA Greenhouse Gas Conversion Factors",
    year: 2024,
  },
  {
    mode: "Diesel Car",
    factor: "0.16398 kg CO2e/km",
    source: "UK DESNZ/DEFRA Greenhouse Gas Conversion Factors",
    year: 2024,
  },
  {
    mode: "Electric Vehicle (EV)",
    factor: "0.04690 kg CO2e/km",
    source: "UK DESNZ/DEFRA Greenhouse Gas Conversion Factors",
    year: 2024,
  },
  {
    mode: "Hybrid Car",
    factor: "0.11500 kg CO2e/km",
    source: "UK DESNZ/DEFRA Greenhouse Gas Conversion Factors",
    year: 2024,
  },
  {
    mode: "Motorbike / Two-wheeler",
    factor: "0.11327 kg CO2e/km",
    source: "UK DESNZ/DEFRA Greenhouse Gas Conversion Factors",
    year: 2024,
  },
  {
    mode: "Public Bus",
    factor: "0.09658 kg CO2e/km",
    source: "UK DESNZ/DEFRA Greenhouse Gas Conversion Factors",
    year: 2024,
  },
  {
    mode: "Passenger Train",
    factor: "0.03549 kg CO2e/km",
    source: "UK DESNZ/DEFRA Greenhouse Gas Conversion Factors",
    year: 2024,
  },
  {
    mode: "Metro / Light Rail",
    factor: "0.02781 kg CO2e/km",
    source: "UK DESNZ/DEFRA Greenhouse Gas Conversion Factors",
    year: 2024,
  },
  {
    mode: "Bicycle / Active Travel",
    factor: "0.00000 kg CO2e/km",
    source: "Self-evident direct human transport",
    year: 2026,
  },
];

interface TripLog {
  id: string | null;
  user_id: string;
  origin: string;
  destination: string;
  distance_km: number;
  mode: string;
  co2e_kg: number;
  timestamp: string;
  citation: string;
  effective_year: number;
}

interface CommittedAction {
  id: string | null;
  user_id: string;
  action_key: string;
  title: string;
  category: string;
  projected_savings_kg: number;
  committed_at: string;
  status: string;
}

interface UserStreak {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_active_at: string | null;
}

export default function Home() {
  const { user, loading, logout, apiFetch, isAnonymous } = useAuth();

  const [trips, setTrips] = useState<TripLog[]>([]);
  const [commitments, setCommitments] = useState<CommittedAction[]>([]);
  const [streakData, setStreakData] = useState<UserStreak | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [timeRange, setTimeRange] = useState<"7d" | "30d">("7d");
  const [errorMsg, setErrorMsg] = useState("");
  const [isMethodologyOpen, setIsMethodologyOpen] = useState(false);



  // Fetch trips, commitments and streak on mount or auth load
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return;
      setIsFetching(true);
      setErrorMsg("");
      try {
        const [tripsData, commitmentsData, streakDataVal] = await Promise.all([
          apiFetch<TripLog[]>("/trips"),
          apiFetch<CommittedAction[]>("/committed_actions"),
          apiFetch<UserStreak>("/streaks"),
        ]);
        // Sort chronologically ascending for charts, descending is done where needed for lists
        const sorted = [...tripsData].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        setTrips(sorted);
        setCommitments(commitmentsData);
        setStreakData(streakDataVal);
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
        setErrorMsg("Failed to retrieve dashboard history. Please check connection.");
      } finally {
        setIsFetching(false);
      }
    };

    if (user && !loading) {
      fetchDashboardData();
    }
  }, [user, loading, apiFetch]);

  const handleUpdateStatus = async (commitmentId: string, newStatus: "completed" | "abandoned") => {
    try {
      await apiFetch(`/committed_actions/${commitmentId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      setCommitments((prev) =>
        prev.map((c) => (c.id === commitmentId ? { ...c, status: newStatus } : c))
      );
    } catch (err) {
      console.error("Failed to update commitment status:", err);
      setErrorMsg("Failed to update pledge status. Please try again.");
    }
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="text-sm text-zinc-400">Loading Handprint...</p>
        </div>
      </div>
    );
  }

  // --- Calculations ---

  // 1. Core aggregates
  const totalDistance = trips.reduce((sum, t) => sum + t.distance_km, 0);
  const totalCo2e = trips.reduce((sum, t) => sum + t.co2e_kg, 0);
  const tripsCount = trips.length;

  // Daily Carbon Budget calculations
  const DAILY_BUDGET_KG = 5.75; // 2100 kg annual target / 365 days
  const todayStr = new Date().toLocaleDateString("en-CA");
  const todayEmissions = trips
    .filter((t) => {
      const tripDate = new Date(t.timestamp);
      return tripDate.toLocaleDateString("en-CA") === todayStr;
    })
    .reduce((sum, t) => sum + t.co2e_kg, 0);

  // Annual scaling & benchmark comparison calculations
  const calculateAnnualScalingFactor = (logs: TripLog[]): number => {
    if (logs.length === 0) return 0;
    const timestamps = logs.map(t => new Date(t.timestamp).getTime());
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);

    const minDate = new Date(minTime);
    minDate.setHours(0, 0, 0, 0);
    const maxDate = new Date(maxTime);
    maxDate.setHours(0, 0, 0, 0);

    const diffTime = Math.abs(maxDate.getTime() - minDate.getTime());
    const daysSpan = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const effectiveDays = Math.max(7.0, daysSpan);
    return 365.0 / effectiveDays;
  };

  const annualScale = calculateAnnualScalingFactor(trips);
  const userAnnualVal = (totalCo2e * annualScale) / 1000; // in tonnes

  // 3. Category breakdown math (extensible for food and energy in Phase 7)
  const categoryEmissions = {
    transport: totalCo2e,
    food: 0, // Phase 7
    energy: 0, // Phase 7
  };
  const totalCategories = categoryEmissions.transport + categoryEmissions.food + categoryEmissions.energy;

  const transportPct = totalCategories > 0 ? categoryEmissions.transport / totalCategories : 1;
  const foodPct = totalCategories > 0 ? categoryEmissions.food / totalCategories : 0;
  const energyPct = totalCategories > 0 ? categoryEmissions.energy / totalCategories : 0;

  // 4. Transport Mode breakdown math
  const modeBreakdownMap: Record<string, { distance: number; co2e: number; label: string; icon: React.ComponentType<{ className?: string }> }> = {};
  
  const getModeMeta = (m: string) => {
    switch (m) {
      case "bus":
        return { label: "Public Bus", icon: Bus };
      case "train":
        return { label: "Train", icon: Train };
      case "metro":
        return { label: "Metro", icon: Train };
      case "motorbike":
        return { label: "Motorbike", icon: Bike };
      case "bicycle":
        return { label: "Bicycle", icon: Bike };
      case "walking":
        return { label: "Walking", icon: Footprints };
      case "ev_car":
        return { label: "EV Car", icon: Car };
      case "hybrid_car":
        return { label: "Hybrid Car", icon: Car };
      case "diesel_car":
        return { label: "Diesel Car", icon: Car };
      default:
        return { label: "Petrol Car", icon: Car };
    }
  };

  trips.forEach((t) => {
    if (!modeBreakdownMap[t.mode]) {
      const meta = getModeMeta(t.mode);
      modeBreakdownMap[t.mode] = {
        distance: 0,
        co2e: 0,
        label: meta.label,
        icon: meta.icon,
      };
    }
    modeBreakdownMap[t.mode].distance += t.distance_km;
    modeBreakdownMap[t.mode].co2e += t.co2e_kg;
  });

  const modeBreakdownList = Object.entries(modeBreakdownMap)
    .map(([key, val]) => ({ key, ...val }))
    .sort((a, b) => b.co2e - a.co2e);

  // 5. SVG Area Trend Chart coordinates calculation
  const getTrendData = () => {
    const dataPoints: { label: string; value: number }[] = [];
    const now = new Date();

    if (timeRange === "7d") {
      // Create past 7 daily buckets
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const dayStr = d.toLocaleDateString("en-CA");
        
        const dayEmissions = trips
          .filter((t) => {
            const tripDate = new Date(t.timestamp);
            return tripDate.toLocaleDateString("en-CA") === dayStr;
          })
          .reduce((sum, t) => sum + t.co2e_kg, 0);

        dataPoints.push({
          label: d.toLocaleDateString("en-US", { weekday: "short" }),
          value: dayEmissions,
        });
      }
    } else {
      // Create past 30 days grouped in 5 weekly intervals
      for (let i = 4; i >= 0; i--) {
        const endDay = new Date();
        endDay.setDate(now.getDate() - i * 6);
        const startDay = new Date();
        startDay.setDate(now.getDate() - (i * 6 + 5));

        const startMs = new Date(startDay.getFullYear(), startDay.getMonth(), startDay.getDate()).getTime();
        const endMs = new Date(endDay.getFullYear(), endDay.getMonth(), endDay.getDate(), 23, 59, 59).getTime();

        const rangeEmissions = trips
          .filter((t) => {
            const tripMs = new Date(t.timestamp).getTime();
            return tripMs >= startMs && tripMs <= endMs;
          })
          .reduce((sum, t) => sum + t.co2e_kg, 0);

        dataPoints.push({
          label: `${startDay.getDate()}/${startDay.getMonth() + 1}`,
          value: rangeEmissions,
        });
      }
    }
    return dataPoints;
  };

  const trendData = getTrendData();
  const maxEmissionsVal = Math.max(...trendData.map((d) => d.value), 1.0);

  // SVG Chart Config
  const svgWidth = 600;
  const svgHeight = 220;
  const padLeft = 45;
  const padRight = 15;
  const padTop = 20;
  const padBottom = 30;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  const points = trendData.map((d, i) => {
    const x = padLeft + (i * plotWidth) / (trendData.length - 1);
    // Inverse y coordinate since SVG (0,0) is top-left
    const y = padTop + plotHeight - (d.value / maxEmissionsVal) * plotHeight;
    return { x, y };
  });

  const linePathD = points.length > 0
    ? points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(" ")
    : "";

  const areaPathD = points.length > 0
    ? `${linePathD} L ${points[points.length - 1].x} ${padTop + plotHeight} L ${points[0].x} ${padTop + plotHeight} Z`
    : "";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col font-sans">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-lg shadow-emerald-500/20">
            <Footprints className="h-5 w-5 text-zinc-950" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Handprint</h1>
            <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">Climate Counterpart</p>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-1.5 border border-zinc-900 bg-zinc-950/50 p-1.5 rounded-xl">
          <Link href="/" className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-zinc-900 text-zinc-200">
            Dashboard
          </Link>
          <Link href="/trips/new" className="px-4 py-1.5 text-xs font-medium rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40 transition">
            Log Travel
          </Link>
          <Link
            href="/simulate"
            className="px-4 py-1.5 text-xs font-medium rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40 transition"
          >
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

      {/* Main Grid Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-8">
        {errorMsg && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400 flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg("")} className="text-zinc-400 hover:text-zinc-200">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Aggregated Stats Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Carbon Card */}
          <div className="group rounded-2xl border border-zinc-900 bg-zinc-900/20 p-6 shadow-xl relative overflow-hidden transition-all duration-300 hover:border-zinc-800 hover:bg-zinc-900/30">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-all" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Total CO2e</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Activity className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-extrabold tracking-tight text-emerald-400">
                {totalCo2e.toFixed(1)}
              </span>
              <span className="text-xs font-medium text-zinc-500">kg</span>
            </div>
            <p className="mt-1 text-xs text-zinc-400">Carbon debt across logged actions</p>
          </div>

          {/* Distance Card */}
          <div className="group rounded-2xl border border-zinc-900 bg-zinc-900/20 p-6 shadow-xl relative overflow-hidden transition-all duration-300 hover:border-zinc-800 hover:bg-zinc-900/30">
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-3xl group-hover:bg-teal-500/10 transition-all" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Travel Distance</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
                <Navigation className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-extrabold tracking-tight text-teal-400">
                {totalDistance.toFixed(0)}
              </span>
              <span className="text-xs font-medium text-zinc-500">km</span>
            </div>
            <p className="mt-1 text-xs text-zinc-400">Accumulated transit route path</p>
          </div>

          {/* Activity Count Card */}
          <div className="group rounded-2xl border border-zinc-900 bg-zinc-900/20 p-6 shadow-xl relative overflow-hidden transition-all duration-300 hover:border-zinc-800 hover:bg-zinc-900/30">
            <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full blur-3xl group-hover:bg-sky-500/10 transition-all" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Logged Trips</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <Calendar className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-extrabold tracking-tight text-sky-400">
                {tripsCount}
              </span>
              <span className="text-xs font-medium text-zinc-500">trips</span>
            </div>
            <p className="mt-1 text-xs text-zinc-400">Individual journeys recorded</p>
          </div>

          {/* Active Streak Card */}
          <div className="group rounded-2xl border border-zinc-900 bg-zinc-900/20 p-6 shadow-xl relative overflow-hidden transition-all duration-300 hover:border-zinc-800 hover:bg-zinc-900/30">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl group-hover:bg-amber-500/10 transition-all" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Active Streak</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Flame className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-extrabold tracking-tight text-amber-400">
                {streakData?.current_streak ?? 0}
              </span>
              <span className="text-xs font-medium text-zinc-500">days</span>
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              Personal record: {streakData?.longest_streak ?? 0} days
            </p>
          </div>
        </section>

        {isFetching ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-zinc-900 bg-zinc-900/10">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : trips.length === 0 ? (
          /* Empty State Dashboard */
          <section className="flex flex-col items-center justify-center py-20 px-6 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/5 text-center max-w-2xl mx-auto space-y-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <MapPin className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">Your carbon log is empty</h3>
              <p className="text-sm text-zinc-400 max-w-sm mx-auto leading-relaxed">
                Start logging your transport activity and journeys to view emissions over time, compare travel modes, and trigger reduction streaks.
              </p>
            </div>
            <Link
              href="/trips/new"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-zinc-50 hover:bg-emerald-500 transition active:scale-[0.98] cursor-pointer shadow-lg shadow-emerald-700/10"
            >
              <Plus className="h-4.5 w-4.5" />
              <span>Log Your First Trip</span>
            </Link>
          </section>
        ) : (
          /* Live Dashboard Layout */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Trend Chart & Activity List */}
            <div className="lg:col-span-8 space-y-8">
              {/* Daily Carbon Budget Progress Card */}
              <div className="rounded-2xl border border-zinc-900 bg-zinc-900/20 p-6 shadow-xl relative overflow-hidden transition-all duration-300 hover:border-zinc-800 hover:bg-zinc-900/30 animate-scaleUp">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl" />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Target className="h-5 w-5 text-emerald-400" />
                      <span>Daily Carbon Budget</span>
                    </h3>
                    <p className="text-xs text-zinc-400">Track today&apos;s travel emissions against sustainable targets</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-3xl font-extrabold tracking-tight ${
                      todayEmissions > DAILY_BUDGET_KG ? "text-rose-400" : "text-emerald-400"
                    }`}>
                      {todayEmissions.toFixed(2)}
                    </span>
                    <span className="text-xs font-medium text-zinc-500 ml-1">/ {DAILY_BUDGET_KG.toFixed(2)} kg CO2e</span>
                  </div>
                </div>

                <div className="mt-6 relative z-10">
                  {/* Progress Bar */}
                  <div className="h-3 w-full bg-zinc-950/60 rounded-full overflow-hidden border border-zinc-900 relative">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        todayEmissions > DAILY_BUDGET_KG
                          ? "bg-gradient-to-r from-amber-500 to-rose-500"
                          : "bg-gradient-to-r from-emerald-500 to-teal-400"
                      }`}
                      style={{ width: `${Math.min((todayEmissions / DAILY_BUDGET_KG) * 100, 100)}%` }}
                      role="progressbar"
                      aria-valuenow={todayEmissions}
                      aria-valuemin={0}
                      aria-valuemax={DAILY_BUDGET_KG}
                      aria-label="Daily carbon emissions progress"
                    />
                  </div>
                  <div className="flex justify-between items-center mt-3">
                    <span className="text-[10px] font-semibold text-zinc-400">
                      Today&apos;s Limit: {((todayEmissions / DAILY_BUDGET_KG) * 100).toFixed(0)}% used
                    </span>
                    <span className="text-[10px] font-semibold flex items-center gap-1">
                      {todayEmissions <= DAILY_BUDGET_KG ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <Check className="h-3.5 w-3.5" /> Under budget limit
                        </span>
                      ) : (
                        <span className="text-rose-400 flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5" /> Over budget by {(todayEmissions - DAILY_BUDGET_KG).toFixed(2)} kg
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Trend Chart Panel */}
              <div className="rounded-2xl border border-zinc-900 bg-zinc-900/10 p-6 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <TrendingUp className="h-4.5 w-4.5 text-emerald-400" />
                      <span>Emissions Trend over Time</span>
                    </h3>
                    <p className="text-xs text-zinc-500">Daily/weekly footprint distribution</p>
                  </div>
                  {/* Timeframe selector */}
                  <div className="flex border border-zinc-800 rounded-lg p-1 bg-zinc-950/40">
                    <button
                      onClick={() => setTimeRange("7d")}
                      className={`px-3 py-1 text-[11px] font-semibold rounded-md transition cursor-pointer ${
                        timeRange === "7d"
                          ? "bg-zinc-900 text-zinc-200 border border-zinc-800"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      Past 7 Days
                    </button>
                    <button
                      onClick={() => setTimeRange("30d")}
                      className={`px-3 py-1 text-[11px] font-semibold rounded-md transition cursor-pointer ${
                        timeRange === "30d"
                          ? "bg-zinc-900 text-zinc-200 border border-zinc-800"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      Past 30 Days
                    </button>
                  </div>
                </div>

                {/* Custom SVG Line/Area Graph */}
                <div className="relative w-full h-[220px]">
                  <svg
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    className="w-full h-full text-emerald-500"
                    preserveAspectRatio="none"
                  >
                    {/* Gradients */}
                    <defs>
                      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal Grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
                      const yPos = padTop + plotHeight * ratio;
                      const gridVal = maxEmissionsVal * (1 - ratio);
                      return (
                        <g key={index}>
                          <line
                            x1={padLeft}
                            y1={yPos}
                            x2={svgWidth - padRight}
                            y2={yPos}
                            stroke="#1f2937"
                            strokeWidth="1"
                            strokeDasharray="4 4"
                          />
                          <text
                            x={padLeft - 8}
                            y={yPos + 4}
                            textAnchor="end"
                            fill="#71717a"
                            fontSize="10"
                            fontWeight="500"
                          >
                            {gridVal.toFixed(1)}
                          </text>
                        </g>
                      );
                    })}

                    {/* Area path */}
                    {areaPathD && (
                      <path
                        d={areaPathD}
                        fill="url(#areaGradient)"
                        className="animate-chartFadeIn"
                      />
                    )}

                    {/* Path line */}
                    {linePathD && (
                      <path
                        d={linePathD}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="animate-chartDraw"
                      />
                    )}

                    {/* Dots for Points */}
                    {points.map((p, i) => (
                      <g key={i} className="group cursor-pointer">
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r="5"
                          className="fill-zinc-950 stroke-emerald-400 stroke-[3.5] hover:r-6 hover:stroke-emerald-300 transition-all duration-150"
                        />
                        {/* Hover Tooltip Value */}
                        <title>{`${trendData[i].value.toFixed(1)} kg CO2e`}</title>
                      </g>
                    ))}

                    {/* X-Axis labels */}
                    {trendData.map((d, i) => {
                      const x = padLeft + (i * plotWidth) / (trendData.length - 1);
                      return (
                        <text
                          key={i}
                          x={x}
                          y={svgHeight - 10}
                          textAnchor="middle"
                          fill="#71717a"
                          fontSize="10.5"
                          fontWeight="600"
                        >
                          {d.label}
                        </text>
                      );
                    })}
                  </svg>
                </div>
              </div>

              {/* Recent Activities List */}
              <div className="rounded-2xl border border-zinc-900 bg-zinc-900/10 p-6 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold">Recent Logged Trips</h3>
                    <p className="text-xs text-zinc-500">Your latest logged transport activities</p>
                  </div>
                  <Link
                    href="/trips/new"
                    className="flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition"
                  >
                    <span>Log New Trip</span>
                    <Plus className="h-3.5 w-3.5" />
                  </Link>
                </div>

                <div className="space-y-4">
                  {[...trips]
                    .reverse()
                    .slice(0, 5)
                    .map((trip, idx) => {
                      const Icon = getModeMeta(trip.mode).icon;
                      return (
                        <div
                          key={trip.id || idx}
                          className="flex items-center justify-between rounded-xl border border-zinc-900 bg-zinc-950/20 p-4 transition-all duration-200 hover:border-zinc-800/80"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/40 text-zinc-400">
                              <Icon className="h-5 w-5 text-emerald-500/80" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold capitalize text-zinc-100">
                                  {getModeMeta(trip.mode).label}
                                </span>
                                <span className="text-[10px] text-zinc-500">•</span>
                                <span className="text-[11px] text-zinc-400">
                                  {new Date(trip.timestamp).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
                                <span className="max-w-[130px] sm:max-w-[180px] truncate">{trip.origin}</span>
                                <ChevronRight className="h-3 w-3 text-zinc-600" />
                                <span className="max-w-[130px] sm:max-w-[180px] truncate">
                                  {trip.destination}
                                </span>
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <p className="text-sm font-extrabold text-emerald-400">
                              {trip.co2e_kg.toFixed(2)} kg
                            </p>
                            <p className="text-[10px] text-zinc-500 mt-0.5">
                              {trip.distance_km.toFixed(1)} km
                            </p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Right Column: Category Breakdown & Factor Transparency Info */}
            <div className="lg:col-span-4 space-y-8">
              {/* Climate Benchmarks Panel */}
              <div className="rounded-2xl border border-zinc-900 bg-zinc-900/20 p-6 shadow-xl relative overflow-hidden transition-all duration-300 hover:border-zinc-800 hover:bg-zinc-900/30 animate-scaleUp">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl" />
                <div className="w-full text-left mb-6 relative z-10">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Globe className="h-5 w-5 text-emerald-400" />
                    <span>Climate Benchmarks</span>
                  </h3>
                  <p className="text-xs text-zinc-400">Comparing your projected annual footprint to global targets</p>
                </div>

                <div className="space-y-5 relative z-10">
                  {(() => {
                    const benchmarkSustainable = 2.1;
                    const benchmarkGlobalAvg = 4.7;
                    const maxVal = Math.max(userAnnualVal, benchmarkGlobalAvg, benchmarkSustainable) * 1.1;

                    const userPct = (userAnnualVal / maxVal) * 100;
                    const sustainablePct = (benchmarkSustainable / maxVal) * 100;
                    const globalPct = (benchmarkGlobalAvg / maxVal) * 100;

                    return (
                      <div className="space-y-4">
                        {/* 1. User's Footprint */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-zinc-200">Your Annualized Footprint</span>
                            <span className={`font-bold ${
                              userAnnualVal <= benchmarkSustainable
                                ? "text-emerald-400"
                                : userAnnualVal <= benchmarkGlobalAvg
                                ? "text-amber-400"
                                : "text-rose-400"
                            }`}>
                              {userAnnualVal.toFixed(2)} t CO2e/yr
                            </span>
                          </div>
                          <div className="h-2.5 w-full bg-zinc-950/60 rounded-full overflow-hidden border border-zinc-900">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                userAnnualVal <= benchmarkSustainable
                                  ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                                  : userAnnualVal <= benchmarkGlobalAvg
                                  ? "bg-gradient-to-r from-amber-500 to-emerald-400"
                                  : "bg-gradient-to-r from-rose-500 to-amber-500"
                              }`}
                              style={{ width: `${Math.max(userPct, 3)}%` }}
                              role="progressbar"
                              aria-valuenow={userAnnualVal}
                              aria-valuemin={0}
                              aria-valuemax={maxVal}
                              aria-label="Your annualized carbon footprint"
                            />
                          </div>
                        </div>

                        {/* 2. Sustainable Target */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-zinc-300">1.5°C Paris Target (IPCC)</span>
                            <span className="text-emerald-400 font-bold">{benchmarkSustainable.toFixed(2)} t CO2e/yr</span>
                          </div>
                          <div className="h-2.5 w-full bg-zinc-950/60 rounded-full overflow-hidden border border-zinc-900">
                            <div
                              className="h-full bg-emerald-500/80 rounded-full border border-dashed border-emerald-400/50 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                              style={{ width: `${sustainablePct}%` }}
                              role="progressbar"
                              aria-valuenow={benchmarkSustainable}
                              aria-valuemin={0}
                              aria-valuemax={maxVal}
                              aria-label="IPCC 1.5°C sustainable target"
                            />
                          </div>
                          <p className="text-[9px] text-zinc-500 italic">Target limit to prevent worst climate impacts</p>
                        </div>

                        {/* 3. Global Average */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-zinc-300">Global Average (World Bank)</span>
                            <span className="text-zinc-400 font-bold">{benchmarkGlobalAvg.toFixed(2)} t CO2e/yr</span>
                          </div>
                          <div className="h-2.5 w-full bg-zinc-950/60 rounded-full overflow-hidden border border-zinc-900">
                            <div
                              className="h-full bg-zinc-600 rounded-full"
                              style={{ width: `${globalPct}%` }}
                              role="progressbar"
                              aria-valuenow={benchmarkGlobalAvg}
                              aria-valuemin={0}
                              aria-valuemax={maxVal}
                              aria-label="World Bank global average carbon footprint"
                            />
                          </div>
                          <p className="text-[9px] text-zinc-500 italic">Current global per-capita average emissions</p>
                        </div>

                        {/* Assessment message */}
                        <div className="mt-6 pt-4 border-t border-zinc-900">
                          <div className={`rounded-xl p-3 border text-xs leading-relaxed ${
                            userAnnualVal <= benchmarkSustainable
                              ? "bg-emerald-950/5 border-emerald-900/20 text-emerald-400"
                              : userAnnualVal <= benchmarkGlobalAvg
                              ? "bg-amber-950/5 border-amber-900/20 text-amber-400"
                              : "bg-rose-950/5 border-rose-900/20 text-rose-400"
                          }`}>
                            {userAnnualVal <= benchmarkSustainable ? (
                              <span>🎉 <strong>Paris Aligned:</strong> Your footprint is within the sustainable limit of 2.1t. Amazing contribution to saving the planet!</span>
                            ) : userAnnualVal <= benchmarkGlobalAvg ? (
                              <span>👍 <strong>Below Average:</strong> You are beating the global average of 4.7t, but still exceed the 2.1t sustainable limit. Keep reducing!</span>
                            ) : (
                              <span>⚠️ <strong>High Footprint:</strong> Your annualized footprint is higher than the global average. Swapping key trips can help lower this.</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Category Breakdown Panel */}
              <div className="rounded-2xl border border-zinc-900 bg-zinc-900/10 p-6 shadow-xl flex flex-col items-center">
                <div className="w-full text-left mb-6">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <BarChart2 className="h-4.5 w-4.5 text-emerald-400" />
                    <span>Breakdown by Category</span>
                  </h3>
                  <p className="text-xs text-zinc-500">Emissions share by activity sector</p>
                </div>

                {/* Donut Chart SVG */}
                <div className="relative w-40 h-40 flex items-center justify-center">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    {/* Background Circle */}
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="#18181b" strokeWidth="8" />

                    {totalCategories > 0 ? (
                      <>
                        {/* Transport Segment */}
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          fill="transparent"
                          stroke="#10b981"
                          strokeWidth="8.5"
                          strokeDasharray={`${2 * Math.PI * 40 * transportPct} ${2 * Math.PI * 40}`}
                          strokeDashoffset="0"
                          strokeLinecap="round"
                        />
                        {/* Food Segment (Phase 7) */}
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          fill="transparent"
                          stroke="#38bdf8"
                          strokeWidth="8.5"
                          strokeDasharray={`${2 * Math.PI * 40 * foodPct} ${2 * Math.PI * 40}`}
                          strokeDashoffset={`-${2 * Math.PI * 40 * transportPct}`}
                          strokeLinecap="round"
                        />
                        {/* Energy Segment (Phase 7) */}
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          fill="transparent"
                          stroke="#6366f1"
                          strokeWidth="8.5"
                          strokeDasharray={`${2 * Math.PI * 40 * energyPct} ${2 * Math.PI * 40}`}
                          strokeDashoffset={`-${2 * Math.PI * 40 * (transportPct + foodPct)}`}
                          strokeLinecap="round"
                        />
                      </>
                    ) : (
                      <circle cx="50" cy="50" r="40" fill="transparent" stroke="#27272a" strokeWidth="8" />
                    )}
                  </svg>

                  {/* Center Text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Transport</span>
                    <span className="text-xl font-bold text-zinc-100">
                      {totalCategories > 0 ? `${(transportPct * 100).toFixed(0)}%` : "0%"}
                    </span>
                  </div>
                </div>

                {/* Legend */}
                <div className="w-full grid grid-cols-3 gap-2 mt-6 border-t border-zinc-900 pt-4">
                  <div className="text-center">
                    <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-zinc-300">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span>Transit</span>
                    </div>
                    <p className="text-xs font-bold text-zinc-100 mt-0.5">{(transportPct * 100).toFixed(0)}%</p>
                  </div>
                  <div className="text-center opacity-40">
                    <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500">
                      <span className="h-2 w-2 rounded-full bg-sky-400" />
                      <span>Food</span>
                    </div>
                    <p className="text-xs font-bold text-zinc-500 mt-0.5">0%</p>
                  </div>
                  <div className="text-center opacity-40">
                    <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500">
                      <span className="h-2 w-2 rounded-full bg-indigo-500" />
                      <span>Energy</span>
                    </div>
                    <p className="text-xs font-bold text-zinc-500 mt-0.5">0%</p>
                  </div>
                </div>
              </div>

              {/* Climate Commitments Panel */}
              <div className="rounded-2xl border border-zinc-900 bg-zinc-900/10 p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Award className="h-4.5 w-4.5 text-emerald-400" />
                    <span>My Pledges</span>
                  </h3>
                  <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider bg-zinc-900 px-2.5 py-0.5 rounded-full border border-zinc-800">
                    {commitments.filter((c) => c.status === "active").length} active
                  </span>
                </div>

                {commitments.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/20 p-6 text-center space-y-3">
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      You haven&apos;t made any carbon reduction commitments yet.
                    </p>
                    <Link
                      href="/simulate"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700/80 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition cursor-pointer"
                    >
                      <Sparkles className="h-3 w-3 text-emerald-400" />
                      <span>Open Reduction Lab</span>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-thin pr-1">
                    {commitments.map((commitment) => (
                      <div
                        key={commitment.id}
                        className={`rounded-xl border p-4 transition-all duration-200 flex flex-col gap-3 ${
                          commitment.status === "active"
                            ? "border-zinc-800 bg-zinc-950/30"
                            : commitment.status === "completed"
                            ? "border-emerald-950/35 bg-emerald-950/5 opacity-75"
                            : "border-zinc-900 bg-zinc-950/10 opacity-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-zinc-100 leading-tight">
                              {commitment.title}
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-400 bg-zinc-900/60 px-1.5 py-0.5 rounded border border-zinc-800">
                                {commitment.category}
                              </span>
                              <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
                                commitment.status === "active"
                                  ? "text-emerald-400 bg-emerald-500/10"
                                  : commitment.status === "completed"
                                  ? "text-sky-400 bg-sky-500/10"
                                  : "text-zinc-500 bg-zinc-900"
                              }`}>
                                {commitment.status}
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-extrabold text-emerald-400">
                              -{commitment.projected_savings_kg.toFixed(0)} kg
                            </p>
                            <p className="text-[8px] text-zinc-500 uppercase tracking-wider">
                              CO2e / yr
                            </p>
                          </div>
                        </div>

                        {commitment.status === "active" && (
                          <div className="flex items-center gap-2 mt-1 pt-2 border-t border-zinc-900">
                            <button
                              onClick={() => handleUpdateStatus(commitment.id!, "completed")}
                              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-600 hover:text-zinc-950 text-xs font-semibold transition-all duration-200 active:scale-[0.98] cursor-pointer"
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>Completed</span>
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(commitment.id!, "abandoned")}
                              className="flex items-center justify-center h-8 w-8 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-red-400 hover:bg-red-500/5 hover:border-red-500/20 transition-all duration-200 active:scale-[0.98] cursor-pointer"
                              title="Abandon pledge"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Transit Mode breakdown */}
              <div className="rounded-2xl border border-zinc-900 bg-zinc-900/10 p-6 shadow-xl">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Activity className="h-4.5 w-4.5 text-emerald-400" />
                  <span>Transit Modes</span>
                </h3>
                <div className="space-y-4">
                  {modeBreakdownList.map((modeData) => {
                    const ModeIcon = modeData.icon;
                    const totalDistanceAll = totalDistance || 1.0;
                    const percentage = (modeData.distance / totalDistanceAll) * 100;
                    return (
                      <div key={modeData.key} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-medium">
                          <div className="flex items-center gap-2 text-zinc-300">
                            <ModeIcon className="h-4 w-4 text-emerald-500/70" />
                            <span>{modeData.label}</span>
                          </div>
                          <span className="text-zinc-400 font-semibold">{modeData.co2e.toFixed(1)} kg CO2e</span>
                        </div>
                        {/* Custom Progress Bar */}
                        <div className="h-2 w-full bg-zinc-950/60 rounded-full overflow-hidden border border-zinc-900">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(percentage, 4)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[9px] text-zinc-500">
                          <span>{modeData.distance.toFixed(1)} km</span>
                          <span>{percentage.toFixed(0)}% of travel</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Transparency Panel Promo */}
              <div className="rounded-2xl border border-emerald-950/20 bg-emerald-950/5 p-6 space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-full blur-2xl" />
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-400">
                    <Info className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-300">Auditable Accounting</h4>
                    <p className="text-xs text-zinc-400 leading-relaxed mt-1">
                      Our carbon calculators utilize direct deterministic formulas. Every factor matches official GHG sources.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsMethodologyOpen(true)}
                  className="w-full text-center rounded-xl border border-emerald-800/40 bg-emerald-500/10 py-2.5 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-500/20 cursor-pointer"
                >
                  View Factor Citations
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Methodology Modal Overlay */}
      {isMethodologyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Glassmorphism backdrop */}
          <div
            onClick={() => setIsMethodologyOpen(false)}
            className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm cursor-pointer"
          />

          {/* Modal Box */}
          <div className="relative w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl z-10 flex flex-col max-h-[85vh] animate-scaleUp">
            <header className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Award className="h-5 w-5 text-emerald-400" />
                  <span>Carbon Accounting Methodology</span>
                </h3>
                <p className="text-xs text-zinc-400">Verification citation directory for conversion factors</p>
              </div>
              <button
                onClick={() => setIsMethodologyOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
              <p className="text-xs text-zinc-400 leading-relaxed">
                Handprint implements carbon footprint calculation using deterministic math over peer-reviewed and government-cited datasets.
                Emissions are calculated as: <code className="text-[11px] bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800 text-emerald-400">Emissions (kg CO2e) = Distance (km) × Factor (kg CO2e/km)</code>.
              </p>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Transport Conversion Factors</h4>
                <div className="space-y-2">
                  {CITATION_DATA.map((cit, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3 flex flex-col gap-1 text-xs"
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-zinc-200">{cit.mode}</span>
                        <span className="text-emerald-400">{cit.factor}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-zinc-500 leading-tight">
                        <span className="max-w-[340px] truncate">{cit.source}</span>
                        <span>Year: {cit.year}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-emerald-900/20 bg-emerald-950/5 p-4 text-[11px] text-zinc-400 leading-relaxed">
                <span className="font-bold text-emerald-400 block mb-1">Methodology Audit Integrity</span>
                Our accounting model ensures zero LLM estimation. Vertex AI functions only as a semantic text parser and narration overlay, maintaining strict separation of concerns from calculation databases.
              </div>
            </div>

            <footer className="border-t border-zinc-800 pt-4 mt-4 flex justify-end">
              <button
                onClick={() => setIsMethodologyOpen(false)}
                className="rounded-xl bg-zinc-800 px-5 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 transition cursor-pointer"
              >
                Close Panel
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Styled Grid for Canvas background & animations */}
      <style jsx global>{`
        @keyframes chartDraw {
          from { stroke-dasharray: 1000; stroke-dashoffset: 1000; }
          to { stroke-dasharray: 1000; stroke-dashoffset: 0; }
        }
        .animate-chartDraw {
          animation: chartDraw 1.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
        @keyframes chartFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-chartFadeIn {
          animation: chartFadeIn 0.8s ease-in-out 0.6s forwards;
          opacity: 0;
        }
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
