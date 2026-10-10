import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MAX_UPLOAD_MB, SUPPORTED_EXTENSIONS_LABEL, TOOLS } from "@framevox/shared";
import { MediaSource } from "../components/MediaSource";
import { Reveal } from "../components/Reveal";
import { ToolIcon } from "../components/ToolIcon";
import { AvailabilityBadge, Button, ButtonLink } from "../components/ui";
import { setPendingFile } from "../lib/pendingFile";

const steps = [
  { title: "Add a file", text: "Choose a video or audio recording you have the right to use." },
  { title: "Pick a task", text: "Extract the audio, or turn the speech into text." },
  { title: "Review and export", text: "Read the result, copy it, or download it in a supported format." },
];

const audiences = [
  { title: "Creators", text: "Captions, transcripts and repurposed content from your own videos." },
  { title: "Students and educators", text: "Lecture transcripts as the base for notes and revision." },
  { title: "Teams", text: "Searchable text from meetings, interviews and training sessions." },
  { title: "Podcasters and researchers", text: "Accurate-enough drafts to edit, quote and reference." },
];

const faqs = [
  {
    q: "Is my file uploaded right now?",
    a: "Not when you pick a file here: it is only checked in your browser. It is sent for processing only when you open a tool and click the action button. Files and results are removed automatically after a short time, or sooner if you click Delete.",
  },
  {
    q: "Which formats can I use?",
    a: `${SUPPORTED_EXTENSIONS_LABEL}, up to ${MAX_UPLOAD_MB} MB by default. Files are checked by FFmpeg itself, not just by their name.`,
  },
  {
    q: "Will transcripts be perfectly accurate?",
    a: "No. Speech-to-text can make mistakes, especially with background noise, accents, overlapping speakers and technical terms. Always review important transcripts.",
  },
  {
    q: "Can I paste a link from YouTube, TikTok, Instagram or another site?",
    a: "Yes, when you run Framevox on your own computer: open the \"Paste a link\" tab, paste the link to a public video and confirm you have permission to use it. Framevox fetches it with the free yt-dlp tool, then you use it like any uploaded file. Private, login-only and copy-protected videos cannot be fetched. You are responsible for having the right to use what you fetch and for following the site's terms.",
  },
  {
    q: "How are my files and transcripts handled?",
    a: "They stay on the computer running Framevox, in a temporary folder, and are deleted automatically or when you click Delete. Only for Transcribe, the extracted audio goes to the speech-to-text provider. See the Privacy page.",
  },
];

const BAR_HEIGHTS = [30, 55, 40, 75, 50, 90, 60, 35, 80, 45, 95, 65, 40, 70, 55, 85, 35, 60, 78, 42, 66, 50, 88, 38, 58, 72, 46, 62];

const transcript = [
  { t: "00:02", text: "Welcome back to the show. Today we are talking about…" },
  { t: "00:07", text: "…how recordings can become searchable, shareable text." },
  { t: "00:13", text: "Let's start with the first question from the audience." },
];

