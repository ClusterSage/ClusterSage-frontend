import type { ReactNode } from "react";

function buildLinePath(points: number[]) {
  if (!points.length) return "";
  if (points.length === 1) return "M 2 18 L 58 18";
  const max = Math.max(...points, 1);
  return points
    .map((point, index) => {
      const x = 2 + (index / (points.length - 1)) * 56;
      const y = 34 - (point / max) * 22;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export function DashboardMetricCard({
  icon,
  label,
  value,
  helper,
  accent = "var(--primary)",
  footer,
  trend,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  helper: string;
  accent?: string;
  footer?: ReactNode;
  trend?: number[];
}) {
  const path = trend?.length ? buildLinePath(trend) : "";

  return (
    <section className="dashboard-metric-card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="dashboard-metric-icon" style={{ color: accent }}>
            {icon}
          </div>
          <div className="min-w-0">
            <p className="dashboard-metric-label">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)]">{value}</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">{helper}</p>
          </div>
        </div>
        {path ? (
          <div className="hidden h-12 w-16 shrink-0 md:block">
            <svg viewBox="0 0 60 36" className="h-full w-full">
              <path d={path} fill="none" stroke={accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        ) : null}
      </div>
      {footer ? <div className="mt-4 border-t border-[var(--border)] pt-3">{footer}</div> : null}
    </section>
  );
}
