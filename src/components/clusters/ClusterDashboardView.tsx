"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { DashboardMetricCard } from "@/components/clusters/dashboard/DashboardMetricCard";
import { DashboardPanel as Panel } from "@/components/clusters/dashboard/DashboardPanel";
import { DashboardUnavailableState } from "@/components/clusters/dashboard/DashboardUnavailableState";
import type {
  AIIncident,
  Cluster,
  ClusterMetricFilterCatalog,
  ClusterMetricLatest,
  ClusterMetricLatestBreakdownItem,
  ClusterMetricsOverview,
  ClusterMetricRollupItem,
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
  { key: "cpu_mcores", title: "Pod CPU usage", subtitle: "Live usage", tone: "blue" },
  { key: "memory_bytes", title: "Pod memory usage", subtitle: "Live usage", tone: "emerald" },
  { key: "network_rx_bytes", title: "Receive throughput", subtitle: "Ingress flow", tone: "amber" },
  { key: "network_tx_bytes", title: "Send throughput", subtitle: "Egress flow", tone: "red" },
];

const breakdownMetricSpecs: MetricSpec[] = [
  { key: "request_cpu_cores", title: "CPU requested", subtitle: "Requested", tone: "blue" },
  { key: "limit_cpu_cores", title: "CPU limit", subtitle: "Limit", tone: "amber" },
  { key: "request_memory_bytes", title: "Memory requested", subtitle: "Requested", tone: "emerald" },
  { key: "limit_memory_bytes", title: "Memory limit", subtitle: "Limit", tone: "red" },
];

const timeRangeOptions = [
  { label: "Last 1 hour", value: "60", step: "5" },
  { label: "Last 6 hours", value: "360", step: "10" },
  { label: "Last 24 hours", value: "1440", step: "20" },
  { label: "Last 7 days", value: "10080", step: "120" },
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

function iconFor(kind: "alerts" | "cluster" | "nodes" | "workloads" | "incidents" | "pods" | "cpu" | "memory" | "namespace") {
  const stroke = "currentColor";
  switch (kind) {
    case "cpu":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke={stroke} strokeWidth="1.8">
          <rect x="7" y="7" width="10" height="10" rx="2" />
          <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" strokeLinecap="round" />
        </svg>
      );
    case "memory":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke={stroke} strokeWidth="1.8">
          <path d="M6 8h12v8H6z" />
          <path d="M9 8V6M12 8V6M15 8V6M9 18v-2M12 18v-2M15 18v-2" strokeLinecap="round" />
        </svg>
      );
    case "namespace":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke={stroke} strokeWidth="1.8">
          <path d="M4 7.5 12 4l8 3.5-8 3.5L4 7.5Z" strokeLinejoin="round" />
          <path d="M4 12 12 15.5 20 12M4 16.5 12 20l8-3.5" strokeLinejoin="round" />
        </svg>
      );
    case "alerts":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke={stroke} strokeWidth="1.8">
          <path d="M15 17H5.5a1.5 1.5 0 0 1-1.2-2.4L6 12.5V10a6 6 0 1 1 12 0v2.5l1.7 2.1A1.5 1.5 0 0 1 18.5 17H15" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9.5 19a2.5 2.5 0 0 0 5 0" strokeLinecap="round" />
        </svg>
      );
    case "nodes":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke={stroke} strokeWidth="1.8">
          <rect x="4" y="4" width="6" height="6" rx="1.2" />
          <rect x="14" y="4" width="6" height="6" rx="1.2" />
          <rect x="9" y="14" width="6" height="6" rx="1.2" />
          <path d="M12 10v4M10 17h4" strokeLinecap="round" />
        </svg>
      );
    case "workloads":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke={stroke} strokeWidth="1.8">
          <path d="m12 4 7 4-7 4-7-4 7-4Z" strokeLinejoin="round" />
          <path d="m5 12 7 4 7-4" strokeLinejoin="round" />
          <path d="m5 16 7 4 7-4" strokeLinejoin="round" />
        </svg>
      );
    case "incidents":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke={stroke} strokeWidth="1.8">
          <path d="M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6l-7-3Z" strokeLinejoin="round" />
          <path d="M12 8v4M12 15h.01" strokeLinecap="round" />
        </svg>
      );
    case "pods":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke={stroke} strokeWidth="1.8">
          <rect x="4" y="6" width="16" height="12" rx="3" />
          <path d="M8 10h8M8 14h5" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke={stroke} strokeWidth="1.8">
          <path d="m12 4 7 4v8l-7 4-7-4V8l7-4Z" strokeLinejoin="round" />
          <path d="m12 12 7-4M12 12 5 8M12 12v8" strokeLinejoin="round" />
        </svg>
      );
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

