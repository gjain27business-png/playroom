// Duo — frontend (no framework, no build step)
const $ = s => document.querySelector(s);
const app = $('#app');
let S = null;           // latest /api/state
let CT = null;          // content (quizzes, truth or dare, moods)
let seenNudgeIds = new Set();
let pollTimer = null;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initial = n => esc((n || '?').trim()[0].toUpperCase());
const todayStr = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const fmtDate = t => new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDay = d => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const partnerName = () => S?.partner?.name || 'your partner';
const readOnly = () => S?.status?.state === 'expired';

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2800);
}

async function api(method, url, body) {
  const r = await fetch(url, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) {
    if (S) { S = null; location.hash = '#/welcome'; } // session expired while using the app
    throw new Error('not_logged_in');
  }
  if (r.status === 402) { showPaywall(); throw new Error('subscription_required'); }
  if (!r.ok) throw new Error(j.error || 'Something went wrong');
  return j;
}

async function refresh() {
  try { S = await api('GET', '/api/state'); } catch { S = null; }
  renderChrome();
  handleNudges();
  return S;
}

function handleNudges() {
  if (!S?.nudges?.length) return;
  const fresh = S.nudges.filter(n => !seenNudgeIds.has(n.id));
  fresh.forEach(n => seenNudgeIds.add(n.id));
  if (fresh.length) {
    toast(fresh[0].text);
    if (navigator.vibrate) navigator.vibrate([80, 60, 80]);
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification('Duo', { body: fresh[0].text, icon: '/icon.svg' });
  }
}

function renderChrome() {
  const paired = S?.status && S.status.state !== 'waiting';
  $('#nav').hidden = !paired;
  const tab = (location.hash.split('/')[1] || 'home');
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab || (tab === 'tot' || tab === 'tod') && a.dataset.tab === 'play' || ['quiz', 'notes', 'bucket', 'dates'].includes(tab) && a.dataset.tab === 'together'));
  const b = $('#banner');
  if (S?.status?.state === 'expired') b.innerHTML = `Your Duo is in read-only mode. Your memories are safe 💗 <button onclick="showPaywall()">Renew</button>`;
  else if (S?.status?.state === 'trial' && S.status.daysLeft <= 2) b.innerHTML = `${S.status.daysLeft} day${S.status.daysLeft > 1 ? 's' : ''} left in your free trial <button onclick="showPaywall()">Keep Duo</button>`;
  else b.innerHTML = '';
}

// ---------------- router ----------------
const routes = {};
async function route() {
  const [, name = '', arg] = location.hash.split('/');
  if (!S || S.status.state === 'waiting') await refresh();
  if (!S) { if (!['welcome', 'login', 'signup'].includes(name)) return go('#/welcome'); }
  else if (S.status.state === 'waiting' && name !== 'pair') return go('#/pair');
  else if (S.status.state !== 'waiting' && ['welcome', 'login', 'signup', 'pair', ''].includes(name)) return go('#/home');
  renderChrome();
  window.scrollTo(0, 0);
  (routes[name] || routes.home)(arg);
}
const go = h => { if (location.hash === h) route(); else location.hash = h; };
// On "waiting for your partner" screens, re-check every 6s while the screen is open.
function recheck(fn) {
  const h = location.hash;
  clearTimeout(recheck._t);
  recheck._t = setTimeout(() => { if (location.hash === h && !document.hidden) fn(); else if (location.hash === h) recheck(fn); }, 6000);
}
window.addEventListener('hashchange', route);

// ---------------- welcome / auth ----------------
routes.welcome = () => {
  app.innerHTML = `
    <div class="stack">
      <div class="hero"><div class="hearts">💞</div><div class="logo">du<span>o</span></div><p class="muted">a little world, just for two</p></div>
      <div class="card blush stack">
        <p>✨ One question a day, answered together</p>
        <p>🎲 Games that show how well you know each other</p>
        <p>💌 Love notes that unlock on special days</p>
        <p>🗺️ Date ideas, quizzes and your shared bucket list</p>
      </div>
      <button class="btn" onclick="go('#/signup')">Create your Duo</button>
      <button class="btn ghost" onclick="go('#/login')">I already have an account</button>
      <p class="muted center small">${CT?.trialDays || 7}-day free trial · one plan covers both of you</p>
    </div>`;
};

function authForm(mode) {
  const signup = mode === 'signup';
  app.innerHTML = `
    <div class="stack">
      <button class="back" onclick="go('#/welcome')">← Back</button>
      <h1>${signup ? 'Hello, lovebird 👋' : 'Welcome back 💗'}</h1>
      <p class="muted">${signup ? "Make your account, then invite your partner." : 'Log in to your Duo.'}</p>
      <form id="f" class="stack">
        ${signup ? `<div><label>Your first name</label><input name="name" autocomplete="given-name" required></div>` : ''}
        <div><label>Email</label><input name="email" type="email" autocomplete="email" required></div>
        <div><label>Password</label><input name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" minlength="6" required></div>
        <div class="error" id="err"></div>
        <button class="btn">${signup ? 'Create account' : 'Log in'}</button>
      </form>
      <button class="link" onclick="go('#/${signup ? 'login' : 'signup'}')">${signup ? 'Have an account? Log in' : 'New here? Create an account'}</button>
    </div>`;
  $('#f').onsubmit = async e => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    try { await api('POST', `/api/${mode}`, body); await refresh(); route(); }
    catch (err) { $('#err').textContent = err.message; }
  };
}
routes.signup = () => authForm('signup');
routes.login = () => authForm('login');

