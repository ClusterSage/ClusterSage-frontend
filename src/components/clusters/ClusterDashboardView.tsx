"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { DashboardMetricCard } from "@/components/clusters/dashboard/DashboardMetricCard";
import { DashboardPanel as Panel } from "@/components/clusters/dashboard/DashboardPanel";
import { DashboardUnavailableState } from "@/components/clusters/dashboard/DashboardUnavailableState";
import type {
  AIIncident,
  AlertEvent,
  Cluster,
  ClusterMetricFilterCatalog,
  ClusterMetricLatest,
  ClusterMetricLatestBreakdownItem,
  ClusterMetricTimeseries,
  ClusterMetricTimeseriesPoint,
  ResourceSummary,
} from "@/types/api";

type CountTone = "blue" | "amber" | "red" | "emerald" | "slate";
type SeriesLine = {
  label: string;
  color: string;
  points: ClusterMetricTimeseriesPoint[];
  unit?: string | null;
};

const timeRangeOptions = [
  { label: "Last 1 hour", value: "60", step: "5" },
  { label: "Last 6 hours", value: "360", step: "10" },
  { label: "Last 24 hours", value: "1440", step: "20" },
  { label: "Last 7 days", value: "10080", step: "120" },
];

const incidentWindowOptions = [
  { label: "1h", value: 60 },
  { label: "6h", value: 360 },
  { label: "24h", value: 1440 },
  { label: "7d", value: 10080 },
];

const latestMetricKeys = [
  "request_cpu_cores",
  "limit_cpu_cores",
  "request_memory_bytes",
  "limit_memory_bytes",
  "cpu_mcores_node",
  "memory_bytes_node",
  "allocatable_cpu_cores",
  "allocatable_memory_bytes",
  "fs_used_bytes",
  "fs_capacity_bytes",
] as const;

const timeseriesMetricKeys = [
  "cpu_used",
  "cpu_requested",
  "cpu_limit",
  "memory_used",
  "memory_requested",
  "memory_limit",
  "memory_node",
  "network_rx",
  "network_tx",
] as const;

function toneHex(tone: CountTone) {
  switch (tone) {
    case "red":
      return "#ff5f56";
    case "amber":
      return "#ffb020";
    case "emerald":
      return "#6ad46a";
    case "slate":
      return "#94a3b8";
    default:
      return "#60a5fa";
  }
}

