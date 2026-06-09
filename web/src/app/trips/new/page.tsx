"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bike,
  Bus,
  Car,
  Footprints,
  Info,
  MapPin,
  Navigation,
  Train,
  CheckCircle,
} from "lucide-react";
import Script from "next/script";

import { useAuth } from "@/lib/auth-context";

// Pinned Emission Factor multipliers from factors.py to compute preview footprint client-side
const TRANSPORT_FACTORS: Record<string, { value: number; label: string; source: string; year: number }> = {
  petrol_car: {
    value: 0.16489,
    label: "Petrol Car",
    source: "UK DESNZ/DEFRA Greenhouse Gas Conversion Factors",
    year: 2024,
  },
  diesel_car: {
    value: 0.16398,
    label: "Diesel Car",
    source: "UK DESNZ/DEFRA Greenhouse Gas Conversion Factors",
    year: 2024,
  },
  ev_car: {
    value: 0.04690,
    label: "Electric Vehicle (EV)",
    source: "UK DESNZ/DEFRA Greenhouse Gas Conversion Factors",
    year: 2024,
  },
  hybrid_car: {
    value: 0.11500,
    label: "Hybrid Car",
    source: "UK DESNZ/DEFRA Greenhouse Gas Conversion Factors",
    year: 2024,
  },
  motorbike: {
    value: 0.11327,
    label: "Motorbike / Two-wheeler",
    source: "UK DESNZ/DEFRA Greenhouse Gas Conversion Factors",
    year: 2024,
  },
  bus: {
    value: 0.09658,
    label: "Public Bus",
    source: "UK DESNZ/DEFRA Greenhouse Gas Conversion Factors",
    year: 2024,
  },
  train: {
    value: 0.03549,
    label: "Passenger Train",
    source: "UK DESNZ/DEFRA Greenhouse Gas Conversion Factors",
    year: 2024,
  },
  metro: {
    value: 0.02781,
    label: "Metro / Light Rail",
    source: "UK DESNZ/DEFRA Greenhouse Gas Conversion Factors",
    year: 2024,
  },
  bicycle: {
    value: 0.0,
    label: "Bicycle",
    source: "Self-evident",
    year: 2026,
  },
  walking: {
    value: 0.0,
    label: "Walking",
    source: "Self-evident",
    year: 2026,
  },
};

