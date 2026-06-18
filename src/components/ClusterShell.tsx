"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Cluster } from "@/types/api";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

const nav = [
  { href: "dashboard", label: "Dashboard" },
  { href: "limits", label: "Limits" },
  { href: "incidents", label: "Incidents" },
  { href: "resources", label: "Resources" },
  { href: "ai", label: "ClusterSage AI" },
];

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
      <aside className="surface-sidebar border-r p-4 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:p-5">
        <Link href="/dashboard" className="block rounded-2xl">
          <BrandLogo textClassName="text-lg" />
        </Link>
        <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 shadow-[var(--shadow-sm)]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">Cluster</p>
              <h2 className="mt-2 truncate text-base font-semibold text-[var(--text)]">{cluster?.name || "Loading cluster..."}</h2>
              <p className="mt-1 text-xs text-[var(--text-soft)]">{cluster?.provider || "Cluster"}</p>
            </div>
            <span className={statusTone}>
              {cluster?.status || "loading"}
            </span>
          </div>
          {error && <p className="mt-3 text-sm text-[var(--danger-text)]">{error}</p>}
        </div>
        <nav className="mt-6 space-y-1">
          {nav.map((item) => {
            const href = `/dashboard/clusters/${clusterId}/${item.href}`;
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={item.href}
                href={href}
                className={`block rounded-xl px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-[var(--primary-soft)] text-[var(--primary)] shadow-sm ring-1 ring-[var(--primary-ring)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]"
                }`}
              >
                <span className="text-xs font-semibold uppercase tracking-[0.16em]">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-6">
          <ThemeToggle />
        </div>
      </aside>
      <div className="flex-1">
        <header className="surface-topbar border-b px-5 py-3 lg:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link href="/dashboard" className="btn-ghost px-2 py-1.5 text-xs">
                Back
              </Link>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--text)]">{cluster?.name || "Cluster"}</p>
                <p className="text-xs text-[var(--text-soft)]">{cluster?.provider || "Cluster"}</p>
              </div>
            </div>
          </div>
        </header>
        <main className="p-5 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
