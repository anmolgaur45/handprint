import Link from "next/link";
import {
  Apple,
  ArrowRight,
  BookOpen,
  Car,
  FileText,
  Leaf,
  Sigma,
  Sparkles,
  Zap,
} from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Handprint — Carbon Footprint Tracker",
  description:
    "Track your travel, food, and home energy carbon footprint using peer-reviewed emission factors from DEFRA, India CEA, and Poore & Nemecek.",
};

// All numbers below are directly traceable to api/app/domain/factors.py
// 10 transport + 10 food + 2 energy = 22 emission factors
// Sources: UK DESNZ/DEFRA 2024, India CEA v20.0 2024, Poore & Nemecek 2018
// Daily budget: IPCC AR6 1.5°C pathway = 2100 kg/year = 5.75 kg/day

const STATS = [
  {
    value: "22",
    label: "emission factors",
    detail: "10 transport modes, 10 foods, 2 energy sources",
  },
  {
    value: "3",
    label: "cited sources",
    detail: "UK DESNZ/DEFRA, India CEA, Poore & Nemecek",
  },
  {
    value: "5.75 kg",
    label: "daily CO2e budget",
    detail: "IPCC AR6 1.5°C compatible per-capita target",
  },
  {
    value: "0",
    label: "AI-computed numbers",
    detail: "All calculations run deterministically in code",
  },
];

const CATEGORIES = [
  {
    icon: Car,
    title: "Transport",
    badge: "input: km",
    description:
      "10 modes: petrol car, diesel car, EV, hybrid, motorbike, bus, train, metro, bicycle, and walking. Factors from UK DESNZ/DEFRA 2024.",
  },
  {
    icon: Apple,
    title: "Food",
    badge: "input: kg",
    description:
      "10 items from beef to fruit. Full lifecycle emissions from Poore & Nemecek (2018) via Our World in Data, global average per food type.",
  },
  {
    icon: Zap,
    title: "Home Energy",
    badge: "input: kWh or kg",
    description:
      "Indian grid electricity (0.727 kg CO2e/kWh, India CEA v20.0) and LPG cooking fuel (2.939 kg CO2e/kg, UK DESNZ/DEFRA 2024).",
  },
];

const STEPS = [
  {
    number: "1",
    title: "Log",
    description:
      "Enter a distance, food weight, or energy amount. Select your mode or item from the list.",
  },
  {
    number: "2",
    title: "See",
    description:
      "Handprint applies the pinned emission factor and shows your CO2e. The formula is: Activity Amount x Emission Factor.",
  },
  {
    number: "3",
    title: "Act",
    description:
      "Compare your annualized footprint to the 1.5°C Paris target. Run scenarios in the simulator. Commit to a specific reduction.",
  },
];

