"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { clearToken } from "@/lib/api";
const nav = [["/dashboard", "Overview"], ["/dashboard/clusters", "Clusters"], ["/dashboard/install-agent", "Install Agent"], ["/dashboard/settings/agent-keys", "Agent Keys"], ["/dashboard/settings", "Settings"]];
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  return <div className="min-h-screen lg:flex">
    <aside className="surface-sidebar border-r p-4 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:p-5">
      <Link href="/dashboard" className="block rounded-2xl">
        <BrandLogo textClassName="text-lg" />
      </Link>
      <p className="mt-5 text-sm text-[var(--text-muted)]">Clusters, access, and setup.</p>
      <nav className="mt-6 space-y-1">
        {nav.map(([href,label]) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return <Link key={href} href={href} className={`block rounded-xl px-3 py-2 text-sm font-semibold transition ${active ? "bg-[var(--primary-soft)] text-[var(--primary)] shadow-sm" : "text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]"}`}>{label}</Link>;
        })}
      </nav>
      <div className="mt-6 flex items-center gap-3">
        <ThemeToggle />
        <button className="btn-secondary flex-1" onClick={() => { clearToken(); router.push("/login"); }}>Log out</button>
      </div>
    </aside>
    <div className="flex-1">
      <header className="surface-topbar border-b px-5 py-3 lg:px-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow">ClusterSage console</p>
            <h1 className="mt-1 text-lg font-semibold tracking-tight text-[var(--text)]">Workspace</h1>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-muted)] shadow-sm">
            Setup stays separate from live cluster operations.
          </div>
        </div>
      </header>
      <main className="flex-1 p-5 lg:p-8">{children}</main>
    </div>
  </div>;
}
