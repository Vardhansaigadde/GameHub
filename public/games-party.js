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
  return {
    tone: reveal ? 'win' : g.solved ? '' : 'mine',
    turn,
    body: `<div class="emoji-card ${reveal ? 'revealed' : ''}">
        <div class="emoji-clue" aria-label="Emoji clue">${g.emoji}</div>
        ${reveal || g.solved ? `<div class="emoji-answer">${esc(g.answer)}</div>` : `<div class="hint-mask">${esc(g.hint)}</div>`}
      </div>
      ${g.phase === 'clue' ? timeBar(g.endsAt, 35000) : ''}
      ${g.phase === 'clue' && !g.solved ? guessForm('Type the movie name…') : ''}
      ${feedHtml(g.feed)}
      ${scoreboard(g.scores, { extra: { title: 'This movie', value: id => (g.solvers.includes(id) ? `<span class="plus">${icon('check')}</span>` : '') } })}
      ${isHost() && g.phase === 'clue' ? '<div class="actions"><button class="btn btn-sm btn-ghost" data-game="emojimovie" data-skip>Reveal now</button></div>' : ''}
      <p class="hint">Small spelling mistakes are fine. A hint appears halfway through.</p>`,
  };
};
handlers.emojimovie = d => { if ('skip' in d) act({ type: 'skip' }); };

/* ======================= Who's Most Likely To ======================= */
const ML_IDEAS = ['fall asleep in a movie', 'reply "hmm" to a long message', 'eat the last slice', 'get lost even with Google Maps', 'become famous', 'cry at a movie', 'be late to their own wedding', 'forget a friend\'s birthday', 'win a lottery and lose the ticket', 'start a YouTube channel'];