// ---------------- pairing ----------------
routes.pair = async () => {
  const code = S.couple?.code;
  const link = code ? `${location.origin}/#/pair` : '';
  const wa = code ? `https://wa.me/?text=${encodeURIComponent(`Join me on Duo 💞 Sign up at ${location.origin} and enter our code: ${code}`)}` : '';
  app.innerHTML = `
    <div class="stack">
      <div class="hero"><div class="hearts">🫶</div><h1>Let's pair you up, ${esc(S.me.name)}</h1></div>
      ${code ? `
        <div class="card stack center">
          <p class="eyebrow">Your invite code</p>
          <div class="code">${code}</div>
          <p class="muted small">Ask your partner to sign up and enter this code. Your ${CT?.trialDays || 7}-day trial starts when they join.</p>
          <a class="btn" href="${wa}" target="_blank" rel="noopener">Share on WhatsApp</a>
          <button class="btn soft" onclick="navigator.clipboard.writeText('${code}').then(()=>toast('Code copied'))">Copy code</button>
        </div>
        <p class="muted center small">Waiting for your partner… this page updates automatically.</p>`
      : `<div class="card stack"><h3>Start a new Duo</h3><p class="muted small">Get a code to send your partner.</p><button class="btn" id="create">Get our code</button></div>`}
      <div class="card stack">
        <h3>Got a code from your partner?</h3>
        <input id="code" placeholder="e.g. K7M2QX" maxlength="6" style="text-transform:uppercase;letter-spacing:.2em;text-align:center;font-size:20px">
        <div class="error" id="err"></div>
        <button class="btn ghost" id="join">Join their Duo</button>
      </div>
      <button class="link" onclick="logout()">Log out</button>
    </div>`;
  // check every 4s whether the partner has joined
  clearInterval(routes.pair._t);
  routes.pair._t = setInterval(async () => {
    if (!location.hash.startsWith('#/pair')) return clearInterval(routes.pair._t);
    await refresh();
    if (S && S.status.state !== 'waiting') { clearInterval(routes.pair._t); toast("You're paired! 💞"); go('#/home'); }
  }, 4000);
  if ($('#create')) $('#create').onclick = async () => { await api('POST', '/api/couple/create'); await refresh(); route(); };
  $('#join').onclick = async () => {
    try { await api('POST', '/api/couple/join', { code: $('#code').value }); await refresh(); toast("You're paired! 💞"); go('#/home'); }
    catch (e) { $('#err').textContent = e.message; }
  };
};

// ---------------- home ----------------
routes.home = () => {
  const pm = S.partnerMood, mm = S.myMood;
  const t = S.today;
  const qLine = t.answered && t.partnerAnswered ? 'You both answered — see what they said 👀'
    : t.answered ? `Waiting for ${esc(partnerName())} to answer…`
    : t.partnerAnswered ? `${esc(partnerName())} answered! Answer to unlock theirs 🔓`
    : "Today's question is waiting for you two";
  const ann = S.couple.anniversary ? anniversaryCountdown(S.couple.anniversary) : '';
  app.innerHTML = `
    <div class="stack">
      <div class="row between">
        <div><p class="muted small">${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p><h1>Hi ${esc(S.me.name)} 💗</h1></div>
        <div class="avatars"><div class="avatar">${initial(S.me.name)}</div><div class="avatar two" style="margin-left:-18px">${initial(partnerName())}</div></div>
      </div>
      <div class="stats">
        <div class="card stat"><b>${S.streak}🔥</b><span class="muted small">day streak</span></div>
        <div class="card stat"><b>${S.daysTogether}</b><span class="muted small">days on Duo</span></div>
      </div>
      ${ann}
      <div class="card blush tap" onclick="go('#/today')">
        <p class="eyebrow">Today's question</p><div class="spacer"></div>
        <h3>${qLine}</h3>
      </div>
      <div class="card stack">
        <p class="eyebrow">${esc(partnerName())}'s mood</p>
        ${pm ? `<div class="mood"><span class="emoji">${pm.emoji}</span><div><b>${esc(pm.label)}</b>${pm.note ? `<p class="muted small">“${esc(pm.note)}”</p>` : ''}<p class="muted small">${timeAgo(pm.at)}</p></div></div>` : `<p class="muted">No mood shared yet.</p>`}
        <hr style="border:none;border-top:1px solid var(--line);margin:14px 0">
        <div class="row between"><p class="eyebrow">Your mood</p><button class="link" onclick="moodPicker()">${mm ? 'Change' : 'Set mood'}</button></div>
        ${mm ? `<div class="mood"><span class="emoji">${mm.emoji}</span><div><b>${esc(mm.label)}</b>${mm.note ? `<p class="muted small">“${esc(mm.note)}”</p>` : ''}</div></div>` : ''}
      </div>
      <div class="card stack center">
        <p class="eyebrow">Thinking of you</p>
        <button class="bigheart" onclick="nudge('heart')" aria-label="Send a heart">💗</button>
        <p class="muted small">Tap to let ${esc(partnerName())} know</p>
        <div class="nudges">
          <button onclick="nudge('hug')"><span>🫂</span>Hug</button>
          <button onclick="nudge('miss')"><span>🥺</span>Miss you</button>
          <button onclick="nudge('kiss')"><span>💋</span>Kiss</button>
          <button onclick="go('#/notes')"><span>💌</span>Note</button>
        </div>
      </div>
      ${S.notesUnlocked ? `<div class="card sage tap" onclick="go('#/notes')"><h3>💌 A love note just unlocked for you</h3><p class="muted small">Tap to open it</p></div>` : ''}
    </div>`;
  if (S.nudges?.length) api('POST', '/api/nudge/seen').catch(() => {});
  if ('Notification' in window && Notification.permission === 'default') setTimeout(() => Notification.requestPermission().catch(() => {}), 4000);
};

