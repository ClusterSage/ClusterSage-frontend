import type { ReactNode } from "react";

export function DashboardPanel({
  title,
  subtitle,
  eyebrow,
  right,
  children,
  className = "",
  bodyClassName = "",
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`dashboard-panel ${className}`.trim()}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? <p className="dashboard-panel-eyebrow">{eyebrow}</p> : null}
          <h2 className="dashboard-panel-title">{title}</h2>
          {subtitle ? <p className="dashboard-panel-subtitle">{subtitle}</p> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className={bodyClassName ? `mt-4 ${bodyClassName}` : "mt-4"}>{children}</div>
    </section>
  );
}
