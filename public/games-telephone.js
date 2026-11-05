/* Doodle Telephone: write, draw, describe, draw... then laugh at the reveal. */
const TP_W = 640, TP_H = 480;
const TP_COLORS = ['#111111', '#ffffff', '#8a8a8a', '#e53935', '#fb8c00', '#fdd835', '#43a047', '#00acc1', '#1e88e5', '#5e35b1', '#d81b60', '#6d4c41'];
const TP_SIZES = [4, 10, 22];
const TP_IDEAS = [
  'A buffalo stuck in traffic honking at an auto',
  'My uncle explaining cricket to a confused alien',
  'A dosa flying over Charminar like a superhero',
  'A ghost who is scared of mosquitoes',
  'Hero fighting ten villains while holding a biryani plate',
  'A cow giving a very serious job interview',
  'Grandmother winning a motorcycle race',
  'A cat teaching maths to sleepy students',
  'Two mangoes getting married at a beach',
  'A monkey stealing a selfie stick at a temple',
  'A shark waiting at a bus stop with an umbrella',
  'The moon eating a giant samosa',
  'A wedding where the groom is a giant chicken',
  'A policeman chasing a runaway idli',
  'An elephant trying to hide behind a coconut tree',
  'A king who is afraid of his own crown',
  'A robot crying during the movie climax',
  'A dog driving a school bus very carefully',
];

const tp = {
  roundKey: null, autoSent: null, lastStep: null, images: {}, loading: {},
  canvas: null, ctx: null, color: '#111111', size: 4, tool: 'pen', history: [], drawing: false, last: null,
};

/* ---------- the sketchpad (lives across re-renders so a drawing is never lost) ---------- */
function tpCanvasInit() {
  if (tp.canvas) return;
  const c = document.createElement('canvas');
  c.width = TP_W;
  c.height = TP_H;
  c.className = 'draw-canvas tp-canvas can-draw';
  tp.canvas = c;
  tp.ctx = c.getContext('2d', { willReadFrequently: true });
  tpClear();
  const point = e => {
    const r = c.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / r.width) * TP_W), Math.round(((e.clientY - r.top) / r.height) * TP_H)];
  };
  const canDrawNow = () => {
    const g = S && S.game;
    if (!g || g.myDone) return false;
    return (g.gameId === 'telephone' && g.kind === 'draw') || (g.gameId === 'showdown' && g.phase === 'draw');
  };
  c.addEventListener('pointerdown', e => {
    if (!canDrawNow()) return;
    e.preventDefault();
    c.setPointerCapture(e.pointerId);
    tpSnapshot();
    const [x, y] = point(e);
    if (tp.tool === 'fill') { tpFill(x, y, tp.color); return; }
    tp.drawing = true;
    tp.last = [x, y];
    tpLine(x, y, x + 0.1, y + 0.1);
  });
  c.addEventListener('pointermove', e => {
    if (!tp.drawing) return;
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of events.length ? events : [e]) {
      const [x, y] = point(ev);
      tpLine(tp.last[0], tp.last[1], x, y);
      tp.last = [x, y];
    }
  });
  const stop = () => { tp.drawing = false; };
  c.addEventListener('pointerup', stop);
  c.addEventListener('pointercancel', stop);
}
function tpClear() {
  tp.ctx.fillStyle = '#fff';
  tp.ctx.fillRect(0, 0, TP_W, TP_H);
}
function tpSnapshot() {
  tp.history.push(tp.ctx.getImageData(0, 0, TP_W, TP_H));
  if (tp.history.length > 12) tp.history.shift();
}
function tpLine(x1, y1, x2, y2) {
  const ctx = tp.ctx;
  ctx.strokeStyle = tp.tool === 'eraser' ? '#ffffff' : tp.color;
  ctx.lineWidth = tp.tool === 'eraser' ? Math.max(18, tp.size * 2) : tp.size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
function tpFill(x, y, color) {
  const img = tp.ctx.getImageData(0, 0, TP_W, TP_H), d = img.data;
  const at = (px, py) => (py * TP_W + px) * 4;
  const i0 = at(x, y);
  const t = [d[i0], d[i0 + 1], d[i0 + 2]];
  const rgb = [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)];
  if (Math.abs(t[0] - rgb[0]) + Math.abs(t[1] - rgb[1]) + Math.abs(t[2] - rgb[2]) < 6) return;
  const near = i => Math.abs(d[i] - t[0]) + Math.abs(d[i + 1] - t[1]) + Math.abs(d[i + 2] - t[2]) < 90;
  const seen = new Uint8Array(TP_W * TP_H);
  const stack = [[x, y]];
  while (stack.length) {
    const [sx, sy] = stack.pop();
    let lx = sx;
    while (lx > 0 && !seen[sy * TP_W + lx - 1] && near(at(lx - 1, sy))) lx--;
    let up = false, down = false;
    for (let cx = lx; cx < TP_W && !seen[sy * TP_W + cx] && near(at(cx, sy)); cx++) {
      const i = at(cx, sy);
      seen[sy * TP_W + cx] = 1;
      d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255;
      if (sy > 0) { const ok = !seen[(sy - 1) * TP_W + cx] && near(at(cx, sy - 1)); if (ok && !up) stack.push([cx, sy - 1]); up = ok; }
      if (sy < TP_H - 1) { const ok = !seen[(sy + 1) * TP_W + cx] && near(at(cx, sy + 1)); if (ok && !down) stack.push([cx, sy + 1]); down = ok; }
    }
  }
  tp.ctx.putImageData(img, 0, 0);
}
const tpImage = () => tp.canvas.toDataURL('image/jpeg', 0.72);

