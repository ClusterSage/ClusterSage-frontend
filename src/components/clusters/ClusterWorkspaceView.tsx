"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { AIChatResponse, AIConversation, AIConversationDetail, AIConversationMessage, AIIncident, Cluster, ClusterMetricsOverview, ResourceSummary } from "@/types/api";
import { ClusterDashboardView } from "@/components/clusters/ClusterDashboardView";

const preferredKinds = ["Pod", "Deployment", "Service", "ReplicaSet", "StatefulSet", "DaemonSet", "Job", "CronJob", "Namespace"];
const exampleQuestions = [
  "Why are the payment pods restarting repeatedly?",
  "Did these errors begin after the latest deployment?",
  "Search recent logs for database connection failures.",
  "Summarize the current health of this cluster.",
];
const progressMessages = [
  "Checking recent incidents",
  "Reviewing the latest cluster snapshot",
  "Searching recent stored logs",
  "Reviewing ClusterSage documentation",
];

type ClusterView = "dashboard" | "resources" | "incidents" | "ai";

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

function confidenceTone(confidence: string | null | undefined) {
  if (confidence === "high") return "bg-emerald-500/15 text-emerald-300";
  if (confidence === "medium") return "bg-amber-500/15 text-amber-300";
  return "bg-[var(--bg-subtle)] text-[var(--text-muted)]";
}

function freshnessLabel(message: AIConversationMessage | null) {
  const freshness = asRecord(message?.data_freshness);
  const latest = typeof freshness.latest_evidence_at === "string" ? freshness.latest_evidence_at : null;
  const truncated = freshness.truncated === true;
  if (!latest && !truncated) return "No freshness metadata";
  if (latest && truncated) return `Evidence from ${new Date(latest).toLocaleString()} and truncated`;
  if (latest) return `Evidence from ${new Date(latest).toLocaleString()}`;
  return "Evidence was truncated";
}

function WorkspaceStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="dashboard-metric-card p-4">
      <p className="dashboard-metric-label">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text)]">{value}</p>
      <p className="mt-2 text-xs text-[var(--text-soft)]">{detail}</p>
    </div>
  );
}

