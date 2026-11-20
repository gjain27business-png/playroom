# Duo 💞 — a little world for two

A couples web app: daily question + streak, This or That, Truth or Dare, mood check-in,
"thinking of you" taps, love notes time capsule, compatibility quizzes (shareable cards),
shared bucket list and AI date ideas. 7-day free trial, then read-only until they pay.

## Run on your Mac
```bash
cd duo
npm install
npm start          # open http://localhost:3000
```
Test as a couple: open one normal window and one incognito window, sign up twice, pair with the code.

## Deploy on Render (same as OT)
1. Push this folder to a new GitHub repo.
2. Render → **New → Blueprint** → pick the repo. `render.yaml` creates the web service **and** a Postgres database (free plans; upgrade before real users).
3. In the service's **Environment** tab set:
   - `ADMIN_KEY` — any secret (used to activate paid couples manually)
   - `ANTHROPIC_API_KEY` — optional, turns on AI date ideas (without it Duo uses handpicked ideas)
4. Open the URL. On a phone: Share → **Add to Home Screen** and it behaves like an app.

> Use a **paid** Render Postgres for real users — free Render databases expire.

## Settings (environment variables)
| Variable | What it does |
|---|---|
| `DATABASE_URL` | Postgres connection (set automatically by the blueprint). Without it, data goes to `data/db.json` |
| `PGSSL` | Set `true` only if you use an *external* Postgres URL |
| `TRIAL_DAYS` | Free trial length (default 7) |
| `ADMIN_KEY` | Secret for the activation endpoint below |
| `ANTHROPIC_API_KEY` | Enables AI date ideas (max 8 requests per couple per day) |
| `AI_MODEL` | Model for date ideas (default `claude-haiku-5-5`) |

## Until payments are connected: activate a couple by hand
When someone pays you on UPI, activate their Duo (use the code shown in their **Us** tab):
```bash
curl -X POST https://YOUR-APP.onrender.com/api/admin/activate \
  -H "content-type: application/json" \
  -d '{"key":"YOUR_ADMIN_KEY","code":"K7M2QX","days":365}'
```
To plug in Razorpay later, replace `startCheckout()` at the bottom of `public/app.js`
and call the same activation logic from a Razorpay webhook.

## How the paywall works
- Trial starts when the partner joins (not at sign-up).
- After trial/subscription ends: everything stays **readable** (answers, notes, results, bucket list),
  but every write returns 402 and the app shows the renew sheet. The streak freezes.

## Edit content without touching code
All questions, games, quizzes, moods and date ideas live in `content.js`.
Add more daily questions there — the app cycles through them.

## Files
- `server.js` — API (auth, pairing, trial, all features)
- `store.js` — storage (in-memory + Postgres or JSON file). Built for a single server instance.
- `content.js` — all text content
- `public/` — the app (no build step): `index.html`, `styles.css`, `app.js`, service worker, icon

## Known limits of v1
- "Thinking of you" alerts show while the app is open (polled every 15s) + a browser notification
  if the tab is in the background. True push when the app is closed needs Web Push — next version.
- No password reset yet.
- Runs as one server instance (fine for thousands of couples).
