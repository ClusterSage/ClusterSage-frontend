"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type {
  AlertEvent,
  AlertLimit,
  AlertLimitCreateRequest,
  AlertLimitMetricType,
  AlertLimitOperator,
  AlertLimitScopeType,
  AlertLimitSeverity,
  AlertLimitUpdateRequest,
} from "@/types/api";

type MetricConfig = {
  label: string;
  description: string;
  clusterOnly?: boolean;
  defaultOperator: AlertLimitOperator;
  defaultSeverity: AlertLimitSeverity;
  defaultThreshold: number;
  defaultWindowMinutes: number;
  defaultCooldownMinutes: number;
};

const metricConfigs: Record<AlertLimitMetricType, MetricConfig> = {
  resource_health: {
    label: "Resources needing attention",
    description: "Counts resources whose latest snapshot status looks unhealthy, pending, failed, or unavailable.",
    defaultOperator: "gt",
    defaultSeverity: "major",
    defaultThreshold: 0,
    defaultWindowMinutes: 5,
    defaultCooldownMinutes: 30,
  },
  pod_restarts: {
    label: "Pod restart count",
    description: "Evaluates restart-heavy pods from the latest resource snapshot data.",
    defaultOperator: "gt",
    defaultSeverity: "major",
    defaultThreshold: 5,
    defaultWindowMinutes: 10,
    defaultCooldownMinutes: 30,
  },
  open_incidents: {
    label: "Open incidents",
    description: "Tracks the total number of currently open incidents for the cluster.",
    clusterOnly: true,
    defaultOperator: "gt",
    defaultSeverity: "critical",
    defaultThreshold: 0,
    defaultWindowMinutes: 5,
    defaultCooldownMinutes: 30,
  },
  critical_incidents: {
    label: "Critical incidents",
    description: "Tracks critical-severity incident count for the cluster.",
    clusterOnly: true,
    defaultOperator: "gt",
    defaultSeverity: "critical",
    defaultThreshold: 0,
    defaultWindowMinutes: 5,
    defaultCooldownMinutes: 30,
  },
  major_incidents: {
    label: "Major incidents",
    description: "Tracks major-severity incident count for the cluster.",
    clusterOnly: true,
    defaultOperator: "gt",
    defaultSeverity: "major",
    defaultThreshold: 0,
    defaultWindowMinutes: 5,
    defaultCooldownMinutes: 30,
  },
  minor_incidents: {
    label: "Minor incidents",
    description: "Tracks minor-severity incident count for the cluster.",
    clusterOnly: true,
    defaultOperator: "gt",
    defaultSeverity: "minor",
    defaultThreshold: 5,
    defaultWindowMinutes: 15,
    defaultCooldownMinutes: 30,
  },
  warning_events: {
    label: "Warning events",
    description: "Tracks warning-type Kubernetes events for the cluster.",
    clusterOnly: true,
    defaultOperator: "gt",
    defaultSeverity: "major",
    defaultThreshold: 20,
    defaultWindowMinutes: 15,
    defaultCooldownMinutes: 30,
  },
};

const metricOptions = Object.entries(metricConfigs) as [AlertLimitMetricType, MetricConfig][];
const operatorLabels: Record<AlertLimitOperator, string> = {
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  eq: "=",
};

const scopeOptions: { value: AlertLimitScopeType; label: string }[] = [
  { value: "cluster", label: "Cluster" },
  { value: "namespace", label: "Namespace" },
  { value: "workload", label: "Workload" },
  { value: "resource", label: "Resource" },
];

type FormState = {
  name: string;
  metric_type: AlertLimitMetricType;
  scope_type: AlertLimitScopeType;
  namespace: string;
  workload_name: string;
  resource_id: string;
  operator: AlertLimitOperator;
  threshold_value: string;
  time_window_minutes: string;
  severity: AlertLimitSeverity;
  email_enabled: boolean;
  notification_email: string;
  enabled: boolean;
  cooldown_minutes: string;
};

function metricLabel(metric: AlertLimitMetricType) {
  return metricConfigs[metric].label;
}