/** Decorative product preview. Purely visual, so hidden from assistive tech. */
function HeroPreview() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-md animate-float [animation-delay:-2s]">
      <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-brand-200/70 via-transparent to-aqua-400/30 blur-2xl" />
      <div className="relative overflow-hidden rounded-3xl border border-white/70 bg-white/80 shadow-[0_30px_80px_-20px_rgb(91_70_232/0.35)] backdrop-blur-xl">
        <div className="flex items-center gap-1.5 border-b border-line px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff6159]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c940]" />
          <span className="ml-3 truncate text-xs font-semibold text-muted">interview.mp4</span>
        </div>
        <div className="p-5">
          <div className="flex h-24 items-center justify-center gap-[3px] rounded-2xl bg-gradient-to-br from-brand-900 to-[#2a1f7a] px-4">
            {BAR_HEIGHTS.map((h, i) => (
              <span
                key={i}
                className="wave-bar w-[5px] rounded-full bg-gradient-to-t from-brand-400 to-aqua-400"
                style={{ height: `${h}%`, "--i": `${(i % 9) * -0.18}s` } as React.CSSProperties}
              />
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between text-xs font-semibold">
            <span className="text-brand-700">Transcribing speech</span>
            <span className="text-muted">68%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-100">
            <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-brand-600 to-aqua-500" />
          </div>
          <ul className="mt-5 space-y-3">
            {transcript.map((l, i) => (
              <li key={l.t} className={`type-line flex gap-3 text-sm ${i === transcript.length - 1 ? "caret" : ""}`} style={{ "--d": `${0.6 + i * 0.9}s` } as React.CSSProperties}>
                <span className="mt-0.5 shrink-0 rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-bold text-brand-700">{l.t}</span>
                <span className="text-ink/80">{l.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="absolute -left-6 top-20 hidden animate-float rounded-2xl border border-white/80 bg-white px-3.5 py-2.5 text-xs font-bold shadow-[var(--shadow-soft)] sm:block [animation-delay:-4s]">
        <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500" />SRT and VTT export
      </div>
      <div className="absolute -bottom-5 -right-3 hidden animate-float rounded-2xl border border-white/80 bg-white px-3.5 py-2.5 text-xs font-bold shadow-[var(--shadow-soft)] sm:block [animation-delay:-1s]">
        <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-brand-500" />Runs in your browser
      </div>
    </div>
  );
}

function Chevron() {
  return (
    <svg className="chev text-muted" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function SectionHead({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <Reveal className="max-w-2xl">
      <p className="text-sm font-bold uppercase tracking-widest text-brand-600">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h2>
      {text && <p className="mt-3 text-lg text-muted">{text}</p>}
    </Reveal>
  );
}

export function Landing() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);

  function go(toolId: string) {
    setPendingFile(file);
    navigate(`/tools/${toolId}`);
  }

  return (
    <>
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="bg-grid absolute inset-0" />
          <div className="absolute -left-24 -top-24 h-[28rem] w-[28rem] animate-aurora rounded-full bg-brand-400/30 blur-3xl" />
          <div className="absolute -right-24 top-10 h-[26rem] w-[26rem] animate-aurora rounded-full bg-aqua-400/25 blur-3xl [animation-delay:-6s] [animation-direction:alternate-reverse]" />
          <div className="absolute bottom-0 left-1/3 h-72 w-72 animate-aurora rounded-full bg-fuchsia-300/20 blur-3xl [animation-delay:-11s]" />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-14 sm:pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10">
          <div>
            <p className="animate-pop inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-3.5 py-1.5 text-xs font-bold text-brand-700 shadow-[var(--shadow-soft)] backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Free to use. Your files stay private.
            </p>
            <h1 className="animate-page mt-6 text-5xl font-extrabold leading-[1.05] tracking-tight [animation-delay:80ms] sm:text-6xl lg:text-[4.25rem]">
              Turn any video into <span className="text-gradient">something more.</span>
            </h1>
            <p className="animate-page mt-6 max-w-xl text-lg leading-relaxed text-muted [animation-delay:160ms]">
              Extract audio, transcribe speech, create subtitles, and turn recordings into useful insights, all in one workspace.
            </p>

            <div className="animate-page mt-9 max-w-xl [animation-delay:240ms]">
              <MediaSource file={file} onFileChange={setFile} />
              {file ? (
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button onClick={() => go("video-to-audio")}>Extract audio</Button>
                  <Button variant="secondary" onClick={() => go("video-to-text")}>Transcribe</Button>
                </div>
              ) : (
                <div className="mt-4">
                  <ButtonLink to="/tools" variant="secondary">
                    Explore tools
                    <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                  </ButtonLink>
                </div>
              )}
              <p className="mt-4 text-sm text-muted">
                Use only files you are allowed to process. Nothing is uploaded until you open a tool and start processing.
              </p>
            </div>
          </div>

          <div className="animate-pop [animation-delay:300ms]"><HeroPreview /></div>
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-8 text-center md:grid-cols-4">
          {[
            [String(TOOLS.length), "tools in one workspace"],
            [`${MAX_UPLOAD_MB} MB`, "per file"],
            [String(SUPPORTED_EXTENSIONS_LABEL.split(", ").length), "formats supported"],
            ["0", "accounts required"],
          ].map(([n, label], i) => (
            <Reveal key={label} delay={i * 70}>
              <dt className="font-display text-3xl font-extrabold text-gradient">{n}</dt>
              <dd className="mt-1 text-sm font-medium text-muted">{label}</dd>
            </Reveal>
          ))}
        </dl>
      </section>

      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24">
        <SectionHead eyebrow="Tools" title="One workspace, several tools" text="Each tool shows its real status, so you always know what works today." />
        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool, i) => (
            <Reveal as="li" key={tool.id} delay={(i % 3) * 90}>
              <Link
                to={`/tools/${tool.id}`}
                className="card-lift group flex h-full flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-white p-6"
              >
                <div className="flex items-start justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600 transition-all duration-300 group-hover:scale-110 group-hover:from-brand-600 group-hover:to-[#7c4dff] group-hover:text-white">
                    <ToolIcon id={tool.id} />
                  </span>
                  <AvailabilityBadge availability={tool.availability} />
                </div>
                <h3 className="text-lg font-bold">{tool.name}</h3>
                <p className="text-sm leading-relaxed text-muted">{tool.summary}</p>
                <span className="mt-auto pt-2 text-sm font-semibold text-brand-700">
                  Open tool <span aria-hidden="true" className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
                </span>
              </Link>
            </Reveal>
          ))}
        </ul>
      </section>

      <section className="bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <SectionHead eyebrow="How it works" title="From recording to result in three steps" />
          <ol className="relative mt-12 grid gap-5 md:grid-cols-3">
            <div aria-hidden="true" className="absolute left-[16%] right-[16%] top-[3.1rem] hidden h-px bg-gradient-to-r from-transparent via-brand-200 to-transparent md:block" />
            {steps.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 110} className="relative rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-[var(--shadow-soft)]">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-[#7c4dff] font-display text-sm font-extrabold text-white shadow-[var(--shadow-btn)]" aria-hidden="true">{i + 1}</span>
                <h3 className="mt-5 text-lg font-bold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.text}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-24">
        <SectionHead eyebrow="Who it is for" title="Built for people who work with recordings" />
        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {audiences.map((a, i) => (
            <Reveal as="li" key={a.title} delay={i * 80} className="card-lift rounded-[var(--radius-card)] border border-line bg-white p-6">
              <h3 className="font-bold">{a.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{a.text}</p>
            </Reveal>
          ))}
        </ul>
      </section>

      <section className="bg-surface">
        <div className="mx-auto max-w-3xl px-5 py-24">
          <SectionHead eyebrow="Pricing" title="Free on your own computer" text="Extracting audio and transcribing both run on your computer at no cost. An optional OpenAI key makes transcription faster." />
          <Reveal className="mt-8"><ButtonLink to="/pricing" variant="secondary">See details</ButtonLink></Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-24">
        <SectionHead eyebrow="FAQ" title="Questions" />
        <Reveal className="mt-10 divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-white">
          {faqs.map((f) => (
            <details key={f.q} className="group px-6 py-5 transition-colors open:bg-brand-50/40">
              <summary className="cursor-pointer list-none font-semibold marker:content-none">
                {f.q}
                <Chevron />
              </summary>
              <p className="mt-3 max-w-prose leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </Reveal>
      </section>

      <section className="px-5 pb-24">
        <Reveal className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-900 via-[#2a1f7a] to-brand-700 px-6 py-16 text-center text-white sm:px-12">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 animate-aurora rounded-full bg-aqua-400/30 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 animate-aurora rounded-full bg-brand-400/40 blur-3xl [animation-delay:-8s]" />
          <h2 className="relative text-3xl font-extrabold tracking-tight sm:text-4xl">Every video has more to give.</h2>
          <p className="relative mx-auto mt-3 max-w-lg text-white/75">Drop in a recording and see what it can become.</p>
          <div className="relative mt-8 flex justify-center">
            <ButtonLink to="/tools/video-to-audio" className="!bg-none !bg-white !text-brand-700 hover:!bg-brand-50">
              Get started free <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </ButtonLink>
          </div>
        </Reveal>
      </section>
    </>
  );
}
