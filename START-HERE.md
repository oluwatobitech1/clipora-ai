# Start here (no Supabase, no accounts)

1. Install Node 22+ and FFmpeg (`winget install Gyan.FFmpeg`, then close and reopen VS Code; check `ffmpeg -version`).
2. In the VS Code terminal, in this folder: `npm install`
3. `npm run dev`
4. Open http://localhost:5173 (NOT preview/framevox-preview.html, NOT Live Server on port 5500).
5. Tools > Video to Audio > choose a video > Extract audio > Download.

**Transcribe is free and needs no key.** It runs Whisper on your computer. The first time, it downloads a speech model once (about 80 MB, needs internet); after that it also works offline. It uses the fast "tiny" model by default. For better accuracy at lower speed, add `LOCAL_WHISPER_MODEL=Xenova/whisper-base` to `.env`.
Prefer faster cloud transcription? Put `OPENAI_API_KEY=sk-...` in a `.env` file (copy `.env.example`) and restart: the key is then used automatically.

**Paste a link (optional):** to fetch videos from YouTube, TikTok, Instagram, X, Facebook, Vimeo and similar sites, install the free yt-dlp tool once (`winget install yt-dlp.yt-dlp`, then close and reopen VS Code; check `yt-dlp --version`). Then use the "Paste a link" tab (always visible; it needs `npm run dev`, which starts the local server too). For speech tools it downloads audio only, which is much faster. Only public videos work, and you must have the right to use them. Keep yt-dlp updated (`yt-dlp -U`) because sites change often.

Tip: copy a link, then press Ctrl+V anywhere on the page. If a site asks for a login first (Instagram and YouTube often do), copy `.env.example` to `.env`, add `YTDLP_COOKIES_BROWSER=chrome` (or edge, firefox, brave), restart, and make sure you are signed in to that site in that browser. Framevox then borrows your own session on your own computer; it never leaves it. Close the browser first if it reports the cookie file is locked.

Local mode runs only on your own computer: no sign-in, files live in a temp folder and are deleted after 2 hours or when you click Delete.

Want accounts, cloud storage and a public website later? Use the Supabase version: `npm run dev:cloud` and see README.md.
