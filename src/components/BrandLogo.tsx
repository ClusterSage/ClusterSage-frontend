type BrandLogoProps = {
  compact?: boolean;
  className?: string;
  markClassName?: string;
  textClassName?: string;
};

export function BrandLogo({ compact = false, className = "", markClassName = "", textClassName = "" }: BrandLogoProps) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`} aria-label="ClusterSage">
      <span className={`grid h-9 w-9 place-items-center rounded-lg bg-blue-600 text-white shadow-sm shadow-blue-200 ${markClassName}`} aria-hidden="true">
        <svg viewBox="0 0 32 32" className="h-6 w-6" fill="none" role="img">
          <path d="M16 3.5 27 9.75v12.5L16 28.5 5 22.25V9.75L16 3.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M16 10.25v5.5m0 0 4.75 2.75M16 15.75 11.25 18.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="16" cy="9.25" r="2" fill="currentColor" />
          <circle cx="10.25" cy="19.25" r="2" fill="currentColor" />
          <circle cx="21.75" cy="19.25" r="2" fill="currentColor" />
        </svg>
      </span>
      {!compact && <span className={`font-black tracking-tight text-slate-950 ${textClassName}`}>ClusterSage</span>}
    </span>
  );
}
