# AI Automation Preview Site

Landing page plus interactive workflow previews. Runs on Cloudflare Workers with static assets. No database.

## Workflows
1. Comment automation (Instagram/Facebook)
2. Lead capture from DMs
3. Inbound enquiry router

## Setup
```bash
npm install
npx wrangler secret put GROQ_API_KEY   # paste your Groq key
npm run dev                            # local preview
npm run deploy                         # deploy to Cloudflare
```

## How the previews work
- Each node runs for a random 5 to 7 seconds with the rotating highlight ring. Change `NODE_DELAY_MIN` and `NODE_DELAY_MAX` in `public/app.js`.
- The AI node calls `/api/run`, which sends one Groq request per sample. The result is cached for 7 days, so each sample is generated once globally.
- Each IP is limited to 20 new generations per hour. Past the limit, or if Groq fails, the page shows built-in placeholder output.
- The model is set in `wrangler.toml` (`GROQ_MODEL`).
- The brand, copy, stats and contact are placeholders.