export function ClusterWorkspaceView({ clusterId, view }: { clusterId: string; view: ClusterView }) {
  const [cluster, setCluster] = useState<Cluster | null>(null);
  const [resources, setResources] = useState<ResourceSummary[] | null>(null);
  const [incidents, setIncidents] = useState<AIIncident[] | null>(null);
  const [metricsOverview, setMetricsOverview] = useState<ClusterMetricsOverview | null>(null);
  const [metricsError, setMetricsError] = useState("");
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
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [conversationMessages, setConversationMessages] = useState<AIConversationMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [lastSubmittedMessage, setLastSubmittedMessage] = useState("");
  const [progressIndex, setProgressIndex] = useState(0);
  const chatComposerRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    Promise.all([api<Cluster>(`/api/clusters/${clusterId}`), api<ResourceSummary[]>(`/api/clusters/${clusterId}/resources`)])
      .then(([clusterData, resourceData]) => {
        setCluster(clusterData);
        setResources(resourceData);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load cluster"));
  }, [clusterId]);

  useEffect(() => {
    if (view !== "dashboard") return;
    setMetricsError("");
    api<ClusterMetricsOverview>(`/api/clusters/${clusterId}/metrics/overview`)
      .then(setMetricsOverview)
      .catch((err) => {
        setMetricsOverview(null);
        setMetricsError(err instanceof Error ? err.message : "Failed to load runtime metrics");
      });
  }, [clusterId, view]);

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

  useEffect(() => {
    if (view !== "ai") return;
    setChatError("");
    api<AIConversation[]>(`/api/clusters/${clusterId}/ai/conversations`)
      .then((data) => {
        setConversations(data);
        setSelectedConversationId((current) => current || data[0]?.id || null);
      })
      .catch((err) => setChatError(err instanceof Error ? err.message : "Failed to load conversations"));
  }, [clusterId, view]);

  useEffect(() => {
    if (view !== "ai") return;
    if (!selectedConversationId) {
      setConversationMessages([]);
      return;
    }
    api<AIConversationDetail>(`/api/clusters/${clusterId}/ai/conversations/${selectedConversationId}`)
      .then((data) => setConversationMessages(data.messages))
      .catch((err) => setChatError(err instanceof Error ? err.message : "Failed to load conversation"));
  }, [clusterId, selectedConversationId, view]);

  useEffect(() => {
    if (!chatLoading) return;
    const timer = window.setInterval(() => setProgressIndex((value) => (value + 1) % progressMessages.length), 1600);
    return () => window.clearInterval(timer);
  }, [chatLoading]);

  useEffect(() => {
    const textarea = chatComposerRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 240)}px`;
  }, [chatInput]);

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

  async function refreshConversations(preferredConversationId?: string | null) {
    try {
      const data = await api<AIConversation[]>(`/api/clusters/${clusterId}/ai/conversations`);
      setConversations(data);
      if (preferredConversationId) setSelectedConversationId(preferredConversationId);
      else setSelectedConversationId((current) => current || data[0]?.id || null);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Failed to load conversations");
    }
  }

  async function sendChatMessage(message: string) {
    const trimmed = message.trim();
    if (trimmed.length < 1) return;
    setChatLoading(true);
    setChatError("");
    setLastSubmittedMessage(trimmed);
    try {
      const data = await api<AIChatResponse>(`/api/clusters/${clusterId}/ai/chat`, {
        method: "POST",
        body: JSON.stringify({ conversation_id: selectedConversationId, message: trimmed }),
      });
      setChatInput("");
      await refreshConversations(data.conversation_id);
      const detail = await api<AIConversationDetail>(`/api/clusters/${clusterId}/ai/conversations/${data.conversation_id}`);
      setConversationMessages(detail.messages);
      setSelectedConversationId(data.conversation_id);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setChatLoading(false);
    }
  }

  const latestAssistantMessage = [...conversationMessages].reverse().find((item) => item.role === "assistant") || null;

  if (error) return <div className="card border-[var(--danger-bg)] bg-[var(--bg-elevated)] text-[var(--danger-text)]">{error}</div>;
  if (!cluster || !resources) return <div className="card bg-[var(--bg-elevated)] text-[var(--text-muted)]">Loading cluster resources...</div>;

  if (view === "dashboard") {
    return <ClusterDashboardView clusterId={clusterId} cluster={cluster} resources={resources} incidents={incidents || []} metricsOverview={metricsOverview} metricsError={metricsError} />;
  }

  if (view === "resources") {
    return (
      <div className="space-y-5">
        <section className="dashboard-shell-header">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="dashboard-shell-meta">Cluster inventory</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)]">Resources</h1>
              <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                Inspect the latest cluster snapshot, filter by kind, and drill into resource-specific logs, incidents, and AI guidance.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <WorkspaceStat label="Shown" value={filteredResources.length} detail="Current filtered rows" />
              <WorkspaceStat label="Kinds" value={kinds.length - 1} detail="Visible resource kinds" />
              <WorkspaceStat label="Cluster" value={cluster.name} detail={cluster.provider} />
            </div>
          </div>
        </section>
        <section className="dashboard-panel">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="dashboard-panel-title">Filters</h2>
              <p className="dashboard-panel-subtitle">Focus the inventory before you drill deeper.</p>
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <select className="input border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text)] sm:w-44" value={kind} onChange={(event) => setKind(event.target.value)}>
              {kinds.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <input className="input border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text)] sm:w-72" placeholder="Search resources" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
        </section>
        {filteredResources.length === 0 && (
          <div className="dashboard-panel text-[var(--text-muted)]">
            <h2 className="font-semibold text-[var(--text)]">No resources found</h2>
            <p className="mt-2">Resources will appear here after the cluster connects.</p>
          </div>
        )}
        <div className="dashboard-panel overflow-hidden p-0">
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
      <div className="space-y-5">
        <section className="dashboard-shell-header">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="dashboard-shell-meta">Cluster incident review</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)]">Incidents</h1>
              <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                Review issue activity across the cluster, then open the detail drawer to inspect evidence and the linked resource context.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn-secondary h-10 rounded-xl px-4" onClick={() => void refreshIncidents()} disabled={incidentLoading}>
                {incidentLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
        </section>
        <div className="grid gap-4 md:grid-cols-4">
          <WorkspaceStat label="Critical" value={incidentSummary.critical} detail="Highest-severity rows" />
          <WorkspaceStat label="Major" value={incidentSummary.major} detail="Degraded issue rows" />
          <WorkspaceStat label="Minor" value={incidentSummary.minor} detail="Lower-severity rows" />
          <WorkspaceStat label="Open" value={incidentSummary.open} detail="Currently open incidents" />
        </div>
        <section className="dashboard-panel">
          <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap">
            <input className="input border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text)] lg:min-w-72" placeholder="Search incidents" value={incidentSearch} onChange={(event) => setIncidentSearch(event.target.value)} />
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
            <select className="input border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text)] lg:w-48" value={incidentNamespace} onChange={(event) => setIncidentNamespace(event.target.value)}>
              {incidentNamespaces.map((item) => (
                <option key={item} value={item}>
                  {item === "all" ? "All namespaces" : item}
                </option>
              ))}
            </select>
            <select className="input border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text)] lg:w-48" value={incidentType} onChange={(event) => setIncidentType(event.target.value)}>
              {incidentTypes.map((item) => (
                <option key={item} value={item}>
                  {item === "all" ? "All incident types" : item}
                </option>
              ))}
            </select>
            <select className="input border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text)] lg:w-52" value={incidentWorkload} onChange={(event) => setIncidentWorkload(event.target.value)}>
              {incidentWorkloads.map((item) => (
                <option key={item} value={item}>
                  {item === "all" ? "All workloads" : item}
                </option>
              ))}
            </select>
          </div>
        </section>
        {incidentError && <div className="rounded-2xl border border-[var(--danger-bg)] bg-[var(--danger-bg)] p-4 text-[var(--danger-text)]">{incidentError}</div>}
        {incidentLoading && <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 text-[var(--text-muted)]">Loading incidents...</div>}
        {!incidentLoading && incidents?.length === 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 text-[var(--text-muted)]">
            <h2 className="text-lg font-semibold text-[var(--text)]">No incidents detected for this cluster.</h2>
            <p className="mt-2">Recent cluster issues will appear here.</p>
          </div>
        )}
        {!incidentLoading && incidents && incidents.length > 0 && (
          <div className="space-y-3">
            <div className="dashboard-panel flex items-center justify-between gap-3 px-4 py-3 text-sm text-[var(--text-muted)]">
              <p>Pick an incident to inspect details, evidence context, and the linked resource.</p>
              <p>{filteredIncidents.length} shown</p>
            </div>
            <div className="space-y-3">
              {filteredIncidents.length === 0 && <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 text-[var(--text-muted)]">No incidents match the current filters.</div>}
              {filteredIncidents.map((incident) => {
                const resourceLink = incident.resource_kind && incident.resource_name ? resourceHref(clusterId, { kind: incident.resource_kind, namespace: incident.namespace || "_cluster", name: incident.resource_name }) : null;
                return (
                  <button
                    key={incident.id}
                    className={`block w-full rounded-2xl border bg-[var(--bg-elevated)] p-4 text-left transition ${selectedIncident?.id === incident.id ? "border-[var(--primary)] ring-1 ring-[var(--primary-ring)]" : "border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)]"}`}
                    onClick={() => {
                      setSelectedIncidentId(incident.id);
                      setIncidentDrawerOpen(true);
                    }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${severityTone(incident.severity)}`}>{incident.severity}</span>
                          <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]">{incident.status}</span>
                          <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]">{incident.incident_type}</span>
                        </div>
                        <h2 className="text-base font-semibold text-[var(--text)]">{incident.title}</h2>
                        <p className="text-sm text-[var(--text-muted)]">
                          {incident.namespace || "cluster"}
                          {incident.workload_name ? ` / ${incident.workload_name}` : incident.resource_name ? ` / ${incident.resource_name}` : ""}
                          {incident.pod_name ? ` / ${incident.pod_name}` : ""}
                        </p>
                        <p className="text-sm text-[var(--text-muted)]">{incident.ai_summary || incident.description || "Summary unavailable."}</p>
                        {resourceLink && <p className="text-sm text-[var(--primary)]">Linked resource available</p>}
                      </div>
                      <div className="text-right text-xs text-[var(--text-soft)]">
                        <p>Seen {incident.occurrence_count} times</p>
                        <p>{new Date(incident.last_seen_at).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3 text-xs text-[var(--text-soft)]">
                      <span>{incident.namespace || "cluster"} scope</span>
                      <span className="text-[var(--primary)]">{resourceLink ? "Open details" : "Inspect incident"}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            {incidentDrawerOpen && selectedIncident && (
              <div className="fixed inset-0 z-50">
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
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="dashboard-shell-header overflow-hidden">
        <div className="relative">
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[var(--primary)]/10 blur-3xl" />
          <p className="dashboard-shell-meta">Cluster investigation</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--text)]">ClusterSage AI</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
                Ask freely, iterate naturally, and investigate this cluster with answers grounded in incidents, snapshots, logs, deployments, and stored evidence.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 font-medium text-[var(--text-muted)]">
                {cluster.name} · {cluster.provider}
              </span>
              {latestAssistantMessage && (
                <>
                  <span className={`rounded-full px-3 py-1.5 font-semibold uppercase ${confidenceTone(latestAssistantMessage.confidence)}`}>
                    {latestAssistantMessage.confidence || "low"} confidence
                  </span>
                  <span className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 font-medium text-[var(--text-muted)]">
                    {freshnessLabel(latestAssistantMessage)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="dashboard-panel flex min-h-[720px] flex-col overflow-hidden p-0">
          <div className="border-b border-[var(--border)] px-4 py-4 sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="dashboard-panel-title">Chats</h2>
                <p className="dashboard-panel-subtitle">Cluster-scoped history</p>
              </div>
              <button
                className="btn-secondary h-10 rounded-xl px-4"
                onClick={() => {
                  setSelectedConversationId(null);
                  setConversationMessages([]);
                  setChatError("");
                  setChatInput("");
                }}
              >
                New chat
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {conversations.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-subtle)] p-4 text-sm text-[var(--text-muted)]">
                Start a conversation and it will appear here.
              </div>
            ) : (
              <div className="space-y-2">
                {conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    className={`block w-full rounded-2xl px-4 py-3 text-left transition ${
                      selectedConversationId === conversation.id
                        ? "border border-[var(--primary)] bg-[var(--primary)]/8 shadow-sm"
                        : "border border-transparent bg-transparent hover:border-[var(--border)] hover:bg-[var(--bg-subtle)]"
                    }`}
                    onClick={() => setSelectedConversationId(conversation.id)}
                  >
                    <p className="line-clamp-2 text-sm font-semibold text-[var(--text)]">{conversation.title}</p>
                    <p className="mt-2 text-xs text-[var(--text-soft)]">{new Date(conversation.updated_at).toLocaleString()}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>
        <section className="dashboard-panel flex min-h-[720px] flex-col overflow-hidden p-0">
          <div className="border-b border-[var(--border)] px-4 py-4 sm:px-6">
            <h2 className="text-base font-semibold tracking-tight text-[var(--text)]">Cluster investigation chat</h2>
            <p className="mt-1 text-sm text-[var(--text-soft)]">Natural-language investigation for this cluster</p>
          </div>
          <div className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,rgba(31,111,255,0.04),transparent_20%),var(--bg-elevated)] px-4 py-6 sm:px-6">
            {conversationMessages.length === 0 ? (
              <div className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center py-8 text-center">
                <div className="rounded-[28px] border border-[var(--border)] bg-[var(--bg-subtle)] px-6 py-8 shadow-sm">
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">Ready to investigate</p>
                  <h3 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text)]">What do you want to know about this cluster?</h3>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
                    You can type anything directly. Suggested prompts are optional and just here to help you get started.
                  </p>
                  <div className="mt-6 grid gap-3 text-left sm:grid-cols-2">
                    {exampleQuestions.map((item) => (
                      <button
                        key={item}
                        className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-sm text-[var(--text)] transition hover:border-[var(--primary)] hover:bg-[var(--primary)]/5"
                        onClick={() => setChatInput(item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-8">
                {conversationMessages.map((message) => {
                  const evidence = Array.isArray(message.evidence_references) ? message.evidence_references.map((item) => asRecord(item)) : [];
                  const tools = Array.isArray(message.tool_execution_metadata) ? message.tool_execution_metadata.map((item) => asRecord(item)) : [];
                  const isUser = message.role === "user";
                  return (
                    <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                      <div className={`w-full ${isUser ? "max-w-2xl" : "max-w-3xl"}`}>
                        <div className={`rounded-[28px] px-5 py-4 sm:px-6 ${isUser ? "ml-auto bg-[var(--primary)] text-white shadow-[0_18px_45px_rgba(31,111,255,0.22)]" : "border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text)] shadow-sm"}`}>
                          <div className={`flex items-center justify-between gap-3 text-xs ${isUser ? "text-white/72" : "text-[var(--text-soft)]"}`}>
                            <p className="font-semibold uppercase tracking-[0.2em]">{isUser ? "You" : "ClusterSage"}</p>
                            <p>{new Date(message.created_at).toLocaleString()}</p>
                          </div>
                          <p className={`mt-3 whitespace-pre-wrap text-[15px] leading-7 ${isUser ? "text-white" : "text-[var(--text)]"}`}>{message.content}</p>
                        </div>
                        {!isUser && evidence.length > 0 && (
                          <div className="mt-3 rounded-[24px] border border-[var(--border)] bg-[var(--bg-subtle)] p-4">
                            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">Sources</h3>
                            <div className="mt-3 grid gap-2">
                              {evidence.map((item, index) => (
                                <div key={index} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3">
                                  <p className="text-sm font-medium text-[var(--text)]">{String(item.title || item.source_id || `Source ${index + 1}`)}</p>
                                  <p className="mt-1 text-xs text-[var(--text-soft)]">
                                    {String(item.source_type || "evidence")}
                                    {typeof item.timestamp === "string" ? ` · ${new Date(String(item.timestamp)).toLocaleString()}` : ""}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {!isUser && tools.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {tools.map((item, index) => (
                              <span key={index} className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)]">
                                {String(item.tool_name || "tool")} · {String(item.status || "ok")}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="w-full max-w-3xl rounded-[28px] border border-[var(--border)] bg-[var(--bg-elevated)] px-5 py-4 shadow-sm sm:px-6">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">ClusterSage</p>
                      <div className="mt-3 flex items-center gap-3 text-sm text-[var(--text-muted)]">
                        <div className="flex gap-1.5">
                          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--primary)]/50" />
                          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--primary)]/65 [animation-delay:120ms]" />
                          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--primary)]/80 [animation-delay:240ms]" />
                        </div>
                        <span>{progressMessages[progressIndex]}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="border-t border-[var(--border)] bg-[var(--bg-elevated)]/92 px-4 py-4 backdrop-blur sm:px-6">
            <form
              className="mx-auto max-w-3xl"
              onSubmit={(event) => {
                event.preventDefault();
                void sendChatMessage(chatInput);
              }}
            >
              <div className="rounded-[30px] border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-3 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                <textarea
                  ref={chatComposerRef}
                  className="w-full resize-none border-0 bg-transparent px-3 py-2 text-[15px] leading-7 text-[var(--text)] outline-none placeholder:text-slate-400 focus:ring-0"
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      if (!chatLoading && chatInput.trim().length > 0) {
                        void sendChatMessage(chatInput);
                      }
                    }
                  }}
                  placeholder="Message ClusterSage about this cluster..."
                  rows={1}
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-2 pb-1">
                  <div className="flex flex-wrap gap-2">
                    {conversationMessages.length === 0 &&
                      exampleQuestions.slice(0, 2).map((item) => (
                        <button
                          key={item}
                          type="button"
                          className="rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition hover:border-[var(--primary)] hover:text-[var(--text)]"
                          onClick={() => setChatInput(item)}
                        >
                          {item}
                        </button>
                      ))}
                  </div>
                  <div className="flex items-center gap-2">
                    {chatError && lastSubmittedMessage && (
                      <button type="button" className="btn-secondary rounded-full px-4" onClick={() => void sendChatMessage(lastSubmittedMessage)}>
                        Retry
                      </button>
                    )}
                    <button className="btn h-11 rounded-full px-5" type="submit" disabled={chatLoading || chatInput.trim().length < 1}>
                      {chatLoading ? "Investigating..." : "Send"}
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-[var(--text-soft)]">
                <p>Enter sends. Shift+Enter adds a new line.</p>
                <p>Short prompts like &quot;hi&quot; are allowed now.</p>
              </div>
            </form>
            {chatError && (
              <div className="mx-auto mt-4 max-w-3xl rounded-2xl border border-[var(--danger-bg)] bg-[var(--danger-bg)] p-4 text-sm text-[var(--danger-text)]">
                {chatError}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
