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

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Agent access</p>
        <h1 className="section-title mt-2">Agent keys</h1>
        <p className="section-copy mt-2">
          Keys are shown once, then stored only as hashes. Use them to bootstrap cluster installs without re-exposing the raw value later.
        </p>
      </div>
      <form onSubmit={submit} className="card flex gap-3">
        <input className="input" name="name" placeholder="Production AKS agent" />
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
          <div className="card flex items-center justify-between" key={k.id}>
            <div>
              <p className="font-semibold">{k.name}</p>
              <p className="text-sm muted">
                last4: {k.key_last4} · created {new Date(k.created_at).toLocaleString()} {k.revoked_at ? "· revoked" : ""}
              </p>
            </div>
            <button className="btn-secondary" disabled={!!k.revoked_at} onClick={() => revoke(k.id)}>
              Revoke
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
