# Clipora AI

An all-in-one media tools platform. The tools that are live today are free converters that all run in the visitor's browser: no server, no sign-up, nothing is uploaded.

The site name lives in one place: `apps/web/src/lib/brand.ts` (also change the title in `apps/web/index.html`).

## Categories
The site has four categories (Video Tools, Audio Tools, Image Tools, File Conversion), defined in `apps/web/src/lib/catalog.ts`. Every tool is live and listed in tools.ts; add a new tool there and give it a category in catalog.ts.

Pages: `/`, `/tools`, `/category/:id` and one page per tool. `components/Directory.tsx` is the directory and `ToolShell.tsx` the workspace around every tool.

## The tools (each has its own page, linked in the footer)
- Video: MP4 Converter, MOV to MP4, Video Converter (MP4, WebM, MKV, MOV, AVI), Video to GIF
- Audio: MP3 Converter, Audio Converter (MP3, WAV, M4A, OGG, FLAC), MP4 to MP3, Video to MP3
- Image: JPG to PDF, Image to PDF, PDF to JPG, HEIC to JPG, Image Converter (JPG, PNG, WebP)
- Document: PDF to Word, EPUB to PDF, EPUB to MOBI, Document Converter (PDF, Word, EPUB, text, Markdown, HTML)

Add or change a tool in `apps/web/src/lib/tools.ts`. The conversion code is in `apps/web/src/lib/engines.ts`.

## Run it on your computer
1. Install Node.js 22 or newer.
2. In this folder run: `npm install`
3. Then run: `npm run dev`
4. Open http://localhost:5173

## Put it online (Vercel)
- Import the repository in Vercel and set **Root Directory** to `apps/web`.
- Build command: `npm run build` (the default). Output directory: `dist`.
- No environment variables are needed.

## Where things are
- `apps/web/src/App.tsx`: the pages (routes). `Home.tsx` is the front page with every tool, `VideoAudioPage.tsx` is the video-to-MP3 page, `components/ToolPage.tsx` is every other tool.
- `apps/web/src/components/Layout.tsx`: header and the footer with all the tool links.
- `apps/web/src/components/Converter.tsx`: the video-to-audio converter. `ToolConverter.tsx` is the one used by the other tools.
- `apps/web/src/components/Logo.tsx` and `apps/web/public/favicon.svg`: the logo.
- `apps/web/index.html`: page title and description for Google and link previews.

The folders `apps/api`, `apps/worker`, `apps/local` and `supabase` are not used by this website and can be ignored.
