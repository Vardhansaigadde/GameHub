/* Party games: Emoji Movie Guess, Who's Most Likely To, Draw & Guess. */

// ---------- shared: guess box + feed ----------
const guessForm = (placeholder, label = 'Guess') => `<form class="guess-form" data-guess-form>
    <input id="guessInput" maxlength="60" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(placeholder)}" aria-label="Your guess">
    <button class="btn btn-primary" type="submit">${label}</button>
  </form>`;

function feedHtml(feed) {
  if (!feed.length) return '<div class="feed empty">Guesses show up here</div>';
  return `<div class="feed">${feed.map(f => {
    if (f.kind === 'correct') return `<div class="f-correct">${icon('check')} <b>${esc(f.name)}</b> got it! <span class="plus">+${f.pts}</span></div>`;
    if (f.kind === 'bonus') return `<div class="f-bonus">${icon('trophy')} Everyone got it! <b>${esc(f.name)}</b> earns a drawing bonus <span class="plus">+${f.pts}</span></div>`;
    if (f.kind === 'chat') return `<div class="f-chat"><b>${esc(f.name)}</b> ${esc(f.text)}</div>`;
    return `<div><b>${esc(f.name)}</b> ${esc(f.text)}</div>`;
  }).join('')}</div>`;
}

$('#stage').addEventListener('submit', e => {
  if (!e.target.matches('[data-guess-form]')) return;
  e.preventDefault();
  const input = $('#guessInput');
  const text = input.value.trim();
  if (!text) return;
  act({ type: 'guess', text });
  input.value = '';
  input.focus();
});

const timeBar = (deadline, total) => `<div class="timebar"><span data-deadline="${deadline}" data-total="${total}"></span></div>`;
const secsLeft = deadline => `<span class="secs" data-deadline="${deadline}"></span>`;

/* ======================= Emoji Movie Guess ======================= */
const emojiHints = { key: null, shown: 0 };
renderers.emojimovie = () => {
  const g = S.game;
  if (g.phase === 'over') {
    const best = Math.max(...Object.values(g.scores));
    const champs = Object.keys(g.scores).filter(id => g.scores[id] === best);
    return {
      tone: 'win',
      turn: 'That was the last movie!',
      body: `${resultBanner(`${champs.map(nameOf).map(esc).join(' & ')} win${champs.length > 1 ? '' : 's'} with ${best}`)}${scoreboard(g.scores)}<div class="actions">${rematchBtn()}</div>`,
    };
  }
  const reveal = g.phase === 'reveal';
  const turn = reveal ? `It was <b>${esc(g.answer)}</b> (${g.year})`
    : g.solved ? 'You got it! Waiting for the others…'
    : `Movie ${g.number} of ${g.of} — what is it?`;
  // each hint pops in once, when it first appears
  const key = `${g.number}`;
  if (emojiHints.key !== key) { emojiHints.key = key; emojiHints.shown = 0; }
  const chips = g.hints.length ? `<div class="emoji-hints">${g.hints.map((h, i) => `<span class="emoji-hint ${!reveal && i >= emojiHints.shown ? 'fresh' : ''}"><small>${esc(h.label)}</small>${esc(h.value)}</span>`).join('')}</div>` : '';
  emojiHints.shown = Math.max(emojiHints.shown, g.hints.length);
  return {
    tone: reveal ? 'win' : g.solved ? '' : 'mine',
    turn,
    body: `<div class="emoji-card ${reveal ? 'revealed' : ''}">
        <div class="emoji-clue" aria-label="Emoji clue">${g.emoji}</div>
        ${reveal || g.solved ? `<div class="emoji-answer">${esc(g.answer)}</div>` : `<div class="hint-mask">${esc(g.hint).split('   ').map(w => `<span class="hm-word">${w}</span>`).join('')}</div>`}
        ${chips}
      </div>
      ${g.phase === 'clue' ? timeBar(g.endsAt, g.totalMs) : ''}
      ${g.phase === 'clue' && !g.solved ? guessForm('Type the movie name…') : ''}
      ${feedHtml(g.feed)}
      ${scoreboard(g.scores, { extra: { title: 'This movie', value: id => (g.solvers.includes(id) ? `<span class="plus">${icon('check')}</span>` : '') } })}
      ${isHost() && g.phase === 'clue' ? '<div class="actions"><button class="btn btn-sm btn-ghost" data-game="emojimovie" data-skip>Reveal now</button></div>' : ''}
      <p class="hint">A new hint appears as time runs down: hero, heroine, director or year. Answer sooner to score more. Small spelling mistakes are fine.</p>`,
  };
};
handlers.emojimovie = d => { if ('skip' in d) act({ type: 'skip' }); };

/* ======================= Who's Most Likely To ======================= */
const ML_IDEAS = ['fall asleep in a movie', 'reply "hmm" to a long message', 'eat the last slice', 'get lost even with Google Maps', 'become famous', 'cry at a movie', 'be late to their own wedding', 'forget a friend\'s birthday', 'win a lottery and lose the ticket', 'start a YouTube channel'];

