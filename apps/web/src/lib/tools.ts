/** Every converter on the site. Each one runs entirely in the visitor's browser. */

export type ToolEngine = "video-audio" | "video" | "gif" | "audio" | "image" | "images-to-pdf" | "pdf-to-jpg" | "document";
export type ToolGroup = "Video Converter" | "Audio Converter" | "Image Converter" | "Document & Ebook";

export interface ToolOutput {
  id: string;
  label: string;
  hint: string;
}

export interface ToolOption {
  id: string;
  label: string;
  choices: { value: string; label: string }[];
  default: string;
  /** Only show this option for these output formats. */
  showFor?: string[];
}

export interface ToolDef {
  slug: string;
  label: string;
  /** A few words for the tool cards on the home page. */
  short: string;
  group: ToolGroup;
  engine: ToolEngine;
  /** Page title (browser tab and Google). */
  pageTitle: string;
  description: string;
  /** The big heading is `heading` followed by the highlighted `accent`. */
  heading: string;
  accent: string;
  lead: string;
  chooseLabel: string;
  exts: string[];
  multiple: boolean;
  outputs: ToolOutput[];
  options: ToolOption[];
  /** Honest limits, shown under the converter. */
  note?: string;
  faq: { q: string; a: string }[];
}

const VIDEO_EXTS = ["mp4", "m4v", "mov", "qt", "webm", "mkv", "avi", "wmv", "flv", "3gp", "3g2", "mpg", "mpeg", "ogv", "mts", "m2ts"];
const AUDIO_EXTS = ["mp3", "wav", "m4a", "aac", "ogg", "oga", "opus", "flac", "wma", "aiff", "aif", "amr"];
const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "gif", "bmp", "avif", "heic", "heif"];

const HEIGHT: ToolOption = {
  id: "height",
  label: "Video size",
  default: "original",
  choices: [
    { value: "original", label: "Original size" },
    { value: "1080", label: "Up to 1080p" },
    { value: "720", label: "Up to 720p (smaller file)" },
    { value: "480", label: "Up to 480p (much smaller)" },
    { value: "360", label: "Up to 360p (tiny)" },
  ],
};

const BITRATE: ToolOption = {
  id: "bitrate",
  label: "Audio quality",
  default: "auto",
  choices: [
    { value: "auto", label: "Auto (recommended)" },
    { value: "128", label: "128 kbps" },
    { value: "192", label: "192 kbps" },
    { value: "256", label: "256 kbps" },
    { value: "320", label: "320 kbps (highest)" },
  ],
  showFor: ["mp3", "m4a", "ogg"],
};

const IMAGE_QUALITY: ToolOption = {
  id: "quality",
  label: "Picture quality",
  default: "90",
  choices: [
    { value: "60", label: "60% (smallest file)" },
    { value: "75", label: "75%" },
    { value: "90", label: "90% (recommended)" },
    { value: "100", label: "100% (best)" },
  ],
  showFor: ["jpg", "webp"],
};

const IMAGE_SIZE: ToolOption = {
  id: "maxSide",
  label: "Picture size",
  default: "0",
  choices: [
    { value: "0", label: "Original size" },
    { value: "3840", label: "Up to 3840 px" },
    { value: "1920", label: "Up to 1920 px" },
    { value: "1280", label: "Up to 1280 px" },
    { value: "640", label: "Up to 640 px" },
  ],
};

const PDF_PAGE: ToolOption[] = [
  {
    id: "pageSize",
    label: "Page size",
    default: "a4",
    choices: [
      { value: "a4", label: "A4" },
      { value: "letter", label: "US Letter" },
      { value: "fit", label: "Same size as the picture" },
    ],
  },
  {
    id: "margin",
    label: "Margin",
    default: "18",
    choices: [
      { value: "0", label: "None" },
      { value: "18", label: "Small" },
      { value: "36", label: "Big" },
    ],
  },
];

const PRIVATE = { q: "Are my files uploaded anywhere?", a: "No. The conversion runs inside your browser, on your own phone or computer. Your files never leave your device." };
const FREE = { q: "Is it really free?", a: "Yes. There is no sign-up, no watermark and no limit on the number of files." };

const mp4Faq = [
  { q: "Will it take long?", a: "If your video is already in the common H.264 format, it is moved into an MP4 in seconds without losing quality. Other formats are re-encoded, which takes longer on phones and for long videos." },
  PRIVATE,
];

