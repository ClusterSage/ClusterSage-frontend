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
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Connected environments</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Clusters</h1>
      </div>
      {error && <div className="card border-red-200 text-red-700">{error}</div>}
      {items === null && <div className="card">Loading clusters...</div>}
      {items?.length === 0 && (
        <div className="card">
          <h2 className="font-semibold">No clusters connected</h2>
          <p className="mt-2 text-slate-600">Install the agent to register a private AKS or Kubernetes cluster.</p>
        </div>
      )}
      <div className="grid gap-4">
        {items?.map((c) => (
          <Link
            key={c.id}
            href={`/dashboard/clusters/${c.id}/dashboard`}
            className="card block transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-bold">{c.name}</h2>
                <p className="text-sm text-slate-600">
                  {c.provider} / agent {c.agent_version || "unknown"}
                </p>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">{c.status}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
