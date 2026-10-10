# Clipora AI

Extract audio from video (MP3, WAV or M4A) with real FFmpeg processing, and transcribe speech to text (TXT, SRT, VTT). Inputs: MP4, MOV, WebM, MKV, MP3, WAV, M4A.

## Easiest way: local mode (no Supabase)
`npm install`, then `npm run dev`, then open http://localhost:5173. Needs only Node 22+ and FFmpeg. No sign-in, no database; files stay on your computer in a temp folder and are removed after 2 hours (`RETENTION_HOURS`). Transcribe is free: with no key it runs Whisper on your computer (one-time ~80 MB model download). Set `OPENAI_API_KEY` in `.env` to use OpenAI instead. The server listens on 127.0.0.1 only, so it is for personal use, not for putting online. For a public site with accounts, use the Supabase version below.

## What you need (Supabase version)

| Thing | Why | Cost |
|---|---|---|
| Node.js 22+ | Runs the project | Free |
| FFmpeg | Extracts the audio | Free |
| A Supabase account | Sign-in, database, private file storage | Free plan (50 MB per file) |
| An OpenAI API key | Only for Transcribe (speech-to-text). Audio extraction works without it | Pay per minute of audio |

No Docker, no Redis, no other accounts.

## Setup (about 15 minutes)

1. **Install FFmpeg**: `winget install Gyan.FFmpeg`, then close and reopen VS Code. Check: `ffmpeg -version`.
2. **Supabase database**: Supabase > your project > SQL Editor > New query. Paste all of `supabase/migrations/0001_m2_core.sql`, click Run ("Success"). Then do the same with `0002_m3_transcription.sql` (adds transcripts, M4A).
3. **Supabase sign-in**: Authentication > Sign In / Providers > Email > turn **Confirm email** off (testing only).
4. **The `.env` file**: copy `.env.example` to `.env` and fill in the 4 values (Project URL twice, publishable key, secret key). Keys: Settings > API Keys. Never share `.env`.
5. **Install**: `npm install`
6. **Run everything with one command**: `npm run dev:cloud` then open http://localhost:5173

You will see three coloured log streams in one terminal: `api`, `worker`, `web`. API says "Server listening", worker says "worker ready".

### Turning on Transcribe
Add `OPENAI_API_KEY=sk-...` to `.env` (never to anything starting with `VITE_`), then restart `npm run dev`. Without a key, Transcribe fails immediately with a clear "not set up on this server" message and nothing is uploaded to any provider.
How it works: the worker cuts the audio into 10-minute mono MP3 pieces, sends each to the provider, adds each piece's start time to its timestamps and joins them. SRT/VTT are built from the provider's real segment timestamps. 

## Check it

```bash
npm run typecheck
npm run lint
npm run test      # shared tests + worker tests that run real FFmpeg and a local mock of the speech API
npm run build
```

## Try it

1. Create an account and sign in.
2. Tools > Video to Audio. Choose a small MP4 with sound (under 50 MB), pick MP3, click **Extract audio**.
3. Status goes Waiting > Extracting > Done. Download and play the file.

Also try: a video with no sound (clear message), a text file renamed `.mp4` (clear message), clicking Extract twice (one job only), and **Delete file and result** (files disappear from Storage).

## How it works

```
Browser --> API (checks sign-in, creates a job row) --> Supabase database
Browser --> Supabase Storage (private upload with a one-time token)
Worker  --> checks the database every 2 seconds for "queued" jobs
        --> downloads the file, checks it with ffprobe, runs FFmpeg, verifies the output
        --> uploads the result, marks the job done or failed
Browser --> polls the API for real status, downloads through a 60-second link
```
Two workers can never take the same job: claiming a job only succeeds while its status is still "queued". A job left "processing" by a crashed worker is put back in the queue automatically.

## Put it online later

| Part | Where |
|---|---|
| Website | Vercel (Root Directory `apps/web`, include files outside root; env `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`) |
| API and worker | Any Docker host (Railway, Render, Fly.io, a VPS) using `Dockerfile.api` and `Dockerfile.worker`; env `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CORS_ORIGIN` |
| Supabase | A separate production project: same SQL, **Confirm email** on, Site URL set to your website |

## Safety

- The secret key lives only in `.env` (API and worker). The website only has the public key.
- Every API query is filtered by the signed-in user. Someone else's job gets the same "not found" as a missing one.
- Files are stored under generated names, in a private bucket. Downloads use 60-second links.
- FFmpeg runs without a shell, reads local files only, has a time limit, and the real file format is checked.
- Files and results are deleted after 24 hours, or when you delete the project.

## Windows tips
- `ffmpeg` not found after install: close ALL VS Code windows and reopen. Check `ffprobe -version` too.
- Port 3001 or 5173 busy: stop other dev servers, or set `API_PORT` in `.env`.
- `Missing required environment variable`: the file must be named `.env` (not `.env.txt`) and sit next to `package.json`.
- Run `npm run dev` (or `dev:cloud`) in ONE terminal; it starts everything together.

## Deployment notes
- Do NOT host the API or worker on Vercel/Netlify functions: FFmpeg jobs run for minutes and need the ffmpeg binary. The included Dockerfiles run on Railway, Render, Fly.io or a VPS. Only `apps/web` goes to Vercel.
- Worker env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`. API env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CORS_ORIGIN`. Never give the web host the secret key.
- Temp files live in the OS temp folder and are removed after every job (success or failure). Originals and results are deleted from private storage after `RETENTION_HOURS`.

## Known limitations

- Cloud (Supabase) version: upload shows status only, and the free plan limits files to 50 MB. Local mode shows upload percentage and has a Cancel button.
- Transcription has been tested end to end in a browser against a mock of the OpenAI API, not the real service.
- No project history page yet. Privacy policy and terms are placeholders.
- The worker polls the database; at large scale a real queue would be added later.