// remembers what was on screen last time, so only new things animate and a screen's entrance plays once
const ml = { key: null, ready: [], wrote: {}, voted: [], qs: 0, vote: null, burst: 0, t: 0 };
const ML_CROWN = '<svg class="ml-crown" viewBox="0 0 20 14" aria-hidden="true"><path d="M1 4l4.5 4L10 1l4.5 7L19 4l-2 9H3z" fill="#ffc83d" stroke="#b77a00" stroke-width="1" stroke-linejoin="round"/></svg>';
const mlAv = (name, crown) => `<span class="ml-av">${avatar(name)}${crown ? ML_CROWN : ''}</span>`;

renderers.mostlikely = () => {
  const g = S.game;
  const n = g.players.length;
  const key = `${g.phase}:${g.number || 0}`;
  const fresh = key !== ml.key;
  if (fresh) { ml.key = key; ml.ready = []; ml.wrote = {}; ml.voted = []; ml.vote = null; ml.qs = (g.myQuestions || []).length; }
  const wrap = body => `<div class="ml${fresh ? ' ml-fresh' : ''}">${body}</div>`;

  if (g.phase === 'write') {
    const me = g.players.find(p => p.id === S.you);
    const justQ = !fresh && g.myQuestions.length > ml.qs;
    ml.qs = g.myQuestions.length;
    const mine = g.myQuestions.map((q, i) => `<li class="${justQ && i === g.myQuestions.length - 1 ? 'just' : ''}"><span>…${esc(q.text)}?</span><button class="btn btn-sm btn-ghost" data-game="mostlikely" data-unask="${q.id}" aria-label="Remove">${icon('x')}</button></li>`).join('');
    const pills = g.players.map(p => {
      const pop = !fresh && ((p.ready && !ml.ready.includes(p.id)) || p.wrote > (ml.wrote[p.id] || 0));
      return `<span class="pill ${p.ready ? 'ok' : ''} ${pop ? 'pop' : ''}">${p.ready ? icon('check') : icon('pen')} ${esc(p.name)} · ${p.wrote}</span>`;
    }).join('');
    ml.ready = g.players.filter(p => p.ready).map(p => p.id);
    ml.wrote = Object.fromEntries(g.players.map(p => [p.id, p.wrote]));
    return {
      tone: me.ready ? '' : 'mine',
      turn: me.ready ? 'Ready! Waiting for everyone else…' : 'Write questions about your group',
      body: wrap(`<form class="ml-form" data-ml-form>
          <label class="ml-prefix" for="mlInput">Who's most likely to…</label>
          <div class="join-row"><input id="mlInput" maxlength="120" autocomplete="off" placeholder="fall asleep in a movie"><button class="btn btn-primary" type="submit">Add</button></div>
        </form>
        <div class="chips">${ML_IDEAS.map((t, i) => `<button class="chip" style="--i:${i}" data-game="mostlikely" data-idea="${esc(t)}">${esc(t)}</button>`).join('')}</div>
        ${mine ? `<ul class="ml-mine">${mine}</ul>` : '<p class="hint">Your questions stay anonymous. Add up to 5.</p>'}
        <div class="actions sticky-actions">
          <button class="btn ${me.ready ? '' : 'btn-primary'} btn-lg" data-game="mostlikely" data-ready ${g.myQuestions.length ? '' : 'disabled'}>${me.ready ? 'Edit more' : `${icon('check')} I'm ready`}</button>
          ${isHost() ? `<button class="btn btn-lg" data-game="mostlikely" data-begin ${g.totalQuestions ? '' : 'disabled'}>Start voting (${g.totalQuestions})</button>` : ''}
        </div>
        <div class="pass-status">${pills}</div>`),
    };
  }

  const card = `<div class="question-card"><span class="ml-q q1" aria-hidden="true">?</span><span class="ml-q q2" aria-hidden="true">?</span><span class="ml-q q3" aria-hidden="true">?</span>
      <small>Question ${g.number} of ${g.of}</small><div>Who's most likely to <b>${esc(g.question)}</b>?</div></div>`;

  if (g.phase === 'vote') {
    const justVote = !fresh && g.myVote && g.myVote !== ml.vote;
    ml.vote = g.myVote;
    const grid = g.players.map((p, i) => `<button class="vote-card ${g.myVote === p.id ? 'on' : ''} ${justVote && g.myVote === p.id ? 'just' : ''}" style="--i:${i}" data-game="mostlikely" data-vote="${p.id}">
        ${avatar(p.name)}<span>${esc(p.name)}${p.id === S.you ? ' (you)' : ''}</span>${g.myVote === p.id ? icon('check') : ''}</button>`).join('');
    const pills = g.players.map(p => {
      const has = g.voted.includes(p.id);
      const pop = !fresh && has && !ml.voted.includes(p.id);
      return `<span class="pill ${has ? 'ok' : ''} ${pop ? 'pop' : ''}">${has ? icon('check') : '…'} ${esc(p.name)}</span>`;
    }).join('');
    ml.voted = [...g.voted];
    return {
      tone: g.myVote ? '' : 'mine',
      turn: g.myVote ? `Voted — ${g.voted.length} of ${n} in` : 'Vote! Nobody will see who you picked',
      body: wrap(`${card}
        <div class="vote-grid">${grid}</div>
        <div class="pass-status">${pills}</div>
        ${isHost() ? `<div class="actions"><button class="btn btn-sm btn-ghost" data-game="mostlikely" data-revealnow ${g.voted.length ? '' : 'disabled'}>Reveal now</button></div>` : ''}`),
    };
  }

  if (g.phase === 'reveal') {
    const r = g.result;
    const rows = g.players.map(p => ({ p, c: r.counts[p.id] || 0 })).sort((a, b) => b.c - a.c);
    const max = Math.max(1, ...rows.map(x => x.c));
    // bars fill from the fewest votes up, so the winner comes last; then the crown drops
    const base = 0.6, step = 0.35;
    const win = base + (rows.length - 1) * step + 0.85;
    const bars = rows.map(({ p, c }, i) => {
      const top = r.winners.includes(p.id);
      const d = base + (rows.length - 1 - i) * step;
      return `<div class="bar-row ${top ? 'top' : ''}" style="--d:${d.toFixed(2)}s;--win:${win.toFixed(2)}s">
        <span class="who">${mlAv(p.name, top)} <span class="ml-name">${esc(p.name)}</span></span>
        <span class="bar"><span style="width:${(c / max) * 100}%"></span></span>
        <span class="num">${c}</span></div>`;
    }).join('');
    const names = r.winners.map(nameOf).map(esc).join(' & ');
    if (fresh && r.winners.length) ml.burst = Math.round(win * 1000) + 150;
    return {
      tone: 'win',
      turn: !r.winners.length ? 'Nobody voted' : fresh ? 'And the group says…' : `${names} — most likely to ${esc(g.question)}!`,
      body: wrap(`${card}
        <div class="bars">${bars}</div>
        ${r.winners.length ? `<div class="ml-verdict" style="--win:${win.toFixed(2)}s">${icon('trophy')} ${names}!</div>` : ''}
        <div class="actions"><button class="btn btn-primary btn-lg" data-next>${g.number < g.of ? 'Next question' : 'See results'} ${icon('arrow')}</button></div>`),
    };
  }

  // over: everyone's titles
  const titles = g.players.map((p, i) => {
    const won = g.results.filter(r => r.winners.includes(p.id)).map(r => `most likely to ${esc(r.text)}`);
    return `<div class="title-card" style="--i:${i}">${mlAv(p.name, won.length > 0)}<div><b>${esc(p.name)}</b>${won.length ? `<ul>${won.map(t => `<li>${t}</li>`).join('')}</ul>` : '<div class="muted">Got away clean 😇</div>'}</div></div>`;
  }).join('');
  const mind = Object.fromEntries(g.players.map(p => [p.id, g.mind[p.id] || 0]));
  return {
    tone: 'win',
    turn: 'The verdict is in',
    body: wrap(`<div class="titles">${titles}</div>
      <h3 class="hand-title">Mind readers <span class="muted">· voted with the winner</span></h3>
      ${scoreboard(mind)}
      <div class="actions">${rematchBtn()}</div>`),
  };
};

// the confetti for the winner waits until their bar has filled and the crown has landed
afterRender.push(() => {
  if (!ml.burst) return;
  const wait = ml.burst;
  ml.burst = 0;
  clearTimeout(ml.t);
  ml.t = setTimeout(() => {
    const g = S.game;
    if (!g || g.gameId !== 'mostlikely' || g.phase !== 'reveal') return;
    const el = $('.bar-row.top .ml-av');
    if (el && typeof FX !== 'undefined') FX.burst(el, ['#ffc83d', '#ff2e93', '#38c6ff', '#ffffff']);
    if (window.SFX) SFX.play('reveal');
  }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : wait);
});

handlers.mostlikely = d => {
  if ('unask' in d) act({ type: 'unask', id: +d.unask });
  else if ('idea' in d) { const i = $('#mlInput'); i.value = d.idea; i.focus(); }
  else if ('ready' in d) act({ type: 'ready' });
  else if ('begin' in d) act({ type: 'begin' });
  else if ('vote' in d) act({ type: 'vote', targetId: d.vote });
  else if ('revealnow' in d) act({ type: 'revealNow' });
};
$('#stage').addEventListener('submit', e => {
  if (!e.target.matches('[data-ml-form]')) return;
  e.preventDefault();
  const input = $('#mlInput');
  const text = input.value.trim();
  if (!text) return;
  act({ type: 'ask', text });
  input.value = '';
  input.focus();
});

/* ======================= Draw & Guess ======================= */
const PC_W = 800, PC_H = 600;
const PC_COLORS = ['#111111', '#ffffff', '#7a7a7a', '#e53935', '#fb8c00', '#fdd835', '#43a047', '#00897b', '#1e88e5', '#3949ab', '#8e24aa', '#d81b60', '#6d4c41', '#f8bbd0'];
const PC_SIZES = [4, 10, 22];
const pc = {
  canvas: null, ctx: null, items: [], last: {}, key: null,
  color: '#111111', size: 4, tool: 'pen', drawing: null, buffer: [], flushTimer: null,
};

function pcInit() {
  if (pc.canvas) return;
  const c = document.createElement('canvas');
  c.width = PC_W; c.height = PC_H;
  c.className = 'draw-canvas';
  pc.canvas = c;
  pc.ctx = c.getContext('2d', { willReadFrequently: true });
  pcClear();
  c.addEventListener('pointerdown', pcDown);
  c.addEventListener('pointermove', pcMove);
  window.addEventListener('pointerup', pcUp);
  c.addEventListener('pointercancel', pcUp);
}

function pcClear() {
  pc.ctx.fillStyle = '#ffffff';
  pc.ctx.fillRect(0, 0, PC_W, PC_H);
  pc.last = {};
}

function pcSegment(item, fromLast) {
  const ctx = pc.ctx, p = item.p;
  ctx.strokeStyle = item.c;
  ctx.lineWidth = item.w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const prev = fromLast && pc.last[item.id];
  if (prev) ctx.moveTo(prev[0], prev[1]); else ctx.moveTo(p[0], p[1]);
  for (let i = 0; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
  if (p.length === 2 && !prev) ctx.lineTo(p[0] + 0.1, p[1] + 0.1); // a single tap draws a dot
  ctx.stroke();
  pc.last[item.id] = [p[p.length - 2], p[p.length - 1]];
}

function pcFill(x, y, color) {
  const img = pc.ctx.getImageData(0, 0, PC_W, PC_H), d = img.data;
  const at = (x, y) => (y * PC_W + x) * 4;
  const i0 = at(x, y);
  const target = [d[i0], d[i0 + 1], d[i0 + 2]];
  const rgb = [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)];
  const near = i => Math.abs(d[i] - target[0]) + Math.abs(d[i + 1] - target[1]) + Math.abs(d[i + 2] - target[2]) < 60;
  if (Math.abs(target[0] - rgb[0]) + Math.abs(target[1] - rgb[1]) + Math.abs(target[2] - rgb[2]) < 6) return;
  const stack = [[x, y]];
  const seen = new Uint8Array(PC_W * PC_H);
  while (stack.length) {
    const [sx, sy] = stack.pop();
    let lx = sx;
    while (lx > 0 && !seen[sy * PC_W + lx - 1] && near(at(lx - 1, sy))) lx--;
    let up = false, down = false;
    for (let cx = lx; cx < PC_W && !seen[sy * PC_W + cx] && near(at(cx, sy)); cx++) {
      const i = at(cx, sy);
      seen[sy * PC_W + cx] = 1;
      d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255;
      if (sy > 0) { const ok = !seen[(sy - 1) * PC_W + cx] && near(at(cx, sy - 1)); if (ok && !up) stack.push([cx, sy - 1]); up = ok; }
      if (sy < PC_H - 1) { const ok = !seen[(sy + 1) * PC_W + cx] && near(at(cx, sy + 1)); if (ok && !down) stack.push([cx, sy + 1]); down = ok; }
    }
  }
  pc.ctx.putImageData(img, 0, 0);
}

function pcApply(item) {
  if (item.t === 's') { pcSegment(item, true); pc.items.push(item); }
  else if (item.t === 'f') { pcFill(Math.min(PC_W - 1, Math.max(0, item.x)), Math.min(PC_H - 1, Math.max(0, item.y)), item.c); pc.items.push(item); }
  else if (item.t === 'u') { pc.items = pc.items.filter(it => it.id !== item.id); pcRedraw(); }
  else if (item.t === 'c') { pc.items = []; pcClear(); }
}

function pcRedraw() {
  pcClear();
  const items = pc.items;
  pc.items = [];
  for (const it of items) pcApply(it);
}

socket.on('stream', d => {
  if (!S || !S.game || S.game.gameId !== 'pictionary') return;
  pcInit();
  if (d.sync) { pc.items = []; pcClear(); for (const it of d.items) pcApply(it); return; }
  pcApply(d);
});

const canDraw = () => S && S.game && S.game.gameId === 'pictionary' && S.game.isDrawer && S.game.phase === 'draw';
const pcPoint = e => {
  const r = pc.canvas.getBoundingClientRect();
  return [Math.round(((e.clientX - r.left) / r.width) * PC_W), Math.round(((e.clientY - r.top) / r.height) * PC_H)];
};
const newId = () => Math.random().toString(36).slice(2, 10);

function pcDown(e) {
  if (!canDraw()) return;
  e.preventDefault();
  pc.canvas.setPointerCapture(e.pointerId);
  const [x, y] = pcPoint(e);
  if (pc.tool === 'fill') {
    const item = { t: 'f', id: newId(), c: pc.color, x, y };
    pcApply(item);
    socket.emit('stream', item);
    return;
  }
  pc.drawing = { id: newId(), c: pc.tool === 'eraser' ? '#ffffff' : pc.color, w: pc.tool === 'eraser' ? Math.max(18, pc.size * 2) : pc.size };
  pc.buffer = [x, y];
  pcFlush();
  pc.flushTimer = setInterval(pcFlush, 45);
}
function pcMove(e) {
  if (!pc.drawing) return;
  const [x, y] = pcPoint(e);
  pc.buffer.push(x, y);
}
function pcUp() {
  if (!pc.drawing) return;
  pcFlush();
  clearInterval(pc.flushTimer);
  pc.drawing = null;
}
function pcFlush() {
  if (!pc.drawing || !pc.buffer.length) return;
  const item = { t: 's', id: pc.drawing.id, c: pc.drawing.c, w: pc.drawing.w, p: pc.buffer };
  pcApply(item);
  socket.emit('stream', item);
  pc.buffer = [];
}

// keep one canvas element alive across re-renders so the drawing isn't lost
afterRender.push(() => {
  const slot = document.getElementById('drawSlot');
  if (!slot) return;
  pcInit();
  const g = S.game;
  const key = `${g.round}:${g.drawerId}`;
  if (key !== pc.key) { pc.key = key; pc.items = []; pcClear(); }
  slot.appendChild(pc.canvas);
  pc.canvas.classList.toggle('can-draw', canDraw());
});

function drawTools() {
  return `<div class="draw-tools">
    <div class="swatches">${PC_COLORS.map(c => `<button class="swatch ${pc.color === c && pc.tool !== 'eraser' ? 'on' : ''}" style="--sw:${c}" data-game="pictionary" data-color="${c}" aria-label="Colour ${c}"></button>`).join('')}</div>
    <div class="tool-row">
      ${PC_SIZES.map(s => `<button class="tool size ${pc.size === s ? 'on' : ''}" data-game="pictionary" data-size="${s}" aria-label="Brush ${s}"><span style="width:${Math.min(22, s + 2)}px;height:${Math.min(22, s + 2)}px"></span></button>`).join('')}
      <button class="tool ${pc.tool === 'pen' ? 'on' : ''}" data-game="pictionary" data-tool="pen" aria-label="Pen">${icon('pen')}</button>
      <button class="tool ${pc.tool === 'fill' ? 'on' : ''}" data-game="pictionary" data-tool="fill" aria-label="Fill"><svg class="icon" viewBox="0 0 24 24"><path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/><path d="m5 2 5 5"/><path d="M2 13h15"/><path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/></svg></button>
      <button class="tool ${pc.tool === 'eraser' ? 'on' : ''}" data-game="pictionary" data-tool="eraser" aria-label="Eraser">${icon('eraser')}</button>
      <button class="tool" data-game="pictionary" data-undo aria-label="Undo">${icon('rotate')}</button>
      <button class="tool" data-game="pictionary" data-clear aria-label="Clear">${icon('x')}</button>
    </div>
  </div>`;
}

const LEVEL_LABEL = { easy: 'Easy words', medium: 'Medium words', hard: 'Hard words' };
const THEME_LABEL = { Movie: 'All movies', Food: 'All food', Thing: 'All things', Animal: 'All animals' };
const levelTag = g => `<div class="level-tag ${g.level}"><span>${LEVEL_LABEL[g.level]}</span>${g.roundTheme ? `<span>${THEME_LABEL[g.roundTheme]}</span>` : ''}</div>`;

renderers.pictionary = () => {
  const g = S.game;
  const drawerName = esc(nameOf(g.drawerId));
  const board = Object.keys(g.scores).sort((a, b) => g.scores[b] - g.scores[a]).map((id, i) => `<li class="${id === S.you ? 'me' : ''}">
      <span class="rank">${i + 1}</span>${avatar(nameOf(id))}<span class="pname">${esc(nameOf(id))}</span>
      ${id === g.drawerId && g.phase !== 'over' ? `<span class="badge-draw">${icon('pen')}</span>` : ''}${g.solvers.includes(id) ? `<span class="plus">${icon('check')}</span>` : ''}
      <span class="pts">${g.scores[id]}</span></li>`).join('');

  if (g.phase === 'over') {
    const best = Math.max(...Object.values(g.scores));
    const champs = Object.keys(g.scores).filter(id => g.scores[id] === best);
    return {
      tone: 'win',
      turn: 'Game over — what masterpieces!',
      body: `${resultBanner(`${champs.map(nameOf).map(esc).join(' & ')} win${champs.length > 1 ? '' : 's'} with ${best}`)}${scoreboard(g.scores)}<div class="actions">${rematchBtn()}</div>`,
    };
  }

  if (g.phase === 'choose') {
    return {
      tone: g.isDrawer ? 'mine' : '',
      turn: g.isDrawer ? 'Choose a word to draw' : `${drawerName} is choosing a word…`,
      body: g.isDrawer
        ? `${levelTag(g)}<div class="word-choices">${g.choices.map((c, i) => `<button class="word-choice" data-game="pictionary" data-choose="${i}"><small>${esc(c.cat)}</small>${esc(c.word)}</button>`).join('')}</div>
           <p class="hint">Auto-picks in ${secsLeft(g.timerAt)}s</p>`
        : `${levelTag(g)}<div class="waiting-art">${icon('pen')}<div>${drawerName} is picking from 4 words</div><div class="muted">${secsLeft(g.timerAt)}s</div></div>
           <ol class="pc-board">${board}</ol>`,
    };
  }

  const reveal = g.phase === 'reveal';
  let wordLine;
  if (reveal) wordLine = `The word was <b>${esc(g.word)}</b>`;
  else if (g.isDrawer) wordLine = `Draw: <b>${esc(g.word)}</b> <span class="cat">${esc(g.cat)}</span>`;
  else if (g.solved) wordLine = `You got it: <b>${esc(g.word)}</b>`;
  else wordLine = `<span class="mask">${esc(g.mask).replace(/ /g, '&nbsp;&nbsp;')}</span> <span class="cat">${esc(g.cat)} · ${g.mask.replace(/[^_A-Za-z0-9]/g, '').length} letters</span>`;

  let turn, tone = '';
  if (reveal) { turn = `Round ${g.round} — next drawer coming up`; tone = 'win'; }
  else if (g.isDrawer) { turn = 'Your turn to draw!'; tone = 'mine'; }
  else if (g.solved) turn = 'Nice! Chat with others who got it';
  else { turn = `${drawerName} is drawing — guess the word!`; tone = 'mine'; }

  return {
    tone,
    turn,
    body: `${levelTag(g)}<div class="pc-word">${wordLine}${!reveal ? `<span class="secs-pill">${secsLeft(g.endsAt)}s</span>` : ''}</div>
      ${!reveal ? timeBar(g.endsAt, g.totalMs) : ''}
      <div class="pc-layout">
        <div class="pc-left">
          <div id="drawSlot" class="draw-slot"></div>
          ${g.isDrawer && !reveal ? drawTools() : ''}
        </div>
        <div class="pc-right">
          ${!g.isDrawer && !reveal ? guessForm(g.solved ? 'Chat with players who know…' : 'Type your guess…', g.solved ? 'Send' : 'Guess') : ''}
          ${g.isDrawer && !reveal ? guessForm('Chat (only players who guessed see it)…', 'Send') : ''}
          ${feedHtml(g.feed.slice(-8))}
          <ol class="pc-board">${board}</ol>
          ${(isHost() || g.isDrawer) && !reveal ? '<div class="actions"><button class="btn btn-sm btn-ghost" data-game="pictionary" data-skip>Skip turn</button></div>' : ''}
        </div>
      </div>`,
  };
};

handlers.pictionary = d => {
  if ('choose' in d) act({ type: 'choose', index: +d.choose });
  else if ('color' in d) { pc.color = d.color; if (pc.tool === 'eraser') pc.tool = 'pen'; render(); }
  else if ('size' in d) { pc.size = +d.size; render(); }
  else if ('tool' in d) { pc.tool = d.tool; render(); }
  else if ('undo' in d) {
    const last = pc.items.length ? pc.items[pc.items.length - 1].id : null;
    if (last) { pcApply({ t: 'u', id: last }); socket.emit('stream', { t: 'u' }); }
  } else if ('clear' in d) { pcApply({ t: 'c' }); socket.emit('stream', { t: 'c' }); }
  else if ('skip' in d) act({ type: 'skip' });
};
socket.on('connect', () => { pc.key = null; });

/* ======================= Imposter ======================= */
// remembers the last screen so a screen's entrance plays once and only new clues, votes and ticks animate
const ip = { key: null, clues: 0, voted: [], seen: [], vote: null, play: false, focus: null, t: 0 };
const ipName = (g, id) => (g.players.find(p => p.id === id) || {}).name || '?';
const ipTime = g => (g.endsAt ? timeBar(g.endsAt, g.totalMs) : '');
const ipMine = g => (g.myWord ? `<span class="ip-mine">Your word: <b>${esc(g.myWord)}</b></span>` : '');

function ipBoard(g, justIdx) {
  return `<div class="ip-board">${g.order.map((id, i) => {
    const bubbles = g.clues.map((c, k) => ({ c, k })).filter(x => x.c.id === id).map(({ c, k }) => (c.skipped
      ? `<span class="ip-bubble skipped ${k === justIdx ? 'just' : ''}">no clue</span>`
      : `<span class="ip-bubble ${k === justIdx ? 'just' : ''}">${esc(c.text)}</span>`)).join('');
    const speaking = g.turnId === id;
    return `<div class="ip-row ${speaking ? 'speaking' : ''}" style="--i:${i}">
      <span class="ip-who">${avatar(ipName(g, id))}<span class="ip-pn">${esc(ipName(g, id))}${id === S.you ? ' (you)' : ''}</span></span>
      <span class="ip-bubbles">${bubbles}${speaking ? '<span class="ip-typing" aria-label="thinking"><i></i><i></i><i></i></span>' : ''}</span></div>`;
  }).join('')}</div>`;
}

const ipPills = (g, done, last, fresh) => g.players.map(p => {
  const has = done.includes(p.id);
  const pop = !fresh && has && !last.includes(p.id);
  return `<span class="pill ${has ? 'ok' : ''} ${pop ? 'pop' : ''}">${has ? icon('check') : '…'} ${esc(p.name)}</span>`;
}).join('');

renderers.imposter = () => {
  const g = S.game;
  const key = `${g.round}:${g.phase}`;
  const fresh = key !== ip.key;
  if (fresh) { ip.key = key; ip.clues = g.clues.length; ip.voted = []; ip.seen = []; ip.vote = null; }
  const wrap = body => `<div class="ip${fresh ? ' ip-fresh' : ''}">${body}</div>`;
  const roundTag = `<span class="pill">Round ${g.round} of ${g.rounds}</span>`;

  if (g.phase === 'word') {
    const seen = g.seen.includes(S.you);
    const pills = ipPills(g, g.seen, ip.seen, fresh);
    ip.seen = [...g.seen];
    return {
      tone: seen ? '' : 'mine',
      turn: seen ? 'Waiting for everyone to read their word…' : 'Look at your secret word',
      body: wrap(`<div class="ip-top">${roundTag}</div>
        <div class="ip-card-wrap"><div class="ip-card">
          <div class="ip-face ip-back" aria-hidden="true">?</div>
          <div class="ip-face ip-front"><small>Your secret word</small><b>${esc(g.myWord)}</b></div>
        </div></div>
        <p class="hint ip-hint">Everyone has this word except one player, who has a similar one and doesn't know it. It could be you!</p>
        ${ipTime(g)}
        <div class="actions">${seen ? '<span class="muted">Got it. Waiting for the others…</span>' : `<button class="btn btn-primary btn-lg" data-game="imposter" data-seen>${icon('check')} Got it</button>`}</div>
        <div class="pass-status">${pills}</div>`),
    };
  }

  if (g.phase === 'clue') {
    const justIdx = !fresh && g.clues.length > ip.clues ? g.clues.length - 1 : -1;
    ip.clues = g.clues.length;
    const mine = g.turnId === S.you;
    const typed = mine && $('#ipInput') ? $('#ipInput').value : '';
    const lap = g.clueRounds > 1 ? `<span class="pill">Clues ${g.lap} of ${g.clueRounds}</span>` : '';
    return {
      tone: mine ? 'mine' : '',
      turn: mine ? 'Your turn! Give a one-word clue' : `${esc(ipName(g, g.turnId))} is thinking of a clue…`,
      body: wrap(`<div class="ip-top">${ipMine(g)}<span class="ip-tags">${lap}${roundTag}</span></div>
        ${ipBoard(g, justIdx)}
        ${mine ? `<form class="ip-form" data-ip-form><div class="join-row"><input id="ipInput" maxlength="24" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="One word about your word" aria-label="Your clue" value="${esc(typed)}"><button class="btn btn-primary" type="submit">Send</button></div></form>` : ''}
        ${ipTime(g)}`),
    };
  }

  if (g.phase === 'vote') {
    const justVote = !fresh && g.myVote && g.myVote !== ip.vote;
    ip.vote = g.myVote;
    const cards = g.players.map((p, i) => {
      const me = p.id === S.you;
      const clues = g.clues.filter(c => c.id === p.id).map(c => `<span class="ip-chip ${c.skipped ? 'skipped' : ''}">${c.skipped ? 'no clue' : esc(c.text)}</span>`).join('');
      return `<button class="vote-card ip-v ${g.myVote === p.id ? 'on' : ''} ${justVote && g.myVote === p.id ? 'just' : ''}" style="--i:${i}" data-game="imposter" data-vote="${p.id}" ${me ? 'disabled' : ''}>
        ${avatar(p.name)}<span>${esc(p.name)}${me ? ' (you)' : ''}</span>${g.myVote === p.id ? icon('check') : ''}<span class="ip-vclues">${clues}</span></button>`;
    }).join('');
    const pills = ipPills(g, g.voted, ip.voted, fresh);
    ip.voted = [...g.voted];
    return {
      tone: g.myVote ? '' : 'mine',
      turn: g.myVote ? `Voted — ${g.voted.length} of ${g.players.length} in` : 'Who has the different word? Vote!',
      body: wrap(`<div class="ip-top">${ipMine(g)}${roundTag}</div>
        <h3 class="ip-title">Who's the imposter?</h3>
        <div class="vote-grid">${cards}</div>
        ${ipTime(g)}
        <div class="pass-status">${pills}</div>
        ${isHost() ? `<div class="actions"><button class="btn btn-sm btn-ghost" data-game="imposter" data-revealnow ${g.voted.length ? '' : 'disabled'}>Reveal now</button></div>` : ''}`),
    };
  }

  if (g.phase === 'reveal') {
    const r = g.result;
    const play = fresh && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (play) ip.play = true;
    const imp = esc(ipName(g, r.imposterId));
    const cards = g.players.map(p => {
      const isImp = p.id === r.imposterId;
      const n = r.counts[p.id] || 0;
      return `<div class="ip-pcard ${isImp ? 'imp' : ''}" data-imp="${isImp ? 1 : 0}">
        ${isImp ? '<span class="ip-stamp">IMPOSTER</span>' : ''}${avatar(p.name)}<b>${esc(p.name)}</b><span class="ip-count">${n} vote${n === 1 ? '' : 's'}</span></div>`;
    }).join('');
    const pts = Object.entries(r.points).map(([id, v]) => `<span class="pill ok">+${v} ${esc(ipName(g, id))}</span>`).join('');
    return {
      tone: play ? '' : r.caught ? 'win' : 'alert',
      turn: play ? 'The imposter was…' : r.caught ? `${imp} was the imposter — caught!` : `${imp} was the imposter and got away!`,
      body: wrap(`<div class="ip-reveal ${play ? '' : 'shown'}">
          <h3 class="ip-title">The imposter was…</h3>
          <div class="ip-pgrid">${cards}</div>
          <div class="ip-words ip-after" style="--k:0">
            <div class="ip-word civ"><small>Everyone's word</small><b>${esc(r.civilWord)}</b></div>
            <div class="ip-word odd"><small>${imp}'s word</small><b>${esc(r.oddWord)}</b></div>
          </div>
          <div class="ip-verdict ip-after ${r.caught ? 'caught' : 'escaped'}" style="--k:1">${r.caught ? `${icon('check')} Caught!` : 'The imposter escaped!'}</div>
          ${pts ? `<div class="ip-points ip-after" style="--k:2">${pts}</div>` : ''}
        </div>
        <div class="actions">${isHost() ? `<button class="btn btn-primary btn-lg" data-next>${g.round < g.rounds ? 'Next round' : 'See results'} ${icon('arrow')}</button>` : `<span class="muted">${esc(nameOf(S.room.hostId))} starts the next round</span>`}</div>`),
    };
  }

  return {
    tone: 'win',
    turn: 'Game over!',
    body: wrap(`<h3 class="ip-title">Final scores</h3>${scoreboard(g.scores)}<div class="actions">${rematchBtn()}</div>`),
  };
};

handlers.imposter = d => {
  if ('seen' in d) act({ type: 'seen' });
  else if ('vote' in d) act({ type: 'vote', targetId: d.vote });
  else if ('revealnow' in d) act({ type: 'revealNow' });
};
$('#stage').addEventListener('submit', e => {
  if (!e.target.matches('[data-ip-form]')) return;
  e.preventDefault();
  const text = $('#ipInput').value.trim();
  if (text) act({ type: 'clue', text });
});

// the reveal: a spotlight runs across the players, slows down and stops on the imposter
function ipRunReveal(caught) {
  const box = $('.ip-reveal');
  const cards = box ? [...box.querySelectorAll('.ip-pcard')] : [];
  if (!cards.length) return;
  const target = cards.findIndex(c => c.dataset.imp === '1');
  const loops = cards.length <= 4 ? 2 : 1;
  const steps = loops * cards.length + target + 1;
  let i = 0;
  clearTimeout(ip.t);
  const tick = () => {
    if (!document.body.contains(box)) return;
    cards.forEach(c => c.classList.remove('lit'));
    cards[i % cards.length].classList.add('lit');
    i++;
    if (i < steps) { ip.t = setTimeout(tick, 70 + 300 * (i / steps) ** 2); return; }
    ip.t = setTimeout(() => {
      if (!document.body.contains(box)) return;
      cards.forEach(c => c.classList.remove('lit'));
      box.classList.add('shown', 'ip-anim');
      if (typeof FX !== 'undefined') {
        if (caught) FX.burst(cards[target], ['#2fe07f', '#ffc83d', '#ffffff']);
        else FX.shake();
      }
      if (window.SFX) SFX.play(caught ? 'correct' : 'fail');
      // once the words and points have landed, redraw so the bar at the top shows the result
      ip.t = setTimeout(() => { const g = S.game; if (g && g.gameId === 'imposter' && g.phase === 'reveal') render(); }, 1800);
    }, 500);
  };
  tick();
}

afterRender.push(() => {
  const g = S.game;
  if (!g || g.gameId !== 'imposter') return;
  if (g.phase === 'clue' && g.turnId === S.you) {
    const k = `${g.round}:${g.clues.length}`;
    if (ip.focus !== k) { ip.focus = k; const i = $('#ipInput'); if (i) i.focus(); }
  }
  if (ip.play) { ip.play = false; ipRunReveal(g.result.caught); }
});
