import { NavLink, Outlet } from "react-router-dom";
import { Logo } from "./Logo";
import { Notice } from "./ui";

const items = [
  { to: "/dashboard", label: "Overview", end: true },
  { to: "/projects", label: "Projects" },
  { to: "/tools", label: "Tools" },
  { to: "/dashboard/usage", label: "Usage" },
  { to: "/settings", label: "Settings" },
];

export function DashboardLayout() {
  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-sm font-semibold ${isActive ? "bg-brand-50 text-brand-700" : "text-muted hover:text-ink"}`;
  return (
    <div className="min-h-screen bg-surface md:grid md:grid-cols-[15rem_1fr]">
      <aside className="border-b border-line bg-white p-4 md:border-b-0 md:border-r">
        <Logo />
        <nav aria-label="Dashboard" className="mt-4 flex gap-1 overflow-x-auto md:mt-8 md:flex-col">
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end} className={link}>{i.label}</NavLink>
          ))}
        </nav>
      </aside>
      <div className="p-5 md:p-8">
        <div className="mb-6">
          <Notice>
            This is the dashboard layout only. Sign-in, saved projects and usage numbers arrive in Milestone 4, so nothing here is real account data.
          </Notice>
        </div>
        <main id="main"><Outlet /></main>
      </div>
    </div>
  );
}
