const express = require('express');
const crypto = require('crypto');
const path = require('path');
const bcrypt = require('bcryptjs');
const store = require('./store');
const C = require('./content');

const PORT = process.env.PORT || 3000;
const TRIAL_DAYS = Number(process.env.TRIAL_DAYS || 7);
const PROD = process.env.NODE_ENV === 'production';
const AI_DAILY_LIMIT = 8;

const app = express();
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- helpers ----------
const newId = () => crypto.randomBytes(9).toString('base64url');
const now = () => Date.now();
const DAY = 86400000;
// Day key in India time (YYYY-MM-DD)
const dayKey = (t = now()) => new Date(t + 5.5 * 3600000).toISOString().slice(0, 10);
const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
const clean = (s, max = 500) => String(s || '').trim().slice(0, max);

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function setSession(res, userId) {
  const sid = crypto.randomBytes(24).toString('base64url');
  store.put('sessions', { id: sid, userId, createdAt: now() });
  res.setHeader('Set-Cookie',
    `duo_sid=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 180}${PROD ? '; Secure' : ''}`);
}

function publicUser(u) { return u ? { id: u.id, name: u.name } : null; }

function coupleStatus(c) {
  if (!c || !c.pairedAt) return { state: 'waiting' };
  const t = now();
  if (c.paidUntil && c.paidUntil > t) return { state: 'active', until: c.paidUntil };
  if (c.trialEndsAt > t) return { state: 'trial', daysLeft: Math.ceil((c.trialEndsAt - t) / DAY), until: c.trialEndsAt };
  return { state: 'expired' };
}

// ---------- middleware ----------
function auth(req, res, next) {
  const sid = parseCookies(req).duo_sid;
  const s = sid && store.get('sessions', sid);
  const user = s && store.get('users', s.userId);
  if (!user) return res.status(401).json({ error: 'not_logged_in' });
  req.user = user;
  req.couple = user.coupleId ? store.get('couples', user.coupleId) : null;
  if (req.couple) {
    const pid = req.couple.members.find(m => m !== user.id);
    req.partner = pid ? store.get('users', pid) : null;
  }
  next();
}

function paired(req, res, next) {
  if (!req.couple || !req.couple.pairedAt) return res.status(400).json({ error: 'not_paired' });
  next();
}

// Writes need an active trial or subscription. Reads always work (read-only after expiry).
function active(req, res, next) {
  const st = coupleStatus(req.couple);
  if (st.state === 'trial' || st.state === 'active') return next();
  res.status(402).json({ error: 'subscription_required' });
}

// ---------- auth ----------
app.post('/api/signup', async (req, res) => {
  const name = clean(req.body.name, 40);
  const email = clean(req.body.email, 120).toLowerCase();
  const password = String(req.body.password || '');
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 6)
    return res.status(400).json({ error: 'Enter your name, a valid email and a password of 6+ characters.' });
  if (store.find('users', u => u.email === email)) return res.status(400).json({ error: 'That email already has an account. Log in instead.' });
  const user = store.put('users', { id: newId(), name, email, passHash: await bcrypt.hash(password, 10), coupleId: null, createdAt: now() });
  setSession(res, user.id);
  res.json({ ok: true });
});

app.post('/api/login', async (req, res) => {
  const email = clean(req.body.email, 120).toLowerCase();
  const user = store.find('users', u => u.email === email);
  if (!user || !(await bcrypt.compare(String(req.body.password || ''), user.passHash)))
    return res.status(400).json({ error: 'Wrong email or password.' });
  setSession(res, user.id);
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  const sid = parseCookies(req).duo_sid;
  if (sid) store.del('sessions', sid);
  res.setHeader('Set-Cookie', 'duo_sid=; Path=/; Max-Age=0');
  res.json({ ok: true });
});

// ---------- pairing ----------
function inviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do { code = Array.from({ length: 6 }, () => chars[crypto.randomInt(chars.length)]).join(''); }
  while (store.find('couples', c => c.code === code));
  return code;
}

app.post('/api/couple/create', auth, (req, res) => {
  if (req.couple) return res.json({ code: req.couple.code });
  const c = store.put('couples', { id: newId(), code: inviteCode(), members: [req.user.id], createdAt: now(), pairedAt: null, trialEndsAt: null, paidUntil: null, anniversary: null, city: '' });
  req.user.coupleId = c.id; store.put('users', req.user);
  res.json({ code: c.code });
});

