/** Play button turning into sound waves: video in, audio out. */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0 drop-shadow-[0_4px_10px_rgba(91,70,232,0.35)]">
      <defs>
        <linearGradient id="va-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5b46e8" />
          <stop offset="0.6" stopColor="#7c4dff" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#va-grad)" />
      <path d="M9.5 9.8v12.4a1 1 0 0 0 1.5.86l9-6.2a1 1 0 0 0 0-1.72l-9-6.2a1 1 0 0 0-1.5.86Z" fill="#fff" />
      <path d="M23.2 12.6a5 5 0 0 1 0 6.8M26 9.8a9 9 0 0 1 0 12.4" fill="none" stroke="#fff" strokeOpacity="0.75" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <a href="/" className="group flex items-center gap-2.5 font-display font-extrabold tracking-tight text-ink" aria-label="Video to Audio">
      <span className="transition-transform duration-300 group-hover:rotate-[-6deg] group-hover:scale-105">
        <LogoMark />
      </span>
      <span className="text-xl">Video to Audio</span>
    </a>
  );
}
