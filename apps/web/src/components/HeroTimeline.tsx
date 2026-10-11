import { CATEGORIES } from "../lib/catalog";

const hue = (id: string) => CATEGORIES.find((c) => c.id === id)!.hue;

/** Waveform bar heights, fixed so the picture never changes between renders. */
const BARS = [30, 52, 40, 72, 58, 88, 46, 64, 34, 78, 92, 60, 44, 70, 38, 56, 82, 48, 66, 36, 74, 54, 42, 68, 50, 86, 62, 40, 58, 32];

function Track({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  return (
    <div className="flex items-stretch gap-3">
      <div className="flex w-[4.6rem] shrink-0 flex-col justify-center sm:w-24">
        <span className="text-xs font-semibold leading-tight" style={{ color }}>{label}</span>
      </div>
      <div className="relative min-w-0 flex-1 overflow-hidden rounded-lg bg-surface/80 ring-1 ring-line">{children}</div>
    </div>
  );
}

/** The signature picture: every kind of media on one timeline. */
export function HeroTimeline() {
  const v = hue("video"), a = hue("audio"), im = hue("image"), f = hue("files");
  return (
    <div className="relative rounded-3xl border border-line bg-white p-4 shadow-[var(--shadow-lift)] sm:p-5" role="img" aria-label="A timeline with video, audio, image and document tracks">
      <div className="mb-3 flex items-center justify-between text-xs text-muted">
        <span className="flex items-center gap-2 font-medium text-ink"><span className="h-2 w-2 rounded-full bg-coral" aria-hidden="true" /> interview-final.mp4</span>
        <span className="tabular-nums">00:42 / 03:18</span>
      </div>
      <div className="relative space-y-2.5">
        <Track label="Video" color={v}>
          <div className="flex h-12 gap-1 p-1">
            {[26, 18, 30, 14, 22].map((w, i) => (
              <div key={i} className="clip rounded-md" style={{ flex: w, background: `linear-gradient(135deg, color-mix(in srgb, ${v} 85%, white), color-mix(in srgb, ${v} 55%, white))` }} />
            ))}
          </div>
        </Track>
        <Track label="Audio" color={a}>
          <div className="flex h-12 items-center gap-[3px] px-2">
            {BARS.map((h, i) => <span key={i} className="w-full rounded-full" style={{ height: `${h}%`, background: a, opacity: 0.35 + (h / 100) * 0.6 }} />)}
          </div>
        </Track>
        <Track label="Images" color={im}>
          <div className="flex h-12 gap-1 p-1">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex-1 rounded-md" style={{ background: `linear-gradient(${120 + i * 25}deg, color-mix(in srgb, ${im} ${55 + i * 6}%, white), color-mix(in srgb, ${im} 25%, white))` }} />
            ))}
          </div>
        </Track>
        <Track label="Documents" color={f}>
          <div className="flex h-12 items-center gap-1.5 px-2">
            {["PDF", "DOCX", "EPUB", "TXT"].map((x, i) => <span key={x} className="rounded-md px-2 py-1 text-[0.65rem] font-semibold text-white" style={{ flex: [1, 1.2, 1, 0.8][i], textAlign: "center", background: f, opacity: 0.6 + i * 0.1 }}>{x}</span>)}
          </div>
        </Track>
        <div className="pointer-events-none absolute bottom-0 left-[4.6rem] right-0 top-0 sm:left-24" aria-hidden="true">
          <div className="playhead absolute -top-1 bottom-0 w-px bg-coral" style={{ left: "38%" }}>
            <span className="absolute -left-[5px] -top-1 h-2.5 w-2.5 rounded-full bg-coral ring-2 ring-white" />
          </div>
        </div>
      </div>
    </div>
  );
}
