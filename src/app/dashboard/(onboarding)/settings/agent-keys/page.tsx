"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AgentKey } from "@/types/api";
import { CodeBlock } from "@/components/CodeBlock";

export default function AgentKeysPage() {
  const [keys, setKeys] = useState<AgentKey[]>([]);
  const [raw, setRaw] = useState("");
  const [error, setError] = useState("");

  const load = () => api<AgentKey[]>("/api/agent-keys").then(setKeys).catch((e) => setError(e.message));

  useEffect(() => {
    void load();
  }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const name = String(new FormData(e.currentTarget).get("name") || "Default agent key");
    try {
      const key = await api<AgentKey>("/api/agent-keys", { method: "POST", body: JSON.stringify({ name }) });
      setRaw(key.raw_key || "");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function revoke(id: string) {
    await api(`/api/agent-keys/${id}`, { method: "DELETE" });
    await load();
  }

  const activeKeys = keys.filter((key) => !key.revoked_at).length;
  const revokedKeys = keys.filter((key) => !!key.revoked_at).length;

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Agent access</p>
        <h1 className="section-title mt-2">Agent keys</h1>
        <p className="section-copy mt-2">Create keys for new cluster connections and revoke them when they are no longer needed.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card">
          <p className="text-sm font-medium muted">Total keys</p>
          <p className="mt-2 text-3xl font-bold">{keys.length}</p>
        </div>
        <div className="card">
          <p className="text-sm font-medium muted">Active</p>
          <p className="mt-2 text-3xl font-bold text-[var(--success-text)]">{activeKeys}</p>
        </div>
        <div className="card">
          <p className="text-sm font-medium muted">Revoked</p>
          <p className="mt-2 text-3xl font-bold text-[var(--text-soft)]">{revokedKeys}</p>
        </div>
      </div>

      <form onSubmit={submit} className="card grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="space-y-2">
          <label className="text-sm font-medium muted">Key name</label>
          <input className="input" name="name" placeholder="Primary cluster key" />
        </div>
        <button className="btn">Generate key</button>
      </form>

      {error && <div className="card border-[var(--danger-bg)] text-[var(--danger-text)]">{error}</div>}

      {raw && (
        <div className="card border-[var(--success-bg)]">
          <h2 className="text-xl font-semibold text-[var(--success-text)]">Copy this key now</h2>
          <p className="mb-3 mt-1 text-sm muted">The raw access key will not be shown again.</p>
          <CodeBlock value={raw} />
        </div>
      )}

      <div className="space-y-3">
        {keys.map((k) => (
          <div className="card flex flex-col gap-4 md:flex-row md:items-center md:justify-between" key={k.id}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{k.name}</p>
                <span className={`status-chip ${k.revoked_at ? "status-chip-muted" : "status-chip-success"}`}>
                  {k.revoked_at ? "Revoked" : "Active"}
                </span>
              </div>
              <p className="mt-2 text-sm muted">
                Last 4: {k.key_last4} - Created {new Date(k.created_at).toLocaleString()}
              </p>
            </div>
            <button className="btn-secondary w-full md:w-auto" disabled={!!k.revoked_at} onClick={() => revoke(k.id)}>
              Revoke
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
