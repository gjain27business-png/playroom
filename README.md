# OT – party games

40 party games for kitty parties, couples, drinking nights and house parties, as an installable web app.

- **Live site:** https://playroom-4r37.onrender.com (Render static site, never sleeps)
- **Rooms server:** https://playroom-rooms.onrender.com (Render web service running `server.js`)

## How it's built
- `index.html` – the whole app: screens, 40 games and every card. No build step.
- `server.js` – room server (WebSocket). The host's phone sends what friends' phones show; friends send votes and answers back to the host only. Supports per-player secret views (Imposter roles).
- `sw.js`, `manifest.webmanifest`, icons – make it installable and usable offline.

Each section has 10 games: 1 main event, 3 classics, 3 OT originals and 3 chaos games.

## Run locally
```
npm install
node server.js   # http://localhost:3000
```

## Referee chat
Every game has an **Ask ref** button. The section's host answers rules questions, ties, disputes, whose turn it is, coin flips and random picks from a built-in rulebook. It works offline and costs nothing.

Optional AI mode: set `ANTHROPIC_API_KEY` on the `playroom-rooms` Render service and questions the rulebook can't answer go to an AI referee (model set by `OT_MODEL`, default `claude-haiku-5-5`). Limited to 15 questions per minute per person.
