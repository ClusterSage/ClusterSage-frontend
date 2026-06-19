"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Cluster } from "@/types/api";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

const nav = [
  { href: "dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "limits", label: "Limits", icon: "limits" },
  { href: "incidents", label: "Incidents", icon: "incidents" },
  { href: "resources", label: "Resources", icon: "resources" },
  { href: "ai", label: "AI", icon: "ai" },
];

function NavIcon({ kind }: { kind: (typeof nav)[number]["icon"] }) {
  switch (kind) {
    case "limits":
      return (
        <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M5 7h14M5 12h10M5 17h6" strokeLinecap="round" />
          <circle cx="17" cy="12" r="2" />
        </svg>
      );
    case "incidents":
      return (
        <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6l-7-3Z" strokeLinejoin="round" />
          <path d="M12 8v4M12 15h.01" strokeLinecap="round" />
        </svg>
      );
    case "resources":
      return (
        <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M4 7.5 12 4l8 3.5-8 3.5L4 7.5Z" strokeLinejoin="round" />
          <path d="M4 12l8 3.5 8-3.5M4 16.5 12 20l8-3.5" strokeLinejoin="round" />
        </svg>
      );
    case "ai":
      return (
        <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" strokeLinejoin="round" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M4 12h6v8H4zM14 4h6v16h-6z" />
        </svg>
      );
  }
}

export function ClusterShell({ clusterId, children }: { clusterId: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [cluster, setCluster] = useState<Cluster | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Cluster>(`/api/clusters/${clusterId}`).then(setCluster).catch((e) => setError(e.message));
  }, [clusterId]);

  const statusTone = useMemo(() => {
    const status = (cluster?.status || "").toLowerCase();
    if (status === "connected" || status === "healthy") return "status-chip status-chip-success";
    if (status === "pending") return "status-chip status-chip-warning";
    return "status-chip status-chip-muted";
  }, [cluster?.status]);

  return (
    <div className="min-h-screen lg:flex">
      <aside className="surface-sidebar border-r px-4 py-4 lg:sticky lg:top-0 lg:h-screen lg:w-[208px] lg:px-4 lg:py-4">
        <Link href="/dashboard" className="block rounded-xl px-2 py-1.5">
          <BrandLogo markClassName="h-9 w-9 rounded-xl" textClassName="text-[1.05rem]" />
        </Link>
        <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)]/88 p-3 shadow-[var(--shadow-sm)]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">Cluster</p>
            <span className={statusTone}>{cluster?.status || "loading"}</span>
          </div>
          <h2 className="mt-2 truncate text-sm font-semibold text-[var(--text)]">{cluster?.name || "Loading cluster..."}</h2>
          <p className="mt-1 truncate text-xs text-[var(--text-soft)]">{cluster?.provider || "Cluster"}</p>
          {error && <p className="mt-3 text-sm text-[var(--danger-text)]">{error}</p>}
        </div>
        <nav className="mt-6 space-y-1.5">
          {nav.map((item) => {
            const href = `/dashboard/clusters/${clusterId}/${item.href}`;
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={item.href}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-[var(--primary-soft)] text-[var(--primary)] shadow-sm ring-1 ring-[var(--primary-ring)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]"
                }`}
              >
                <span className="shrink-0"><NavIcon kind={item.icon} /></span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-6 border-t border-[var(--border)] pt-4">
          <ThemeToggle />
        </div>
      </aside>
      <div className="flex-1">
        <header className="surface-topbar border-b px-5 py-2.5 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link href="/dashboard/clusters" className="btn-ghost h-9 rounded-xl px-2.5 py-1.5 text-xs">
                <span aria-hidden="true">←</span>
              </Link>
              <div className="min-w-0">
                <p className="dashboard-shell-meta">Cluster operations</p>
                <p className="truncate text-sm font-medium text-[var(--text)]">{cluster?.name || "Cluster"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--text-soft)]">
              <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1">{cluster?.provider || "Cluster"}</span>
              <span className={statusTone}>
                {cluster?.status || "loading"}
              </span>
              <div className="lg:hidden">
                <ThemeToggle compact />
              </div>
            </div>
          </div>
        </header>
        <main className="p-5 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