export const TOOLS: ToolDef[] = [
  /* ---------- Video ---------- */
  {
    slug: "mp4-converter", short: "Any video to MP4", label: "MP4 Converter", group: "Video Converter", engine: "video",
    pageTitle: "MP4 Converter: convert any video to MP4 online, free",
    description: "Convert MOV, AVI, MKV, WebM and more to MP4 for free. No sign-up, and your video never leaves your device.",
    heading: "Convert any video to ", accent: "MP4",
    lead: "Make your video play everywhere. Free, no sign-up, and it never leaves your device.",
    chooseLabel: "Choose a video", exts: VIDEO_EXTS, multiple: false,
    outputs: [{ id: "mp4", label: "MP4", hint: "Plays everywhere" }], options: [HEIGHT], faq: mp4Faq,
  },
  {
    slug: "mov-to-mp4", short: "iPhone and Mac videos to MP4", label: "MOV to MP4", group: "Video Converter", engine: "video",
    pageTitle: "MOV to MP4 Converter: free and private",
    description: "Turn iPhone and Mac MOV videos into MP4 files that play on any device. Free, and nothing is uploaded.",
    heading: "Convert MOV to ", accent: "MP4",
    lead: "Turn iPhone and Mac videos into MP4 files that play on any device.",
    chooseLabel: "Choose a MOV video", exts: ["mov", "qt"], multiple: false,
    outputs: [{ id: "mp4", label: "MP4", hint: "Plays everywhere" }], options: [HEIGHT], faq: mp4Faq,
  },
  {
    slug: "video-converter", short: "MP4, WebM, MKV, MOV, AVI", label: "Video Converter", group: "Video Converter", engine: "video",
    pageTitle: "Video Converter: MP4, WebM, MKV, MOV, AVI online, free",
    description: "Convert videos between MP4, WebM, MKV, MOV and AVI for free. Private, with no upload.",
    heading: "Convert videos to ", accent: "any format",
    lead: "Pick MP4, WebM, MKV, MOV or AVI. Free, and your video stays on your device.",
    chooseLabel: "Choose a video", exts: VIDEO_EXTS, multiple: false,
    outputs: [
      { id: "mp4", label: "MP4", hint: "Plays everywhere" },
      { id: "webm", label: "WebM", hint: "For websites" },
      { id: "mkv", label: "MKV", hint: "Flexible" },
      { id: "mov", label: "MOV", hint: "Apple" },
      { id: "avi", label: "AVI", hint: "Older players" },
    ],
    options: [HEIGHT],
    note: "WebM is the slowest to make on a phone. Use a shorter clip or a smaller video size if it takes too long.",
    faq: [{ q: "Which format should I choose?", a: "MP4 plays on almost everything. WebM suits websites. MKV and MOV keep video flexible for editing. AVI is for older players." }, PRIVATE],
  },
  {
    slug: "video-to-gif", short: "Turn a clip into a GIF", label: "Video to GIF", group: "Video Converter", engine: "gif",
    pageTitle: "Video to GIF Converter: make a GIF from a video, free",
    description: "Turn any video clip into an animated GIF. Free, with no watermark, and nothing is uploaded.",
    heading: "Turn a video into a ", accent: "GIF",
    lead: "Make a looping GIF from any video clip. No watermark, no upload.",
    chooseLabel: "Choose a video", exts: VIDEO_EXTS, multiple: false,
    outputs: [{ id: "gif", label: "GIF", hint: "Loops forever" }],
    options: [
      { id: "seconds", label: "Length", default: "10", choices: [{ value: "5", label: "First 5 seconds" }, { value: "10", label: "First 10 seconds" }, { value: "15", label: "First 15 seconds" }, { value: "30", label: "First 30 seconds" }, { value: "all", label: "Whole video" }] },
      { id: "fps", label: "Smoothness", default: "10", choices: [{ value: "5", label: "5 frames per second" }, { value: "10", label: "10 frames per second" }, { value: "15", label: "15 frames per second" }, { value: "20", label: "20 frames per second" }] },
      { id: "width", label: "Width", default: "480", choices: [{ value: "320", label: "320 px (small)" }, { value: "480", label: "480 px" }, { value: "640", label: "640 px" }, { value: "800", label: "800 px (large)" }] },
    ],
    note: "GIF files get big quickly. Keep clips short and small if you plan to share the GIF.",
    faq: [{ q: "Why is my GIF so big?", a: "GIFs store every frame as a picture. Choose a shorter length, fewer frames per second or a smaller width to shrink it." }, PRIVATE],
  },

  /* ---------- Audio ---------- */
  {
    slug: "mp3-converter", short: "Any audio or video to MP3", label: "MP3 Converter", group: "Audio Converter", engine: "audio",
    pageTitle: "MP3 Converter: convert audio and video to MP3, free",
    description: "Convert WAV, M4A, OGG, FLAC and video files to MP3 for free. Private, with no upload.",
    heading: "Convert anything to ", accent: "MP3",
    lead: "Audio or video in, MP3 out. Free, and your file never leaves your device.",
    chooseLabel: "Choose an audio or video file", exts: [...AUDIO_EXTS, ...VIDEO_EXTS], multiple: true,
    outputs: [{ id: "mp3", label: "MP3", hint: "Plays everywhere" }], options: [BITRATE],
    faq: [{ q: "Can I convert many files at once?", a: "Yes. Choose several files and download them one by one or all together in a ZIP." }, PRIVATE],
  },
  {
    slug: "audio-converter", short: "MP3, WAV, M4A, OGG, FLAC", label: "Audio Converter", group: "Audio Converter", engine: "audio",
    pageTitle: "Audio Converter: MP3, WAV, M4A, OGG, FLAC online, free",
    description: "Convert audio between MP3, WAV, M4A, OGG and FLAC for free. Private, with no upload.",
    heading: "Convert audio to ", accent: "any format",
    lead: "Switch between MP3, WAV, M4A, OGG and FLAC. Free and private.",
    chooseLabel: "Choose an audio or video file", exts: [...AUDIO_EXTS, ...VIDEO_EXTS], multiple: true,
    outputs: [
      { id: "mp3", label: "MP3", hint: "Plays everywhere" },
      { id: "m4a", label: "M4A", hint: "Great on iPhone" },
      { id: "wav", label: "WAV", hint: "Lossless, big" },
      { id: "ogg", label: "OGG", hint: "Open format" },
      { id: "flac", label: "FLAC", hint: "Lossless, smaller" },
    ],
    options: [BITRATE],
    faq: [{ q: "Which format should I choose?", a: "MP3 plays on almost everything. M4A is great on iPhone and Mac. WAV and FLAC keep full quality, with FLAC making a smaller file." }, PRIVATE],
  },
  {
    slug: "mp4-to-mp3", short: "Pull the audio out of a video", label: "MP4 to MP3", group: "Audio Converter", engine: "video-audio",
    pageTitle: "MP4 to MP3 Converter: extract audio from a video, free",
    description: "Convert MP4 video to MP3 audio for free. Private, fast, and nothing is uploaded.",
    heading: "Convert MP4 to ", accent: "MP3",
    lead: "Pull the sound out of any MP4 video. Free, no sign-up, and nothing is uploaded.",
    chooseLabel: "Choose a video", exts: VIDEO_EXTS, multiple: false, outputs: [], options: [], faq: [],
  },
  {
    slug: "video-to-mp3", short: "Any video to MP3, WAV or M4A", label: "Video to MP3", group: "Audio Converter", engine: "video-audio",
    pageTitle: "Video to MP3 Converter: free and private",
    description: "Convert any video to MP3, WAV or M4A for free. Private, fast, and nothing is uploaded.",
    heading: "Convert video to ", accent: "MP3",
    lead: "Turn any video into clean audio. Free, no sign-up, and nothing is uploaded.",
    chooseLabel: "Choose a video", exts: VIDEO_EXTS, multiple: false, outputs: [], options: [], faq: [],
  },

  /* ---------- Images ---------- */
  {
    slug: "jpg-to-pdf", short: "Pictures into one PDF", label: "JPG to PDF", group: "Image Converter", engine: "images-to-pdf",
    pageTitle: "JPG to PDF Converter: combine pictures into a PDF, free",
    description: "Turn one or many JPG pictures into a single PDF. Free, private, and nothing is uploaded.",
    heading: "Convert JPG to ", accent: "PDF",
    lead: "Put one or many pictures into a single PDF. Free, and nothing is uploaded.",
    chooseLabel: "Choose JPG pictures", exts: ["jpg", "jpeg"], multiple: true,
    outputs: [{ id: "pdf", label: "PDF", hint: "One page per picture" }], options: PDF_PAGE,
    faq: [{ q: "Can I put many pictures in one PDF?", a: "Yes. Choose several pictures. Each becomes one page, in the order you choose them." }, PRIVATE],
  },
  {
    slug: "image-to-pdf", short: "JPG, PNG, WebP, HEIC to PDF", label: "Image to PDF", group: "Image Converter", engine: "images-to-pdf",
    pageTitle: "Image to PDF Converter: JPG, PNG, WebP, HEIC to PDF",
    description: "Turn JPG, PNG, WebP, HEIC and other pictures into a PDF. Free, private, and nothing is uploaded.",
    heading: "Convert images to ", accent: "PDF",
    lead: "JPG, PNG, WebP, HEIC and more, all into one PDF. Free and private.",
    chooseLabel: "Choose pictures", exts: IMAGE_EXTS, multiple: true,
    outputs: [{ id: "pdf", label: "PDF", hint: "One page per picture" }], options: PDF_PAGE,
    faq: [{ q: "Which pictures can I use?", a: "JPG, PNG, WebP, GIF, BMP, AVIF and iPhone HEIC pictures. Animated GIFs use their first frame." }, PRIVATE],
  },
  {
    slug: "pdf-to-jpg", short: "Every PDF page as a picture", label: "PDF to JPG", group: "Image Converter", engine: "pdf-to-jpg",
    pageTitle: "PDF to JPG Converter: turn PDF pages into pictures, free",
    description: "Convert every page of a PDF into a JPG picture. Free, private, and nothing is uploaded.",
    heading: "Convert PDF to ", accent: "JPG",
    lead: "Every page of your PDF becomes a picture. Free, and nothing is uploaded.",
    chooseLabel: "Choose a PDF", exts: ["pdf"], multiple: false,
    outputs: [{ id: "jpg", label: "JPG", hint: "One picture per page" }],
    options: [
      { id: "dpi", label: "Sharpness", default: "150", choices: [{ value: "72", label: "Screen (72 dpi)" }, { value: "150", label: "Good (150 dpi)" }, { value: "220", label: "Sharp (220 dpi)" }] },
      { ...IMAGE_QUALITY, showFor: undefined },
    ],
    faq: [{ q: "I have many pages. How do I get them all?", a: "Each page is made as its own picture. Download them one by one, or all together in a ZIP." }, PRIVATE],
  },
  {
    slug: "heic-to-jpg", short: "iPhone photos to JPG", label: "HEIC to JPG", group: "Image Converter", engine: "image",
    pageTitle: "HEIC to JPG Converter: iPhone photos to JPG, free",
    description: "Convert iPhone HEIC photos to JPG that open anywhere. Free, private, and nothing is uploaded.",
    heading: "Convert HEIC to ", accent: "JPG",
    lead: "Make iPhone photos open on any phone, computer or website. Free and private.",
    chooseLabel: "Choose HEIC photos", exts: ["heic", "heif"], multiple: true,
    outputs: [{ id: "jpg", label: "JPG", hint: "Opens anywhere" }], options: [IMAGE_QUALITY, IMAGE_SIZE],
    faq: [{ q: "Can I convert many photos at once?", a: "Yes. Choose several photos and download them one by one or all together in a ZIP." }, PRIVATE],
  },
  {
    slug: "image-converter", short: "JPG, PNG, WebP, resize", label: "Image Converter", group: "Image Converter", engine: "image",
    pageTitle: "Image Converter: JPG, PNG, WebP online, free",
    description: "Convert pictures between JPG, PNG and WebP, or shrink them. Free, private, and nothing is uploaded.",
    heading: "Convert images to ", accent: "any format",
    lead: "Switch between JPG, PNG and WebP, or make pictures smaller. Free and private.",
    chooseLabel: "Choose pictures", exts: IMAGE_EXTS, multiple: true,
    outputs: [
      { id: "jpg", label: "JPG", hint: "Small photos" },
      { id: "png", label: "PNG", hint: "Sharp, transparent" },
      { id: "webp", label: "WebP", hint: "Smallest" },
    ],
    options: [IMAGE_QUALITY, IMAGE_SIZE],
    faq: [{ q: "Which format should I choose?", a: "JPG is best for photos. PNG keeps sharp edges and transparency. WebP gives the smallest files and works on all modern browsers." }, PRIVATE],
  },

  /* ---------- Documents ---------- */
  {
    slug: "pdf-to-word", short: "PDF text into Word", label: "PDF to WORD", group: "Document & Ebook", engine: "document",
    pageTitle: "PDF to Word Converter: PDF to DOCX online, free",
    description: "Turn a PDF into an editable Word document. Free, private, and nothing is uploaded.",
    heading: "Convert PDF to ", accent: "Word",
    lead: "Get an editable Word document from your PDF. Free, and nothing is uploaded.",
    chooseLabel: "Choose a PDF", exts: ["pdf"], multiple: false,
    outputs: [{ id: "docx", label: "Word (.docx)", hint: "Editable" }], options: [],
    note: "This copies the text, headings and lists into Word. Pictures, tables and the exact page layout are not kept, and scanned PDFs (photos of pages) have no text to copy.",
    faq: [{ q: "Why does my Word file look different?", a: "It keeps the words, headings and lists, but not the exact layout, pictures or tables. That makes it easy to edit." }, PRIVATE],
  },
  {
    slug: "epub-to-pdf", short: "E-book to PDF", label: "EPUB to PDF", group: "Document & Ebook", engine: "document",
    pageTitle: "EPUB to PDF Converter: free and private",
    description: "Convert an EPUB e-book into a PDF you can print or share. Free, and nothing is uploaded.",
    heading: "Convert EPUB to ", accent: "PDF",
    lead: "Turn an e-book into a PDF you can print or share. Free and private.",
    chooseLabel: "Choose an EPUB e-book", exts: ["epub"], multiple: false,
    outputs: [{ id: "pdf", label: "PDF", hint: "Print or share" }], options: [],
    note: "The PDF has the book's text, headings and lists. Pictures and special fonts are not included, and it supports Latin letters only (English, French, Spanish and similar). Books with copy protection (DRM) cannot be converted.",
    faq: [{ q: "Are the pictures in my book kept?", a: "No. The PDF has the text, headings and lists. Pictures and special fonts are left out." }, PRIVATE],
  },
  {
    slug: "epub-to-mobi", short: "E-book for older Kindles", label: "EPUB to MOBI", group: "Document & Ebook", engine: "document",
    pageTitle: "EPUB to MOBI Converter: free and private",
    description: "Convert an EPUB e-book to MOBI for older Kindles and e-readers. Free, and nothing is uploaded.",
    heading: "Convert EPUB to ", accent: "MOBI",
    lead: "Make an e-book that opens on older Kindles and other readers. Free and private.",
    chooseLabel: "Choose an EPUB e-book", exts: ["epub"], multiple: false,
    outputs: [{ id: "mobi", label: "MOBI", hint: "Older Kindles" }], options: [],
    note: "The MOBI keeps the book's text, headings and lists. Pictures and cover art are not included. Books with copy protection (DRM) cannot be converted.",
    faq: [{ q: "Will it work on my Kindle?", a: "MOBI works on older Kindles and many reading apps. Newer Kindles prefer EPUB, which they accept through Amazon's Send to Kindle." }, PRIVATE],
  },
  {
    slug: "document-converter", short: "PDF, Word, EPUB, text", label: "Document Converter", group: "Document & Ebook", engine: "document",
    pageTitle: "Document Converter: PDF, Word, EPUB, text to PDF, DOCX, MOBI",
    description: "Convert PDF, Word, EPUB, text, Markdown and HTML files between PDF, Word, text and MOBI. Free and private.",
    heading: "Convert documents to ", accent: "any format",
    lead: "PDF, Word, EPUB, text, Markdown and web pages. Free, and nothing is uploaded.",
    chooseLabel: "Choose a document", exts: ["pdf", "epub", "docx", "txt", "md", "markdown", "html", "htm"], multiple: false,
    outputs: [
      { id: "pdf", label: "PDF", hint: "Print or share" },
      { id: "docx", label: "Word", hint: "Editable" },
      { id: "txt", label: "Text", hint: "Plain words" },
      { id: "mobi", label: "MOBI", hint: "Older Kindles" },
    ],
    options: [],
    note: "Conversion keeps the text, headings and lists. Pictures, tables and the exact page layout are not kept. Old .doc files are not supported (save them as .docx first).",
    faq: [{ q: "Which files can I start from?", a: "PDF, Word (.docx), EPUB, plain text, Markdown and HTML pages." }, FREE, PRIVATE],
  },
];

export const TOOL_GROUPS: ToolGroup[] = ["Video Converter", "Audio Converter", "Image Converter", "Document & Ebook"];
export const toolsInGroup = (group: ToolGroup) => TOOLS.filter((t) => t.group === group);
export const findTool = (slug: string | undefined) => TOOLS.find((t) => t.slug === slug);
