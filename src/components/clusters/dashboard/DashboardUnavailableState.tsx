export function DashboardUnavailableState({
  title = "Unavailable",
  message,
}: {
  title?: string;
  message: string;
}) {
  return (
    <div className="dashboard-unavailable-state">
      <div className="dashboard-unavailable-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 16h3l2-5 3 7 2-4h6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 6h16" strokeLinecap="round" opacity="0.5" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-medium text-[var(--text)]">{title}</p>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{message}</p>
      </div>
    </div>
  );
}