function anniversaryCountdown(a) {
  const [y, m, d] = a.split('-').map(Number);
  const now = new Date(todayStr() + 'T00:00:00');
  let next = new Date(now.getFullYear(), m - 1, d);
  if (next < now) next = new Date(now.getFullYear() + 1, m - 1, d);
  const days = Math.round((next - now) / 864e5);
  const years = next.getFullYear() - y;
  return `<div class="card sage"><p class="eyebrow">Anniversary</p><div class="spacer"></div><h3>${days === 0 ? `Happy ${years > 0 ? ordinal(years) + ' ' : ''}anniversary! 🥂` : `${days} days to your ${years > 0 ? ordinal(years) + ' ' : ''}anniversary`}</h3></div>`;
}
const ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th');
function timeAgo(t) {
  const m = Math.round((Date.now() - t) / 6e4);
  if (m < 1) return 'just now'; if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

async function nudge(kind) {
  try { await api('POST', '/api/nudge', { kind }); toast(`Sent to ${partnerName()} 💗`); if (navigator.vibrate) navigator.vibrate(40); } catch {}
}

function moodPicker() {
  if (readOnly()) return showPaywall();
  let pick = S.myMood?.emoji;
  openModal(`
    <h2>How are you feeling?</h2><div class="spacer"></div>
    <div class="moodgrid">${CT.moods.map(([e, l]) => `<button data-e="${e}" class="${e === pick ? 'on' : ''}"><span>${e}</span>${esc(l)}</button>`).join('')}</div>
    <div class="spacer"></div><input id="mnote" maxlength="80" placeholder="Add a short note (optional)" value="${esc(S.myMood?.note || '')}">
    <div class="spacer"></div><button class="btn" id="msave">Share with ${esc(partnerName())}</button>`);
  document.querySelectorAll('.moodgrid button').forEach(b => b.onclick = () => {
    pick = b.dataset.e; document.querySelectorAll('.moodgrid button').forEach(x => x.classList.toggle('on', x === b));
  });
  $('#msave').onclick = async () => {
    if (!pick) return toast('Pick a mood first');
    try { await api('POST', '/api/mood', { emoji: pick, note: $('#mnote').value }); closeModal(); await refresh(); route(); } catch {}
  };
}

// ---------------- daily question ----------------
routes.today = async () => {
  const [q, hist] = await Promise.all([api('GET', '/api/question'), api('GET', '/api/question/history')]);
  app.innerHTML = `
    <div class="stack">
      <p class="eyebrow">Day ${q.dayNumber} · ${fmtDay(q.day)}</p>
      <div class="card blush stack"><p class="question">${esc(q.text)}</p></div>
      ${q.mine ? `
        <div class="answer"><div class="who">You</div>${esc(q.mine)}</div>
        ${q.partner ? `<div class="answer theirs"><div class="who">${esc(partnerName())}</div>${esc(q.partner)}</div>`
          : `<div class="locked">🔒 ${esc(partnerName())} hasn't answered yet.<br><button class="link" onclick="nudge('heart')">Send a nudge 💗</button></div>`}`
      : `
        ${q.partnerAnswered ? `<div class="locked">🔓 ${esc(partnerName())} has answered! Answer to reveal theirs.</div>` : ''}
        <textarea id="ans" placeholder="Write your answer… they'll only see it once they answer too."></textarea>
        <button class="btn" id="send">Lock in my answer</button>`}
      ${hist.length ? `<h2 style="margin-top:28px">Your story so far</h2>
        ${hist.map(h => `<div class="card stack"><p class="muted small">${fmtDay(h.day)}</p><h3>${esc(h.question)}</h3>
          <div class="answer"><div class="who">You</div>${esc(h.mine)}</div>
          <div class="answer theirs"><div class="who">${esc(partnerName())}</div>${esc(h.partner)}</div></div>`).join('')}` : ''}
    </div>`;
  if (q.mine && !q.partner) recheck(routes.today);
  if ($('#send')) $('#send').onclick = async () => {
    const text = $('#ans').value.trim();
    if (!text) return toast('Write something first 💭');
    try { await api('POST', '/api/question', { text }); await refresh(); routes.today(); } catch {}
  };
};

// ---------------- play ----------------
routes.play = () => {
  app.innerHTML = `
    <div class="stack">
      <h1>Play together 🎲</h1>
      <p class="muted">Best on a call or side by side.</p>
      <div class="card blush tap" onclick="go('#/tot')"><div class="row"><span style="font-size:38px">🤔</span><div><h3>This or That</h3><p class="muted small">Pick yours, guess theirs. Who knows who better?</p></div></div></div>
      <div class="card tap" onclick="go('#/tod')"><div class="row"><span style="font-size:38px">🎯</span><div><h3>Truth or Dare</h3><p class="muted small">Sweet, flirty or spicy — you choose the level.</p></div></div></div>
      <div class="card sage tap" onclick="go('#/together')"><div class="row"><span style="font-size:38px">💞</span><div><h3>Compatibility quizzes</h3><p class="muted small">Love language and values match.</p></div></div></div>
    </div>`;
};

// This or That
routes.tot = async () => {
  let g = await api('GET', '/api/games/tot');
  const start = async () => { try { g = await api('POST', '/api/games/tot/new'); draw(); } catch {} };
  const draw = () => {
    if (!g) {
      app.innerHTML = `<div class="stack"><button class="back" onclick="go('#/play')">← Play</button><h1>This or That 🤔</h1>
        <div class="card blush stack"><p>8 quick choices. First pick what <b>you</b> like, then guess what <b>${esc(partnerName())}</b> picked. Results unlock when you both finish.</p></div>
        <button class="btn" id="go">Start a round</button></div>`;
      $('#go').onclick = start; return;
    }
    if (!g.mineDone) return playTot(g, v => { g = v; draw(); });
    if (!g.done) {
      app.innerHTML = `<div class="stack"><button class="back" onclick="go('#/play')">← Play</button><h1>This or That 🤔</h1>
        <div class="locked">✅ You're done! Waiting for ${esc(partnerName())} to play…<br><button class="link" onclick="nudge('heart')">Nudge them 💗</button></div></div>`;
      recheck(routes.tot); return;
    }
    app.innerHTML = `<div class="stack"><button class="back" onclick="go('#/play')">← Play</button><h1>Results 🎉</h1>
      <div class="stats">
        <div class="card stat"><b>${g.myScore}/8</b><span class="muted small">you guessed right</span></div>
        <div class="card stat"><b>${g.partnerScore}/8</b><span class="muted small">${esc(partnerName())} guessed right</span></div>
      </div>
      <div class="card blush center"><h3>You matched on ${g.sameCount} of 8 ${g.sameCount >= 6 ? '💞' : g.sameCount >= 4 ? '😊' : '🙈'}</h3>
        <p class="muted small">${g.myScore > g.partnerScore ? 'You know them better this round!' : g.myScore < g.partnerScore ? `${esc(partnerName())} knows you better this round!` : "It's a tie — you know each other equally well."}</p></div>
      <div class="card">${g.results.map(r => `<div class="result-row"><div><b>${esc(r.pair[0])}</b> or <b>${esc(r.pair[1])}</b>
        <p class="muted small">You: ${esc(r.pair[r.me])} · ${esc(partnerName())}: ${esc(r.pair[r.partner])}</p></div>
        <span class="pill ${r.me === r.partner ? 'green' : ''}">${r.me === r.partner ? 'Match' : 'Different'}</span></div>`).join('')}</div>
      <button class="btn" id="again">Play another round</button></div>`;
    $('#again').onclick = start;
  };
  draw();
};

function playTot(g, done) {
  const n = g.items.length, self = Array(n).fill(null), guess = Array(n).fill(null);
  let step = 0; // 0..n-1 self, n..2n-1 guess
  const draw = () => {
    const isGuess = step >= n, k = step % n, pair = g.items[k];
    const cur = isGuess ? guess[k] : self[k];
    app.innerHTML = `<div class="stack">
      <button class="back" onclick="go('#/play')">← Play</button>
      <div class="progress"><div style="width:${(step / (2 * n)) * 100}%"></div></div>
      <p class="eyebrow">${isGuess ? `Guess what ${esc(partnerName())} picked` : 'Pick yours'} · ${k + 1}/${n}</p>
      <h2>${isGuess ? `${esc(partnerName())} would choose…` : 'I prefer…'}</h2>
      <div class="choice ${isGuess ? 'guess' : ''}">${pair.map((p, i) => `<button data-i="${i}" class="${cur === i ? 'on' : ''}">${esc(p)}</button>`).join('')}</div>
      ${step > 0 ? `<button class="link" id="prev">← Previous</button>` : ''}
    </div>`;
    document.querySelectorAll('.choice button').forEach(b => b.onclick = async () => {
      (isGuess ? guess : self)[k] = Number(b.dataset.i);
      if (step === 2 * n - 1) {
        try { done(await api('POST', '/api/games/tot/submit', { self, guess })); } catch {}
      } else { step++; setTimeout(draw, 140); }
    });
    if ($('#prev')) $('#prev').onclick = () => { step--; draw(); };
  };
  draw();
}

// Truth or Dare (runs on the device — play it on a call or together)
routes.tod = () => {
  let level = 'sweet', card = null;
  const pickCard = kind => {
    const deck = CT.truthOrDare[level][kind === 'truth' ? 'truths' : 'dares'];
    card = { kind, text: deck[Math.floor(Math.random() * deck.length)] };
    draw();
  };
  const draw = () => {
    app.innerHTML = `<div class="stack">
      <button class="back" onclick="go('#/play')">← Play</button>
      <h1>Truth or Dare 🎯</h1>
      <div class="tabs">${['sweet', 'flirty', 'spicy'].map(l => `<button data-l="${l}" class="${l === level ? 'on' : ''}">${{ sweet: '🍬 Sweet', flirty: '😏 Flirty', spicy: '🌶️ Spicy' }[l]}</button>`).join('')}</div>
      <div class="card ${card ? 'blush' : ''} tod-card">
        ${card ? `<div class="kind">${card.kind}</div><p>${esc(card.text)}</p>` : `<p class="muted" style="font-family:Inter;font-size:16px;font-weight:500">Take turns. Pick truth or dare 👇</p>`}
      </div>
      <div class="row"><button class="btn" id="t">Truth</button><button class="btn soft" id="d">Dare</button></div>
    </div>`;
    document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { level = b.dataset.l; card = null; draw(); });
    $('#t').onclick = () => pickCard('truth');
    $('#d').onclick = () => pickCard('dare');
  };
  draw();
};

