import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { categoryOfSlug, entryOf, entriesIn, relatedTo } from "../lib/catalog";
import { IconTile } from "./Icon";
import { Reveal } from "./Reveal";

export interface Fact { label: string; value: string }
export interface Faq { q: string; a: string }

const STEPS = [
  { title: "Choose your file", text: "Pick a file from your phone or computer, or drag it in." },
  { title: "Set it up", text: "Choose the format and settings you want." },
  { title: "Download", text: "Save the result straight to your device." },
];

/** The workspace around every tool: breadcrumb, title, sibling tabs, the tool itself, a side panel, and help below. */
export function ToolShell({
  slug, heading, lead, children, facts = [], faq = [], steps = STEPS, privacy = "Your files are converted on your device and never uploaded.",
}: {
  slug: string;
  heading: string;
  lead: string;
  children: ReactNode;
  facts?: Fact[];
  faq?: Faq[];
  steps?: { title: string; text: string }[];
  privacy?: string;
}) {
  const entry = entryOf(slug);
  const category = categoryOfSlug(slug);
  const siblings = category ? entriesIn(category.id) : [];
  const related = relatedTo(slug, 5);

  return (
    <main id="main" className="bg-surface/60">
      <div className="mx-auto max-w-6xl px-5 pb-16 pt-8 lg:pt-10">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-muted">
          <Link to="/" className="hover:text-ink">Home</Link>
          <ChevronRight size={14} aria-hidden="true" />
          {category && <><Link to={`/category/${category.id}`} className="hover:text-ink">{category.name}</Link><ChevronRight size={14} aria-hidden="true" /></>}
          <span className="text-ink">{entry?.label}</span>
        </nav>

        <header className="mt-5 flex items-start gap-4">
          {entry && category && <IconTile name={entry.icon} hue={category.hue} size={56} iconSize={28} />}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="animate-page text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{heading}</h1>
            </div>
            <p className="mt-2 max-w-2xl text-lg text-muted">{lead}</p>
          </div>
        </header>

        {siblings.length > 1 && (
          <nav aria-label={`More in ${category?.name}`} className="no-scrollbar -mx-5 mt-6 flex gap-2 overflow-x-auto px-5">
            {siblings.map((s) => (
              <Link key={s.slug} to={`/${s.slug}`} aria-current={s.slug === slug ? "page" : undefined} className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${s.slug === slug ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white hover:border-brand-400"}`}>
                {s.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div id="convert" className="scroll-mt-24 animate-page">{children}</div>

          <aside className="space-y-4" aria-label="About this tool">
            {facts.length > 0 && (
              <section className="rounded-2xl border border-line bg-white p-5">
                <h2 className="font-display text-base font-semibold">About this tool</h2>
                <dl className="mt-3 space-y-3 text-sm">
                  {facts.map((f) => (
                    <div key={f.label}>
                      <dt className="text-muted">{f.label}</dt>
                      <dd className="mt-0.5 font-medium">{f.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
            <section className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm">
              <ShieldCheck size={20} className="mt-0.5 shrink-0 text-ok" aria-hidden="true" />
              <p className="text-ink/80">{privacy}</p>
            </section>
            <section className="rounded-2xl border border-line bg-white p-2">
              <h2 className="px-3 pb-1 pt-3 font-display text-base font-semibold">Related tools</h2>
              <ul>
                {related.map((r) => {
                  const rc = categoryOfSlug(r.slug)!;
                  return (
                    <li key={r.slug}>
                      <Link to={`/${r.slug}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface">
                        <IconTile name={r.icon} hue={rc.hue} size={34} iconSize={17} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{r.label}</span>
                          <span className="block truncate text-xs text-muted">{rc.name}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          </aside>
        </div>
      </div>

      <section className="border-y border-line bg-white" aria-labelledby="how">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <Reveal><h2 id="how" className="text-2xl font-bold tracking-tight sm:text-3xl">How it works</h2></Reveal>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="flex gap-4 rounded-2xl bg-surface p-5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 font-display font-bold text-white">{i + 1}</span>
                <div>
                  <h3 className="font-display font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {faq.length > 0 && (
        <section className="mx-auto max-w-3xl px-5 py-14" aria-labelledby="faq">
          <h2 id="faq" className="text-2xl font-bold tracking-tight sm:text-3xl">Questions</h2>
          <div className="mt-6 grid gap-3">
            {faq.map((f) => (
              <details key={f.q} className="rounded-2xl border border-line bg-white p-5">
                <summary className="cursor-pointer font-semibold">
                  {f.q}
                  <svg className="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                </summary>
                <p className="mt-2 text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
