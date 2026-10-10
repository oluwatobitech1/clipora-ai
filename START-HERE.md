# Start here (no Supabase, no accounts)

1. Install Node 22+ and FFmpeg (`winget install Gyan.FFmpeg`, then close and reopen VS Code; check `ffmpeg -version`).
2. In the VS Code terminal, in this folder: `npm install`
3. `npm run dev`
4. Open http://localhost:5173 (NOT preview/framevox-preview.html, NOT Live Server on port 5500).
5. Tools > Video to Audio > choose a video > Extract audio > Download.

**Transcribe is free and needs no key.** It runs Whisper on your computer. The first time, it downloads a speech model once (about 80 MB, needs internet); after that it also works offline. It is slower than paid cloud services, so try a short clip first.
Prefer faster cloud transcription? Put `OPENAI_API_KEY=sk-...` in a `.env` file (copy `.env.example`) and restart: the key is then used automatically.

Local mode runs only on your own computer: no sign-in, files live in a temp folder and are deleted after 2 hours or when you click Delete.

Want accounts, cloud storage and a public website later? Use the Supabase version: `npm run dev:cloud` and see README.md.