// ---------------- together ----------------
routes.together = () => {
  app.innerHTML = `
    <div class="stack">
      <h1>Together 💞</h1>
      <div class="menu">
        <div class="card blush tap" onclick="go('#/quiz/love')"><span class="icon">💝</span><div><h3>Love Language</h3><p class="muted small">How you each feel loved</p></div></div>
        <div class="card sage tap" onclick="go('#/quiz/values')"><span class="icon">🧭</span><div><h3>Values Match</h3><p class="muted small">Where you align</p></div></div>
        <div class="card tap" onclick="go('#/notes')"><span class="icon">💌</span><div><h3>Love Notes</h3><p class="muted small">Unlock on a future date</p></div></div>
        <div class="card tap" onclick="go('#/bucket')"><span class="icon">🗺️</span><div><h3>Bucket List</h3><p class="muted small">Dreams to tick off</p></div></div>
      </div>
      <div class="card blush tap" onclick="go('#/dates')"><div class="row"><span style="font-size:38px">🌙</span><div><h3>Date ideas</h3><p class="muted small">Personalised for your city, budget and mood</p></div></div></div>
    </div>`;
};

// Quizzes
routes.quiz = async key => {
  const quiz = CT.quizzes[key];
  if (!quiz) return go('#/together');
  const all = await api('GET', '/api/quizzes');
  const st = all[key];
  if (!st.mineDone) return takeQuiz(key, quiz);
  if (!st.partnerDone) {
    app.innerHTML = `<div class="stack"><button class="back" onclick="go('#/together')">← Together</button><h1>${esc(quiz.title)}</h1>
      ${key === 'love' ? loveCard('You', st.mine) : ''}
      <div class="locked">🔒 Waiting for ${esc(partnerName())} to take it — then you'll see your match.<br><button class="link" onclick="nudge('heart')">Nudge them 💗</button></div></div>`;
    recheck(() => routes.quiz(key));
    return;
  }
  const cmp = st.compare;
  app.innerHTML = `<div class="stack"><button class="back" onclick="go('#/together')">← Together</button>
    <h1>${esc(quiz.title)}</h1>
    <canvas id="share" class="share-canvas" width="1080" height="1350"></canvas>
    <button class="btn" id="dl">Download & share to your story</button>
    ${key === 'love' ? loveCard('You', st.mine) + loveCard(partnerName(), st.partner)
      : `<div class="card stack"><h3>Talk about these 💬</h3>${cmp.gaps.length ? cmp.gaps.map(g => `<div><p>${esc(g.statement)}</p><p class="muted small">You: ${g.me}/5 · ${esc(partnerName())}: ${g.partner}/5</p></div>`).join('') : `<p class="muted">No big gaps — you're really aligned!</p>`}</div>`}
    <button class="link" id="retake">Retake quiz</button></div>`;
  drawShareCard($('#share'), quiz.title, cmp.score, key === 'love'
    ? `${S.me.name}: ${CT.loveLanguages[st.mine.top].name}\n${partnerName()}: ${CT.loveLanguages[st.partner.top].name}`
    : `${cmp.gaps.length ? cmp.gaps.length + ' things to talk about' : 'Perfectly aligned'}`);
  $('#dl').onclick = () => shareCanvas($('#share'), `duo-${key}.png`);
  $('#retake').onclick = () => takeQuiz(key, quiz);
};

