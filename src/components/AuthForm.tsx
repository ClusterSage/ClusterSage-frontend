"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { api, setToken } from "@/lib/api";
export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter(); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); setError(""); setLoading(true); const form = new FormData(e.currentTarget); const body: Record<string,string> = Object.fromEntries(form.entries()) as Record<string,string>; try { const data = await api<{access_token:string}>(mode === "login" ? "/api/auth/login" : "/api/auth/register", { method: "POST", body: JSON.stringify(body) }); setToken(data.access_token); router.push("/dashboard"); } catch (err) { setError(err instanceof Error ? err.message : "Request failed"); } finally { setLoading(false); } }
  return <form onSubmit={submit} className="card mx-auto max-w-md space-y-4"><BrandLogo textClassName="text-xl" /><div><h1 className="text-2xl font-bold">{mode === "login" ? "Log in to ClusterSage" : "Create your ClusterSage workspace"}</h1><p className="mt-1 text-sm text-slate-600">Kubernetes visibility for teams that operate private clusters.</p></div>{mode === "register" && <><input className="input" name="full_name" placeholder="Full name" /><input className="input" name="organization_name" placeholder="Organization name" required /></>}<input className="input" name="email" type="email" placeholder="Email" required /><input className="input" name="password" type="password" placeholder="Password" required minLength={8} />{error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button className="btn w-full" disabled={loading}>{loading ? "Working..." : mode === "login" ? "Log in" : "Register"}</button></form>;
}
