export type User = { id: string; organization_id: string; email: string; full_name?: string; role: string };
export type AgentKey = { id: string; name: string; key_last4: string; expires_at?: string | null; revoked_at?: string | null; created_at: string; raw_key?: string | null };
export type Cluster = { id: string; name: string; provider: string; status: string; agent_version?: string | null; last_seen_at?: string | null; created_at: string; updated_at: string };
export type LogBatch = { id: string; blob_path: string; log_count: number; size_bytes: number; start_time?: string | null; end_time?: string | null; created_at: string };
export type Issue = { id: string; namespace?: string | null; workload?: string | null; pod_name?: string | null; severity: string; issue_type: string; title: string; description?: string | null; status: string; first_seen_at: string; last_seen_at: string };
export type ResourceSummary = { name: string; namespace?: string | null; kind: string; status?: string | null; age?: string | null; node_name?: string | null; restart_count?: number | null; labels: Record<string, string>; last_updated_at?: string | null; created_at?: string | null; metadata: Record<string, unknown> };
export type ResourceLogEntry = { timestamp?: string | null; namespace?: string | null; pod?: string | null; container?: string | null; message: string; raw: Record<string, unknown> };
export type AIIncident = { id: string; cluster_id: string; resource_kind?: string | null; resource_name?: string | null; scope: string; title: string; incident_type: string; severity: "minor" | "major" | "critical"; status: string; namespace?: string | null; pod_name?: string | null; container_name?: string | null; workload_kind?: string | null; workload_name?: string | null; description?: string | null; ai_summary?: string | null; evidence: Record<string, unknown>; confidence_score?: number | null; first_seen_at: string; last_seen_at: string; occurrence_count: number; created_at: string; updated_at: string; resolved_at?: string | null };
export type ResourceAISuggestion = { id: string; cluster_id: string; incident_id: string; incident_title: string; incident_severity: "minor" | "major" | "critical"; incident_status: string; resource_kind?: string | null; resource_name?: string | null; suggestion_type: string; title: string; summary: string; risk_level: "low" | "medium" | "high"; requires_approval: boolean; is_executable: boolean; executable_action_type?: string | null; action_payload?: Record<string, unknown> | null; ai_model?: string | null; prompt_version?: string | null; confidence_score?: number | null; latest_approval_status?: string | null; latest_action_id?: string | null; latest_action_status?: string | null; approval_available: boolean; approval_block_reason?: string | null; created_at: string; updated_at: string };
export type RemediationApprovalResult = { suggestion_id: string; approval_id: string; approval_status: string; action_id?: string | null; action_status?: string | null; message: string };
export type RemediationAction = { id: string; cluster_id: string; suggestion_id: string; approval_id: string; action_type: string; action_payload: Record<string, unknown>; status: string; requested_by_user_id?: string | null; picked_up_by_agent_id?: string | null; requested_at: string; picked_up_at?: string | null; completed_at?: string | null; error_message?: string | null; result?: Record<string, unknown> | null };
export type AIClusterQuery = { id: string; cluster_id: string; user_id?: string | null; question: string; parsed_query?: Record<string, unknown> | null; answer_summary?: string | null; result?: Record<string, unknown> | null; ai_model?: string | null; created_at: string };
export type AIConversation = {
  id: string;
  cluster_id: string;
  user_id: string;
  title: string;
  summary?: string | null;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
};
export type AIConversationMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | string;
  content: string;
  evidence_references?: Record<string, unknown>[] | null;
  tool_execution_metadata?: Record<string, unknown>[] | null;
  ai_model?: string | null;
  prompt_version?: string | null;
  confidence?: "low" | "medium" | "high" | string | null;
  data_freshness?: Record<string, unknown> | null;
  created_at: string;
};
export type AIConversationDetail = {
  conversation: AIConversation;
  messages: AIConversationMessage[];
};
export type AIChatResponse = {
  conversation_id: string;
  message_id: string;
  answer: string;
  evidence: Record<string, unknown>[];
  confidence: "low" | "medium" | "high" | string;
  data_freshness: Record<string, unknown>;
  tools_used: string[];
  created_at: string;
};
export type ClusterMetricRollupItem = {
  label: string;
  namespace?: string | null;
  value: number;
  unit: string;
};
export type ClusterMetricsOverview = {
  collected_at?: string | null;
  pod_cpu_mcores_total: number;
  pod_memory_bytes_total: number;
  node_cpu_mcores_total: number;
  node_memory_bytes_total: number;
  top_pods_by_cpu: ClusterMetricRollupItem[];
  top_pods_by_memory: ClusterMetricRollupItem[];
  top_nodes_by_cpu: ClusterMetricRollupItem[];
  top_nodes_by_memory: ClusterMetricRollupItem[];
};
export type ClusterMetricFilterCatalog = {
  collected_at?: string | null;
  metric_names: string[];
  scopes: string[];
  resource_kinds: string[];
  namespaces: string[];
  nodes: string[];
  workloads: string[];
  pods: string[];
};
export type ClusterMetricLatestBreakdownItem = {
  scope: string;
  resource_kind: string;
  resource_name: string;
  namespace?: string | null;
  node_name?: string | null;
  container_name?: string | null;
  value: number;
  unit: string;
};
export type ClusterMetricLatest = {
  collected_at?: string | null;
  metric_name: string;
  unit?: string | null;
  total_value: number;
  breakdown: ClusterMetricLatestBreakdownItem[];
};
export type ClusterMetricTimeseriesPoint = {
  timestamp: string;
  value: number;
};
export type ClusterMetricTimeseriesSeries = {
  scope: string;
  resource_kind: string;
  resource_name: string;
  namespace?: string | null;
  node_name?: string | null;
  container_name?: string | null;
  unit: string;
  latest_value: number;
  points: ClusterMetricTimeseriesPoint[];
};
export type ClusterMetricTimeseries = {
  metric_name: string;
  unit?: string | null;
  window_minutes: number;
  step_minutes: number;
  series: ClusterMetricTimeseriesSeries[];
};
export type AlertLimitMetricType =
  | "resource_health"
  | "pod_restarts"
  | "open_incidents"
  | "critical_incidents"
  | "major_incidents"
  | "minor_incidents"
  | "warning_events";
