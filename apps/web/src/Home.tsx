import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, EyeOff, Gauge, Search, Wallet } from "lucide-react";
import { CategoryTile, ToolCard } from "./components/Cards";
import { HeroTimeline } from "./components/HeroTimeline";
import { Icon } from "./components/Icon";
import { Reveal } from "./components/Reveal";
import { ALL_ENTRIES, CATEGORIES, findCategory, popularTools } from "./lib/catalog";

const faqs = [
  { q: "What can I do with Clipora AI?", a: "Convert video, audio, images and documents: MP4, MP3, GIF, JPG, PDF, Word, EPUB and more." },
  { q: "Are my files uploaded anywhere?", a: "Every tool runs inside your browser, on your own phone or computer, so your files never leave your device." },
  { q: "Is it really free?", a: "Yes. There is no sign-up, no watermark and no limit on the number of files." },
  { q: "Why is a big video slow on my phone?", a: "Everything happens on your device, so large videos take longer on phones than on computers. Keep the page open until it finishes, or try a shorter clip." },
  { q: "Does it work offline?", a: "The page needs to load once. After that the converters run on your device, but the video converters download their engine the first time you use them." },
] as const;

const reasons = [
  { icon: EyeOff, title: "Your files stay on your device", text: "Converters run in your browser. Nothing is uploaded, so nobody else ever sees your video, audio or documents." },
  { icon: Gauge, title: "No queue, no waiting to upload", text: "Work starts the moment you press the button. Short clips are often done in seconds." },
  { icon: Wallet, title: "Free, with no account", text: "No sign-up, no watermark and no limit on how many files you convert." },
] as const;

export function Home() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(query.trim() ? `/tools?q=${encodeURIComponent(query.trim())}` : "/tools");
  };

  return (
    <main id="main">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line bg-gradient-to-b from-brand-50/70 to-white">
        <div aria-hidden="true" className="bg-grid pointer-events-none absolute inset-0" />
        <div className="relative mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-12 px-5 pb-16 pt-12 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-24 lg:pt-20">
          <div>
            <h1 className="animate-page text-[2.6rem] font-bold leading-[1.04] tracking-tight sm:text-6xl">
              Every media tool you need, in one place
            </h1>
            <p className="animate-page mt-5 max-w-xl text-lg leading-relaxed text-muted" style={{ animationDelay: "80ms" }}>
              Convert video, audio, images and documents. Free, with no sign-up, and your files stay on your device.
            </p>
            <form onSubmit={submit} role="search" className="animate-page mt-8 max-w-xl" style={{ animationDelay: "160ms" }}>
              <label htmlFor="hero-search" className="sr-only">Search {ALL_ENTRIES.length} tools</label>
              <div className="flex items-center gap-2 rounded-2xl border border-line bg-white p-2 pl-4 shadow-[var(--shadow-lift)] focus-within:border-brand-500">
                <Search size={20} className="shrink-0 text-muted" aria-hidden="true" />
                <input
                  id="hero-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Try MP4, MP3, PDF or HEIC"
                  className="min-w-0 flex-1 border-0 bg-transparent py-2 text-base outline-none focus:shadow-none"
                />
                <button type="submit" className="rounded-xl bg-brand-600 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-brand-700">Search</button>
              </div>
            </form>
            <div className="animate-page mt-5 flex flex-wrap gap-2" style={{ animationDelay: "220ms" }}>
              {CATEGORIES.map((c) => c.id).map((id) => {
                const c = findCategory(id)!;
                return (
                  <Link key={id} to={`/category/${id}`} className="flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-1.5 text-sm font-medium transition-colors hover:border-brand-400">
                    <Icon name={c.icon} size={15} className="" /> {c.name}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="animate-page" style={{ animationDelay: "200ms" }}>
            <HeroTimeline />
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-6xl px-5 py-16 lg:py-20" aria-labelledby="categories">
        <Reveal>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="categories" className="text-3xl font-bold tracking-tight sm:text-4xl">Pick a category</h2>
              <p className="mt-2 max-w-lg text-muted">{ALL_ENTRIES.length} tools, all free to use.</p>
            </div>
            <Link to="/tools" className="inline-flex items-center gap-1.5 font-semibold text-brand-700 hover:underline">Browse all tools <ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map((c) => <CategoryTile key={c.id} category={c} />)}
        </div>
      </section>

      {/* Popular */}
      <section className="border-y border-line bg-surface" aria-labelledby="popular">
        <div className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
          <h2 id="popular" className="text-3xl font-bold tracking-tight sm:text-4xl">Most used right now</h2>
          <p className="mt-2 max-w-lg text-muted">Open one and you can convert in a few seconds.</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {popularTools().map((t) => <ToolCard key={t.slug} tool={t} showCategory />)}
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="bg-[#0f1330] text-white" aria-labelledby="why">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-[1fr_1.2fr] lg:py-20">
          <div>
            <h2 id="why" className="text-3xl font-bold tracking-tight sm:text-4xl">Built to keep your media yours</h2>
            <p className="mt-3 max-w-md text-white/70">Clipora AI is a toolbox, not a storage service. You bring a file, you take the result, and that is the end of it.</p>
          </div>
          <ul className="divide-y divide-white/10 border-y border-white/10">
            {reasons.map((r) => (
              <li key={r.title} className="flex gap-4 py-6">
                <r.icon size={24} className="mt-0.5 shrink-0 text-aqua-400" aria-hidden="true" />
                <div>
                  <h3 className="font-display text-lg font-semibold">{r.title}</h3>
                  <p className="mt-1 text-white/70">{r.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-5 py-16 lg:py-20" aria-labelledby="faq">
        <h2 id="faq" className="text-3xl font-bold tracking-tight sm:text-4xl">Questions</h2>
        <div className="mt-8 space-y-3">
          {faqs.map((f) => (
            <details key={f.q} className="rounded-2xl border border-line bg-white p-5">
              <summary className="cursor-pointer font-semibold">
                {f.q}
                <svg className="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
              </summary>
              <p className="mt-3 text-muted">{f.a}</p>
            </details>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-start gap-4 rounded-3xl bg-brand-50 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-xl font-semibold">Ready to try a tool?</p>
            <p className="text-muted">Choose a file and convert it in seconds.</p>
          </div>
          <Link to="/tools" className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow-[var(--shadow-btn)] transition-colors hover:bg-brand-700">
            <Check size={18} aria-hidden="true" /> Open the tools directory
          </Link>
        </div>
      </section>
    </main>
  );
}
