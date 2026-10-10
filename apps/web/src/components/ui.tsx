import type { ButtonHTMLAttributes, ReactNode } from "react";

const base =
  "group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl px-6 py-3.5 text-base font-semibold transition-all duration-300 ease-out active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0";
const variants = {
  primary:
    "bg-gradient-to-br from-brand-600 via-brand-600 to-[#7c4dff] text-white shadow-[var(--shadow-btn)] hover:-translate-y-0.5 hover:from-brand-700 hover:to-brand-600 hover:shadow-[0_2px_4px_rgb(29_20_80/0.25),0_14px_28px_-6px_rgb(91_70_232/0.6)]",
  secondary:
    "border border-line bg-white text-ink shadow-[var(--shadow-soft)] hover:-translate-y-0.5 hover:border-brand-500 hover:text-brand-700",
} as const;

export type Variant = keyof typeof variants;
/** Class names for anything that should look like a button (a button or a download link). */
export const buttonClass = (variant: Variant = "primary", extra = "") => `${base} ${variants[variant]} ${extra}`;

export function Button({ variant = "primary", className = "", children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button type="button" className={buttonClass(variant, className)} {...props}>
      {variant === "primary" && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 -left-full w-1/2 -skew-x-12 bg-white/25 opacity-0 transition-opacity group-hover:animate-sheen group-hover:opacity-100" />
      )}
      {children}
    </button>
  );
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "error" }) {
  const styles = tone === "error" ? "border-danger/30 bg-red-50 text-danger" : "border-brand-200 bg-brand-50 text-ink";
  return (
    <div role={tone === "error" ? "alert" : "note"} className={`animate-pop rounded-xl border px-4 py-3 text-sm ${styles}`}>
      {children}
    </div>
  );
}
