import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AUDIO_OUTPUT_FORMATS, TOOLS, type AudioOutputFormat } from "@clipora/shared";
import { AudioExtractor } from "../components/AudioExtractor";
import { Transcriber } from "../components/Transcriber";
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

  const isWorkspace = tool.id === "video-to-audio" || tool.id === "video-to-text";

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <AvailabilityBadge availability={tool.availability} />
      <h1 className="mt-3 text-4xl font-bold tracking-tight">{tool.name}</h1>
      <p className="mt-3 max-w-prose text-muted">{tool.summary}</p>

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
                className="w-full rounded-xl border border-line bg-white px-3 py-2.5 sm:w-60"
              >
                {AUDIO_OUTPUT_FORMATS.map((f) => (
                  <option key={f} value={f}>{f.toUpperCase()}</option>
                ))}
              </select>
            </div>
          )}

          {tool.id === "video-to-audio" ? (
            <AudioExtractor file={file} format={format} />
          ) : (
            <Transcriber file={file} />
          )}
        </div>
      )}
    </div>
  );
}
