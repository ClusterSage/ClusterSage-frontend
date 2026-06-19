"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { clearToken } from "@/lib/api";
const nav = [["/dashboard", "Overview"], ["/dashboard/clusters", "Clusters"], ["/dashboard/install-agent", "Install Agent"], ["/dashboard/settings/agent-keys", "Agent Keys"], ["/dashboard/settings", "Settings"]];

function ShellIcon({ label }: { label: string }) {
  switch (label) {
    case "Clusters":
      return <span aria-hidden="true">◎</span>;
    case "Install Agent":
      return <span aria-hidden="true">↓</span>;
    case "Agent Keys":
      return <span aria-hidden="true">◌</span>;
    case "Settings":
      return <span aria-hidden="true">⋯</span>;
    default:
      return <span aria-hidden="true">◫</span>;
  }
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  return <div className="min-h-screen lg:flex">
    <aside className="surface-sidebar border-r p-4 lg:sticky lg:top-0 lg:h-screen lg:w-[220px] lg:p-5">
      <Link href="/dashboard" className="block rounded-2xl">
        <BrandLogo textClassName="text-lg" />
      </Link>
      <p className="mt-5 text-sm text-[var(--text-muted)]">Clusters, access, and setup.</p>
      <nav className="mt-6 space-y-1">
        {nav.map(([href,label]) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return <Link key={href} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition ${active ? "bg-[var(--primary-soft)] text-[var(--primary)] shadow-sm ring-1 ring-[var(--primary-ring)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]"}`}><span className="text-xs"><ShellIcon label={label} /></span><span>{label}</span></Link>;
        })}
      </nav>
      <div className="mt-6 flex items-center gap-3">
        <ThemeToggle />
        <button className="btn-secondary flex-1" onClick={() => { clearToken(); router.push("/login"); }}>Log out</button>
      </div>
    </aside>
    <div className="flex-1">
      <header className="surface-topbar border-b px-5 py-2.5 lg:px-8">
        <div>
          <p className="dashboard-shell-meta">ClusterSage</p>
          <h1 className="mt-1 text-base font-semibold tracking-tight text-[var(--text)]">Workspace</h1>
        </div>
      </header>
      <main className="flex-1 p-5 lg:p-8">{children}</main>
    </div>
  </div>;
}