function loveCard(who, r) {
  const L = CT.loveLanguages[r.top];
  const total = Object.values(r.counts).reduce((a, b) => a + b, 0) || 1;
  return `<div class="card stack"><p class="eyebrow">${esc(who)}</p><h3>${esc(L.name)}</h3><p class="muted small">${esc(L.tip)}</p>
    ${Object.entries(r.counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div><div class="row between small"><span>${esc(CT.loveLanguages[k].name)}</span><span class="muted">${Math.round(v / total * 100)}%</span></div><div class="progress"><div style="width:${v / total * 100}%"></div></div></div>`).join('')}</div>`;
}

function takeQuiz(key, quiz) {
  if (readOnly()) return showPaywall();
  const n = quiz.questions.length, ans = Array(n).fill(null);
  let i = 0;
  const draw = () => {
    const q = quiz.questions[i];
    app.innerHTML = `<div class="stack">
      <button class="back" onclick="go('#/together')">← Together</button>
      <div class="progress"><div style="width:${(i / n) * 100}%"></div></div>
      <p class="eyebrow">${esc(quiz.title)} · ${i + 1}/${n}</p>
      ${quiz.type === 'choice'
        ? `<h2>${esc(q.q)}</h2><div class="stack">${q.options.map((o, k) => `<button class="btn ${ans[i] === k ? '' : 'ghost'}" data-k="${k}">${esc(o[0])}</button>`).join('')}</div>`
        : `<h2>${esc(q)}</h2><div class="scale">${[1, 2, 3, 4, 5].map(k => `<button data-k="${k}" class="${ans[i] === k ? 'on' : ''}">${k}</button>`).join('')}</div>
           <div class="row between muted small"><span>Disagree</span><span>Agree</span></div>`}
      ${i > 0 ? `<button class="link" id="prev">← Previous</button>` : ''}
    </div>`;
    document.querySelectorAll('[data-k]').forEach(b => b.onclick = async () => {
      ans[i] = Number(b.dataset.k);
      if (i === n - 1) {
        try { await api('POST', `/api/quizzes/${key}`, { answers: ans }); toast('Saved 💗'); routes.quiz(key); } catch {}
      } else { i++; setTimeout(draw, 120); }
    });
    if ($('#prev')) $('#prev').onclick = () => { i--; draw(); };
  };
  draw();
}

function drawShareCard(cv, title, score, sub) {
  const x = cv.getContext('2d'), W = cv.width, H = cv.height;
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#FDE3E0'); g.addColorStop(1, '#FBF0E8');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(215,106,130,0.12)';
  [[160, 220, 120], [930, 330, 90], [880, 1120, 150], [180, 1180, 80]].forEach(([a, b, r]) => { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); });
  x.textAlign = 'center';
  x.fillStyle = '#D76A82'; x.font = '600 96px Fraunces, Georgia, serif'; x.fillText('duo', W / 2, 200);
  x.fillStyle = '#4A2D3B'; x.font = '600 60px Fraunces, Georgia, serif'; x.fillText(`${S.me.name} & ${partnerName()}`, W / 2, 420);
  x.fillStyle = '#8E7682'; x.font = '500 44px Inter, sans-serif'; x.fillText(`${title} match`, W / 2, 500);
  x.fillStyle = '#D76A82'; x.font = '600 300px Fraunces, Georgia, serif'; x.fillText(`${score}%`, W / 2, 840);
  x.fillStyle = '#4A2D3B'; x.font = '500 42px Inter, sans-serif';
  String(sub).split('\n').forEach((l, k) => x.fillText(l, W / 2, 980 + k * 62));
  x.fillStyle = '#8E7682'; x.font = '500 34px Inter, sans-serif'; x.fillText('How well do you two match? Try Duo 💞', W / 2, 1260);
}

async function shareCanvas(cv, name) {
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  const file = new File([blob], name, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Our Duo match' }); return; } catch {}
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
}

// Love notes time capsule
routes.notes = async () => {
  const notes = await api('GET', '/api/notes');
  const received = notes.filter(n => !n.mine), sent = notes.filter(n => n.mine);
  const tomorrow = new Date(Date.now() + 5.5 * 3600e3 + 864e5).toISOString().slice(0, 10);
  app.innerHTML = `<div class="stack">
    <button class="back" onclick="go('#/together')">← Together</button>
    <h1>Love notes 💌</h1>
    <p class="muted">Write a note that unlocks on a future date — a birthday, anniversary, or just a random Tuesday.</p>
    <div class="card stack">
      <input id="ntitle" maxlength="60" placeholder="Title (e.g. Open on our anniversary)">
      <textarea id="ntext" placeholder="Dear ${esc(partnerName())}…"></textarea>
      <div><label>Unlocks on</label><input id="nday" type="date" min="${todayStr()}" value="${tomorrow}"></div>
      <button class="btn" id="nsave">Seal the note 🔒</button>
    </div>
    <h2>For you</h2>
    ${received.length ? received.map(n => n.unlocked
      ? `<div class="card note stack"><p class="muted small">From ${esc(partnerName())} · unlocked ${fmtDate(n.unlockAt)}</p><h3>${esc(n.title)}</h3><p style="white-space:pre-wrap">${esc(n.text)}</p></div>`
      : `<div class="card note sealed center"><h3>🔒 ${esc(n.title)}</h3><p class="muted small">Unlocks ${fmtDate(n.unlockAt)}</p></div>`).join('')
      : `<p class="muted">Nothing yet. Maybe drop a hint? 😉</p>`}
    <h2>You sent</h2>
    ${sent.length ? sent.map(n => `<div class="card note ${n.unlocked ? '' : 'sealed'} stack"><p class="muted small">${n.unlocked ? 'Opened for them on' : 'Unlocks for them on'} ${fmtDate(n.unlockAt)}</p><h3>${esc(n.title)}</h3><p class="muted small" style="white-space:pre-wrap">${esc(n.text)}</p></div>`).join('') : `<p class="muted">You haven't written any notes yet.</p>`}
  </div>`;
  received.filter(n => n.unlocked && !n.opened).forEach(n => api('POST', `/api/notes/${n.id}/open`).catch(() => {}));
  $('#nsave').onclick = async () => {
    try { await api('POST', '/api/notes', { title: $('#ntitle').value, text: $('#ntext').value, unlockDay: $('#nday').value }); toast('Sealed 💌'); routes.notes(); }
    catch (e) { if (e.message !== 'subscription_required') toast(e.message); }
  };
};

// Bucket list
routes.bucket = async () => {
  const items = await api('GET', '/api/bucket');
  const done = items.filter(i => i.done).length;
  app.innerHTML = `<div class="stack">
    <button class="back" onclick="go('#/together')">← Together</button>
    <h1>Our bucket list 🗺️</h1>
    <p class="muted">${items.length ? `${done} of ${items.length} done together` : 'Places, dates and dreams — add your first one.'}</p>
    ${items.length ? `<div class="progress"><div style="width:${done / items.length * 100}%"></div></div>` : ''}
    <div class="card stack">
      <input id="btext" maxlength="140" placeholder="e.g. Watch the sunrise in Ladakh">
      <div class="row"><select id="bcat" class="grow">${['Travel', 'Dates', 'Food', 'Experiences', 'Goals'].map(c => `<option>${c}</option>`).join('')}</select><button class="btn small" id="badd">Add</button></div>
    </div>
    <div class="card">${items.length ? items.map(i => `<div class="list-item">
        <button class="check ${i.done ? 'on' : ''}" data-t="${i.id}">${i.done ? '✓' : ''}</button>
        <div class="grow"><p class="${i.done ? 'done-text' : ''}">${esc(i.text)}</p><p class="muted small">${esc(i.category)} · added by ${esc(i.by)}</p></div>
        <button class="x" data-d="${i.id}" aria-label="Remove">×</button></div>`).join('') : `<p class="muted center">Your list is empty.</p>`}</div>
  </div>`;
  $('#badd').onclick = async () => {
    try { await api('POST', '/api/bucket', { text: $('#btext').value, category: $('#bcat').value }); routes.bucket(); }
    catch (e) { if (e.message !== 'subscription_required') toast(e.message); }
  };
  document.querySelectorAll('[data-t]').forEach(b => b.onclick = async () => { try { await api('POST', `/api/bucket/${b.dataset.t}/toggle`); routes.bucket(); } catch {} });
  document.querySelectorAll('[data-d]').forEach(b => b.onclick = async () => { if (confirm('Remove this from your list?')) { try { await api('DELETE', `/api/bucket/${b.dataset.d}`); routes.bucket(); } catch {} } });
};

// Date ideas
routes.dates = () => {
  let budget = 'low', vibe = 'cozy';
  const draw = (ideas, source) => {
    app.innerHTML = `<div class="stack">
      <button class="back" onclick="go('#/together')">← Together</button>
      <h1>Date ideas 🌙</h1>
      <div class="card stack">
        <div><label>City</label><input id="city" placeholder="e.g. Raipur" value="${esc(S.couple.city || '')}"></div>
        <div><label>Budget for two</label><div class="tabs" id="bud">${[['free', 'Free'], ['low', '< ₹1k'], ['mid', '₹1–4k'], ['splurge', '₹4k+']].map(([k, l]) => `<button data-v="${k}" class="${k === budget ? 'on' : ''}">${l}</button>`).join('')}</div></div>
        <div><label>Vibe</label><select id="vibe">${[['cozy', '🕯️ Cozy'], ['adventure', '🏞️ Adventure'], ['foodie', '🍜 Foodie'], ['creative', '🎨 Creative'], ['distance', '📱 Long-distance']].map(([k, l]) => `<option value="${k}" ${k === vibe ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <button class="btn" id="get">✨ Suggest dates</button>
      </div>
      ${ideas ? ideas.map(i => `<div class="card stack"><h3>${esc(i.title)}</h3><p class="muted">${esc(i.description)}</p>
        <button class="link" data-add="${esc(i.title)}">+ Add to bucket list</button></div>`).join('') + (source === 'curated' ? `<p class="muted small center">Handpicked ideas</p>` : `<p class="muted small center">Made for you by AI</p>`) : ''}
    </div>`;
    document.querySelectorAll('#bud button').forEach(b => b.onclick = () => { budget = b.dataset.v; document.querySelectorAll('#bud button').forEach(x => x.classList.toggle('on', x === b)); });
    $('#vibe').onchange = e => vibe = e.target.value;
    $('#get').onclick = async () => {
      $('#get').disabled = true; $('#get').textContent = 'Thinking…';
      const city = $('#city').value;
      try {
        if (city !== (S.couple.city || '')) { await api('POST', '/api/couple/settings', { city }); S.couple.city = city; }
        const r = await api('POST', '/api/date-ideas', { city, budget, vibe });
        draw(r.ideas, r.source);
      } catch { draw(ideas, source); }
    };
    document.querySelectorAll('[data-add]').forEach(b => b.onclick = async () => {
      try { await api('POST', '/api/bucket', { text: b.dataset.add, category: 'Dates' }); toast('Added to your bucket list 🗺️'); b.remove(); } catch {}
    });
  };
  draw(null);
};

