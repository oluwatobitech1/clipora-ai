/**
 * The Clipora AI catalog: the categories and every tool inside them.
 * Tools come from tools.ts and run in the browser.
 */
import { TOOLS, findTool, type ToolDef } from "./tools";

export type CategoryId = "video" | "audio" | "image" | "files";

export interface Category {
  id: CategoryId;
  name: string;
  /** One line for cards and menus. */
  blurb: string;
  /** Icon key, see components/Icon.tsx. */
  icon: string;
  /** Category colour, used for icon tiles and timeline tracks. */
  hue: string;
}

export const CATEGORIES: Category[] = [
  { id: "video", name: "Video Tools", blurb: "Convert formats and turn clips into GIFs", icon: "video", hue: "#5b46e8" },
  { id: "audio", name: "Audio Tools", blurb: "Convert audio and pull sound out of video", icon: "audio", hue: "#0891b2" },
  { id: "image", name: "Image Tools", blurb: "Convert pictures and move between images and PDF", icon: "image", hue: "#2563eb" },
  { id: "files", name: "File Conversion", blurb: "PDF, Word and e-book conversion", icon: "file", hue: "#475569" },
];

export const findCategory = (id: string | undefined) => CATEGORIES.find((c) => c.id === id);

const LIVE_CATEGORY: Record<string, CategoryId> = {
  "mp4-converter": "video", "mov-to-mp4": "video", "video-converter": "video", "video-to-gif": "video",
  "mp3-converter": "audio", "audio-converter": "audio", "mp4-to-mp3": "audio", "video-to-mp3": "audio",
  "heic-to-jpg": "image", "image-converter": "image", "jpg-to-pdf": "image", "image-to-pdf": "image", "pdf-to-jpg": "image",
  "pdf-to-word": "files", "epub-to-pdf": "files", "epub-to-mobi": "files", "document-converter": "files",
};

const LIVE_ICON: Record<string, string> = {
  "mp4-converter": "video", "mov-to-mp4": "video", "video-converter": "video", "video-to-gif": "gif",
  "mp3-converter": "audio", "audio-converter": "audio", "mp4-to-mp3": "audio-extract", "video-to-mp3": "audio-extract",
  "heic-to-jpg": "image", "image-converter": "image", "jpg-to-pdf": "image-pdf", "image-to-pdf": "image-pdf", "pdf-to-jpg": "pdf-image",
  "pdf-to-word": "file", "epub-to-pdf": "book", "epub-to-mobi": "book", "document-converter": "file",
};

/** One shape for every card, menu and list. */
export interface CatalogEntry {
  slug: string;
  label: string;
  short: string;
  category: CategoryId;
  icon: string;
  live: boolean;
}

export const LIVE_ENTRIES: CatalogEntry[] = TOOLS.map((t) => ({
  slug: t.slug, label: t.label, short: t.short, category: LIVE_CATEGORY[t.slug] ?? "files", icon: LIVE_ICON[t.slug] ?? "file", live: true,
}));
export const ALL_ENTRIES: CatalogEntry[] = LIVE_ENTRIES;

export const entriesIn = (id: CategoryId) => ALL_ENTRIES.filter((e) => e.category === id);
export const categoryOfSlug = (slug: string) => findCategory(ALL_ENTRIES.find((e) => e.slug === slug)?.category);
export const entryOf = (slug: string) => ALL_ENTRIES.find((e) => e.slug === slug);

/** Tools to suggest next to a tool page: same category first (live ones before upcoming), then the rest. */
export function relatedTo(slug: string, limit = 5): CatalogEntry[] {
  const me = entryOf(slug);
  if (!me) return [];
  const rank = (e: CatalogEntry) => (e.category === me.category ? 0 : 1);
  return ALL_ENTRIES.filter((e) => e.slug !== slug).sort((a, b) => rank(a) - rank(b)).slice(0, limit);
}

export const POPULAR_SLUGS = ["video-to-mp3", "mp4-converter", "heic-to-jpg", "pdf-to-word", "image-to-pdf", "video-to-gif"];
export const popularTools = (): CatalogEntry[] => POPULAR_SLUGS.map(entryOf).filter((e): e is CatalogEntry => !!e);

export const searchEntries = (query: string): CatalogEntry[] => {
  const q = query.trim().toLowerCase();
  if (!q) return ALL_ENTRIES;
  return ALL_ENTRIES.filter((e) => `${e.label} ${e.short} ${findCategory(e.category)?.name ?? ""}`.toLowerCase().includes(q));
};

export type { ToolDef };
export { findTool };