/* ---------- pieces of the screen ---------- */
function tpSteps(g) {
  const labels = { write: 'Write', draw: 'Draw', describe: 'Describe' };
  const dots = [];
  for (let i = 0; i < g.steps; i++) {
    const kind = i === 0 ? 'write' : i % 2 === 1 ? 'draw' : 'describe';
    dots.push(`<span class="tp-dot ${i < g.round ? 'done' : i === g.round ? 'now' : ''}" title="${labels[kind]}">${i < g.round ? icon('check') : i + 1}</span>`);
  }
  return `<div class="tp-steps" aria-label="Step ${g.stepNumber} of ${g.steps}">${dots.join('<i class="tp-link"></i>')}</div>`;
}

function tpImageTag(chain, step, empty) {
  if (empty) return '<div class="tp-blank">Nothing was drawn in time!</div>';
  return `<img class="tp-img" data-tpimg="${chain}:${step}" alt="A player's drawing">`;
}

function tpTools() {
  return `<div class="draw-tools tp-tools">
    <div class="swatches">${TP_COLORS.map(c => `<button class="swatch ${tp.color === c && tp.tool !== 'eraser' ? 'on' : ''}" style="--sw:${c}" data-game="telephone" data-color="${c}" aria-label="Colour ${c}"></button>`).join('')}</div>
    <div class="tool-row">
      ${TP_SIZES.map(s => `<button class="tool size ${tp.size === s ? 'on' : ''}" data-game="telephone" data-size="${s}" aria-label="Brush size ${s}"><span style="width:${Math.min(22, s + 2)}px;height:${Math.min(22, s + 2)}px"></span></button>`).join('')}
      <span class="tool-gap"></span>
      <button class="tool ${tp.tool === 'pen' ? 'on' : ''}" data-game="telephone" data-tool="pen" aria-label="Pen" title="Pen">${icon('pen')}</button>
      <button class="tool ${tp.tool === 'fill' ? 'on' : ''}" data-game="telephone" data-tool="fill" aria-label="Fill" title="Fill"><svg class="icon" viewBox="0 0 24 24"><path d="m19 11-8-8-8.600 8.600a2 2 0 0 0 0 2.800l5.200 5.200c.8.8 2 .8 2.800 0L19 11Z"/><path d="m5 2 5 5"/><path d="M2 13h15"/><path d="M22 20a2 2 0 1 1-4 0c0-1.600 1.700-2.400 2-4 .3 1.600 2 2.400 2 4Z"/></svg></button>
      <button class="tool ${tp.tool === 'eraser' ? 'on' : ''}" data-game="telephone" data-tool="eraser" aria-label="Eraser" title="Eraser">${icon('eraser')}</button>
      <span class="tool-gap"></span>
      <button class="tool" data-game="telephone" data-undo aria-label="Undo" title="Undo">${icon('rotate')}</button>
      <button class="tool" data-game="telephone" data-wipe aria-label="Clear the drawing" title="Clear">${icon('x')}</button>
    </div>
  </div>`;
}

