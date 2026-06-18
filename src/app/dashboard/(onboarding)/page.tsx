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
        <p className="eyebrow">Operations overview</p>
        <h1 className="section-title mt-2">Dashboard</h1>
        <p className="section-copy mt-2">Review cluster coverage and the next step for your workspace.</p>
      </div>
      {error && <div className="card border-[var(--danger-bg)] text-[var(--danger-text)]">{error}</div>}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
          <p className="text-sm font-medium muted">Clusters</p>
          <p className="mt-2 text-3xl font-bold">{clusters?.length ?? "..."}</p>
        </div>
        <div className="card transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
          <p className="text-sm font-medium muted">Connected</p>
          <p className="mt-2 text-3xl font-bold">
            {clusters?.filter((c) => c.status !== "pending" && c.status !== "deactivated").length ?? "..."}
          </p>
        </div>
        <div className="card transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
          <p className="text-sm font-medium muted">Install</p>
          <Link className="mt-3 inline-block font-medium text-[var(--primary)] hover:opacity-80" href="/dashboard/install-agent">
            Open guide
          </Link>
        </div>
      </div>
      <div className="panel-subtle p-5">
        <p className="eyebrow">Next step</p>
        <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">Get a cluster connected</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Generate a key, prepare the values file, and run the install command when you’re ready.</p>
          </div>
          <Link className="btn inline-flex" href="/dashboard/install-agent">
            Start setup
          </Link>
        </div>
      </div>
      {clusters && clusters.length === 0 && (
        <div className="card">
          <h2 className="text-xl font-semibold">No clusters connected yet</h2>
          <p className="mt-2 section-copy">Create an agent key and connect your first cluster.</p>
          <Link className="btn mt-4 inline-block" href="/dashboard/install-agent">
            Install agent
          </Link>
        </div>
      )}
    </div>
  );
}