function severityTone(severity: AlertLimitSeverity) {
  if (severity === "critical") return "bg-red-500/15 text-red-200 ring-1 ring-red-400/20";
  if (severity === "major") return "bg-amber-500/15 text-amber-100 ring-1 ring-amber-300/20";
  return "bg-blue-500/15 text-blue-200 ring-1 ring-blue-300/20";
}

function buildDefaults(metric: AlertLimitMetricType): FormState {
  const config = metricConfigs[metric];
  return {
    name: `${config.label} alert`,
    metric_type: metric,
    scope_type: config.clusterOnly ? "cluster" : "cluster",
    namespace: "",
    workload_name: "",
    resource_id: "",
    operator: config.defaultOperator,
    threshold_value: String(config.defaultThreshold),
    time_window_minutes: String(config.defaultWindowMinutes),
    severity: config.defaultSeverity,
    email_enabled: true,
    notification_email: "",
    enabled: true,
    cooldown_minutes: String(config.defaultCooldownMinutes),
  };
}

function buildFormFromLimit(limit: AlertLimit): FormState {
  return {
    name: limit.name,
    metric_type: limit.metric_type,
    scope_type: limit.scope_type,
    namespace: limit.namespace || "",
    workload_name: limit.workload_name || "",
    resource_id: limit.resource_id || "",
    operator: limit.operator,
    threshold_value: String(limit.threshold_value),
    time_window_minutes: String(limit.time_window_minutes),
    severity: limit.severity,
    email_enabled: limit.email_enabled,
    notification_email: limit.notification_email || "",
    enabled: limit.enabled,
    cooldown_minutes: String(limit.cooldown_minutes),
  };
}

function sanitizePayload(form: FormState): AlertLimitCreateRequest {
  const metric = metricConfigs[form.metric_type];
  const scopeType = metric.clusterOnly ? "cluster" : form.scope_type;
  return {
    name: form.name.trim(),
    metric_type: form.metric_type,
    scope_type: scopeType,
    namespace: scopeType === "namespace" ? form.namespace.trim() || null : null,
    workload_name: scopeType === "workload" ? form.workload_name.trim() || null : null,
    resource_id: scopeType === "resource" ? form.resource_id.trim() || null : null,
    operator: form.operator,
    threshold_value: Number(form.threshold_value),
    time_window_minutes: Number(form.time_window_minutes),
    severity: form.severity,
    email_enabled: form.email_enabled,
    notification_email: form.notification_email.trim() ? form.notification_email.trim() : null,
    enabled: form.enabled,
    cooldown_minutes: Number(form.cooldown_minutes),
  };
}

function validateForm(form: FormState): string | null {
  const config = metricConfigs[form.metric_type];
  if (!form.name.trim()) return "Name is required.";
  if (!form.threshold_value.trim() || Number.isNaN(Number(form.threshold_value))) return "Threshold value must be a number.";
  if (!form.time_window_minutes.trim() || Number.isNaN(Number(form.time_window_minutes))) return "Time window must be a number.";
  if (!form.cooldown_minutes.trim() || Number.isNaN(Number(form.cooldown_minutes))) return "Cooldown must be a number.";
  if (Number(form.time_window_minutes) < 1 || Number(form.time_window_minutes) > 1440) return "Time window must be between 1 and 1440 minutes.";
  if (Number(form.cooldown_minutes) < 1 || Number(form.cooldown_minutes) > 10080) return "Cooldown must be between 1 and 10080 minutes.";
  if (!config.clusterOnly && form.scope_type === "namespace" && !form.namespace.trim()) return "Namespace is required for namespace-scoped limits.";
  if (!config.clusterOnly && form.scope_type === "workload" && !form.workload_name.trim()) return "Workload name is required for workload-scoped limits.";
  if (!config.clusterOnly && form.scope_type === "resource" && !form.resource_id.trim()) return "Resource identifier is required for resource-scoped limits.";
  return null;
}