app.post('/api/couple/join', auth, (req, res) => {
  if (req.couple && req.couple.pairedAt) return res.status(400).json({ error: 'You are already paired.' });
  const code = clean(req.body.code, 10).toUpperCase();
  const c = store.find('couples', x => x.code === code);
  if (!c) return res.status(400).json({ error: 'No Duo found with that code.' });
  if (c.members.includes(req.user.id)) return res.status(400).json({ error: "That's your own code — share it with your partner." });
  if (c.members.length >= 2) return res.status(400).json({ error: 'That Duo is already complete.' });
  // If this user had created an empty Duo of their own, remove it.
  if (req.couple && req.couple.members.length === 1) store.del('couples', req.couple.id);
  c.members.push(req.user.id);
  c.pairedAt = now();
  c.pairedDay = dayKey();
  c.trialEndsAt = now() + TRIAL_DAYS * DAY;
  store.put('couples', c);
  req.user.coupleId = c.id; store.put('users', req.user);
  res.json({ ok: true });
});

app.post('/api/couple/settings', auth, paired, (req, res) => {
  const c = req.couple;
  if (req.body.anniversary !== undefined) c.anniversary = /^\d{4}-\d{2}-\d{2}$/.test(req.body.anniversary) ? req.body.anniversary : null;
  if (req.body.city !== undefined) c.city = clean(req.body.city, 60);
  store.put('couples', c);
  res.json({ ok: true });
});

// ---------- daily question ----------
function questionFor(c, day) {
  const n = Math.max(0, dayDiff(c.pairedDay, day));
  return { dayNumber: n + 1, text: C.QUESTIONS[n % C.QUESTIONS.length] };
}

function completeDays(c) {
  const byDay = {};
  for (const a of store.filter('answers', a => a.coupleId === c.id)) (byDay[a.day] = byDay[a.day] || new Set()).add(a.userId);
  return new Set(Object.keys(byDay).filter(d => byDay[d].size >= 2));
}

function streak(c) {
  const done = completeDays(c);
  let t = now();
  if (!done.has(dayKey(t))) t -= DAY; // today not finished yet doesn't break the streak
  let n = 0;
  while (done.has(dayKey(t))) { n++; t -= DAY; }
  return n;
}

app.get('/api/question', auth, paired, (req, res) => {
  const day = dayKey();
  const q = questionFor(req.couple, day);
  const mine = store.get('answers', `${req.couple.id}:${day}:${req.user.id}`);
  const theirs = req.partner && store.get('answers', `${req.couple.id}:${day}:${req.partner.id}`);
  res.json({
    day, ...q,
    mine: mine ? mine.text : null,
    partnerAnswered: !!theirs,
    partner: mine && theirs ? theirs.text : null
  });
});

app.post('/api/question', auth, paired, active, (req, res) => {
  const text = clean(req.body.text, 1000);
  if (!text) return res.status(400).json({ error: 'Write an answer first.' });
  const day = dayKey();
  store.put('answers', { id: `${req.couple.id}:${day}:${req.user.id}`, coupleId: req.couple.id, userId: req.user.id, day, text, at: now() });
  res.json({ ok: true });
});

app.get('/api/question/history', auth, paired, (req, res) => {
  const c = req.couple;
  const days = [...completeDays(c)].sort().reverse().slice(0, 90);
  res.json(days.map(day => ({
    day, question: questionFor(c, day).text,
    mine: store.get('answers', `${c.id}:${day}:${req.user.id}`)?.text,
    partner: req.partner ? store.get('answers', `${c.id}:${day}:${req.partner.id}`)?.text : null
  })));
});

// ---------- state (polled by the app) ----------
app.get('/api/state', auth, (req, res) => {
  const c = req.couple;
  const out = { me: publicUser(req.user), partner: publicUser(req.partner), status: coupleStatus(c) };
  if (c) out.couple = { code: c.code, anniversary: c.anniversary, city: c.city, pairedDay: c.pairedDay || null };
  if (c && c.pairedAt) {
    const day = dayKey();
    out.streak = streak(c);
    out.daysTogether = dayDiff(c.pairedDay, day) + 1;
    out.today = {
      answered: !!store.get('answers', `${c.id}:${day}:${req.user.id}`),
      partnerAnswered: !!(req.partner && store.get('answers', `${c.id}:${day}:${req.partner.id}`))
    };
    out.myMood = store.get('moods', req.user.id);
    out.partnerMood = req.partner ? store.get('moods', req.partner.id) : null;
    out.nudges = store.filter('nudges', n => n.to === req.user.id && !n.seen).sort((a, b) => b.at - a.at).slice(0, 5);
    const t = now();
    out.notesUnlocked = store.filter('notes', n => n.to === req.user.id && n.unlockAt <= t && !n.opened).length;
  }
  res.json(out);
});

