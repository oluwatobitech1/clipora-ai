import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MAX_UPLOAD_MB, SUPPORTED_EXTENSIONS_LABEL, TOOLS } from "@clipora/shared";
import { UploadZone } from "../components/UploadZone";
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
    q: "Can I use a link from another video site?",
    a: "No. Clipora AI only works on files you upload and are authorized to process. It does not download content from third-party platforms.",
  },
  {
    q: "How are my files and transcripts handled?",
    a: "They stay on the computer running Clipora, in a temporary folder, and are deleted automatically or when you click Delete. Only for Transcribe, the extracted audio goes to the speech-to-text provider. See the Privacy page.",
  },
];

export function Landing() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);

  function go(toolId: string) {
    setPendingFile(file);
    navigate(`/tools/${toolId}`);
  }

  return (
    <>
      <section className="bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto max-w-3xl px-5 pb-20 pt-16 text-center sm:pt-24">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
            Turn any video into something more.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted">
            Extract audio, transcribe speech, create subtitles, and turn recordings into useful insights, all in one workspace.
          </p>

          <div className="mx-auto mt-10 max-w-xl text-left">
            <UploadZone file={file} onFileChange={setFile} />
            {file ? (
              <div className="mt-4 flex flex-wrap gap-3">
                <Button onClick={() => go("video-to-audio")}>Extract audio</Button>
                <Button variant="secondary" onClick={() => go("video-to-text")}>Transcribe</Button>
              </div>
            ) : (
              <div className="mt-4">
                <ButtonLink to="/tools" variant="secondary">Explore tools</ButtonLink>
              </div>
            )}
            <p className="mt-4 text-sm text-muted">
              Use only files you are allowed to process. Nothing is uploaded until you open a tool and start processing.
            </p>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20">
        <h2 className="text-3xl font-bold tracking-tight">One workspace, several tools</h2>
        <p className="mt-3 max-w-prose text-muted">Each tool shows its real status, so you always know what works today.</p>
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool) => (
            <li key={tool.id}>
              <Link
                to={`/tools/${tool.id}`}
                className="flex h-full flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-white p-6 transition-colors hover:border-brand-500"
              >
                <AvailabilityBadge availability={tool.availability} />
                <h3 className="text-lg font-semibold">{tool.name}</h3>
                <p className="text-sm text-muted">{tool.summary}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="rounded-[var(--radius-card)] bg-white p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white" aria-hidden="true">{i + 1}</span>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-3xl font-bold tracking-tight">Built for people who work with recordings</h2>
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {audiences.map((a) => (
            <li key={a.title} className="rounded-[var(--radius-card)] border border-line p-6">
              <h3 className="font-semibold">{a.title}</h3>
              <p className="mt-2 text-sm text-muted">{a.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-surface">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <h2 className="text-3xl font-bold tracking-tight">Pricing</h2>
          <p className="mt-3 text-muted">
            Free to run on your own computer. Extracting audio costs nothing; transcription uses your own speech-to-text key.
          </p>
          <div className="mt-6"><ButtonLink to="/pricing" variant="secondary">See details</ButtonLink></div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-20">
        <h2 className="text-3xl font-bold tracking-tight">Questions</h2>
        <div className="mt-8 divide-y divide-line border-y border-line">
          {faqs.map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="cursor-pointer list-none font-semibold marker:content-none">{f.q}</summary>
              <p className="mt-2 max-w-prose text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