function axisTimestamp(value?: string | null) {
  if (!value) return "--:--";
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
  const min = values.length ? Math.min(...values) : 0;
  const latest = primarySeries?.latest_value || 0;
  const mid = min + (max - min) / 2;
  const startLabel = axisTimestamp(primarySeries?.points[0]?.timestamp);
  const endLabel = axisTimestamp(primarySeries?.points[primarySeries.points.length - 1]?.timestamp);

  return (
    <Panel
      eyebrow="Telemetry"
      title={spec.title}
      subtitle={spec.subtitle}
      right={<span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${toneClass(spec.tone)}`}>{data?.unit || "n/a"}</span>}
    >
      {!primarySeries ? (
        <p className="text-sm text-[var(--text-muted)]">No real samples are available for this panel with the current filter selection.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_168px]">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/55 p-3">
              <div className="grid grid-cols-[52px_minmax(0,1fr)] gap-3">
                <div className="flex h-44 flex-col justify-between py-1 text-[11px] text-[var(--text-soft)]">
                  <span>{formatMetricValue(max, primarySeries.unit)}</span>
                  <span>{formatMetricValue(mid, primarySeries.unit)}</span>
                  <span>{formatMetricValue(min, primarySeries.unit)}</span>
                </div>
                <div className="space-y-2">
                  <svg viewBox="0 0 100 52" className="h-44 w-full">
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
                  <div className="flex items-center justify-between text-[11px] text-[var(--text-soft)]">
                    <span>{startLabel}</span>
                    <span>{endLabel}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <StatTile label="Latest" value={formatMetricValue(latest, primarySeries.unit)} tone={spec.tone} detail="Current value" />
              <StatTile label="Peak" value={formatMetricValue(max, primarySeries.unit)} tone="amber" detail="Window maximum" />
              <StatTile label="Samples" value={`${primarySeries.points.length}`} tone="slate" detail={`${series.length} series`} />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {series.slice(0, 4).map((item) => (
              <div key={`${item.scope}:${item.resource_name}:${item.namespace || ""}`} className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/55 px-3 py-3">
                <p className="truncate text-xs font-medium text-[var(--text)]">{item.namespace ? `${item.namespace} / ${item.resource_name}` : item.resource_name}</p>
                <p className="mt-2 text-lg font-semibold text-[var(--text)]">{formatMetricValue(item.latest_value, item.unit)}</p>
                <p className="mt-1 text-[11px] text-[var(--text-soft)]">{item.scope}</p>
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
      eyebrow="Capacity"
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
  right,
}: {
  resources: ResourceSummary[];
  incidents: AIIncident[];
  namespaceFilter: string;
  right?: ReactNode;
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
    <Panel eyebrow="Namespaces" title="Namespace resource status" subtitle="Snapshot-backed operational density by namespace." right={right}>
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
  right,
}: {
  clusterId: string;
  resources: ResourceSummary[];
  incidents: AIIncident[];
  namespaceFilter: string;
  workloadFilter: string;
  right?: ReactNode;
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
    <Panel eyebrow="Workloads" title="Workload health" subtitle="Snapshot and incident-backed workload drilldown." right={right}>
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

function formatRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diffMs)) return "Unknown";
  const minutes = Math.max(1, Math.round(diffMs / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function severityChipClass(severity: AIIncident["severity"]) {
  if (severity === "critical") return "status-chip-critical";
  if (severity === "major") return "status-chip-major";
  return "status-chip-minor";
}

function insightTagForIncident(incident: AIIncident) {
  if (/oom|capacity|memory|disk/i.test(incident.incident_type) || /memory|disk/i.test(incident.title)) return "Prediction";
  if (/restart|crash|loop/i.test(incident.incident_type) || /restart|crash|loop/i.test(incident.title)) return "Investigation";
  if (incident.severity === "critical") return "Remediation";
  return "Recommendation";
}

function MiddleStat({
  label,
  value,
  detail,
  tone = "slate",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: CountTone;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/55 px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">{label}</p>
      <p className="mt-2 text-xl font-semibold" style={{ color: toneHex(tone) }}>
        {value}
      </p>
      <p className="mt-1 text-xs text-[var(--text-soft)]">{detail}</p>
    </div>
  );
}

function healthToneLabel(kind: "healthy" | "warning" | "critical") {
  if (kind === "critical") return { label: "Critical", color: "#ef4444" };
  if (kind === "warning") return { label: "Warning", color: "#f59e0b" };
  return { label: "Healthy", color: "#10b981" };
}

function HealthDonut({
  healthy,
  warning,
  critical,
}: {
  healthy: number;
  warning: number;
  critical: number;
}) {
  const total = Math.max(healthy + warning + critical, 1);
  const segments = [
    { key: "healthy", value: healthy, color: "#10b981" },
    { key: "warning", value: warning, color: "#f59e0b" },
    { key: "critical", value: critical, color: "#ef4444" },
  ];
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const healthyPercent = Math.round((healthy / total) * 100);

  return (
    <div className="relative mx-auto h-44 w-44">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(148,163,184,0.16)" strokeWidth="10" />
        {segments.map((segment) => {
          const stroke = (segment.value / total) * circumference;
          const currentOffset = offset;
          offset += stroke;
          return (
            <circle
              key={segment.key}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${stroke} ${circumference - stroke}`}
              strokeDashoffset={-currentOffset}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-4xl font-semibold tracking-tight text-[var(--text)]">{healthyPercent}%</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Healthy</p>
        </div>
      </div>
    </div>
  );
}

