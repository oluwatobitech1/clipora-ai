import { Link } from "react-router-dom";
import { APP_NAME } from "@clipora/shared";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 font-bold tracking-tight text-ink" aria-label={`${APP_NAME} home`}>
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#5b46e8" />
        <path d="M9 20v-8M13.5 23V9M18.5 21V11M23 18v-4" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      <span className="text-lg">{APP_NAME}</span>
    </Link>
  );
}