function tpWaiting(g) {
  const chips = g.players.map(p => `<span class="pill ${g.doneIds.includes(p.id) ? 'ok' : ''}">${g.doneIds.includes(p.id) ? icon('check') : icon('pen')} ${esc(p.name)}</span>`).join('');
  return `<div class="pass-status">${chips}</div>`;
}

function tpRound(g) {
  const header = `${tpSteps(g)}
    <div class="timebar"><span data-deadline="${g.endsAt}" data-total="${g.totalMs}"></span></div>`;

  if (g.myDone) {
    return {
      tone: '',
      turn: `Done! Waiting for the others · <span class="secs" data-deadline="${g.endsAt}"></span>s`,
      body: `${header}
        <div class="tp-sent">
          <div class="tp-sent-icon">${icon('check')}</div>
          <b>Passed along!</b>
          <small>Your ${g.kind === 'draw' ? 'drawing' : g.kind === 'write' ? 'sentence' : 'guess'} is on its way to the next player.</small>
          <button class="btn btn-sm" data-game="telephone" data-edit>${icon('pen')} Change it</button>
        </div>
        ${g.kind === 'draw' ? '<div id="tpCanvasSlot" class="draw-slot tp-hidden"></div>' : ''}
        ${tpWaiting(g)}`,
    };
  }

  if (g.kind === 'write') {
    return {
      tone: 'live',
      turn: `Write something funny · <span class="secs" data-deadline="${g.endsAt}"></span>s`,
      body: `${header}
        <div class="tp-card tp-paper">
          <label class="tp-label" for="tpText">Write a sentence for someone else to draw</label>
          <form class="tp-form" data-tp-form>
            <input id="tpText" maxlength="90" autocomplete="off" placeholder="A cow riding an auto in the rain…">
            <button class="btn btn-primary btn-lg" type="submit">Done</button>
          </form>
          <button class="btn btn-sm btn-ghost tp-idea" data-game="telephone" data-idea>${icon('shuffle')} Give me an idea</button>
        </div>
        ${tpWaiting(g)}`,
    };
  }

  if (g.kind === 'draw') {
    return {
      tone: 'live',
      turn: `Draw it · <span class="secs" data-deadline="${g.endsAt}"></span>s`,
      body: `${header}
        <div class="tp-prompt"><small>Draw this</small><b>${esc(g.prompt ? g.prompt.text : '')}</b></div>
        <div class="tp-draw">
          <div id="tpCanvasSlot" class="draw-slot"></div>
          ${tpTools()}
        </div>
        <div class="actions tp-done"><button class="btn btn-primary btn-lg" data-game="telephone" data-send>${icon('check')} Done drawing</button></div>
        ${tpWaiting(g)}`,
    };
  }

  // describe
  return {
    tone: 'live',
    turn: `What is this? · <span class="secs" data-deadline="${g.endsAt}"></span>s`,
    body: `${header}
      <div class="tp-frame">${tpImageTag(g.prompt.chain, g.prompt.step, g.prompt.empty)}</div>
      <div class="tp-card">
        <label class="tp-label" for="tpText">Describe this drawing in one line</label>
        <form class="tp-form" data-tp-form>
          <input id="tpText" maxlength="90" autocomplete="off" placeholder="I think this is…">
          <button class="btn btn-primary btn-lg" type="submit">Done</button>
        </form>
      </div>
      ${tpWaiting(g)}`,
  };
}

