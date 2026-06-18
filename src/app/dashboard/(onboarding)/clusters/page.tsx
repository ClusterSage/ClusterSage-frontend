"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Cluster } from "@/types/api";

function statusTone(status: string) {
  const value = status.toLowerCase();
  if (value === "connected" || value === "healthy") return "status-chip status-chip-success";
  if (value === "pending") return "status-chip status-chip-warning";
  if (value === "deactivated") return "status-chip status-chip-muted";
  return "status-chip status-chip-info";
}

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
        <p className="section-copy mt-2">Open any cluster to review resources, incidents, limits, and suggestions.</p>
      </div>
      {error && <div className="card border-[var(--danger-bg)] text-[var(--danger-text)]">{error}</div>}
      {items === null && <div className="card">Loading clusters...</div>}
      {items?.length === 0 && (
        <div className="card">
          <h2 className="text-xl font-semibold">No clusters connected</h2>
          <p className="mt-2 section-copy">Connect a cluster to start reviewing activity here.</p>
          <Link className="btn mt-4 inline-flex" href="/dashboard/install-agent">
            Open install guide
          </Link>
        </div>
      )}
      <div className="grid gap-4">
        {items?.map((c) => (
          <Link
            key={c.id}
            href={`/dashboard/clusters/${c.id}/dashboard`}
            className="card block transition hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-md)]"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">{c.name}</h2>
                <p className="text-sm muted">
                  {c.provider}
                  {c.last_seen_at ? ` - Last seen ${new Date(c.last_seen_at).toLocaleString()}` : ""}
                </p>
              </div>
              <span className={`${statusTone(c.status)} text-sm`}>{c.status}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
