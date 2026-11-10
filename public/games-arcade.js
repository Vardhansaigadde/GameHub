/* Arcade games: Typing Arena, Ludo, Snakes & Ladders, Color Clash, Four in a Row. */
const motionOk = () => !matchMedia('(prefers-reduced-motion: reduce)').matches;
const anim = (el, frames, opts) => (el && motionOk() ? el.animate(frames, opts) : null);
const winnerBanner = (id, draw) => (draw ? resultBanner("It's a draw!") : resultBanner(id === S.you ? 'You win!' : `${esc(nameOf(id))} wins!`));

/* ---------- shared 3D dice ---------- */
const DIE_PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
const DIE_ROT = { 1: 'rotateX(-14deg) rotateY(14deg)', 2: 'rotateX(-14deg) rotateY(-76deg)', 3: 'rotateX(-104deg) rotateY(0deg)', 4: 'rotateX(76deg) rotateY(0deg)', 5: 'rotateX(-14deg) rotateY(104deg)', 6: 'rotateX(-14deg) rotateY(194deg)' };

function dieHtml(value, attrs = '') {
  const faces = [1, 2, 3, 4, 5, 6].map(n => `<div class="face f${n}">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(c => `<i class="${DIE_PIPS[n].includes(c) ? 'on' : ''}"></i>`).join('')}</div>`).join('');
  return `<${attrs ? 'button' : 'div'} class="gdie ${attrs ? 'can-roll' : ''}" ${attrs}><span class="cube" style="transform:${DIE_ROT[value || 5]}">${faces}</span></${attrs ? 'button' : 'div'}>`;
}

let lastRolls = null;
function spinDie(g) {
  if (g.rolls == null) { lastRolls = null; return; }
  if (lastRolls !== null && g.rolls !== lastRolls) {
    const cube = document.querySelector('.gdie .cube');
    if (cube) anim(cube, [{ transform: 'rotateX(900deg) rotateY(720deg) scale(1.15)' }, { transform: DIE_ROT[g.lastRoll || g.roll || 5] }], { duration: 650, easing: 'cubic-bezier(.15,.8,.25,1)' });
  }
  lastRolls = g.rolls;
}

/* A token moves square by square; `cells` are [left%, top%] stops. */
function walk(el, cells, msPerStep = 150) {
  if (!el || cells.length < 2) return;
  const frames = [];
  cells.forEach(([x, y], i) => {
    frames.push({ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%) scale(1)', offset: i / (cells.length - 1) });
    if (i < cells.length - 1) {
      const [nx, ny] = cells[i + 1];
      frames.push({ left: `${(x + nx) / 2}%`, top: `${(y + ny) / 2}%`, transform: 'translate(-50%,-70%) scale(1.25)', offset: (i + 0.5) / (cells.length - 1) });
    }
  });
  anim(el, frames, { duration: (cells.length - 1) * msPerStep, easing: 'linear' });
}

/* ======================= Ludo ======================= */
const LUDO_COL = ['#e53935', '#2fb34a', '#f9c423', '#2a7de1'];
const LUDO_YARD = [[0, 0], [0, 9], [9, 9], [9, 0]]; // top-left cell of each seat's 6x6 yard
const LUDO_SPOTS = [[2, 2], [2, 4], [4, 2], [4, 4]];
const ludoPrev = {};

const pct = n => (n / 15) * 100;
function ludoSpot(g, p, i, pos) {
  if (pos === -1) {
    const [ry, cy] = LUDO_YARD[p.seat];
    const [dr, dc] = LUDO_SPOTS[i];
    return [pct(cy + dc), pct(ry + dr)];
  }
  const [r, c] = g.paths[p.seat][pos];
  return [pct(c + 0.5), pct(r + 0.5)];
}

function ludoBoard(g) {
  const seatColor = {};
  const cells = {};
  for (let seat = 0; seat < 4; seat++) {
    const path = g.paths[seat];
    path.slice(0, 51).forEach(([r, c]) => { cells[`${r},${c}`] = cells[`${r},${c}`] || ''; });
    path.slice(51, 56).forEach(([r, c]) => { cells[`${r},${c}`] = `home" style="--c:${LUDO_COL[seat]}`; });
    const [sr, sc] = path[0];
    seatColor[`${sr},${sc}`] = LUDO_COL[seat];
  }
  const safe = new Set(g.safe.map(String));
  const squares = Object.entries(cells).map(([key, cls]) => {
    const [r, c] = key.split(',').map(Number);
    const start = seatColor[key];
    const star = safe.has(key) ? '<svg viewBox="0 0 24 24" class="star"><path d="M12 2l3 7 7 .7-5.3 4.8L18.300 22 12 18l-6.300 4 1.600-7.500L2 9.700 9 9z"/></svg>' : '';
    const pos = `left:${pct(c)}%;top:${pct(r)}%`;
    if (cls.startsWith('home')) {
      const col = cls.split('--c:')[1];
      return `<div class="lc home" style="${pos};--c:${col}"></div>`;
    }
    return `<div class="lc ${start ? 'start' : ''}" style="${pos};${start ? `--c:${start}` : ''}">${star}</div>`;
  }).join('');
  const yards = [0, 1, 2, 3].map(seat => {
    const [r, c] = LUDO_YARD[seat];
    return `<div class="ly" style="left:${pct(c)}%;top:${pct(r)}%;--c:${LUDO_COL[seat]}"><span class="ly-in">${LUDO_SPOTS.map(() => '<i></i>').join('')}</span></div>`;
  }).join('');

  const taken = {};
  const tokens = g.players.flatMap(p => p.tokens.map((pos, i) => {
    const [x, y] = ludoSpot(g, p, i, pos);
    const k = `${x},${y}`;
    const nudge = taken[k] = (taken[k] || 0) + 1;
    const canMove = p.id === S.you && g.legal.includes(i);
    const dx = nudge > 1 ? (nudge - 1) * 1.1 : 0;
    const style = `left:${x + dx}%;top:${y - dx}%;--c:${LUDO_COL[p.seat]}`;
    return canMove
      ? `<button class="ltok can" style="${style}" data-tok="${p.id}:${i}" data-game="ludo" data-token="${i}" aria-label="Move token"></button>`
      : `<span class="ltok" style="${style}" data-tok="${p.id}:${i}"></span>`;
  })).join('');

  return `<div class="ludo-board">${yards}${squares}<div class="ludo-centre"></div>${tokens}</div>`;
}

renderers.ludo = () => {
  const g = S.game;
  const myTurn = g.turnId === S.you;
  let turn, tone = '';
  if (g.phase === 'over') { turn = g.winnerId === S.you ? 'You win!' : `${esc(nameOf(g.winnerId))} wins!`; tone = 'win'; }
  else if (!myTurn) turn = `${esc(nameOf(g.turnId))} is ${g.phase === 'roll' ? 'rolling' : 'moving'}`;
  else if (g.phase === 'roll') { turn = 'Tap the dice to roll'; tone = 'mine'; }
  else { turn = `You rolled ${g.roll} — tap a glowing token`; tone = 'mine'; }
  const seats = g.players.map(p => `<div class="seat ${p.id === g.turnId ? 'active' : ''}"><span class="ltok-key" style="--c:${LUDO_COL[p.seat]}"></span><span><b>${esc(p.name)}</b>${p.id === S.you ? ' (you)' : ''}<small>${p.home}/4 home</small></span></div>`).join('');
  return {
    tone,
    turn,
    body: `${g.phase === 'over' ? winnerBanner(g.winnerId) : ''}
      <div class="seat-strip">${seats}</div>
      <div class="board-wrap">${ludoBoard(g)}
        <div class="die-dock">${dieHtml(g.lastRoll || g.roll, myTurn && g.phase === 'roll' ? 'data-game="ludo" data-roll aria-label="Roll the dice"' : '')}
          <div class="log-line">${g.log.slice(-2).map(esc).join('<br>')}</div>
        </div>
      </div>
      ${g.phase === 'over' ? `<div class="actions">${rematchBtn()}</div>` : ''}`,
  };
};
handlers.ludo = d => {
  if ('roll' in d) act({ type: 'roll' });
  else if ('token' in d) act({ type: 'move', token: +d.token });
};
function ludoAfter(g) {
  for (const p of g.players) p.tokens.forEach((pos, i) => {
    const key = `${p.id}:${i}`;
    const prev = ludoPrev[key];
    ludoPrev[key] = pos;
    if (prev === undefined || prev === pos) return;
    const el = document.querySelector(`[data-tok="${key}"]`);
    let stops;
    if (pos === -1) stops = [ludoSpot(g, p, i, prev), ludoSpot(g, p, i, -1)];
    else if (prev === -1) stops = [ludoSpot(g, p, i, -1), ludoSpot(g, p, i, 0)];
    else { stops = []; for (let n = prev; n <= pos; n++) stops.push(ludoSpot(g, p, i, n)); }
    walk(el, stops, pos === -1 ? 500 : 170);
  });
}

/* ======================= Snakes & Ladders ======================= */
const SNL_COL = ['#ff3d6e', '#38c6ff', '#ffc83d', '#2fe07f', '#b06bff', '#ff8a3d'];
const snlXY = n => {
  const i = n - 1, r = Math.floor(i / 10), col = r % 2 === 0 ? i % 10 : 9 - (i % 10);
  return [(col + 0.5) * 10, (9 - r + 0.5) * 10];
};
const snlPrev = {};
const snlSpot = (n, idx) => (n === 0 ? [5 + idx * 9, 105] : snlXY(n));

function snlOverlay(g) {
  let out = '';
  for (const [a, b] of Object.entries(g.ladders)) {
    const [x1, y1] = snlXY(+a), [x2, y2] = snlXY(b);
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), nx = (-dy / len) * 1.5, ny = (dx / len) * 1.5;
    let rungs = '';
    const count = Math.max(3, Math.round(len / 5));
    for (let i = 1; i < count; i++) {
      const t = i / count, cx = x1 + dx * t, cy = y1 + dy * t;
      rungs += `<line x1="${cx - nx}" y1="${cy - ny}" x2="${cx + nx}" y2="${cy + ny}"/>`;
    }
    out += `<g class="ladder"><line x1="${x1 - nx}" y1="${y1 - ny}" x2="${x2 - nx}" y2="${y2 - ny}"/><line x1="${x1 + nx}" y1="${y1 + ny}" x2="${x2 + nx}" y2="${y2 + ny}"/>${rungs}</g>`;
  }
  const hues = ['#2fb34a', '#e5284f', '#7c4dff', '#ff8a00', '#00a0c6', '#d81b90', '#6b9b1a', '#c2410c'];
  Object.entries(g.snakes).forEach(([a, b], i) => {
    const [x1, y1] = snlXY(+a), [x2, y2] = snlXY(b);
    const dx = x2 - x1, dy = y2 - y1;
    const wob = 7;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const nx = -dy / Math.hypot(dx, dy) * wob, ny = dx / Math.hypot(dx, dy) * wob;
    const d = `M${x1} ${y1} Q${x1 + dx * 0.25 + nx} ${y1 + dy * 0.25 + ny} ${mx} ${my} T${x2} ${y2}`;
    out += `<g class="snake" style="--s:${hues[i % hues.length]}"><path d="${d}"/><path class="belly" d="${d}"/><circle cx="${x1}" cy="${y1}" r="2.6"/><circle class="eye" cx="${x1 - 0.9}" cy="${y1 - 0.7}" r=".6"/><circle class="eye" cx="${x1 + 0.9}" cy="${y1 - 0.7}" r=".6"/></g>`;
  });
  return `<svg class="snl-svg" viewBox="0 0 100 100" aria-hidden="true">${out}</svg>`;
}

