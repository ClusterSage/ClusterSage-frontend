"use client";
import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { ResourceLogEntry, ResourceSummary } from "@/types/api";

const tabs = ["Details", "Logs", "Incidents", "AI Suggestions"] as const;
type Tab = typeof tabs[number];

function decode(value: string) {
  return decodeURIComponent(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function pathValue(source: Record<string, unknown>, path: string[]): unknown {
  return path.reduce<unknown>((current, key) => asRecord(current)[key], source);
}

function stringList(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value.map((item) => String(item)).join(", ");
}

function labels(labels: Record<string, string>) {
  const entries = Object.entries(labels || {});
  if (!entries.length) return <p className="text-sm text-slate-500">No labels available.</p>;
  return <div className="flex flex-wrap gap-2">{entries.slice(0, 20).map(([key, value]) => <span key={key} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">{key}: {value}</span>)}</div>;
}

export default function ResourceDetail({ params }: { params: Promise<{ clusterId: string; kind: string; namespace: string; name: string }> }) {
  const route = use(params);
  const clusterId = route.clusterId;
  const kind = decode(route.kind);
  const namespace = decode(route.namespace);
  const name = decode(route.name);
  const [resource, setResource] = useState<ResourceSummary | null>(null);
  const [logs, setLogs] = useState<ResourceLogEntry[] | null>(null);
  const [tab, setTab] = useState<Tab>("Details");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [logError, setLogError] = useState("");
  const [logLoading, setLogLoading] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    api<ResourceSummary>(`/api/clusters/${clusterId}/resources/${encodeURIComponent(kind)}/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`)
      .then(setResource)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load resource"));
  }, [clusterId, kind, namespace, name]);

  async function refreshLogs(force = false) {
    if (!force && Date.now() < cooldownUntil) return;
    setLogError("");
    setLogLoading(true);
    try {
      const data = await api<ResourceLogEntry[]>(`/api/clusters/${clusterId}/resources/${encodeURIComponent(kind)}/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/logs`);
      setLogs(data);
      setCooldownUntil(Date.now() + 5000);
    } catch (err) {
      setLogError(err instanceof Error ? err.message : "Failed to load logs");
    } finally {
      setLogLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "Logs" && logs === null && !logLoading) void refreshLogs(true);
  }, [tab, logs, logLoading]);

  useEffect(() => {
    if (!cooldownUntil) return;
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  const filteredLogs = useMemo(() => (logs || []).filter((entry) => `${entry.timestamp || ""} ${entry.container || ""} ${entry.message}`.toLowerCase().includes(query.toLowerCase())), [logs, query]);
  const metadata = asRecord(resource?.metadata);
  const spec = asRecord(metadata.spec);
  const status = asRecord(metadata.status);
  const containerNames = stringList((spec.containers as Record<string, unknown>[] | undefined)?.map((item) => item.name));
  const images = stringList((spec.containers as Record<string, unknown>[] | undefined)?.map((item) => item.image));
  const ownerRefs = stringList((pathValue(metadata, ["metadata", "ownerReferences"]) as Record<string, unknown>[] | undefined)?.map((item) => `${item.kind || ""}/${item.name || ""}`));
  const cooldownSeconds = Math.max(0, Math.ceil((cooldownUntil - nowTick) / 1000));

  if (error) return <div className="card border-red-200 text-red-700">{error}</div>;
  if (!resource) return <div className="card">Loading resource...</div>;

  return <div className="space-y-6">
    <div>
      <Link className="text-sm text-blue-700 hover:underline" href={`/dashboard/clusters/${clusterId}`}>Back to resources</Link>
      <h1 className="mt-2 break-words text-3xl font-bold">{resource.name}</h1>
      <p className="text-slate-600">{resource.kind} / {resource.namespace || "cluster"} / {resource.status || "Unknown"}</p>
    </div>

    <div className="flex flex-wrap gap-2 border-b border-slate-200">
      {tabs.map((item) => <button key={item} className={`px-4 py-3 text-sm font-medium ${tab === item ? "border-b-2 border-blue-600 text-blue-700" : "text-slate-600 hover:text-slate-900"}`} onClick={() => setTab(item)}>{item}</button>)}
    </div>

    {tab === "Details" && <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card"><p className="text-sm text-slate-500">Name</p><p className="mt-2 break-words font-medium">{resource.name}</p></div>
        <div className="card"><p className="text-sm text-slate-500">Namespace</p><p className="mt-2 font-medium">{resource.namespace || "cluster"}</p></div>
        <div className="card"><p className="text-sm text-slate-500">Status</p><p className="mt-2 font-medium">{resource.status || "Unknown"}</p></div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card space-y-3">
          <h2 className="font-semibold">Metadata</h2>
          <p className="text-sm text-slate-600">Created: {resource.created_at ? new Date(resource.created_at).toLocaleString() : "Unknown"}</p>
          <p className="text-sm text-slate-600">Node: {resource.node_name || "Not available"}</p>
          <p className="text-sm text-slate-600">Restarts: {resource.restart_count ?? "Not available"}</p>
          <p className="text-sm text-slate-600">Owner: {ownerRefs || "Not available"}</p>
        </div>
        <div className="card space-y-3">
          <h2 className="font-semibold">Runtime</h2>
          <p className="text-sm text-slate-600">Containers: {containerNames || "Not available"}</p>
          <p className="break-words text-sm text-slate-600">Images: {images || "Not available"}</p>
          <p className="text-sm text-slate-600">Phase: {String(status.phase || resource.status || "Unknown")}</p>
        </div>
      </div>
      <div className="card space-y-3"><h2 className="font-semibold">Labels</h2>{labels(resource.labels)}</div>
    </div>}

    {tab === "Logs" && <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input className="input sm:max-w-md" placeholder="Filter log lines" value={query} onChange={(event) => setQuery(event.target.value)} />
        <button className="btn-secondary" disabled={logLoading || cooldownSeconds > 0} onClick={() => void refreshLogs()}>{logLoading ? "Refreshing..." : cooldownSeconds > 0 ? `Refresh in ${cooldownSeconds}s` : "Refresh"}</button>
      </div>
      {logError && <div className="card border-red-200 text-red-700">{logError}</div>}
      {logs?.length === 0 && <div className="card">No logs found for this resource yet.</div>}
      <div className="max-h-[640px] overflow-auto rounded-lg bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100">
        {filteredLogs.length === 0 && logs !== null ? <p className="text-slate-400">No log lines match the current filter.</p> : filteredLogs.map((entry, index) => <div key={`${entry.timestamp || "line"}-${index}`} className="grid gap-3 border-b border-slate-800 py-1 md:grid-cols-[190px_140px_1fr]"><span className="text-slate-400">{entry.timestamp || "-"}</span><span className="text-cyan-300">{entry.container || "container"}</span><span className="whitespace-pre-wrap break-words">{entry.message}</span></div>)}
      </div>
    </div>}

    {tab === "Incidents" && <div className="card">
      <h2 className="text-lg font-semibold">No incidents detected yet.</h2>
      <p className="mt-2 text-slate-600">AI-powered incident detection will appear here in a future update. Once enabled, ClusterSage will analyze logs, events, and resource health to identify incidents.</p>
    </div>}

    {tab === "AI Suggestions" && <div className="card">
      <h2 className="text-lg font-semibold">AI suggestions will be available in a future release.</h2>
      <p className="mt-2 text-slate-600">ClusterSage will analyze detected incidents and recommend possible fixes here, including kubectl commands, YAML changes, scaling recommendations, and configuration fixes.</p>
    </div>}
  </div>;
}
