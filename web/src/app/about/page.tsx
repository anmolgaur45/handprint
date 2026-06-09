import Link from "next/link";
import { ArrowLeft, Leaf } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — Handprint",
  description:
    "What Handprint does, how it calculates emissions, and the role of AI in the product.",
};

export default function AboutPage() {
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

      <main id="main-content" tabIndex={-1} className="max-w-2xl mx-auto px-6 py-16 space-y-12 focus:outline-none">
        <div>
          <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-3">About</p>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-50 font-[family-name:var(--font-sora)]">About Handprint</h1>
          <p className="mt-4 text-zinc-400 leading-relaxed">
            Handprint is a personal carbon footprint tracker built to give you specific, traceable
            numbers rather than vague categories. The goal is awareness: to show you exactly which
            activities cost the most CO2e and how much a concrete change would save.
          </p>
        </div>

        <section aria-labelledby="what-it-tracks">
          <h2 id="what-it-tracks" className="text-lg font-bold text-zinc-100 mb-4">What it tracks</h2>
          <div className="space-y-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
              <p className="text-sm font-semibold text-zinc-100">Transport</p>
              <p className="text-sm text-zinc-400 mt-1">
                Distance by mode: petrol car, diesel car, electric vehicle, hybrid car, motorbike,
                bus, train, metro, bicycle, and walking. Input unit: km.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
              <p className="text-sm font-semibold text-zinc-100">Food</p>
              <p className="text-sm text-zinc-400 mt-1">
                Weight of 10 common items: beef, farmed fish, pork, chicken, eggs, rice, milk,
                wheat and rye, vegetables (average), and fruit (average). Input unit: kg.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
              <p className="text-sm font-semibold text-zinc-100">Home Energy</p>
              <p className="text-sm text-zinc-400 mt-1">
                Indian grid electricity and LPG cooking fuel. Input units: kWh for electricity,
                kg for LPG.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="how-it-calculates">
          <h2 id="how-it-calculates" className="text-lg font-bold text-zinc-100 mb-4">How it calculates</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Every result comes from one formula:
          </p>
          <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 font-mono text-sm text-emerald-400">
            Emissions (kg CO2e) = Activity Amount &times; Emission Factor
          </div>
          <p className="mt-4 text-sm text-zinc-400 leading-relaxed">
            The factors are loaded from a static, versioned table in the application code. They
            do not change between sessions and cannot be overridden by AI. The same input always
            produces the same output.
          </p>
          <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
            Factors come from three sources: UK DESNZ/DEFRA Greenhouse Gas Conversion Factors
            (2024 edition) for transport and LPG; the India Central Electricity Authority CO2
            Baseline Database v20.0 (2024) for electricity; and Poore &amp; Nemecek (2018) via Our
            World in Data for food lifecycle emissions.
          </p>
        </section>

        <section aria-labelledby="role-of-ai">
          <h2 id="role-of-ai" className="text-lg font-bold text-zinc-100 mb-4">The role of AI</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Handprint uses Vertex AI Gemini for two things only: parsing natural-language trip
            descriptions and generating a narrative summary of your footprint on the dashboard.
            Gemini never produces a carbon number. All calculations run independently of AI
            availability.
          </p>
          <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
            If the Vertex AI service is unavailable, Handprint falls back to a rule-based
            narrative. Logging, calculation, and display continue to work normally.
          </p>
        </section>

        <section aria-labelledby="scope-limits">
          <h2 id="scope-limits" className="text-lg font-bold text-zinc-100 mb-4">Scope and limits</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Handprint covers direct emissions from personal travel, home energy use, and dietary
            choices. It does not cover aviation and international shipping, embodied carbon in
            goods and services, capital goods and infrastructure, or upstream emissions outside
            the selected lifecycle scope.
          </p>
          <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
            These exclusions mean Handprint likely underestimates a complete personal footprint.
            Results are educational estimates. This is not a certified carbon audit.
          </p>
        </section>

        <section aria-labelledby="paris-target">
          <h2 id="paris-target" className="text-lg font-bold text-zinc-100 mb-4">The 1.5°C target</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            The daily budget shown in Handprint (5.75 kg CO2e/day) is derived from the IPCC AR6
            1.5°C-compatible per-capita pathway of 2,100 kg CO2e per year, divided by 365 days.
          </p>
        </section>

        <footer className="border-t border-zinc-900 pt-8 flex flex-wrap gap-4 text-xs text-zinc-500">
          <Link href="/" className="hover:text-zinc-300 transition">Home</Link>
          <Link href="/methodology" className="hover:text-zinc-300 transition">Methodology</Link>
          <Link href="/dashboard" className="hover:text-zinc-300 transition">Dashboard</Link>
        </footer>
      </main>
    </div>
  );
}
