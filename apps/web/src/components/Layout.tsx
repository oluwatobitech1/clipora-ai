import { useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { TOOL_GROUPS, toolsInGroup } from "../lib/tools";
import { Logo } from "./Logo";

function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
        <Logo />
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-ok sm:inline-flex">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Free and private
          </span>
          <a href="#tools" className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">All tools</a>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer id="tools" className="scroll-mt-0 bg-[#1e2d47] text-white">
      <nav aria-label="All converters" className="mx-auto grid max-w-5xl grid-cols-2 gap-x-6 gap-y-10 px-5 py-14 lg:grid-cols-4">
        {TOOL_GROUPS.map((group) => (
          <div key={group}>
            <h3 className="font-display text-lg font-semibold">{group}</h3>
            <ul className="mt-5 space-y-4">
              {toolsInGroup(group).map((t) => (
                <li key={t.slug}>
                  <Link to={`/${t.slug}`} className="text-[0.95rem] text-white/90 transition-colors hover:text-aqua-400">{t.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-5xl px-5 py-6 text-center text-xs text-white/60 sm:text-left">© {new Date().getFullYear()} Video to Audio. Only convert files you have the right to use.</p>
      </div>
    </footer>
  );
}

/** Header and footer around every page. Also scrolls to the top when you open another tool. */
export function Layout() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <>
      <a href="#convert" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:font-semibold">
        Skip to the converter
      </a>
      <Header />
      <Outlet />
      <Footer />
    </>
  );
}
