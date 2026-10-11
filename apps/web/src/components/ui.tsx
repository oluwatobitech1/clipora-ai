import type { ButtonHTMLAttributes, ReactNode } from "react";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none";
const variants = {
  primary: "bg-brand-600 text-white shadow-[var(--shadow-btn)] hover:bg-brand-700",
  secondary: "border border-line bg-white text-ink hover:border-brand-500 hover:text-brand-700",
} as const;

export type Variant = keyof typeof variants;
/** Class names for anything that should look like a button (a button or a download link). */
export const buttonClass = (variant: Variant = "primary", extra = "") => `${base} ${variants[variant]} ${extra}`;

export function Button({ variant = "primary", className = "", children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button type="button" className={buttonClass(variant, className)} {...props}>
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
