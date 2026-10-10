import type { TranscribePhase } from "../lib/useBrowserTranscription";

export function SpeechProgress({ phase, doing = "Turning speech into text" }: { phase: TranscribePhase; doing?: string }) {
  if (phase.kind === "idle" || phase.kind === "done") return null;
  return (
    <div role="status" aria-live="polite">
      {phase.kind === "download" && phase.pct > 0 ? <progress className="w-full" max={1} value={phase.pct} aria-label="Model download" /> : <progress className="w-full" aria-label="Working" />}
      <p className="mt-2 text-sm text-muted">
        {phase.kind === "prepare" && "Reading the audio from your file. Keep this page open."}
        {phase.kind === "download" && `Loading the speech model${phase.pct > 0 ? `: ${Math.round(phase.pct * 100)}%` : ""}. First time only. Keep this page open.`}
        {phase.kind === "transcribe" && `${doing}. This can take a few minutes. Keep this page open.`}
      </p>
    </div>
  );
}
