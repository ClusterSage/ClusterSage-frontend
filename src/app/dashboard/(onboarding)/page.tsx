"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Cluster } from "@/types/api";

export default function DashboardPage() {
  const [clusters, setClusters] = useState<Cluster[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Cluster[]>("/api/clusters").then(setClusters).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Operations overview</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-slate-600">Your Kubernetes clusters and ingestion status.</p>
      </div>
      {error && <div className="card border-red-200 text-red-700">{error}</div>}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card transition hover:-translate-y-0.5 hover:shadow-md">
          <p className="text-sm font-medium text-slate-500">Clusters</p>
          <p className="mt-2 text-3xl font-bold">{clusters?.length ?? "..."}</p>
        </div>
        <div className="card transition hover:-translate-y-0.5 hover:shadow-md">
          <p className="text-sm font-medium text-slate-500">Connected</p>
          <p className="mt-2 text-3xl font-bold">
            {clusters?.filter((c) => c.status !== "pending" && c.status !== "deactivated").length ?? "..."}
          </p>
        </div>
        <div className="card transition hover:-translate-y-0.5 hover:shadow-md">
          <p className="text-sm font-medium text-slate-500">Install</p>
          <Link className="mt-3 inline-block font-medium text-blue-700 hover:text-blue-800" href="/dashboard/install-agent">
            Open guide
          </Link>
        </div>
      </div>
      {clusters && clusters.length === 0 && (
        <div className="card">
          <h2 className="font-bold">No clusters yet</h2>
          <p className="mt-2 text-slate-600">Create an agent key and install the Helm chart to connect your first cluster.</p>
          <Link className="btn mt-4 inline-block" href="/dashboard/install-agent">
            Install agent
          </Link>
        </div>
      )}
    </div>
  );
}
