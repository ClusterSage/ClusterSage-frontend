"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Cluster } from "@/types/api";
import { BrandLogo } from "@/components/BrandLogo";

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
    if (status === "connected" || status === "healthy") return "bg-emerald-50 text-emerald-700";
    if (status === "pending") return "bg-amber-50 text-amber-700";
    return "bg-slate-100 text-slate-700";
  }, [cluster?.status]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 lg:flex">
      <aside className="border-r border-slate-800 bg-slate-900/95 p-5 lg:sticky lg:top-0 lg:h-screen lg:w-72">
        <Link href="/dashboard" className="block rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200/30">
          <BrandLogo markClassName="bg-white text-blue-700 shadow-none" textClassName="text-xl text-white" />
        </Link>
        <div className="mt-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-300">Selected cluster</p>
          <h2 className="mt-2 break-words text-lg font-semibold text-white">{cluster?.name || "Loading cluster..."}</h2>
          <p className="mt-1 text-sm text-slate-400">{cluster?.provider || "Kubernetes cluster"}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${statusTone}`}>
              {cluster?.status || "loading"}
            </span>
            {cluster?.last_seen_at && (
              <span className="text-xs text-slate-400">Last seen {new Date(cluster.last_seen_at).toLocaleString()}</span>
            )}
          </div>
          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
        </div>
        <nav className="mt-8 space-y-1">
          {nav.map((item) => {
            const href = `/dashboard/clusters/${clusterId}/${item.href}`;
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={item.href}
                href={href}
                className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-blue-500/15 text-blue-200 shadow-sm ring-1 ring-blue-400/20"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex-1">
        <header className="border-b border-slate-800 bg-slate-900/80 px-6 py-4 backdrop-blur lg:px-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link href="/dashboard" className="text-sm font-medium text-blue-300 hover:text-blue-200">
                Back to Onboarding
              </Link>
              <p className="mt-1 text-sm text-slate-400">Cluster operations workspace</p>
            </div>
            <div className="text-sm text-slate-400">
              {cluster?.name ? `Working in ${cluster.name}` : "Loading cluster context..."}
            </div>
          </div>
        </header>
        <main className="p-6 lg:p-10">{children}</main>
      </div>
    </div>
  );
}
