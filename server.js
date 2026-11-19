"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 3000;
const INDEX = path.join(__dirname, "index.html");
const MAX_ROOMS = 500;
const MAX_PLAYERS = 12;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const CATS = ["kitty", "couple", "drinks", "house"];
const DAY = "public, max-age=86400";
// Files the site serves from /public: [file name, content type, cache rule].
const STATIC = {
  "/og.png": ["og.png", "image/png", DAY],
  "/icon-192.png": ["icon-192.png", "image/png", DAY],
  "/icon-512.png": ["icon-512.png", "image/png", DAY],
  "/icon-maskable.png": ["icon-maskable.png", "image/png", DAY],
  "/apple-touch-icon.png": ["apple-touch-icon.png", "image/png", DAY],
  "/manifest.webmanifest": ["manifest.webmanifest", "application/manifest+json", "no-cache"],
  "/sw.js": ["sw.js", "text/javascript; charset=utf-8", "no-cache"]
};

const server = http.createServer((req, res) => {
  const url = (req.url || "/").split("?")[0];
  if (url === "/healthz") {
    res.writeHead(200, { "content-type": "text/plain", "access-control-allow-origin": "*" });
    return res.end("ok");
  }
  const file = STATIC[url];
  if (file) {
    return fs.readFile(path.join(__dirname, file[0]), (err, buf) => {
      if (err) {
        res.writeHead(404, { "content-type": "text/plain" });
        return res.end("Not found");
      }
      res.writeHead(200, { "content-type": file[1], "cache-control": file[2] });
      res.end(buf);
    });
  }
  if (url === "/robots.txt") {
    res.writeHead(200, { "content-type": "text/plain" });
    return res.end("User-agent: *\nAllow: /\n");
  }
  if (url === "/" || url === "/index.html") {
    return fs.readFile(INDEX, (err, buf) => {
      if (err) {
        res.writeHead(500, { "content-type": "text/plain" });
        return res.end("Server error");
      }
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" });
      res.end(buf);
    });
  }
  res.writeHead(404, { "content-type": "text/plain" });
  res.end("Not found");
});

// Only pages from these sites may open a room connection.
const ALLOWED = new Set(
  ["https://playroom-4r37.onrender.com", "https://playroom-rooms.onrender.com"]
    .concat(String(process.env.ALLOWED_ORIGINS || "").split(","))
    .map((s) => s.trim())
    .filter(Boolean)
);
function originOk(origin) {
  if (!origin) return true;
  if (ALLOWED.has(origin)) return true;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}
const wss = new WebSocketServer({
  server,
  maxPayload: 20 * 1024,
  verifyClient: (info) => originOk(info.origin)
});
const rooms = new Map();

