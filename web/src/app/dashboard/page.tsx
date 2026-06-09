"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  Apple,
  Activity,
  AlertTriangle,
  Award,
  BarChart2,
  Bike,
  Bus,
  Calendar,
  Car,
  Check,
  Footprints,
  Globe,
  Info,
  Flame,
  MapPin,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
  Train,
  Trash2,
  X,
  Zap,
  Navigation,
} from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { AppSidebar } from "@/components/app-sidebar";

// Pinned factors from api/app/domain/factors.py — for methodology transparency modal
const CITATION_DATA = [
  { mode: "Petrol Car",               factor: "0.16489 kg CO2e/km", source: "UK DESNZ/DEFRA Greenhouse Gas Conversion Factors", year: 2024 },
  { mode: "Diesel Car",               factor: "0.16398 kg CO2e/km", source: "UK DESNZ/DEFRA Greenhouse Gas Conversion Factors", year: 2024 },
  { mode: "Electric Vehicle (EV)",    factor: "0.04690 kg CO2e/km", source: "UK DESNZ/DEFRA Greenhouse Gas Conversion Factors", year: 2024 },
  { mode: "Hybrid Car",               factor: "0.11500 kg CO2e/km", source: "UK DESNZ/DEFRA Greenhouse Gas Conversion Factors", year: 2024 },
  { mode: "Motorbike / Two-wheeler",  factor: "0.11327 kg CO2e/km", source: "UK DESNZ/DEFRA Greenhouse Gas Conversion Factors", year: 2024 },
  { mode: "Public Bus",               factor: "0.09658 kg CO2e/km", source: "UK DESNZ/DEFRA Greenhouse Gas Conversion Factors", year: 2024 },
  { mode: "Passenger Train",          factor: "0.03549 kg CO2e/km", source: "UK DESNZ/DEFRA Greenhouse Gas Conversion Factors", year: 2024 },
  { mode: "Metro / Light Rail",       factor: "0.02781 kg CO2e/km", source: "UK DESNZ/DEFRA Greenhouse Gas Conversion Factors", year: 2024 },
  { mode: "Bicycle / Active Travel",  factor: "0.00000 kg CO2e/km", source: "Self-evident direct human transport",               year: 2026 },
];

const FOOD_CITATION_DATA = [
  { item: "Beef",                  factor: "99.48 kg CO2e/kg", source: "Poore & Nemecek (2018) via Our World in Data", year: 2018 },
  { item: "Farmed Fish",           factor: "13.63 kg CO2e/kg", source: "Poore & Nemecek (2018) via Our World in Data", year: 2018 },
  { item: "Pork",                  factor: "12.31 kg CO2e/kg", source: "Poore & Nemecek (2018) via Our World in Data", year: 2018 },
  { item: "Chicken (Poultry)",     factor: "9.87 kg CO2e/kg",  source: "Poore & Nemecek (2018) via Our World in Data", year: 2018 },
  { item: "Eggs",                  factor: "4.67 kg CO2e/kg",  source: "Poore & Nemecek (2018) via Our World in Data", year: 2018 },
  { item: "Rice",                  factor: "4.45 kg CO2e/kg",  source: "Poore & Nemecek (2018) via Our World in Data", year: 2018 },
  { item: "Milk",                  factor: "3.15 kg CO2e/kg",  source: "Poore & Nemecek (2018) via Our World in Data", year: 2018 },
  { item: "Wheat & Rye",          factor: "1.40 kg CO2e/kg",  source: "Poore & Nemecek (2018) via Our World in Data", year: 2018 },
  { item: "Vegetables (Average)", factor: "0.53 kg CO2e/kg",  source: "Poore & Nemecek (2018) via Our World in Data", year: 2018 },
  { item: "Fruit (Average)",       factor: "0.43 kg CO2e/kg",  source: "Poore & Nemecek (2018) via Our World in Data", year: 2018 },
];

