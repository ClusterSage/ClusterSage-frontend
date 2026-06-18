type BrandLogoProps = {
  compact?: boolean;
  className?: string;
  markClassName?: string;
  textClassName?: string;
};

export function BrandLogo({ compact = false, className = "", markClassName = "", textClassName = "" }: BrandLogoProps) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`} aria-label="ClusterSage">
      <span
        className={`grid h-10 w-10 place-items-center rounded-2xl bg-[var(--primary)] text-white shadow-[0_14px_32px_rgba(31,111,255,0.28)] ${markClassName}`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 32 32" className="h-6 w-6" fill="none" role="img">
          <path d="M16 4.5 25.5 10v11L16 27.5 6.5 21V10L16 4.5Z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
          <path d="M10.5 12.75h11M16 8.75v14.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          <path d="M10.5 19.25 16 15.75l5.5 3.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="10.5" cy="12.75" r="1.65" fill="currentColor" />
          <circle cx="16" cy="8.75" r="1.65" fill="currentColor" />
          <circle cx="21.5" cy="12.75" r="1.65" fill="currentColor" />
          <circle cx="16" cy="15.75" r="1.65" fill="currentColor" />
          <circle cx="10.5" cy="19.25" r="1.65" fill="currentColor" />
          <circle cx="21.5" cy="19.25" r="1.65" fill="currentColor" />
        </svg>
      </span>
      {!compact && <span className={`font-black tracking-tight text-[var(--text)] ${textClassName}`}>ClusterSage</span>}
    </span>
  );
}
