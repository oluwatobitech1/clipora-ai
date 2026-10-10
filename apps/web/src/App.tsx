import { SUPPORTED_EXTENSIONS_LABEL } from "@framevox/shared";
import { Converter } from "./components/Converter";
import { Logo } from "./components/Logo";
import { Reveal } from "./components/Reveal";

const features = [
  { title: "Private by design", text: "Your video is converted right on your device. It is never uploaded, so nobody else ever sees it.", icon: "M5 11h14v9H5zM8 11V8a4 4 0 0 1 8 0v3" },
  { title: "Fast", text: "No waiting in a queue and no upload time. Phone videos in M4A are often done in seconds.", icon: "M13 3 5 14h6l-1 7 8-11h-6z" },
  { title: "Free, no sign-up", text: "No account, no watermark and no limit on how many videos you convert.", icon: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" },
] as const;

const steps = [
  { n: "1", title: "Choose your video", text: "Pick a file from your phone or computer, or drag it in." },
  { n: "2", title: "Pick a format", text: "MP3 for everything, M4A for speed, WAV for editing." },
  { n: "3", title: "Download", text: "Play it to check, then save the audio file." },
] as const;

const faqs = [
  { q: "Is my video uploaded anywhere?", a: "No. The conversion runs inside your browser, on your own phone or computer. Your video never leaves your device." },
  { q: "Which format should I choose?", a: "MP3 plays on almost everything, so it is the safe choice. M4A is the fastest and works great on iPhone and Mac. WAV is uncompressed, which is best for editing but makes a much bigger file." },
  { q: "Which videos can I convert?", a: `${SUPPORTED_EXTENSIONS_LABEL}. If your file has no sound, you will be told straight away.` },
  { q: "Why is a long video slow on my phone?", a: "Everything happens on your device, so long videos take longer on phones than on computers. Keep the page open until it finishes, or try a shorter video." },
  { q: "Is it really free?", a: "Yes. There is no sign-up, no watermark and no limit on the number of videos." },
] as const;

function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
        <Logo />
        <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-ok sm:inline-flex">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Free and private
        </span>
      </div>
    </header>
  );
}

// Links to the converter on this page are live. The other tools are not built yet, so they point to "#" until they exist.
const FOOTER_LINKS: { title: string; links: { label: string; href: string }[] }[] = [
  { title: "Video Converter", links: ["MP4 Converter", "Video to GIF", "MOV to MP4", "Video Converter"].map((label) => ({ label, href: "#" })) },
  { title: "Audio Converter", links: ["MP3 Converter", "MP4 to MP3", "Video to MP3", "Audio Converter"].map((label) => ({ label, href: "#convert" })) },
  { title: "Image Converter", links: ["JPG to PDF", "PDF to JPG", "HEIC to JPG", "Image to PDF", "Image Converter"].map((label) => ({ label, href: "#" })) },
  { title: "Document & Ebook", links: ["PDF to WORD", "EPUB to PDF", "EPUB to MOBI", "Document Converter"].map((label) => ({ label, href: "#" })) },
];

export function App() {
  return (
    <>
      <a href="#convert" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:font-semibold">
        Skip to the converter
      </a>
      <Header />
      <main>
        <section className="relative overflow-hidden">
          <div aria-hidden="true" className="bg-grid pointer-events-none absolute inset-0" />
          <div aria-hidden="true" className="animate-aurora pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-brand-200/60 blur-3xl" />
          <div aria-hidden="true" className="animate-aurora pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-aqua-400/25 blur-3xl" />
          <div className="relative mx-auto max-w-2xl px-5 pb-16 pt-12 text-center sm:pt-16">
            <h1 className="animate-page text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
              Turn any video into <span className="text-gradient">clean audio</span>
            </h1>
            <p className="animate-page mx-auto mt-4 max-w-lg text-lg text-muted" style={{ animationDelay: "80ms" }}>
              Get MP3, WAV or M4A in seconds. Free, no sign-up, and your video never leaves your device.
            </p>
            <div id="convert" className="animate-page mt-9 scroll-mt-24" style={{ animationDelay: "160ms" }}>
              <Converter />
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
          <div className="mt-8 space-y-3">
            {faqs.map((f) => (
              <details key={f.q} className="rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-soft)]">
                <summary className="cursor-pointer font-semibold">
                  {f.q}
                  <svg className="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                </summary>
                <p className="mt-3 text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="bg-[#1e2d47] text-white">
        <nav aria-label="Other converters" className="mx-auto grid max-w-5xl grid-cols-2 gap-x-6 gap-y-10 px-5 py-14 lg:grid-cols-4">
          {FOOTER_LINKS.map((col) => (
            <div key={col.title}>
              <h3 className="font-display text-lg font-semibold">{col.title}</h3>
              <ul className="mt-5 space-y-4">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className="text-[0.95rem] text-white/90 transition-colors hover:text-aqua-400">{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-white/10">
          <p className="mx-auto max-w-5xl px-5 py-6 text-center text-xs text-white/60 sm:text-left">© {new Date().getFullYear()} Video to Audio. Only convert videos you have the right to use.</p>
        </div>
      </footer>
    </>
  );
}