// ---------------- profile / settings ----------------
routes.profile = () => {
  const st = S.status;
  const plan = st.state === 'trial' ? `Free trial · ${st.daysLeft} day${st.daysLeft > 1 ? 's' : ''} left`
    : st.state === 'active' ? `Duo Premium · renews ${fmtDate(st.until)}` : 'Read-only — subscription ended';
  app.innerHTML = `<div class="stack">
    <h1>Us ⚙️</h1>
    <div class="card center stack">
      <div class="avatars"><div class="avatar">${initial(S.me.name)}</div><div class="avatar two">${initial(partnerName())}</div></div>
      <h2>${esc(S.me.name)} & ${esc(partnerName())}</h2>
      <p class="muted small">Together on Duo since ${fmtDay(S.couple.pairedDay)}</p>
    </div>
    <div class="card stack">
      <div><label>Our anniversary</label><input id="ann" type="date" value="${esc(S.couple.anniversary || '')}"></div>
      <div><label>Our city</label><input id="city" value="${esc(S.couple.city || '')}" placeholder="Used for date ideas"></div>
      <button class="btn soft" id="save">Save</button>
    </div>
    <div class="card stack">
      <p class="eyebrow">Plan</p><h3>${plan}</h3>
      ${st.state !== 'active' ? `<button class="btn" onclick="showPaywall()">See plans</button>` : ''}
      <p class="muted small">Duo code: <b>${esc(S.couple.code)}</b></p>
    </div>
    <button class="btn ghost" onclick="logout()">Log out</button>
  </div>`;
  $('#save').onclick = async () => {
    try { await api('POST', '/api/couple/settings', { anniversary: $('#ann').value, city: $('#city').value }); await refresh(); toast('Saved 💗'); } catch {}
  };
};