function tpReveal(g) {
  const r = g.reveal;
  const over = g.phase === 'over';
  const entries = r.entries.map((e, i) => {
    const newest = i === r.entries.length - 1 && !over;
    const label = i === 0 ? 'started with' : e.type === 'image' ? 'drew' : 'guessed';
    const content = e.type === 'image'
      ? `<div class="tp-frame small">${tpImageTag(r.chain, e.step, e.empty)}</div>`
      : `<div class="tp-bubble">${esc(e.text)}</div>`;
    return `<div class="tp-entry ${newest ? 'new' : ''}">
      <div class="tp-who">${avatar(nameOf(e.by))}<span><b>${esc(nameOf(e.by))}</b> ${label}</span></div>
      ${content}
    </div>`;
  }).join('');

  let next;
  if (!r.lastStep) next = `Next ${icon('arrow')}`;
  else if (!r.lastChain) next = `Next story ${icon('arrow')}`;
  else next = 'Finish';

  return {
    tone: over ? 'win' : '',
    turn: over ? 'That was every story!' : `${esc(nameOf(r.owner))}'s story · ${r.chain + 1} of ${g.steps}`,
    body: `${over ? resultBanner('What a mess. Perfect.') : ''}
      <div class="tp-album" id="tpAlbum">${entries}</div>
      <div class="actions sticky-actions">
        ${over ? rematchBtn() : isHost() ? `<button class="btn btn-primary btn-lg" data-game="telephone" data-next-step>${next}</button>` : `<span class="muted">${esc(nameOf(S.room.hostId))} controls the reveal</span>`}
      </div>`,
  };
}

renderers.telephone = () => {
  const g = S.game;
  return g.phase === 'round' ? tpRound(g) : tpReveal(g);
};

function tpSendText() {
  const input = $('#tpText');
  const text = input ? input.value.trim() : '';
  if (!text) { toast('Write something first'); if (input) input.focus(); return; }
  act({ type: 'submit', text });
}

handlers.telephone = d => {
  if ('color' in d) { tp.color = d.color; if (tp.tool === 'eraser') tp.tool = 'pen'; render(); }
  else if ('size' in d) { tp.size = +d.size; render(); }
  else if ('tool' in d) { tp.tool = d.tool; render(); }
  else if ('undo' in d) { const prev = tp.history.pop(); if (prev) tp.ctx.putImageData(prev, 0, 0); }
  else if ('wipe' in d) { tpSnapshot(); tpClear(); }
  else if ('send' in d) act({ type: 'submit', image: tpImage() });
  else if ('edit' in d) act({ type: 'unsubmit' });
  else if ('idea' in d) { const i = $('#tpText'); if (i) { i.value = TP_IDEAS[Math.floor(Math.random() * TP_IDEAS.length)]; i.focus(); } }
  else if ('nextStep' in d) act({ type: 'next' });
};

$('#stage').addEventListener('submit', e => {
  if (!e.target.matches('[data-tp-form]')) return;
  e.preventDefault();
  tpSendText();
});

/* ---------- drawings are fetched only when someone needs to see them ---------- */
function tpLoadImages(g) {
  for (const img of document.querySelectorAll('[data-tpimg]')) {
    const key = `${g.gameNo}:${img.dataset.tpimg}`;
    if (tp.images[key]) { img.src = tp.images[key]; continue; }
    if (tp.loading[key]) continue;
    tp.loading[key] = true;
    const [chain, step] = img.dataset.tpimg.split(':').map(Number);
    socket.emit('action', { type: 'image', chain, step }, res => {
      tp.loading[key] = false;
      if (!res || !res.image) return;
      tp.images[key] = res.image;
      for (const el of document.querySelectorAll(`[data-tpimg="${chain}:${step}"]`)) el.src = res.image;
    });
  }
}

/* ---------- after each render: keep the canvas, reset per round, follow the reveal ---------- */
afterRender.push(() => {
  const g = S && S.game;
  if (!g || g.gameId !== 'telephone') return;
  const roundKey = `${g.gameNo}:${g.round}`;
  if (g.phase === 'round' && roundKey !== tp.roundKey) {
    tp.roundKey = roundKey;
    tp.autoSent = false;
    if (g.kind === 'draw') {
      tpCanvasInit();
      tpClear();
      tp.history = [];
      tp.tool = 'pen';
    }
    const input = $('#tpText');
    if (input) input.focus();
  }
  const slot = $('#tpCanvasSlot');
  if (slot) { tpCanvasInit(); slot.appendChild(tp.canvas); }
  tpLoadImages(g);

  if (g.reveal) {
    const stepKey = `${g.gameNo}:${g.reveal.chain}:${g.reveal.step}`;
    if (stepKey !== tp.lastStep) {
      tp.lastStep = stepKey;
      const newest = document.querySelector('.tp-entry.new');
      if (newest) newest.scrollIntoView({ behavior: motionOk() ? 'smooth' : 'auto', block: 'center' });
    }
  }
});

