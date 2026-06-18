"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type {
  AIIncident,
  Cluster,
  ClusterMetricFilterCatalog,
  ClusterMetricLatest,
  ClusterMetricLatestBreakdownItem,
  ClusterMetricsOverview,
  ClusterMetricTimeseries,
  ResourceSummary,
} from "@/types/api";

type CountTone = "blue" | "amber" | "red" | "emerald" | "slate";

type MetricSpec = {
  key: string;
  title: string;
  subtitle: string;
  tone: CountTone;
};

const lineMetricSpecs: MetricSpec[] = [
  { key: "cpu_mcores", title: "Pod CPU usage", subtitle: "Live pod CPU samples from metrics.k8s.io.", tone: "blue" },
  { key: "memory_bytes", title: "Pod memory usage", subtitle: "Live pod memory samples from metrics.k8s.io.", tone: "emerald" },
  { key: "network_rx_bytes", title: "Receive throughput", subtitle: "Node and pod receive samples via kubelet summary.", tone: "amber" },
  { key: "network_tx_bytes", title: "Send throughput", subtitle: "Node and pod send samples via kubelet summary.", tone: "red" },
];

const breakdownMetricSpecs: MetricSpec[] = [
  { key: "request_cpu_cores", title: "CPU requested", subtitle: "Requested CPU from kube-state-metrics.", tone: "blue" },
  { key: "limit_cpu_cores", title: "CPU limit", subtitle: "CPU limits from kube-state-metrics.", tone: "amber" },
  { key: "request_memory_bytes", title: "Memory requested", subtitle: "Requested memory from kube-state-metrics.", tone: "emerald" },
  { key: "limit_memory_bytes", title: "Memory limit", subtitle: "Memory limits from kube-state-metrics.", tone: "red" },
];

function resourceHref(clusterId: string, resource: Pick<ResourceSummary, "kind" | "namespace" | "name">) {
  const namespace = resource.namespace || "_cluster";
  return `/dashboard/clusters/${clusterId}/resources/${encodeURIComponent(resource.kind)}/${encodeURIComponent(namespace)}/${encodeURIComponent(resource.name)}`;
}

function toneHex(tone: CountTone) {
  switch (tone) {
    case "red":
      return "#fb7185";
    case "amber":
      return "#fbbf24";
    case "emerald":
      return "#34d399";
    case "slate":
      return "#94a3b8";
    default:
      return "#60a5fa";
  }
}

function toneClass(tone: CountTone) {
  switch (tone) {
    case "red":
      return "bg-rose-400/15 text-rose-200 border-rose-400/20";
    case "amber":
      return "bg-amber-400/15 text-amber-200 border-amber-400/20";
    case "emerald":
      return "bg-emerald-400/15 text-emerald-200 border-emerald-400/20";
    case "slate":
      return "bg-slate-400/15 text-slate-200 border-slate-400/20";
    default:
      return "bg-sky-400/15 text-sky-200 border-sky-400/20";
  }
}

function formatMetricValue(value: number, unit?: string | null) {
  if (unit === "mcores") {
    if (value >= 1000) return `${(value / 1000).toFixed(1)} cores`;
    return `${Math.round(value)} mCPU`;
  }
  if (unit === "cores") return `${value.toFixed(value >= 10 ? 0 : 2)} cores`;
  if (unit === "count") return `${Math.round(value)}`;
  if (unit === "bytes") {
    if (value >= 1024 ** 4) return `${(value / 1024 ** 4).toFixed(2)} TiB`;
    if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GiB`;
    if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MiB`;
    if (value >= 1024) return `${(value / 1024).toFixed(1)} KiB`;
    return `${Math.round(value)} B`;
  }
  return `${Math.round(value)}`;
}

