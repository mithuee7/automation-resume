# AI Automation Preview Site

Landing page plus interactive workflow previews. Runs on Cloudflare Workers with static assets. No database.

## Workflows
1. Instant lead response (Instagram and WhatsApp)
2. Follow-ups with recommended messages
3. Receiving calls (multi-turn, up to 4 turns)
4. Viewing bookings (multi-turn, client agrees or disagrees)
5. Lead qualification
6. Reviews and referrals

All scenarios are for real estate agents.

## Setup
```bash
npm install
npx wrangler secret put GROQ_API_KEY   # paste your Groq key
npm run dev                            # local preview
npm run deploy                         # deploy to Cloudflare
```

## How the previews work
- Each node runs for a random 2 to 4 seconds. Change `NODE_DELAY_MIN` and `NODE_DELAY_MAX` in `public/app.js`.
- `/api/vary` rewrites each client message with Groq, so the wording is different every run.
- `/api/run` runs the workflow step with Groq and the conversation so far.
- Calls run up to 4 turns and the booking flow up to 4 rounds. The counter shows the run count.
- Each IP is limited to 150 Groq calls per hour. Past the limit, or if Groq fails, the page shows built-in placeholder output.
- The model is set in `wrangler.toml` (`GROQ_MODEL`).
