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
  ops: [], opMarks: [], strokes: {}, replay: null, replayWant: null, sharing: false,
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
    if (tp.tool === 'fill') { tp.ops.push({ f: tp.color, x, y }); tpFill(x, y, tp.color); return; }
    tp.drawing = true;
    tp.last = [x, y];
    tp.ops.push({ c: tp.tool === 'eraser' ? '#ffffff' : tp.color, w: tp.tool === 'eraser' ? Math.max(18, tp.size * 2) : tp.size, p: [x, y] });
    tpLine(x, y, x + 0.1, y + 0.1);
  });
  c.addEventListener('pointermove', e => {
    if (!tp.drawing) return;
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of events.length ? events : [e]) {
      const [x, y] = point(ev);
      tpLine(tp.last[0], tp.last[1], x, y);
      tp.last = [x, y];
      const op = tp.ops[tp.ops.length - 1];
      if (op && op.p) {
        const n = op.p.length;
        if (Math.abs(op.p[n - 2] - x) + Math.abs(op.p[n - 1] - y) >= 3) op.p.push(x, y);
      }
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
  tp.opMarks.push(tp.ops.length);
  if (tp.history.length > 12) { tp.history.shift(); tp.opMarks.shift(); }
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
function tpFill(x, y, color, ctx = tp.ctx) {
  const img = ctx.getImageData(0, 0, TP_W, TP_H), d = img.data;
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
  ctx.putImageData(img, 0, 0);
}
const tpImage = () => tp.canvas.toDataURL('image/jpeg', 0.72);
// a very long drawing skips the replay rather than risk the drawing itself not sending
const tpDrawingPayload = () => {
  const out = { type: 'submit', image: tpImage() };
  if (tp.ops.length && JSON.stringify(tp.ops).length <= 150000) out.strokes = tp.ops;
  return out;
};

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
  return `<div class="tp-pic"><img class="tp-img" data-tpimg="${chain}:${step}" alt="A player's drawing"></div>`;
}

// the reveal version adds a button to watch the drawing being made again
const tpRevealPic = (chain, step, empty) => (empty ? tpImageTag(chain, step, true)
  : tpImageTag(chain, step, false).replace('</div>', `<button class="tp-replay-btn" data-game="telephone" data-replay="${chain}:${step}" hidden>${icon('rotate')} Replay</button></div>`));

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

const TP_HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21C5 15.500 2 12 2 8a5.500 5.500 0 0 1 10-3 5.500 5.500 0 0 1 10 3c0 4-3 7.500-10 13z"/></svg>';

function tpHeart(r, e) {
  const count = e.hearts ? `<b>${e.hearts}</b>` : '';
  const key = `${r.chain}:${e.step}`;
  if (e.missing) return '';
  if (e.by === S.you) return e.hearts ? `<span class="tp-heart mine">${TP_HEART}${count}</span>` : '';
  const pop = tp.heartPop === key ? 'pop' : '';
  return `<button class="tp-heart ${e.myHeart ? 'on' : ''} ${pop}" data-game="telephone" data-heart="${key}" aria-pressed="${e.myHeart}" aria-label="Heart this entry">${TP_HEART}${count}</button>`;
}

function tpOver(g) {
  const best = Math.max(...Object.values(g.scores));
  const champs = Object.keys(g.scores).filter(id => g.scores[id] === best);
  const headline = best > 0
    ? `${champs.map(nameOf).map(esc).join(' & ')} win${champs.length > 1 ? '' : 's'} with ${best}`
    : 'No hearts this time. What a mess. Perfect.';
  const f = g.funniest;
  const moment = f ? `<div class="tp-moment">
      <small>Funniest moment of the game</small>
      ${f.type === 'image' ? `<div class="tp-frame small">${tpRevealPic(f.chain, f.step, false)}</div>` : `<div class="tp-bubble">${esc(f.text)}</div>`}
      <div class="tp-moment-by">${avatar(nameOf(f.by))}<b>${esc(nameOf(f.by))}</b><span class="tp-heart mine">${TP_HEART}<b>${f.hearts}</b></span></div>
    </div>` : '';
  return {
    tone: 'win',
    turn: 'That was every story!',
    body: `${resultBanner(headline)}${moment}${scoreboard(g.scores)}
      <div class="tp-stories"><h4>${icon('share')} Share a story</h4><div>${g.players.map((p, i) => `<button class="btn btn-sm" data-game="telephone" data-share="${i}">${esc(p.name)}'s story</button>`).join('')}</div></div>
      <div class="actions">${rematchBtn()}</div>`,
  };
}

function tpReveal(g) {
  if (g.phase === 'over') return tpOver(g);
  const r = g.reveal;
  const entries = r.entries.map((e, i) => {
    const newest = i === r.entries.length - 1;
    const label = i === 0 ? 'started with' : e.type === 'image' ? 'drew' : 'guessed';
    const content = e.type === 'image'
      ? `<div class="tp-frame small">${tpRevealPic(r.chain, e.step, e.empty)}</div>`
      : `<div class="tp-bubble">${esc(e.text)}</div>`;
    return `<div class="tp-entry ${newest ? 'new' : ''}">
      <div class="tp-who">${avatar(nameOf(e.by))}<span><b>${esc(nameOf(e.by))}</b> ${label}</span>${tpHeart(r, e)}</div>
      ${content}
    </div>`;
  }).join('');
  tp.heartPop = null;

  let next;
  if (!r.lastStep) next = `Next ${icon('arrow')}`;
  else if (!r.lastChain) next = `Next story ${icon('arrow')}`;
  else next = 'Finish and see scores';

  return {
    tone: '',
    turn: `${esc(nameOf(r.owner))}'s story · ${r.chain + 1} of ${g.steps}`,
    body: `<p class="hint tp-heart-hint">Tap the heart on anything that makes you laugh</p>
      <div class="tp-album" id="tpAlbum">${entries}</div>
      <div class="actions sticky-actions">
        ${r.lastStep ? `<button class="btn btn-lg" data-game="telephone" data-share="${r.chain}">${icon('share')} Share</button>` : ''}
        ${isHost() ? `<button class="btn btn-primary btn-lg" data-game="telephone" data-next-step>${next}</button>` : `<span class="muted">${esc(nameOf(S.room.hostId))} controls the reveal</span>`}
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
  else if ('undo' in d) {
    const prev = tp.history.pop();
    if (prev) { tp.ctx.putImageData(prev, 0, 0); tp.ops.length = tp.opMarks.pop(); }
  }
  else if ('wipe' in d) { tpSnapshot(); tp.ops.push({ k: 1 }); tpClear(); }
  else if ('send' in d) act(tpDrawingPayload());
  else if ('replay' in d) tpStartReplay(`${S.game.gameNo}:${d.replay}`);
  else if ('share' in d) tpShareStory(Number(d.share));
  else if ('edit' in d) act({ type: 'unsubmit' });
  else if ('idea' in d) { const i = $('#tpText'); if (i) { i.value = TP_IDEAS[Math.floor(Math.random() * TP_IDEAS.length)]; i.focus(); } }
  else if ('nextStep' in d) act({ type: 'next' });
  else if ('heart' in d) {
    const [chain, step] = d.heart.split(':').map(Number);
    tp.heartPop = d.heart;
    act({ type: 'heart', chain, step });
  }
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
      tp.strokes[key] = res.strokes || null;
      if (tp.replayWant === key) tpStartReplay(key); // before the picture shows, so it isn't spoiled
      for (const el of document.querySelectorAll(`[data-tpimg="${chain}:${step}"]`)) el.src = res.image;
      tpSyncReplay();
    });
  }
}

/* ---------- replay: a drawing makes itself, line by line ---------- */
function tpStopReplay() {
  if (!tp.replay) return;
  cancelAnimationFrame(tp.replay.raf);
  tp.replay.canvas.remove();
  tp.replay = null;
}

function tpStartReplay(key) {
  const ops = tp.strokes[key];
  tpStopReplay();
  tp.replayWant = null;
  if (!ops || !ops.length) return;
  const c = document.createElement('canvas');
  c.width = TP_W;
  c.height = TP_H;
  c.className = 'tp-replay';
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const white = () => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, TP_W, TP_H); };
  white();
  // every piece of work counts as a step; fills and wipes get a little more time
  const steps = [];
  for (const op of ops) {
    if (op.k) steps.push(() => white(), null, null, null, null);
    else if (op.f) steps.push(() => tpFill(op.x, op.y, op.f, ctx), null, null, null, null, null, null, null);
    else {
      const dot = op.p.length === 2;
      for (let i = dot ? 0 : 2; i < op.p.length; i += 2) {
        const x1 = dot ? op.p[0] : op.p[i - 2], y1 = dot ? op.p[1] : op.p[i - 1];
        const x2 = dot ? op.p[0] + 0.1 : op.p[i], y2 = dot ? op.p[1] + 0.1 : op.p[i + 1];
        steps.push(() => {
          ctx.strokeStyle = op.c;
          ctx.lineWidth = op.w;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        });
      }
    }
  }
  const duration = Math.max(2500, Math.min(7000, steps.length * 16));
  const start = performance.now();
  let done = 0;
  const run = { key, canvas: c, raf: 0 };
  const frame = now => {
    const upto = Math.min(steps.length, Math.ceil(((now - start) / duration) * steps.length));
    for (; done < upto; done++) if (steps[done]) steps[done]();
    if (done >= steps.length) { if (tp.replay === run) tpStopReplay(); return; }
    run.raf = requestAnimationFrame(frame);
  };
  tp.replay = run;
  run.raf = requestAnimationFrame(frame);
  tpSyncReplay();
}

// page redraws replace the picture, so the running replay is placed back on top of the new one
function tpSyncReplay() {
  const g = S && S.game;
  if (!g || g.gameId !== 'telephone') { tpStopReplay(); return; }
  for (const b of document.querySelectorAll('[data-replay]')) b.hidden = !tp.strokes[`${g.gameNo}:${b.dataset.replay}`];
  if (!tp.replay) return;
  const [gameNo, chain, step] = tp.replay.key.split(':');
  const img = Number(gameNo) === g.gameNo && document.querySelector(`[data-tpimg="${chain}:${step}"]`);
  if (!img) { tpStopReplay(); return; }
  if (tp.replay.canvas.parentElement !== img.parentElement) img.parentElement.appendChild(tp.replay.canvas);
}

/* ---------- share: one tall image of a whole story ---------- */
const tpAction = payload => new Promise((resolve, reject) => {
  socket.emit('action', payload, res => (!res || res.error ? reject(new Error((res && res.error) || 'Could not load that')) : resolve(res)));
});
const tpLoadPicture = src => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});
function tpWrap(ctx, text, width) {
  const lines = [];
  let line = '';
  for (const word of String(text).split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

async function tpBuildStoryImage(gameNo, chain, story) {
  await Promise.all(['700 44px Kalam', '600 40px Fredoka', '700 30px Nunito'].map(f => document.fonts.load(f).catch(() => null)));
  const pictures = {};
  await Promise.all(story.entries.filter(e => e.type === 'image' && !e.empty).map(async e => {
    const key = `${gameNo}:${chain}:${e.step}`;
    if (!tp.images[key]) {
      const res = await tpAction({ type: 'image', chain, step: e.step });
      tp.images[key] = res.image;
      tp.strokes[key] = res.strokes || null;
    }
    pictures[e.step] = await tpLoadPicture(tp.images[key]);
  }));

  const W = 1080, PAD = 70, PIC_W = 860, PIC_H = PIC_W * 0.75;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  // measure first, then draw
  ctx.font = '700 44px Kalam, cursive';
  const blocks = story.entries.map(e => {
    if (e.type === 'text') {
      const lines = tpWrap(ctx, e.text, W - PAD * 2 - 80);
      return { e, lines, h: 70 + lines.length * 58 + 56 };
    }
    return { e, h: 70 + (e.empty ? 160 : PIC_H + 40) + 46 };
  });
  c.width = W;
  c.height = 210 + blocks.reduce((sum, b) => sum + b.h, 0) + 130;
  const bg = ctx.createLinearGradient(0, 0, 0, c.height);
  bg.addColorStop(0, '#1b1248');
  bg.addColorStop(1, '#3a1458');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, c.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffc83d';
  ctx.font = '600 34px Fredoka, sans-serif';
  ctx.fillText('GameHub · Doodle Telephone', W / 2, 78);
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 58px Fredoka, sans-serif';
  ctx.fillText(`${nameOf(story.owner)}'s story`, W / 2, 150);

  const palette = ['#7c4dff', '#c8505c', '#3f7fc4', '#3f9a68', '#c98a2a', '#b0468f', '#4a8f9f', '#8a6f4d'];
  let y = 210;
  for (const { e, lines, h } of blocks) {
    const seat = S.game.players.findIndex(p => p.id === e.by);
    ctx.fillStyle = palette[Math.max(0, seat) % palette.length];
    ctx.beginPath();
    ctx.arc(PAD + 24, y + 24, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = '700 26px Nunito, sans-serif';
    ctx.fillText(nameOf(e.by).charAt(0).toUpperCase(), PAD + 24, y + 33);
    ctx.textAlign = 'left';
    ctx.font = '700 30px Nunito, sans-serif';
    ctx.fillText(`${nameOf(e.by)} ${e.step === 0 ? 'started with' : e.type === 'image' ? 'drew' : 'guessed'}`, PAD + 62, y + 34);
    if (e.hearts) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ff7a9c';
      ctx.fillText(`♥ ${e.hearts}`, W - PAD, y + 34);
      ctx.textAlign = 'left';
    }
    const top = y + 70;
    if (e.type === 'text') {
      ctx.fillStyle = '#fbf8ef';
      ctx.beginPath();
      ctx.roundRect(PAD, top, W - PAD * 2, lines.length * 58 + 30, 22);
      ctx.fill();
      ctx.fillStyle = '#23307a';
      ctx.font = '700 44px Kalam, cursive';
      lines.forEach((line, i) => ctx.fillText(line, PAD + 36, top + 56 + i * 58));
    } else if (e.empty) {
      ctx.fillStyle = '#fbf8ef';
      ctx.fillRect(PAD, top, W - PAD * 2, 130);
      ctx.fillStyle = '#6e6696';
      ctx.font = '700 38px Kalam, cursive';
      ctx.fillText('Nothing was drawn in time!', PAD + 36, top + 80);
    } else {
      const x = (W - PIC_W) / 2;
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - 14, top - 14, PIC_W + 28, PIC_H + 28);
      ctx.drawImage(pictures[e.step], x, top, PIC_W, PIC_H);
    }
    y += h;
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#bdb5e3';
  ctx.font = '700 28px Nunito, sans-serif';
  ctx.fillText(`Play with friends at ${location.host}`, W / 2, c.height - 54);
  return new Promise((resolve, reject) => c.toBlob(b => (b ? resolve(b) : reject(new Error('Could not make the image'))), 'image/jpeg', 0.88));
}

function tpShowShare(blob, title) {
  const url = URL.createObjectURL(blob);
  const file = new File([blob], 'gamehub-story.jpg', { type: 'image/jpeg' });
  const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  const box = document.createElement('div');
  box.className = 'tp-sharebox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', title);
  box.innerHTML = `<div class="tp-sharecard">
    <div class="tp-sharepreview"><img src="${url}" alt="${esc(title)}"></div>
    <div class="tp-shareactions">
      ${canShare ? `<button class="btn btn-primary btn-lg" data-do="share">${icon('share')} Share</button>` : ''}
      <a class="btn btn-lg ${canShare ? '' : 'btn-primary'}" href="${url}" download="gamehub-story.jpg">${icon('download')} Save image</a>
      <button class="btn btn-lg btn-ghost" data-do="close">Close</button>
    </div></div>`;
  const close = () => {
    document.removeEventListener('keydown', onKey);
    box.remove();
    URL.revokeObjectURL(url);
  };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  box.addEventListener('click', e => {
    const b = e.target.closest('[data-do]');
    if (e.target === box || (b && b.dataset.do === 'close')) close();
    else if (b && b.dataset.do === 'share') {
      navigator.share({ files: [file], title, text: `Our Doodle Telephone story! Play at ${location.origin}` }).catch(err => {
        if (err.name !== 'AbortError') toast('Sharing did not work. Try Save image.');
      });
    }
  });
  document.body.appendChild(box);
}

async function tpShareStory(chain) {
  if (tp.sharing) return;
  tp.sharing = true;
  toast('Making your story image…');
  try {
    const gameNo = S.game.gameNo;
    const story = await tpAction({ type: 'story', chain });
    const blob = await tpBuildStoryImage(gameNo, chain, story);
    tpShowShare(blob, `${nameOf(story.owner)}'s Doodle Telephone story`);
  } catch (err) {
    toast(err.message || 'Could not make the image');
  } finally {
    tp.sharing = false;
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
      tp.ops = [];
      tp.opMarks = [];
      tp.tool = 'pen';
    }
    const input = $('#tpText');
    if (input) input.focus();
  }
  const slot = $('#tpCanvasSlot');
  if (slot) { tpCanvasInit(); slot.appendChild(tp.canvas); }

  if (g.reveal) {
    const stepKey = `${g.gameNo}:${g.reveal.chain}:${g.reveal.step}`;
    if (stepKey !== tp.lastStep) {
      tp.lastStep = stepKey;
      const fresh = g.phase === 'reveal' && g.reveal.entries[g.reveal.entries.length - 1];
      tpStopReplay();
      tp.replayWant = fresh && fresh.type === 'image' && !fresh.empty && motionOk() ? `${g.gameNo}:${g.reveal.chain}:${g.reveal.step}` : null;
      if (tp.replayWant && tp.images[tp.replayWant]) tpStartReplay(tp.replayWant);
      const newest = document.querySelector('.tp-entry.new');
      if (newest) newest.scrollIntoView({ behavior: motionOk() ? 'smooth' : 'auto', block: 'center' });
    }
  }
  tpLoadImages(g);
  tpSyncReplay();
});

// when the clock is about to run out, send what the player has so far
setInterval(() => {
  const g = S && S.game;
  if (!g || g.gameId !== 'telephone' || g.phase !== 'round' || g.myDone || tp.autoSent) return;
  if (serverNow() < g.endsAt - 900) return;
  tp.autoSent = true;
  if (g.kind === 'draw') act(tpDrawingPayload());
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