const ENERGY_CITATION_DATA = [
  { sourceName: "Electricity (Indian Grid)", factor: "0.727 kg CO2e/kWh",  source: "CEA CO2 Baseline Database for the Indian Power Sector, Version 20.0", year: 2024 },
  { sourceName: "LPG (Cooking / Heating)",   factor: "2.9389 kg CO2e/kg", source: "UK DESNZ/DEFRA Greenhouse Gas Conversion Factors",                    year: 2024 },
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

interface FoodLog {
  id: string | null;
  user_id: string;
  item: string;
  weight_kg: number;
  co2e_kg: number;
  timestamp: string;
  citation: string;
  effective_year: number;
}

interface EnergyLog {
  id: string | null;
  user_id: string;
  source: string;
  quantity: number;
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

export default function DashboardPage() {
  const { user, loading, apiFetch } = useAuth();

  const [trips, setTrips] = useState<TripLog[]>([]);
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [energyLogs, setEnergyLogs] = useState<EnergyLog[]>([]);
  const [commitments, setCommitments] = useState<CommittedAction[]>([]);
  const [streakData, setStreakData] = useState<UserStreak | null>(null);
  const [narration, setNarration] = useState<string>("");
  const [narrationSource, setNarrationSource] = useState<"gemini" | "rules" | "">("");
  const [isFetching, setIsFetching] = useState(true);
  const [timeRange, setTimeRange] = useState<"7d" | "30d">("7d");
  const [errorMsg, setErrorMsg] = useState("");
  const [isMethodologyOpen, setIsMethodologyOpen] = useState(false);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return;
      setIsFetching(true);
      setErrorMsg("");
      try {
        const [tripsData, commitmentsData, streakDataVal, foodData, energyData, insightsData] =
          await Promise.all([
            apiFetch<TripLog[]>("/trips"),
            apiFetch<CommittedAction[]>("/committed_actions"),
            apiFetch<UserStreak>("/streaks"),
            apiFetch<FoodLog[]>("/food"),
            apiFetch<EnergyLog[]>("/energy"),
            apiFetch<{ narration: string; source: "gemini" | "rules" }>("/insights").catch(
              (err) => {
                console.error("Failed to load insights:", err);
                return { narration: "", source: "rules" as const };
              }
            ),
          ]);
        const sortedTrips = [...tripsData].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        const sortedFood = [...foodData].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        const sortedEnergy = [...energyData].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        setTrips(sortedTrips);
        setFoodLogs(sortedFood);
        setEnergyLogs(sortedEnergy);
        setCommitments(commitmentsData);
        setStreakData(streakDataVal);
        setNarration(insightsData.narration);
        setNarrationSource(insightsData.source);
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

  const openButtonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMethodologyOpen) return;
    const modal = modalRef.current;
    if (modal) modal.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMethodologyOpen(false);
        return;
      }
      if (e.key === "Tab") {
        if (!modal) return;
        const focusable = modal.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { last.focus(); e.preventDefault(); }
        } else {
          if (document.activeElement === last) { first.focus(); e.preventDefault(); }
        }
      }
    };

    const openBtn = openButtonRef.current;
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (openBtn) openBtn.focus();
    };
  }, [isMethodologyOpen]);

  const handleUpdateStatus = async (
    commitmentId: string,
    newStatus: "completed" | "abandoned"
  ) => {
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

  // ─── Calculations ────────────────────────────────────────────────────────────

  const totalDistance = trips.reduce((sum, t) => sum + t.distance_km, 0);
  const totalTripCo2e = trips.reduce((sum, t) => sum + t.co2e_kg, 0);
  const totalFoodCo2e = foodLogs.reduce((sum, f) => sum + f.co2e_kg, 0);
  const totalEnergyCo2e = energyLogs.reduce((sum, e) => sum + e.co2e_kg, 0);
  const totalCo2e = totalTripCo2e + totalFoodCo2e + totalEnergyCo2e;
  const tripsCount = trips.length;

  const DAILY_BUDGET_KG = 5.75; // IPCC AR6 1.5°C compatible: 2100 kg/year / 365 days
  const todayStr = new Date().toLocaleDateString("en-CA");

  const todayTripEmissions = trips
    .filter((t) => new Date(t.timestamp).toLocaleDateString("en-CA") === todayStr)
    .reduce((sum, t) => sum + t.co2e_kg, 0);
  const todayFoodEmissions = foodLogs
    .filter((f) => new Date(f.timestamp).toLocaleDateString("en-CA") === todayStr)
    .reduce((sum, f) => sum + f.co2e_kg, 0);
  const todayEnergyEmissions = energyLogs
    .filter((e) => new Date(e.timestamp).toLocaleDateString("en-CA") === todayStr)
    .reduce((sum, e) => sum + e.co2e_kg, 0);
  const todayEmissions = todayTripEmissions + todayFoodEmissions + todayEnergyEmissions;

  const calculateAnnualScalingFactor = (
    logs: (TripLog | FoodLog | EnergyLog)[]
  ): number => {
    if (logs.length === 0) return 0;
    const timestamps = logs.map((t) => new Date(t.timestamp).getTime());
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const minDate = new Date(minTime);
    minDate.setHours(0, 0, 0, 0);
    const maxDate = new Date(maxTime);
    maxDate.setHours(0, 0, 0, 0);
    const daysSpan =
      Math.round(Math.abs(maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return 365.0 / Math.max(7.0, daysSpan);
  };

  const allLogs = [...trips, ...foodLogs, ...energyLogs];
  const annualScale = calculateAnnualScalingFactor(allLogs);
  const userAnnualVal = (totalCo2e * annualScale) / 1000;

  const categoryEmissions = {
    transport: totalTripCo2e,
    food: totalFoodCo2e,
    energy: totalEnergyCo2e,
  };
  const totalCategories =
    categoryEmissions.transport + categoryEmissions.food + categoryEmissions.energy;
  const transportPct = totalCategories > 0 ? categoryEmissions.transport / totalCategories : 0;
  const foodPct = totalCategories > 0 ? categoryEmissions.food / totalCategories : 0;
  const energyPct = totalCategories > 0 ? categoryEmissions.energy / totalCategories : 0;

  const modeBreakdownMap: Record<
    string,
    { distance: number; co2e: number; label: string; icon: React.ComponentType<{ className?: string }> }
  > = {};

  const getModeMeta = (m: string) => {
    switch (m) {
      case "bus":       return { label: "Public Bus", icon: Bus };
      case "train":     return { label: "Train",      icon: Train };
      case "metro":     return { label: "Metro",      icon: Train };
      case "motorbike": return { label: "Motorbike",  icon: Bike };
      case "bicycle":   return { label: "Bicycle",    icon: Bike };
      case "walking":   return { label: "Walking",    icon: Footprints };
      case "ev_car":    return { label: "EV Car",     icon: Car };
      case "hybrid_car":return { label: "Hybrid Car", icon: Car };
      case "diesel_car":return { label: "Diesel Car", icon: Car };
      default:          return { label: "Petrol Car", icon: Car };
    }
  };

  trips.forEach((t) => {
    if (!modeBreakdownMap[t.mode]) {
      const meta = getModeMeta(t.mode);
      modeBreakdownMap[t.mode] = { distance: 0, co2e: 0, label: meta.label, icon: meta.icon };
    }
    modeBreakdownMap[t.mode].distance += t.distance_km;
    modeBreakdownMap[t.mode].co2e += t.co2e_kg;
  });

  const modeBreakdownList = Object.entries(modeBreakdownMap)
    .map(([key, val]) => ({ key, ...val }))
    .sort((a, b) => b.co2e - a.co2e);

  const getTrendData = () => {
    const dataPoints: { label: string; value: number }[] = [];
    const now = new Date();
    if (timeRange === "7d") {
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const dayStr = d.toLocaleDateString("en-CA");
        const dayVal =
          trips.filter((t) => new Date(t.timestamp).toLocaleDateString("en-CA") === dayStr).reduce((s, t) => s + t.co2e_kg, 0) +
          foodLogs.filter((f) => new Date(f.timestamp).toLocaleDateString("en-CA") === dayStr).reduce((s, f) => s + f.co2e_kg, 0) +
          energyLogs.filter((e) => new Date(e.timestamp).toLocaleDateString("en-CA") === dayStr).reduce((s, e) => s + e.co2e_kg, 0);
        dataPoints.push({ label: d.toLocaleDateString("en-US", { weekday: "short" }), value: dayVal });
      }
    } else {
      for (let i = 4; i >= 0; i--) {
        const endDay = new Date();
        endDay.setDate(now.getDate() - i * 6);
        const startDay = new Date();
        startDay.setDate(now.getDate() - (i * 6 + 5));
        const startMs = new Date(startDay.getFullYear(), startDay.getMonth(), startDay.getDate()).getTime();
        const endMs = new Date(endDay.getFullYear(), endDay.getMonth(), endDay.getDate(), 23, 59, 59).getTime();
        const rangeVal =
          trips.filter((t) => { const ms = new Date(t.timestamp).getTime(); return ms >= startMs && ms <= endMs; }).reduce((s, t) => s + t.co2e_kg, 0) +
          foodLogs.filter((f) => { const ms = new Date(f.timestamp).getTime(); return ms >= startMs && ms <= endMs; }).reduce((s, f) => s + f.co2e_kg, 0) +
          energyLogs.filter((e) => { const ms = new Date(e.timestamp).getTime(); return ms >= startMs && ms <= endMs; }).reduce((s, e) => s + e.co2e_kg, 0);
        dataPoints.push({ label: `${startDay.getDate()}/${startDay.getMonth() + 1}`, value: rangeVal });
      }
    }
    return dataPoints;
  };

  const trendData = getTrendData();
  const maxEmissionsVal = Math.max(...trendData.map((d) => d.value), 1.0);

  const svgWidth = 600;
  const svgHeight = 220;
  const padLeft = 45;
  const padRight = 15;
  const padTop = 20;
  const padBottom = 30;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  const points = trendData.map((d, i) => ({
    x: padLeft + (i * plotWidth) / (trendData.length - 1),
    y: padTop + plotHeight - (d.value / maxEmissionsVal) * plotHeight,
  }));

  const linePathD =
    points.length > 0
      ? points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(" ")
      : "";
  const areaPathD =
    points.length > 0
      ? `${linePathD} L ${points[points.length - 1].x} ${padTop + plotHeight} L ${points[0].x} ${padTop + plotHeight} Z`
      : "";

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-50 font-sans">
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-8 focus:outline-none"
        >
          {/* Page heading */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Dashboard</h1>
            <p className="text-xs text-zinc-400 mt-1">Your carbon footprint overview</p>
          </div>

          {errorMsg && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400 flex items-center justify-between">
              <span>{errorMsg}</span>
              <button onClick={() => setErrorMsg("")} className="text-zinc-400 hover:text-zinc-200">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Stats cards */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" aria-label="Summary statistics">
            <div className="group rounded-2xl border border-zinc-900 bg-zinc-900/20 p-6 shadow-xl relative overflow-hidden transition-all hover:border-zinc-800 hover:bg-zinc-900/30">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-all" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Total CO2e</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Activity className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold tracking-tight text-emerald-400">{totalCo2e.toFixed(1)}</span>
                <span className="text-xs font-medium text-zinc-500">kg</span>
              </div>
              <p className="mt-1 text-xs text-zinc-400">Carbon across logged activities</p>
            </div>

            <div className="group rounded-2xl border border-zinc-900 bg-zinc-900/20 p-6 shadow-xl relative overflow-hidden transition-all hover:border-zinc-800 hover:bg-zinc-900/30">
              <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-3xl group-hover:bg-teal-500/10 transition-all" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Travel Distance</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
                  <Navigation className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold tracking-tight text-teal-400">{totalDistance.toFixed(0)}</span>
                <span className="text-xs font-medium text-zinc-500">km</span>
              </div>
              <p className="mt-1 text-xs text-zinc-400">Total distance logged</p>
            </div>

            <div className="group rounded-2xl border border-zinc-900 bg-zinc-900/20 p-6 shadow-xl relative overflow-hidden transition-all hover:border-zinc-800 hover:bg-zinc-900/30">
              <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full blur-3xl group-hover:bg-sky-500/10 transition-all" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Logged Trips</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <Calendar className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold tracking-tight text-sky-400">{tripsCount}</span>
                <span className="text-xs font-medium text-zinc-500">trips</span>
              </div>
              <p className="mt-1 text-xs text-zinc-400">Individual journeys recorded</p>
            </div>

            <div className="group rounded-2xl border border-zinc-900 bg-zinc-900/20 p-6 shadow-xl relative overflow-hidden transition-all hover:border-zinc-800 hover:bg-zinc-900/30">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl group-hover:bg-amber-500/10 transition-all" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Active Streak</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Flame className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold tracking-tight text-amber-400">{streakData?.current_streak ?? 0}</span>
                <span className="text-xs font-medium text-zinc-500">days</span>
              </div>
              <p className="mt-1 text-xs text-zinc-400">Personal record: {streakData?.longest_streak ?? 0} days</p>
            </div>
          </section>

          {isFetching ? (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-zinc-900 bg-zinc-900/10">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            </div>
          ) : trips.length === 0 && foodLogs.length === 0 && energyLogs.length === 0 ? (
            <section
              className="flex flex-col items-center justify-center py-20 px-6 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/5 text-center max-w-2xl mx-auto space-y-6"
              aria-label="Empty state"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <MapPin className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold">No activities logged yet</h2>
                <p className="text-sm text-zinc-400 max-w-sm mx-auto leading-relaxed">
                  Log travel, food, or home energy to see your CO2e over time, compare transport
                  modes, and track your daily carbon budget.
                </p>
              </div>
              <Link
                href="/trips/new"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-zinc-950 hover:bg-emerald-400 transition active:scale-[0.98] shadow-lg shadow-emerald-500/10"
              >
                <Plus className="h-4 w-4" />
                Log your first activity
              </Link>
            </section>
          ) : (
            <>
              {narration && (
                <div
                  aria-live="polite"
                  aria-atomic="true"
                  className="rounded-2xl border border-zinc-900 bg-zinc-900/30 p-6 shadow-xl relative overflow-hidden animate-scaleUp"
                >
                  <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl" />
                  <div className="flex items-start gap-4 relative z-10">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-sm font-bold text-zinc-100">Footprint Narration</h2>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase border ${
                            narrationSource === "gemini"
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                              : "bg-zinc-800/40 border-zinc-800 text-zinc-400"
                          }`}
                        >
                          {narrationSource === "gemini" ? "Gemini narration" : "Rule-based fallback"}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-300 leading-relaxed">{narration}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column */}
                <div className="lg:col-span-8 space-y-8">
                  {/* Daily Carbon Budget */}
                  <div className="rounded-2xl border border-zinc-900 bg-zinc-900/20 p-6 shadow-xl relative overflow-hidden animate-scaleUp">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl" />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                      <div>
                        <h2 className="text-lg font-bold flex items-center gap-2">
                          <Target className="h-5 w-5 text-emerald-400" />
                          Daily Carbon Budget
                        </h2>
                        <p className="text-xs text-zinc-400">
                          Today vs. the IPCC AR6 1.5°C daily budget (5.75 kg CO2e)
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`text-3xl font-extrabold tracking-tight ${
                            todayEmissions > DAILY_BUDGET_KG ? "text-rose-400" : "text-emerald-400"
                          }`}
                        >
                          {todayEmissions.toFixed(2)}
                        </span>
                        <span className="text-xs font-medium text-zinc-500 ml-1">
                          / {DAILY_BUDGET_KG.toFixed(2)} kg CO2e
                        </span>
                      </div>
                    </div>
                    <div className="mt-6 relative z-10">
                      <div className="h-3 w-full bg-zinc-950/60 rounded-full overflow-hidden border border-zinc-900">
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
                          {((todayEmissions / DAILY_BUDGET_KG) * 100).toFixed(0)}% of daily budget used
                        </span>
                        <span className="text-[10px] font-semibold">
                          {todayEmissions <= DAILY_BUDGET_KG ? (
                            <span className="text-emerald-400 flex items-center gap-1">
                              <Check className="h-3.5 w-3.5" /> Under budget
                            </span>
                          ) : (
                            <span className="text-rose-400 flex items-center gap-1">
                              <AlertTriangle className="h-3.5 w-3.5" /> Over by {(todayEmissions - DAILY_BUDGET_KG).toFixed(2)} kg
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Trend Chart */}
                  <div className="rounded-2xl border border-zinc-900 bg-zinc-900/10 p-6 shadow-xl">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-lg font-bold flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-emerald-400" />
                          Emissions Trend
                        </h2>
                        <p className="text-xs text-zinc-500">Daily CO2e across all categories</p>
                      </div>
                      <div className="flex border border-zinc-800 rounded-lg p-1 bg-zinc-950/40">
                        <button
                          onClick={() => setTimeRange("7d")}
                          className={`px-3 py-1 text-[11px] font-semibold rounded-md transition cursor-pointer ${
                            timeRange === "7d"
                              ? "bg-zinc-900 text-zinc-200 border border-zinc-800"
                              : "text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          7 days
                        </button>
                        <button
                          onClick={() => setTimeRange("30d")}
                          className={`px-3 py-1 text-[11px] font-semibold rounded-md transition cursor-pointer ${
                            timeRange === "30d"
                              ? "bg-zinc-900 text-zinc-200 border border-zinc-800"
                              : "text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          30 days
                        </button>
                      </div>
                    </div>

                    <div className="relative w-full h-[220px]">
                      <table className="sr-only">
                        <caption>Carbon emissions trend, {timeRange === "7d" ? "7" : "30"} days</caption>
                        <thead>
                          <tr>
                            <th scope="col">Date</th>
                            <th scope="col">Emissions (kg CO2e)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trendData.map((d, i) => (
                            <tr key={i}>
                              <th scope="row">{d.label}</th>
                              <td>{d.value.toFixed(1)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
                          const yPos = padTop + plotHeight * ratio;
                          return (
                            <g key={index}>
                              <line x1={padLeft} y1={yPos} x2={svgWidth - padRight} y2={yPos} stroke="#1f2937" strokeWidth="1" strokeDasharray="4 4" />
                              <text x={padLeft - 8} y={yPos + 4} textAnchor="end" fill="#71717a" fontSize="10" fontWeight="500">
                                {(maxEmissionsVal * (1 - ratio)).toFixed(1)}
                              </text>
                            </g>
                          );
                        })}
                        {areaPathD && <path d={areaPathD} fill="url(#areaGradient)" className="animate-chartFadeIn" />}
                        {linePathD && <path d={linePathD} fill="none" stroke="#10b981" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="animate-chartDraw" />}
                        {points.map((p, i) => (
                          <g key={i}>
                            <circle cx={p.x} cy={p.y} r="5" className="fill-zinc-950 stroke-emerald-400 stroke-[3.5]" />
                            <title>{`${trendData[i].value.toFixed(1)} kg CO2e`}</title>
                          </g>
                        ))}
                        {trendData.map((d, i) => (
                          <text key={i} x={padLeft + (i * plotWidth) / (trendData.length - 1)} y={svgHeight - 10} textAnchor="middle" fill="#71717a" fontSize="10.5" fontWeight="600">
                            {d.label}
                          </text>
                        ))}
                      </svg>
                    </div>
                  </div>

                  {/* Recent Activities */}
                  <div className="rounded-2xl border border-zinc-900 bg-zinc-900/10 p-6 shadow-xl">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-lg font-bold">Recent Activities</h2>
                        <p className="text-xs text-zinc-500">Latest logged carbon items</p>
                      </div>
                      <Link href="/trips/new" className="flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition">
                        Log activity <Plus className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                    <div className="space-y-4">
                      {(() => {
                        interface UnifiedActivity {
                          id: string | null;
                          type: "travel" | "food" | "energy";
                          title: string;
                          subtitle: string;
                          co2e_kg: number;
                          valueString: string;
                          timestamp: string;
                          icon: React.ComponentType<{ className?: string }>;
                        }
                        const list: UnifiedActivity[] = [];
                        trips.forEach((t) => {
                          list.push({
                            id: t.id, type: "travel",
                            title: getModeMeta(t.mode).label,
                            subtitle: `${t.distance_km.toFixed(1)} km`,
                            co2e_kg: t.co2e_kg,
                            valueString: `${t.distance_km.toFixed(1)} km`,
                            timestamp: t.timestamp,
                            icon: getModeMeta(t.mode).icon,
                          });
                        });
                        const foodLabels: Record<string, string> = {
                          beef: "Beef", chicken: "Chicken", pork: "Pork", fish: "Farmed Fish",
                          milk: "Milk", eggs: "Eggs", rice: "Rice", wheat: "Wheat & Rye",
                          vegetables: "Vegetables", fruit: "Fruit",
                        };
                        foodLogs.forEach((f) => {
                          list.push({
                            id: f.id, type: "food",
                            title: foodLabels[f.item] || f.item,
                            subtitle: `${f.weight_kg.toFixed(2)} kg food`,
                            co2e_kg: f.co2e_kg,
                            valueString: `${f.weight_kg.toFixed(2)} kg`,
                            timestamp: f.timestamp,
                            icon: Apple,
                          });
                        });
                        const energyLabels: Record<string, string> = { electricity: "Electricity", lpg: "LPG" };
                        const energyUnits: Record<string, string> = { electricity: "kWh", lpg: "kg" };
                        energyLogs.forEach((e) => {
                          list.push({
                            id: e.id, type: "energy",
                            title: energyLabels[e.source] || e.source,
                            subtitle: `${e.quantity.toFixed(1)} ${energyUnits[e.source] || ""}`,
                            co2e_kg: e.co2e_kg,
                            valueString: `${e.quantity.toFixed(1)} ${energyUnits[e.source] || ""}`,
                            timestamp: e.timestamp,
                            icon: Zap,
                          });
                        });
                        const sorted = list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5);
                        if (sorted.length === 0) return <p className="text-xs text-zinc-500 text-center py-4">No recent activities</p>;
                        return sorted.map((act, idx) => {
                          const ActIcon = act.icon;
                          return (
                            <div key={act.id || idx} className="flex items-center justify-between rounded-xl border border-zinc-900 bg-zinc-950/20 p-4 transition hover:border-zinc-800/80">
                              <div className="flex items-center gap-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/40">
                                  <ActIcon className="h-5 w-5 text-emerald-500/85" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-zinc-100">{act.title}</span>
                                    <span className="text-[10px] text-zinc-500">•</span>
                                    <span className="text-[11px] text-zinc-400">
                                      {new Date(act.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                    </span>
                                  </div>
                                  <p className="text-xs text-zinc-400 mt-0.5">{act.subtitle}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-extrabold text-emerald-400">{act.co2e_kg.toFixed(2)} kg</p>
                                <p className="text-[10px] text-zinc-500 mt-0.5">{act.valueString}</p>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="lg:col-span-4 space-y-8">
                  {/* Climate Benchmarks */}
                  <div className="rounded-2xl border border-zinc-900 bg-zinc-900/20 p-6 shadow-xl relative overflow-hidden animate-scaleUp">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl" />
                    <div className="mb-6 relative z-10">
                      <h2 className="text-lg font-bold flex items-center gap-2">
                        <Globe className="h-5 w-5 text-emerald-400" />
                        Climate Benchmarks
                      </h2>
                      <p className="text-xs text-zinc-400">Your projected annual footprint vs. targets</p>
                    </div>
                    <div className="space-y-5 relative z-10">
                      {(() => {
                        const benchmarkSustainable = 2.1;  // IPCC AR6 1.5°C compatible
                        const benchmarkGlobalAvg = 4.7;    // World Bank CO2 per capita 2020
                        const maxVal = Math.max(userAnnualVal, benchmarkGlobalAvg, benchmarkSustainable) * 1.1;
                        const userPct = (userAnnualVal / maxVal) * 100;
                        const sustainablePct = (benchmarkSustainable / maxVal) * 100;
                        const globalPct = (benchmarkGlobalAvg / maxVal) * 100;
                        return (
                          <div className="space-y-4">
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs font-semibold">
                                <span className="text-zinc-200">Your annualized footprint</span>
                                <span className={`font-bold ${userAnnualVal <= benchmarkSustainable ? "text-emerald-400" : userAnnualVal <= benchmarkGlobalAvg ? "text-amber-400" : "text-rose-400"}`}>
                                  {userAnnualVal.toFixed(2)} t CO2e/yr
                                </span>
                              </div>
                              <div className="h-2.5 w-full bg-zinc-950/60 rounded-full overflow-hidden border border-zinc-900">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${userAnnualVal <= benchmarkSustainable ? "bg-gradient-to-r from-emerald-500 to-teal-400" : userAnnualVal <= benchmarkGlobalAvg ? "bg-gradient-to-r from-amber-500 to-emerald-400" : "bg-gradient-to-r from-rose-500 to-amber-500"}`}
                                  style={{ width: `${Math.max(userPct, 3)}%` }}
                                  role="progressbar"
                                  aria-valuenow={userAnnualVal}
                                  aria-valuemin={0}
                                  aria-valuemax={maxVal}
                                  aria-label="Your annualized carbon footprint"
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs font-semibold">
                                <span className="text-zinc-300">1.5°C Paris target (IPCC AR6)</span>
                                <span className="text-emerald-400 font-bold">{benchmarkSustainable.toFixed(1)} t/yr</span>
                              </div>
                              <div className="h-2.5 w-full bg-zinc-950/60 rounded-full overflow-hidden border border-zinc-900">
                                <div
                                  className="h-full bg-emerald-500/80 rounded-full"
                                  style={{ width: `${sustainablePct}%` }}
                                  role="progressbar"
                                  aria-valuenow={benchmarkSustainable}
                                  aria-valuemin={0}
                                  aria-valuemax={maxVal}
                                  aria-label="IPCC 1.5°C sustainable target"
                                />
                              </div>
                              <p className="text-[9px] text-zinc-500">2,100 kg CO2e / 365 days = 5.75 kg/day</p>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs font-semibold">
                                <span className="text-zinc-300">Global average (World Bank, CO2)</span>
                                <span className="text-zinc-400 font-bold">{benchmarkGlobalAvg.toFixed(1)} t/yr</span>
                              </div>
                              <div className="h-2.5 w-full bg-zinc-950/60 rounded-full overflow-hidden border border-zinc-900">
                                <div
                                  className="h-full bg-zinc-600 rounded-full"
                                  style={{ width: `${globalPct}%` }}
                                  role="progressbar"
                                  aria-valuenow={benchmarkGlobalAvg}
                                  aria-valuemin={0}
                                  aria-valuemax={maxVal}
                                  aria-label="World Bank global average CO2 per capita"
                                />
                              </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-zinc-900">
                              <div className={`rounded-xl p-3 border text-xs leading-relaxed ${userAnnualVal <= benchmarkSustainable ? "bg-emerald-950/5 border-emerald-900/20 text-emerald-400" : userAnnualVal <= benchmarkGlobalAvg ? "bg-amber-950/5 border-amber-900/20 text-amber-400" : "bg-rose-950/5 border-rose-900/20 text-rose-400"}`}>
                                {userAnnualVal <= benchmarkSustainable
                                  ? <span><strong>Paris aligned:</strong> Your projected footprint is within the 2.1 t/yr target.</span>
                                  : userAnnualVal <= benchmarkGlobalAvg
                                  ? <span><strong>Below global average:</strong> You beat 4.7 t/yr but exceed the 2.1 t/yr target.</span>
                                  : <span><strong>Above global average:</strong> Mode shifts in the simulator can help lower this.</span>
                                }
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Category Breakdown */}
                  <div className="rounded-2xl border border-zinc-900 bg-zinc-900/10 p-6 shadow-xl flex flex-col items-center">
                    <div className="w-full text-left mb-6">
                      <h2 className="text-lg font-bold flex items-center gap-2">
                        <BarChart2 className="h-4 w-4 text-emerald-400" />
                        Category Breakdown
                      </h2>
                      <p className="text-xs text-zinc-500">CO2e share by activity type</p>
                    </div>
                    <div className="relative w-40 h-40 flex items-center justify-center">
                      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90" aria-hidden="true">
                        <circle cx="50" cy="50" r="40" fill="transparent" stroke="#18181b" strokeWidth="8" />
                        {totalCategories > 0 ? (
                          <>
                            <circle cx="50" cy="50" r="40" fill="transparent" stroke="#10b981" strokeWidth="8.5" strokeDasharray={`${2 * Math.PI * 40 * transportPct} ${2 * Math.PI * 40}`} strokeDashoffset="0" strokeLinecap="round" />
                            <circle cx="50" cy="50" r="40" fill="transparent" stroke="#38bdf8" strokeWidth="8.5" strokeDasharray={`${2 * Math.PI * 40 * foodPct} ${2 * Math.PI * 40}`} strokeDashoffset={`-${2 * Math.PI * 40 * transportPct}`} strokeLinecap="round" />
                            <circle cx="50" cy="50" r="40" fill="transparent" stroke="#6366f1" strokeWidth="8.5" strokeDasharray={`${2 * Math.PI * 40 * energyPct} ${2 * Math.PI * 40}`} strokeDashoffset={`-${2 * Math.PI * 40 * (transportPct + foodPct)}`} strokeLinecap="round" />
                          </>
                        ) : (
                          <circle cx="50" cy="50" r="40" fill="transparent" stroke="#27272a" strokeWidth="8" />
                        )}
                      </svg>
                      <div className="sr-only">
                        <p>Transport: {(transportPct * 100).toFixed(0)}%</p>
                        <p>Food: {(foodPct * 100).toFixed(0)}%</p>
                        <p>Energy: {(energyPct * 100).toFixed(0)}%</p>
                      </div>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center" aria-hidden="true">
                        <span className="text-[9px] uppercase font-semibold text-zinc-500 tracking-wider">Total</span>
                        <span className="text-sm font-bold text-zinc-100">{totalCo2e.toFixed(1)} kg</span>
                      </div>
                    </div>
                    <div className="w-full grid grid-cols-3 gap-2 mt-6 border-t border-zinc-900 pt-4">
                      <div className="text-center">
                        <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-zinc-300">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          Transit
                        </div>
                        <p className="text-xs font-bold text-zinc-100 mt-0.5">{(transportPct * 100).toFixed(0)}%</p>
                      </div>
                      <div className="text-center">
                        <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-zinc-300">
                          <span className="h-2 w-2 rounded-full bg-sky-400" />
                          Food
                        </div>
                        <p className="text-xs font-bold text-zinc-100 mt-0.5">{(foodPct * 100).toFixed(0)}%</p>
                      </div>
                      <div className="text-center">
                        <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-zinc-300">
                          <span className="h-2 w-2 rounded-full bg-indigo-500" />
                          Energy
                        </div>
                        <p className="text-xs font-bold text-zinc-100 mt-0.5">{(energyPct * 100).toFixed(0)}%</p>
                      </div>
                    </div>
                  </div>

                  {/* Pledges */}
                  <div className="rounded-2xl border border-zinc-900 bg-zinc-900/10 p-6 shadow-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-bold flex items-center gap-2">
                        <Award className="h-4 w-4 text-emerald-400" />
                        My Pledges
                      </h2>
                      <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider bg-zinc-900 px-2.5 py-0.5 rounded-full border border-zinc-800">
                        {commitments.filter((c) => c.status === "active").length} active
                      </span>
                    </div>
                    {commitments.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/20 p-6 text-center space-y-3">
                        <p className="text-xs text-zinc-400">No reduction commitments yet.</p>
                        <Link href="/simulate" className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700/80 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition">
                          <Sparkles className="h-3 w-3 text-emerald-400" />
                          Open Reduction Lab
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                        {commitments.map((commitment) => (
                          <div
                            key={commitment.id}
                            className={`rounded-xl border p-4 flex flex-col gap-3 transition-all ${commitment.status === "active" ? "border-zinc-800 bg-zinc-950/30" : commitment.status === "completed" ? "border-emerald-950/35 bg-emerald-950/5 opacity-75" : "border-zinc-900 bg-zinc-950/10 opacity-50"}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1">
                                <p className="text-xs font-bold text-zinc-100 leading-tight">{commitment.title}</p>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-400 bg-zinc-900/60 px-1.5 py-0.5 rounded border border-zinc-800">{commitment.category}</span>
                                  <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${commitment.status === "active" ? "text-emerald-400 bg-emerald-500/10" : commitment.status === "completed" ? "text-sky-400 bg-sky-500/10" : "text-zinc-500 bg-zinc-900"}`}>{commitment.status}</span>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-xs font-extrabold text-emerald-400">-{commitment.projected_savings_kg.toFixed(0)} kg</p>
                                <p className="text-[8px] text-zinc-400 uppercase tracking-wider">CO2e / yr</p>
                              </div>
                            </div>
                            {commitment.status === "active" && (
                              <div className="flex items-center gap-2 pt-2 border-t border-zinc-900">
                                <button onClick={() => handleUpdateStatus(commitment.id!, "completed")} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-zinc-950 text-xs font-semibold transition-all cursor-pointer">
                                  <Check className="h-3.5 w-3.5" /> Completed
                                </button>
                                <button onClick={() => handleUpdateStatus(commitment.id!, "abandoned")} className="flex items-center justify-center h-8 w-8 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-red-400 hover:bg-red-500/5 hover:border-red-500/20 transition-all cursor-pointer" title="Abandon pledge">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Transit Mode Breakdown */}
                  {modeBreakdownList.length > 0 && (
                    <div className="rounded-2xl border border-zinc-900 bg-zinc-900/10 p-6 shadow-xl">
                      <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Activity className="h-4 w-4 text-emerald-400" />
                        Transport Modes
                      </h2>
                      <div className="space-y-4">
                        {modeBreakdownList.map((modeData) => {
                          const ModeIcon = modeData.icon;
                          const pct = (modeData.distance / (totalDistance || 1)) * 100;
                          return (
                            <div key={modeData.key} className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs font-medium">
                                <div className="flex items-center gap-2 text-zinc-300">
                                  <ModeIcon className="h-4 w-4 text-emerald-500/70" />
                                  <span>{modeData.label}</span>
                                </div>
                                <span className="text-zinc-400 font-semibold">{modeData.co2e.toFixed(1)} kg CO2e</span>
                              </div>
                              <div className="h-2 w-full bg-zinc-950/60 rounded-full overflow-hidden border border-zinc-900">
                                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500" style={{ width: `${Math.max(pct, 4)}%` }} />
                              </div>
                              <div className="flex justify-between text-[9px] text-zinc-400">
                                <span>{modeData.distance.toFixed(1)} km</span>
                                <span>{pct.toFixed(0)}% of travel</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Methodology Transparency */}
                  <div className="rounded-2xl border border-emerald-950/20 bg-emerald-950/5 p-6 space-y-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-full blur-2xl" />
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-400">
                        <Info className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-emerald-300">Auditable calculations</h3>
                        <p className="text-xs text-zinc-400 leading-relaxed mt-1">
                          Every result comes from a deterministic formula. Factors are from UK
                          DESNZ/DEFRA (2024), India CEA v20.0 (2024), and Poore &amp; Nemecek (2018).
                        </p>
                      </div>
                    </div>
                    <button
                      ref={openButtonRef}
                      onClick={() => setIsMethodologyOpen(true)}
                      className="w-full text-center rounded-xl border border-emerald-800/40 bg-emerald-500/10 py-2.5 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-500/20 cursor-pointer"
                    >
                      View factor citations
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* Methodology Modal */}
      {isMethodologyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setIsMethodologyOpen(false)} className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm cursor-pointer" />
          <div
            ref={modalRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="methodology-title"
            aria-describedby="methodology-desc"
            className="relative w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl z-10 flex flex-col max-h-[85vh] animate-scaleUp focus:outline-none"
          >
            <header className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
              <div>
                <h2 id="methodology-title" className="text-lg font-bold flex items-center gap-2">
                  <Award className="h-5 w-5 text-emerald-400" />
                  Carbon Accounting Methodology
                </h2>
                <p className="text-xs text-zinc-400">Emission factor citations</p>
              </div>
              <button onClick={() => setIsMethodologyOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-zinc-200 transition cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <p id="methodology-desc" className="text-xs text-zinc-400 leading-relaxed">
                All calculations use the formula:{" "}
                <code className="text-[11px] bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800 text-emerald-400">
                  Emissions (kg CO2e) = Activity Amount &times; Factor
                </code>
              </p>
              <div>
                <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">Transport</h3>
                <div className="space-y-2">
                  {CITATION_DATA.map((cit, idx) => (
                    <div key={idx} className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3 flex flex-col gap-1 text-xs">
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-zinc-200">{cit.mode}</span>
                        <span className="text-emerald-400">{cit.factor}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-zinc-500">
                        <span className="max-w-[340px] truncate">{cit.source}</span>
                        <span>{cit.year}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">Food</h3>
                <div className="space-y-2">
                  {FOOD_CITATION_DATA.map((cit, idx) => (
                    <div key={idx} className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3 flex flex-col gap-1 text-xs">
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-zinc-200">{cit.item}</span>
                        <span className="text-emerald-400">{cit.factor}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-zinc-500">
                        <span className="max-w-[340px] truncate">{cit.source}</span>
                        <span>{cit.year}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">Energy</h3>
                <div className="space-y-2">
                  {ENERGY_CITATION_DATA.map((cit, idx) => (
                    <div key={idx} className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3 flex flex-col gap-1 text-xs">
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-zinc-200">{cit.sourceName}</span>
                        <span className="text-emerald-400">{cit.factor}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-zinc-500">
                        <span className="max-w-[340px] truncate">{cit.source}</span>
                        <span>{cit.year}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-emerald-900/20 bg-emerald-950/5 p-4 text-[11px] text-zinc-400 leading-relaxed">
                <span className="font-bold text-emerald-400 block mb-1">Design principle</span>
                Vertex AI Gemini parses natural language and narrates results. It never produces a
                carbon number. All calculations run independently of AI availability.
              </div>
            </div>
            <footer className="border-t border-zinc-800 pt-4 mt-4 flex items-center justify-between">
              <Link href="/methodology" className="text-xs text-emerald-400 hover:text-emerald-300 transition" onClick={() => setIsMethodologyOpen(false)}>
                Full methodology page
              </Link>
              <button onClick={() => setIsMethodologyOpen(false)} className="rounded-xl bg-zinc-800 px-5 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 transition cursor-pointer">
                Close
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
