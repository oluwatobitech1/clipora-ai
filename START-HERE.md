# Video to Audio

A one-page website that converts a video to MP3, WAV or M4A. Everything happens in the visitor's browser: no server, no sign-up, nothing is uploaded.

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
- `apps/web/src/App.tsx`: the page (headline, features, how it works, questions).
- `apps/web/src/components/Converter.tsx`: the converter itself.
- `apps/web/src/components/Logo.tsx` and `apps/web/public/favicon.svg`: the logo.
- `apps/web/index.html`: page title and description for Google and link previews.

The folders `apps/api`, `apps/worker`, `apps/local` and `supabase` are not used by this website and can be ignored.
