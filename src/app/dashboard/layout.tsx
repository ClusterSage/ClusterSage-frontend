import { DashboardShell } from "@/components/DashboardShell";
import { RequireAuth } from "@/components/RequireAuth";
export default function DashboardLayout({ children }: { children: React.ReactNode }) { return <RequireAuth><DashboardShell>{children}</DashboardShell></RequireAuth>; }