// ---------- thinking of you ----------
const NUDGES = { heart: 'is thinking of you 💗', hug: 'sent you a hug 🫂', miss: 'misses you 🥺', kiss: 'sent you a kiss 💋' };
app.post('/api/nudge', auth, paired, active, (req, res) => {
  const kind = NUDGES[req.body.kind] ? req.body.kind : 'heart';
  if (!req.partner) return res.status(400).json({ error: 'No partner yet.' });
  store.put('nudges', { id: newId(), coupleId: req.couple.id, from: req.user.id, to: req.partner.id, kind, text: `${req.user.name} ${NUDGES[kind]}`, at: now(), seen: false });
  res.json({ ok: true });
});
app.post('/api/nudge/seen', auth, (req, res) => {
  for (const n of store.filter('nudges', n => n.to === req.user.id && !n.seen)) { n.seen = true; store.put('nudges', n); }
  res.json({ ok: true });
});

// ---------- mood ----------
app.post('/api/mood', auth, paired, active, (req, res) => {
  const m = C.MOODS.find(x => x[0] === req.body.emoji);
  if (!m) return res.status(400).json({ error: 'Pick a mood.' });
  store.put('moods', { id: req.user.id, emoji: m[0], label: m[1], note: clean(req.body.note, 80), at: now() });
  res.json({ ok: true });
});

// ---------- love notes time capsule ----------
app.get('/api/notes', auth, paired, (req, res) => {
  const t = now();
  const notes = store.filter('notes', n => n.coupleId === req.couple.id).sort((a, b) => a.unlockAt - b.unlockAt).map(n => {
    const mine = n.from === req.user.id;
    const unlocked = n.unlockAt <= t;
    return { id: n.id, mine, unlocked, unlockAt: n.unlockAt, createdAt: n.createdAt, title: n.title, text: mine || unlocked ? n.text : null, opened: n.opened };
  });
  res.json(notes);
});
app.post('/api/notes', auth, paired, active, (req, res) => {
  const text = clean(req.body.text, 2000);
  const title = clean(req.body.title, 60) || 'A note for you';
  const unlockDay = String(req.body.unlockDay || '');
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(unlockDay)) return res.status(400).json({ error: 'Write a note and pick an unlock date.' });
  if (unlockDay < dayKey()) return res.status(400).json({ error: 'Pick today or a future date.' });
  // unlocks at 00:00 India time on that day
  const unlockAt = Date.parse(unlockDay + 'T00:00:00+05:30');
  store.put('notes', { id: newId(), coupleId: req.couple.id, from: req.user.id, to: req.partner.id, title, text, unlockAt, createdAt: now(), opened: false });
  res.json({ ok: true });
});
app.post('/api/notes/:id/open', auth, paired, (req, res) => {
  const n = store.get('notes', req.params.id);
  if (n && n.to === req.user.id && n.unlockAt <= now()) { n.opened = true; store.put('notes', n); }
  res.json({ ok: true });
});

// ---------- shared bucket list ----------
app.get('/api/bucket', auth, paired, (req, res) => {
  res.json(store.filter('bucket', b => b.coupleId === req.couple.id).sort((a, b) => (a.done - b.done) || (b.createdAt - a.createdAt)));
});
app.post('/api/bucket', auth, paired, active, (req, res) => {
  const text = clean(req.body.text, 140);
  if (!text) return res.status(400).json({ error: 'Add something to your list.' });
  const cats = ['Travel', 'Dates', 'Goals', 'Food', 'Experiences'];
  const category = cats.includes(req.body.category) ? req.body.category : 'Experiences';
  store.put('bucket', { id: newId(), coupleId: req.couple.id, text, category, done: false, by: req.user.name, createdAt: now() });
  res.json({ ok: true });
});
app.post('/api/bucket/:id/toggle', auth, paired, active, (req, res) => {
  const b = store.get('bucket', req.params.id);
  if (!b || b.coupleId !== req.couple.id) return res.status(404).json({ error: 'Not found' });
  b.done = !b.done; b.doneAt = b.done ? now() : null; store.put('bucket', b);
  res.json({ ok: true });
});
app.delete('/api/bucket/:id', auth, paired, active, (req, res) => {
  const b = store.get('bucket', req.params.id);
  if (b && b.coupleId === req.couple.id) store.del('bucket', b.id);
  res.json({ ok: true });
});

