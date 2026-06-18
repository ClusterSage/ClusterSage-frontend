"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getToken } from "@/lib/api";
import type { User } from "@/types/api";
export function RequireAuth({ children }: { children: React.ReactNode }) { const router = useRouter(); const [ready, setReady] = useState(false); useEffect(() => { if (!getToken()) { router.replace("/login"); return; } api<User>("/api/auth/me").then(() => setReady(true)).catch(() => router.replace("/login")); }, [router]); if (!ready) return <div className="min-h-screen bg-[var(--bg)] p-10 text-[var(--text-muted)]">Loading workspace...</div>; return <>{children}</>; }