export type AlertLimitScopeType = "cluster" | "namespace" | "workload" | "resource";
export type AlertLimitOperator = "gt" | "gte" | "lt" | "lte" | "eq";
export type AlertLimitSeverity = "minor" | "major" | "critical";
export type AlertLimit = {
  id: string;
  cluster_id: string;
  created_by_user_id?: string | null;
  name: string;
  metric_type: AlertLimitMetricType;
  scope_type: AlertLimitScopeType;
  namespace?: string | null;
  workload_name?: string | null;
  resource_id?: string | null;
  operator: AlertLimitOperator;
  threshold_value: number;
  time_window_minutes: number;
  severity: AlertLimitSeverity;
  email_enabled: boolean;
  notification_email?: string | null;
  enabled: boolean;
  cooldown_minutes: number;
  last_triggered_at?: string | null;
  created_at: string;
  updated_at: string;
};
export type AlertEvent = {
  id: string;
  cluster_id: string;
  alert_limit_id: string;
  metric_value?: number | null;
  threshold_value: number;
  triggered_at: string;
  notification_sent: boolean;
  notification_error?: string | null;
  created_at: string;
};
export type AlertLimitCreateRequest = {
  name: string;
  metric_type: AlertLimitMetricType;
  scope_type: AlertLimitScopeType;
  namespace?: string | null;
  workload_name?: string | null;
  resource_id?: string | null;
  operator: AlertLimitOperator;
  threshold_value: number;
  time_window_minutes: number;
  severity: AlertLimitSeverity;
  email_enabled: boolean;
  notification_email?: string | null;
  enabled: boolean;
  cooldown_minutes: number;
};
export type AlertLimitUpdateRequest = Partial<AlertLimitCreateRequest>;
