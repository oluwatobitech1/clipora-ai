# Make "Paste a link" work on the live website

The website (Vercel) cannot download videos by itself. A small separate server does it, then hands the file to the visitor's browser.

## 1. Put this project on GitHub
Push the whole `framevox` folder (the `.env` file must NOT be pushed).

## 2. Create the link server on Render (free)
1. render.com > New > Blueprint > pick your GitHub repo. It reads `render.yaml`.
2. `CORS_ORIGIN` is already set to `*` (any website). To restrict it, use your exact address(es) with no trailing slash, separated by commas; `https://*.vercel.app` is also allowed. If you set it to just one address, remember Vercel also has other addresses (deployment links), and those will be refused.
3. Deploy. When it is live you get an address like `https://framevox-links.onrender.com`. Open `/api/health` on it: you should see `{"ok":true}`.

## 3. Tell the website where it is
Vercel > your project > Settings > Environment Variables: add `VITE_LINK_API` = `https://framevox-links.onrender.com` (no trailing slash). Then Deployments > Redeploy.

Done: the "Paste a link" tab now works on the live site. Speech tools fetch audio only, so it is quick.

## Good to know
- Free Render servers sleep after ~15 min idle; the first link after a sleep needs ~30-60 s. A paid plan (about $7/month) removes this.
- YouTube and Instagram often block links fetched from cloud servers ("sign in to confirm you're not a bot"). TikTok, X, Facebook, Vimeo, SoundCloud and Reddit usually work. To improve YouTube/Instagram, export a `cookies.txt` from a browser where you are signed in (a throwaway account is safest) and set it as the secret `YTDLP_COOKIES_TXT` on Render, with line breaks written as `\n`.
- Each visitor is limited to 20 links per hour (`LINK_RATE_PER_HOUR`). Only link import is reachable on this server; uploads and transcription still run in the visitor's browser.
- The server updates yt-dlp every time it starts. If a site stops working, use Render > Manual Deploy > Restart.
- Only fetch videos you own or have permission to use.
