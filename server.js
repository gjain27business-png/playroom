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

const server = http.createServer((req, res) => {
  const url = (req.url || "/").split("?")[0];
  if (url === "/healthz") {
    res.writeHead(200, { "content-type": "text/plain" });
    return res.end("ok");
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

const wss = new WebSocketServer({ server, maxPayload: 20 * 1024 });
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
  const out = { kind: "idle", cat: CATS.includes(v.cat) ? v.cat : "kitty", adult: !!v.adult };
  if (v.kind === "card") {
    out.kind = "card";
    out.tag = s(v.tag, 80);
    out.text = s(v.text, 400);
    out.foot = s(v.foot, 200);
  } else if (v.kind === "number") {
    out.kind = "number";
    out.n = Number.isInteger(v.n) && v.n >= 1 && v.n <= 90 ? v.n : null;
    out.nick = s(v.nick, 60);
    out.count = s(v.count, 40);
    out.called = Array.isArray(v.called)
      ? v.called.filter((x) => Number.isInteger(x) && x >= 1 && x <= 90).slice(0, 90)
      : [];
  } else {
    out.text = s(v.text, 200);
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
      room = { code, host: me, members: [me], view: null };
      rooms.set(code, room);
      send(ws, { t: "joined", code, host: true, players: names(room), view: null });
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
      send(ws, { t: "joined", code: room.code, host: false, players: names(room), view: room.view });
      broadcast(room, { t: "players", players: names(room) }, ws);
    } else if (m.t === "show" && room && me && room.host === me) {
      room.view = cleanView(m.view);
      broadcast(room, { t: "show", view: room.view }, ws);
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
  console.log("Playroom listening on " + PORT);
});
