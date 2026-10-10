import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AUDIO_OUTPUT_FORMATS, TOOLS, type AudioOutputFormat } from "@framevox/shared";
import { AudioExtractor } from "../components/AudioExtractor";
import { BleepMaker } from "../components/BleepMaker";
import { FindMoment } from "../components/FindMoment";
import { HighlightClipper } from "../components/HighlightClipper";
import { SpeakingCoach } from "../components/SpeakingCoach";
import { SubtitleEditor } from "../components/SubtitleEditor";
import { Summarizer } from "../components/Summarizer";
import { Transcriber } from "../components/Transcriber";
import { Translator } from "../components/Translator";
import { ToolIcon } from "../components/ToolIcon";
import { UploadZone } from "../components/UploadZone";
import { AvailabilityBadge, ButtonLink, Notice } from "../components/ui";
import { clearPendingFile, peekPendingFile } from "../lib/pendingFile";
import { NotFound } from "./NotFound";

export function ToolPage() {
  const { toolId } = useParams();
  const tool = TOOLS.find((t) => t.id === toolId);
  const [file, setFile] = useState<File | null>(() => peekPendingFile());
  const [format, setFormat] = useState<AudioOutputFormat>("mp3");

  useEffect(() => clearPendingFile(), []);

  if (!tool) return <NotFound />;

  const isWorkspace = tool.availability === "available";

  function renderTool() {
    switch (tool?.id) {
      case "video-to-audio": return <AudioExtractor file={file} format={format} />;
      case "video-to-text": return <Transcriber file={file} />;
      case "subtitles": return <SubtitleEditor file={file} />;
      case "video-summarizer": return <Summarizer file={file} />;
      case "translate": return <Translator file={file} />;
      case "find-moment": return <FindMoment file={file} />;
      case "highlight-clipper": return <HighlightClipper file={file} />;
      case "bleep-maker": return <BleepMaker file={file} />;
      case "speaking-coach": return <SpeakingCoach file={file} />;
      default: return null;
    }
  }

  return (
    <div className="relative">
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-brand-50 to-white" />
    <div className="relative mx-auto max-w-3xl px-5 py-14">
      <Link to="/tools" className="group mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-brand-700">
        <span aria-hidden="true" className="transition-transform duration-300 group-hover:-translate-x-1">←</span> All tools
      </Link>
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-[#7c4dff] text-white shadow-[var(--shadow-btn)]">
          <ToolIcon id={tool.id} className="h-7 w-7" />
        </span>
        <div>
          <AvailabilityBadge availability={tool.availability} />
          <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight sm:text-4xl">{tool.name}</h1>
        </div>
      </div>
      <p className="mt-4 max-w-prose text-lg text-muted">{tool.summary}</p>

      {!isWorkspace ? (
        <div className="mt-8 space-y-6">
          <Notice>This tool is planned for {tool.milestone}. It needs a finished transcript pipeline first, so there is nothing to try yet.</Notice>
          <ButtonLink to="/tools/video-to-text" variant="secondary">Try Video to Text instead</ButtonLink>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          <UploadZone file={file} onFileChange={setFile} />

          {tool.id === "video-to-audio" && (
            <div>
              <label htmlFor="format" className="mb-1.5 block text-sm font-semibold">Audio format</label>
              <select
                id="format"
                value={format}
                onChange={(e) => setFormat(e.target.value as AudioOutputFormat)}
                className="w-full cursor-pointer rounded-xl border border-line bg-white px-3 py-2.5 shadow-[var(--shadow-soft)] sm:w-60"
              >
                {AUDIO_OUTPUT_FORMATS.map((f) => (
                  <option key={f} value={f}>{f.toUpperCase()}</option>
                ))}
              </select>
            </div>
          )}

          {renderTool()}
        </div>
      )}
    </div>
    </div>
  );
}