// ---------- This or That (pick for yourself + guess your partner) ----------
function totView(g, req) {
  const me = req.user.id, them = req.partner?.id;
  const mine = g.picks[me], theirs = them && g.picks[them];
  const items = g.items.map(i => C.THIS_OR_THAT[i]);
  const view = { id: g.id, items, mineDone: !!mine, partnerDone: !!theirs, done: !!(mine && theirs) };
  if (view.done) {
    view.results = items.map((pair, k) => ({ pair, me: mine.self[k], partner: theirs.self[k], myGuess: mine.guess[k], partnerGuess: theirs.guess[k] }));
    view.sameCount = view.results.filter(r => r.me === r.partner).length;
    view.myScore = view.results.filter(r => r.myGuess === r.partner).length;
    view.partnerScore = view.results.filter(r => r.partnerGuess === r.me).length;
  }
  return view;
}
const latestGame = c => store.filter('games', g => g.coupleId === c.id && g.type === 'tot').sort((a, b) => b.createdAt - a.createdAt)[0];

app.get('/api/games/tot', auth, paired, (req, res) => {
  const g = latestGame(req.couple);
  res.json(g ? totView(g, req) : null);
});
app.post('/api/games/tot/new', auth, paired, active, (req, res) => {
  const g = latestGame(req.couple);
  if (g && !totView(g, req).done) return res.json(totView(g, req));
  const idx = [...C.THIS_OR_THAT.keys()].sort(() => Math.random() - 0.5).slice(0, 8);
  const ng = store.put('games', { id: newId(), coupleId: req.couple.id, type: 'tot', items: idx, picks: {}, createdAt: now() });
  res.json(totView(ng, req));
});
app.post('/api/games/tot/submit', auth, paired, active, (req, res) => {
  const g = latestGame(req.couple);
  if (!g) return res.status(400).json({ error: 'Start a round first.' });
  const ok = a => Array.isArray(a) && a.length === g.items.length && a.every(x => x === 0 || x === 1);
  if (!ok(req.body.self) || !ok(req.body.guess)) return res.status(400).json({ error: 'Answer every question.' });
  g.picks[req.user.id] = { self: req.body.self, guess: req.body.guess };
  store.put('games', g);
  res.json(totView(g, req));
});

// ---------- compatibility quizzes ----------
function quizResult(key, answers) {
  if (key === 'love') {
    const counts = { W: 0, T: 0, G: 0, S: 0, P: 0 };
    answers.forEach((a, i) => { const opt = C.QUIZZES.love.questions[i].options[a]; if (opt) counts[opt[1]]++; });
    const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    return { counts, top };
  }
  return { answers };
}
function quizCompare(key, a, b) {
  if (key === 'love') {
    const ks = Object.keys(a.counts);
    const dot = ks.reduce((s, k) => s + a.counts[k] * b.counts[k], 0);
    const mag = v => Math.sqrt(ks.reduce((s, k) => s + v[k] ** 2, 0)) || 1;
    return { score: Math.round(100 * dot / (mag(a.counts) * mag(b.counts))) };
  }
  const diffs = a.answers.map((x, i) => Math.abs(x - b.answers[i]));
  const score = Math.round(100 - (diffs.reduce((s, d) => s + d, 0) / (diffs.length * 4)) * 100);
  const gaps = diffs.map((d, i) => ({ i, d })).filter(x => x.d >= 2).sort((p, q) => q.d - p.d).slice(0, 3)
    .map(x => ({ statement: C.QUIZZES.values.questions[x.i], me: a.answers[x.i], partner: b.answers[x.i] }));
  return { score, gaps };
}
app.get('/api/quizzes', auth, paired, (req, res) => {
  const out = {};
  for (const key of Object.keys(C.QUIZZES)) {
    const mine = store.get('quizzes', `${req.couple.id}:${key}:${req.user.id}`);
    const theirs = req.partner && store.get('quizzes', `${req.couple.id}:${key}:${req.partner.id}`);
    out[key] = { mineDone: !!mine, partnerDone: !!theirs, mine: mine?.result || null };
    if (mine && theirs) out[key] = { ...out[key], partner: theirs.result, compare: quizCompare(key, mine.result, theirs.result) };
  }
  res.json(out);
});
app.post('/api/quizzes/:key', auth, paired, active, (req, res) => {
  const key = req.params.key, quiz = C.QUIZZES[key];
  if (!quiz) return res.status(404).json({ error: 'Unknown quiz' });
  const answers = req.body.answers;
  const max = quiz.type === 'choice' ? 1 : 5, min = quiz.type === 'choice' ? 0 : 1;
  if (!Array.isArray(answers) || answers.length !== quiz.questions.length || !answers.every(x => Number.isInteger(x) && x >= min && x <= max))
    return res.status(400).json({ error: 'Answer every question.' });
  store.put('quizzes', { id: `${req.couple.id}:${key}:${req.user.id}`, result: quizResult(key, answers), at: now() });
  res.json({ ok: true });
});