export function ClusterLimitsView({ clusterId, requestedMetric }: { clusterId: string; requestedMetric?: string }) {
  const router = useRouter();
  const [limits, setLimits] = useState<AlertLimit[] | null>(null);
  const [events, setEvents] = useState<AlertEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedLimitId, setSelectedLimitId] = useState<string | null>(null);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [consumedMetric, setConsumedMetric] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => buildDefaults("resource_health"));

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [limitData, eventData] = await Promise.all([
          api<AlertLimit[]>(`/api/clusters/${clusterId}/limits`),
          api<AlertEvent[]>(`/api/clusters/${clusterId}/alert-events`),
        ]);
        if (cancelled) return;
        setLimits(limitData);
        setEvents(eventData);
        setSelectedLimitId((current) => (current && limitData.some((item) => item.id === current) ? current : (limitData[0]?.id || null)));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load alert limits.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [clusterId]);

  useEffect(() => {
    if (!requestedMetric || consumedMetric === requestedMetric) return;
    if (!(requestedMetric in metricConfigs)) {
      setNotice(`The dashboard requested "${requestedMetric}", but that metric is not supported for alert limits yet.`);
      setConsumedMetric(requestedMetric);
      return;
    }
    const metric = requestedMetric as AlertLimitMetricType;
    setForm(buildDefaults(metric));
    setDrawerMode("create");
    setDrawerOpen(true);
    setSelectedLimitId(null);
    setSubmitError("");
    setNotice(`Creating a new alert limit for ${metricLabel(metric)}.`);
    setConsumedMetric(requestedMetric);
    router.replace(`/dashboard/clusters/${clusterId}/limits`, { scroll: false });
  }, [requestedMetric, consumedMetric, clusterId, router]);

  const selectedLimit = useMemo(
    () => limits?.find((item) => item.id === selectedLimitId) || null,
    [limits, selectedLimitId],
  );

  const eventCountsByLimit = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of events || []) {
      counts.set(event.alert_limit_id, (counts.get(event.alert_limit_id) || 0) + 1);
    }
    return counts;
  }, [events]);

  const latestEventByLimit = useMemo(() => {
    const map = new Map<string, AlertEvent>();
    for (const event of events || []) {
      const existing = map.get(event.alert_limit_id);
      if (!existing || new Date(existing.triggered_at).getTime() < new Date(event.triggered_at).getTime()) {
        map.set(event.alert_limit_id, event);
      }
    }
    return map;
  }, [events]);

  const summary = useMemo(
    () => ({
      total: limits?.length || 0,
      enabled: (limits || []).filter((item) => item.enabled).length,
      emailEnabled: (limits || []).filter((item) => item.email_enabled).length,
      triggered: new Set((events || []).map((item) => item.alert_limit_id)).size,
    }),
    [limits, events],
  );

  function openCreate(metric: AlertLimitMetricType = "resource_health") {
    setForm(buildDefaults(metric));
    setDrawerMode("create");
    setDrawerOpen(true);
    setSelectedLimitId(null);
    setSubmitError("");
  }

  function openEdit(limit: AlertLimit) {
    setForm(buildFormFromLimit(limit));
    setDrawerMode("edit");
    setDrawerOpen(true);
    setSelectedLimitId(limit.id);
    setSubmitError("");
  }

  async function refreshData(preferredLimitId?: string | null) {
    const [limitData, eventData] = await Promise.all([
      api<AlertLimit[]>(`/api/clusters/${clusterId}/limits`),
      api<AlertEvent[]>(`/api/clusters/${clusterId}/alert-events`),
    ]);
    setLimits(limitData);
    setEvents(eventData);
    setSelectedLimitId((current) => {
      const target = preferredLimitId ?? current;
      return target && limitData.some((item) => item.id === target) ? target : (limitData[0]?.id || null);
    });
  }

  async function onSubmit() {
    const validationError = validateForm(form);
    if (validationError) {
      setSubmitError(validationError);
      return;
    }
    setSaving(true);
    setSubmitError("");
    setNotice("");
    try {
      const payload = sanitizePayload(form);
      if (drawerMode === "create") {
        const created = await api<AlertLimit>(`/api/clusters/${clusterId}/limits`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        await refreshData(created.id);
        setSelectedLimitId(created.id);
        setDrawerOpen(false);
        setNotice(`Created alert limit "${created.name}".`);
      } else if (selectedLimit) {
        const updated = await api<AlertLimit>(`/api/clusters/${clusterId}/limits/${selectedLimit.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload satisfies AlertLimitUpdateRequest),
        });
        await refreshData(updated.id);
        setSelectedLimitId(updated.id);
        setDrawerOpen(false);
        setNotice(`Updated alert limit "${updated.name}".`);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to save alert limit.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleLimit(limit: AlertLimit, nextEnabled: boolean) {
    setNotice("");
    setError("");
    try {
      const updated = await api<AlertLimit>(`/api/clusters/${clusterId}/limits/${limit.id}/${nextEnabled ? "enable" : "disable"}`, {
        method: "POST",
      });
      setLimits((current) => (current || []).map((item) => (item.id === updated.id ? updated : item)));
      if (selectedLimitId === updated.id) setSelectedLimitId(updated.id);
      setNotice(`${updated.name} ${nextEnabled ? "enabled" : "disabled"}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update limit status.");
    }
  }

  async function deleteLimit(limit: AlertLimit) {
    if (!window.confirm(`Delete alert limit "${limit.name}"? This will also remove its future evaluation definition.`)) return;
    setNotice("");
    setError("");
    try {
      await api<void>(`/api/clusters/${clusterId}/limits/${limit.id}`, { method: "DELETE" });
      const nextLimits = (limits || []).filter((item) => item.id !== limit.id);
      setLimits(nextLimits);
      setSelectedLimitId((current) => (current === limit.id ? (nextLimits[0]?.id || null) : current));
      if (selectedLimitId === limit.id) setDrawerOpen(false);
      setNotice(`Deleted alert limit "${limit.name}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete alert limit.");
    }
  }

  const currentMetricConfig = metricConfigs[form.metric_type];
  const scopedScopeOptions = currentMetricConfig.clusterOnly ? scopeOptions.filter((item) => item.value === "cluster") : scopeOptions;

  if (loading) {
    return <div className="rounded-lg border border-slate-800 bg-slate-900 p-6 text-slate-300">Loading alert limits...</div>;
  }

  return (
    <div className="space-y-6 text-slate-100">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-300">Cluster alerting</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">Limits</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Manage cluster-scoped alert thresholds using the same backend definitions the dashboard hands off into. Only real, currently supported telemetry signals are available here.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800" onClick={() => void refreshData(selectedLimitId)}>
            Refresh
          </button>
          <button className="btn bg-blue-600 hover:bg-blue-500" onClick={() => openCreate()}>
            Add alert limit
          </button>
        </div>
      </div>

      {notice && <div className="rounded-lg border border-blue-800 bg-blue-950/30 p-4 text-blue-100">{notice}</div>}
      {error && <div className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-red-300">{error}</div>}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <p className="text-sm text-slate-400">Total limits</p>
          <p className="mt-2 text-2xl font-bold text-white">{summary.total}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <p className="text-sm text-slate-400">Enabled</p>
          <p className="mt-2 text-2xl font-bold text-emerald-300">{summary.enabled}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <p className="text-sm text-slate-400">Email notifications</p>
          <p className="mt-2 text-2xl font-bold text-blue-300">{summary.emailEnabled}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <p className="text-sm text-slate-400">Triggered historically</p>
          <p className="mt-2 text-2xl font-bold text-amber-300">{summary.triggered}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.9fr)]">
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-lg font-semibold text-white">Supported signals</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {metricOptions.map(([metric, config]) => (
                <button
                  key={metric}
                  className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-left transition hover:border-blue-400/30 hover:bg-slate-950"
                  onClick={() => openCreate(metric)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-white">{config.label}</p>
                    {config.clusterOnly && <span className="rounded-full bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-300">Cluster only</span>}
                  </div>
                  <p className="mt-2 text-sm text-slate-400">{config.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900">
            <div className="border-b border-slate-800 px-4 py-4">
              <h2 className="text-lg font-semibold text-white">Configured limits</h2>
            </div>
            {limits && limits.length === 0 && (
              <div className="p-6 text-sm text-slate-300">
                <p className="font-medium text-white">No alert limits yet.</p>
                <p className="mt-2 text-slate-400">
                  Start from a supported signal above, or use the dashboard&apos;s Set limit actions for alertable cards.
                </p>
              </div>
            )}
            <div className="divide-y divide-slate-800">
              {(limits || []).map((limit) => {
                const latestEvent = latestEventByLimit.get(limit.id);
                const eventCount = eventCountsByLimit.get(limit.id) || 0;
                return (
                  <div
                    key={limit.id}
                    className={`p-4 ${selectedLimitId === limit.id ? "bg-slate-950/50" : ""}`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <button className="min-w-0 flex-1 text-left" onClick={() => setSelectedLimitId(limit.id)}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${severityTone(limit.severity)}`}>
                            {limit.severity}
                          </span>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${limit.enabled ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-800 text-slate-300"}`}>
                            {limit.enabled ? "Enabled" : "Disabled"}
                          </span>
                          <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300">{metricLabel(limit.metric_type)}</span>
                        </div>
                        <h3 className="mt-3 text-base font-semibold text-white">{limit.name}</h3>
                        <p className="mt-2 text-sm text-slate-400">
                          Trigger when {metricLabel(limit.metric_type).toLowerCase()} {operatorLabels[limit.operator]} {limit.threshold_value} for {limit.time_window_minutes} minute{limit.time_window_minutes === 1 ? "" : "s"}.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                          <span>Scope: {limit.scope_type}</span>
                          {limit.namespace && <span>Namespace: {limit.namespace}</span>}
                          {limit.workload_name && <span>Workload: {limit.workload_name}</span>}
                          {limit.resource_id && <span>Resource: {limit.resource_id}</span>}
                          <span>Cooldown: {limit.cooldown_minutes}m</span>
                          <span>{limit.email_enabled ? `Email: ${limit.notification_email || "default user email"}` : "Email disabled"}</span>
                          <span>{eventCount} event{eventCount === 1 ? "" : "s"}</span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          Last triggered: {limit.last_triggered_at ? new Date(limit.last_triggered_at).toLocaleString() : "Never"}
                          {latestEvent ? ` | Latest event ${new Date(latestEvent.triggered_at).toLocaleString()}` : ""}
                        </p>
                      </button>
                      <div className="flex flex-wrap gap-2">
                        <button className="btn-secondary border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800" onClick={() => openEdit(limit)}>
                          Edit
                        </button>
                        <button
                          className="btn-secondary border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
                          onClick={() => void toggleLimit(limit, !limit.enabled)}
                        >
                          {limit.enabled ? "Disable" : "Enable"}
                        </button>
                        <button className="btn-secondary border-red-900 bg-red-950/40 text-red-200 hover:bg-red-950/60" onClick={() => void deleteLimit(limit)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900">
            <div className="border-b border-slate-800 px-4 py-4">
              <h2 className="text-lg font-semibold text-white">Trigger history</h2>
              <p className="mt-1 text-sm text-slate-400">This will stay mostly empty until backend alert evaluation is wired in a later phase.</p>
            </div>
            {events && events.length === 0 && <div className="p-6 text-sm text-slate-400">No alert events have been recorded yet.</div>}
            {events && events.length > 0 && (
              <div className="divide-y divide-slate-800">
                {events.slice(0, 12).map((event) => (
                  <div key={event.id} className="flex flex-col gap-2 px-4 py-3 text-sm text-slate-300 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium text-white">{(limits || []).find((item) => item.id === event.alert_limit_id)?.name || "Unknown limit"}</p>
                      <p className="mt-1 text-slate-400">
                        Threshold {event.threshold_value}
                        {event.metric_value !== null && event.metric_value !== undefined ? ` | Observed ${event.metric_value}` : ""}
                      </p>
                    </div>
                    <div className="text-xs text-slate-500">
                      <p>{new Date(event.triggered_at).toLocaleString()}</p>
                      <p>{event.notification_sent ? "Notification sent" : event.notification_error || "Notification not sent"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-blue-300">{drawerMode === "create" ? "Create limit" : "Edit limit"}</p>
                <h2 className="mt-1 text-xl font-semibold text-white">
                  {drawerOpen ? (drawerMode === "create" ? "New alert limit" : selectedLimit?.name || "Update alert limit") : "Limit details"}
                </h2>
              </div>
              {drawerOpen ? (
                <button className="text-sm font-medium text-slate-400 hover:text-white" onClick={() => setDrawerOpen(false)}>
                  Close
                </button>
              ) : (
                <button className="btn-secondary border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800" onClick={() => openCreate()}>
                  New
                </button>
              )}
            </div>

            {!drawerOpen && selectedLimit && (
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${severityTone(selectedLimit.severity)}`}>
                    {selectedLimit.severity}
                  </span>
                  <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300">{metricLabel(selectedLimit.metric_type)}</span>
                </div>
                <p className="text-sm text-slate-300">{selectedLimit.name}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Threshold</p>
                    <p className="mt-1 text-sm text-slate-300">{operatorLabels[selectedLimit.operator]} {selectedLimit.threshold_value}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Time window</p>
                    <p className="mt-1 text-sm text-slate-300">{selectedLimit.time_window_minutes} minutes</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Scope</p>
                    <p className="mt-1 text-sm text-slate-300">{selectedLimit.scope_type}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cooldown</p>
                    <p className="mt-1 text-sm text-slate-300">{selectedLimit.cooldown_minutes} minutes</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-secondary border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800" onClick={() => openEdit(selectedLimit)}>
                    Edit this limit
                  </button>
                  <button
                    className="btn-secondary border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
                    onClick={() => void toggleLimit(selectedLimit, !selectedLimit.enabled)}
                  >
                    {selectedLimit.enabled ? "Disable" : "Enable"}
                  </button>
                </div>
              </div>
            )}

            {!drawerOpen && !selectedLimit && (
              <div className="mt-4 rounded-lg border border-dashed border-slate-700 bg-slate-950/40 p-4 text-sm text-slate-400">
                Select a configured limit or create a new one from a supported signal.
              </div>
            )}

            {drawerOpen && (
              <div className="mt-5 space-y-4">
                {submitError && <div className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">{submitError}</div>}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-200">Name</label>
                  <input className="input border-slate-700 bg-slate-950 text-slate-100" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-200">Metric</label>
                  <select
                    className="input border-slate-700 bg-slate-950 text-slate-100"
                    value={form.metric_type}
                    onChange={(event) => {
                      const nextMetric = event.target.value as AlertLimitMetricType;
                      const defaults = buildDefaults(nextMetric);
                      setForm((current) => ({
                        ...current,
                        metric_type: nextMetric,
                        scope_type: defaults.scope_type,
                        operator: defaults.operator,
                        threshold_value: defaults.threshold_value,
                        time_window_minutes: defaults.time_window_minutes,
                        severity: defaults.severity,
                        cooldown_minutes: defaults.cooldown_minutes,
                      }));
                    }}
                  >
                    {metricOptions.map(([metric, config]) => (
                      <option key={metric} value={metric}>
                        {config.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-slate-500">{currentMetricConfig.description}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-200">Scope</label>
                    <select
                      className="input border-slate-700 bg-slate-950 text-slate-100"
                      value={currentMetricConfig.clusterOnly ? "cluster" : form.scope_type}
                      onChange={(event) => setForm((current) => ({ ...current, scope_type: event.target.value as AlertLimitScopeType }))}
                      disabled={currentMetricConfig.clusterOnly}
                    >
                      {scopedScopeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-200">Operator</label>
                    <select className="input border-slate-700 bg-slate-950 text-slate-100" value={form.operator} onChange={(event) => setForm((current) => ({ ...current, operator: event.target.value as AlertLimitOperator }))}>
                      {Object.entries(operatorLabels).map(([operator, label]) => (
                        <option key={operator} value={operator}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {!currentMetricConfig.clusterOnly && form.scope_type === "namespace" && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-200">Namespace</label>
                    <input className="input border-slate-700 bg-slate-950 text-slate-100" value={form.namespace} onChange={(event) => setForm((current) => ({ ...current, namespace: event.target.value }))} placeholder="prod" />
                  </div>
                )}
                {!currentMetricConfig.clusterOnly && form.scope_type === "workload" && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-200">Workload name</label>
                    <input className="input border-slate-700 bg-slate-950 text-slate-100" value={form.workload_name} onChange={(event) => setForm((current) => ({ ...current, workload_name: event.target.value }))} placeholder="platform-api" />
                  </div>
                )}
                {!currentMetricConfig.clusterOnly && form.scope_type === "resource" && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-200">Resource identifier</label>
                    <input className="input border-slate-700 bg-slate-950 text-slate-100" value={form.resource_id} onChange={(event) => setForm((current) => ({ ...current, resource_id: event.target.value }))} placeholder="Pod/default/platform-api-abc123" />
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-200">Threshold value</label>
                    <input className="input border-slate-700 bg-slate-950 text-slate-100" type="number" value={form.threshold_value} onChange={(event) => setForm((current) => ({ ...current, threshold_value: event.target.value }))} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-200">Time window (minutes)</label>
                    <input className="input border-slate-700 bg-slate-950 text-slate-100" type="number" value={form.time_window_minutes} onChange={(event) => setForm((current) => ({ ...current, time_window_minutes: event.target.value }))} />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-200">Severity</label>
                    <select className="input border-slate-700 bg-slate-950 text-slate-100" value={form.severity} onChange={(event) => setForm((current) => ({ ...current, severity: event.target.value as AlertLimitSeverity }))}>
                      <option value="minor">Minor</option>
                      <option value="major">Major</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-200">Cooldown (minutes)</label>
                    <input className="input border-slate-700 bg-slate-950 text-slate-100" type="number" value={form.cooldown_minutes} onChange={(event) => setForm((current) => ({ ...current, cooldown_minutes: event.target.value }))} />
                  </div>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                  <div className="flex items-start gap-3">
                    <input id="limit-email-enabled" className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-950 text-blue-500" type="checkbox" checked={form.email_enabled} onChange={(event) => setForm((current) => ({ ...current, email_enabled: event.target.checked }))} />
                    <div className="min-w-0 flex-1">
                      <label htmlFor="limit-email-enabled" className="text-sm font-medium text-slate-200">Email notification enabled</label>
                      <p className="mt-1 text-xs text-slate-500">The backend stores the email target now. Actual alert evaluation and delivery are added in a later phase.</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="mb-2 block text-sm font-medium text-slate-200">Notification email</label>
                    <input className="input border-slate-700 bg-slate-950 text-slate-100" type="email" value={form.notification_email} onChange={(event) => setForm((current) => ({ ...current, notification_email: event.target.value }))} placeholder="Leave blank to use your account email" />
                  </div>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                  <div className="flex items-start gap-3">
                    <input id="limit-enabled" className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-950 text-blue-500" type="checkbox" checked={form.enabled} onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))} />
                    <div className="min-w-0 flex-1">
                      <label htmlFor="limit-enabled" className="text-sm font-medium text-slate-200">Enable immediately</label>
                      <p className="mt-1 text-xs text-slate-500">You can also save a definition disabled and turn it on later.</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button className="btn bg-blue-600 hover:bg-blue-500" onClick={() => void onSubmit()} disabled={saving}>
                    {saving ? "Saving..." : drawerMode === "create" ? "Create limit" : "Save changes"}
                  </button>
                  <button className="btn-secondary border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800" onClick={() => setDrawerOpen(false)} disabled={saving}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/70 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Unsupported for now</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-400">
              <li>CPU usage thresholds are not offered because the current agent/backend do not store CPU metrics.</li>
              <li>Memory usage thresholds are not offered because no memory metrics pipeline exists yet.</li>
              <li>Pod status distribution is dashboard-visible, but it is inventory-only and not exposed as a limit type.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
