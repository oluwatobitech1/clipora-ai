import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { TAGLINE, TOOLS } from "@framevox/shared";
import { useAuth } from "../auth/AuthContext";
import { useMode } from "../lib/mode";
import { Logo } from "./Logo";
import { ButtonLink } from "./ui";

const nav = [
  { to: "/tools", label: "Tools" },
  { to: "/#features", label: "Features" },
  { to: "/pricing", label: "Pricing" },
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
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const { session, signOut, configured } = useAuth();
  // No sign-in in local mode, while the mode is loading, or when Supabase is not set up (accounts are optional).
  const hideAuth = useMode()?.local !== false || !configured;
  const { pathname, hash } = useLocation();
  useEffect(() => setOpen(false), [pathname, hash]);

  const link = "nav-link rounded-lg px-3 py-2 text-sm font-semibold text-muted transition-colors hover:text-ink [&.active]:text-ink";
  return (
    <header className={`sticky top-0 z-20 border-b backdrop-blur-xl transition-all duration-300 ${scrolled ? "border-line bg-white/85 shadow-[0_8px_30px_-12px_rgb(13_18_48/0.15)]" : "border-transparent bg-white/60"}`}>
      <div className={`mx-auto flex max-w-6xl items-center justify-between px-5 transition-all duration-300 ${scrolled ? "h-14" : "h-16"}`}>
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {nav.map((n) => (
            n.to.includes("#") ? <Link key={n.to} to={n.to} className={link}>{n.label}</Link> : <NavLink key={n.to} to={n.to} className={link}>{n.label}</NavLink>
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
          className="rounded-lg px-3 py-2 text-sm font-semibold transition-colors hover:bg-brand-50 md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Close menu" : "Menu"}
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Main" className="animate-menu flex flex-col gap-1 border-t border-line bg-white px-5 py-3 md:hidden">
          {nav.map((n) => (
            n.to.includes("#") ? <Link key={n.to} to={n.to} className={link}>{n.label}</Link> : <NavLink key={n.to} to={n.to} className={link}>{n.label}</NavLink>
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
    <footer className="relative overflow-hidden border-t border-line bg-surface">
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 left-1/2 h-64 w-[40rem] -translate-x-1/2 rounded-full bg-brand-200/40 blur-3xl" />
      <div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted">{TAGLINE}</p>
        </div>
        <div className={col}>
          <p className={head}>Tools</p>
          {TOOLS.map((t) => (
            <Link key={t.id} to={`/tools/${t.id}`} className="w-fit transition-all hover:translate-x-0.5 hover:text-brand-700">{t.name}</Link>
          ))}
        </div>
        <div className={col}>
          <p className={head}>Company</p>
          <Link to="/privacy" className="w-fit transition-all hover:translate-x-0.5 hover:text-brand-700">Privacy</Link>
          <Link to="/terms" className="w-fit transition-all hover:translate-x-0.5 hover:text-brand-700">Terms</Link>
        </div>
      </div>
      <p className="relative border-t border-line py-5 text-center text-xs text-muted">
        © {new Date().getFullYear()} Framevox. Only use files you have the right to process.
      </p>
    </footer>
  );
}

export function SiteLayout() {
  const { pathname } = useLocation();
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:font-semibold">
        Skip to content
      </a>
      <ScrollToHash />
      <Header />
      <main id="main" key={pathname} className="animate-page min-h-[60vh]"><Outlet /></main>
      <Footer />
    </>
  );
}
