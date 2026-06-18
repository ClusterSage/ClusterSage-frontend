"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { AIClusterQuery, AIIncident, Cluster, ResourceSummary } from "@/types/api";

const preferredKinds = ["Pod", "Deployment", "Service", "ReplicaSet", "StatefulSet", "DaemonSet", "Job", "CronJob", "Namespace"];
const exampleQuestions = [
  "Show critical incidents in the last 24 hours.",
  "Which pod restarted the most today?",
  "Find logs containing database connection failure.",
  "Which namespace has the most warning events?",
  "Summarize the health of this cluster.",
];

const supportedClusterIntents = [
  "CrashLoopBackOff and restart-heavy workloads",
  "Critical and major incident summaries",
  "Warning-event hotspots by namespace",
  "Log lookups across recent activity",
];

type ClusterView = "dashboard" | "resources" | "incidents" | "ai";

type CountItem = {
  label: string;
  value: number;
  tone?: "blue" | "amber" | "red" | "emerald" | "slate";
};

function resourceHref(clusterId: string, resource: Pick<ResourceSummary, "kind" | "namespace" | "name">) {
  const namespace = resource.namespace || "_cluster";
  return `/dashboard/clusters/${clusterId}/resources/${encodeURIComponent(resource.kind)}/${encodeURIComponent(namespace)}/${encodeURIComponent(resource.name)}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function severityTone(severity: string) {
  if (severity === "critical") return "bg-[var(--danger-bg)] text-[var(--danger-text)]";
  if (severity === "major") return "bg-[var(--warning-bg)] text-[var(--warning-text)]";
  return "bg-[var(--info-bg)] text-[var(--info-text)]";
}

function questionIntentLabel(query: AIClusterQuery | null) {
  const parsed = asRecord(query?.parsed_query);
  return typeof parsed.intent === "string" ? parsed.intent : "unsupported";
}

function limitHref(clusterId: string, metric: string) {
  return `/dashboard/clusters/${clusterId}/limits?metric=${encodeURIComponent(metric)}`;
}

function widthPercent(value: number, max: number) {
  if (max <= 0) return 0;
  return Math.max(8, Math.round((value / max) * 100));
}

function toneClasses(tone: CountItem["tone"]) {
  switch (tone) {
    case "red":
      return "bg-red-400";
    case "amber":
      return "bg-amber-400";
    case "emerald":
      return "bg-emerald-400";
    case "slate":
      return "bg-slate-400";
    default:
      return "bg-[var(--primary)]";
  }
}

export function ClusterWorkspaceView({ clusterId, view }: { clusterId: string; view: ClusterView }) {
  const [cluster, setCluster] = useState<Cluster | null>(null);
  const [resources, setResources] = useState<ResourceSummary[] | null>(null);
  const [incidents, setIncidents] = useState<AIIncident[] | null>(null);
  const [kind, setKind] = useState("All");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [incidentError, setIncidentError] = useState("");
  const [incidentLoading, setIncidentLoading] = useState(false);
  const [incidentSeverity, setIncidentSeverity] = useState("all");
  const [incidentStatus, setIncidentStatus] = useState("all");
  const [incidentNamespace, setIncidentNamespace] = useState("all");
  const [incidentType, setIncidentType] = useState("all");
  const [incidentWorkload, setIncidentWorkload] = useState("all");
  const [incidentSearch, setIncidentSearch] = useState("");
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [incidentDrawerOpen, setIncidentDrawerOpen] = useState(false);
  const [clusterQuestion, setClusterQuestion] = useState(exampleQuestions[0]);
  const [clusterQueryLoading, setClusterQueryLoading] = useState(false);
  const [clusterQueryError, setClusterQueryError] = useState("");
  const [clusterQueryResult, setClusterQueryResult] = useState<AIClusterQuery | null>(null);

  useEffect(() => {
    Promise.all([api<Cluster>(`/api/clusters/${clusterId}`), api<ResourceSummary[]>(`/api/clusters/${clusterId}/resources`)])
      .then(([clusterData, resourceData]) => {
        setCluster(clusterData);
        setResources(resourceData);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load cluster"));
  }, [clusterId]);

  useEffect(() => {
    if (!["dashboard", "incidents"].includes(view) || incidents !== null || incidentLoading) return;
    setIncidentLoading(true);
    setIncidentError("");
    api<AIIncident[]>(`/api/clusters/${clusterId}/incidents`)
      .then((data) => {
        setIncidents(data);
        setSelectedIncidentId(data[0]?.id || null);
      })
      .catch((err) => setIncidentError(err instanceof Error ? err.message : "Failed to load incidents"))
      .finally(() => setIncidentLoading(false));
  }, [view, incidents, incidentLoading, clusterId]);

  const kinds = useMemo(() => {
    const present = new Set(resources?.map((item) => item.kind) || []);
    return ["All", ...preferredKinds.filter((item) => present.has(item))];
  }, [resources]);

  const filteredResources = useMemo(
    () =>
      (resources || []).filter((item) => {
        const matchesKind = kind === "All" || item.kind === kind;
        const text = `${item.name} ${item.namespace || ""} ${item.kind} ${item.status || ""}`.toLowerCase();
        return matchesKind && text.includes(query.toLowerCase());
      }),
    [resources, kind, query],
  );

  const resourceSummary = useMemo(
    () => ({
      pods: (resources || []).filter((item) => item.kind === "Pod").length,
      deployments: (resources || []).filter((item) => item.kind === "Deployment").length,
      unhealthy: (resources || []).filter((item) => {
        const status = (item.status || "").toLowerCase();
        return status.includes("pending") || status.includes("failed") || status.includes("0/");
      }).length,
      restartedPods: (resources || []).filter((item) => (item.restart_count || 0) > 0).length,
    }),
    [resources],
  );

  const incidentSummary = useMemo(
    () => ({
      critical: (incidents || []).filter((item) => item.severity === "critical").length,
      major: (incidents || []).filter((item) => item.severity === "major").length,
      minor: (incidents || []).filter((item) => item.severity === "minor").length,
      open: (incidents || []).filter((item) => item.status === "open").length,
    }),
    [incidents],
  );

  const incidentNamespaces = useMemo(() => ["all", ...Array.from(new Set((incidents || []).map((item) => item.namespace || "cluster")))], [incidents]);
  const incidentTypes = useMemo(() => ["all", ...Array.from(new Set((incidents || []).map((item) => item.incident_type)))], [incidents]);
  const incidentWorkloads = useMemo(() => ["all", ...Array.from(new Set((incidents || []).map((item) => item.workload_name || item.resource_name || item.pod_name || "unknown")))], [incidents]);

  const filteredIncidents = useMemo(
    () =>
      (incidents || []).filter((incident) => {
        const severityOk = incidentSeverity === "all" || incident.severity === incidentSeverity;
        const statusOk = incidentStatus === "all" || incident.status === incidentStatus;
        const namespaceOk = incidentNamespace === "all" || (incident.namespace || "cluster") === incidentNamespace;
        const typeOk = incidentType === "all" || incident.incident_type === incidentType;
        const workloadValue = incident.workload_name || incident.resource_name || incident.pod_name || "unknown";
        const workloadOk = incidentWorkload === "all" || workloadValue === incidentWorkload;
        const text = `${incident.title} ${incident.ai_summary || ""} ${incident.description || ""} ${incident.pod_name || ""} ${incident.workload_name || ""}`.toLowerCase();
        const searchOk = text.includes(incidentSearch.toLowerCase());
        return severityOk && statusOk && namespaceOk && typeOk && workloadOk && searchOk;
      }),
    [incidents, incidentSeverity, incidentStatus, incidentNamespace, incidentType, incidentWorkload, incidentSearch],
  );

  const selectedIncident = filteredIncidents.find((item) => item.id === selectedIncidentId) || filteredIncidents[0] || null;

  useEffect(() => {
    if (!incidentDrawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIncidentDrawerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [incidentDrawerOpen]);

  async function refreshIncidents() {
    setIncidentLoading(true);
    setIncidentError("");
    try {
      const data = await api<AIIncident[]>(`/api/clusters/${clusterId}/incidents`);
      setIncidents(data);
      setSelectedIncidentId((current) => (data.some((item) => item.id === current) ? current : (data[0]?.id || null)));
    } catch (err) {
      setIncidentError(err instanceof Error ? err.message : "Failed to refresh incidents");
    } finally {
      setIncidentLoading(false);
    }
  }

  async function askClusterSage() {
    setClusterQueryLoading(true);
    setClusterQueryError("");
    try {
      const data = await api<AIClusterQuery>(`/api/clusters/${clusterId}/ai/query`, {
        method: "POST",
        body: JSON.stringify({ question: clusterQuestion }),
      });
      setClusterQueryResult(data);
    } catch (err) {
      setClusterQueryError(err instanceof Error ? err.message : "Failed to run cluster query");
    } finally {
      setClusterQueryLoading(false);
    }
  }

  const clusterQueryItems = useMemo(() => {
    const result = asRecord(clusterQueryResult?.result);
    return Array.isArray(result.items) ? result.items.map((item) => asRecord(item)) : [];
  }, [clusterQueryResult]);

  const clusterQuerySummary = asRecord(clusterQueryResult?.result);
  const clusterQueryIncidentCounts = asRecord(clusterQuerySummary.incident_counts);
  const clusterQueryResourceCounts = asRecord(clusterQuerySummary.resource_counts);

  const podStatusItems = useMemo<CountItem[]>(() => {
    const counts = new Map<string, number>();
    for (const item of resources || []) {
      if (item.kind !== "Pod") continue;
      const status = item.status || "Unknown";
      counts.set(status, (counts.get(status) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([label, value]) => {
        let tone: CountItem["tone"] = "blue";
        if (label.toLowerCase().includes("running")) tone = "emerald";
        else if (label.toLowerCase().includes("pending")) tone = "amber";
        else if (label.toLowerCase().includes("failed")) tone = "red";
        return { label, value, tone };
      })
      .sort((a, b) => b.value - a.value);
  }, [resources]);

  const resourceKindItems = useMemo<CountItem[]>(() => {
    const counts = new Map<string, number>();
    for (const item of resources || []) {
      counts.set(item.kind, (counts.get(item.kind) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([label, value]) => ({ label, value, tone: "blue" as CountItem["tone"] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [resources]);

  const topRestartedPods = useMemo(
    () =>
      (resources || [])
        .filter((item) => item.kind === "Pod" && (item.restart_count || 0) > 0)
        .sort((a, b) => (b.restart_count || 0) - (a.restart_count || 0))
        .slice(0, 8),
    [resources],
  );

  const incidentSeverityItems = useMemo<CountItem[]>(
    () => [
      { label: "Critical", value: incidentSummary.critical, tone: "red" },
      { label: "Major", value: incidentSummary.major, tone: "amber" },
      { label: "Minor", value: incidentSummary.minor, tone: "blue" },
      { label: "Open", value: incidentSummary.open, tone: "slate" },
    ],
    [incidentSummary],
  );

  const topAffectedNamespaces = useMemo(() => {
    const counts = new Map<string, number>();
    for (const incident of incidents || []) {
      const namespace = incident.namespace || "cluster";
      counts.set(namespace, (counts.get(namespace) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([label, value]) => ({ label, value, tone: "amber" as CountItem["tone"] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [incidents]);

  const recentIncidentTrend = useMemo(() => {
    const counts = new Map<string, number>();
    for (const incident of incidents || []) {
      const day = new Date(incident.last_seen_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      counts.set(day, (counts.get(day) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([label, value]) => ({ label, value, tone: "red" as CountItem["tone"] }))
      .slice(-7);
  }, [incidents]);

  if (error) return <div className="card border-[var(--danger-bg)] bg-[var(--bg-elevated)] text-[var(--danger-text)]">{error}</div>;
  if (!cluster || !resources) return <div className="card bg-[var(--bg-elevated)] text-[var(--text-muted)]">Loading cluster resources...</div>;

  if (view === "dashboard") {
    return (
      <div className="space-y-6 text-[var(--text)]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--primary)]">Cluster dashboard</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[var(--text)]">{cluster.name}</h1>
          <p className="text-[var(--text-muted)]">A quick view of current cluster activity and recent issues.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4"><p className="text-sm text-[var(--text-muted)]">Last seen</p><p className="mt-2 font-medium text-[var(--text)]">{cluster.last_seen_at ? new Date(cluster.last_seen_at).toLocaleString() : "Never"}</p></div>
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4"><p className="text-sm text-[var(--text-muted)]">Agent version</p><p className="mt-2 font-medium text-[var(--text)]">{cluster.agent_version || "Unknown"}</p></div>
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4"><p className="text-sm text-[var(--text-muted)]">Pods discovered</p><p className="mt-2 text-2xl font-bold text-[var(--text)]">{resourceSummary.pods}</p></div>
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4"><p className="text-sm text-[var(--text-muted)]">Deployments discovered</p><p className="mt-2 text-2xl font-bold text-[var(--text)]">{resourceSummary.deployments}</p></div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-[var(--text-muted)]">Resources needing attention</p>
                <p className="mt-2 text-2xl font-bold text-amber-400">{resourceSummary.unhealthy}</p>
              </div>
              <Link className="btn-secondary text-sm" href={limitHref(clusterId, "resource_health")}>Set limit</Link>
            </div>
            <p className="mt-2 text-sm text-[var(--text-muted)]">Based on the latest cluster update.</p>
          </div>
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-[var(--text-muted)]">Pods with restarts</p>
                <p className="mt-2 text-2xl font-bold text-[var(--primary)]">{resourceSummary.restartedPods}</p>
              </div>
              <Link className="btn-secondary text-sm" href={limitHref(clusterId, "pod_restarts")}>Set limit</Link>
            </div>
            <p className="mt-2 text-sm text-[var(--text-muted)]">Use the Resources and Incidents views to drill into affected workloads.</p>
          </div>
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-[var(--text-muted)]">Open incidents</p>
                <p className="mt-2 text-2xl font-bold text-red-400">{incidentSummary.open}</p>
              </div>
              <Link className="btn-secondary text-sm" href={limitHref(clusterId, "open_incidents")}>Set limit</Link>
            </div>
            <p className="mt-2 text-sm text-[var(--text-muted)]">Cluster-wide incidents appear in the dedicated Incidents view.</p>
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text)]">Pods by status</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">Built from the latest pod inventory snapshot.</p>
              </div>
              <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]">Snapshot</span>
            </div>
            <div className="mt-5 space-y-3">
              {podStatusItems.length === 0 && <p className="text-sm text-[var(--text-muted)]">No pod status is available yet.</p>}
              {podStatusItems.map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-[var(--text-muted)]">{item.label}</span>
                    <span className="font-medium text-[var(--text)]">{item.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--bg-subtle)]">
                    <div className={`h-2 rounded-full ${toneClasses(item.tone)}`} style={{ width: `${widthPercent(item.value, podStatusItems[0]?.value || 0)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text)]">Incidents by severity</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">Live counts from the cluster incident API.</p>
              </div>
              <Link className="btn-secondary text-sm" href={limitHref(clusterId, "critical_incidents")}>Set limit</Link>
            </div>
            <div className="mt-5 space-y-3">
              {incidentSeverityItems.map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-[var(--text-muted)]">{item.label}</span>
                    <span className="font-medium text-[var(--text)]">{item.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--bg-subtle)]">
                    <div className={`h-2 rounded-full ${toneClasses(item.tone)}`} style={{ width: `${widthPercent(item.value, Math.max(...incidentSeverityItems.map((entry) => entry.value), 1))}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
            <h2 className="text-lg font-semibold text-[var(--text)]">Top restarted pods</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Restart counts from current pod snapshot data.</p>
            <div className="mt-4 space-y-3">
              {topRestartedPods.length === 0 && <p className="text-sm text-[var(--text-muted)]">No restarted pods are visible in the latest snapshot.</p>}
              {topRestartedPods.map((item) => (
                <div key={`${item.namespace || "cluster"}:${item.name}`} className="flex items-center justify-between gap-4 rounded-3xl border border-[var(--border)] bg-[var(--bg)]/70 px-4 py-3">
                  <div className="min-w-0">
                    <Link className="block truncate font-medium text-[var(--primary)] hover:underline" href={resourceHref(clusterId, item)}>{item.name}</Link>
                    <p className="truncate text-sm text-[var(--text-muted)]">{item.namespace || "cluster"} Â· {item.status || "Unknown"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-[var(--text)]">{item.restart_count || 0}</p>
                    <p className="text-xs uppercase tracking-wide text-[var(--text-soft)]">restarts</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
            <h2 className="text-lg font-semibold text-[var(--text)]">Top affected namespaces</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Derived from current cluster incidents.</p>
            <div className="mt-4 space-y-3">
              {topAffectedNamespaces.length === 0 && <p className="text-sm text-[var(--text-muted)]">No namespace-level incident grouping is available yet.</p>}
              {topAffectedNamespaces.map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-[var(--text-muted)]">{item.label}</span>
                    <span className="font-medium text-[var(--text)]">{item.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--bg-subtle)]">
                    <div className={`h-2 rounded-full ${toneClasses(item.tone)}`} style={{ width: `${widthPercent(item.value, topAffectedNamespaces[0]?.value || 0)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
            <h2 className="text-lg font-semibold text-[var(--text)]">Resources by kind</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Current inventory distribution from snapshot-backed resources.</p>
            <div className="mt-4 space-y-3">
              {resourceKindItems.map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-[var(--text-muted)]">{item.label}</span>
                    <span className="font-medium text-[var(--text)]">{item.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--bg-subtle)]">
                    <div className={`h-2 rounded-full ${toneClasses(item.tone)}`} style={{ width: `${widthPercent(item.value, resourceKindItems[0]?.value || 0)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
            <h2 className="text-lg font-semibold text-[var(--text)]">Recent incident activity</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Grouped by recent activity.</p>
            <div className="mt-4 space-y-3">
              {recentIncidentTrend.length === 0 && <p className="text-sm text-[var(--text-muted)]">No incident trend data is available yet.</p>}
              {recentIncidentTrend.map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-[var(--text-muted)]">{item.label}</span>
                    <span className="font-medium text-[var(--text)]">{item.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--bg-subtle)]">
                    <div className={`h-2 rounded-full ${toneClasses(item.tone)}`} style={{ width: `${widthPercent(item.value, Math.max(...recentIncidentTrend.map((entry) => entry.value), 1))}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-elevated)]/80 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text)]">CPU usage</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">Not available yet</p>
              </div>
              <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]">Unavailable</span>
            </div>
            <p className="mt-3 text-sm text-[var(--text-muted)]">CPU usage is not available here yet.</p>
          </div>
          <div className="rounded-3xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-elevated)]/80 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text)]">Memory usage</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">Not available yet</p>
              </div>
              <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]">Unavailable</span>
            </div>
            <p className="mt-3 text-sm text-[var(--text-muted)]">Memory usage is not available here yet.</p>
          </div>
        </div>
      </div>
    );
  }

  if (view === "resources") {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--primary)]">Cluster resources</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[var(--text)]">Resources</h1>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <select className="input border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text)] sm:w-44" value={kind} onChange={(event) => setKind(event.target.value)}>
            {kinds.map((item) => <option key={item}>{item}</option>)}
          </select>
          <input className="input border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text)] sm:w-72" placeholder="Search resources" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        {filteredResources.length === 0 && <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 text-[var(--text-muted)]"><h2 className="font-semibold text-[var(--text)]">No resources found</h2><p className="mt-2">Resources will appear here after the cluster connects.</p></div>}
        <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-sm">
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--border)] text-sm text-[var(--text)]">
            <thead className="bg-[var(--bg-subtle)] text-left text-xs uppercase tracking-wide text-[var(--text-soft)]"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Kind</th><th className="px-4 py-3">Namespace</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Node</th><th className="px-4 py-3">Restarts</th><th className="px-4 py-3">Age</th></tr></thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredResources.map((item) => <tr key={`${item.kind}:${item.namespace || ""}:${item.name}`} className="transition hover:bg-[var(--bg-subtle)]/70">
                <td className="px-4 py-3 font-medium"><Link className="text-[var(--primary)] hover:underline" href={resourceHref(clusterId, item)}>{item.name}</Link></td>
                <td className="px-4 py-3">{item.kind}</td>
                <td className="px-4 py-3 text-[var(--text-muted)]">{item.namespace || "cluster"}</td>
                <td className="px-4 py-3">{item.status || "Unknown"}</td>
                <td className="px-4 py-3 text-[var(--text-muted)]">{item.node_name || "-"}</td>
                <td className="px-4 py-3">{item.restart_count ?? "-"}</td>
                <td className="px-4 py-3 text-[var(--text-muted)]">{item.age || "-"}</td>
              </tr>)}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    );
  }

  if (view === "incidents") {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--primary)]">Cluster incident review</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[var(--text)]">Incidents</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4"><p className="text-sm text-[var(--text-muted)]">Critical</p><p className="mt-2 text-2xl font-bold text-red-400">{incidentSummary.critical}</p></div>
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4"><p className="text-sm text-[var(--text-muted)]">Major</p><p className="mt-2 text-2xl font-bold text-amber-400">{incidentSummary.major}</p></div>
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4"><p className="text-sm text-[var(--text-muted)]">Minor</p><p className="mt-2 text-2xl font-bold text-[var(--primary)]">{incidentSummary.minor}</p></div>
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4"><p className="text-sm text-[var(--text-muted)]">Open incidents</p><p className="mt-2 text-2xl font-bold text-[var(--text)]">{incidentSummary.open}</p></div>
        </div>
          <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap">
          <input className="input border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text)] lg:min-w-72" placeholder="Search incidents" value={incidentSearch} onChange={(event) => setIncidentSearch(event.target.value)} />
          <select className="input border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text)] lg:w-40" value={incidentSeverity} onChange={(event) => setIncidentSeverity(event.target.value)}><option value="all">All severities</option><option value="critical">Critical</option><option value="major">Major</option><option value="minor">Minor</option></select>
          <select className="input border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text)] lg:w-40" value={incidentStatus} onChange={(event) => setIncidentStatus(event.target.value)}><option value="all">All status</option><option value="open">Open</option><option value="acknowledged">Acknowledged</option><option value="resolved">Resolved</option><option value="ignored">Ignored</option></select>
          <select className="input border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text)] lg:w-48" value={incidentNamespace} onChange={(event) => setIncidentNamespace(event.target.value)}>{incidentNamespaces.map((item) => <option key={item} value={item}>{item === "all" ? "All namespaces" : item}</option>)}</select>
          <select className="input border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text)] lg:w-48" value={incidentType} onChange={(event) => setIncidentType(event.target.value)}>{incidentTypes.map((item) => <option key={item} value={item}>{item === "all" ? "All incident types" : item}</option>)}</select>
          <select className="input border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text)] lg:w-52" value={incidentWorkload} onChange={(event) => setIncidentWorkload(event.target.value)}>{incidentWorkloads.map((item) => <option key={item} value={item}>{item === "all" ? "All workloads" : item}</option>)}</select>
          <button className="btn-secondary" onClick={() => void refreshIncidents()} disabled={incidentLoading}>{incidentLoading ? "Refreshing..." : "Refresh"}</button>
        </div>
        {incidentError && <div className="rounded-3xl border border-[var(--danger-bg)] bg-[var(--danger-bg)] p-4 text-[var(--danger-text)]">{incidentError}</div>}
        {incidentLoading && <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 text-[var(--text-muted)]">Loading incidents...</div>}
        {!incidentLoading && incidents?.length === 0 && <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 text-[var(--text-muted)]"><h2 className="text-lg font-semibold text-[var(--text)]">No incidents detected for this cluster.</h2><p className="mt-2">Recent cluster issues will appear here.</p></div>}
        {!incidentLoading && incidents && incidents.length > 0 && <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-sm text-[var(--text-muted)]">
            <p>Pick an incident to inspect details, evidence context, and the linked resource.</p>
            <p>{filteredIncidents.length} shown</p>
          </div>
          <div className="space-y-3">
            {filteredIncidents.length === 0 && <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 text-[var(--text-muted)]">No incidents match the current filters.</div>}
            {filteredIncidents.map((incident) => {
              const resourceLink = incident.resource_kind && incident.resource_name ? resourceHref(clusterId, { kind: incident.resource_kind, namespace: incident.namespace || "_cluster", name: incident.resource_name }) : null;
              return <button key={incident.id} className={`block w-full rounded-3xl border bg-[var(--bg-elevated)] p-4 text-left transition ${selectedIncident?.id === incident.id ? "border-[var(--primary)] ring-1 ring-[var(--primary-ring)]" : "border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)]"}`} onClick={() => {
                setSelectedIncidentId(incident.id);
                setIncidentDrawerOpen(true);
              }}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${severityTone(incident.severity)}`}>{incident.severity}</span>
                      <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]">{incident.status}</span>
                      <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]">{incident.incident_type}</span>
                    </div>
                    <h2 className="text-base font-semibold text-[var(--text)]">{incident.title}</h2>
                    <p className="text-sm text-[var(--text-muted)]">{incident.namespace || "cluster"}{incident.workload_name ? ` / ${incident.workload_name}` : incident.resource_name ? ` / ${incident.resource_name}` : ""}{incident.pod_name ? ` / ${incident.pod_name}` : ""}</p>
                    <p className="text-sm text-[var(--text-muted)]">{incident.ai_summary || incident.description || "Summary unavailable."}</p>
                    {resourceLink && <p className="text-sm text-[var(--primary)]">Linked resource available</p>}
                  </div>
                  <div className="text-right text-xs text-[var(--text-soft)]"><p>Seen {incident.occurrence_count} times</p><p>{new Date(incident.last_seen_at).toLocaleString()}</p></div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3 text-xs text-[var(--text-soft)]">
                  <span>{incident.namespace || "cluster"} scope</span>
                  <span className="text-[var(--primary)]">{resourceLink ? "Open details" : "Inspect incident"}</span>
                </div>
              </button>;
            })}
          </div>
          {incidentDrawerOpen && selectedIncident && <div className="fixed inset-0 z-40">
            <button className="absolute inset-0 bg-[var(--bg)]/70 backdrop-blur-sm" aria-label="Close incident details" onClick={() => setIncidentDrawerOpen(false)} />
            <div className="absolute inset-y-0 right-0 w-full max-w-2xl overflow-y-auto border-l border-[var(--border)] bg-[var(--bg-subtle)] shadow-2xl">
              <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--border)] bg-[var(--bg-elevated)]/95 px-6 py-5 backdrop-blur">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-[var(--primary)]">Incident details</p>
                  <h2 className="mt-1 text-2xl font-semibold text-[var(--text)]">{selectedIncident.title}</h2>
                </div>
                <button className="text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)]" onClick={() => setIncidentDrawerOpen(false)}>
                  Close
                </button>
              </div>
              <div className="space-y-6 px-4 py-5 sm:px-6 sm:py-6">
                <>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${severityTone(selectedIncident.severity)}`}>{selectedIncident.severity}</span>
                <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]">{selectedIncident.status}</span>
                <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]">Confidence {(selectedIncident.confidence_score ?? 0).toFixed(2)}</span>
                <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]">{selectedIncident.incident_type}</span>
              </div>
              <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">AI summary</h3>
                <p className="mt-3 text-sm text-[var(--text-muted)]">{selectedIncident.ai_summary || selectedIncident.description || "Summary unavailable."}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-soft)]">Namespace</p><p className="mt-1 text-sm text-[var(--text-muted)]">{selectedIncident.namespace || "cluster"}</p></div>
                <div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-soft)]">Workload</p><p className="mt-1 text-sm text-[var(--text-muted)]">{selectedIncident.workload_name || selectedIncident.resource_name || "Unknown"}</p></div>
                <div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-soft)]">Pod</p><p className="mt-1 text-sm text-[var(--text-muted)]">{selectedIncident.pod_name || "Unknown"}</p></div>
                <div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-soft)]">Container</p><p className="mt-1 text-sm text-[var(--text-muted)]">{selectedIncident.container_name || "Unknown"}</p></div>
                <div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-soft)]">First seen</p><p className="mt-1 text-sm text-[var(--text-muted)]">{new Date(selectedIncident.first_seen_at).toLocaleString()}</p></div>
                <div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-soft)]">Last seen</p><p className="mt-1 text-sm text-[var(--text-muted)]">{new Date(selectedIncident.last_seen_at).toLocaleString()}</p></div>
                <div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-soft)]">Occurrences</p><p className="mt-1 text-sm text-[var(--text-muted)]">{selectedIncident.occurrence_count}</p></div>
                <div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-soft)]">Status</p><p className="mt-1 text-sm text-[var(--text-muted)]">{selectedIncident.status}</p></div>
              </div>

              <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">Evidence</h3>
                <pre className="mt-3 overflow-auto whitespace-pre-wrap rounded-3xl bg-[var(--bg-subtle)] p-4 text-xs text-[var(--text-muted)]">
                  {JSON.stringify(selectedIncident.evidence, null, 2)}
                </pre>
              </div>

              <div className="flex flex-wrap gap-2">
                {selectedIncident.resource_kind && selectedIncident.resource_name && <Link className="btn-secondary" href={resourceHref(clusterId, { kind: selectedIncident.resource_kind, namespace: selectedIncident.namespace || "_cluster", name: selectedIncident.resource_name })}>Open linked resource</Link>}
                <button className="btn-secondary" onClick={() => setIncidentDrawerOpen(false)}>Back to incidents</button>
              </div>
                </>
              </div>
            </div>
          </div>}
        </div>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--primary)]">Cluster investigation</p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--text)]">ClusterSage AI</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Ask questions about this cluster and review the results here.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {supportedClusterIntents.map((item) => (
          <div key={item} className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
            <p className="text-sm font-medium text-[var(--text)]">{item}</p>
            <p className="mt-2 text-xs text-[var(--text-soft)]">Answers are grounded in the incidents, resources, logs, and event summaries already collected for this cluster.</p>
          </div>
        ))}
      </div>
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
        <textarea className="input min-h-28 w-full border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text)]" value={clusterQuestion} onChange={(event) => setClusterQuestion(event.target.value)} placeholder="Ask about cluster incidents, restarts, logs, or warning events" />
        <div className="mt-3 flex flex-wrap gap-2">
          {exampleQuestions.map((item) => <button key={item} className="btn-secondary" onClick={() => setClusterQuestion(item)}>{item}</button>)}
        </div>
        <div className="mt-4">
          <button className="btn" onClick={() => void askClusterSage()} disabled={clusterQueryLoading || clusterQuestion.trim().length < 3}>{clusterQueryLoading ? "Running query..." : "Run query"}</button>
        </div>
      </div>
      {clusterQueryError && <div className="rounded-3xl border border-[var(--danger-bg)] bg-[var(--danger-bg)] p-4 text-[var(--danger-text)]">{clusterQueryError}</div>}
      {clusterQueryResult && <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-blue-500/15 px-2.5 py-1 text-xs font-semibold text-[var(--primary)]">{questionIntentLabel(clusterQueryResult)}</span>
          <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]">{clusterQueryResult.ai_model || "ClusterSage"}</span>
          <span className="text-xs text-[var(--text-soft)]">{new Date(clusterQueryResult.created_at).toLocaleString()}</span>
        </div>
        <div className="mt-4">
          <h3 className="font-semibold text-[var(--text)]">Answer</h3>
          <p className="mt-2 text-sm text-[var(--text-muted)]">{clusterQueryResult.answer_summary || "Summary unavailable."}</p>
        </div>
        {clusterQueryItems.length > 0 && <div className="mt-4 space-y-3">
          <h3 className="font-semibold text-[var(--text)]">Result set</h3>
          {clusterQueryItems.map((item, index) => <div key={index} className="rounded-3xl border border-[var(--border)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="font-medium text-[var(--text)]">{String(item.title || item.pod_name || item.workload_name || item.namespace || `Result ${index + 1}`)}</p>
                <p className="text-sm text-[var(--text-muted)]">{String(item.summary || item.message || item.incident_type || item.status || "")}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {typeof item.severity === "string" && <span className={`rounded-full px-2.5 py-1 font-semibold uppercase ${severityTone(String(item.severity))}`}>{String(item.severity)}</span>}
                {typeof item.warning_event_count === "number" && <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 font-medium text-[var(--text-muted)]">{item.warning_event_count} warnings</span>}
                {typeof item.restart_count === "number" && <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 font-medium text-[var(--text-muted)]">{item.restart_count} restarts</span>}
              </div>
            </div>
          </div>)}
        </div>}
        {!clusterQueryItems.length && (Object.keys(clusterQueryIncidentCounts).length > 0 || Object.keys(clusterQueryResourceCounts).length > 0) && <div className="mt-4 grid gap-4 md:grid-cols-2">
          {Object.keys(clusterQueryIncidentCounts).length > 0 && <div className="rounded-3xl border border-[var(--border)] p-4"><h3 className="font-semibold text-[var(--text)]">Incident counts</h3><pre className="mt-3 overflow-auto whitespace-pre-wrap text-xs text-[var(--text-muted)]">{JSON.stringify(clusterQueryIncidentCounts, null, 2)}</pre></div>}
          {Object.keys(clusterQueryResourceCounts).length > 0 && <div className="rounded-3xl border border-[var(--border)] p-4"><h3 className="font-semibold text-[var(--text)]">Resource counts</h3><pre className="mt-3 overflow-auto whitespace-pre-wrap text-xs text-[var(--text-muted)]">{JSON.stringify(clusterQueryResourceCounts, null, 2)}</pre></div>}
        </div>}
      </div>}
    </div>
  );
}
