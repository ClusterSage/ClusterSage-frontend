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

function UnavailableTrend({ label = "Historical data unavailable" }: { label?: string }) {
  return (
    <div
      className="dashboard-metric-trend-empty hidden h-14 w-[88px] shrink-0 rounded-xl md:flex"
      role="img"
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 88 56" className="h-full w-full">
        <path d="M8 38 C18 34, 26 42, 36 37 S56 32, 66 36 S76 40, 80 35" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="4 4" />
      </svg>
    </div>
  );
}

export function DashboardMetricCard({
  icon,
  label,
  value,
  helper,
  accent = "var(--primary)",
  footer,
  trend,
  trendLabel,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  helper?: string;
  accent?: string;
  footer?: ReactNode;
  trend?: number[];
  trendLabel?: string;
}) {
  const path = trend?.length ? buildLinePath(trend) : "";

  return (
    <section className="dashboard-metric-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="dashboard-metric-icon" style={{ color: accent }}>
            {icon}
          </div>
          <div className="min-w-0">
            <p className="dashboard-metric-label">{label}</p>
            <p className="mt-2 break-words text-[clamp(1.4rem,2vw,2.15rem)] font-semibold tracking-tight text-[var(--text)]">{value}</p>
            {helper ? <p className="mt-1 text-xs text-[var(--text-soft)]">{helper}</p> : null}
          </div>
        </div>
        {path ? (
          <div className="hidden h-12 w-[84px] shrink-0 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)]/45 p-2 text-[var(--text-soft)] md:block" role="img" aria-label={trendLabel || `${label} trend`}>
            <svg viewBox="0 0 60 36" className="h-full w-full">
              <path d={path} fill="none" stroke={accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        ) : (
          <UnavailableTrend label={trendLabel || `${label} historical data unavailable`} />
        )}
      </div>
      {footer ? <div className="mt-4 border-t border-[var(--border)] pt-3">{footer}</div> : null}
    </section>
  );
}