renderers.mostlikely = () => {
  const g = S.game;
  const n = g.players.length;

  if (g.phase === 'write') {
    const me = g.players.find(p => p.id === S.you);
    const mine = g.myQuestions.map(q => `<li><span>…${esc(q.text)}?</span><button class="btn btn-sm btn-ghost" data-game="mostlikely" data-unask="${q.id}" aria-label="Remove">${icon('x')}</button></li>`).join('');
    const pills = g.players.map(p => `<span class="pill ${p.ready ? 'ok' : ''}">${p.ready ? icon('check') : icon('pen')} ${esc(p.name)} · ${p.wrote}</span>`).join('');
    return {
      tone: me.ready ? '' : 'mine',
      turn: me.ready ? 'Ready! Waiting for everyone else…' : 'Write questions about your group',
      body: `<form class="ml-form" data-ml-form>
          <label class="ml-prefix" for="mlInput">Who's most likely to…</label>
          <div class="join-row"><input id="mlInput" maxlength="120" autocomplete="off" placeholder="fall asleep in a movie"><button class="btn btn-primary" type="submit">Add</button></div>
        </form>
        <div class="chips">${ML_IDEAS.map(t => `<button class="chip" data-game="mostlikely" data-idea="${esc(t)}">${esc(t)}</button>`).join('')}</div>
        ${mine ? `<ul class="ml-mine">${mine}</ul>` : '<p class="hint">Your questions stay anonymous. Add up to 5.</p>'}
        <div class="actions sticky-actions">
          <button class="btn ${me.ready ? '' : 'btn-primary'} btn-lg" data-game="mostlikely" data-ready ${g.myQuestions.length ? '' : 'disabled'}>${me.ready ? 'Edit more' : `${icon('check')} I'm ready`}</button>
          ${isHost() ? `<button class="btn btn-lg" data-game="mostlikely" data-begin ${g.totalQuestions ? '' : 'disabled'}>Start voting (${g.totalQuestions})</button>` : ''}
        </div>
        <div class="pass-status">${pills}</div>`,
    };
  }

  if (g.phase === 'vote') {
    const grid = g.players.map(p => `<button class="vote-card ${g.myVote === p.id ? 'on' : ''}" data-game="mostlikely" data-vote="${p.id}">
        ${avatar(p.name)}<span>${esc(p.name)}${p.id === S.you ? ' (you)' : ''}</span>${g.myVote === p.id ? icon('check') : ''}</button>`).join('');
    return {
      tone: g.myVote ? '' : 'mine',
      turn: g.myVote ? `Voted — ${g.voted.length} of ${n} in` : 'Vote! Nobody will see who you picked',
      body: `<div class="question-card"><small>Question ${g.number} of ${g.of}</small><div>Who's most likely to <b>${esc(g.question)}</b>?</div></div>
        <div class="vote-grid">${grid}</div>
        <div class="pass-status">${g.players.map(p => `<span class="pill ${g.voted.includes(p.id) ? 'ok' : ''}">${g.voted.includes(p.id) ? icon('check') : '…'} ${esc(p.name)}</span>`).join('')}</div>
        ${isHost() ? `<div class="actions"><button class="btn btn-sm btn-ghost" data-game="mostlikely" data-revealnow ${g.voted.length ? '' : 'disabled'}>Reveal now</button></div>` : ''}`,
    };
  }

  if (g.phase === 'reveal') {
    const r = g.result;
    const rows = g.players.map(p => ({ p, c: r.counts[p.id] || 0 })).sort((a, b) => b.c - a.c);
    const max = Math.max(1, ...rows.map(x => x.c));
    const bars = rows.map(({ p, c }) => `<div class="bar-row ${r.winners.includes(p.id) ? 'top' : ''}">
        <span class="who">${avatar(p.name)} ${esc(p.name)}</span>
        <span class="bar"><span style="width:${(c / max) * 100}%"></span></span>
        <span class="num">${c}</span></div>`).join('');
    return {
      tone: 'win',
      turn: r.winners.length ? `${r.winners.map(nameOf).map(esc).join(' & ')} — most likely to ${esc(g.question)}!` : 'Nobody voted',
      body: `<div class="question-card"><small>Question ${g.number} of ${g.of}</small><div>Who's most likely to <b>${esc(g.question)}</b>?</div></div>
        <div class="bars">${bars}</div>
        <div class="actions"><button class="btn btn-primary btn-lg" data-next>${g.number < g.of ? 'Next question' : 'See results'} ${icon('arrow')}</button></div>`,
    };
  }

  // over: everyone's titles
  const titles = g.players.map(p => {
    const won = g.results.filter(r => r.winners.includes(p.id)).map(r => `most likely to ${esc(r.text)}`);
    return `<div class="title-card">${avatar(p.name)}<div><b>${esc(p.name)}</b>${won.length ? `<ul>${won.map(t => `<li>${t}</li>`).join('')}</ul>` : '<div class="muted">Got away clean 😇</div>'}</div></div>`;
  }).join('');
  const mind = Object.fromEntries(g.players.map(p => [p.id, g.mind[p.id] || 0]));
  return {
    tone: 'win',
    turn: 'The verdict is in',
    body: `<div class="titles">${titles}</div>
      <h3 class="hand-title">Mind readers <span class="muted">· voted with the winner</span></h3>
      ${scoreboard(mind)}
      <div class="actions">${rematchBtn()}</div>`,
  };
};

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
        ? `<div class="word-choices">${g.choices.map((c, i) => `<button class="word-choice" data-game="pictionary" data-choose="${i}"><small>${esc(c.cat)}</small>${esc(c.word)}</button>`).join('')}</div>
           <p class="hint">Auto-picks in ${secsLeft(g.timerAt)}s</p>`
        : `<div class="waiting-art">${icon('pen')}<div>${drawerName} is picking from 4 words</div><div class="muted">${secsLeft(g.timerAt)}s</div></div>
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
    body: `<div class="pc-word">${wordLine}${!reveal ? `<span class="secs-pill">${secsLeft(g.endsAt)}s</span>` : ''}</div>
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
