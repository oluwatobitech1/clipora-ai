import { Link } from "react-router-dom";
import { BRAND } from "../lib/brand";

/** A clip on a timeline: a rounded tile with a play head and a waveform tail. */
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id="clipora-grad" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4b45ee" />
          <stop offset="1" stopColor="#2a1fa8" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#clipora-grad)" />
      <path d="M12.2 9.6v12.8a.8.8 0 0 0 1.2.7l10-6.4a.8.8 0 0 0 0-1.4l-10-6.4a.8.8 0 0 0-1.2.7Z" fill="#fff" />
      <rect x="6.2" y="13.2" width="2" height="5.6" rx="1" fill="#fff" fillOpacity=".55" />
      <rect x="3.4" y="14.8" width="2" height="2.4" rx="1" fill="#fff" fillOpacity=".35" />
      <circle cx="25.6" cy="7" r="2.1" fill="#ff7a59" />
    </svg>
  );
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className={`group flex items-center gap-2.5 font-display font-bold tracking-tight ${light ? "text-white" : "text-ink"}`} aria-label={`${BRAND.name} home`}>
      <span className="transition-transform duration-300 group-hover:-rotate-6">
        <LogoMark />
      </span>
      <span className="text-[1.3rem] leading-none">Clipora<span className={light ? "text-white/60" : "text-brand-600"}> AI</span></span>
    </Link>
  );
}
