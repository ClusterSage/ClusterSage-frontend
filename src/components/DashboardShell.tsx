"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { clearToken } from "@/lib/api";
const nav = [["/dashboard", "Overview"], ["/dashboard/clusters", "Clusters"], ["/dashboard/install-agent", "Install Agent"], ["/dashboard/settings/agent-keys", "Agent Keys"], ["/dashboard/settings", "Settings"]];
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  return <div className="min-h-screen bg-slate-50 lg:flex">
    <aside className="border-r border-slate-200 bg-white/95 p-5 lg:sticky lg:top-0 lg:h-screen lg:w-72">
      <Link href="/dashboard" className="block rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100">
        <BrandLogo textClassName="text-xl" />
      </Link>
      <nav className="mt-8 space-y-1">
        {nav.map(([href,label]) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return <Link key={href} href={href} className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition ${active ? "bg-blue-50 text-blue-700 shadow-sm" : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"}`}>{label}</Link>;
        })}
      </nav>
      <button className="btn-secondary mt-8 w-full" onClick={() => { clearToken(); router.push("/login"); }}>Logout</button>
    </aside>
    <main className="flex-1 p-6 lg:p-10">{children}</main>
  </div>;
}
