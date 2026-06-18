"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Cluster } from "@/types/api";

export default function ClustersPage() {
  const [items, setItems] = useState<Cluster[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Cluster[]>("/api/clusters").then(setItems).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow">Connected environments</p>
        <h1 className="section-title mt-2">Clusters</h1>
        <p className="section-copy mt-2">Open any cluster to move into the dedicated operations workspace for resources, incidents, limits, and AI review.</p>
      </div>
      {error && <div className="card border-[var(--danger-bg)] text-[var(--danger-text)]">{error}</div>}
      {items === null && <div className="card">Loading clusters...</div>}
      {items?.length === 0 && (
        <div className="card">
          <h2 className="text-xl font-semibold">No clusters connected</h2>
          <p className="mt-2 section-copy">Install the agent to register a private AKS or Kubernetes cluster with this workspace.</p>
        </div>
      )}
      <div className="grid gap-4">
        {items?.map((c) => (
          <Link
            key={c.id}
            href={`/dashboard/clusters/${c.id}/dashboard`}
            className="card block transition hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-md)]"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{c.name}</h2>
                <p className="text-sm muted">
                  {c.provider} / agent {c.agent_version || "unknown"}
                </p>
              </div>
              <span className="status-chip status-chip-info text-sm">{c.status}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
