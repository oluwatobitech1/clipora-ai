const paths: Record<string, string> = {
  "video-to-audio": "M9 18V6l10-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm10-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  "video-to-text": "M4 6h16M4 11h16M4 16h10M17 16l3 3m0-3-3 3",
  subtitles: "M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Zm4 8h4m3 0h3M7 10h2m3 0h5",
  "video-summarizer": "M5 4h14M5 9h14M5 14h9M5 19h6M17 14l1.2 2.3 2.3 1.2-2.3 1.2L17 21l-1.2-2.3-2.3-1.2 2.3-1.2L17 14Z",
  translate: "M4 5h9M8.5 3v2M6 5c.5 3 2.5 6 6 8M12 5c-.5 3-2.5 6-6.5 8.5M13 21l4-10 4 10m-6.5-3h5",
  "find-moment": "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 5 5M9 9.5v3l3-1.5-3-1.5Z",
  "highlight-clipper": "M6 4v16M18 4v16M6 8h12M6 16h12M3 4h6M15 4h6M3 20h6M15 20h6",
  "bleep-maker": "M4 10v4h3l5 4V6L7 10H4Zm12-1a4 4 0 0 1 0 6m2.5-8.5a7.5 7.5 0 0 1 0 11",
  "speaking-coach": "M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm-6-3a6 6 0 0 0 12 0M12 17v4M9 21h6",
};

export function ToolIcon({ id, className = "" }: { id: string; className?: string }) {
  return (
    <svg
      width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}
    >
      <path d={paths[id] ?? paths["video-to-audio"]} />
    </svg>
  );
}