// ---------- AI date ideas ----------
app.post('/api/date-ideas', auth, paired, active, async (req, res) => {
  const city = clean(req.body.city, 60) || req.couple.city || '';
  const budget = ['free', 'low', 'mid', 'splurge'].includes(req.body.budget) ? req.body.budget : 'low';
  const vibe = ['cozy', 'adventure', 'foodie', 'creative', 'distance'].includes(req.body.vibe) ? req.body.vibe : 'cozy';
  const fallback = () => {
    const shuffle = a => a.sort(() => Math.random() - 0.5);
    const exact = shuffle(C.DATE_IDEAS.filter(d => d.vibe === vibe && d.budget === budget));
    const sameVibe = shuffle(C.DATE_IDEAS.filter(d => d.vibe === vibe && d.budget !== budget));
    const sameBudget = shuffle(C.DATE_IDEAS.filter(d => d.budget === budget && d.vibe !== vibe));
    return [...exact, ...sameVibe, ...sameBudget].slice(0, 4);
  };
  const key = process.env.ANTHROPIC_API_KEY;
  const usageId = `${req.couple.id}:${dayKey()}`;
  const usage = store.get('aiusage', usageId) || { id: usageId, count: 0 };
  if (!key || usage.count >= AI_DAILY_LIMIT) return res.json({ ideas: fallback(), source: 'curated' });
  usage.count++; store.put('aiusage', usage);
  const budgetText = { free: 'free (₹0)', low: 'under ₹1,000', mid: '₹1,000–₹4,000', splurge: 'above ₹4,000' }[budget];
  const prompt = `Suggest 4 date ideas for a couple in India.
City: ${city || 'not specified (keep ideas general)'}
Budget for two: ${budgetText}
Vibe: ${vibe === 'distance' ? 'long-distance (they are in different cities, ideas must work over a video call or by delivery)' : vibe}
Make them specific, fresh and doable this week. If a city is given, use real kinds of places typical for that city but do not invent exact business names.
Reply with ONLY a JSON array: [{"title": "...", "description": "one or two sentences"}]`;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: process.env.AI_MODEL || 'claude-haiku-5-5', max_tokens: 700, messages: [{ role: 'user', content: prompt }] })
    });
    const j = await r.json();
    const txt = (j.content || []).map(b => b.text || '').join('');
    const ideas = JSON.parse(txt.slice(txt.indexOf('['), txt.lastIndexOf(']') + 1))
      .slice(0, 4).map(i => ({ title: clean(i.title, 80), description: clean(i.description, 300), budget }));
    if (!ideas.length) throw new Error('empty');
    res.json({ ideas, source: 'ai' });
  } catch (e) {
    console.error('AI date ideas failed:', e.message);
    res.json({ ideas: fallback(), source: 'curated' });
  }
});

// ---------- static content for the app ----------
app.get('/api/content', (req, res) => {
  res.json({ truthOrDare: C.TRUTH_OR_DARE, quizzes: C.QUIZZES, loveLanguages: C.LOVE_LANGUAGES, moods: C.MOODS, trialDays: TRIAL_DAYS });
});

// ---------- admin: activate a subscription manually (until payments are connected) ----------
app.post('/api/admin/activate', (req, res) => {
  if (!process.env.ADMIN_KEY || req.body.key !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'forbidden' });
  const c = store.find('couples', x => x.code === clean(req.body.code, 10).toUpperCase());
  if (!c) return res.status(404).json({ error: 'No couple with that code' });
  const days = Math.max(1, Math.min(400, Number(req.body.days) || 30));
  c.paidUntil = Math.max(c.paidUntil || 0, now()) + days * DAY;
  store.put('couples', c);
  res.json({ ok: true, paidUntil: new Date(c.paidUntil).toISOString() });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

store.init().then(() => app.listen(PORT, () => console.log(`Duo running on http://localhost:${PORT}`)));
