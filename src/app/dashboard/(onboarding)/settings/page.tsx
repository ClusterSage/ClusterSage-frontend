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
      <h1 className="text-3xl font-bold">Settings</h1>
      <div className="card">
        <h2 className="font-bold">Account</h2>
        <p className="mt-2 text-slate-600">Email: {user?.email || "Loading..."}</p>
        <p className="text-slate-600">Role: {user?.role || ""}</p>
        <p className="text-slate-600">Organization ID: {user?.organization_id || ""}</p>
      </div>
    </div>
  );
}
