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
      <aside className="surface-sidebar border-r p-5 lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:p-6">
        <Link href="/dashboard" className="block rounded-2xl">
          <BrandLogo textClassName="text-xl" />
        </Link>
        <div className="panel mt-6 p-4">
          <p className="eyebrow">Selected cluster</p>
          <h2 className="mt-3 break-words text-lg font-semibold text-[var(--text)]">{cluster?.name || "Loading cluster..."}</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{cluster?.provider || "Kubernetes cluster"}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={statusTone}>
              {cluster?.status || "loading"}
            </span>
            {cluster?.last_seen_at && (
              <span className="text-xs text-[var(--text-soft)]">Last seen {new Date(cluster.last_seen_at).toLocaleString()}</span>
            )}
          </div>
          {error && <p className="mt-3 text-sm text-[var(--danger-text)]">{error}</p>}
        </div>
        <nav className="mt-8 space-y-1.5">
          {nav.map((item) => {
            const href = `/dashboard/clusters/${clusterId}/${item.href}`;
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={item.href}
                href={href}
                className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-[var(--primary-soft)] text-[var(--primary)] shadow-sm ring-1 ring-[var(--primary-ring)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-8 flex items-center gap-3">
          <ThemeToggle />
          <div className="panel-subtle flex-1 px-3 py-2 text-sm text-[var(--text-muted)]">
            Investigate incidents, limits, and AI guidance without leaving cluster context.
          </div>
        </div>
      </aside>
      <div className="flex-1">
        <header className="surface-topbar border-b px-6 py-4 lg:px-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link href="/dashboard" className="text-sm font-medium text-[var(--primary)] hover:opacity-80">
                Back to Onboarding
              </Link>
              <p className="mt-2 text-sm text-[var(--text-muted)]">Cluster operations workspace</p>
            </div>
            <div className="text-sm text-[var(--text-muted)]">
              {cluster?.name ? `Working in ${cluster.name}` : "Loading cluster context..."}
            </div>
          </div>
        </header>
        <main className="p-6 lg:p-10">{children}</main>
      </div>
    </div>
  );
}
