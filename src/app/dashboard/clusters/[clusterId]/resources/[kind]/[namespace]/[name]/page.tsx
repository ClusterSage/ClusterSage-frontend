"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { AIIncident, RemediationApprovalResult, ResourceAISuggestion, ResourceLogEntry, ResourceSummary } from "@/types/api";

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
  if (!entries.length) return <p className="text-sm text-[var(--text-muted)]">No labels available.</p>;
  return <div className="flex flex-wrap gap-2">{entries.slice(0, 20).map(([key, value]) => <span key={key} className="rounded-2xl bg-[var(--bg-subtle)] px-2.5 py-1 text-xs text-[var(--text)]">{key}: {value}</span>)}</div>;
}

function severityTone(severity: string) {
  if (severity === "critical") return "bg-[var(--danger-bg)] text-[var(--danger-text)]";
  if (severity === "major") return "bg-[var(--warning-bg)] text-[var(--warning-text)]";
  return "bg-[var(--info-bg)] text-[var(--info-text)]";
}

function riskTone(risk: string) {
  if (risk === "high") return "bg-[var(--danger-bg)] text-[var(--danger-text)]";
  if (risk === "medium") return "bg-[var(--warning-bg)] text-[var(--warning-text)]";
  return "bg-[var(--success-bg)] text-[var(--success-text)]";
}

function evidenceLines(evidence: Record<string, unknown>): { timestamp?: string | null; container?: string | null; message: string }[] {
  const lines = asRecord(evidence).lines;
  if (!Array.isArray(lines)) return [];
  return lines
    .map((item) => asRecord(item))
    .filter((item) => typeof item.message === "string")
    .map((item) => ({
      timestamp: typeof item.timestamp === "string" ? item.timestamp : null,
      container: typeof item.container === "string" ? item.container : null,
      message: String(item.message),
    }));
}

function DetailStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="dashboard-metric-card p-4">
      <p className="dashboard-metric-label">{label}</p>
      <p className="mt-2 break-words text-base font-semibold text-[var(--text)]">{value}</p>
    </div>
  );
}

