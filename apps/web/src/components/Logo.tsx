import { Link } from "react-router-dom";
import { APP_NAME } from "@framevox/shared";

/** The mark: a camera frame (video) around a waveform (voice). */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0 drop-shadow-[0_4px_10px_rgba(91,70,232,0.35)]">
      <defs>
        <linearGradient id="fv-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5b46e8" />
          <stop offset="0.6" stopColor="#7c4dff" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#fv-grad)" />
      <path
        d="M8.5 12V9.5a1 1 0 0 1 1-1H12M20 8.5h2.5a1 1 0 0 1 1 1V12M23.5 20v2.5a1 1 0 0 1-1 1H20M12 23.5H9.5a1 1 0 0 1-1-1V20"
        fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="1.6" strokeLinecap="round"
      />
      <path d="M12.5 18v-4M16 20.5v-9M19.5 19v-6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link to="/" className="group flex items-center gap-2.5 font-display font-extrabold tracking-tight text-ink" aria-label={`${APP_NAME} home`}>
      <span className="transition-transform duration-300 group-hover:rotate-[-6deg] group-hover:scale-105">
        <LogoMark />
      </span>
      <span className="text-xl">{APP_NAME}</span>
    </Link>
  );
}
