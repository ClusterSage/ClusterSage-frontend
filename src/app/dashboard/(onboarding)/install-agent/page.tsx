"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, getApiUrl } from "@/lib/api";
import type { AgentKey, User } from "@/types/api";
import { CodeBlock } from "@/components/CodeBlock";

const publicAgentImage = process.env.NEXT_PUBLIC_AGENT_IMAGE || "acrclustersage.azurecr.io/clustersage-agent:stable";
const agentChart = process.env.NEXT_PUBLIC_AGENT_CHART || "oci://acrclustersage.azurecr.io/helm/clusterwatch-agent";
const agentChartVersion = process.env.NEXT_PUBLIC_AGENT_CHART_VERSION || "0.1.3";
const defaultAgentRepository = publicAgentImage.replace(/:[^/:]+$/, "");
const defaultAgentTag = publicAgentImage.match(/:([^/:]+)$/)?.[1] || "stable";

function StepCard({ step, title, children }: { step: string; title: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-4">
      <div className="flex items-start gap-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--primary-soft)] text-sm font-semibold text-[var(--primary)]">
          {step}
        </div>
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function InstallAgentPage() {
  const [user, setUser] = useState<User | null>(null);
  const [keys, setKeys] = useState<AgentKey[]>([]);
  const [accessKey, setAccessKey] = useState("");
  const [clusterName, setClusterName] = useState("prod-aks-01");
  const [imageRepo, setImageRepo] = useState(defaultAgentRepository);
  const [imageTag, setImageTag] = useState(defaultAgentTag);
  const [error, setError] = useState("");

  useEffect(() => {
    api<User>("/api/auth/me").then(setUser).catch((e) => setError(e.message));
    api<AgentKey[]>("/api/agent-keys").then(setKeys).catch(() => {});
  }, []);

  async function generate(e: FormEvent) {
    e.preventDefault();
    const key = await api<AgentKey>("/api/agent-keys", {
      method: "POST",
      body: JSON.stringify({ name: `Install key for ${clusterName}` }),
    });
    setAccessKey(key.raw_key || "");
    setKeys([key, ...keys]);
  }

  const exactImage = `${imageRepo}:${imageTag}`;
  const backendUrl = getApiUrl();
  const pullCommands = `docker pull ${exactImage}\ncrictl pull ${exactImage}\nkubectl run clusterwatch-agent-pull-check \\\n  --rm -it \\\n  --restart=Never \\\n  --image=${exactImage} \\\n  --command -- python -c "print('public-pull-ok')"`;

  const values = useMemo(
    () => `backend:\n  url: "${backendUrl}"\nauth:\n  email: "${user?.email || "you@example.com"}"\n  accessKey: "${accessKey || "cw_live_copy_generated_key_here"}"\ncluster:\n  name: "${clusterName}"\n  provider: "aks"\nagent:\n  image:\n    repository: "${imageRepo}"\n    tag: "${imageTag}"\n    pullPolicy: IfNotPresent\n  logLevel: "info"\n  heartbeatIntervalSeconds: 30\n  snapshotIntervalSeconds: 60\n  metrics:\n    enabled: true\n    intervalSeconds: 60\n    resourceUsage:\n      enabled: true\n    kubeStateMetrics:\n      enabled: true\n      url: ""\n      timeoutSeconds: 10\n    kubeletSummary:\n      enabled: true\naddons:\n  kubeStateMetrics:\n    enabled: true\n  metricsServer:\n    enabled: false\nfluentbit:\n  enabled: true\n  excludeAgentNamespace: true`,
    [backendUrl, user, accessKey, clusterName, imageRepo, imageTag],
  );

  const install = `helm upgrade --install clusterwatch-agent ${agentChart} \\\n  --version ${agentChartVersion} \\\n  --namespace clusterwatch-agent \\\n  --create-namespace \\\n  -f clusterwatch-values.yaml`;

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Agent onboarding</p>
        <h1 className="section-title mt-2">Install the ClusterSage agent</h1>
        <p className="section-copy mt-2">Logged in as {user?.email || "loading..."}. Follow these steps to connect a cluster.</p>
      </div>
      {error && <div className="card border-[var(--danger-bg)] text-[var(--danger-text)]">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_320px]">
        <div className="card space-y-4 border-[var(--primary-ring)] bg-[var(--primary-soft)]/70">
          <p className="eyebrow">Quick setup</p>
          <h2 className="text-2xl font-semibold">Everything you need to connect a cluster</h2>
          <p className="section-copy">Generate a key, prepare the values file, install the chart, and confirm the pods are running.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="panel bg-[var(--bg-elevated)] p-4 shadow-none">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">Cluster name</p>
              <p className="mt-2 break-words text-sm font-medium text-[var(--text)]">{clusterName}</p>
            </div>
            <div className="panel bg-[var(--bg-elevated)] p-4 shadow-none">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">Chart version</p>
              <p className="mt-2 text-sm font-medium text-[var(--text)]">{agentChartVersion}</p>
            </div>
            <div className="panel bg-[var(--bg-elevated)] p-4 shadow-none">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">Image tag</p>
              <p className="mt-2 text-sm font-medium text-[var(--text)]">{imageTag}</p>
            </div>
          </div>
        </div>

        <aside className="panel-subtle p-5">
          <p className="eyebrow">Before you start</p>
          <ul className="mt-4 space-y-3 text-sm text-[var(--text-muted)]">
            <li>Use a clear cluster name your team will recognize.</li>
            <li>Copy the access key as soon as it appears.</li>
            <li>Keep the values file nearby while you install.</li>
            <li>Verify pods before leaving this page.</li>
          </ul>
        </aside>
      </div>

      <StepCard step="1" title="Generate an access key">
        <form onSubmit={generate} className="grid gap-3 md:grid-cols-4">
          <div className="space-y-2">
            <label className="text-sm font-medium muted">Cluster name</label>
            <input className="input" value={clusterName} onChange={(e) => setClusterName(e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium muted">Image repository</label>
            <input className="input" value={imageRepo} onChange={(e) => setImageRepo(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium muted">Image tag</label>
            <input className="input" value={imageTag} onChange={(e) => setImageTag(e.target.value)} />
          </div>
          <button className="btn md:col-span-4">Generate one-time key</button>
        </form>
        <p className="text-sm muted">
          The default image is <code>{exactImage}</code>. Already have a key? Paste it into the values file before installing. Manage keys in{" "}
          <Link className="font-medium text-[var(--primary)]" href="/dashboard/settings/agent-keys">
            Agent Keys
          </Link>
          .
        </p>
        {accessKey && (
          <div className="panel-strong p-4">
            <p className="text-sm font-semibold text-[var(--text)]">Copy this key now</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">It will not be shown again after this session.</p>
            <div className="mt-3">
              <CodeBlock value={accessKey} />
            </div>
          </div>
        )}
      </StepCard>

      <StepCard step="2" title="Confirm the chart">
        <CodeBlock value={`helm show chart ${agentChart} --version ${agentChartVersion}`} />
        <p className="text-sm muted">Use this command to confirm the chart version before you install.</p>
      </StepCard>

      <StepCard step="3" title="Create clusterwatch-values.yaml">
        <CodeBlock value={values} />
        <p className="text-sm muted">Fill in the access key, cluster name, and image values before you install.</p>
      </StepCard>

      <StepCard step="4" title="Install and verify">
        <CodeBlock value={install} />
        <CodeBlock value={`kubectl get pods -n clusterwatch-agent\nkubectl logs deploy/clusterwatch-collector -n clusterwatch-agent\nkubectl get daemonset clusterwatch-fluent-bit -n clusterwatch-agent`} />
      </StepCard>

      <StepCard step="5" title="Troubleshoot or remove">
        <CodeBlock value={`kubectl describe pod -n clusterwatch-agent -l app.kubernetes.io/component=collector\nkubectl logs -n clusterwatch-agent -l app.kubernetes.io/component=fluent-bit\nhelm uninstall clusterwatch-agent -n clusterwatch-agent\nkubectl delete namespace clusterwatch-agent`} />
      </StepCard>
    </div>
  );
}
