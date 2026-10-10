import type { ReactNode } from "react";
import { ButtonLink } from "../components/ui";

function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <div className="mt-6 space-y-4 text-muted">{children}</div>
      <div className="mt-10"><ButtonLink to="/tools" variant="secondary">Back to the tools</ButtonLink></div>
    </div>
  );
}

export function Privacy() {
  return (
    <Page title="Privacy">
      <p>Framevox runs on the computer where it is installed. The file you choose is sent only to the Framevox server on that same computer, where FFmpeg extracts the audio.</p>
      <p>Files and results are kept in a temporary folder and are removed automatically after a short time (2 hours by default), or immediately when you click Delete or Cancel.</p>
      <p>When you click Transcribe, only the extracted audio (not the video) is sent to the speech-to-text provider configured by whoever runs the server (OpenAI by default), using their API key. That provider handles the audio under its own terms. Nothing is sent to any provider when you extract audio.</p>
      <p>There are no accounts, no tracking and no ads in this version.</p>
    </Page>
  );
}

export function Terms() {
  return (
    <Page title="Terms of use">
      <p>Use Framevox only with recordings you own or have permission to process, and follow the laws that apply to you.</p>
      <p>Transcripts are produced by an automatic speech-recognition service and can contain mistakes. Check important text against the original recording.</p>
      <p>The tool is provided as it is, without warranties. Keep your own copy of anything you cannot afford to lose, because results are deleted automatically.</p>
    </Page>
  );
}

export function Pricing() {
  return (
    <Page title="Pricing">
      <p>This version of Framevox is free to run on your own computer. Audio extraction has no cost and needs no account.</p>
      <p>Transcription uses your own speech-to-text API key, so the provider bills you directly for the minutes of audio you transcribe. Framevox adds no charge.</p>
    </Page>
  );
}