function newCode() {
  for (let i = 0; i < 50; i++) {
    let c = "";
    for (let k = 0; k < 4; k++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    if (!rooms.has(c)) return c;
  }
  return null;
}
function send(ws, o) {
  if (ws.readyState === 1) ws.send(JSON.stringify(o));
}
function names(room) {
  return room.members.map((m) => m.name);
}
function broadcast(room, o, except) {
  for (const m of room.members) if (m.ws !== except) send(m.ws, o);
}
function cleanName(s) {
  return String(s || "").replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 16);
}
function uniqueName(room, name) {
  let n = name;
  let i = 2;
  const taken = () => room.members.some((m) => m.name.toLowerCase() === n.toLowerCase());
  while (taken()) {
    n = name.slice(0, 13) + " " + i;
    i++;
  }
  return n;
}
function cleanView(v) {
  if (!v || typeof v !== "object") return null;
  const s = (x, n) => (typeof x === "string" ? x.replace(/[\u0000-\u001f]/g, " ").slice(0, n) : "");
  const out = { kind: "idle", cat: CATS.includes(v.cat) ? v.cat : "kitty", adult: !!v.adult, tag: s(v.tag, 80), text: s(v.text, 400), foot: s(v.foot, 200) };
  if (v.kind === "card") {
    out.kind = "card";
  } else if (v.kind === "number") {
    out.kind = "number";
    out.n = Number.isInteger(v.n) && v.n >= 1 && v.n <= 90 ? v.n : null;
    out.nick = s(v.nick, 60);
    out.count = s(v.count, 40);
    out.called = Array.isArray(v.called)
      ? v.called.filter((x) => Number.isInteger(x) && x >= 1 && x <= 90).slice(0, 90)
      : [];
  } else if (v.kind === "vote") {
    // Friends pick one option on their own phone.
    out.kind = "vote";
    out.id = s(v.id, 40);
    out.options = Array.isArray(v.options) ? v.options.slice(0, 12).map((o) => s(o, 40)).filter(Boolean) : [];
    out.noSelf = !!v.noSelf;
  } else if (v.kind === "write") {
    // Friends type a short answer on their own phone.
    out.kind = "write";
    out.id = s(v.id, 40);
  } else if (v.kind === "bars") {
    // Vote results.
    out.kind = "bars";
    out.rows = Array.isArray(v.rows)
      ? v.rows.slice(0, 12).map((r) => ({ label: s(r && r.label, 40), n: Number.isInteger(r && r.n) ? Math.max(0, Math.min(99, r.n)) : 0 }))
      : [];
  }
  if ((out.kind === "vote" || out.kind === "write") && Array.isArray(v.only)) {
    out.only = v.only.slice(0, 12).map((o) => s(o, 16)).filter(Boolean);
  }
  return out;
}

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });
  let room = null;
  let me = null;
  let bucket = 0;
  const reset = setInterval(() => {
    bucket = 0;
  }, 10000);

  ws.on("message", (raw) => {
    if (++bucket > 60) {
      ws.close(1008, "Too many messages");
      return;
    }
    let m;
    try {
      m = JSON.parse(raw);
    } catch (e) {
      return;
    }
    if (!m || typeof m !== "object") return;

    if (m.t === "ping") {
      send(ws, { t: "pong" });
    } else if (m.t === "create" && !room) {
      const name = cleanName(m.name);
      if (!name) return send(ws, { t: "error", msg: "Enter your name first." });
      if (rooms.size >= MAX_ROOMS) return send(ws, { t: "error", msg: "The server is busy. Try again soon." });
      const code = newCode();
      if (!code) return send(ws, { t: "error", msg: "Could not make a room. Try again." });
      me = { ws, name };
      room = { code, host: me, members: [me], view: null, privates: {} };
      rooms.set(code, room);
      send(ws, { t: "joined", code, host: true, you: me.name, players: names(room), view: null });
    } else if (m.t === "join" && !room) {
      const name = cleanName(m.name);
      const code = String(m.code || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
      if (!name) return send(ws, { t: "error", msg: "Enter your name first." });
      const target = rooms.get(code);
      if (!target) return send(ws, { t: "error", msg: "Room not found. Check the code." });
      if (target.members.length >= MAX_PLAYERS) return send(ws, { t: "error", msg: "That room is full." });
      room = target;
      me = { ws, name: uniqueName(room, name) };
      room.members.push(me);
      send(ws, { t: "joined", code: room.code, host: false, you: me.name, players: names(room), view: room.privates[me.name] || room.view });
      broadcast(room, { t: "players", players: names(room) }, ws);
    } else if (m.t === "show" && room && me && room.host === me) {
      room.view = cleanView(m.view);
      // Optional per-player views, for secret words and private roles.
      room.privates = {};
      if (m.privates && typeof m.privates === "object") {
        for (const x of room.members) {
          if (x !== me && m.privates[x.name]) room.privates[x.name] = cleanView(m.privates[x.name]);
        }
      }
      for (const x of room.members) {
        if (x.ws !== ws) send(x.ws, { t: "show", view: room.privates[x.name] || room.view });
      }
    } else if (m.t === "act" && room && me && room.host !== me) {
      // A friend's vote or answer goes to the host only.
      const id = typeof m.id === "string" ? m.id.slice(0, 40) : "";
      const v = typeof m.v === "string" ? m.v.replace(/[\u0000-\u001f]/g, " ").slice(0, 200) : "";
      if (id && v) send(room.host.ws, { t: "act", from: me.name, id, v });
    }
  });

  ws.on("close", () => {
    clearInterval(reset);
    if (!room) return;
    if (room.host === me) {
      broadcast(room, { t: "closed" }, ws);
      for (const x of room.members) if (x.ws !== ws) x.ws.close();
      rooms.delete(room.code);
    } else {
      room.members = room.members.filter((x) => x !== me);
      broadcast(room, { t: "players", players: names(room) });
    }
  });
});

setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

server.listen(PORT, () => {
  console.log("OT listening on " + PORT);
});
