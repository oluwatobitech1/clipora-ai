import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import type { ToolAvailability } from "@framevox/shared";

const base =
  "group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-300 ease-out active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0";
const variants = {
  primary:
    "bg-gradient-to-br from-brand-600 via-brand-600 to-[#7c4dff] text-white shadow-[var(--shadow-btn)] hover:-translate-y-0.5 hover:from-brand-700 hover:to-brand-600 hover:shadow-[0_2px_4px_rgb(29_20_80/0.25),0_14px_28px_-6px_rgb(91_70_232/0.6)]",
  secondary:
    "border border-line bg-white text-ink shadow-[var(--shadow-soft)] hover:-translate-y-0.5 hover:border-brand-500 hover:text-brand-700",
} as const;

type Variant = keyof typeof variants;

/** A soft highlight that sweeps across primary buttons on hover. */
function Sheen() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 -left-full w-1/2 -skew-x-12 bg-white/25 opacity-0 transition-opacity group-hover:animate-sheen group-hover:opacity-100" />
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button type="button" className={`${base} ${variants[variant]} ${className}`} {...props}>
      {variant === "primary" && <Sheen />}
      {props.children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: LinkProps & { variant?: Variant }) {
  return (
    <Link className={`${base} ${variants[variant]} ${className}`} {...props}>
      {variant === "primary" && <Sheen />}
      {props.children}
    </Link>
  );
}

const badgeText: Record<ToolAvailability, string> = {
  available: "Available",
  "in-development": "In development",
  planned: "Planned",
};

/** Status is always spelled out in words, never colour alone. */
export function AvailabilityBadge({ availability }: { availability: ToolAvailability }) {
  const tone =
    availability === "planned" ? "bg-surface text-muted" : availability === "available" ? "bg-emerald-50 text-ok" : "bg-brand-50 text-brand-700";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {availability === "available" && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
      {badgeText[availability]}
    </span>
  );
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "error" }) {
  const styles =
    tone === "error" ? "border-danger/30 bg-red-50 text-danger" : "border-brand-200 bg-brand-50 text-ink";
  return (
    <div role={tone === "error" ? "alert" : "note"} className={`animate-pop rounded-xl border px-4 py-3 text-sm ${styles}`}>
      {children}
    </div>
  );
}