renderers.snakes = () => {
  const g = S.game;
  const myTurn = g.turnId === S.you;
  let cells = '';
  for (let n = 100; n >= 1; n--) {
    const [x, y] = snlXY(n);
    const shade = (Math.floor((x - 5) / 10) + Math.floor((y - 5) / 10)) % 2;
    cells += `<div class="sc s${shade} ${n === 100 ? 'goal' : ''}" style="left:${x - 5}%;top:${y - 5}%"><span>${n}</span></div>`;
  }
  const taken = {};
  const tokens = g.players.map((p, i) => {
    const [x, y] = snlSpot(p.pos, i);
    const k = `${x},${y}`;
    const nudge = taken[k] = (taken[k] || 0) + 1;
    return `<span class="ltok snl-tok" style="left:${x + (nudge - 1) * 1.6}%;top:${y - (nudge - 1) * 1.6}%;--c:${SNL_COL[i]}" data-snl="${p.id}" title="${esc(p.name)}"></span>`;
  }).join('');
  const seats = g.players.map((p, i) => `<div class="seat ${p.id === g.turnId ? 'active' : ''}"><span class="ltok-key" style="--c:${SNL_COL[i]}"></span><span><b>${esc(p.name)}</b>${p.id === S.you ? ' (you)' : ''}<small>Square ${p.pos}</small></span></div>`).join('');
  return {
    tone: g.phase === 'over' ? 'win' : myTurn ? 'mine' : '',
    turn: g.phase === 'over' ? `${esc(nameOf(g.winnerId))} reached 100!` : myTurn ? 'Tap the dice to roll' : `${esc(nameOf(g.turnId))} is rolling`,
    body: `${g.phase === 'over' ? winnerBanner(g.winnerId) : ''}
      <div class="seat-strip">${seats}</div>
      <div class="board-wrap">
        <div class="snl-board">${cells}${snlOverlay(g)}${tokens}</div>
        <div class="die-dock">${dieHtml(g.roll, myTurn && g.phase === 'play' ? 'data-game="snakes" data-roll aria-label="Roll the dice"' : '')}
          <div class="log-line">${g.log.slice(-2).map(esc).join('<br>')}</div>
          ${isHost() && g.phase !== 'over' ? '<button class="btn btn-sm btn-ghost" data-game="snakes" data-skip>Skip this turn</button>' : ''}
        </div>
      </div>
      ${g.phase === 'over' ? `<div class="actions">${rematchBtn()}</div>` : ''}`,
  };
};
handlers.snakes = d => {
  if ('roll' in d) act({ type: 'roll' });
  else if ('skip' in d) act({ type: 'skip' });
};
function snakesAfter(g) {
  g.players.forEach((p, i) => {
    const prev = snlPrev[p.id];
    snlPrev[p.id] = p.pos;
    if (prev === undefined || prev === p.pos) return;
    const el = document.querySelector(`[data-snl="${p.id}"]`);
    const l = g.last && g.last.id === p.id ? g.last : null;
    const landed = l ? l.landed : p.pos;
    const stops = [];
    for (let n = prev; n <= landed; n++) stops.push(snlSpot(n, i));
    if (landed !== p.pos) stops.push(snlSpot(p.pos, i));
    const steps = Math.max(1, stops.length - 1);
    if (landed === p.pos) walk(el, stops, 170);
    else {
      // walk to the ladder or snake, then glide along it
      const walkMs = (steps - 1) * 170;
      const frames = stops.map(([x, y], k) => ({ left: `${x}%`, top: `${y}%`, offset: k === stops.length - 1 ? 1 : (k * 170) / (walkMs + 650) }));
      anim(el, frames, { duration: walkMs + 650, easing: 'linear' });
    }
  });
}

