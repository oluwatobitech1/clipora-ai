import { Link, useSearchParams } from "react-router-dom";
import { Search, X } from "lucide-react";
import { ALL_ENTRIES, CATEGORIES, entriesIn, findCategory, searchEntries, type CategoryId } from "../lib/catalog";
import { ToolCard } from "./Cards";
import { Icon, IconTile } from "./Icon";

/** The tools directory: a sidebar of categories, search, a status filter and the tools themselves. */
export function Directory({ categoryId }: { categoryId?: CategoryId }) {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const current = categoryId ? findCategory(categoryId) : undefined;

  const update = (next: Record<string, string>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) (v ? p.set(k, v) : p.delete(k));
    setParams(p, { replace: true });
  };

  const matches = new Set(searchEntries(q).map((e) => e.slug));
  const groups = (current ? [current] : CATEGORIES)
    .map((c) => ({ category: c, tools: entriesIn(c.id).filter((t) => matches.has(t.slug)) }))
    .filter((g) => g.tools.length > 0);
  const total = groups.reduce((n, g) => n + g.tools.length, 0);

  const pill = (active: boolean) =>
    `shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${active ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white hover:border-brand-400"}`;

  return (
    <main id="main" className="bg-surface/60">
      <div className="mx-auto max-w-6xl px-5 pb-20 pt-8 lg:pt-10">
        <nav aria-label="Breadcrumb" className="text-sm text-muted">
          <Link to="/" className="hover:text-ink">Home</Link> <span aria-hidden="true">/</span>{" "}
          {current ? <><Link to="/tools" className="hover:text-ink">Tools</Link> <span aria-hidden="true">/</span> <span className="text-ink">{current.name}</span></> : <span className="text-ink">Tools</span>}
        </nav>

        <header className="mt-4 flex items-start gap-4">
          {current && <IconTile name={current.icon} hue={current.hue} size={56} iconSize={28} />}
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{current ? current.name : "All tools"}</h1>
            <p className="mt-1.5 max-w-xl text-muted">{current ? current.blurb : `${ALL_ENTRIES.length} tools for video, audio, images and files.`}</p>
          </div>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
          {/* Sidebar on desktop, scrolling chips on mobile */}
          <aside aria-label="Categories" className="min-w-0">
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 lg:hidden">
              <Link to={`/tools${q ? `?q=${encodeURIComponent(q)}` : ""}`} className={pill(!current)}>All</Link>
              {CATEGORIES.map((c) => <Link key={c.id} to={`/category/${c.id}`} className={pill(current?.id === c.id)}>{c.name}</Link>)}
            </div>
            <nav className="sticky top-24 hidden rounded-2xl border border-line bg-white p-2 lg:block">
              <Link to="/tools" className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold ${!current ? "bg-brand-50 text-brand-700" : "hover:bg-surface"}`}>
                All tools <span className="text-xs font-medium text-muted">{ALL_ENTRIES.length}</span>
              </Link>
              {CATEGORIES.map((c) => (
                <Link key={c.id} to={`/category/${c.id}`} aria-current={current?.id === c.id ? "page" : undefined} className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold ${current?.id === c.id ? "bg-brand-50 text-brand-700" : "hover:bg-surface"}`}>
                  <Icon name={c.icon} size={17} className="shrink-0" />
                  <span className="flex-1">{c.name}</span>
                  <span className="text-xs font-medium text-muted">{entriesIn(c.id).length}</span>
                </Link>
              ))}
            </nav>
          </aside>

          <div className="min-w-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <label htmlFor="dir-search" className="sr-only">Search tools</label>
                <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
                <input
                  id="dir-search"
                  type="search"
                  value={q}
                  onChange={(e) => update({ q: e.target.value })}
                  placeholder={current ? `Search in ${current.name}` : "Search tools, like MP4, MP3 or PDF"}
                  className="w-full rounded-xl border border-line bg-white py-3 pl-10 pr-4 text-base outline-none"
                />
              </div>
            </div>

            <p className="mt-4 text-sm text-muted" aria-live="polite">{total} {total === 1 ? "tool" : "tools"}{q ? ` for "${q}"` : ""}</p>

            {total === 0 && (
              <div className="mt-6 rounded-2xl border border-dashed border-line bg-white p-10 text-center">
                <p className="font-display text-lg font-semibold">No tools match your search</p>
                <p className="mt-1 text-muted">Try a format such as MP4, MP3 or PDF, or clear the filters.</p>
                <button type="button" onClick={() => setParams({}, { replace: true })} className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-line px-4 py-2 text-sm font-semibold hover:border-brand-400"><X size={16} aria-hidden="true" /> Clear filters</button>
              </div>
            )}

            <div className="mt-6 space-y-10">
              {groups.map(({ category, tools }) => (
                <section key={category.id} aria-labelledby={`g-${category.id}`}>
                  {!current && (
                    <div className="mb-3 flex items-center justify-between">
                      <h2 id={`g-${category.id}`} className="flex items-center gap-2.5 font-display text-xl font-semibold">
                        <span className="h-5 w-1.5 rounded-full" style={{ background: category.hue }} aria-hidden="true" /> {category.name}
                      </h2>
                      <Link to={`/category/${category.id}`} className="text-sm font-semibold text-brand-700 hover:underline">View category</Link>
                    </div>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {tools.map((t) => <ToolCard key={t.slug} tool={t} />)}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