// when the clock is about to run out, send what the player has so far
setInterval(() => {
  const g = S && S.game;
  if (!g || g.gameId !== 'telephone' || g.phase !== 'round' || g.myDone || tp.autoSent) return;
  if (serverNow() < g.endsAt - 900) return;
  tp.autoSent = true;
  if (g.kind === 'draw') act({ type: 'submit', image: tpImage() });
  else {
    const input = $('#tpText');
    const text = input ? input.value.trim() : '';
    if (text) act({ type: 'submit', text });
  }
}, 250);


/* ---------- Sketch Showdown: same sentence, everyone draws, all revealed together ---------- */
const sd = { roundKey: null, autoSent: false, revealKey: null, images: {}, loading: {} };

function sdCard(g, item, mode) {
  const name = esc(nameOf(item.id));
  const pic = item.empty ? '<div class="tp-blank">Nothing was drawn!</div>' : `<img class="tp-img" data-sdimg="${item.id}" alt="Drawing by ${name}">`;
  if (mode === 'vote') {
    const mine = item.id === S.you;
    const picked = g.myVote === item.id;
    const off = mine || item.empty;
    return `<button class="sd-card ${picked ? 'on' : ''} ${sd.animate ? 'flip' : ''}" style="--i:${g.gallery.indexOf(item)}" ${off ? 'disabled' : `data-game="showdown" data-vote="${item.id}"`} aria-label="${off ? name : `Vote for ${name}`}">
      <span class="sd-frame">${pic}</span>
      <span class="sd-name">${mine ? 'Yours' : name}${picked ? icon('check') : ''}</span>
    </button>`;
  }
  const votes = g.tally[item.id] || 0;
  const winner = g.best > 0 && votes === g.best;
  return `<div class="sd-card result ${winner ? 'win' : ''}">
    <span class="sd-frame">${pic}</span>
    <span class="sd-name">${name}<em>${votes} vote${votes === 1 ? '' : 's'} · +${g.roundPoints[item.id] || 0}</em></span>
  </div>`;
}

renderers.showdown = () => {
  const g = S.game;
  const prompt = `<div class="tp-prompt"><small>Everyone draws this</small><b>${esc(g.prompt)}</b></div>`;

  if (g.phase === 'over') {
    const best = Math.max(...Object.values(g.scores));
    const champs = Object.keys(g.scores).filter(id => g.scores[id] === best);
    return {
      tone: 'win',
      turn: 'What an art gallery!',
      body: `${resultBanner(`${champs.map(nameOf).map(esc).join(' & ')} win${champs.length > 1 ? '' : 's'} with ${best}`)}${scoreboard(g.scores)}<div class="actions">${rematchBtn()}</div>`,
    };
  }

  if (g.phase === 'draw') {
    const header = `<div class="timebar"><span data-deadline="${g.endsAt}" data-total="${g.totalMs}"></span></div>${prompt}`;
    const chips = g.players.map(p => `<span class="pill ${g.doneIds.includes(p.id) ? 'ok' : ''}">${g.doneIds.includes(p.id) ? icon('check') : icon('pen')} ${esc(p.name)}</span>`).join('');
    if (g.myDone) {
      return {
        tone: '',
        turn: `Done! Waiting for the others · <span class="secs" data-deadline="${g.endsAt}"></span>s`,
        body: `${header}
          <div class="tp-sent">
            <div class="tp-sent-icon">${icon('check')}</div>
            <b>Masterpiece saved!</b>
            <small>Every drawing is revealed when the timer ends.</small>
            <button class="btn btn-sm" data-game="showdown" data-edit>${icon('pen')} Keep drawing</button>
          </div>
          <div id="tpCanvasSlot" class="draw-slot tp-hidden"></div>
          <div class="pass-status">${chips}</div>`,
      };
    }
    return {
      tone: 'live',
      turn: `Draw it! · <span class="secs" data-deadline="${g.endsAt}"></span>s`,
      body: `${header}
        <div class="tp-draw">
          <div id="tpCanvasSlot" class="draw-slot"></div>
          ${tpTools()}
        </div>
        <div class="actions tp-done"><button class="btn btn-primary btn-lg" data-game="showdown" data-send>${icon('check')} Done drawing</button></div>
        <div class="pass-status">${chips}</div>`,
    };
  }

  if (g.phase === 'vote') {
    const voted = g.votedIds.length;
    return {
      tone: 'live',
      turn: `Vote for your favourite · <span class="secs" data-deadline="${g.endsAt}"></span>s`,
      body: `<div class="timebar"><span data-deadline="${g.endsAt}" data-total="${g.totalMs}"></span></div>
        ${prompt}
        <div class="sd-grid">${g.gallery.map(item => sdCard(g, item, 'vote')).join('')}</div>
        <p class="hint">${voted} of ${g.players.length} voted${g.myVote ? ' — you can still change your vote' : ''}</p>`,
    };
  }

  // result
  const ranked = [...g.gallery].sort((a, b) => (g.tally[b.id] || 0) - (g.tally[a.id] || 0));
  const last = g.round >= g.totalRounds;
  return {
    tone: 'win',
    turn: g.best > 0 ? 'The votes are in!' : 'No votes this round',
    body: `${prompt}
      <div class="sd-grid">${ranked.map(item => sdCard(g, item, 'result')).join('')}</div>
      ${scoreboard(g.scores)}
      <div class="actions sticky-actions">${isHost() ? `<button class="btn btn-primary btn-lg" data-game="showdown" data-next>${last ? 'See final scores' : `Next round ${icon('arrow')}`}</button>` : `<span class="muted">${esc(nameOf(S.room.hostId))} starts the next round</span>`}</div>`,
  };
};

