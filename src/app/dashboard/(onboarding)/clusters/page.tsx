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
  const [clusterToDelete, setClusterToDelete] = useState<Cluster | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    api<Cluster[]>("/api/clusters").then(setItems).catch((e) => setError(e.message));
  }, []);

  async function confirmDeleteCluster() {
    if (!clusterToDelete) return;
    setDeleteLoading(true);
    setDeleteError("");
    try {
      await api<void>(`/api/clusters/${clusterToDelete.id}`, { method: "DELETE" });
      setItems((current) => (current || []).filter((cluster) => cluster.id !== clusterToDelete.id));
      setClusterToDelete(null);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Failed to remove cluster");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow">Connected environments</p>
        <h1 className="section-title mt-2">Clusters</h1>
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
          <div
            key={c.id}
            className="card transition hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-md)]"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">{c.name}</h2>
                <p className="text-sm muted">{c.provider}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`${statusTone(c.status)} text-sm`}>{c.status}</span>
                <Link className="btn-secondary" href={`/dashboard/clusters/${c.id}/dashboard`}>
                  Open
                </Link>
                <button
                  type="button"
                  className="rounded-2xl border border-[var(--danger-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--danger-text)] transition hover:bg-[var(--danger-bg)]"
                  onClick={() => {
                    setDeleteError("");
                    setClusterToDelete(c);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {clusterToDelete && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close remove cluster confirmation"
            className="absolute inset-0 bg-[var(--bg)]/72 backdrop-blur-sm"
            onClick={() => {
              if (deleteLoading) return;
              setClusterToDelete(null);
              setDeleteError("");
            }}
          />
          <div className="absolute inset-x-4 top-1/2 mx-auto w-full max-w-lg -translate-y-1/2 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 shadow-2xl">
            <p className="eyebrow">Remove connected cluster</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--text)]">{clusterToDelete.name}</h2>
            <p className="mt-3 section-copy">
              This will remove the connected cluster from ClusterSage and delete its associated database records. This action cannot be undone.
            </p>
            {deleteError && <div className="mt-4 rounded-2xl border border-[var(--danger-bg)] bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger-text)]">{deleteError}</div>}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="btn-secondary"
                disabled={deleteLoading}
                onClick={() => {
                  setClusterToDelete(null);
                  setDeleteError("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-2xl bg-[var(--danger-text)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={deleteLoading}
                onClick={() => void confirmDeleteCluster()}
              >
                {deleteLoading ? "Removing..." : "Yes, remove cluster"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