export default function LogTripPage() {
  const router = useRouter();
  const { user, loading, apiFetch } = useAuth();

  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [mode, setMode] = useState("petrol_car");
  const [distanceKm, setDistanceKm] = useState<number | null>(null);

  const [isCalculating, setIsCalculating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const originInputRef = useRef<HTMLInputElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);




  // Recalculate carbon footprint client-side when distance or mode changes
  const co2eKg = (distanceKm !== null && distanceKm > 0)
    ? distanceKm * (TRANSPORT_FACTORS[mode]?.value ?? 0)
    : null;

  // Hook up Google Places Autocomplete on script load
  const initAutocomplete = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    if (typeof window === "undefined" || !win.google) return;

    try {
      if (originInputRef.current) {
        const originAutocomplete = new win.google.maps.places.Autocomplete(originInputRef.current, {
          types: ["geocode", "establishment"],
        });
        originAutocomplete.addListener("place_changed", () => {
          const place = originAutocomplete.getPlace();
          if (place.formatted_address) {
            setOrigin(place.formatted_address);
          } else if (place.name) {
            setOrigin(place.name);
          }
        });
      }

      if (destInputRef.current) {
        const destAutocomplete = new win.google.maps.places.Autocomplete(destInputRef.current, {
          types: ["geocode", "establishment"],
        });
        destAutocomplete.addListener("place_changed", () => {
          const place = destAutocomplete.getPlace();
          if (place.formatted_address) {
            setDestination(place.formatted_address);
          } else if (place.name) {
            setDestination(place.name);
          }
        });
      }
    } catch (err) {
      console.warn("Failed to initialize Google Maps Autocomplete:", err);
    }
  };

  const handleCalculateDistance = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!origin || !destination) {
      setErrorMsg("Please enter both origin and destination.");
      return;
    }

    setIsCalculating(true);
    try {
      // Query the backend distance matrix helper
      const res = await apiFetch<{ distance_km: number }>(
        `/trips/distance?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`
      );
      setDistanceKm(res.distance_km);
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Failed to calculate distance. Proceeding with fallback.";
      setErrorMsg(msg);
      // Fallback distance to prevent blockages
      setDistanceKm(12.5);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSaveTrip = async () => {
    if (distanceKm === null || co2eKg === null) return;

    setIsSaving(true);
    setErrorMsg("");
    try {
      await apiFetch("/trips", {
        method: "POST",
        body: JSON.stringify({
          origin,
          destination,
          distance_km: distanceKm,
          mode,
        }),
      });
      setSaveSuccess(true);
      setTimeout(() => {
        router.push("/");
      }, 1500);
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Failed to save trip. Please try again.";
      setErrorMsg(msg);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  const selectedFactor = TRANSPORT_FACTORS[mode];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col">
      {/* Script Loader for Google Maps JS */}
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${
          process.env.NEXT_PUBLIC_MAPS_JS_API_KEY || ""
        }&libraries=places`}
        onLoad={initAutocomplete}
        strategy="afterInteractive"
      />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Log Travel Trip</h1>
            <p className="text-xs text-zinc-400">Add a journey and calculate its carbon equivalent</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form Panel */}
        <section className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 shadow-xl backdrop-blur-xl">
            {errorMsg && (
              <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
                {errorMsg}
              </div>
            )}

            {saveSuccess ? (
              <div className="flex flex-col items-center justify-center py-8 text-center space-y-4 animate-scaleUp">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold">Trip Logged Successfully!</h3>
                <p className="text-sm text-zinc-400">Redirecting to your dashboard...</p>
              </div>
            ) : (
              <form onSubmit={handleCalculateDistance} className="space-y-6">
                {/* Locations */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      Origin Place
                    </label>
                    <div className="relative">
                      <MapPin className="absolute top-1/2 left-3.5 h-4.5 w-4.5 -translate-y-1/2 text-zinc-500" />
                      <input
                        ref={originInputRef}
                        type="text"
                        placeholder="Enter starting address or city..."
                        value={origin}
                        onChange={(e) => {
                          setOrigin(e.target.value);
                          setDistanceKm(null);
                        }}
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950/50 py-2.5 pl-11 pr-4 text-sm text-zinc-100 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      Destination Place
                    </label>
                    <div className="relative">
                      <Navigation className="absolute top-1/2 left-3.5 h-4.5 w-4.5 -translate-y-1/2 text-zinc-500" />
                      <input
                        ref={destInputRef}
                        type="text"
                        placeholder="Enter ending address or city..."
                        value={destination}
                        onChange={(e) => {
                          setDestination(e.target.value);
                          setDistanceKm(null);
                        }}
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950/50 py-2.5 pl-11 pr-4 text-sm text-zinc-100 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Transport Mode */}
                <div className="space-y-2.5">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Transport Mode
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: "petrol_car", label: "Petrol Car", icon: Car },
                      { key: "diesel_car", label: "Diesel Car", icon: Car },
                      { key: "ev_car", label: "EV Car", icon: Car },
                      { key: "hybrid_car", label: "Hybrid", icon: Car },
                      { key: "motorbike", label: "Motorbike", icon: Bike },
                      { key: "bus", label: "Bus", icon: Bus },
                      { key: "train", label: "Train", icon: Train },
                      { key: "metro", label: "Metro", icon: Train },
                      { key: "bicycle", label: "Bicycle", icon: Bike },
                      { key: "walking", label: "Walking", icon: Footprints },
                    ].map((opt) => {
                      const Icon = opt.icon;
                      const active = mode === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setMode(opt.key)}
                          className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition cursor-pointer text-left ${
                            active
                              ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                              : "border-zinc-800 bg-zinc-950/40 text-zinc-300 hover:bg-zinc-900 hover:border-zinc-700"
                          }`}
                        >
                          <Icon className={`h-5 w-5 ${active ? "text-emerald-400" : "text-zinc-500"}`} />
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Fetch Distance Button */}
                {distanceKm === null && (
                  <button
                    type="submit"
                    disabled={isCalculating}
                    className="flex w-full items-center justify-center rounded-xl bg-emerald-600 py-3.5 text-sm font-semibold text-zinc-50 transition hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-lg shadow-emerald-700/10"
                  >
                    {isCalculating ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-50 border-t-transparent" />
                    ) : (
                      "Calculate Distance & Carbon"
                    )}
                  </button>
                )}
              </form>
            )}

            {/* Calculations Preview & Save */}
            {!saveSuccess && distanceKm !== null && co2eKg !== null && (
              <div className="mt-6 pt-6 border-t border-zinc-800/80 space-y-6 animate-fadeIn">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-950/40 border border-zinc-800 rounded-xl p-4 text-center">
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Distance</p>
                    <p className="mt-1 text-2xl font-bold text-zinc-100">{distanceKm.toFixed(1)} km</p>
                  </div>
                  <div className="bg-zinc-950/40 border border-zinc-800 rounded-xl p-4 text-center">
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Emissions</p>
                    <p className="mt-1 text-2xl font-bold text-emerald-400">{co2eKg.toFixed(2)} kg</p>
                  </div>
                </div>

                {/* Transparency panel */}
                {selectedFactor && (
                  <div className="rounded-xl border border-emerald-900/20 bg-emerald-950/5 p-4 text-xs space-y-2 text-zinc-400 leading-relaxed">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-1">
                      <Info className="h-4 w-4" />
                      <span>Accounting Methodology</span>
                    </div>
                    <p>
                      We calculate travel emissions using driving distance times a deterministic mode-specific lifecycle conversion factor.
                    </p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-1.5 text-[11px] border-t border-zinc-800/60 mt-1.5">
                      <div>
                        <span className="text-zinc-500">Factor: </span>
                        <span className="text-zinc-300 font-medium">{selectedFactor.value.toFixed(5)} kg CO2e/km</span>
                      </div>
                      <div>
                        <span className="text-zinc-500">Year: </span>
                        <span className="text-zinc-300 font-medium">{selectedFactor.year}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-zinc-500">Source: </span>
                        <span className="text-zinc-300 font-medium block leading-snug">{selectedFactor.source}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Save Trip and Recalculate Buttons */}
                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      setDistanceKm(null);
                    }}
                    type="button"
                    className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950/40 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-900 cursor-pointer text-center"
                  >
                    Edit Route
                  </button>
                  <button
                    onClick={handleSaveTrip}
                    disabled={isSaving}
                    type="button"
                    className="flex-1 flex items-center justify-center rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-zinc-50 transition hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-lg shadow-emerald-700/10"
                  >
                    {isSaving ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-50 border-t-transparent" />
                    ) : (
                      "Save Trip Log"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Map Visual Fallback / Path Simulator */}
        <section className="lg:col-span-7 flex flex-col">
          <div className="flex-1 min-h-[400px] lg:min-h-0 rounded-2xl border border-zinc-800 bg-zinc-900/25 relative overflow-hidden flex flex-col justify-center items-center p-8">
            {/* Custom Glowing Grid Map Vector Simulator */}
            <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />

            {/* Glowing nodes representation */}
            <div className="z-10 flex flex-col items-center justify-center text-center max-w-sm space-y-6">
              <div className="relative flex items-center justify-between w-64 h-20 mb-4">
                {/* Glowing connection pathway */}
                <div className="absolute top-1/2 left-0 right-0 h-[2px] -translate-y-1/2 bg-zinc-800 overflow-hidden">
                  {distanceKm !== null && (
                    <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-laserRoute" />
                  )}
                </div>

                {/* Node A (Origin) */}
                <div className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border shadow-lg transition duration-500 ${
                  origin ? "border-emerald-500 bg-emerald-500/20 text-emerald-400" : "border-zinc-800 bg-zinc-950 text-zinc-600"
                }`}>
                  <MapPin className="h-5 w-5" />
                  {origin && (
                    <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-zinc-400 max-w-[100px] overflow-hidden text-ellipsis">
                      {origin.split(",")[0]}
                    </span>
                  )}
                </div>

                {/* Node B (Destination) */}
                <div className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border shadow-lg transition duration-500 ${
                  destination ? "border-emerald-500 bg-emerald-500/20 text-emerald-400" : "border-zinc-800 bg-zinc-950 text-zinc-600"
                }`}>
                  <Navigation className="h-4 w-4 rotate-45" />
                  {destination && (
                    <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-zinc-400 max-w-[100px] overflow-hidden text-ellipsis">
                      {destination.split(",")[0]}
                    </span>
                  )}
                </div>
              </div>

              {origin && destination ? (
                <div className="space-y-2 animate-fadeIn">
                  <h3 className="font-bold text-zinc-200">Route Map Simulator</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    Calculating route path from <span className="text-zinc-300">{origin.split(",")[0]}</span> to{" "}
                    <span className="text-zinc-300">{destination.split(",")[0]}</span>.
                  </p>
                  {distanceKm !== null && (
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-400">
                      <span>Interactive Path Active</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <h3 className="font-bold text-zinc-400">Active Routing Canvas</h3>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    Please enter starting and ending addresses on the form to view the driving route details.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Styled Grid for Canvas background */}
      <style jsx global>{`
        .bg-grid-pattern {
          background-size: 30px 30px;
          background-image: 
            linear-gradient(to right, #27272a 1px, transparent 1px),
            linear-gradient(to bottom, #27272a 1px, transparent 1px);
          width: 100%;
          height: 100%;
        }
        @keyframes laserRoute {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        .animate-laserRoute {
          animation: laserRoute 2.5s infinite linear;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease forwards;
        }
        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-scaleUp {
          animation: scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