function shortTimestamp(value?: string | null) {
  if (!value) return "No samples";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function buildLinePath(values: number[], width: number, height: number) {
  if (!values.length) return "";
  if (values.length === 1) return `M 0 ${height / 2} L ${width} ${height / 2}`;
  const max = Math.max(...values, 1);
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - (value / max) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function Panel({ title, subtitle, children, right }: { title: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text)]">{title}</h2>
          {subtitle ? <p className="mt-1 text-xs text-[var(--text-soft)]">{subtitle}</p> : null}
        </div>
        {right}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function StatTile({ label, value, tone, detail }: { label: string; value: string; tone: CountTone; detail: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/55 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">{label}</p>
      <p className="mt-3 text-2xl font-semibold" style={{ color: toneHex(tone) }}>
        {value}
      </p>
      <p className="mt-2 text-xs text-[var(--text-soft)]">{detail}</p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="flex min-w-0 flex-col gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">{label}</span>
      <select className="input h-10 min-w-0 border-[var(--border-strong)] bg-[var(--bg)]/60 text-sm text-[var(--text)]" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function LineMetricPanel({ spec, data }: { spec: MetricSpec; data?: ClusterMetricTimeseries | null }) {
  const series = data?.series || [];
  const primarySeries = series[0];
  const values = primarySeries?.points.map((point) => point.value) || [];
  const path = buildLinePath(values, 100, 52);
  const color = toneHex(spec.tone);
  const max = Math.max(...values, 1);

  return (
    <Panel
      title={spec.title}
      subtitle={spec.subtitle}
      right={<span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${toneClass(spec.tone)}`}>{data?.unit || "n/a"}</span>}
    >
      {!primarySeries ? (
        <p className="text-sm text-[var(--text-muted)]">No real samples are available for this panel with the current filter selection.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/55 p-3">
              <svg viewBox="0 0 100 52" className="h-40 w-full">
                {[0.25, 0.5, 0.75].map((line) => (
                  <line
                    key={line}
                    x1="0"
                    x2="100"
                    y1={52 * line}
                    y2={52 * line}
                    stroke="rgba(148,163,184,0.16)"
                    strokeWidth="0.6"
                    strokeDasharray="2 3"
                  />
                ))}
                <path d={path} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                {primarySeries.points.map((point, index) => {
                  const x = primarySeries.points.length === 1 ? 50 : (index / (primarySeries.points.length - 1)) * 100;
                  const y = 52 - (point.value / max) * 52;
                  return <circle key={`${point.timestamp}-${index}`} cx={x} cy={y} r="1.6" fill={color} />;
                })}
              </svg>
            </div>
            <div className="space-y-3">
              <StatTile label="Latest" value={formatMetricValue(primarySeries.latest_value, primarySeries.unit)} tone={spec.tone} detail={primarySeries.resource_name} />
              <StatTile label="Series" value={`${series.length}`} tone="slate" detail="Rendered lines" />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {series.slice(0, 4).map((item) => (
              <div key={`${item.scope}:${item.resource_name}:${item.namespace || ""}`} className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/55 px-3 py-3">
                <p className="truncate text-xs font-medium text-[var(--text)]">{item.namespace ? `${item.namespace} / ${item.resource_name}` : item.resource_name}</p>
                <p className="mt-2 text-lg font-semibold text-[var(--text)]">{formatMetricValue(item.latest_value, item.unit)}</p>
                <p className="mt-1 text-[11px] text-[var(--text-soft)]">{item.scope} series</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

function BreakdownPanel({ spec, data }: { spec: MetricSpec; data?: ClusterMetricLatest | null }) {
  const breakdown = data?.breakdown || [];
  const max = Math.max(...breakdown.map((item) => item.value), 1);
  return (
    <Panel
      title={spec.title}
      subtitle={spec.subtitle}
      right={<span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${toneClass(spec.tone)}`}>{shortTimestamp(data?.collected_at)}</span>}
    >
      {!breakdown.length ? (
        <p className="text-sm text-[var(--text-muted)]">No latest-slice metric rows matched the current filter selection.</p>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/55 px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">Total</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--text)]">{formatMetricValue(data?.total_value || 0, data?.unit)}</p>
          </div>
          {breakdown.slice(0, 6).map((item) => (
            <div key={`${item.scope}:${item.resource_name}:${item.namespace || ""}`} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-[var(--text-muted)]">{labelForBreakdown(item)}</span>
                <span className="font-medium text-[var(--text)]">{formatMetricValue(item.value, item.unit)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                <div className="h-2 rounded-full" style={{ width: `${Math.max(8, Math.round((item.value / max) * 100))}%`, backgroundColor: colorForTone(spec.tone) }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function colorForTone(tone: CountTone) {
  return toneHex(tone);
}

function labelForBreakdown(item: ClusterMetricLatestBreakdownItem) {
  if (item.namespace) return `${item.namespace} / ${item.resource_name}`;
  return item.resource_name;
}

function NamespaceTable({
  resources,
  incidents,
  namespaceFilter,
}: {
  resources: ResourceSummary[];
  incidents: AIIncident[];
  namespaceFilter: string;
}) {
  const rows = useMemo(() => {
    const map = new Map<string, { pods: number; workloads: number; incidents: number }>();
    for (const resource of resources) {
      const namespace = resource.namespace || "cluster";
      if (namespaceFilter !== "All" && namespace !== namespaceFilter) continue;
      const current = map.get(namespace) || { pods: 0, workloads: 0, incidents: 0 };
      if (resource.kind === "Pod") current.pods += 1;
      if (["Deployment", "StatefulSet", "DaemonSet", "Job", "CronJob"].includes(resource.kind)) current.workloads += 1;
      map.set(namespace, current);
    }
    for (const incident of incidents) {
      const namespace = incident.namespace || "cluster";
      if (namespaceFilter !== "All" && namespace !== namespaceFilter) continue;
      const current = map.get(namespace) || { pods: 0, workloads: 0, incidents: 0 };
      current.incidents += 1;
      map.set(namespace, current);
    }
    return Array.from(map.entries())
      .map(([namespace, values]) => ({ namespace, ...values }))
      .sort((a, b) => b.incidents - a.incidents || b.pods - a.pods)
      .slice(0, 8);
  }, [resources, incidents, namespaceFilter]);

  return (
    <Panel title="Namespace resource status" subtitle="Snapshot-backed operational density by namespace.">
      {!rows.length ? (
        <p className="text-sm text-[var(--text-muted)]">No namespaces match the current filter selection.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--border)]">
          <table className="min-w-full divide-y divide-[var(--border)] text-sm">
            <thead className="bg-[var(--bg)]/60 text-left text-[11px] uppercase tracking-[0.16em] text-[var(--text-soft)]">
              <tr>
                <th className="px-3 py-3">Namespace</th>
                <th className="px-3 py-3">Workloads</th>
                <th className="px-3 py-3">Pods</th>
                <th className="px-3 py-3">Incidents</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] bg-[var(--bg-elevated)]">
              {rows.map((row) => (
                <tr key={row.namespace}>
                  <td className="px-3 py-3 font-medium text-[var(--text)]">{row.namespace}</td>
                  <td className="px-3 py-3 text-[var(--text-muted)]">{row.workloads}</td>
                  <td className="px-3 py-3 text-[var(--text-muted)]">{row.pods}</td>
                  <td className="px-3 py-3 text-[var(--text)]">{row.incidents}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function WorkloadTable({
  clusterId,
  resources,
  incidents,
  namespaceFilter,
  workloadFilter,
}: {
  clusterId: string;
  resources: ResourceSummary[];
  incidents: AIIncident[];
  namespaceFilter: string;
  workloadFilter: string;
}) {
  const rows = useMemo(() => {
    const map = new Map<string, { kind: string; namespace: string; status: string; incidents: number; restarts: number }>();
    for (const resource of resources) {
      if (!["Deployment", "StatefulSet", "DaemonSet", "Job", "CronJob"].includes(resource.kind)) continue;
      const namespace = resource.namespace || "cluster";
      if (namespaceFilter !== "All" && namespace !== namespaceFilter) continue;
      if (workloadFilter !== "All" && resource.name !== workloadFilter) continue;
      map.set(`${namespace}:${resource.name}`, {
        kind: resource.kind,
        namespace,
        status: resource.status || "Unknown",
        incidents: 0,
        restarts: 0,
      });
    }
    for (const resource of resources) {
      if (resource.kind !== "Pod") continue;
      const namespace = resource.namespace || "cluster";
      if (namespaceFilter !== "All" && namespace !== namespaceFilter) continue;
      const label = resource.metadata?.labels as Record<string, string> | undefined;
      const workloadName = label?.["app.kubernetes.io/name"] || label?.app || label?.["k8s-app"];
      if (!workloadName) continue;
      const key = `${namespace}:${workloadName}`;
      const current = map.get(key);
      if (!current) continue;
      current.restarts += resource.restart_count || 0;
    }
    for (const incident of incidents) {
      const namespace = incident.namespace || "cluster";
      if (namespaceFilter !== "All" && namespace !== namespaceFilter) continue;
      const workload = incident.workload_name || incident.resource_name;
      if (!workload) continue;
      if (workloadFilter !== "All" && workload !== workloadFilter) continue;
      const key = `${namespace}:${workload}`;
      const current = map.get(key);
      if (current) current.incidents += 1;
    }
    return Array.from(map.entries())
      .map(([key, value]) => ({ key, name: key.split(":")[1], ...value }))
      .sort((a, b) => b.incidents - a.incidents || b.restarts - a.restarts)
      .slice(0, 8);
  }, [resources, incidents, namespaceFilter, workloadFilter]);

  return (
    <Panel title="Workload health" subtitle="Snapshot and incident-backed workload drilldown.">
      {!rows.length ? (
        <p className="text-sm text-[var(--text-muted)]">No workloads match the current filter selection.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.key} className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)]/55 px-4 py-3 md:grid-cols-[minmax(0,1fr)_90px_90px_100px]">
              <div className="min-w-0">
                <Link className="block truncate text-sm font-medium text-[var(--primary)] hover:underline" href={resourceHref(clusterId, { kind: row.kind, namespace: row.namespace, name: row.name })}>
                  {row.name}
                </Link>
                <p className="mt-1 text-xs text-[var(--text-soft)]">{row.namespace} | {row.kind} | {row.status}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-soft)]">Incidents</p>
                <p className="mt-2 text-lg font-semibold text-[var(--text)]">{row.incidents}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-soft)]">Restarts</p>
                <p className="mt-2 text-lg font-semibold text-[var(--text)]">{row.restarts}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-soft)]">State</p>
                <p className="mt-2 text-sm font-medium text-[var(--text)]">{row.status}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function ClusterDashboardView({
  clusterId,
  cluster,
  resources,
  incidents,
  metricsOverview,
  metricsError,
}: {
  clusterId: string;
  cluster: Cluster;
  resources: ResourceSummary[];
  incidents: AIIncident[];
  metricsOverview: ClusterMetricsOverview | null;
  metricsError: string;
}) {
  const [catalog, setCatalog] = useState<ClusterMetricFilterCatalog | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState("All");
  const [selectedNamespace, setSelectedNamespace] = useState("All");
  const [selectedWorkload, setSelectedWorkload] = useState("All");
  const [selectedPod, setSelectedPod] = useState("All");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [latestMetrics, setLatestMetrics] = useState<Record<string, ClusterMetricLatest>>({});
  const [timeseriesMetrics, setTimeseriesMetrics] = useState<Record<string, ClusterMetricTimeseries>>({});

  useEffect(() => {
    api<ClusterMetricFilterCatalog>(`/api/clusters/${clusterId}/metrics/catalog`)
      .then((data) => {
        setCatalog(data);
        setCatalogError("");
      })
      .catch((err) => {
        setCatalog(null);
        setCatalogError(err instanceof Error ? err.message : "Failed to load metric catalog");
      });
  }, [clusterId, refreshNonce]);

  useEffect(() => {
    let cancelled = false;
    async function loadMetrics() {
      setLoading(true);
      const base = new URLSearchParams();
      if (selectedNamespace !== "All") base.set("namespace", selectedNamespace);
      if (selectedNode !== "All") base.set("node_name", selectedNode);
      if (selectedPod !== "All") {
        base.set("scope", "pod");
        base.set("resource_name", selectedPod);
      }

      const latestEntries = await Promise.all(
        breakdownMetricSpecs.map(async (spec) => {
          const params = new URLSearchParams(base);
          params.set("metric_name", spec.key);
          return [spec.key, await api<ClusterMetricLatest>(`/api/clusters/${clusterId}/metrics/latest?${params.toString()}`)] as const;
        }),
      );

      const timeseriesEntries = await Promise.all(
        lineMetricSpecs.map(async (spec) => {
          const params = new URLSearchParams(base);
          params.set("metric_name", spec.key);
          params.set("window_minutes", "180");
          params.set("step_minutes", "5");
          params.set("limit", "6");
          return [spec.key, await api<ClusterMetricTimeseries>(`/api/clusters/${clusterId}/metrics/timeseries?${params.toString()}`)] as const;
        }),
      );

      if (!cancelled) {
        setLatestMetrics(Object.fromEntries(latestEntries));
        setTimeseriesMetrics(Object.fromEntries(timeseriesEntries));
        setLoading(false);
      }
    }

    void loadMetrics().catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [clusterId, selectedNamespace, selectedNode, selectedPod, refreshNonce]);

  const nodeOptions = useMemo(() => ["All", ...(catalog?.nodes || [])], [catalog]);
  const namespaceOptions = useMemo(() => ["All", ...(catalog?.namespaces || [])], [catalog]);
  const workloadOptions = useMemo(() => ["All", ...(catalog?.workloads || [])], [catalog]);
  const podOptions = useMemo(() => ["All", ...(catalog?.pods || [])], [catalog]);

  const connectionBadge = cluster.status?.toLowerCase() === "connected" || cluster.status?.toLowerCase() === "healthy";
  const podCount = resources.filter((item) => item.kind === "Pod").length;
  const workloadCount = resources.filter((item) => ["Deployment", "StatefulSet", "DaemonSet", "Job", "CronJob"].includes(item.kind)).length;
  const openIncidents = incidents.filter((item) => item.status === "open").length;
  const criticalIncidents = incidents.filter((item) => item.severity === "critical").length;
  const runtimeCoverage = metricsOverview?.collected_at ? "Live telemetry active" : "Telemetry still warming up";

  const workloadFilterNote =
    selectedWorkload !== "All"
      ? "Workload filter currently affects workload and snapshot panels. Pod/node metrics remain scoped by real metric dimensions only."
      : "";

  return (
    <div className="space-y-4 text-[var(--text)]">
      <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-4 shadow-[var(--shadow-sm)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--primary)]">Cluster operations</p>
              <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${connectionBadge ? "bg-[var(--success-bg)] text-[var(--success-text)]" : "bg-[var(--warning-bg)] text-[var(--warning-text)]"}`}>
                {cluster.status}
              </span>
            </div>
            <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight">{cluster.name}</h1>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Dense telemetry workspace backed by snapshot inventory, incidents, live usage, kube-state-metrics, and sampled kubelet summary data.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatTile label="Pods" value={`${podCount}`} tone="blue" detail="Inventory snapshot" />
            <StatTile label="Workloads" value={`${workloadCount}`} tone="emerald" detail="Deployments and controllers" />
            <StatTile label="Open incidents" value={`${openIncidents}`} tone="amber" detail="Current active issues" />
            <StatTile label="Critical" value={`${criticalIncidents}`} tone="red" detail="Highest severity now" />
            <StatTile label="Telemetry" value={runtimeCoverage} tone="slate" detail={metricsOverview?.collected_at ? shortTimestamp(metricsOverview.collected_at) : "No timestamp yet"} />
          </div>
        </div>
      </section>

      <section className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 shadow-[var(--shadow-sm)] md:grid-cols-2 xl:grid-cols-5">
        <FilterSelect label="Nodes" value={selectedNode} onChange={setSelectedNode} options={nodeOptions} />
        <FilterSelect label="Namespace" value={selectedNamespace} onChange={setSelectedNamespace} options={namespaceOptions} />
        <FilterSelect label="Workload" value={selectedWorkload} onChange={setSelectedWorkload} options={workloadOptions} />
        <FilterSelect label="Pod" value={selectedPod} onChange={setSelectedPod} options={podOptions} />
        <div className="flex items-end">
          <button className="btn w-full" onClick={() => setRefreshNonce((value) => value + 1)}>
            {loading ? "Updating..." : "Update"}
          </button>
        </div>
      </section>

      {catalogError ? <div className="rounded-xl border border-[var(--danger-bg)] bg-[var(--danger-bg)] p-4 text-[var(--danger-text)]">{catalogError}</div> : null}
      {metricsError ? <div className="rounded-xl border border-[var(--warning-bg)] bg-[var(--warning-bg)] p-4 text-[var(--warning-text)]">{metricsError}</div> : null}
      {workloadFilterNote ? <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-sm text-[var(--text-muted)]">{workloadFilterNote}</div> : null}

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <LineMetricPanel spec={lineMetricSpecs[0]} data={timeseriesMetrics.cpu_mcores} />
        <BreakdownPanel spec={breakdownMetricSpecs[0]} data={latestMetrics.request_cpu_cores} />
        <BreakdownPanel spec={breakdownMetricSpecs[1]} data={latestMetrics.limit_cpu_cores} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <LineMetricPanel spec={lineMetricSpecs[1]} data={timeseriesMetrics.memory_bytes} />
        <BreakdownPanel spec={breakdownMetricSpecs[2]} data={latestMetrics.request_memory_bytes} />
        <BreakdownPanel spec={breakdownMetricSpecs[3]} data={latestMetrics.limit_memory_bytes} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <LineMetricPanel spec={lineMetricSpecs[2]} data={timeseriesMetrics.network_rx_bytes} />
        <LineMetricPanel spec={lineMetricSpecs[3]} data={timeseriesMetrics.network_tx_bytes} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <NamespaceTable resources={resources} incidents={incidents} namespaceFilter={selectedNamespace} />
        <WorkloadTable clusterId={clusterId} resources={resources} incidents={incidents} namespaceFilter={selectedNamespace} workloadFilter={selectedWorkload} />
      </section>
    </div>
  );
}
