"use client";
import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Cluster, ResourceSummary } from "@/types/api";

const preferredKinds = ["Pod", "Deployment", "Service", "ReplicaSet", "StatefulSet", "DaemonSet", "Job", "CronJob", "Namespace"];

function resourceHref(clusterId: string, resource: ResourceSummary) {
  const namespace = resource.namespace || "_cluster";
  return `/dashboard/clusters/${clusterId}/resources/${encodeURIComponent(resource.kind)}/${encodeURIComponent(namespace)}/${encodeURIComponent(resource.name)}`;
}

export default function ClusterDetail({ params }: { params: Promise<{ clusterId: string }> }) {
  const { clusterId } = use(params);
  const [cluster, setCluster] = useState<Cluster | null>(null);
  const [resources, setResources] = useState<ResourceSummary[] | null>(null);
  const [kind, setKind] = useState("All");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api<Cluster>(`/api/clusters/${clusterId}`), api<ResourceSummary[]>(`/api/clusters/${clusterId}/resources`)])
      .then(([clusterData, resourceData]) => { setCluster(clusterData); setResources(resourceData); })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load cluster"));
  }, [clusterId]);

  const kinds = useMemo(() => {
    const present = new Set(resources?.map((item) => item.kind) || []);
    return ["All", ...preferredKinds.filter((item) => present.has(item))];
  }, [resources]);

  const filtered = useMemo(() => (resources || []).filter((item) => {
    const matchesKind = kind === "All" || item.kind === kind;
    const text = `${item.name} ${item.namespace || ""} ${item.kind} ${item.status || ""}`.toLowerCase();
    return matchesKind && text.includes(query.toLowerCase());
  }), [resources, kind, query]);

  if (error) return <div className="card border-red-200 text-red-700">{error}</div>;
  if (!cluster || !resources) return <div className="card">Loading cluster resources...</div>;

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 className="text-3xl font-bold">{cluster.name}</h1>
        <p className="text-slate-600">{cluster.provider} / {cluster.status} / {resources.length} resources</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select className="input sm:w-44" value={kind} onChange={(event) => setKind(event.target.value)}>{kinds.map((item) => <option key={item}>{item}</option>)}</select>
        <input className="input sm:w-72" placeholder="Search resources" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
    </div>

    <div className="grid gap-4 md:grid-cols-3">
      <div className="card"><p className="text-sm text-slate-500">Last seen</p><p className="mt-2 font-medium">{cluster.last_seen_at ? new Date(cluster.last_seen_at).toLocaleString() : "Never"}</p></div>
      <div className="card"><p className="text-sm text-slate-500">Agent version</p><p className="mt-2 font-medium">{cluster.agent_version || "Unknown"}</p></div>
      <div className="card"><p className="text-sm text-slate-500">Primary resource type</p><p className="mt-2 font-medium">{resources.some((item) => item.kind === "Pod") ? "Pods available" : "Waiting for pod snapshot"}</p></div>
    </div>

    {filtered.length === 0 && <div className="card"><h2 className="font-semibold">No resources found</h2><p className="mt-2 text-slate-600">ClusterSage will show resources here after the agent sends a cluster snapshot.</p></div>}

    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Kind</th><th className="px-4 py-3">Namespace</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Node</th><th className="px-4 py-3">Restarts</th><th className="px-4 py-3">Age</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {filtered.map((item) => <tr key={`${item.kind}:${item.namespace || ""}:${item.name}`} className="transition hover:bg-blue-50/40">
            <td className="px-4 py-3 font-medium"><Link className="text-blue-700 hover:underline" href={resourceHref(clusterId, item)}>{item.name}</Link></td>
            <td className="px-4 py-3">{item.kind}</td>
            <td className="px-4 py-3 text-slate-600">{item.namespace || "cluster"}</td>
            <td className="px-4 py-3">{item.status || "Unknown"}</td>
            <td className="px-4 py-3 text-slate-600">{item.node_name || "-"}</td>
            <td className="px-4 py-3">{item.restart_count ?? "-"}</td>
            <td className="px-4 py-3 text-slate-600">{item.age || "-"}</td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </div>;
}
