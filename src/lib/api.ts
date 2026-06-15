const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "";
export function getApiUrl() {
  if (configuredApiUrl) return configuredApiUrl;
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NODE_ENV === "development" ? "http://localhost:8000" : "";
}
export type ApiError = { detail?: string };
export function getToken() { if (typeof window === "undefined") return null; return localStorage.getItem("clusterwatch_token"); }
export function setToken(token: string) { localStorage.setItem("clusterwatch_token", token); }
export function clearToken() { localStorage.removeItem("clusterwatch_token"); }
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${getApiUrl()}${path}`, { ...options, headers, cache: "no-store" });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try { const data = await res.json() as ApiError; message = data.detail || message; } catch {}
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
export const apiUrl = configuredApiUrl;