handlers.showdown = d => {
  if ('send' in d) act({ type: 'submit', image: tpImage() });
  else if ('edit' in d) act({ type: 'unsubmit' });
  else if ('vote' in d) act({ type: 'vote', id: d.vote });
  else if ('next' in d) act({ type: 'next' });
};

// sdCard asks this during the render, so the cards flip over only once per reveal
const sdBeforeRender = () => {
  const g = S && S.game;
  if (!g || g.gameId !== 'showdown' || g.phase !== 'vote') { sd.animate = false; return; }
  const key = `${g.gameNo}:${g.round}`;
  sd.animate = key !== sd.revealKey;
  sd.revealKey = key;
};
const sdRenderer = renderers.showdown;
renderers.showdown = () => { sdBeforeRender(); return sdRenderer(); };

afterRender.push(() => {
  const g = S && S.game;
  if (!g || g.gameId !== 'showdown') return;
  const roundKey = `${g.gameNo}:${g.round}`;
  if (g.phase === 'draw' && roundKey !== sd.roundKey) {
    sd.roundKey = roundKey;
    sd.autoSent = false;
    tpCanvasInit();
    tpClear();
    tp.history = [];
    tp.tool = 'pen';
  }
  const slot = $('#tpCanvasSlot');
  if (slot) { tpCanvasInit(); slot.appendChild(tp.canvas); }
  for (const img of document.querySelectorAll('[data-sdimg]')) {
    const id = img.dataset.sdimg;
    const key = `${roundKey}:${id}`;
    if (sd.images[key]) { img.src = sd.images[key]; continue; }
    if (sd.loading[key]) continue;
    sd.loading[key] = true;
    socket.emit('action', { type: 'image', id }, res => {
      sd.loading[key] = false;
      if (!res || !res.image) return;
      sd.images[key] = res.image;
      for (const el of document.querySelectorAll(`[data-sdimg="${id}"]`)) el.src = res.image;
    });
  }
});

// when time runs out, whatever is on the canvas counts as the drawing
setInterval(() => {
  const g = S && S.game;
  if (!g || g.gameId !== 'showdown' || g.phase !== 'draw' || g.myDone || sd.autoSent || !tp.canvas) return;
  if (serverNow() < g.endsAt - 900) return;
  sd.autoSent = true;
  act({ type: 'submit', image: tpImage() });
}, 250);