export default function ResourceDetail({ params }: { params: Promise<{ clusterId: string; kind: string; namespace: string; name: string }> }) {
  const route = use(params);
  const clusterId = route.clusterId;
  const kind = decode(route.kind);
  const namespace = decode(route.namespace);
  const name = decode(route.name);
  const [resource, setResource] = useState<ResourceSummary | null>(null);
  const [logs, setLogs] = useState<ResourceLogEntry[] | null>(null);
  const [incidents, setIncidents] = useState<AIIncident[] | null>(null);
  const [suggestions, setSuggestions] = useState<ResourceAISuggestion[] | null>(null);
  const [tab, setTab] = useState<Tab>("Details");
  const [query, setQuery] = useState("");
  const [incidentSeverity, setIncidentSeverity] = useState("all");
  const [incidentStatus, setIncidentStatus] = useState("all");
  const [incidentContainer, setIncidentContainer] = useState("all");
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [logError, setLogError] = useState("");
  const [incidentError, setIncidentError] = useState("");
  const [suggestionError, setSuggestionError] = useState("");
  const [suggestionActionError, setSuggestionActionError] = useState<Record<string, string>>({});
  const [suggestionActionMessage, setSuggestionActionMessage] = useState<Record<string, string>>({});
  const [suggestionActionLoading, setSuggestionActionLoading] = useState<Record<string, boolean>>({});
  const [approveIntentId, setApproveIntentId] = useState<string | null>(null);
  const [approveConfirmationText, setApproveConfirmationText] = useState("");
  const [approveReason, setApproveReason] = useState("");
  const [logLoading, setLogLoading] = useState(false);
  const [incidentLoading, setIncidentLoading] = useState(false);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    api<ResourceSummary>(`/api/clusters/${clusterId}/resources/${encodeURIComponent(kind)}/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`)
      .then(setResource)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load resource"));
  }, [clusterId, kind, namespace, name]);

  const refreshLogs = useCallback(async (force = false) => {
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
  }, [clusterId, kind, namespace, name, cooldownUntil]);

  useEffect(() => {
    if (tab === "Logs" && logs === null && !logLoading) void refreshLogs(true);
  }, [tab, logs, logLoading, refreshLogs]);

  useEffect(() => {
    if (tab !== "Incidents" || incidents !== null || incidentLoading) return;
    setIncidentError("");
    setIncidentLoading(true);
    api<AIIncident[]>(`/api/clusters/${clusterId}/resources/${encodeURIComponent(kind)}/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/incidents`)
      .then((data) => {
        setIncidents(data);
        setSelectedIncidentId(data[0]?.id || null);
      })
      .catch((err) => setIncidentError(err instanceof Error ? err.message : "Failed to load incidents"))
      .finally(() => setIncidentLoading(false));
  }, [tab, incidents, incidentLoading, clusterId, kind, namespace, name]);

  useEffect(() => {
    if (tab !== "AI Suggestions" || suggestions !== null || suggestionLoading) return;
    setSuggestionError("");
    setSuggestionLoading(true);
    api<ResourceAISuggestion[]>(`/api/clusters/${clusterId}/resources/${encodeURIComponent(kind)}/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/ai-suggestions`)
      .then(setSuggestions)
      .catch((err) => setSuggestionError(err instanceof Error ? err.message : "Failed to load AI suggestions"))
      .finally(() => setSuggestionLoading(false));
  }, [tab, suggestions, suggestionLoading, clusterId, kind, namespace, name]);

  useEffect(() => {
    if (!cooldownUntil) return;
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  const filteredLogs = useMemo(() => (logs || []).filter((entry) => `${entry.timestamp || ""} ${entry.container || ""} ${entry.message}`.toLowerCase().includes(query.toLowerCase())), [logs, query]);
  const filteredIncidents = useMemo(
    () => (incidents || []).filter((incident) => {
      const severityOk = incidentSeverity === "all" || incident.severity === incidentSeverity;
      const statusOk = incidentStatus === "all" || incident.status === incidentStatus;
      const containerOk = incidentContainer === "all" || (incident.container_name || "unknown") === incidentContainer;
      return severityOk && statusOk && containerOk;
    }),
    [incidents, incidentSeverity, incidentStatus, incidentContainer],
  );
  const incidentContainers = useMemo(
    () => ["all", ...Array.from(new Set((incidents || []).map((incident) => incident.container_name || "unknown")))],
    [incidents],
  );
  const selectedIncident = filteredIncidents.find((incident) => incident.id === selectedIncidentId) || filteredIncidents[0] || null;
  const incidentSummary = useMemo(() => ({
    critical: (incidents || []).filter((incident) => incident.severity === "critical").length,
    major: (incidents || []).filter((incident) => incident.severity === "major").length,
    minor: (incidents || []).filter((incident) => incident.severity === "minor").length,
  }), [incidents]);
  const metadata = asRecord(resource?.metadata);
  const spec = asRecord(metadata.spec);
  const status = asRecord(metadata.status);
  const containerNames = stringList((spec.containers as Record<string, unknown>[] | undefined)?.map((item) => item.name));
  const images = stringList((spec.containers as Record<string, unknown>[] | undefined)?.map((item) => item.image));
  const ownerRefs = stringList((pathValue(metadata, ["metadata", "ownerReferences"]) as Record<string, unknown>[] | undefined)?.map((item) => `${item.kind || ""}/${item.name || ""}`));
  const cooldownSeconds = Math.max(0, Math.ceil((cooldownUntil - nowTick) / 1000));

  function mergeSuggestionResult(suggestionId: string, result: RemediationApprovalResult, fallbackReason?: string) {
    setSuggestions((current) => (current || []).map((item) => item.id !== suggestionId ? item : {
      ...item,
      latest_approval_status: result.approval_status,
      latest_action_id: result.action_id || null,
      latest_action_status: result.action_status || null,
      approval_available: false,
      approval_block_reason: fallbackReason || (result.action_status ? `Action ${result.action_status.replace(/_/g, " ")}` : "Approval recorded"),
    }));
  }

  async function approveSuggestion(suggestionId: string) {
    setSuggestionActionError((current) => ({ ...current, [suggestionId]: "" }));
    setSuggestionActionMessage((current) => ({ ...current, [suggestionId]: "" }));
    setSuggestionActionLoading((current) => ({ ...current, [suggestionId]: true }));
    try {
      const result = await api<RemediationApprovalResult>(`/api/remediation-suggestions/${suggestionId}/approve`, {
        method: "POST",
        body: JSON.stringify({
          confirmation_text: approveConfirmationText,
          approval_reason: approveReason || undefined,
        }),
      });
      mergeSuggestionResult(suggestionId, result, "Action queued for agent pickup");
      setSuggestionActionMessage((current) => ({ ...current, [suggestionId]: result.message }));
      setApproveIntentId(null);
      setApproveConfirmationText("");
      setApproveReason("");
    } catch (err) {
      setSuggestionActionError((current) => ({ ...current, [suggestionId]: err instanceof Error ? err.message : "Failed to approve remediation" }));
    } finally {
      setSuggestionActionLoading((current) => ({ ...current, [suggestionId]: false }));
    }
  }

  async function rejectSuggestion(suggestionId: string) {
    setSuggestionActionError((current) => ({ ...current, [suggestionId]: "" }));
    setSuggestionActionMessage((current) => ({ ...current, [suggestionId]: "" }));
    setSuggestionActionLoading((current) => ({ ...current, [suggestionId]: true }));
    try {
      const result = await api<RemediationApprovalResult>(`/api/remediation-suggestions/${suggestionId}/reject`, {
        method: "POST",
        body: JSON.stringify({
          approval_reason: approveReason || undefined,
        }),
      });
      mergeSuggestionResult(suggestionId, result, "Suggestion rejected");
      setSuggestionActionMessage((current) => ({ ...current, [suggestionId]: result.message }));
      setApproveIntentId(null);
      setApproveConfirmationText("");
      setApproveReason("");
    } catch (err) {
      setSuggestionActionError((current) => ({ ...current, [suggestionId]: err instanceof Error ? err.message : "Failed to reject remediation" }));
    } finally {
      setSuggestionActionLoading((current) => ({ ...current, [suggestionId]: false }));
    }
  }

  if (error) return <div className="rounded-3xl border border-[var(--danger-bg)] bg-[var(--danger-bg)] p-4 text-[var(--danger-text)]">{error}</div>;
  if (!resource) return <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 text-[var(--text-muted)]">Loading resource...</div>;

  return <div className="space-y-6 text-[var(--text)]">
    <section className="dashboard-shell-header">
      <div className="flex flex-wrap items-center gap-3">
        <Link className="text-sm font-medium text-[var(--primary)] hover:text-[var(--primary)]" href={`/dashboard/clusters/${clusterId}/resources`}>Back to resources</Link>
        <Link className="text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)]" href={`/dashboard/clusters/${clusterId}/incidents`}>Cluster incidents</Link>
        <Link className="text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)]" href={`/dashboard/clusters/${clusterId}/ai`}>ClusterSage AI</Link>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]">{resource.kind}</span>
        <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]">{resource.namespace || "cluster"}</span>
        <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]">{resource.status || "Unknown"}</span>
      </div>
      <h1 className="mt-2 break-words text-3xl font-bold text-[var(--text)]">{resource.name}</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">Resource investigation workspace for logs, incidents, AI guidance, and remediation review.</p>
    </section>

    <div className="dashboard-panel bg-[var(--bg-subtle)] p-2">
      <div className="flex flex-wrap gap-2">
      {tabs.map((item) => <button key={item} className={`rounded-2xl px-4 py-2.5 text-sm font-medium transition ${tab === item ? "bg-[var(--bg-elevated)] text-[var(--primary)] shadow-sm ring-1 ring-[var(--primary-ring)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text)]"}`} onClick={() => setTab(item)}>{item}</button>)}
      </div>
    </div>

    {tab === "Details" && <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <DetailStat label="Name" value={resource.name} />
        <DetailStat label="Namespace" value={resource.namespace || "cluster"} />
        <DetailStat label="Status" value={resource.status || "Unknown"} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="dashboard-panel space-y-3">
          <h2 className="font-semibold text-[var(--text)]">Metadata</h2>
          <p className="text-sm text-[var(--text-muted)]">Created: {resource.created_at ? new Date(resource.created_at).toLocaleString() : "Unknown"}</p>
          <p className="text-sm text-[var(--text-muted)]">Node: {resource.node_name || "Not available"}</p>
          <p className="text-sm text-[var(--text-muted)]">Restarts: {resource.restart_count ?? "Not available"}</p>
          <p className="text-sm text-[var(--text-muted)]">Owner: {ownerRefs || "Not available"}</p>
        </div>
        <div className="dashboard-panel space-y-3">
          <h2 className="font-semibold text-[var(--text)]">Runtime</h2>
          <p className="text-sm text-[var(--text-muted)]">Containers: {containerNames || "Not available"}</p>
          <p className="break-words text-sm text-[var(--text-muted)]">Images: {images || "Not available"}</p>
          <p className="text-sm text-[var(--text-muted)]">Phase: {String(status.phase || resource.status || "Unknown")}</p>
        </div>
      </div>
      <div className="dashboard-panel space-y-3"><h2 className="font-semibold text-[var(--text)]">Labels</h2>{labels(resource.labels)}</div>
    </div>}

    {tab === "Logs" && <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input className="input border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text)] sm:max-w-md" placeholder="Filter log lines" value={query} onChange={(event) => setQuery(event.target.value)} />
        <button className="btn-secondary border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text)] hover:bg-[var(--bg-subtle)]" disabled={logLoading || cooldownSeconds > 0} onClick={() => void refreshLogs()}>{logLoading ? "Refreshing..." : cooldownSeconds > 0 ? `Refresh in ${cooldownSeconds}s` : "Refresh"}</button>
      </div>
      {logError && <div className="rounded-3xl border border-[var(--danger-bg)] bg-[var(--danger-bg)] p-4 text-[var(--danger-text)]">{logError}</div>}
      {logs?.length === 0 && <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 text-[var(--text-muted)]">No logs found for this resource yet.</div>}
      <div className="dashboard-panel max-h-[640px] overflow-auto bg-[var(--bg-subtle)] p-4 font-mono text-xs leading-6 text-[var(--text)]">
        {filteredLogs.length === 0 && logs !== null ? <p className="text-[var(--text-muted)]">No log lines match the current filter.</p> : filteredLogs.map((entry, index) => <div key={`${entry.timestamp || "line"}-${index}`} className="grid gap-3 border-b border-[var(--border)] py-1 md:grid-cols-[190px_140px_1fr]"><span className="text-[var(--text-muted)]">{entry.timestamp || "-"}</span><span className="text-[var(--primary)]">{entry.container || "container"}</span><span className="whitespace-pre-wrap break-words">{entry.message}</span></div>)}
      </div>
    </div>}

    {tab === "Incidents" && <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4"><p className="text-sm text-[var(--text-muted)]">Critical</p><p className="mt-2 text-2xl font-bold text-[var(--danger-text)]">{incidentSummary.critical}</p></div>
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4"><p className="text-sm text-[var(--text-muted)]">Major</p><p className="mt-2 text-2xl font-bold text-[var(--warning-text)]">{incidentSummary.major}</p></div>
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4"><p className="text-sm text-[var(--text-muted)]">Minor</p><p className="mt-2 text-2xl font-bold text-[var(--primary)]">{incidentSummary.minor}</p></div>
      </div>
      <div className="flex flex-col gap-2 lg:flex-row">
        <select className="input border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text)] lg:w-40" value={incidentSeverity} onChange={(event) => setIncidentSeverity(event.target.value)}>
          <option value="all">All severities</option>
          <option value="critical">Critical</option>
          <option value="major">Major</option>
          <option value="minor">Minor</option>
        </select>
        <select className="input border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text)] lg:w-40" value={incidentStatus} onChange={(event) => setIncidentStatus(event.target.value)}>
          <option value="all">All status</option>
          <option value="open">Open</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
          <option value="ignored">Ignored</option>
        </select>
        <select className="input border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text)] lg:w-48" value={incidentContainer} onChange={(event) => setIncidentContainer(event.target.value)}>
          {incidentContainers.map((item) => <option key={item} value={item}>{item === "all" ? "All containers" : item}</option>)}
        </select>
      </div>
      {incidentError && <div className="rounded-3xl border border-[var(--danger-bg)] bg-[var(--danger-bg)] p-4 text-[var(--danger-text)]">{incidentError}</div>}
      {incidentLoading && <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 text-[var(--text-muted)]">Loading incidents...</div>}
      {!incidentLoading && incidents?.length === 0 && <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4"><h2 className="text-lg font-semibold text-[var(--text)]">No incidents detected for this resource.</h2><p className="mt-2 text-[var(--text-muted)]">Related issues will appear here when they are available.</p></div>}
      {!incidentLoading && incidents && incidents.length > 0 && <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
        <div className="space-y-3">
          {filteredIncidents.length === 0 && <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 text-[var(--text-muted)]">No incidents match the current filters.</div>}
          {filteredIncidents.map((incident) => <button key={incident.id} className={`block w-full rounded-3xl border bg-[var(--bg-elevated)] p-4 text-left ${selectedIncident?.id === incident.id ? "border-[var(--primary)] ring-1 ring-[var(--primary-ring)]" : "border-[var(--border)]"}`} onClick={() => setSelectedIncidentId(incident.id)}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${severityTone(incident.severity)}`}>{incident.severity}</span>
                  <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]">{incident.status}</span>
                  <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]">{incident.incident_type}</span>
                </div>
                <h2 className="text-base font-semibold text-[var(--text)]">{incident.title}</h2>
                <p className="text-sm text-[var(--text-muted)]">{incident.namespace || "cluster"}{incident.pod_name ? ` / ${incident.pod_name}` : ""}{incident.container_name ? ` / ${incident.container_name}` : ""}</p>
                <p className="text-sm text-[var(--text-muted)]">{incident.ai_summary || incident.description || "Summary unavailable."}</p>
              </div>
              <div className="text-right text-xs text-[var(--text-soft)]">
                <p>Seen {incident.occurrence_count} times</p>
                <p>{new Date(incident.last_seen_at).toLocaleString()}</p>
              </div>
            </div>
          </button>)}
        </div>
        <div className="dashboard-panel space-y-4">
          {!selectedIncident ? <p className="text-sm text-[var(--text-muted)]">Select an incident to inspect the evidence and timeline.</p> : <>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${severityTone(selectedIncident.severity)}`}>{selectedIncident.severity}</span>
              <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]">{selectedIncident.status}</span>
              <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]">Confidence {(selectedIncident.confidence_score ?? 0).toFixed(2)}</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--text)]">{selectedIncident.title}</h2>
              <p className="mt-2 text-sm text-[var(--text-muted)]">{selectedIncident.ai_summary || selectedIncident.description || "Summary unavailable."}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-soft)]">First seen</p><p className="mt-1 text-sm text-[var(--text-muted)]">{new Date(selectedIncident.first_seen_at).toLocaleString()}</p></div>
              <div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-soft)]">Last seen</p><p className="mt-1 text-sm text-[var(--text-muted)]">{new Date(selectedIncident.last_seen_at).toLocaleString()}</p></div>
              <div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-soft)]">Namespace</p><p className="mt-1 text-sm text-[var(--text-muted)]">{selectedIncident.namespace || "cluster"}</p></div>
              <div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-soft)]">Container</p><p className="mt-1 text-sm text-[var(--text-muted)]">{selectedIncident.container_name || "Unknown"}</p></div>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-[var(--text)]">Evidence preview</h3>
              <div className="max-h-72 overflow-auto rounded-3xl bg-[var(--bg-subtle)] p-3 font-mono text-xs text-[var(--text)]">
                {evidenceLines(selectedIncident.evidence).length === 0 && <p className="text-[var(--text-muted)]">No evidence lines stored.</p>}
                {evidenceLines(selectedIncident.evidence).map((line, index) => <div key={`${line.timestamp || "line"}-${index}`} className="border-b border-[var(--border)] py-2 last:border-b-0">
                  <p className="text-[var(--text-muted)]">{line.timestamp || "-"}</p>
                  <p className="text-[var(--primary)]">{line.container || "container"}</p>
                  <p className="mt-1 whitespace-pre-wrap break-words">{line.message}</p>
                </div>)}
              </div>
            </div>
            <div className="pt-1">
              <button className="btn-secondary border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text)] hover:bg-[var(--bg-subtle)]" onClick={() => setTab("Logs")}>View related logs</button>
            </div>
          </>}
        </div>
      </div>}
    </div>}

    {tab === "AI Suggestions" && <div className="space-y-4">
      <div className="dashboard-panel">
        <h2 className="text-lg font-semibold text-[var(--text)]">AI Suggestions</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Suggestions appear after ClusterSage has enough incident evidence to recommend a next step. Review the guidance, then approve remediation only when it matches what you want to do.</p>
      </div>
      {suggestionError && <div className="rounded-3xl border border-[var(--danger-bg)] bg-[var(--danger-bg)] p-4 text-[var(--danger-text)]">{suggestionError}</div>}
      {suggestionLoading && <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 text-[var(--text-muted)]">Loading AI suggestions...</div>}
      {!suggestionLoading && suggestions?.length === 0 && <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4"><h2 className="text-lg font-semibold text-[var(--text)]">No suggestions yet.</h2><p className="mt-2 text-[var(--text-muted)]">Suggestions will appear here when they are available.</p></div>}
      <div className="space-y-3">
        {suggestions?.map((suggestion) => {
          const actionPayload = asRecord(suggestion.action_payload);
          const actionState = suggestion.latest_action_status ? suggestion.latest_action_status.replace(/_/g, " ") : null;
          const approvalState = suggestion.latest_approval_status ? suggestion.latest_approval_status.replace(/_/g, " ") : null;
          const isApprovingThis = approveIntentId === suggestion.id;
          return <div key={suggestion.id} className="dashboard-panel space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${riskTone(suggestion.risk_level)}`}>{suggestion.risk_level} risk</span>
                  <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]">{suggestion.suggestion_type}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${severityTone(suggestion.incident_severity)}`}>{suggestion.incident_severity} incident</span>
                </div>
                <h2 className="text-lg font-semibold text-[var(--text)]">{suggestion.title}</h2>
                <p className="text-sm text-[var(--text-muted)]">{suggestion.summary}</p>
              </div>
              <div className="text-right text-xs text-[var(--text-soft)]">
                <p>{new Date(suggestion.updated_at).toLocaleString()}</p>
                <p>Confidence {(suggestion.confidence_score ?? 0).toFixed(2)}</p>
              </div>
            </div>
            {(approvalState || actionState) && <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-subtle)] p-3 text-sm text-[var(--text-muted)]">
              <p>Approval status: <span className="font-medium">{approvalState || "not requested"}</span></p>
              <p>Action status: <span className="font-medium">{actionState || "not created"}</span></p>
            </div>}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-soft)]">Related incident</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{suggestion.incident_title}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-soft)]">Approval required</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{suggestion.requires_approval ? "Yes" : "No"}</p>
              </div>
            </div>
            {suggestion.suggestion_type === "rollout_restart" && <div className="rounded-3xl border border-[var(--warning-bg)] bg-[var(--warning-bg)] p-4 text-sm text-[var(--warning-text)]">
              <p className="font-semibold">Rollout restart candidate</p>
              <p className="mt-1">This restart can only move forward after explicit approval, and the agent will still validate the target before doing anything.</p>
              <div className="mt-3 space-y-1">
                <p>Namespace: {String(actionPayload.namespace || suggestion.resource_name || namespace)}</p>
                <p>Workload kind: {String(actionPayload.workload_kind || "Unknown")}</p>
                <p>Workload name: {String(actionPayload.workload_name || "Needs resolution")}</p>
              </div>
              {suggestion.approval_block_reason && <p className="mt-3 rounded-md bg-[var(--bg-elevated)] px-3 py-2 text-sm text-amber-950">{suggestion.approval_block_reason}</p>}
              {suggestionActionError[suggestion.id] && <p className="mt-3 rounded-md bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger-text)]">{suggestionActionError[suggestion.id]}</p>}
              {suggestionActionMessage[suggestion.id] && <p className="mt-3 rounded-md bg-[var(--success-bg)] px-3 py-2 text-sm text-[var(--success-text)]">{suggestionActionMessage[suggestion.id]}</p>}
              {!isApprovingThis && <div className="mt-3 flex flex-wrap gap-2">
                <button className="btn" disabled={!suggestion.approval_available || suggestionActionLoading[suggestion.id]} onClick={() => { setApproveIntentId(suggestion.id); setApproveConfirmationText(""); setApproveReason(""); }}>Approve restart</button>
                <button className="btn-secondary" disabled={!!suggestion.latest_action_status || suggestionActionLoading[suggestion.id]} onClick={() => { setApproveIntentId(suggestion.id); setApproveConfirmationText(""); setApproveReason(""); }}>Reject suggestion</button>
              </div>}
              {isApprovingThis && <div className="mt-4 space-y-3 rounded-3xl border border-[var(--warning-bg)] bg-[var(--bg-elevated)] p-4">
                <p className="font-medium text-amber-950">Confirm this remediation request</p>
                <p className="text-sm text-amber-950">Type <span className="font-mono font-semibold">APPROVE</span> to queue the restart request for the agent.</p>
                <input className="input" placeholder='Type APPROVE to continue' value={approveConfirmationText} onChange={(event) => setApproveConfirmationText(event.target.value)} />
                <textarea className="input min-h-24" placeholder="Optional reason for the approval or rejection" value={approveReason} onChange={(event) => setApproveReason(event.target.value)} />
                <div className="flex flex-wrap gap-2">
                  <button className="btn" disabled={!suggestion.approval_available || approveConfirmationText !== "APPROVE" || suggestionActionLoading[suggestion.id]} onClick={() => void approveSuggestion(suggestion.id)}>{suggestionActionLoading[suggestion.id] ? "Approving..." : "Confirm approval"}</button>
                  <button className="btn-secondary" disabled={suggestionActionLoading[suggestion.id]} onClick={() => void rejectSuggestion(suggestion.id)}>{suggestionActionLoading[suggestion.id] ? "Saving..." : "Reject instead"}</button>
                  <button className="btn-secondary" disabled={suggestionActionLoading[suggestion.id]} onClick={() => { setApproveIntentId(null); setApproveConfirmationText(""); setApproveReason(""); }}>Cancel</button>
                </div>
              </div>}
            </div>}
          </div>;
        })}
      </div>
    </div>}
  </div>;
}
