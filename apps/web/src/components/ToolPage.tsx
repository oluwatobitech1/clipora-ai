import { Reveal } from "./Reveal";
import { ToolConverter } from "./ToolConverter";
import type { ToolDef } from "../lib/tools";

const features = [
  { title: "Private by design", text: "Your files are converted right on your device. They are never uploaded, so nobody else ever sees them.", icon: "M5 11h14v9H5zM8 11V8a4 4 0 0 1 8 0v3" },
  { title: "No waiting in a queue", text: "There is no upload or download wait. It starts the moment you press the button.", icon: "M13 3 5 14h6l-1 7 8-11h-6z" },
  { title: "Free, no sign-up", text: "No account, no watermark and no limit on how many files you convert.", icon: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" },
] as const;

const steps = [
  { n: "1", title: "Choose your file", text: "Pick a file from your phone or computer, or drag it in." },
  { n: "2", title: "Convert", text: "Choose the settings you want and press the button." },
  { n: "3", title: "Download", text: "Save the result straight to your device." },
] as const;

/** A page for one of the converters: heading, the converter box, then a short explanation and questions. */
export function ToolPage({ tool }: { tool: ToolDef }) {
  return (
    <main>
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="bg-grid pointer-events-none absolute inset-0" />
        <div aria-hidden="true" className="animate-aurora pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-brand-200/60 blur-3xl" />
        <div aria-hidden="true" className="animate-aurora pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-aqua-400/25 blur-3xl" />
        <div className="relative mx-auto max-w-2xl px-5 pb-16 pt-12 text-center sm:pt-16">
          <h1 className="animate-page text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
            {tool.heading}<span className="text-gradient">{tool.accent}</span>
          </h1>
          <p className="animate-page mx-auto mt-4 max-w-lg text-lg text-muted" style={{ animationDelay: "80ms" }}>{tool.lead}</p>
          <div id="convert" className="animate-page mt-9 scroll-mt-24" style={{ animationDelay: "160ms" }}>
            <ToolConverter key={tool.slug} tool={tool} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-14" aria-labelledby="why">
        <Reveal><h2 id="why" className="text-center text-3xl font-extrabold tracking-tight">Simple, fast and private</h2></Reveal>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 90}>
              <div className="card-lift h-full rounded-2xl border border-line bg-white p-6 shadow-[var(--shadow-soft)]">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-[#7c4dff] text-white">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={f.icon} /></svg>
                </span>
                <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
                <p className="mt-1.5 text-muted">{f.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="bg-surface" aria-labelledby="how">
        <div className="mx-auto max-w-5xl px-5 py-14">
          <Reveal><h2 id="how" className="text-center text-3xl font-extrabold tracking-tight">How it works</h2></Reveal>
          <ol className="mt-8 grid gap-5 md:grid-cols-3">
            {steps.map((s, i) => (
              <Reveal key={s.n} as="li" delay={i * 90}>
                <div className="flex gap-4 rounded-2xl border border-line bg-white p-5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 font-display font-extrabold text-white">{s.n}</span>
                  <div>
                    <h3 className="font-bold">{s.title}</h3>
                    <p className="mt-1 text-sm text-muted">{s.text}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-5 py-14" aria-labelledby="faq">
        <Reveal><h2 id="faq" className="text-center text-3xl font-extrabold tracking-tight">Questions</h2></Reveal>
        <div className="mt-6 grid gap-3">
          {tool.faq.map((f) => (
            <details key={f.q} className="rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-soft)]">
              <summary className="cursor-pointer font-semibold">
                {f.q}
                <svg className="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
              </summary>
              <p className="mt-2 text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
