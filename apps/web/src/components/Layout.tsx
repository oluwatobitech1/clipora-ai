import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Menu, Search, X } from "lucide-react";
import { ALL_ENTRIES, CATEGORIES, entriesIn, type CategoryId } from "../lib/catalog";
import { BRAND } from "../lib/brand";
import { Icon, IconTile } from "./Icon";
import { Logo } from "./Logo";

const TOP_LINKS: CategoryId[] = ["video", "audio", "image", "files"];

function MegaMenu({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-x-0 top-full border-b border-line bg-white shadow-[0_24px_40px_-24px_rgb(15_19_48/0.25)]">
      <div className="mx-auto grid max-w-6xl grid-cols-3 gap-x-6 gap-y-1 px-5 py-5">
        {CATEGORIES.map((c) => {
          const items = entriesIn(c.id);
          return (
            <Link key={c.id} to={`/category/${c.id}`} onClick={onClose} className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-surface">
              <IconTile name={c.icon} hue={c.hue} size={40} iconSize={20} />
              <span className="min-w-0">
                <span className="block font-display font-semibold leading-tight">{c.name}</span>
                <span className="mt-0.5 block text-sm leading-snug text-muted">{c.blurb}</span>
                <span className="mt-1 block text-xs text-muted">{items.length} tools</span>
              </span>
            </Link>
          );
        })}
      </div>
      <div className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 text-sm">
          <span className="text-muted">{ALL_ENTRIES.length} tools in {CATEGORIES.length} categories</span>
          <Link to="/tools" onClick={onClose} className="font-semibold text-brand-700 hover:underline">Browse the full directory</Link>
        </div>
      </div>
    </div>
  );
}

function Header() {
  const [menu, setMenu] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const { pathname } = useLocation();

  useEffect(() => { setMenu(false); setDrawer(false); }, [pathname]);
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown); };
  }, [menu]);
  useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawer]);

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${isActive ? "bg-brand-50 text-brand-700" : "text-ink/80 hover:bg-surface hover:text-ink"}`;

  return (
    <header ref={ref} className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-5">
        <Logo />
        <nav aria-label="Main" className="ml-6 hidden items-center gap-1 lg:flex">
          <button
            type="button"
            aria-expanded={menu}
            aria-controls="mega-menu"
            onClick={() => setMenu((v) => !v)}
            className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${menu ? "bg-brand-50 text-brand-700" : "text-ink/80 hover:bg-surface hover:text-ink"}`}
          >
            All tools <ChevronDown size={16} className={`transition-transform ${menu ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          {TOP_LINKS.map((id) => {
            const c = CATEGORIES.find((x) => x.id === id)!;
            return <NavLink key={id} to={`/category/${id}`} className={`${navClass({ isActive: false })} hidden xl:block`}>{c.name}</NavLink>;
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link to="/tools" className="hidden items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm text-muted transition-colors hover:border-brand-400 hover:text-ink sm:flex">
            <Search size={16} aria-hidden="true" /> Search {ALL_ENTRIES.length} tools
          </Link>
          <Link to="/tools" aria-label="Search tools" className="flex h-10 w-10 items-center justify-center rounded-xl text-ink hover:bg-surface sm:hidden"><Search size={20} aria-hidden="true" /></Link>
          <button type="button" aria-label="Open menu" aria-expanded={drawer} onClick={() => setDrawer(true)} className="flex h-10 w-10 items-center justify-center rounded-xl text-ink hover:bg-surface lg:hidden">
            <Menu size={22} aria-hidden="true" />
          </button>
        </div>
      </div>
      {menu && <div id="mega-menu" className="hidden lg:block"><MegaMenu onClose={() => setMenu(false)} /></div>}

      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-ink/40" onClick={() => setDrawer(false)} />
          <div className="animate-menu absolute inset-y-0 right-0 flex w-[88%] max-w-sm flex-col bg-white shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-line px-5">
              <span className="font-display text-lg font-bold">Categories</span>
              <button type="button" aria-label="Close menu" onClick={() => setDrawer(false)} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-surface"><X size={22} aria-hidden="true" /></button>
            </div>
            <nav aria-label="Categories" className="flex-1 overflow-y-auto p-3">
              <Link to="/tools" className="mb-1 flex items-center gap-3 rounded-xl bg-brand-50 p-3 font-semibold text-brand-700">
                <Search size={20} aria-hidden="true" /> Browse all {ALL_ENTRIES.length} tools
              </Link>
              {CATEGORIES.map((c) => (
                <Link key={c.id} to={`/category/${c.id}`} className="flex items-center gap-3 rounded-xl p-3 hover:bg-surface">
                  <IconTile name={c.icon} hue={c.hue} size={38} iconSize={19} />
                  <span>
                    <span className="block font-semibold leading-tight">{c.name}</span>
                    <span className="block text-sm text-muted">{c.blurb}</span>
                  </span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}

const FOOTER_COLUMNS: CategoryId[][] = [["video"], ["audio"], ["image"], ["files"]];

function Footer() {
  const navigate = useNavigate();
  return (
    <footer className="bg-[#0f1330] text-white">
      <div className="mx-auto max-w-6xl px-5 pt-14">
        <div className="flex flex-col gap-6 border-b border-white/10 pb-10 md:flex-row md:items-end md:justify-between">
          <div className="max-w-md">
            <Logo light />
            <p className="mt-4 text-[0.95rem] leading-relaxed text-white/70">{BRAND.description}</p>
          </div>
          <button type="button" onClick={() => navigate("/tools")} className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-white px-5 py-3 text-sm font-semibold text-ink transition-colors hover:bg-brand-100 md:self-auto">
            <Search size={16} aria-hidden="true" /> Browse all tools
          </button>
        </div>
        <nav aria-label="All tools" className="grid grid-cols-2 gap-x-6 gap-y-10 py-12 lg:grid-cols-4">
          {FOOTER_COLUMNS.map((ids, i) => (
            <div key={i} className="space-y-8">
              {ids.map((id) => {
                const c = CATEGORIES.find((x) => x.id === id)!;
                return (
                  <div key={id}>
                    <h3 className="flex items-center gap-2 font-display text-base font-semibold">
                      <Icon name={c.icon} size={16} className="text-white/60" />
                      <Link to={`/category/${id}`} className="hover:text-white/80">{c.name}</Link>
                    </h3>
                    <ul className="mt-3 space-y-2.5">
                      {entriesIn(id).map((t) => (
                        <li key={t.slug}>
                          <Link to={`/${t.slug}`} className={`text-sm transition-colors hover:text-white text-white/80`}>{t.label}</Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          ))}
        </nav>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-5 py-6 text-xs text-white/55">© {new Date().getFullYear()} {BRAND.name}. Only convert files you have the right to use.</p>
      </div>
    </footer>
  );
}

/** Header and footer around every page. Also scrolls to the top when you open another page. */
export function Layout() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:font-semibold">
        Skip to the content
      </a>
      <Header />
      <Outlet />
      <Footer />
    </>
  );
}
