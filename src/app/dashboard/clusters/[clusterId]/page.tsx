"use client";
import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { AIClusterQuery, AIIncident, Cluster, ResourceSummary } from "@/types/api";

const preferredKinds = ["Pod", "Deployment", "Service", "ReplicaSet", "StatefulSet", "DaemonSet", "Job", "CronJob", "Namespace"];
const tabs = ["Overview", "Resources", "Incidents", "ClusterSage AI"] as const;
const exampleQuestions = [
  "Show critical incidents in the last 24 hours.",
  "Which pod restarted the most today?",
  "Find logs containing database connection failure.",
  "Which namespace has the most warning events?",
  "Summarize the health of this cluster.",
];

type Tab = typeof tabs[number];

function resourceHref(clusterId: string, resource: Pick<ResourceSummary, "kind" | "namespace" | "name">) {
  const namespace = resource.namespace || "_cluster";
  return `/dashboard/clusters/${clusterId}/resources/${encodeURIComponent(resource.kind)}/${encodeURIComponent(namespace)}/${encodeURIComponent(resource.name)}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function severityTone(severity: string) {
  if (severity === "critical") return "bg-red-50 text-red-700";
  if (severity === "major") return "bg-amber-50 text-amber-700";
  return "bg-blue-50 text-blue-700";
}

function questionIntentLabel(query: AIClusterQuery | null) {
  const parsed = asRecord(query?.parsed_query);
  return typeof parsed.intent === "string" ? parsed.intent : "unsupported";
}

export default function ClusterDetail({ params }: { params: Promise<{ clusterId: string }> }) {
  const { clusterId } = use(params);
  const [cluster, setCluster] = useState<Cluster | null>(null);
  const [resources, setResources] = useState<ResourceSummary[] | null>(null);
  const [incidents, setIncidents] = useState<AIIncident[] | null>(null);
  const [tab, setTab] = useState<Tab>("Overview");
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
    if (tab !== "Incidents" || incidents !== null || incidentLoading) return;
    setIncidentLoading(true);
    setIncidentError("");
    api<AIIncident[]>(`/api/clusters/${clusterId}/incidents`)
      .then((data) => {
        setIncidents(data);
        setSelectedIncidentId(data[0]?.id || null);
      })
      .catch((err) => setIncidentError(err instanceof Error ? err.message : "Failed to load incidents"))
      .finally(() => setIncidentLoading(false));
  }, [tab, incidents, incidentLoading, clusterId]);

  const kinds = useMemo(() => {
    const present = new Set(resources?.map((item) => item.kind) || []);
    return ["All", ...preferredKinds.filter((item) => present.has(item))];
  }, [resources]);

  const filteredResources = useMemo(() => (resources || []).filter((item) => {
    const matchesKind = kind === "All" || item.kind === kind;
    const text = `${item.name} ${item.namespace || ""} ${item.kind} ${item.status || ""}`.toLowerCase();
    return matchesKind && text.includes(query.toLowerCase());
  }), [resources, kind, query]);

  const resourceSummary = useMemo(() => ({
    pods: (resources || []).filter((item) => item.kind === "Pod").length,
    deployments: (resources || []).filter((item) => item.kind === "Deployment").length,
    unhealthy: (resources || []).filter((item) => {
      const status = (item.status || "").toLowerCase();
      return status.includes("pending") || status.includes("failed") || status.includes("0/");
    }).length,
    restartedPods: (resources || []).filter((item) => (item.restart_count || 0) > 0).length,
  }), [resources]);

  const incidentSummary = useMemo(() => ({
    critical: (incidents || []).filter((item) => item.severity === "critical").length,
    major: (incidents || []).filter((item) => item.severity === "major").length,
    minor: (incidents || []).filter((item) => item.severity === "minor").length,
    open: (incidents || []).filter((item) => item.status === "open").length,
  }), [incidents]);

  const incidentNamespaces = useMemo(
    () => ["all", ...Array.from(new Set((incidents || []).map((item) => item.namespace || "cluster")))],
    [incidents],
  );
  const incidentTypes = useMemo(
    () => ["all", ...Array.from(new Set((incidents || []).map((item) => item.incident_type)))],
    [incidents],
  );
  const incidentWorkloads = useMemo(
    () => ["all", ...Array.from(new Set((incidents || []).map((item) => item.workload_name || item.resource_name || item.pod_name || "unknown")))],
    [incidents],
  );

  const filteredIncidents = useMemo(() => (incidents || []).filter((incident) => {
    const severityOk = incidentSeverity === "all" || incident.severity === incidentSeverity;
    const statusOk = incidentStatus === "all" || incident.status === incidentStatus;
    const namespaceOk = incidentNamespace === "all" || (incident.namespace || "cluster") === incidentNamespace;
    const typeOk = incidentType === "all" || incident.incident_type === incidentType;
    const workloadValue = incident.workload_name || incident.resource_name || incident.pod_name || "unknown";
    const workloadOk = incidentWorkload === "all" || workloadValue === incidentWorkload;
    const text = `${incident.title} ${incident.ai_summary || ""} ${incident.description || ""} ${incident.pod_name || ""} ${incident.workload_name || ""}`.toLowerCase();
    const searchOk = text.includes(incidentSearch.toLowerCase());
    return severityOk && statusOk && namespaceOk && typeOk && workloadOk && searchOk;
  }), [incidents, incidentSeverity, incidentStatus, incidentNamespace, incidentType, incidentWorkload, incidentSearch]);

  const selectedIncident = filteredIncidents.find((item) => item.id === selectedIncidentId) || filteredIncidents[0] || null;

  async function refreshIncidents() {
    setIncidentLoading(true);
    setIncidentError("");
    try {
      const data = await api<AIIncident[]>(`/api/clusters/${clusterId}/incidents`);
      setIncidents(data);
      setSelectedIncidentId((current) => data.some((item) => item.id === current) ? current : (data[0]?.id || null));
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

  if (error) return <div className="card border-red-200 text-red-700">{error}</div>;
  if (!cluster || !resources) return <div className="card">Loading cluster resources...</div>;

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 className="text-3xl font-bold">{cluster.name}</h1>
        <p className="text-slate-600">{cluster.provider} / {cluster.status} / {resources.length} resources</p>
      </div>
    </div>

    <div className="flex flex-wrap gap-2 border-b border-slate-200">
      {tabs.map((item) => <button key={item} className={`px-4 py-3 text-sm font-medium ${tab === item ? "border-b-2 border-blue-600 text-blue-700" : "text-slate-600 hover:text-slate-900"}`} onClick={() => setTab(item)}>{item}</button>)}
    </div>

    {tab === "Overview" && <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="card"><p className="text-sm text-slate-500">Last seen</p><p className="mt-2 font-medium">{cluster.last_seen_at ? new Date(cluster.last_seen_at).toLocaleString() : "Never"}</p></div>
        <div className="card"><p className="text-sm text-slate-500">Agent version</p><p className="mt-2 font-medium">{cluster.agent_version || "Unknown"}</p></div>
        <div className="card"><p className="text-sm text-slate-500">Pods discovered</p><p className="mt-2 text-2xl font-bold">{resourceSummary.pods}</p></div>
        <div className="card"><p className="text-sm text-slate-500">Deployments discovered</p><p className="mt-2 text-2xl font-bold">{resourceSummary.deployments}</p></div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card"><p className="text-sm text-slate-500">Resources needing attention</p><p className="mt-2 text-2xl font-bold text-amber-700">{resourceSummary.unhealthy}</p><p className="mt-2 text-sm text-slate-600">This is based on the latest resource snapshot status text.</p></div>
        <div className="card"><p className="text-sm text-slate-500">Pods with restarts</p><p className="mt-2 text-2xl font-bold text-blue-700">{resourceSummary.restartedPods}</p><p className="mt-2 text-sm text-slate-600">Use the ClusterSage AI tab to ask which pod restarted the most.</p></div>
        <div className="card"><p className="text-sm text-slate-500">Open incidents</p><p className="mt-2 text-2xl font-bold text-red-700">{incidentSummary.open}</p><p className="mt-2 text-sm text-slate-600">Open the Incidents tab to review cluster-wide failures and drill into affected resources.</p></div>
      </div>
    </div>}

    {tab === "Resources" && <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <select className="input sm:w-44" value={kind} onChange={(event) => setKind(event.target.value)}>{kinds.map((item) => <option key={item}>{item}</option>)}</select>
        <input className="input sm:w-72" placeholder="Search resources" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      {filteredResources.length === 0 && <div className="card"><h2 className="font-semibold">No resources found</h2><p className="mt-2 text-slate-600">ClusterSage will show resources here after the agent sends a cluster snapshot.</p></div>}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Kind</th><th className="px-4 py-3">Namespace</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Node</th><th className="px-4 py-3">Restarts</th><th className="px-4 py-3">Age</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {filteredResources.map((item) => <tr key={`${item.kind}:${item.namespace || ""}:${item.name}`} className="transition hover:bg-blue-50/40">
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
    </div>}

    {tab === "Incidents" && <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="card"><p className="text-sm text-slate-500">Critical</p><p className="mt-2 text-2xl font-bold text-red-700">{incidentSummary.critical}</p></div>
        <div className="card"><p className="text-sm text-slate-500">Major</p><p className="mt-2 text-2xl font-bold text-amber-700">{incidentSummary.major}</p></div>
        <div className="card"><p className="text-sm text-slate-500">Minor</p><p className="mt-2 text-2xl font-bold text-blue-700">{incidentSummary.minor}</p></div>
        <div className="card"><p className="text-sm text-slate-500">Open incidents</p><p className="mt-2 text-2xl font-bold">{incidentSummary.open}</p></div>
      </div>
      <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap">
        <input className="input lg:min-w-72" placeholder="Search incidents" value={incidentSearch} onChange={(event) => setIncidentSearch(event.target.value)} />
        <select className="input lg:w-40" value={incidentSeverity} onChange={(event) => setIncidentSeverity(event.target.value)}>
          <option value="all">All severities</option>
          <option value="critical">Critical</option>
          <option value="major">Major</option>
          <option value="minor">Minor</option>
        </select>
        <select className="input lg:w-40" value={incidentStatus} onChange={(event) => setIncidentStatus(event.target.value)}>
          <option value="all">All status</option>
          <option value="open">Open</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
          <option value="ignored">Ignored</option>
        </select>
        <select className="input lg:w-48" value={incidentNamespace} onChange={(event) => setIncidentNamespace(event.target.value)}>
          {incidentNamespaces.map((item) => <option key={item} value={item}>{item === "all" ? "All namespaces" : item}</option>)}
        </select>
        <select className="input lg:w-48" value={incidentType} onChange={(event) => setIncidentType(event.target.value)}>
          {incidentTypes.map((item) => <option key={item} value={item}>{item === "all" ? "All incident types" : item}</option>)}
        </select>
        <select className="input lg:w-52" value={incidentWorkload} onChange={(event) => setIncidentWorkload(event.target.value)}>
          {incidentWorkloads.map((item) => <option key={item} value={item}>{item === "all" ? "All workloads" : item}</option>)}
        </select>
        <button className="btn-secondary" onClick={() => void refreshIncidents()} disabled={incidentLoading}>{incidentLoading ? "Refreshing..." : "Refresh"}</button>
      </div>
      {incidentError && <div className="card border-red-200 text-red-700">{incidentError}</div>}
      {incidentLoading && <div className="card">Loading incidents...</div>}
      {!incidentLoading && incidents?.length === 0 && <div className="card"><h2 className="text-lg font-semibold">No incidents detected for this cluster.</h2><p className="mt-2 text-slate-600">Cluster-wide incidents will appear here once ClusterSage correlates repeated failures, pod issues, or high-priority patterns.</p></div>}
      {!incidentLoading && incidents && incidents.length > 0 && <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
        <div className="space-y-3">
          {filteredIncidents.length === 0 && <div className="card">No incidents match the current filters.</div>}
          {filteredIncidents.map((incident) => {
            const resourceLink = incident.resource_kind && incident.resource_name
              ? resourceHref(clusterId, { kind: incident.resource_kind, namespace: incident.namespace || "_cluster", name: incident.resource_name })
              : null;
            return <button key={incident.id} className={`card block w-full text-left ${selectedIncident?.id === incident.id ? "border-blue-300 ring-1 ring-blue-200" : ""}`} onClick={() => setSelectedIncidentId(incident.id)}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${severityTone(incident.severity)}`}>{incident.severity}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{incident.status}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{incident.incident_type}</span>
                  </div>
                  <h2 className="text-base font-semibold">{incident.title}</h2>
                  <p className="text-sm text-slate-600">{incident.namespace || "cluster"}{incident.workload_name ? ` / ${incident.workload_name}` : incident.resource_name ? ` / ${incident.resource_name}` : ""}{incident.pod_name ? ` / ${incident.pod_name}` : ""}</p>
                  <p className="text-sm text-slate-700">{incident.ai_summary || incident.description || "No summary available."}</p>
                  {resourceLink && <p className="text-sm text-blue-700">Linked resource available</p>}
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>Seen {incident.occurrence_count} times</p>
                  <p>{new Date(incident.last_seen_at).toLocaleString()}</p>
                </div>
              </div>
            </button>;
          })}
        </div>
        <div className="card space-y-4">
          {!selectedIncident ? <p className="text-sm text-slate-500">Select an incident to inspect cluster-level evidence and follow the linked resource.</p> : <>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${severityTone(selectedIncident.severity)}`}>{selectedIncident.severity}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{selectedIncident.status}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">Confidence {(selectedIncident.confidence_score ?? 0).toFixed(2)}</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold">{selectedIncident.title}</h2>
              <p className="mt-2 text-sm text-slate-700">{selectedIncident.ai_summary || selectedIncident.description || "No summary available."}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Namespace</p><p className="mt-1 text-sm text-slate-700">{selectedIncident.namespace || "cluster"}</p></div>
              <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Workload</p><p className="mt-1 text-sm text-slate-700">{selectedIncident.workload_name || selectedIncident.resource_name || "Unknown"}</p></div>
              <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">First seen</p><p className="mt-1 text-sm text-slate-700">{new Date(selectedIncident.first_seen_at).toLocaleString()}</p></div>
              <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last seen</p><p className="mt-1 text-sm text-slate-700">{new Date(selectedIncident.last_seen_at).toLocaleString()}</p></div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {selectedIncident.resource_kind && selectedIncident.resource_name && <Link className="btn-secondary" href={resourceHref(clusterId, { kind: selectedIncident.resource_kind, namespace: selectedIncident.namespace || "_cluster", name: selectedIncident.resource_name })}>Open linked resource</Link>}
            </div>
          </>}
        </div>
      </div>}
    </div>}

    {tab === "ClusterSage AI" && <div className="space-y-4">
      <div className="card space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Ask ClusterSage AI</h2>
          <p className="mt-2 text-sm text-slate-600">This uses a safe backend query DSL. It only answers from stored cluster telemetry and does not run arbitrary commands.</p>
        </div>
        <textarea className="input min-h-28 w-full" value={clusterQuestion} onChange={(event) => setClusterQuestion(event.target.value)} placeholder="Ask about cluster incidents, restarts, logs, or warning events" />
        <div className="flex flex-wrap gap-2">
          {exampleQuestions.map((item) => <button key={item} className="btn-secondary" onClick={() => setClusterQuestion(item)}>{item}</button>)}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => void askClusterSage()} disabled={clusterQueryLoading || clusterQuestion.trim().length < 3}>{clusterQueryLoading ? "Running query..." : "Run query"}</button>
        </div>
      </div>
      {clusterQueryError && <div className="card border-red-200 text-red-700">{clusterQueryError}</div>}
      {clusterQueryResult && <div className="card space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{questionIntentLabel(clusterQueryResult)}</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{clusterQueryResult.ai_model || "unknown parser"}</span>
          <span className="text-xs text-slate-500">{new Date(clusterQueryResult.created_at).toLocaleString()}</span>
        </div>
        <div>
          <h3 className="font-semibold">Answer</h3>
          <p className="mt-2 text-sm text-slate-700">{clusterQueryResult.answer_summary || "No summary available."}</p>
        </div>
        {clusterQueryItems.length > 0 && <div className="space-y-3">
          <h3 className="font-semibold">Result set</h3>
          <div className="space-y-3">
            {clusterQueryItems.map((item, index) => <div key={index} className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-medium">{String(item.title || item.pod_name || item.workload_name || item.namespace || `Result ${index + 1}`)}</p>
                  <p className="text-sm text-slate-600">{String(item.summary || item.message || item.incident_type || item.status || "")}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {typeof item.severity === "string" && <span className={`rounded-full px-2.5 py-1 font-semibold uppercase ${severityTone(String(item.severity))}`}>{String(item.severity)}</span>}
                  {typeof item.warning_event_count === "number" && <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">{item.warning_event_count} warnings</span>}
                  {typeof item.restart_count === "number" && <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">{item.restart_count} restarts</span>}
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                {typeof item.namespace === "string" && item.namespace && <p>Namespace: {item.namespace}</p>}
                {typeof item.pod_name === "string" && item.pod_name && <p>Pod: {item.pod_name}</p>}
                {typeof item.workload_name === "string" && item.workload_name && <p>Workload: {item.workload_name}</p>}
                {typeof item.container_name === "string" && item.container_name && <p>Container: {item.container_name}</p>}
                {typeof item.last_seen_at === "string" && item.last_seen_at && <p>Last seen: {new Date(item.last_seen_at).toLocaleString()}</p>}
                {typeof item.timestamp === "string" && item.timestamp && <p>Timestamp: {new Date(item.timestamp).toLocaleString()}</p>}
              </div>
            </div>)}
          </div>
        </div>}
        {!clusterQueryItems.length && (Object.keys(clusterQueryIncidentCounts).length > 0 || Object.keys(clusterQueryResourceCounts).length > 0) && <div className="grid gap-4 md:grid-cols-2">
          {Object.keys(clusterQueryIncidentCounts).length > 0 && <div className="rounded-lg border border-slate-200 p-4">
            <h3 className="font-semibold">Incident counts</h3>
            <pre className="mt-3 overflow-auto whitespace-pre-wrap text-xs text-slate-700">{JSON.stringify(clusterQueryIncidentCounts, null, 2)}</pre>
          </div>}
          {Object.keys(clusterQueryResourceCounts).length > 0 && <div className="rounded-lg border border-slate-200 p-4">
            <h3 className="font-semibold">Resource counts</h3>
            <pre className="mt-3 overflow-auto whitespace-pre-wrap text-xs text-slate-700">{JSON.stringify(clusterQueryResourceCounts, null, 2)}</pre>
          </div>}
        </div>}
      </div>}
    </div>}
  </div>;
}
