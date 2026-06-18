"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, getApiUrl } from "@/lib/api";
import type { AgentKey, User } from "@/types/api";
import { CodeBlock } from "@/components/CodeBlock";

const publicAgentImage = process.env.NEXT_PUBLIC_AGENT_IMAGE || "acrclustersage.azurecr.io/clustersage-agent:stable";
const agentChart = process.env.NEXT_PUBLIC_AGENT_CHART || "oci://acrclustersage.azurecr.io/helm/clusterwatch-agent";
const agentChartVersion = process.env.NEXT_PUBLIC_AGENT_CHART_VERSION || "0.1.2";
const defaultAgentRepository = publicAgentImage.replace(/:[^/:]+$/, "");
const defaultAgentTag = publicAgentImage.match(/:([^/:]+)$/)?.[1] || "stable";

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
    () => `backend:\n  url: "${backendUrl}"\nauth:\n  email: "${user?.email || "you@example.com"}"\n  accessKey: "${accessKey || "cw_live_copy_generated_key_here"}"\ncluster:\n  name: "${clusterName}"\n  provider: "aks"\nagent:\n  image:\n    repository: "${imageRepo}"\n    tag: "${imageTag}"\n    pullPolicy: IfNotPresent\n  logLevel: "info"\n  heartbeatIntervalSeconds: 30\n  snapshotIntervalSeconds: 60\nfluentbit:\n  enabled: true\n  excludeAgentNamespace: true`,
    [backendUrl, user, accessKey, clusterName, imageRepo, imageTag]
  );

  const install = `helm upgrade --install clusterwatch-agent ${agentChart} \\\n  --version ${agentChartVersion} \\\n  --namespace clusterwatch-agent \\\n  --create-namespace \\\n  -f clusterwatch-values.yaml`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Install ClusterSage agent</h1>
        <p className="text-slate-600">
          Logged in as {user?.email || "loading..."}. The agent runs inside your cluster and pushes data outward.
        </p>
      </div>
      {error && <div className="card border-red-200 text-red-700">{error}</div>}

      <div className="card space-y-3 border-blue-200 bg-blue-50/40">
        <h2 className="font-bold">Public agent image</h2>
        <p className="text-sm text-slate-700">
          This image is publicly pullable without Docker login or Kubernetes image pull secrets.
        </p>
        <CodeBlock value={exactImage} />
        <CodeBlock value={pullCommands} />
      </div>

      <div className="card space-y-3">
        <h2 className="font-bold">1. Generate an access key</h2>
        <form onSubmit={generate} className="grid gap-3 md:grid-cols-4">
          <input className="input" value={clusterName} onChange={(e) => setClusterName(e.target.value)} />
          <input className="input md:col-span-2" value={imageRepo} onChange={(e) => setImageRepo(e.target.value)} />
          <input className="input" value={imageTag} onChange={(e) => setImageTag(e.target.value)} />
          <button className="btn md:col-span-4">Generate one-time key</button>
        </form>
        <p className="text-sm text-slate-600">
          The default image is <code>{exactImage}</code>. Already have a key? Paste it into the values.yaml block before installing. Manage keys in <Link className="text-blue-700" href="/dashboard/settings/agent-keys">Agent Keys</Link>.
        </p>
        {accessKey && <CodeBlock value={accessKey} />}
      </div>

      <div className="card space-y-3">
        <h2 className="font-bold">2. Add Helm repository or use local chart</h2>
        <CodeBlock value={`helm show chart ${agentChart} --version ${agentChartVersion}`} />
        <p className="text-sm text-slate-600">
          The agent chart is published as an OCI Helm chart. No repository add step is required.
        </p>
      </div>

      <div className="card space-y-3">
        <h2 className="font-bold">3. Create clusterwatch-values.yaml</h2>
        <CodeBlock value={values} />
        <p className="text-sm text-slate-600">
          <b>Required values:</b> backend.url is the SaaS API URL; auth.email identifies the owning user; auth.accessKey proves organization access; cluster.name is the display name; agent.image.repository and agent.image.tag point to the public collector image.
        </p>
      </div>

      <div className="card space-y-3">
        <h2 className="font-bold">4. Install and verify</h2>
        <CodeBlock value={install} />
        <CodeBlock value={`kubectl get pods -n clusterwatch-agent\nkubectl logs deploy/clusterwatch-collector -n clusterwatch-agent\nkubectl get daemonset clusterwatch-fluent-bit -n clusterwatch-agent`} />
      </div>

      <div className="card space-y-3">
        <h2 className="font-bold">5. Troubleshoot or uninstall</h2>
        <CodeBlock value={`kubectl describe pod -n clusterwatch-agent -l app.kubernetes.io/component=collector\nkubectl logs -n clusterwatch-agent -l app.kubernetes.io/component=fluent-bit\nhelm uninstall clusterwatch-agent -n clusterwatch-agent\nkubectl delete namespace clusterwatch-agent`} />
      </div>
    </div>
  );
}
