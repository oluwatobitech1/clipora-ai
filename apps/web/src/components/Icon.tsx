import {
  AudioLines, AudioWaveform, BookOpen, Captions, Film, FileImage, FileText, Image, Images, Languages, Mic, NotebookText,
  Scissors, Shrink, Sparkles, Subtitles, Video, type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  video: Video, gif: Film, audio: AudioLines, "audio-extract": AudioWaveform, mic: Mic, captions: Captions, subtitles: Subtitles,
  sparkles: Sparkles, image: Image, "image-pdf": FileImage, "pdf-image": Images, file: FileText, book: BookOpen,
  languages: Languages, notes: NotebookText, compress: Shrink, scissors: Scissors,
};

export function Icon({ name, size = 20, className = "", strokeWidth = 1.8 }: { name: string; size?: number; className?: string; strokeWidth?: number }) {
  const C = ICONS[name] ?? FileText;
  return <C size={size} strokeWidth={strokeWidth} className={className} aria-hidden="true" />;
}

/** A rounded tile in a category colour, holding an icon. */
export function IconTile({ name, hue, size = 44, iconSize = 22 }: { name: string; hue: string; size?: number; iconSize?: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-xl"
      style={{ width: size, height: size, color: hue, background: `color-mix(in srgb, ${hue} 12%, white)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${hue} 18%, white)` }}
    >
      <Icon name={name} size={iconSize} />
    </span>
  );
}