async function logout() { await fetch('/api/logout', { method: 'POST' }); S = null; seenNudgeIds.clear(); go('#/welcome'); }

// ---------------- paywall & modal ----------------
function openModal(html) { const m = $('#modal'); m.innerHTML = `<div class="sheet">${html}</div>`; m.hidden = false; m.onclick = e => { if (e.target === m) closeModal(); }; }
function closeModal() { $('#modal').hidden = true; }

function showPaywall() {
  const expired = readOnly();
  openModal(`<div class="stack">
    <div class="center"><div class="hearts">💞</div><h2>${expired ? 'Keep your Duo going' : 'Duo Premium'}</h2>
    <p class="muted small">${expired ? 'Your answers, notes and memories are safe. Renew to keep your streak alive and unlock everything again.' : 'One plan covers both of you.'}</p></div>
    <div class="plan best" data-plan="yearly"><div class="row between"><div><b>Yearly</b><p class="muted small">₹83/month · save 58%</p></div><div class="price">₹999</div></div></div>
    <div class="plan" data-plan="monthly"><div class="row between"><div><b>Monthly</b><p class="muted small">Cancel anytime</p></div><div class="price">₹199</div></div></div>
    <p class="muted small">✓ Daily questions & streak &nbsp;✓ All games & quizzes<br>✓ Love notes & bucket list &nbsp;✓ AI date ideas</p>
    <button class="btn" id="pay">Continue</button>
    <button class="link" style="display:block;margin:0 auto" onclick="closeModal()">Not now</button></div>`);
  let plan = 'yearly';
  document.querySelectorAll('.plan').forEach(p => p.onclick = () => { plan = p.dataset.plan; document.querySelectorAll('.plan').forEach(x => x.style.borderColor = x === p ? 'var(--rose)' : ''); });
  $('#pay').onclick = () => startCheckout(plan);
}

// Payments are not connected yet. Plug Razorpay (or store billing) in here later.
function startCheckout(plan) {
  toast('Payments are coming soon — we\'ll keep your Duo open meanwhile 💗');
  closeModal();
}

// ---------------- boot ----------------
(async function boot() {
  try { CT = await (await fetch('/api/content')).json(); } catch {}
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  await refresh();
  route();
  pollTimer = setInterval(async () => {
    if (!S || document.hidden) return;
    const before = JSON.stringify([S.today, S.partnerMood, S.status?.state, S.partner?.id]);
    await refresh();
    const after = JSON.stringify([S?.today, S?.partnerMood, S?.status?.state, S?.partner?.id]);
    const tab = location.hash.split('/')[1];
    if (before !== after && (tab === 'home' || tab === 'pair' || !S?.partner)) route();
  }, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S) refresh(); });
})();