function RollupList({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: ClusterMetricRollupItem[];
}) {
  return (
    <Panel eyebrow="Top consumers" title={title} subtitle={subtitle}>
      {!items.length ? (
        <p className="text-sm text-[var(--text-muted)]">No runtime samples are available for this panel yet.</p>
      ) : (
        <div className="space-y-3">
          {items.slice(0, 5).map((item) => (
            <div key={`${item.namespace || "cluster"}:${item.label}`} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-[var(--text)]">{item.label}</p>
                  <p className="truncate text-xs text-[var(--text-soft)]">{item.namespace || "cluster scope"}</p>
                </div>
                <span className="shrink-0 font-medium text-[var(--text)]">{formatMetricValue(item.value, item.unit)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                <div
                  className="h-2 rounded-full bg-[var(--primary)]"
                  style={{
                    width: `${Math.max(
                      8,
                      Math.round((item.value / Math.max(...items.map((entry) => entry.value), 1)) * 100),
                    )}%`,
                  }}
                />
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
  const [selectedWindow, setSelectedWindow] = useState("1440");
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
      const selectedWindowOption = timeRangeOptions.find((option) => option.value === selectedWindow) || timeRangeOptions[2];
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
          params.set("window_minutes", selectedWindowOption.value);
          params.set("step_minutes", selectedWindowOption.step);
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
  }, [clusterId, selectedNamespace, selectedNode, selectedPod, selectedWindow, refreshNonce]);

  const nodeOptions = useMemo(() => ["All", ...(catalog?.nodes || [])], [catalog]);
  const namespaceOptions = useMemo(() => ["All", ...(catalog?.namespaces || [])], [catalog]);
  const workloadOptions = useMemo(() => ["All", ...(catalog?.workloads || [])], [catalog]);
  const podOptions = useMemo(() => ["All", ...(catalog?.pods || [])], [catalog]);
  const selectedWindowOption = useMemo(
    () => timeRangeOptions.find((option) => option.value === selectedWindow) || timeRangeOptions[2],
    [selectedWindow],
  );

  const connectionBadge = cluster.status?.toLowerCase() === "connected" || cluster.status?.toLowerCase() === "healthy";
  const podCount = resources.filter((item) => item.kind === "Pod").length;
  const workloadCount = resources.filter((item) => ["Deployment", "StatefulSet", "DaemonSet", "Job", "CronJob"].includes(item.kind)).length;
  const openIncidents = incidents.filter((item) => item.status === "open").length;
  const criticalIncidents = incidents.filter((item) => item.severity === "critical").length;
  const healthyPodCount = resources.filter((item) => item.kind === "Pod" && /running|ready|healthy/i.test(item.status || "")).length;
  const troubledPodCount = resources.filter((item) => item.kind === "Pod" && /crash|error|fail|pending|unknown/i.test(item.status || "")).length;
  const nodeCount = useMemo(() => {
    const explicitNodes = resources.filter((item) => item.kind === "Node").length;
    if (explicitNodes) return explicitNodes;
    const names = new Set(resources.map((item) => item.node_name).filter((item): item is string => Boolean(item)));
    if (catalog?.nodes?.length) {
      for (const node of catalog.nodes) names.add(node);
    }
    return names.size;
  }, [catalog?.nodes, resources]);
  const topNodeTrend = metricsOverview?.top_nodes_by_cpu.map((item) => item.value) || [];
  const topNodeMemoryTrend = metricsOverview?.top_nodes_by_memory.map((item) => item.value) || [];
  const majorIncidents = incidents.filter((item) => item.severity === "major" && item.status === "open").length;
  const recentIncidents = useMemo(
    () =>
      [...incidents]
        .sort((a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime())
        .slice(0, 3),
    [incidents],
  );
  const aiInsightItems = useMemo(
    () =>
      [...incidents]
        .filter((item) => Boolean(item.ai_summary))
        .sort((a, b) => {
          const severityRank = { critical: 3, major: 2, minor: 1 } as const;
          const aRank = severityRank[a.severity];
          const bRank = severityRank[b.severity];
          if (bRank !== aRank) return bRank - aRank;
          return new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime();
        })
        .slice(0, 3),
    [incidents],
  );
  const healthSummary = useMemo(() => {
    const healthy = healthyPodCount;
    const warning = Math.max(majorIncidents + Math.max(troubledPodCount - criticalIncidents, 0), 0);
    const critical = Math.max(criticalIncidents, 0);
    return { healthy, warning, critical };
  }, [healthyPodCount, majorIncidents, troubledPodCount, criticalIncidents]);

  const workloadFilterNote =
    selectedWorkload !== "All"
      ? "Workload filter currently affects workload and snapshot panels. Pod/node metrics remain scoped by real metric dimensions only."
      : "";
  const topBarClusterState = connectionBadge ? "Connected" : cluster.status || "Unknown";
  const namespaceCount = useMemo(() => {
    if (catalog?.namespaces?.length) return catalog.namespaces.length;
    return new Set(resources.map((item) => item.namespace).filter((item): item is string => Boolean(item))).size;
  }, [catalog?.namespaces, resources]);

  return (
    <div className="space-y-5 text-[var(--text)]">
      <section className="dashboard-shell-header">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="dashboard-shell-meta">Overview</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)]">Dashboard</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
              Real-time summary of this Kubernetes cluster using resource inventory, incidents, and telemetry already collected by ClusterSage.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-[var(--text-soft)]">
              <span className={`rounded-full px-2.5 py-1 ${connectionBadge ? "bg-[var(--success-bg)] text-[var(--success-text)]" : "bg-[var(--warning-bg)] text-[var(--warning-text)]"}`}>
                {topBarClusterState}
              </span>
              <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1">Snapshot + telemetry</span>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <label className="flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)]/55 px-3 text-sm text-[var(--text-muted)]">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">Range</span>
                <select className="bg-transparent text-sm text-[var(--text)]" value={selectedWindow} onChange={(event) => setSelectedWindow(event.target.value)} aria-label="Select dashboard time range">
                  {timeRangeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn-secondary h-10 rounded-xl px-4" onClick={() => setRefreshNonce((value) => value + 1)}>
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        <DashboardMetricCard
          icon={iconFor("memory")}
          label="Node Memory"
          value={metricsOverview?.collected_at ? formatMetricValue(metricsOverview.node_memory_bytes_total, "bytes") : "n/a"}
          helper={metricsOverview?.collected_at ? shortTimestamp(metricsOverview.collected_at) : "No samples"}
          accent="#10b981"
          trend={topNodeMemoryTrend.length > 1 ? topNodeMemoryTrend : undefined}
        />
        <DashboardMetricCard
          icon={iconFor("cpu")}
          label="Node CPU"
          value={metricsOverview?.collected_at ? formatMetricValue(metricsOverview.node_cpu_mcores_total, "mcores") : "n/a"}
          helper={metricsOverview?.collected_at ? shortTimestamp(metricsOverview.collected_at) : "No samples"}
          accent="#60a5fa"
          trend={topNodeTrend.length > 1 ? topNodeTrend : undefined}
        />
        <DashboardMetricCard
          icon={iconFor("nodes")}
          label="Nodes"
          value={`${nodeCount}`}
          helper={catalog?.collected_at ? "Discovered" : "Inventory"}
          accent="#8b5cf6"
        />
        <DashboardMetricCard
          icon={iconFor("namespace")}
          label="Namespaces"
          value={`${namespaceCount}`}
          helper={selectedNamespace === "All" ? "Visible" : selectedNamespace}
          accent="#f59e0b"
        />
      </section>

      <section className="dashboard-panel">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <h2 className="dashboard-panel-title">Filters</h2>
            <p className="dashboard-panel-subtitle">Scope visible metrics by node, namespace, workload, and pod.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-soft)]">
            <span className={`rounded-full px-2.5 py-1 ${connectionBadge ? "bg-[var(--success-bg)] text-[var(--success-text)]" : "bg-[var(--warning-bg)] text-[var(--warning-text)]"}`}>
              {cluster.status}
            </span>
            <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1">{selectedWindowOption.label}</span>
            {metricsOverview?.collected_at ? <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1">Last sample {shortTimestamp(metricsOverview.collected_at)}</span> : null}
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <FilterSelect label="Nodes" value={selectedNode} onChange={setSelectedNode} options={nodeOptions} />
          <FilterSelect label="Namespace" value={selectedNamespace} onChange={setSelectedNamespace} options={namespaceOptions} />
          <FilterSelect label="Workload" value={selectedWorkload} onChange={setSelectedWorkload} options={workloadOptions} />
          <FilterSelect label="Pod" value={selectedPod} onChange={setSelectedPod} options={podOptions} />
          <div className="flex items-end">
            <button className="btn h-10 w-full rounded-xl" onClick={() => setRefreshNonce((value) => value + 1)}>
              {loading ? "Updating..." : "Update"}
            </button>
          </div>
        </div>
      </section>

      {catalogError ? <div className="rounded-xl border border-[var(--danger-bg)] bg-[var(--danger-bg)] p-4 text-[var(--danger-text)]">{catalogError}</div> : null}
      {metricsError ? <div className="rounded-xl border border-[var(--warning-bg)] bg-[var(--warning-bg)] p-4 text-[var(--warning-text)]">{metricsError}</div> : null}
      {workloadFilterNote ? <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-sm text-[var(--text-muted)]">{workloadFilterNote}</div> : null}

      <section className="grid gap-4 xl:grid-cols-[0.92fr_1fr_1fr]">
        <Panel
          eyebrow="Health"
          title="Cluster health"
          subtitle="Current pod and incident state."
          className="min-h-[420px]"
          right={
            <div className="flex items-center gap-2">
              <Link href={`/dashboard/clusters/${clusterId}/limits?metric=resource_health`} className="btn-secondary h-9 rounded-xl px-3 text-xs">
                Set limit
              </Link>
              <Link href={`/dashboard/clusters/${clusterId}/resources`} className="text-sm font-medium text-[var(--primary)] hover:underline">
                View resources
              </Link>
            </div>
          }
        >
          {podCount === 0 ? (
            <DashboardUnavailableState message="Health appears here after ClusterSage receives a resource snapshot for this cluster." />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)] lg:items-center">
                <HealthDonut healthy={healthSummary.healthy} warning={healthSummary.warning} critical={healthSummary.critical} />
                <div className="space-y-3">
                  {(["healthy", "warning", "critical"] as const).map((kind) => {
                    const meta = healthToneLabel(kind);
                    const value = healthSummary[kind];
                    const total = Math.max(healthSummary.healthy + healthSummary.warning + healthSummary.critical, 1);
                    const percent = Math.round((value / total) * 100);
                    return (
                      <div key={kind} className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/50 px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden="true" />
                            <span className="text-sm text-[var(--text-muted)]">{meta.label}</span>
                          </div>
                          <span className="text-sm font-medium text-[var(--text)]">{percent}%</span>
                        </div>
                        <p className="mt-2 text-lg font-semibold text-[var(--text)]">{value}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <MiddleStat label="Pods" value={`${podCount}`} detail={`${healthyPodCount} ready or running`} tone="emerald" />
                <MiddleStat label="Incidents" value={`${openIncidents}`} detail={`${majorIncidents + criticalIncidents} elevated severity`} tone="amber" />
                <MiddleStat label="Critical" value={`${criticalIncidents}`} detail="Open critical incidents" tone="red" />
              </div>
            </div>
          )}
        </Panel>

        <Panel
          eyebrow="Incidents"
          title="Recent incidents"
          subtitle="Latest incident activity."
          className="min-h-[420px]"
          right={
            <div className="flex items-center gap-2">
              <Link href={`/dashboard/clusters/${clusterId}/limits?metric=open_incidents`} className="btn-secondary h-9 rounded-xl px-3 text-xs">
                Set limit
              </Link>
              <Link href={`/dashboard/clusters/${clusterId}/incidents`} className="text-sm font-medium text-[var(--primary)] hover:underline">
                View all
              </Link>
            </div>
          }
        >
          {!recentIncidents.length ? (
            <DashboardUnavailableState message="No incidents detected for the selected cluster and time window." />
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <MiddleStat label="Open" value={`${openIncidents}`} detail="Current incident rows" tone="red" />
                <MiddleStat label="Critical" value={`${criticalIncidents}`} detail="Need immediate attention" tone="red" />
                <MiddleStat label="Major" value={`${majorIncidents}`} detail="Degraded or unstable" tone="amber" />
              </div>
              {recentIncidents.map((incident) => {
                const tone = severityChipClass(incident.severity);
                const target = incident.resource_kind && incident.resource_name
                  ? resourceHref(clusterId, { kind: incident.resource_kind, namespace: incident.namespace || "_cluster", name: incident.resource_name })
                  : `/dashboard/clusters/${clusterId}/incidents`;
                return (
                  <Link key={incident.id} href={target} className="block rounded-xl border border-[var(--border)] bg-[var(--bg)]/55 px-4 py-3 transition hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]/60">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`status-chip ${tone}`}>{incident.severity}</span>
                          <span className="text-xs text-[var(--text-soft)]">{incident.incident_type}</span>
                          <span className="text-xs text-[var(--text-soft)]">{incident.status}</span>
                        </div>
                        <p className="mt-2 truncate text-sm font-medium text-[var(--text)]">{incident.title}</p>
                        <p className="mt-1 text-sm text-[var(--text-muted)]">
                          {incident.namespace || "cluster"}{incident.workload_name ? ` / ${incident.workload_name}` : incident.pod_name ? ` / ${incident.pod_name}` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-[var(--text-soft)]">{formatRelativeTime(incident.last_seen_at)}</p>
                        <p className="mt-2 text-xs text-[var(--text-soft)]">{incident.occurrence_count} hit{incident.occurrence_count === 1 ? "" : "s"}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel
          eyebrow="AI"
          title="AI insights"
          subtitle="Current incident-backed insights."
          className="min-h-[420px]"
          right={<Link href={`/dashboard/clusters/${clusterId}/ai`} className="text-sm font-medium text-[var(--primary)] hover:underline">Open AI</Link>}
        >
          {!aiInsightItems.length ? (
            <DashboardUnavailableState message="AI insights will appear here after ClusterSage analyzes recent logs, incidents, and events for this cluster." />
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <MiddleStat label="Insights" value={`${aiInsightItems.length}`} detail="Visible in this cluster view" tone="blue" />
                <MiddleStat
                  label="Critical"
                  value={`${aiInsightItems.filter((item) => item.severity === "critical").length}`}
                  detail="Attached to critical incidents"
                  tone="red"
                />
                <MiddleStat
                  label="Actionable"
                  value={`${aiInsightItems.filter((item) => insightTagForIncident(item) !== "Prediction").length}`}
                  detail="Recommendation or investigation"
                  tone="emerald"
                />
              </div>
              {aiInsightItems.map((incident) => (
                <div key={incident.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/55 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`status-chip ${severityChipClass(incident.severity)}`}>{incident.severity}</span>
                          <span className="text-xs text-[var(--text-soft)]">{incident.incident_type}</span>
                        </div>
                        <p className="mt-2 truncate text-sm font-medium text-[var(--text)]">{incident.title}</p>
                        <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{incident.ai_summary}</p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="rounded-full bg-[var(--primary-soft)] px-2.5 py-1 text-xs font-medium text-[var(--primary)]">
                        {insightTagForIncident(incident)}
                      </span>
                      <p className="mt-2 text-xs text-[var(--text-soft)]">{formatRelativeTime(incident.last_seen_at)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>

      <section className="space-y-4">
        <div className="dashboard-panel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="dashboard-shell-meta">Runtime signals</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text)]">Technical telemetry</h2>
            </div>
            <p className="max-w-2xl text-sm text-[var(--text-muted)]">Live usage, network flow, and declared capacity.</p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MiddleStat
              label="Pod CPU"
              value={formatMetricValue(metricsOverview?.pod_cpu_mcores_total || 0, "mcores")}
              detail={timeseriesMetrics.cpu_mcores?.series?.length ? `${timeseriesMetrics.cpu_mcores.series.length} active pod series` : "Waiting for live pod CPU samples"}
              tone="blue"
            />
            <MiddleStat
              label="Pod memory"
              value={formatMetricValue(metricsOverview?.pod_memory_bytes_total || 0, "bytes")}
              detail={timeseriesMetrics.memory_bytes?.series?.length ? `${timeseriesMetrics.memory_bytes.series.length} active pod series` : "Waiting for live pod memory samples"}
              tone="emerald"
            />
            <MiddleStat
              label="Receive"
              value={timeseriesMetrics.network_rx_bytes?.series?.length ? `${timeseriesMetrics.network_rx_bytes.series.length}` : "0"}
              detail="Network receive series in view"
              tone="amber"
            />
            <MiddleStat
              label="Send"
              value={timeseriesMetrics.network_tx_bytes?.series?.length ? `${timeseriesMetrics.network_tx_bytes.series.length}` : "0"}
              detail="Network send series in view"
              tone="red"
            />
          </div>

          <div className="mt-5 grid gap-4 2xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <LineMetricPanel spec={lineMetricSpecs[0]} data={timeseriesMetrics.cpu_mcores} />
              <LineMetricPanel spec={lineMetricSpecs[1]} data={timeseriesMetrics.memory_bytes} />
              <div className="grid gap-4 xl:grid-cols-2">
                <LineMetricPanel spec={lineMetricSpecs[2]} data={timeseriesMetrics.network_rx_bytes} />
                <LineMetricPanel spec={lineMetricSpecs[3]} data={timeseriesMetrics.network_tx_bytes} />
              </div>
            </div>

            <div className="space-y-4">
              <Panel eyebrow="Runtime totals" title="Current runtime totals" subtitle="Latest rolled-up usage seen by ClusterSage.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <StatTile
                    label="Pod CPU"
                    value={formatMetricValue(metricsOverview?.pod_cpu_mcores_total || 0, "mcores")}
                    tone="blue"
                    detail="All sampled pods"
                  />
                  <StatTile
                    label="Pod memory"
                    value={formatMetricValue(metricsOverview?.pod_memory_bytes_total || 0, "bytes")}
                    tone="emerald"
                    detail="All sampled pods"
                  />
                  <StatTile
                    label="Node CPU"
                    value={formatMetricValue(metricsOverview?.node_cpu_mcores_total || 0, "mcores")}
                    tone="amber"
                    detail="All sampled nodes"
                  />
                  <StatTile
                    label="Node memory"
                    value={formatMetricValue(metricsOverview?.node_memory_bytes_total || 0, "bytes")}
                    tone="red"
                    detail="All sampled nodes"
                  />
                </div>
              </Panel>

              <div className="grid gap-4 xl:grid-cols-2">
                <BreakdownPanel spec={breakdownMetricSpecs[0]} data={latestMetrics.request_cpu_cores} />
                <BreakdownPanel spec={breakdownMetricSpecs[1]} data={latestMetrics.limit_cpu_cores} />
                <BreakdownPanel spec={breakdownMetricSpecs[2]} data={latestMetrics.request_memory_bytes} />
                <BreakdownPanel spec={breakdownMetricSpecs[3]} data={latestMetrics.limit_memory_bytes} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="dashboard-panel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="dashboard-shell-meta">Operational distribution</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text)]">Hot spots and workload shape</h2>
            </div>
            <p className="max-w-2xl text-sm text-[var(--text-muted)]">Namespace density, workload state, and top consumers.</p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MiddleStat label="Namespaces" value={`${namespaceOptions.filter((item) => item !== "All").length}`} detail="Discovered from current catalog" tone="blue" />
            <MiddleStat label="Pods" value={`${podCount}`} detail="Inventory snapshot scope" tone="emerald" />
            <MiddleStat label="Workloads" value={`${workloadCount}`} detail="Controllers in current snapshot" tone="amber" />
            <MiddleStat label="Incidents" value={`${openIncidents}`} detail="Linked to visible resources" tone="red" />
          </div>

          <div className="mt-5 grid gap-4 2xl:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-4">
              <NamespaceTable
                resources={resources}
                incidents={incidents}
                namespaceFilter={selectedNamespace}
                right={<Link href={`/dashboard/clusters/${clusterId}/limits?metric=warning_events`} className="btn-secondary h-9 rounded-xl px-3 text-xs">Set limit</Link>}
              />
              <div className="grid gap-4 xl:grid-cols-2">
                <RollupList title="Top pods by CPU" subtitle="Highest live pod CPU samples." items={metricsOverview?.top_pods_by_cpu || []} />
                <RollupList title="Top pods by memory" subtitle="Highest live pod memory samples." items={metricsOverview?.top_pods_by_memory || []} />
              </div>
            </div>

            <div className="space-y-4">
              <WorkloadTable
                clusterId={clusterId}
                resources={resources}
                incidents={incidents}
                namespaceFilter={selectedNamespace}
                workloadFilter={selectedWorkload}
                right={<Link href={`/dashboard/clusters/${clusterId}/limits?metric=pod_restarts`} className="btn-secondary h-9 rounded-xl px-3 text-xs">Set limit</Link>}
              />
              <div className="grid gap-4 xl:grid-cols-2">
                <RollupList title="Top nodes by CPU" subtitle="Highest live node CPU samples." items={metricsOverview?.top_nodes_by_cpu || []} />
                <RollupList title="Top nodes by memory" subtitle="Highest live node memory samples." items={metricsOverview?.top_nodes_by_memory || []} />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
