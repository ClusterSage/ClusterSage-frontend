"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { User } from "@/types/api";

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    api<User>("/api/auth/me").then(setUser);
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow">Workspace settings</p>
        <h1 className="section-title mt-2">Settings</h1>
      </div>
      <div className="card">
        <h2 className="text-xl font-semibold">Account</h2>
        <p className="mt-3 text-sm muted">Email: {user?.email || "Loading..."}</p>
        <p className="text-sm muted">Role: {user?.role || ""}</p>
      </div>
    </div>
  );
}
