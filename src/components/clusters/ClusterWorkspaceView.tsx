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

function toneHex(tone: CountItem["tone"]) {
  switch (tone) {
    case "red":
      return "#f87171";
    case "amber":
      return "#fbbf24";
    case "emerald":
      return "#34d399";
    case "slate":
      return "#94a3b8";
    default:
      return "#63a2ff";
  }
}

function buildLinePath(items: CountItem[], width: number, height: number) {
  if (!items.length) return "";
  if (items.length === 1) return `M 0 ${height / 2} L ${width} ${height / 2}`;
  const max = Math.max(...items.map((item) => item.value), 1);
  return items
    .map((item, index) => {
      const x = (index / (items.length - 1)) * width;
      const y = height - (item.value / max) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function StatCard({
  label,
  value,
  detail,
  accent,
  href,
}: {
  label: string;
  value: string | number;
  detail: string;
  accent: "blue" | "amber" | "red" | "emerald";
  href?: string;
}) {
  const accentMap = {
    blue: "text-[var(--primary)] bg-[var(--primary-soft)]",
    amber: "text-amber-300 bg-amber-400/10",
    red: "text-red-300 bg-red-400/10",
    emerald: "text-emerald-300 bg-emerald-400/10",
  } as const;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">{label}</p>
          <p className={`mt-3 text-3xl font-semibold ${accentMap[accent].split(" ")[0]}`}>{value}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${accentMap[accent]}`}>
          Live
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--text-muted)]">{detail}</p>
        {href ? (
          <Link className="btn-ghost shrink-0 px-2 py-1.5 text-xs" href={href}>
            Set limit
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function HorizontalBarChart({
  title,
  subtitle,
  items,
  emptyText,
  toneOverride,
}: {
  title: string;
  subtitle: string;
  items: CountItem[];
  emptyText: string;
  toneOverride?: CountItem["tone"];
}) {
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--text)]">{title}</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{subtitle}</p>
        </div>
        <span className="rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-soft)]">
          Snapshot
        </span>
      </div>
      <div className="mt-5 space-y-3">
        {!items.length ? <p className="text-sm text-[var(--text-muted)]">{emptyText}</p> : null}
        {items.map((item) => (
          <div key={item.label} className="space-y-1.5">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="truncate text-[var(--text-muted)]">{item.label}</span>
              <span className="font-medium text-[var(--text)]">{item.value}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
              <div
                className={`h-2.5 rounded-full ${toneClasses(toneOverride || item.tone)}`}
                style={{ width: `${widthPercent(item.value, max)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineTrendCard({
  title,
  subtitle,
  items,
  tone = "blue",
  emptyText,
}: {
  title: string;
  subtitle: string;
  items: CountItem[];
  tone?: CountItem["tone"];
  emptyText: string;
}) {
  const path = buildLinePath(items, 100, 56);
  const color = toneHex(tone);
  const max = Math.max(...items.map((item) => item.value), 1);
  const latest = items[items.length - 1]?.value ?? 0;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--text)]">{title}</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{subtitle}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold text-[var(--text)]">{latest}</p>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-soft)]">Latest</p>
        </div>
      </div>
      {!items.length ? (
        <p className="mt-5 text-sm text-[var(--text-muted)]">{emptyText}</p>
      ) : (
        <>
          <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--bg)]/60 p-3">
            <svg viewBox="0 0 100 56" className="h-40 w-full">
              <defs>
                <linearGradient id={`trend-fill-${title.replace(/\s+/g, "-").toLowerCase()}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity="0.32" />
                  <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75].map((line) => (
                <line
                  key={line}
                  x1="0"
                  x2="100"
                  y1={56 * line}
                  y2={56 * line}
                  stroke="rgba(148, 163, 184, 0.16)"
                  strokeWidth="0.6"
                  strokeDasharray="2 3"
                />
              ))}
              <path d={`${path} L 100 56 L 0 56 Z`} fill={`url(#trend-fill-${title.replace(/\s+/g, "-").toLowerCase()})`} />
              <path d={path} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              {items.map((item, index) => {
                const x = items.length === 1 ? 50 : (index / (items.length - 1)) * 100;
                const y = 56 - (item.value / max) * 56;
                return <circle key={item.label} cx={x} cy={y} r="1.8" fill={color} />;
              })}
            </svg>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--text-soft)] sm:grid-cols-4">
            {items.map((item) => (
              <div key={item.label} className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/50 px-3 py-2">
                <p className="truncate">{item.label}</p>
                <p className="mt-1 text-sm font-medium text-[var(--text)]">{item.value}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MetricUnavailableCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-elevated)]/80 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--text)]">{title}</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Metrics pipeline not enabled yet</p>
        </div>
        <span className="rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-soft)]">
          Pending
        </span>
      </div>
      <p className="mt-4 text-sm text-[var(--text-muted)]">{body}</p>
    </div>
  );
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
  const incidentWorkloads = useMemo(
    () => ["all", ...Array.from(new Set((incidents || []).map((item) => item.workload_name || item.resource_name || item.pod_name || "unknown")))],
    [incidents],
  );

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

  const dashboardTrend = recentIncidentTrend.length
    ? recentIncidentTrend
    : [
        { label: "Now", value: incidentSummary.open, tone: "red" as CountItem["tone"] },
        { label: "Critical", value: incidentSummary.critical, tone: "red" as CountItem["tone"] },
        { label: "Major", value: incidentSummary.major, tone: "amber" as CountItem["tone"] },
        { label: "Minor", value: incidentSummary.minor, tone: "blue" as CountItem["tone"] },
      ];

  if (error) return <div className="card border-[var(--danger-bg)] bg-[var(--bg-elevated)] text-[var(--danger-text)]">{error}</div>;
  if (!cluster || !resources) return <div className="card bg-[var(--bg-elevated)] text-[var(--text-muted)]">Loading cluster resources...</div>;

  if (view === "dashboard") {
    return (
      <div className="space-y-5 text-[var(--text)]">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] px-5 py-4 shadow-[var(--shadow-sm)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--primary)]">Cluster dashboard</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-semibold tracking-tight text-[var(--text)]">{cluster.name}</h1>
                <span className="rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-soft)]">
                  {cluster.provider || "Cluster"}
                </span>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${cluster.status?.toLowerCase() === "connected" || cluster.status?.toLowerCase() === "healthy" ? "bg-[var(--success-bg)] text-[var(--success-text)]" : "bg-[var(--warning-bg)] text-[var(--warning-text)]"}`}>
                  {cluster.status || "Unknown"}
                </span>
              </div>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Built from the latest cluster snapshot, incident stream, and resource inventory already collected by the agent.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[30rem]">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)]/60 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">Last seen</p>
                <p className="mt-2 text-sm font-medium text-[var(--text)]">{cluster.last_seen_at ? new Date(cluster.last_seen_at).toLocaleString() : "Never"}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)]/60 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">Agent</p>
                <p className="mt-2 text-sm font-medium text-[var(--text)]">{cluster.agent_version || "Unknown"}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)]/60 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">Pods</p>
                <p className="mt-2 text-lg font-semibold text-[var(--text)]">{resourceSummary.pods}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)]/60 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">Deployments</p>
                <p className="mt-2 text-lg font-semibold text-[var(--text)]">{resourceSummary.deployments}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Resources needing attention"
            value={resourceSummary.unhealthy}
            detail="Pending, failed, or otherwise degraded resources in the latest snapshot."
            accent="amber"
            href={limitHref(clusterId, "resource_health")}
          />
          <StatCard
            label="Pods with restarts"
            value={resourceSummary.restartedPods}
            detail="Pods that already show restart activity and may need inspection."
            accent="blue"
            href={limitHref(clusterId, "pod_restarts")}
          />
          <StatCard
            label="Open incidents"
            value={incidentSummary.open}
            detail="Current open incidents recorded for this cluster."
            accent="red"
            href={limitHref(clusterId, "open_incidents")}
          />
          <StatCard
            label="Critical incidents"
            value={incidentSummary.critical}
            detail="Highest-severity issues currently linked to this cluster."
            accent="emerald"
            href={limitHref(clusterId, "critical_incidents")}
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <LineTrendCard
            title="Incident activity"
            subtitle="Recent cluster incident volume from the incident API."
            items={dashboardTrend}
            tone="red"
            emptyText="Incident trend data is not available yet."
          />
          <HorizontalBarChart
            title="Pods by status"
            subtitle="Current pod state distribution from the latest inventory snapshot."
            items={podStatusItems}
            emptyText="No pod status is available yet."
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <HorizontalBarChart
            title="Incidents by severity"
            subtitle="Severity mix across the current incident set."
            items={incidentSeverityItems}
            emptyText="No incidents are available yet."
          />
          <HorizontalBarChart
            title="Top affected namespaces"
            subtitle="Namespaces with the most current incident coverage."
            items={topAffectedNamespaces}
            emptyText="No namespace-level incident grouping is available yet."
            toneOverride="amber"
          />
          <HorizontalBarChart
            title="Resources by kind"
            subtitle="Inventory composition from snapshot-backed resource data."
            items={resourceKindItems}
            emptyText="No resource inventory is available yet."
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 shadow-[var(--shadow-sm)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[var(--text)]">Restart-heavy pods</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">The pods with the highest restart counts in the current snapshot.</p>
              </div>
              <Link className="btn-ghost px-2 py-1.5 text-xs" href={`/dashboard/clusters/${clusterId}/resources`}>
                Open resources
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {!topRestartedPods.length ? <p className="text-sm text-[var(--text-muted)]">No restarted pods are visible in the latest snapshot.</p> : null}
              {topRestartedPods.map((item) => (
                <div
                  key={`${item.namespace || "cluster"}:${item.name}`}
                  className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg)]/60 px-4 py-3 md:grid-cols-[minmax(0,1fr)_7rem_5rem]"
                >
                  <div className="min-w-0">
                    <Link className="block truncate text-sm font-medium text-[var(--primary)] hover:underline" href={resourceHref(clusterId, item)}>
                      {item.name}
                    </Link>
                    <p className="mt-1 truncate text-sm text-[var(--text-muted)]">
                      {item.namespace || "cluster"} | {item.status || "Unknown"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2 text-right">
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-soft)]">Restarts</p>
                    <p className="mt-1 text-lg font-semibold text-[var(--text)]">{item.restart_count || 0}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2 text-right">
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-soft)]">Age</p>
                    <p className="mt-1 text-sm font-medium text-[var(--text)]">{item.age || "-"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <MetricUnavailableCard
              title="CPU usage"
              body="This view still does not have a real metrics pipeline. CPU charts will become trustworthy only after Metrics Server or another time-series source is wired through the agent and backend."
            />
            <MetricUnavailableCard
              title="Memory usage"
              body="Memory panels are intentionally withheld until real runtime metrics are ingested end to end. This avoids misleading dashboard visuals."
            />
          </div>
        </section>
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
            {kinds.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <input className="input border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text)] sm:w-72" placeholder="Search resources" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        {filteredResources.length === 0 && (
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 text-[var(--text-muted)]">
            <h2 className="font-semibold text-[var(--text)]">No resources found</h2>
            <p className="mt-2">Resources will appear here after the cluster connects.</p>
          </div>
        )}
        <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--border)] text-sm text-[var(--text)]">
              <thead className="bg-[var(--bg-subtle)] text-left text-xs uppercase tracking-wide text-[var(--text-soft)]">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Kind</th>
                  <th className="px-4 py-3">Namespace</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Node</th>
                  <th className="px-4 py-3">Restarts</th>
                  <th className="px-4 py-3">Age</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredResources.map((item) => (
                  <tr key={`${item.kind}:${item.namespace || ""}:${item.name}`} className="transition hover:bg-[var(--bg-subtle)]/70">
                    <td className="px-4 py-3 font-medium">
                      <Link className="text-[var(--primary)] hover:underline" href={resourceHref(clusterId, item)}>
                        {item.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{item.kind}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{item.namespace || "cluster"}</td>
                    <td className="px-4 py-3">{item.status || "Unknown"}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{item.node_name || "-"}</td>
                    <td className="px-4 py-3">{item.restart_count ?? "-"}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{item.age || "-"}</td>
                  </tr>
                ))}
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
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4"><p className="text-sm text-[var(--text-muted)]">Critical</p><p className="mt-2 text-2xl font-bold text-red-400">{incidentSummary.critical}</p></div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4"><p className="text-sm text-[var(--text-muted)]">Major</p><p className="mt-2 text-2xl font-bold text-amber-400">{incidentSummary.major}</p></div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4"><p className="text-sm text-[var(--text-muted)]">Minor</p><p className="mt-2 text-2xl font-bold text-[var(--primary)]">{incidentSummary.minor}</p></div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4"><p className="text-sm text-[var(--text-muted)]">Open incidents</p><p className="mt-2 text-2xl font-bold text-[var(--text)]">{incidentSummary.open}</p></div>
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
        {incidentError && <div className="rounded-2xl border border-[var(--danger-bg)] bg-[var(--danger-bg)] p-4 text-[var(--danger-text)]">{incidentError}</div>}
        {incidentLoading && <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 text-[var(--text-muted)]">Loading incidents...</div>}
        {!incidentLoading && incidents?.length === 0 && <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 text-[var(--text-muted)]"><h2 className="text-lg font-semibold text-[var(--text)]">No incidents detected for this cluster.</h2><p className="mt-2">Recent cluster issues will appear here.</p></div>}
        {!incidentLoading && incidents && incidents.length > 0 && <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-sm text-[var(--text-muted)]">
            <p>Pick an incident to inspect details, evidence context, and the linked resource.</p>
            <p>{filteredIncidents.length} shown</p>
          </div>
          <div className="space-y-3">
            {filteredIncidents.length === 0 && <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 text-[var(--text-muted)]">No incidents match the current filters.</div>}
            {filteredIncidents.map((incident) => {
              const resourceLink = incident.resource_kind && incident.resource_name ? resourceHref(clusterId, { kind: incident.resource_kind, namespace: incident.namespace || "_cluster", name: incident.resource_name }) : null;
              return <button key={incident.id} className={`block w-full rounded-2xl border bg-[var(--bg-elevated)] p-4 text-left transition ${selectedIncident?.id === incident.id ? "border-[var(--primary)] ring-1 ring-[var(--primary-ring)]" : "border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)]"}`} onClick={() => {
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
          {incidentDrawerOpen && selectedIncident && <div className="fixed inset-0 z-50">
            <button className="absolute inset-0 bg-[var(--bg)]/72 backdrop-blur-sm" aria-label="Close incident details" onClick={() => setIncidentDrawerOpen(false)} />
            <div className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-[var(--border)] bg-[var(--bg-subtle)] shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-6 py-5">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--primary)]">Incident details</p>
                  <h2 className="mt-2 text-xl font-semibold text-[var(--text)]">{selectedIncident.title}</h2>
                </div>
                <button className="btn-ghost shrink-0 px-2 py-1.5 text-sm" onClick={() => setIncidentDrawerOpen(false)}>
                  Close
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${severityTone(selectedIncident.severity)}`}>{selectedIncident.severity}</span>
                    <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]">{selectedIncident.status}</span>
                    <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]">Confidence {(selectedIncident.confidence_score ?? 0).toFixed(2)}</span>
                    <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]">{selectedIncident.incident_type}</span>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
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
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">Evidence</h3>
                    <pre className="mt-3 overflow-auto whitespace-pre-wrap rounded-2xl bg-[var(--bg-subtle)] p-4 text-xs text-[var(--text-muted)]">
                      {JSON.stringify(selectedIncident.evidence, null, 2)}
                    </pre>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedIncident.resource_kind && selectedIncident.resource_name && <Link className="btn-secondary" href={resourceHref(clusterId, { kind: selectedIncident.resource_kind, namespace: selectedIncident.namespace || "_cluster", name: selectedIncident.resource_name })}>Open linked resource</Link>}
                    <button className="btn-secondary" onClick={() => setIncidentDrawerOpen(false)}>Back to incidents</button>
                  </div>
                </div>
              </div>
            </div>
          </div>}
        </div>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--primary)]">Cluster investigation</p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--text)]">ClusterSage AI</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Ask questions about this cluster and review the results here.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {supportedClusterIntents.map((item) => (
          <div key={item} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
            <p className="text-sm font-medium text-[var(--text)]">{item}</p>
            <p className="mt-2 text-xs text-[var(--text-soft)]">Answers are grounded in the incidents, resources, logs, and event summaries already collected for this cluster.</p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
        <textarea className="input min-h-28 w-full border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text)]" value={clusterQuestion} onChange={(event) => setClusterQuestion(event.target.value)} placeholder="Ask about cluster incidents, restarts, logs, or warning events" />
        <div className="mt-3 flex flex-wrap gap-2">
          {exampleQuestions.map((item) => <button key={item} className="btn-secondary" onClick={() => setClusterQuestion(item)}>{item}</button>)}
        </div>
        <div className="mt-4">
          <button className="btn" onClick={() => void askClusterSage()} disabled={clusterQueryLoading || clusterQuestion.trim().length < 3}>{clusterQueryLoading ? "Running query..." : "Run query"}</button>
        </div>
      </div>
      {clusterQueryError && <div className="rounded-2xl border border-[var(--danger-bg)] bg-[var(--danger-bg)] p-4 text-[var(--danger-text)]">{clusterQueryError}</div>}
      {clusterQueryResult && <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
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
          {clusterQueryItems.map((item, index) => <div key={index} className="rounded-2xl border border-[var(--border)] p-4">
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
          {Object.keys(clusterQueryIncidentCounts).length > 0 && <div className="rounded-2xl border border-[var(--border)] p-4"><h3 className="font-semibold text-[var(--text)]">Incident counts</h3><pre className="mt-3 overflow-auto whitespace-pre-wrap text-xs text-[var(--text-muted)]">{JSON.stringify(clusterQueryIncidentCounts, null, 2)}</pre></div>}
          {Object.keys(clusterQueryResourceCounts).length > 0 && <div className="rounded-2xl border border-[var(--border)] p-4"><h3 className="font-semibold text-[var(--text)]">Resource counts</h3><pre className="mt-3 overflow-auto whitespace-pre-wrap text-xs text-[var(--text-muted)]">{JSON.stringify(clusterQueryResourceCounts, null, 2)}</pre></div>}
        </div>}
      </div>}
    </div>
  );
}