function iconFor(kind: "alerts" | "cluster" | "nodes" | "workloads" | "incidents" | "pods") {
  const stroke = "currentColor";
  switch (kind) {
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

function formatMetricValue(value: number, unit?: string | null) {
  if (!Number.isFinite(value)) return "n/a";
  if (unit === "mcores") {
    if (value >= 1000) return `${(value / 1000).toFixed(1)} cores`;
    return `${Math.round(value)} mCPU`;
  }
  if (unit === "cores") return `${value.toFixed(value >= 10 ? 0 : 2)} cores`;
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

function formatRelativeTime(value?: string | null) {
  if (!value) return "Unknown";
  const diffMs = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diffMs)) return "Unknown";
  const minutes = Math.max(1, Math.round(diffMs / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
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

function aggregateTimeseries(label: string, color: string, data?: ClusterMetricTimeseries | null) {
  const grouped = new Map<string, number>();
  for (const series of data?.series || []) {
    for (const point of series.points) {
      grouped.set(point.timestamp, (grouped.get(point.timestamp) || 0) + point.value);
    }
  }
  const points = Array.from(grouped.entries())
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .map(([timestamp, value]) => ({ timestamp, value }));

  return { label, color, points, unit: data?.unit || null } satisfies SeriesLine;
}

function percentage(numerator: number, denominator: number) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return Math.max(0, Math.min(100, (numerator / denominator) * 100));
}

function sumLatest(data?: ClusterMetricLatest | null) {
  return data?.total_value || 0;
}

function latestBreakdownMap(data?: ClusterMetricLatest | null) {
  const map = new Map<string, ClusterMetricLatestBreakdownItem>();
  for (const item of data?.breakdown || []) {
    const key = item.node_name || item.resource_name;
    map.set(key, item);
  }
  return map;
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
      <select className="input h-10 min-w-0 rounded-xl border-[var(--border-strong)] bg-[var(--bg)]/60 px-3 py-2 text-sm text-[var(--text)]" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function MetricLegend({ lines }: { lines: SeriesLine[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-[var(--text-soft)]">
      {lines.map((line) => (
        <span key={line.label} className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: line.color }} aria-hidden="true" />
          {line.label}
        </span>
      ))}
    </div>
  );
}

function MultiLineChartPanel({
  title,
  lines,
  emptyMessage,
}: {
  title: string;
  lines: SeriesLine[];
  emptyMessage: string;
}) {
  const activeLines = lines.filter((line) => line.points.length > 0);
  const allPoints = activeLines.flatMap((line) => line.points.map((point) => point.value));
  const max = Math.max(...allPoints, 1);
  const mid = max / 2;
  const startLabel = axisTimestamp(activeLines[0]?.points[0]?.timestamp);
  const endLabel = axisTimestamp(activeLines[0]?.points[activeLines[0].points.length - 1]?.timestamp);

  return (
    <Panel title={title}>
      {!activeLines.length ? (
        <DashboardUnavailableState message={emptyMessage} />
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/55 p-3">
            <div className="grid grid-cols-[54px_minmax(0,1fr)] gap-3">
              <div className="flex h-48 flex-col justify-between py-1 text-[11px] text-[var(--text-soft)]">
                <span>{formatMetricValue(max, activeLines[0].unit)}</span>
                <span>{formatMetricValue(mid, activeLines[0].unit)}</span>
                <span>0</span>
              </div>
              <div className="space-y-2">
                <svg viewBox="0 0 100 56" className="h-48 w-full">
                  {[0.25, 0.5, 0.75].map((line) => (
                    <line
                      key={line}
                      x1="0"
                      x2="100"
                      y1={56 * line}
                      y2={56 * line}
                      stroke="rgba(148,163,184,0.18)"
                      strokeWidth="0.6"
                      strokeDasharray="2 3"
                    />
                  ))}
                  {activeLines.map((line) => {
                    const values = line.points.map((point) => point.value);
                    const path = buildLinePath(values, 100, 56);
                    return <path key={line.label} d={path} fill="none" stroke={line.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />;
                  })}
                </svg>
                <div className="flex items-center justify-between text-[11px] text-[var(--text-soft)]">
                  <span>{startLabel}</span>
                  <span>{endLabel}</span>
                </div>
              </div>
            </div>
          </div>
          <MetricLegend lines={activeLines} />
        </div>
      )}
    </Panel>
  );
}

function DonutStatusPanel({
  running,
  pending,
  failed,
}: {
  running: number;
  pending: number;
  failed: number;
}) {
  const total = Math.max(running + pending + failed, 1);
  const segments = [
    { label: "Running", value: running, color: "#6ad46a" },
    { label: "Pending", value: pending, color: "#ffb020" },
    { label: "Failed", value: failed, color: "#ff5f56" },
  ];
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <Panel title="Pod Status">
      <div className="grid gap-4 lg:grid-cols-[170px_minmax(0,1fr)] lg:items-center">
        <div className="relative mx-auto h-44 w-44">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(148,163,184,0.16)" strokeWidth="12" />
            {segments.map((segment) => {
              const stroke = (segment.value / total) * circumference;
              const currentOffset = offset;
              offset += stroke;
              return (
                <circle
                  key={segment.label}
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${stroke} ${circumference - stroke}`}
                  strokeDashoffset={-currentOffset}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="text-3xl font-semibold tracking-tight text-[var(--text)]">{Math.round((running / total) * 100)}%</p>
              <p className="mt-1 text-sm text-[var(--text-soft)]">Running</p>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          {segments.map((segment) => (
            <div key={segment.label} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)]/55 px-3 py-3">
              <div className="inline-flex items-center gap-3 text-sm text-[var(--text)]">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: segment.color }} aria-hidden="true" />
                {segment.label}
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-[var(--text)]">{segment.value}</p>
                <p className="text-[11px] text-[var(--text-soft)]">{percentage(segment.value, total).toFixed(1)}%</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function HorizontalBarsPanel({
  title,
  rows,
  unitSuffix = "",
}: {
  title: string;
  rows: { label: string; value: number }[];
  unitSuffix?: string;
}) {
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <Panel title={title}>
      {!rows.length ? (
        <DashboardUnavailableState message="No data is available for this panel right now." />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.label} className="grid grid-cols-[minmax(0,1fr)_56px] items-center gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-[var(--text)]">{row.label}</span>
                  <span className="font-medium text-[var(--text)]">{Math.round(row.value)}{unitSuffix}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                  <div className="h-3 rounded-full bg-[#79d36f]" style={{ width: `${Math.max(8, (row.value / max) * 100)}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function NodePercentPanel({
  title,
  rows,
  accent,
}: {
  title: string;
  rows: { label: string; percent: number }[];
  accent: string;
}) {
  return (
    <Panel title={title}>
      {!rows.length ? (
        <DashboardUnavailableState message="No node samples are available for this panel right now." />
      ) : (
        <div className="space-y-2.5">
          {rows.map((row) => (
            <div key={row.label} className="grid grid-cols-[minmax(0,1fr)_72px] items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)]/55 px-3 py-3">
              <span className="truncate text-sm text-[var(--text)]">{row.label}</span>
              <span className="text-right text-sm font-semibold text-[var(--text)]">{row.percent.toFixed(1)}%</span>
              <div className="col-span-2 h-2 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                <div className="h-2 rounded-full" style={{ width: `${Math.max(6, row.percent)}%`, backgroundColor: accent }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function TopPodsTablePanel({
  rows,
}: {
  rows: { pod: string; namespace: string; percent: number }[];
}) {
  return (
    <Panel title="Top CPU Consuming Pods">
      {!rows.length ? (
        <DashboardUnavailableState message="No pod CPU samples are available for this panel right now." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--border)]">
          <table className="min-w-full divide-y divide-[var(--border)] text-sm">
            <thead className="bg-[var(--bg)]/60 text-left text-[11px] uppercase tracking-[0.16em] text-[var(--text-soft)]">
              <tr>
                <th className="px-3 py-3">Pod</th>
                <th className="px-3 py-3">Namespace</th>
                <th className="px-3 py-3 text-right">CPU %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] bg-[var(--bg-elevated)]">
              {rows.map((row) => (
                <tr key={`${row.namespace}:${row.pod}`}>
                  <td className="px-3 py-3 text-[var(--text)]">{row.pod}</td>
                  <td className="px-3 py-3 text-[var(--text-soft)]">{row.namespace}</td>
                  <td className="px-3 py-3 text-right font-medium text-[var(--text)]">{row.percent.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function IncidentFeedPanel({
  incidents,
  timeWindow,
  onChange,
}: {
  incidents: AIIncident[];
  timeWindow: number;
  onChange: (value: number) => void;
}) {
  return (
    <Panel
      title="Incidents"
      right={
        <select
          className="input h-9 w-[96px] rounded-xl border-[var(--border-strong)] bg-[var(--bg)]/60 px-3 py-1.5 text-xs text-[var(--text)]"
          value={timeWindow}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label="Incident time filter"
        >
          {incidentWindowOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      }
    >
      {!incidents.length ? (
        <DashboardUnavailableState message="No incidents fall inside the selected time range." />
      ) : (
        <div className="space-y-2.5">
          {incidents.slice(0, 5).map((incident) => (
            <div key={incident.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/55 px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`status-chip ${severityChipClass(incident.severity)}`}>{incident.severity}</span>
                    <span className="text-[11px] text-[var(--text-soft)]">{incident.incident_type}</span>
                  </div>
                  <p className="mt-2 truncate text-sm font-medium text-[var(--text)]">{incident.title}</p>
                  <p className="mt-1 truncate text-[11px] text-[var(--text-soft)]">
                    {incident.namespace || "cluster"}{incident.pod_name ? ` / ${incident.pod_name}` : incident.workload_name ? ` / ${incident.workload_name}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-[var(--text-soft)]">{formatRelativeTime(incident.last_seen_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function LimitsRequestsPanel({
  cpuRequested,
  cpuLimit,
  memoryRequested,
  memoryLimit,
}: {
  cpuRequested: ClusterMetricLatest | null | undefined;
  cpuLimit: ClusterMetricLatest | null | undefined;
  memoryRequested: ClusterMetricLatest | null | undefined;
  memoryLimit: ClusterMetricLatest | null | undefined;
}) {
  return (
    <Panel title="Limits & Requests">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/55 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-soft)]">CPU Requested</p>
          <p className="mt-2 text-xl font-semibold text-[var(--text)]">{formatMetricValue(sumLatest(cpuRequested), cpuRequested?.unit)}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/55 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-soft)]">CPU Limit</p>
          <p className="mt-2 text-xl font-semibold text-[var(--text)]">{formatMetricValue(sumLatest(cpuLimit), cpuLimit?.unit)}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/55 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-soft)]">Memory Requested</p>
          <p className="mt-2 text-xl font-semibold text-[var(--text)]">{formatMetricValue(sumLatest(memoryRequested), memoryRequested?.unit)}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/55 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-soft)]">Memory Limit</p>
          <p className="mt-2 text-xl font-semibold text-[var(--text)]">{formatMetricValue(sumLatest(memoryLimit), memoryLimit?.unit)}</p>
        </div>
      </div>
    </Panel>
  );
}

function AiInsightsPanel({ items }: { items: AIIncident[] }) {
  return (
    <Panel title="AI Insights" subtitle="Recent summaries only">
      {!items.length ? (
        <DashboardUnavailableState message="AI insights will appear here after analysis completes for this cluster." />
      ) : (
        <div className="space-y-3">
          {items.slice(0, 3).map((incident) => (
            <div key={incident.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/55 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`status-chip ${severityChipClass(incident.severity)}`}>{incident.severity}</span>
                    <span className="text-[11px] text-[var(--text-soft)]">{insightTagForIncident(incident)}</span>
                  </div>
                  <p className="mt-2 truncate text-sm font-medium text-[var(--text)]">{incident.title}</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{incident.ai_summary}</p>
                </div>
                <span className="shrink-0 text-[11px] text-[var(--text-soft)]">{formatRelativeTime(incident.last_seen_at)}</span>
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
  metricsOverview: { collected_at?: string | null; top_pods_by_cpu: { label: string; namespace?: string | null; value: number; unit: string }[]; top_nodes_by_cpu: { label: string; namespace?: string | null; value: number; unit: string }[]; top_nodes_by_memory: { label: string; namespace?: string | null; value: number; unit: string }[] } | null;
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
  const [incidentWindow, setIncidentWindow] = useState(1440);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [latestMetrics, setLatestMetrics] = useState<Record<string, ClusterMetricLatest>>({});
  const [timeseriesMetrics, setTimeseriesMetrics] = useState<Record<string, ClusterMetricTimeseries>>({});
  const [alertEvents, setAlertEvents] = useState<AlertEvent[]>([]);
  const [metricLoadError, setMetricLoadError] = useState("");

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
    api<AlertEvent[]>(`/api/clusters/${clusterId}/alert-events`)
      .then((data) => setAlertEvents(data))
      .catch(() => setAlertEvents([]));
  }, [clusterId, refreshNonce]);

  useEffect(() => {
    let cancelled = false;

    async function loadMetrics() {
      setLoading(true);
      setMetricLoadError("");
      setLatestMetrics({});
      setTimeseriesMetrics({});
      const selectedWindowOption = timeRangeOptions.find((option) => option.value === selectedWindow) || timeRangeOptions[2];
      const base = new URLSearchParams();
      if (selectedNamespace !== "All") base.set("namespace", selectedNamespace);
      if (selectedNode !== "All") base.set("node_name", selectedNode);
      if (selectedPod !== "All") {
        base.set("scope", "pod");
        base.set("resource_name", selectedPod);
      }

      const latestDefinitions: Record<(typeof latestMetricKeys)[number], URLSearchParams> = {
        request_cpu_cores: new URLSearchParams(base),
        limit_cpu_cores: new URLSearchParams(base),
        request_memory_bytes: new URLSearchParams(base),
        limit_memory_bytes: new URLSearchParams(base),
        cpu_mcores_node: new URLSearchParams(base),
        memory_bytes_node: new URLSearchParams(base),
        allocatable_cpu_cores: new URLSearchParams(base),
        allocatable_memory_bytes: new URLSearchParams(base),
        fs_used_bytes: new URLSearchParams(base),
        fs_capacity_bytes: new URLSearchParams(base),
      };

      latestDefinitions.request_cpu_cores.set("metric_name", "request_cpu_cores");
      latestDefinitions.limit_cpu_cores.set("metric_name", "limit_cpu_cores");
      latestDefinitions.request_memory_bytes.set("metric_name", "request_memory_bytes");
      latestDefinitions.limit_memory_bytes.set("metric_name", "limit_memory_bytes");
      latestDefinitions.cpu_mcores_node.set("metric_name", "cpu_mcores");
      latestDefinitions.cpu_mcores_node.set("scope", "node");
      latestDefinitions.memory_bytes_node.set("metric_name", "memory_bytes");
      latestDefinitions.memory_bytes_node.set("scope", "node");
      latestDefinitions.allocatable_cpu_cores.set("metric_name", "allocatable_cpu_cores");
      latestDefinitions.allocatable_cpu_cores.set("scope", "node");
      latestDefinitions.allocatable_memory_bytes.set("metric_name", "allocatable_memory_bytes");
      latestDefinitions.allocatable_memory_bytes.set("scope", "node");
      latestDefinitions.fs_used_bytes.set("metric_name", "fs_used_bytes");
      latestDefinitions.fs_used_bytes.set("scope", "node");
      latestDefinitions.fs_capacity_bytes.set("metric_name", "fs_capacity_bytes");
      latestDefinitions.fs_capacity_bytes.set("scope", "node");

      const latestResults = await Promise.allSettled(
        latestMetricKeys.map(async (key) => [key, await api<ClusterMetricLatest>(`/api/clusters/${clusterId}/metrics/latest?${latestDefinitions[key].toString()}`)] as const),
      );

      const timeseriesDefinitions: Record<(typeof timeseriesMetricKeys)[number], URLSearchParams> = {
        cpu_used: new URLSearchParams(base),
        cpu_requested: new URLSearchParams(base),
        cpu_limit: new URLSearchParams(base),
        memory_used: new URLSearchParams(base),
        memory_requested: new URLSearchParams(base),
        memory_limit: new URLSearchParams(base),
        memory_node: new URLSearchParams(base),
        network_rx: new URLSearchParams(base),
        network_tx: new URLSearchParams(base),
      };

      for (const params of Object.values(timeseriesDefinitions)) {
        params.set("window_minutes", selectedWindowOption.value);
        params.set("step_minutes", selectedWindowOption.step);
        params.set("limit", "12");
      }

      timeseriesDefinitions.cpu_used.set("metric_name", "cpu_mcores");
      timeseriesDefinitions.cpu_used.set("scope", "pod");
      timeseriesDefinitions.cpu_requested.set("metric_name", "request_cpu_cores");
      timeseriesDefinitions.cpu_limit.set("metric_name", "limit_cpu_cores");
      timeseriesDefinitions.memory_used.set("metric_name", "memory_bytes");
      timeseriesDefinitions.memory_used.set("scope", "pod");
      timeseriesDefinitions.memory_requested.set("metric_name", "request_memory_bytes");
      timeseriesDefinitions.memory_limit.set("metric_name", "limit_memory_bytes");
      timeseriesDefinitions.memory_node.set("metric_name", "memory_bytes");
      timeseriesDefinitions.memory_node.set("scope", "node");
      timeseriesDefinitions.network_rx.set("metric_name", "network_rx_bytes");
      timeseriesDefinitions.network_rx.set("scope", "node");
      timeseriesDefinitions.network_tx.set("metric_name", "network_tx_bytes");
      timeseriesDefinitions.network_tx.set("scope", "node");

      const timeseriesResults = await Promise.allSettled(
        timeseriesMetricKeys.map(async (key) => [key, await api<ClusterMetricTimeseries>(`/api/clusters/${clusterId}/metrics/timeseries?${timeseriesDefinitions[key].toString()}`)] as const),
      );

      if (!cancelled) {
        const latestEntries = latestResults
          .map((result) => (result.status === "fulfilled" ? result.value : null))
          .filter((value): value is readonly [(typeof latestMetricKeys)[number], ClusterMetricLatest] => value !== null);
        const timeseriesEntries = timeseriesResults
          .map((result) => (result.status === "fulfilled" ? result.value : null))
          .filter((value): value is readonly [(typeof timeseriesMetricKeys)[number], ClusterMetricTimeseries] => value !== null);
        const failedCount =
          latestResults.filter((result) => result.status === "rejected").length +
          timeseriesResults.filter((result) => result.status === "rejected").length;

        if (latestEntries.length > 0) setLatestMetrics(Object.fromEntries(latestEntries));
        if (timeseriesEntries.length > 0) setTimeseriesMetrics(Object.fromEntries(timeseriesEntries));
        if (failedCount > 0) {
          setMetricLoadError(
            failedCount === 1
              ? "One metric request failed during loading. The dashboard is showing partial data."
              : `${failedCount} metric requests failed during loading. The dashboard is showing partial data.`,
          );
        }
        setLoading(false);
      }
    }

    void loadMetrics().catch(() => {
      if (!cancelled) {
        setMetricLoadError("Failed to load dashboard metrics.");
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [clusterId, refreshNonce, selectedNamespace, selectedNode, selectedPod, selectedWindow]);

  const nodeOptions = useMemo(() => ["All", ...(catalog?.nodes || [])], [catalog]);
  const namespaceOptions = useMemo(() => ["All", ...(catalog?.namespaces || [])], [catalog]);
  const workloadOptions = useMemo(() => ["All", ...(catalog?.workloads || [])], [catalog]);
  const podOptions = useMemo(() => ["All", ...(catalog?.pods || [])], [catalog]);
  const selectedWindowOption = useMemo(
    () => timeRangeOptions.find((option) => option.value === selectedWindow) || timeRangeOptions[2],
    [selectedWindow],
  );

  const nodeCount = useMemo(() => {
    const explicitNodes = resources.filter((item) => item.kind === "Node").length;
    if (explicitNodes) return explicitNodes;
    const names = new Set(resources.map((item) => item.node_name).filter((item): item is string => Boolean(item)));
    for (const node of catalog?.nodes || []) names.add(node);
    return names.size;
  }, [catalog?.nodes, resources]);

  const namespaceCount = useMemo(() => {
    if (catalog?.namespaces?.length) return catalog.namespaces.length;
    return new Set(resources.map((item) => item.namespace).filter((item): item is string => Boolean(item))).size;
  }, [catalog?.namespaces, resources]);

  const workloadCount = resources.filter((item) => ["Deployment", "StatefulSet", "DaemonSet", "Job", "CronJob"].includes(item.kind)).length;
  const podCount = resources.filter((item) => item.kind === "Pod").length;
  const openIncidents = incidents.filter((item) => item.status === "open").length;
  const criticalIncidents = incidents.filter((item) => item.severity === "critical" && item.status === "open").length;
  const connectionLabel = cluster.status?.toLowerCase() === "connected" || cluster.status?.toLowerCase() === "healthy" ? "Connected" : cluster.status || "Unknown";

  const alertCount = useMemo(() => {
    const threshold = Date.now() - Number(selectedWindowOption.value) * 60 * 1000;
    return alertEvents.filter((event) => new Date(event.triggered_at).getTime() >= threshold).length;
  }, [alertEvents, selectedWindowOption.value]);

  const cpuPanelLines = [
    aggregateTimeseries("Used", "#6ad46a", timeseriesMetrics.cpu_used),
    aggregateTimeseries("Requested", "#ffb020", timeseriesMetrics.cpu_requested),
    aggregateTimeseries("Limit", "#60a5fa", timeseriesMetrics.cpu_limit),
  ];

  const memoryPanelLines = [
    aggregateTimeseries("Used", "#6ad46a", timeseriesMetrics.memory_used),
    aggregateTimeseries("Requested", "#ffb020", timeseriesMetrics.memory_requested),
    aggregateTimeseries("Limit", "#60a5fa", timeseriesMetrics.memory_limit),
    aggregateTimeseries("Node", "#b779ff", timeseriesMetrics.memory_node),
  ];

  const networkCombinedLines = [
    aggregateTimeseries("Receive", "#6ad46a", timeseriesMetrics.network_rx),
    aggregateTimeseries("Transmit", "#ffb020", timeseriesMetrics.network_tx),
  ];

  const receiveLines = [aggregateTimeseries("Receive", "#6ad46a", timeseriesMetrics.network_rx)];
  const sendLines = [aggregateTimeseries("Transmit", "#ff8a34", timeseriesMetrics.network_tx)];

  const runningPods = resources.filter((item) => item.kind === "Pod" && /running|ready|healthy/i.test(item.status || "")).length;
  const pendingPods = resources.filter((item) => item.kind === "Pod" && /pending|init|containercreating/i.test(item.status || "")).length;
  const failedPods = resources.filter((item) => item.kind === "Pod" && /fail|error|crash|oom|backoff|unknown/i.test(item.status || "")).length;

  const podsByNamespace = useMemo(() => {
    const counts = new Map<string, number>();
    for (const resource of resources) {
      if (resource.kind !== "Pod") continue;
      const namespace = resource.namespace || "cluster";
      counts.set(namespace, (counts.get(namespace) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [resources]);

  const nodeCpuMap = latestBreakdownMap(latestMetrics.cpu_mcores_node);
  const allocatableCpuMap = latestBreakdownMap(latestMetrics.allocatable_cpu_cores);
  const nodeMemoryMap = latestBreakdownMap(latestMetrics.memory_bytes_node);
  const allocatableMemoryMap = latestBreakdownMap(latestMetrics.allocatable_memory_bytes);
  const fsUsedMap = latestBreakdownMap(latestMetrics.fs_used_bytes);
  const fsCapacityMap = latestBreakdownMap(latestMetrics.fs_capacity_bytes);

  const nodeCpuRows = useMemo(() => {
    return Array.from(nodeCpuMap.values())
      .map((item) => {
        const key = item.node_name || item.resource_name;
        const alloc = allocatableCpuMap.get(key);
        const usedCores = item.value / 1000;
        const percent = percentage(usedCores, alloc?.value || 0);
        return { label: key, percent };
      })
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 8);
  }, [nodeCpuMap, allocatableCpuMap]);

  const nodeMemoryRows = useMemo(() => {
    return Array.from(nodeMemoryMap.values())
      .map((item) => {
        const key = item.node_name || item.resource_name;
        const alloc = allocatableMemoryMap.get(key);
        return { label: key, percent: percentage(item.value, alloc?.value || 0) };
      })
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 8);
  }, [nodeMemoryMap, allocatableMemoryMap]);

  const diskRows = useMemo(() => {
    return Array.from(fsUsedMap.values())
      .map((item) => {
        const key = item.node_name || item.resource_name;
        const capacity = fsCapacityMap.get(key);
        return { label: key, percent: percentage(item.value, capacity?.value || 0) };
      })
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 8);
  }, [fsUsedMap, fsCapacityMap]);

  const topCpuPodsRows = useMemo(() => {
    const totalPodCpu = Math.max(
      (metricsOverview?.top_pods_by_cpu || []).reduce((sum, item) => sum + item.value, 0),
      1,
    );
    return (metricsOverview?.top_pods_by_cpu || [])
      .map((item) => ({
        pod: item.label,
        namespace: item.namespace || "default",
        percent: percentage(item.value, totalPodCpu),
      }))
      .slice(0, 8);
  }, [metricsOverview?.top_pods_by_cpu]);

  const filteredIncidents = useMemo(() => {
    const threshold = Date.now() - incidentWindow * 60 * 1000;
    return [...incidents]
      .filter((incident) => new Date(incident.last_seen_at).getTime() >= threshold)
      .sort((a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime());
  }, [incidentWindow, incidents]);

  const aiInsightItems = useMemo(
    () =>
      [...incidents]
        .filter((item) => Boolean(item.ai_summary))
        .sort((a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime())
        .slice(0, 3),
    [incidents],
  );

  return (
    <div className="space-y-4 text-[var(--text)]">
      <section className="dashboard-panel">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
          <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <label className="flex min-w-0 flex-col gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">Range</span>
              <select
                className="input h-10 min-w-0 rounded-xl border-[var(--border-strong)] bg-[var(--bg)]/60 px-3 py-2 text-sm text-[var(--text)]"
                value={selectedWindow}
                onChange={(event) => setSelectedWindow(event.target.value)}
                aria-label="Range"
              >
                {timeRangeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <FilterSelect label="Node" value={selectedNode} onChange={setSelectedNode} options={nodeOptions} />
            <FilterSelect label="Namespace" value={selectedNamespace} onChange={setSelectedNamespace} options={namespaceOptions} />
            <FilterSelect label="Workload" value={selectedWorkload} onChange={setSelectedWorkload} options={workloadOptions} />
            <FilterSelect label="Pod" value={selectedPod} onChange={setSelectedPod} options={podOptions} />
          </div>
          <div className="flex gap-3 xl:shrink-0">
            <div className="flex min-w-[120px] items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg)]/55 px-3 py-2 text-xs font-medium text-[var(--text-soft)]">
              {connectionLabel}
            </div>
            <button className="btn h-10 rounded-xl px-4" onClick={() => setRefreshNonce((value) => value + 1)}>
              {loading ? "Updating..." : "Update"}
            </button>
          </div>
        </div>
      </section>

      {catalogError ? <div className="rounded-xl border border-[var(--danger-bg)] bg-[var(--danger-bg)] p-4 text-[var(--danger-text)]">{catalogError}</div> : null}
      {metricsError ? <div className="rounded-xl border border-[var(--warning-bg)] bg-[var(--warning-bg)] p-4 text-[var(--warning-text)]">{metricsError}</div> : null}
      {metricLoadError ? <div className="rounded-xl border border-[var(--warning-bg)] bg-[var(--warning-bg)] p-4 text-[var(--warning-text)]">{metricLoadError}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <DashboardMetricCard icon={iconFor("cluster")} label="Clusters" value="1" helper={cluster.name} accent="#6ea8ff" />
        <DashboardMetricCard icon={iconFor("nodes")} label="Nodes" value={`${nodeCount}`} helper={shortTimestamp(catalog?.collected_at)} accent="#7d8bff" />
        <DashboardMetricCard icon={iconFor("workloads")} label="Workloads" value={`${workloadCount}`} helper={`${podCount} pods`} accent="#22c55e" />
        <DashboardMetricCard icon={iconFor("incidents")} label="Incidents" value={`${openIncidents}`} helper={`${criticalIncidents} critical`} accent="#ff5f56" />
        <DashboardMetricCard icon={iconFor("alerts")} label="Alerts" value={`${alertCount}`} helper={selectedWindowOption.label} accent="#ffb020" />
      </section>

      <section className="grid gap-4 2xl:grid-cols-[1.15fr_1.15fr_0.8fr]">
        <MultiLineChartPanel title="CPU Usage" lines={cpuPanelLines} emptyMessage="CPU samples are not available for the current filter selection." />
        <MultiLineChartPanel title="Memory Usage" lines={memoryPanelLines} emptyMessage="Memory samples are not available for the current filter selection." />
        <DonutStatusPanel running={runningPods} pending={pendingPods} failed={failedPods} />
      </section>

      <section className="grid gap-4 2xl:grid-cols-4">
        <HorizontalBarsPanel title="Pods by Namespace" rows={podsByNamespace} />
        <NodePercentPanel title="Node CPU Usage" rows={nodeCpuRows} accent="#79d36f" />
        <NodePercentPanel title="Node Memory Usage" rows={nodeMemoryRows} accent="#ffb020" />
        <TopPodsTablePanel rows={topCpuPodsRows} />
      </section>

      <section className="grid gap-4 2xl:grid-cols-[1.05fr_0.95fr_1fr]">
        <MultiLineChartPanel title="Network I/O" lines={networkCombinedLines} emptyMessage="Network samples are not available for the current filter selection." />
        <NodePercentPanel title="Disk Usage by Node" rows={diskRows} accent="#ff5f56" />
        <IncidentFeedPanel incidents={filteredIncidents} timeWindow={incidentWindow} onChange={setIncidentWindow} />
      </section>

      <section className="grid gap-4 2xl:grid-cols-3">
        <MultiLineChartPanel title="Receive Throughput" lines={receiveLines} emptyMessage="Receive throughput samples are not available for the current filter selection." />
        <MultiLineChartPanel title="Send Throughput" lines={sendLines} emptyMessage="Send throughput samples are not available for the current filter selection." />
        <LimitsRequestsPanel
          cpuRequested={latestMetrics.request_cpu_cores}
          cpuLimit={latestMetrics.limit_cpu_cores}
          memoryRequested={latestMetrics.request_memory_bytes}
          memoryLimit={latestMetrics.limit_memory_bytes}
        />
      </section>

      <section>
        <AiInsightsPanel items={aiInsightItems} />
      </section>
    </div>
  );
}
