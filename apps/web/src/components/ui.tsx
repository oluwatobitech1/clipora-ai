import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import type { ToolAvailability } from "@clipora/shared";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const variants = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 disabled:hover:bg-brand-600",
  secondary: "border border-line bg-white text-ink hover:border-brand-500 hover:text-brand-700",
} as const;

type Variant = keyof typeof variants;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: LinkProps & { variant?: Variant }) {
  return <Link className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

const badgeText: Record<ToolAvailability, string> = {
  available: "Available",
  "in-development": "In development",
  planned: "Planned",
};

/** Status is always spelled out in words, never colour alone. */
export function AvailabilityBadge({ availability }: { availability: ToolAvailability }) {
  const tone =
    availability === "planned" ? "bg-surface text-muted" : "bg-brand-50 text-brand-700";
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {badgeText[availability]}
    </span>
  );
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "error" }) {
  const styles =
    tone === "error" ? "border-danger/30 bg-red-50 text-danger" : "border-brand-200 bg-brand-50 text-ink";
  return (
    <div role={tone === "error" ? "alert" : "note"} className={`rounded-xl border px-4 py-3 text-sm ${styles}`}>
      {children}
    </div>
  );
}
