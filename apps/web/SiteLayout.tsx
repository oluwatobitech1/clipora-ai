import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { TAGLINE, TOOLS } from "@clipora/shared";
import { useAuth } from "../auth/AuthContext";
import { useMode } from "../lib/mode";
import { Logo } from "./Logo";
import { ButtonLink } from "./ui";

const nav = [
  { to: "/tools", label: "Tools" },
  { to: "/#features", label: "Features" },
];

function ScrollToHash() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

function Header() {
  const [open, setOpen] = useState(false);
  const { session, signOut, configured } = useAuth();
  // No sign-in in local mode, while the mode is loading, or when Supabase is not set up (accounts are optional).
  const hideAuth = useMode()?.local !== false || !configured;
  const { pathname, hash } = useLocation();
  useEffect(() => setOpen(false), [pathname, hash]);

  const link = "rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:text-ink";
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} className={link}>{n.label}</NavLink>
          ))}
          {!hideAuth && (session ? (
            <button type="button" onClick={signOut} className={link}>Sign out</button>
          ) : (
            <Link to="/login" className={link}>Sign in</Link>
          ))}
          <ButtonLink to="/tools/video-to-audio" className="ml-2 !py-2">Upload a file</ButtonLink>
        </nav>
        <button
          type="button"
          className="rounded-lg px-3 py-2 text-sm font-semibold md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Close menu" : "Menu"}
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Main" className="flex flex-col gap-1 border-t border-line px-5 py-3 md:hidden">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} className={link}>{n.label}</NavLink>
          ))}
          {!hideAuth && (session ? (
            <button type="button" onClick={signOut} className={`${link} text-left`}>Sign out</button>
          ) : (
            <Link to="/login" className={link}>Sign in</Link>
          ))}
          <ButtonLink to="/tools/video-to-audio" className="mt-2">Upload a file</ButtonLink>
        </nav>
      )}
    </header>
  );
}

function Footer() {
  const col = "flex flex-col gap-2 text-sm text-muted";
  const head = "mb-1 text-sm font-semibold text-ink";
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted">{TAGLINE}</p>
        </div>
        <div className={col}>
          <p className={head}>Tools</p>
          {TOOLS.map((t) => (
            <Link key={t.id} to={`/tools/${t.id}`} className="hover:text-ink">{t.name}</Link>
          ))}
        </div>
        <div className={col}>
          <p className={head}>Company</p>
          <Link to="/privacy" className="hover:text-ink">Privacy</Link>
          <Link to="/terms" className="hover:text-ink">Terms</Link>
        </div>
      </div>
      <p className="border-t border-line py-5 text-center text-xs text-muted">
        Only use files you have the right to process.
      </p>
    </footer>
  );
}

export function SiteLayout() {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:font-semibold">
        Skip to content
      </a>
      <ScrollToHash />
      <Header />
      <main id="main"><Outlet /></main>
      <Footer />
    </>
  );
}