const TRUST = [
  {
    icon: Sigma,
    title: "Deterministic calculations",
    description:
      "Every carbon number comes from a formula, not a model. A petrol car driven 50 km always produces 0.16489 x 50 = 8.24 kg CO2e. The result is the same whether or not AI responds.",
  },
  {
    icon: BookOpen,
    title: "Three authoritative sources",
    description:
      "Transport and LPG from UK DESNZ/DEFRA 2024. Indian electricity from CEA Baseline Database v20.0 (2024). Food from Poore & Nemecek (2018) via Our World in Data.",
  },
  {
    icon: FileText,
    title: "Transparent methodology",
    description:
      "Every factor is published with its source and year. The methodology page explains the assumptions, scope, and what this estimate does and does not cover.",
  },
  {
    icon: Sparkles,
    title: "AI as narrator only",
    description:
      "Vertex AI Gemini interprets your text input and explains your results. It never produces a carbon figure. Calculations run without AI and fall back gracefully if the service is unavailable.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans flex flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-zinc-900 bg-zinc-950/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-500/30">
              <Leaf className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            </div>
            <span className="font-bold text-base text-zinc-50 tracking-tight font-[family-name:var(--font-sora)]">Handprint</span>
          </div>
          <nav aria-label="Site navigation" className="flex items-center gap-2">
            <Link
              href="/methodology"
              className="text-sm font-medium text-zinc-400 hover:text-zinc-200 transition px-3 py-1.5 rounded-lg hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              Methodology
            </Link>
            <Link
              href="/about"
              className="text-sm font-medium text-zinc-400 hover:text-zinc-200 transition px-3 py-1.5 rounded-lg hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              About
            </Link>
            <Link
              href="/dashboard"
              className="text-sm font-semibold bg-emerald-500 text-zinc-950 hover:bg-emerald-400 transition px-4 py-2 rounded-lg shadow shadow-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {/* Hero */}
        <section
          aria-labelledby="hero-heading"
          className="relative overflow-hidden px-6 py-24 md:py-32 flex flex-col items-center text-center"
        >
          <div
            className="absolute inset-0 pointer-events-none"
            aria-hidden="true"
          >
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-emerald-500/8 blur-3xl" />
            <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-teal-500/5 blur-3xl" />
          </div>

          <div className="relative max-w-3xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
              22 emission factors. 3 cited sources. 0 fabricated values.
            </div>

            <h1
              id="hero-heading"
              className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-zinc-50 leading-tight font-[family-name:var(--font-sora)]"
            >
              Track your carbon footprint.
            </h1>

            <p className="text-lg text-zinc-400 leading-relaxed max-w-xl mx-auto">
              Log travel, food, and home energy. Handprint calculates your CO2e from
              peer-reviewed emission factors. Every number is traceable to its source.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-zinc-950 hover:bg-emerald-400 transition active:scale-[0.98] shadow-lg shadow-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                Open Dashboard
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/methodology"
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 px-6 py-3 text-sm font-medium text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                Read the methodology
              </Link>
            </div>
          </div>
        </section>

        {/* Category cards */}
        <section aria-labelledby="categories-heading" className="px-6 py-16 bg-zinc-900/20 border-t border-b border-zinc-900">
          <div className="max-w-5xl mx-auto">
            <h2 id="categories-heading" className="text-xs font-semibold text-zinc-500 uppercase tracking-widest text-center mb-10">
              Three categories, real emission factors
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {CATEGORIES.map(({ icon: Icon, title, badge, description }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6 flex flex-col gap-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-full">
                      {badge}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-zinc-100">{title}</h3>
                    <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stat row */}
        <section aria-labelledby="stats-heading" className="px-6 py-16">
          <div className="max-w-5xl mx-auto">
            <h2 id="stats-heading" className="sr-only">Key facts about Handprint</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {STATS.map(({ value, label, detail }) => (
                <div key={label} className="text-center space-y-1">
                  <p className="text-3xl font-extrabold tracking-tight text-emerald-400">{value}</p>
                  <p className="text-sm font-semibold text-zinc-200">{label}</p>
                  <p className="text-[11px] text-zinc-500 leading-snug">{detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section
          aria-labelledby="steps-heading"
          className="px-6 py-16 bg-zinc-900/20 border-t border-b border-zinc-900"
        >
          <div className="max-w-4xl mx-auto">
            <h2 id="steps-heading" className="text-2xl font-bold text-zinc-50 text-center mb-12">
              How it works
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {STEPS.map(({ number, title, description }) => (
                <div key={number} className="flex flex-col gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-bold text-sm">
                    {number}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-zinc-100">{title}</h3>
                    <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trust section */}
        <section aria-labelledby="trust-heading" className="px-6 py-16">
          <div className="max-w-5xl mx-auto">
            <h2 id="trust-heading" className="text-2xl font-bold text-zinc-50 text-center mb-3">
              Why the numbers are reliable
            </h2>
            <p className="text-sm text-zinc-400 text-center mb-12 max-w-xl mx-auto">
              The calculation engine is deterministic code. Emission factors are pinned from
              government and academic sources and cannot be overridden.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {TRUST.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 flex gap-4"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-100">{title}</h3>
                    <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA strip */}
        <section
          aria-labelledby="cta-heading"
          className="px-6 py-16 bg-zinc-900/20 border-t border-zinc-900 text-center"
        >
          <div className="max-w-lg mx-auto space-y-6">
            <h2 id="cta-heading" className="text-2xl font-bold text-zinc-50">
              Start tracking today.
            </h2>
            <p className="text-sm text-zinc-400">
              No sign-up required. Start logging as a guest and create an account to save your
              data across devices.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-8 py-3.5 text-sm font-bold text-zinc-950 hover:bg-emerald-400 transition active:scale-[0.98] shadow-lg shadow-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              Open Dashboard
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 px-6 py-8 bg-zinc-950">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500/20">
              <Leaf className="h-3 w-3 text-emerald-400" aria-hidden="true" />
            </div>
            <span className="text-xs font-bold text-zinc-400">Handprint</span>
          </div>
          <nav aria-label="Footer navigation" className="flex items-center gap-5">
            <Link href="/methodology" className="text-xs text-zinc-500 hover:text-zinc-300 transition">
              Methodology
            </Link>
            <Link href="/about" className="text-xs text-zinc-500 hover:text-zinc-300 transition">
              About
            </Link>
            <Link href="/dashboard" className="text-xs text-zinc-500 hover:text-zinc-300 transition">
              Dashboard
            </Link>
          </nav>
          <p className="text-[11px] text-zinc-600 text-center sm:text-right max-w-xs">
            Educational estimates. Not a certified carbon audit.
          </p>
        </div>
      </footer>
    </div>
  );
}
