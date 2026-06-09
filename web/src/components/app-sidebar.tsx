"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gauge, LayoutDashboard, Leaf, LogOut, PlusCircle } from "lucide-react";

import { useAuth } from "@/lib/auth-context";

const NAV_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard"    },
  { href: "/trips/new", icon: PlusCircle,      label: "Log activity" },
  { href: "/simulate",  icon: Gauge,           label: "Simulator"    },
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside
      className="w-56 shrink-0 flex flex-col border-r border-zinc-800 bg-zinc-950 sticky top-0 h-screen z-30"
      aria-label="Application navigation"
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-zinc-800">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-500/30">
          <Leaf className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
        </div>
        <span className="font-bold text-sm text-zinc-50 tracking-tight">Handprint</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label="Main navigation">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                active
                  ? "bg-zinc-800 text-zinc-50"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${active ? "text-emerald-400" : "text-zinc-500"}`}
                aria-hidden="true"
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-zinc-800 p-4">
        {user ? (
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-zinc-300"
              aria-hidden="true"
            >
              {user.isAnonymous ? "G" : (user.email?.[0] ?? "U").toUpperCase()}
            </div>
            <p className="flex-1 truncate text-xs text-zinc-400">
              {user.isAnonymous ? "Guest" : user.email}
            </p>
            <button
              type="button"
              onClick={logout}
              aria-label="Sign out"
              className="text-zinc-600 hover:text-zinc-300 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="text-xs font-medium text-emerald-400 hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
          >
            Sign in
          </Link>
        )}
      </div>
    </aside>
  );
}