/* ======================= Color Clash ======================= */
const CC_SYMBOL = { skip: '⊘', reverse: '⇄', wild: '★' };
const ccLabel = v => CC_SYMBOL[v] || v;
function ccCard(c, opts = {}) {
  const inner = `<span class="cc-corner">${ccLabel(c.v)}</span><span class="cc-oval"><b>${ccLabel(c.v)}</b></span><span class="cc-corner br">${ccLabel(c.v)}</span>`;
  const cls = `cc-card c-${c.c} ${opts.playable ? 'playable' : ''} ${opts.dim ? 'dim' : ''} ${opts.cls || ''}`;
  return opts.button
    ? `<button class="${cls}" data-game="colorclash" data-card="${c.id}" ${opts.playable ? '' : 'disabled'} aria-label="${c.c} ${c.v}">${inner}</button>`
    : `<div class="${cls}" style="${opts.style || ''}">${inner}</div>`;
}
let ccPick = null, ccLastPlays = null;

renderers.colorclash = () => {
  const g = S.game;
  const myTurn = g.turnId === S.you;
  const seats = g.players.filter(p => p.id !== S.you).map(p => `<div class="seat ${p.id === g.turnId ? 'active' : ''}">
      ${avatar(p.name)}<span><b>${esc(p.name)}</b><small>${p.count} card${p.count === 1 ? '' : 's'}</small></span>
      <span class="cc-mini">${Array(Math.min(p.count, 6)).fill('<i></i>').join('')}</span></div>`).join('');
  const n = g.myHand.length;
  const hand = g.myHand.map((c, i) => {
    const playable = g.playable.includes(c.id);
    const tilt = n > 1 ? (i - (n - 1) / 2) * Math.min(5, 40 / n) : 0;
    return `<span class="cc-slot" style="--tilt:${tilt}deg;--lift:${Math.abs(tilt) * 1.1}px">${ccCard(c, { button: true, playable, dim: myTurn && !playable })}</span>`;
  }).join('');

  let turn, tone = '';
  if (g.phase === 'over') { turn = g.winnerId === S.you ? 'You emptied your hand!' : `${esc(nameOf(g.winnerId))} wins!`; tone = 'win'; }
  else if (!myTurn) turn = `${esc(nameOf(g.turnId))} is playing`;
  else if (g.drew != null) { turn = 'Play the card you drew, or pass'; tone = 'mine'; }
  else if (g.playable.length) { turn = 'Play a glowing card'; tone = 'mine'; }
  else { turn = 'No match — draw a card'; tone = 'mine'; }

  const canDraw = myTurn && g.drew == null && g.phase === 'play';
  const oneBtn = g.oneOpen === S.you
    ? '<button class="btn btn-gold btn-xl cc-one" data-game="colorclash" data-one>ONE!</button>'
    : g.oneOpen ? `<button class="btn btn-danger btn-lg cc-catch" data-game="colorclash" data-catch>Catch ${esc(nameOf(g.oneOpen))}! +2</button>` : '';
  const picker = ccPick != null ? `<div class="cc-picker" role="dialog" aria-label="Choose a colour"><b>Choose a colour</b><div>${['red', 'yellow', 'green', 'blue'].map(c => `<button class="cc-swatch c-${c}" data-game="colorclash" data-color="${c}" aria-label="${c}"></button>`).join('')}</div><button class="btn btn-sm btn-ghost" data-game="colorclash" data-cancel>Cancel</button></div>` : '';

  return {
    tone,
    turn,
    body: `${g.phase === 'over' ? winnerBanner(g.winnerId) : ''}
      <div class="seat-strip">${seats}</div>
      <div class="cc-table c-glow-${g.color}">
        <button class="cc-card back" data-game="colorclash" data-draw ${canDraw ? '' : 'disabled'} aria-label="Draw a card"><span>DRAW</span></button>
        <div class="cc-top">${ccCard(g.top, { cls: 'top-card' })}</div>
        <div class="cc-dir ${g.dir < 0 ? 'rev' : ''}" aria-label="Play direction"><svg viewBox="0 0 24 24" class="icon"><path d="M3 12a9 9 0 1 0 9-9 9.750 9.750 0 0 0-6.740 2.740L3 8"/><path d="M3 3v5h5"/></svg><small>${g.color}</small></div>
      </div>
      ${oneBtn ? `<div class="actions">${oneBtn}</div>` : ''}
      ${picker}
      <div class="cc-hand">${hand}</div>
      <div class="actions">
        ${g.drew != null ? '<button class="btn" data-game="colorclash" data-pass>Pass</button>' : ''}
        ${isHost() && g.phase === 'play' ? '<button class="btn btn-sm btn-ghost" data-game="colorclash" data-skip>Skip this turn</button>' : ''}
        ${g.phase === 'over' ? rematchBtn() : ''}
      </div>
      <div class="log-line">${g.log.slice(-2).map(esc).join(' · ')}</div>`,
  };
};
handlers.colorclash = d => {
  if ('card' in d) {
    const c = S.game.myHand.find(x => x.id === +d.card);
    if (c && c.c === 'wild') { ccPick = c.id; render(); return; }
    act({ type: 'play', card: +d.card });
  } else if ('color' in d) { act({ type: 'play', card: ccPick, color: d.color }); ccPick = null; render(); }
  else if ('cancel' in d) { ccPick = null; render(); }
  else if ('draw' in d) act({ type: 'draw' });
  else if ('pass' in d) act({ type: 'pass' });
  else if ('one' in d) act({ type: 'one' });
  else if ('catch' in d) act({ type: 'catch' });
  else if ('skip' in d) act({ type: 'skip' });
};
function clashAfter(g) {
  if (ccLastPlays !== null && g.plays !== ccLastPlays) {
    anim(document.querySelector('.top-card'), [{ transform: 'translateY(90px) rotate(-30deg) scale(1.3)', opacity: 0.4 }, { transform: 'none', opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.2,1.4,.4,1)' });
  }
  ccLastPlays = g.plays;
}

/* ======================= Four in a Row ======================= */
let c4Moves = null;
renderers.connect4 = () => {
  const g = S.game;
  const myTurn = g.turnId === S.you;
  const win = new Set((g.winLine || []).map(String));
  const cols = [0, 1, 2, 3, 4, 5, 6].map(c => {
    let slots = '';
    for (let r = 0; r < 6; r++) {
      const v = g.board[r][c];
      slots += `<span class="c4-slot">${v === null ? '' : `<i class="disc d${v} ${win.has(`${r},${c}`) ? 'won' : ''}" data-rc="${r},${c}"></i>`}</span>`;
    }
    return `<button class="c4-col" data-game="connect4" data-col="${c}" ${myTurn && g.board[0][c] === null ? '' : 'disabled'} aria-label="Drop in column ${c + 1}">${slots}</button>`;
  }).join('');
  const seats = g.players.map((p, i) => `<div class="seat ${p.id === g.turnId ? 'active' : ''}"><i class="disc key d${i}"></i><span><b>${esc(p.name)}</b>${p.id === S.you ? ' (you)' : ''}</span></div>`).join('');
  const over = g.phase === 'over';
  return {
    tone: over ? 'win' : myTurn ? 'mine' : '',
    turn: over ? (g.winnerId ? `${esc(nameOf(g.winnerId))} made four in a row!` : "It's a draw!") : myTurn ? 'Tap a column to drop your disc' : `${esc(nameOf(g.turnId))} is thinking…`,
    body: `${over ? winnerBanner(g.winnerId, !g.winnerId) : ''}
      <div class="seat-strip">${seats}</div>
      <div class="c4-board">${cols}</div>
      ${over ? `<div class="actions">${rematchBtn()}</div>` : ''}`,
  };
};
handlers.connect4 = d => { if ('col' in d) act({ type: 'drop', col: +d.col }); };
function c4After(g) {
  if (c4Moves !== null && g.moves > c4Moves && g.last) {
    const [r, c] = g.last;
    const disc = document.querySelector(`[data-rc="${r},${c}"]`);
    const h = disc ? disc.parentElement.getBoundingClientRect().height : 50;
    anim(disc, [
      { transform: `translateY(${-(r + 1) * h}px)` },
      { transform: 'translateY(0)', offset: 0.7 },
      { transform: 'translateY(-16%)', offset: 0.85 },
      { transform: 'translateY(0)' },
    ], { duration: 280 + r * 55, easing: 'cubic-bezier(.5,0,1,1)' });
  }
  c4Moves = g.moves;
}

/* ======================= Typing Arena ======================= */
const CAR_COL = ['#ff3d6e', '#38c6ff', '#ffc83d', '#2fe07f', '#b06bff', '#ff8a3d', '#ffffff', '#ff7ac0'];
const ty = { key: null, prog: {}, rain: {}, typed: '', errors: 0, total: 0, done: false };
// Our own side-view cars. Each player gets a model and a colour.
const CAR_MODELS = [
  { // hypercar with a rear wing
    body: 'M8 36V25L3 13h13l4 8 24-7c14-5 30-5 40 1l14 8c10 1 18 4 19 12l-2 1z',
    glass: 'M50 16c9-3 20-3 28 0l10 6H46z',
    extra: '<path d="M44 31l26-5-3 8H47z" fill="#120d2b" opacity=".75"/><path d="M3 13h13l1 2.500H4z" fill="#120d2b" opacity=".6"/>',
  },
  { // grand tourer
    body: 'M4 33c0-6 5-9 16-11 12-8 24-13 38-13h12c8 0 15 5 22 12 12 1 23 4 24 11l-1 3H5z',
    glass: 'M34 21c6-5 14-9 24-9h1v9zM62 12h7c6 0 11 4 16 9H62z',
    extra: '<path d="M42 31l12-4h20l-5 6H46z" fill="#120d2b" opacity=".65"/>',
  },
  { // muscle car with a racing stripe
    body: 'M3 35V25L1 17l9 5 24-2 11-9h28l12 9 24 2 8 5v8z',
    glass: 'M38 20l8-6h12v6zM61 14h11l8 6H61z',
    extra: '<path d="M3 27h114v3H3z" fill="#120d2b" opacity=".6"/><path d="M92 21h13l-3-4h-8z" fill="#120d2b" opacity=".75"/>',
  },
  { // classic roadster with a race number
    body: 'M4 33c0-9 9-14 24-15h60c16 0 28 6 28 15l-1 3H5z',
    glass: 'M62 18l5-7 2 1-3 6z',
    extra: '<circle cx="50" cy="13" r="6.500" fill="#f4f4f8"/><path d="M50 12h6.500v3H50z" fill="#120d2b"/><path d="M42 19h15v2H42z" fill="#120d2b" opacity=".5"/><circle cx="60" cy="27" r="6.500" fill="#fff"/><text x="60" y="31" font-family="Arial" font-size="10" font-weight="900" text-anchor="middle" fill="#120d2b">1</text>',
  },
  { // sports car with side graphics
    body: 'M4 32c1-6 8-9 19-11l19-9c8-3 22-3 30 0l17 9c12 1 23 4 27 11l-2 4H6z',
    glass: 'M38 21l7-7c8-2 17-2 24 0l12 7zM58 13v8',
    extra: '<path d="M24 28c20-6 40-6 60-3-16 1-30 4-44 9z" fill="#120d2b" opacity=".6"/>',
  },
  { // coupe with a rear spoiler
    body: 'M3 32v-7L2 19l7 3 17-3c7-6 17-10 31-10h6c9 0 16 5 23 12 12 1 27 4 31 10l-2 4H4z',
    glass: 'M33 20c6-5 14-8 24-8v8zM60 12h4c7 0 12 3 17 8H60z',
    extra: '<path d="M2 19h10l-1 2.500H3z" fill="#120d2b" opacity=".6"/>',
  },
];
function carWheel(x) {
  const spokes = [0, 60, 120].map(a => `<path d="M${x - 5.500} 33h11" stroke="#8d93a3" stroke-width="1.400" transform="rotate(${a} ${x} 33)"/>`).join('');
  return `<circle cx="${x}" cy="33" r="10" fill="#120d2b"/><g class="wheel"><circle cx="${x}" cy="33" r="8" fill="#17151f"/><circle cx="${x}" cy="33" r="5.500" fill="#d9dde6"/>${spokes}<circle cx="${x}" cy="33" r="1.500" fill="#23212c"/></g>`;
}
const carSvg = (c, model = 0) => {
  const m = CAR_MODELS[model % CAR_MODELS.length];
  return `<svg viewBox="0 0 120 44" aria-hidden="true"><defs><linearGradient id="carShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".4"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".4"/></linearGradient></defs>
    <ellipse cx="60" cy="41" rx="56" ry="3" fill="#000" opacity=".35"/><path d="${m.body}" fill="${c}"/><path d="${m.body}" fill="url(#carShade)"/>
    <path d="${m.glass}" fill="#1c2740" stroke="#1c2740" stroke-width=".6"/><path d="${m.glass}" fill="#9fd8ff" opacity=".22"/>${m.extra}
    <ellipse cx="113.500" cy="30" rx="3" ry="2" fill="#fff4b0"/><rect x="4" y="27" width="3.500" height="3" rx="1" fill="#ff2e4d"/>${carWheel(30)}${carWheel(92)}</svg>`;
};
const modeIcon = {
  kings: '<span class="scene kings"><i class="k a">♚</i><i class="bolt"></i><i class="k b">♚</i></span>',
  royal: '<span class="scene kings royal"><i class="k a">♛</i><i class="bolt"></i><i class="k b">♛</i></span>',
  raid: '<span class="scene raid"><i class="m">👹</i><i class="shot s1"></i><i class="shot s2"></i></span>',
  race: `<span class="scene race"><i class="sc-car a">${carSvg('#ff3d6e', 0)}</i><i class="sc-car b">${carSvg('#38c6ff', 1)}</i><i class="sc-road"></i></span>`,
  rain: '<span class="scene rain"><i>mango</i><i>rocket</i><i>tiger</i><i>dosa</i></span>',
  duel: '<span class="scene duel"><b>A</b><svg viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg><b>B</b></span>',
  blitz: '<span class="scene blitz"><i class="bz-w">tiger</i><i class="bz-r r1"><b></b></i><i class="bz-r r2"><b></b><svg class="bz-mini-crown" viewBox="0 0 20 14"><path d="M1 4l4.5 4L10 1l4.5 7L19 4l-2 9H3z"/></svg></i><i class="bz-r r3"><b></b></i></span>',
};
const typeAttrs = 'autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"';

function raceTextHtml(text, typed) {
  let good = 0;
  while (good < typed.length && typed[good] === text[good]) good++;
  const bad = typed.length - good;
  return `<span class="rt-good">${esc(text.slice(0, good))}</span><span class="rt-bad">${esc(text.slice(good, good + bad))}</span><span class="rt-caret"></span><span class="rt-rest">${esc(text.slice(good + bad))}</span>`;
}
const correctLen = (text, typed) => { let n = 0; while (n < typed.length && typed[n] === text[n]) n++; return n; };
const carLeft = (n, len) => `${Math.min(100, (n / Math.max(1, len)) * 100) * 0.86}%`;
const liveWpm = n => {
  const g = S.game;
  if (!g || !g.startedAt) return 0;
  const mins = Math.max(0.03, (serverNow() - g.startedAt) / 60000);
  return Math.round(n / 5 / mins);
};

// Word Blitz: the host's rounds choice before it starts
const bz = { setup: false, rounds: 10 };
const BZ_QUICK = [5, 10, 15, 20, 30];
const bzClamp = n => Math.max(1, Math.min(100, Math.round(Number(n)) || 1));

function blitzSetup() {
  return {
    tone: 'live',
    turn: 'Word Blitz — how many rounds?',
    body: `<div class="bz-setup">
        <div class="bz-setup-head">${modeIcon.blitz}<div><b>Word Blitz</b><small>Everyone gets the same word. The first to type it wins the round.</small></div></div>
        <span class="opt-label">Rounds</span>
        <div class="seg bz-seg">${BZ_QUICK.map(n => `<button class="${bz.rounds === n ? 'on' : ''}" data-game="typing" data-bz-rounds="${n}">${n}</button>`).join('')}</div>
        <label class="bz-custom">Or type any number (1–100) <input type="number" id="bzRounds" inputmode="numeric" min="1" max="100" step="1" value="${bz.rounds}" aria-label="Number of rounds"></label>
        <div class="actions"><button class="btn btn-ghost" data-game="typing" data-bz-cancel>Back</button><button class="btn btn-primary btn-lg" data-game="typing" data-bz-go>${icon('arrow')} <span id="bzGoText">Start ${bz.rounds} round${bz.rounds === 1 ? '' : 's'}</span></button></div>
      </div>`,
  };
}

function typingPick(g) {
  const host = isHost();
  if (host && bz.setup) return blitzSetup();
  const cards = g.modes.map(m => {
    const exact = m.exactPlayers && g.players.length !== m.exactPlayers;
    const few = m.minPlayers && g.players.length < m.minPlayers;
    const note = exact ? `Only when exactly ${m.exactPlayers} players are in the room` : few ? `Needs at least ${m.minPlayers} players` : m.tagline;
    return `<button class="mode-card ${m.id === 'blitz' ? 'mode-new' : ''}" ${exact || few || !host ? 'disabled' : ''} data-game="typing" data-choose-mode="${m.id}">
      ${modeIcon[m.id]}<b>${esc(m.name)}</b><small>${esc(note)}</small></button>`;
  }).join('');
  return {
    tone: host ? 'live' : '',
    turn: host ? 'Choose the typing game' : `${esc(nameOf(S.room.hostId))} is choosing the typing game…`,
    body: `<div class="mode-grid ${host ? '' : 'watching'}">${cards}</div>`,
  };
}

const placeName = n => `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] || 'th'}`;

function typingRace(g) {
  const len = g.text.length;
  const mine = g.finished[S.you];
  const lanes = g.players.map((p, i) => {
    const n = Math.max(ty.prog[p.id] || 0, g.prog[p.id] || 0);
    const f = g.finished[p.id];
    return `<div class="lane"><span class="lane-name">${esc(p.name)}${p.id === S.you ? ' (you)' : ''}</span>
      <span class="car ${f ? 'parked' : ''}" data-car="${p.id}" style="left:${carLeft(n, len)}">${carSvg(CAR_COL[i % CAR_COL.length], i)}</span>
      <span class="lane-wpm ${f ? 'placed' : ''}" data-wpm="${p.id}">${f ? placeName(f.place) : `${liveWpm(n)} wpm`}</span></div>`;
  }).join('');
  return {
    tone: mine ? 'win' : 'live',
    turn: mine ? `You finished ${placeName(mine.place)}! Waiting for the others` : 'Type the paragraph. First car home wins!',
    body: `<div class="track">${lanes}<div class="finish-line"></div></div>
      <div class="timebar"><span data-deadline="${g.timerAt}" data-total="${g.raceMs}"></span></div>
      ${mine ? '' : `<div class="race-text" id="raceText">${raceTextHtml(g.text, ty.typed)}</div>
      <input id="typeInput" class="type-input" ${typeAttrs} placeholder="Start typing here…" aria-label="Type the paragraph">
      <div class="type-stats"><span><b id="myWpm">0</b> wpm</span><span><b id="myAcc">100</b>% accuracy</span></div>`}`,
  };
}

const rainEl = { field: null, slotted: false };
function typingRain(g) {
  const me = ty.rain[S.you] || g.rain[S.you];
  const board = g.players.map(p => {
    const r = ty.rain[p.id] || g.rain[p.id] || { score: 0, lives: 5 };
    return `<div class="rain-row ${p.id === S.you ? 'me' : ''}" data-rain="${p.id}">${avatar(p.name)}<span class="nm">${esc(p.name)}</span><span class="hearts">${'♥'.repeat(r.lives)}</span><b>${r.score}</b></div>`;
  }).join('');
  return {
    tone: ty.done ? '' : 'live',
    turn: ty.done ? "You're out! Watching the others…" : 'Type the falling words before they land',
    body: `<div class="timebar"><span data-deadline="${g.timerAt}" data-total="${g.rainMs}"></span></div>
      <div id="rainSlot" class="rain-slot"></div>
      ${ty.done ? '' : `<input id="rainInput" class="type-input" ${typeAttrs} placeholder="Type a word…" aria-label="Type a falling word">`}
      <div class="rain-board">${board}</div>`,
  };
}

function typingDuel(g) {
  const solved = g.solvers.includes(S.you);
  const isSentence = !!g.word && g.word.includes(' ');
  const letters = !g.word ? '' : isSentence ? `<span class="duel-sentence">${esc(g.word)}</span>` : [...g.word].map((ch, i) => `<span style="--i:${i}">${esc(ch)}</span>`).join('');
  return {
    tone: g.gap ? 'win' : solved ? '' : 'live',
    turn: g.gap ? (g.solvers.length ? `${esc(nameOf(g.solvers[0]))} was fastest!` : 'Too slow — nobody got it') : solved ? 'Got it! Waiting…' : `${isSentence ? 'Sentence' : 'Word'} ${g.number} of ${g.of} — type it!`,
    body: `<div class="duel-word ${solved ? 'solved' : ''} ${isSentence ? 'sentence' : ''}">${letters}</div>
      ${g.gap ? '' : `<div class="timebar"><span data-deadline="${g.timerAt}" data-total="${g.duelMs}"></span></div>`}
      ${solved || g.gap ? '' : `<form data-duel-form><input id="duelInput" class="type-input" ${typeAttrs} placeholder="${isSentence ? 'Type the sentence…' : 'Type the word…'}" aria-label="Type the answer"></form>`}
      ${scoreboard(g.scores, { extra: { title: 'This round', value: id => (g.solvers.includes(id) ? `<span class="plus">${icon('check')}</span>` : '') } })}`,
  };
}

const bzs = { key: null, number: 0, typed: '', good: 0, sent: 0, prog: {}, fx: null, focus: null };
const BZ_FLAME = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-4 2-5 0 2 1 3 2 3 0-3-1-6 1-9z"/></svg>';
const BZ_CROWN = '<svg class="bz-crown" viewBox="0 0 20 14" aria-hidden="true"><path d="M1 4l4.5 4L10 1l4.5 7L19 4l-2 9H3z" fill="#ffc83d" stroke="#b77a00" stroke-width="1" stroke-linejoin="round"/></svg>';

function typingBlitz(g) {
  const b = g.blitz;
  const key = `${b.number}:${b.gap}`;
  const fresh = key !== bzs.key;
  bzs.key = key;
  if (b.number !== bzs.number) { bzs.number = b.number; bzs.typed = ''; bzs.good = 0; bzs.sent = 0; bzs.prog = {}; }
  const last = b.last;
  const myStreak = b.streak[S.you] || 0;
  const order = [...g.players].sort((x, y) => (g.scores[y.id] || 0) - (g.scores[x.id] || 0));
  const leader = order[0] && (g.scores[order[0].id] || 0) > 0 ? order[0].id : null;
  const pct = id => {
    if (!b.word) return 0;
    const n = id === S.you ? bzs.good : Math.max(bzs.prog[id] || 0, b.prog[id] || 0);
    return Math.round((n / b.word.length) * 100);
  };
  const tiles = order.map(p => {
    const won = b.gap && last && last.winner === p.id;
    const streak = b.streak[p.id] || 0;
    return `<div class="bz-pl ${p.id === S.you ? 'me' : ''} ${won ? 'won' : ''}" data-bz="${p.id}">
      ${leader === p.id ? BZ_CROWN : ''}${avatar(p.name)}<span class="bz-nm" title="${p.id === S.you ? 'You' : esc(p.name)}">${esc(p.name)}</span><b class="bz-sc">${g.scores[p.id] || 0}</b>
      <span class="bz-bar"><i style="width:${pct(p.id)}%"></i></span>${streak >= 2 ? `<span class="bz-fire">${BZ_FLAME}${streak}</span>` : ''}</div>`;
  }).join('');

  let card, turn, tone;
  if (!b.gap) {
    card = `<div class="bz-card"><div class="bz-word" id="bzWord">${[...b.word].map((ch, i) => `<span style="--i:${i}">${esc(ch)}</span>`).join('')}</div></div>`;
    turn = `Word ${b.number} of ${b.of} — first to type it wins!`;
    tone = 'live';
  } else if (last && last.winner) {
    const me = last.winner === S.you;
    card = `<div class="bz-card won"><div class="bz-win">${avatar(nameOf(last.winner))}
        <div><b>${me ? 'You got it!' : `${esc(nameOf(last.winner))} got it!`}</b><small>typed <em>${esc(last.word)}</em> in ${(last.ms / 1000).toFixed(1)}s</small></div>
        <span class="bz-plus">+${last.pts}</span>
        ${last.streak >= 2 ? `<span class="bz-streak">${BZ_FLAME} ${last.streak} in a row! +${last.pts - 100} bonus</span>` : ''}</div></div>`;
    turn = me ? 'You were the fastest!' : `${esc(nameOf(last.winner))} was the fastest!`;
    tone = me ? 'win' : '';
  } else {
    card = `<div class="bz-card miss"><div class="bz-miss"><b>Time's up!</b><small>The word was <em>${esc(last ? last.word : '')}</em></small></div></div>`;
    turn = 'Nobody got that one';
    tone = 'alert';
  }
  return {
    tone,
    turn,
    body: `<div class="bz ${fresh ? 'bz-fresh' : ''}">
        <div class="bz-top"><span class="bz-round">Word <b>${b.number}</b> of ${b.of}</span>${myStreak >= 2 ? `<span class="bz-mystreak">${BZ_FLAME} ${myStreak} in a row</span>` : ''}</div>
        ${card}
        <div class="timebar bz-time">${b.gap ? '' : `<span data-deadline="${b.endsAt}" data-total="${b.roundMs}"></span>`}</div>
        <input id="bzInput" class="type-input bz-input" ${typeAttrs} ${b.gap ? 'disabled placeholder="Next word coming…"' : 'placeholder="Type it here, fast!"'} aria-label="Type the word" value="${b.gap ? '' : esc(bzs.typed)}">
        <div class="bz-players">${tiles}</div>
      </div>`,
  };
}

// colour the big word as you type: green while right, red at the first mistake
function bzPaint(word, value) {
  const box = $('#bzWord');
  const val = value.toLowerCase();
  let good = 0;
  while (good < val.length && val[good] === word[good]) good++;
  const bad = val.length > good;
  bzs.good = good;
  if (box) [...box.children].forEach((sp, i) => { sp.classList.toggle('ok', i < good); sp.classList.toggle('bad', bad && i === good); });
  const input = $('#bzInput');
  if (input) input.classList.toggle('bad', bad);
  const mine = document.querySelector(`[data-bz="${S.you}"] .bz-bar i`);
  if (mine) mine.style.width = `${Math.round((good / word.length) * 100)}%`;
  return good;
}

function onBlitzInput(el) {
  const b = S.game && S.game.blitz;
  if (!b || !b.word) return;
  SFX.play('key');
  bzs.typed = el.value;
  const good = bzPaint(b.word, el.value);
  if (good !== bzs.sent) { bzs.sent = good; socket.emit('stream', { t: 'b', n: good }); }
  if (el.value.trim().toLowerCase() === b.word) act({ type: 'blitz', text: el.value });
}

function blitzAfter(g) {
  const b = g.blitz;
  if (!b) return;
  if (g.phase === 'play' && b.word) {
    const input = $('#bzInput');
    if (input) {
      if (bzs.focus !== b.number) { bzs.focus = b.number; input.focus(); }
      if (input.value) bzPaint(b.word, input.value);
    }
  }
  if (b.gap) { const input = $('#bzInput'); if (input) input.value = ''; }
  const fx = `${b.number}:${b.gap}`;
  if (b.gap && bzs.fx !== fx) {
    bzs.fx = fx;
    if (b.last && b.last.winner) {
      const el = document.querySelector('.bz-pl.won');
      if (el && typeof FX !== 'undefined') FX.burst(el, ['#ffc83d', '#2fe07f', '#ffffff', '#ff2e93']);
      if (b.last.winner === S.you && window.SFX) SFX.play('correct');
    } else if (typeof FX !== 'undefined') FX.shake();
  }
}

function typingOver(g) {
  const rows = g.results;
  const battle = !!g.battle;
  const val = r => (g.mode === 'race' ? `${r.wpm} wpm` : g.mode === 'royal' ? `${r.score} round${r.score === 1 ? '' : 's'}` : battle ? `${r.score} dmg` : `${r.score} pts`);
  const sub = r => (g.mode === 'blitz' ? `${r.wins} word${r.wins === 1 ? '' : 's'}${r.best >= 2 ? ` · best streak ${r.best}` : ''}` : g.mode === 'race' ? (r.done ? `${(r.ms / 1000).toFixed(1)}s · ${r.acc}% accuracy` : `${r.pct}% done`) : g.mode === 'rain' ? `${r.lives} lives left` : g.mode === 'royal' ? '' : battle ? `${r.words} word${r.words === 1 ? '' : 's'}` : '');
  const podium = [1, 0, 2].map(i => rows[i]).filter(Boolean).map(r => {
    const place = rows.indexOf(r) + 1;
    return `<div class="pod pod${place}">${avatar(nameOf(r.id))}<b>${esc(nameOf(r.id))}</b><small>${val(r)}</small><div class="pod-bar"><span>${place}</span></div></div>`;
  }).join('');
  const table = rows.map((r, i) => `<tr class="${r.id === S.you ? 'me' : ''}"><td class="rank">${i + 1}</td><td><span class="pcell">${avatarOf(r.id)}${esc(nameOf(r.id))}</span></td><td class="num">${sub(r)}</td><td class="num"><b>${val(r)}</b></td></tr>`).join('');
  return {
    tone: 'win',
    turn: battle ? battleHeadline(g) : `${esc(nameOf(rows[0].id))} wins ${esc(g.modes.find(m => m.id === g.mode).name)}!`,
    body: `<div class="podium">${podium}</div><table class="scoreboard">${table}</table>
      <div class="actions">${isHost() ? `<button class="btn btn-primary btn-lg" data-game="typing" data-again>${icon('rotate')} Pick another challenge</button>` : ''}</div>`,
  };
}

renderers.typing = () => {
  const g = S.game;
  if (g.phase === 'pick') return typingPick(g);
  if (g.phase === 'over') return typingOver(g);
  if (g.phase === 'countdown' && g.battle) return battleVs(g);
  if (g.phase === 'countdown') {
    const m = g.modes.find(x => x.id === g.mode);
    return { tone: 'live', turn: `${esc(m.name)} — get your fingers ready`, body: `<div class="count-wrap"><div class="count-big" data-deadline="${g.timerAt}"></div><b>${esc(m.name)}</b><small>${esc(m.tagline)}</small></div>` };
  }
  if (g.battle) return typingBattle(g);
  if (g.mode === 'blitz' && g.blitz) return typingBlitz(g);
  return g.mode === 'race' ? typingRace(g) : g.mode === 'rain' ? typingRain(g) : typingDuel(g);
};
handlers.typing = d => {
  if ('chooseMode' in d) {
    if (d.chooseMode === 'blitz') { bz.setup = true; render(); return; }
    act({ type: 'choose', mode: d.chooseMode });
  } else if ('bzRounds' in d) { bz.rounds = bzClamp(d.bzRounds); render(); }
  else if ('bzCancel' in d) { bz.setup = false; render(); }
  else if ('bzGo' in d) { bz.setup = false; act({ type: 'choose', mode: 'blitz', rounds: bz.rounds }); }
  else if ('again' in d) act({ type: 'again' });
};
// typed rounds update the start button without redrawing, so the box keeps focus
$('#stage').addEventListener('input', e => {
  if (e.target.id !== 'bzRounds') return;
  if (e.target.value === '') return;
  bz.rounds = bzClamp(e.target.value);
  const t = $('#bzGoText');
  if (t) t.textContent = `Start ${bz.rounds} round${bz.rounds === 1 ? '' : 's'}`;
  document.querySelectorAll('[data-bz-rounds]').forEach(b => b.classList.toggle('on', +b.dataset.bzRounds === bz.rounds));
});
$('#stage').addEventListener('change', e => { if (e.target.id === 'bzRounds') e.target.value = bz.rounds; });

// live updates from other players, without re-rendering the page
socket.on('stream', d => {
  if (!S || !S.game || S.game.gameId !== 'typing') return;
  if (d.t === 'b') {
    const b = S.game.blitz;
    if (!b || !b.word || d.i !== b.number - 1) return;
    bzs.prog[d.id] = d.n;
    const bar = document.querySelector(`[data-bz="${d.id}"] .bz-bar i`);
    if (bar) bar.style.width = `${Math.round((d.n / b.word.length) * 100)}%`;
    return;
  }
  if (d.t === 'p') {
    ty.prog[d.id] = d.n;
    const car = document.querySelector(`[data-car="${d.id}"]`);
    if (car && S.game.text) car.style.left = carLeft(d.n, S.game.text.length);
  } else if (d.t === 's') {
    ty.rain[d.id] = { score: d.score, lives: d.lives };
    paintRainRow(d.id);
  }
});

function paintRainRow(id) {
  const row = document.querySelector(`[data-rain="${id}"]`);
  const r = ty.rain[id];
  if (!row || !r) return;
  row.querySelector('.hearts').textContent = '♥'.repeat(r.lives);
  row.querySelector('b').textContent = r.score;
}

// long paragraphs scroll by themselves so the next letter is always in view
function raceFollow() {
  const box = $('#raceText');
  const caret = box && box.querySelector('.rt-caret');
  if (caret) box.scrollTop = Math.max(0, caret.offsetTop - box.clientHeight / 2);
}
afterRender.push(raceFollow);

// Car Race typing
function onRaceInput(input) {
  const g = S.game;
  const prev = ty.typed;
  const typed = input.value;
  if (typed.length > prev.length) {
    ty.total += typed.length - prev.length;
    if (correctLen(g.text, typed) < typed.length && correctLen(g.text, prev) === prev.length) {
      ty.errors++;
      anim(input, [{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], { duration: 140 });
      SFX.play('tick');
    } else SFX.play('key');
  }
  ty.typed = typed;
  const n = correctLen(g.text, typed);
  input.classList.toggle('bad', n < typed.length);
  const box = $('#raceText');
  if (box) {
    box.innerHTML = raceTextHtml(g.text, typed);
    raceFollow();
  }
  ty.prog[S.you] = n;
  const car = document.querySelector(`[data-car="${S.you}"]`);
  if (car) car.style.left = carLeft(n, g.text.length);
  const acc = ty.total ? Math.round(((ty.total - ty.errors) / ty.total) * 100) : 100;
  const accEl = $('#myAcc');
  if (accEl) accEl.textContent = acc;
  socket.emit('stream', { t: 'p', n });
  if (typed === g.text) act({ type: 'finished', typed, acc });
}

// live wpm numbers
setInterval(() => {
  const g = S && S.game;
  if (!g || g.gameId !== 'typing' || g.phase !== 'play' || g.mode !== 'race') return;
  const w = $('#myWpm');
  if (w) w.textContent = liveWpm(ty.prog[S.you] || 0);
  for (const p of g.players) {
    if (g.finished[p.id]) continue;
    const el = document.querySelector(`[data-wpm="${p.id}"]`);
    if (el) el.textContent = `${liveWpm(Math.max(ty.prog[p.id] || 0, g.prog[p.id] || 0))} wpm`;
  }
}, 500);

// Word Rain: runs on its own loop inside a field that survives re-renders
const rain = { running: false, active: [], next: 0, score: 0, lives: 5, combo: 0 };
function rainStart(g) {
  if (!rainEl.field) {
    rainEl.field = document.createElement('div');
    rainEl.field.className = 'rain-field';
  }
  rainEl.field.innerHTML = '<div class="rain-ground"></div><div class="rain-hud"></div>';
  rain.active = [];
  rain.next = 0;
  rain.score = 0;
  rain.lives = 5;
  rain.combo = 0;
  rain.running = true;
  requestAnimationFrame(rainLoop);
}
function rainHud() {
  const hud = rainEl.field.querySelector('.rain-hud');
  hud.innerHTML = `<b>${rain.score}</b>${rain.combo > 1 ? `<em>x${rain.combo} combo</em>` : ''}<span>${'♥'.repeat(rain.lives)}</span>`;
}
function rainSync() {
  ty.rain[S.you] = { score: rain.score, lives: rain.lives };
  paintRainRow(S.you);
  socket.emit('stream', { t: 's', score: rain.score, lives: rain.lives });
  rainHud();
}
function rainPaintWord(w, val) {
  const hit = val && w.w.startsWith(val) ? val.length : 0;
  w.el.innerHTML = `<b>${esc(w.w.slice(0, hit))}</b>${esc(w.w.slice(hit))}`;
  w.el.classList.toggle('target', hit > 0);
}
function rainLoop() {
  const g = S && S.game;
  if (!g || g.gameId !== 'typing' || g.mode !== 'rain' || g.phase !== 'play' || !rain.running) { rain.running = false; return; }
  const t = serverNow() - g.startedAt;
  const H = rainEl.field.clientHeight || 300;
  while (rain.next < g.words.length && g.words[rain.next].at <= t) {
    const def = g.words[rain.next++];
    const el = document.createElement('span');
    el.className = 'rain-word';
    el.style.left = `${def.x}%`;
    el.textContent = def.w;
    rainEl.field.appendChild(el);
    rain.active.push({ ...def, el });
  }
  for (const w of [...rain.active]) {
    const y = ((t - w.at) / w.fall) * (H - 34);
    w.el.style.transform = `translateY(${y}px)`;
    if (y >= H - 34) {
      w.el.remove();
      rain.active = rain.active.filter(x => x !== w);
      if (!ty.done) {
        rain.lives = Math.max(0, rain.lives - 1);
        rain.combo = 0;
        SFX.play('fail');
        FX.shake();
        rainSync();
        if (!rain.lives) {
          ty.done = true;
          act({ type: 'rainOut', score: rain.score });
          render();
        }
      }
    }
  }
  requestAnimationFrame(rainLoop);
}
function onRainInput(input) {
  const val = input.value.trim().toLowerCase();
  const hit = rain.active.find(w => w.w === val);
  if (hit) {
    rain.combo++;
    const pts = hit.w.length * 10 + (rain.combo - 1) * 5;
    rain.score += pts;
    SFX.play('correct');
    FX.burst(hit.el, ['#2fe07f', '#38c6ff', '#ffc83d', '#ffffff']);
    hit.el.remove();
    rain.active = rain.active.filter(x => x !== hit);
    input.value = '';
    rain.active.forEach(w => rainPaintWord(w, ''));
    rainSync();
    return;
  }
  if (val && !rain.active.some(w => w.w.startsWith(val))) {
    rain.combo = 0;
    input.value = '';
    anim(input, [{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], { duration: 140 });
    SFX.play('tick');
    rainHud();
    rain.active.forEach(w => rainPaintWord(w, ''));
    return;
  }
  SFX.play('key');
  rain.active.forEach(w => rainPaintWord(w, val));
}

$('#stage').addEventListener('input', e => {
  if (e.target.id === 'typeInput') onRaceInput(e.target);
  else if (e.target.id === 'rainInput') onRainInput(e.target);
  else if (e.target.id === 'bzInput') onBlitzInput(e.target);
  else if (e.target.id === 'duelInput') {
    const g = S.game;
    SFX.play('key');
    if (g.word && e.target.value.trim().toLowerCase() === g.word) { act({ type: 'duel', text: e.target.value }); e.target.value = ''; }
  }
});
$('#stage').addEventListener('paste', e => { if (e.target.classList && e.target.classList.contains('type-input')) e.preventDefault(); });
$('#stage').addEventListener('submit', e => {
  if (!e.target.matches('[data-duel-form]')) return;
  e.preventDefault();
  const input = $('#duelInput');
  if (input.value.trim()) act({ type: 'duel', text: input.value });
  input.value = '';
});

function typingAfter(g) {
  const key = `${g.mode}:${g.startedAt}`;
  if (g.phase === 'play' && ty.key !== key) {
    ty.key = key;
    ty.prog = {};
    ty.rain = {};
    ty.typed = '';
    ty.errors = 0;
    ty.total = 0;
    ty.done = false;
    if (g.mode === 'rain') rainStart(g);
    const input = document.querySelector('.type-input');
    if (input) input.focus();
    const raceBox = $('#raceText');
    if (raceBox && g.text) raceBox.innerHTML = raceTextHtml(g.text, '');
  }
  if (g.phase === 'play' && g.mode === 'rain') {
    const slot = $('#rainSlot');
    if (slot && rainEl.field) { slot.appendChild(rainEl.field); rainHud(); }
    if (!rain.running && !ty.done) { rain.running = true; requestAnimationFrame(rainLoop); }
  }
  if (g.phase === 'play' && g.mode === 'race') {
    const input = $('#typeInput');
    if (input && input.value !== ty.typed) input.value = ty.typed;
    if (input && document.activeElement !== input) input.focus();
  }
  if (g.phase === 'play' && g.mode === 'duel') {
    const input = $('#duelInput');
    if (input && document.activeElement !== input) input.focus();
  }
  if (g.mode === 'blitz') blitzAfter(g);
  if (g.phase !== 'pick') bz.setup = false;
}

afterRender.push(() => {
  const g = S && S.game;
  if (!g) { lastRolls = null; ccLastPlays = null; c4Moves = null; ccPick = null; return; }
  if (g.gameId === 'ludo') { spinDie(g); ludoAfter(g); }
  else if (g.gameId === 'snakes') { spinDie(g); snakesAfter(g); }
  else lastRolls = null;
  if (g.gameId === 'colorclash') clashAfter(g);
  if (g.gameId === 'connect4') c4After(g);
  if (g.gameId === 'typing') typingAfter(g);
});
