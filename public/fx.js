/* Game-world effects: animated background, roll-for-a-game die, tile tilt, confetti,
   screen shake, turn banners, score pop-ups. All transform/opacity only, and everything
   that moves is skipped when the device asks for reduced motion. */
const FX = (() => {
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const phone = () => matchMedia('(max-width: 900px)').matches;

  /* ---------- background world ---------- */
  const PIECES = [
    // die
    '<svg viewBox="0 0 48 48"><rect x="5" y="5" width="38" height="38" rx="9" fill="#ffd84d"/><g fill="#4312b8"><circle cx="16" cy="16" r="4"/><circle cx="32" cy="16" r="4"/><circle cx="24" cy="24" r="4"/><circle cx="16" cy="32" r="4"/><circle cx="32" cy="32" r="4"/></g></svg>',
    // playing card
    '<svg viewBox="0 0 48 48"><rect x="10" y="3" width="28" height="42" rx="5" fill="#fff"/><path d="M24 15c-4-7-13-2-9 5 2 4 6 7 9 11 3-4 7-7 9-11 4-7-5-12-9-5z" fill="#ff2e63"/></svg>',
    // token
    '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="20" fill="#38c6ff"/><circle cx="24" cy="24" r="13" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="5 4"/><circle cx="18" cy="16" r="4" fill="#fff" opacity=".7"/></svg>',
    // cricket ball
    '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="20" fill="#e5284f"/><path d="M12 8c8 8 16 24 24 32" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="3 3"/></svg>',
    // paper chit
    '<svg viewBox="0 0 48 48"><path d="M6 12l36-4 2 28-36 4z" fill="#fff6d6"/><path d="M12 20l24-3M13 28l16-2" stroke="#5b21ff" stroke-width="3" stroke-linecap="round"/></svg>',
    // cowrie shell
    '<svg viewBox="0 0 48 48"><ellipse cx="24" cy="24" rx="15" ry="21" fill="#fff3d6"/><path d="M24 7v34" stroke="#a98250" stroke-width="4" stroke-dasharray="3 3"/></svg>',
    // pencil
    '<svg viewBox="0 0 48 48"><path d="M8 40l4-13L33 6l9 9-21 21z" fill="#2fe07f"/><path d="M8 40l4-13 9 9z" fill="#ffe0b0"/></svg>',
    // star
    '<svg viewBox="0 0 48 48"><path d="M24 4l6 13 14 2-10 10 2 14-12-7-12 7 2-14L4 19l14-2z" fill="#ffc83d"/></svg>',
  ];

  function buildWorld() {
    const w = document.createElement('div');
    w.id = 'world';
    w.setAttribute('aria-hidden', 'true');
    const count = phone() ? 7 : 12;
    let pieces = '';
    for (let i = 0; i < count; i++) {
      const left = (i / count) * 100 + Math.random() * (60 / count);
      const size = 26 + Math.random() * 34;
      const dur = 18 + Math.random() * 20;
      pieces += `<span class="piece" style="left:${left}%;width:${size}px;height:${size}px;animation-duration:${dur}s;animation-delay:-${Math.random() * dur}s;--spin:${Math.random() > 0.5 ? 360 : -360}deg">${PIECES[i % PIECES.length]}</span>`;
    }
    w.innerHTML = `<div class="aurora a1"></div><div class="aurora a2"></div><div class="stars"></div><div class="floor"><div class="floor-grid"></div></div>${pieces}`;
    document.body.prepend(w);
  }

  // the world is lively on the home page and quiet during a game
  function syncWorld() {
    document.body.classList.toggle('in-room', $('#home').classList.contains('hidden'));
  }
  new MutationObserver(syncWorld).observe($('#home'), { attributes: true, attributeFilter: ['class'] });

  /* ---------- 3D die: roll to pick a random game ---------- */
  const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
  const FACE_ROT = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };

  function buildDie() {
    const cube = $('#cube');
    if (!cube) return;
    cube.innerHTML = [1, 2, 3, 4, 5, 6].map(n => `<div class="face f${n}">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(c => `<i class="${PIPS[n].includes(c) ? 'on' : ''}"></i>`).join('')}</div>`).join('');
  }

  let rolling = false;
  let turns = 0;
  function rollForGame() {
    if (rolling) return;
    const tiles = [...document.querySelectorAll('[data-howto-home]')];
    if (!tiles.length) return;
    const chosen = tiles[Math.floor(Math.random() * tiles.length)];
    if (calm()) { chosen.click(); return; }
    rolling = true;
    SFX.play('shells');
    const cube = $('#cube');
    const n = 1 + Math.floor(Math.random() * 6);
    const [rx, ry] = FACE_ROT[n];
    turns += 2;
    cube.classList.remove('idle');
    cube.style.transform = `rotateX(${rx + turns * 360}deg) rotateY(${ry + turns * 360}deg)`;
    // light up tiles like a roulette, slowing down, ending on the chosen game
    let delay = 70, step = 0, lit = null;
    const total = 13;
    const tick = () => {
      if (lit) lit.classList.remove('lit');
      lit = step === total ? chosen : tiles[Math.floor(Math.random() * tiles.length)];
      lit.classList.add('lit');
      SFX.play('tick');
      if (step === total) {
        SFX.play('reveal');
        burst(lit);
        setTimeout(() => { lit.classList.remove('lit'); chosen.click(); rolling = false; }, 520);
        return;
      }
      step++;
      delay *= 1.17;
      setTimeout(tick, delay);
    };
    tick();
  }

  /* ---------- tile tilt + shine (mouse only) ---------- */
  function initTilt() {
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    document.addEventListener('pointermove', e => {
      const t = e.target.closest && e.target.closest('.tile:not(:disabled)');
      if (!t || calm()) return;
      const r = t.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      t.style.setProperty('--ry', `${(x - 0.5) * 16}deg`);
      t.style.setProperty('--rx', `${(0.5 - y) * 16}deg`);
      t.style.setProperty('--mx', `${x * 100}%`);
      t.style.setProperty('--my', `${y * 100}%`);
    });
    document.addEventListener('pointerout', e => {
      const t = e.target.closest && e.target.closest('.tile');
      if (t && !t.contains(e.relatedTarget)) { t.style.removeProperty('--rx'); t.style.removeProperty('--ry'); }
    });
  }

  /* ---------- confetti ---------- */
  const COLORS = ['#ffc83d', '#ff2e93', '#38c6ff', '#2fe07f', '#a26bff', '#ffffff'];
  let canvas, ctx, parts = [], raf = null;

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.className = 'fx-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
  }

  function frame() {
    const W = canvas.width = innerWidth, H = canvas.height = innerHeight;
    ctx.clearRect(0, 0, W, H);
    parts = parts.filter(p => p.y < H + 30 && p.life > 0);
    for (const p of parts) {
      p.vy += 0.16;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.a += p.va;
      p.life -= 1;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.a);
      ctx.globalAlpha = Math.min(1, p.life / 30);
      ctx.fillStyle = p.c;
      ctx.scale(1, Math.abs(Math.cos(p.a * 2)) * 0.9 + 0.1); // flutter
      if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.s / 2, 0, 7); ctx.fill(); }
      else ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s / 1.5);
      ctx.restore();
    }
    if (parts.length) raf = requestAnimationFrame(frame);
    else { raf = null; ctx.clearRect(0, 0, W, H); }
  }

  function spawn(x, y, n, spread, power, colors) {
    if (calm() || document.hidden) return;
    ensureCanvas();
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * spread;
      const v = power * (0.45 + Math.random() * 0.75);
      parts.push({
        x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v,
        a: Math.random() * 6, va: (Math.random() - 0.5) * 0.35,
        s: 6 + Math.random() * 7, c: colors[Math.floor(Math.random() * colors.length)],
        round: Math.random() < 0.25, life: 170 + Math.random() * 70,
      });
    }
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function confetti(colors = COLORS) {
    const n = phone() ? 45 : 80;
    spawn(innerWidth * 0.2, innerHeight * 0.9, n, 1.1, 17, colors);
    spawn(innerWidth * 0.8, innerHeight * 0.9, n, 1.1, 17, colors);
  }

  function burst(el, colors = COLORS) {
    const r = el ? el.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
    spawn(r.left + r.width / 2, r.top + r.height / 2, phone() ? 18 : 30, 6.2, 8, colors);
  }

  /* ---------- screen effects ---------- */
  function classOnce(el, cls) {
    if (!el || calm()) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
  }

  const shake = () => classOnce($('#stage'), 'fx-shake');

  function overlay(cls, html, ms) {
    const el = document.createElement('div');
    el.className = cls;
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = html;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), ms);
    return el;
  }

  const flash = color => { if (!calm()) overlay('fx-flash', '', 500).style.setProperty('--flash', color); };

  function banner(text, cls = '') {
    if (calm()) return;
    overlay(`fx-banner ${cls}`, `<span>${esc(text)}</span>`, 1200);
  }

  function splash(g) {
    if (calm()) return;
    overlay('fx-splash', `<div class="splash-card"><div class="splash-art">${thumb(g.id)}</div><b>${esc(g.name)}</b><small>Get ready!</small></div>`, 1500);
  }

  function scorePop(n) {
    if (calm()) return;
    overlay('fx-score', `<span>+${n}</span>`, 1300);
  }

  /* ---------- reacting to game events ---------- */
  let pending = null; // an animation for an element that only exists after the next render

  const ELEMENT_FX = {
    shells: ['.shell-tray', 'fx-tray'],
    call: ['.ball:not(.sm)', 'fx-pop'],
    bid: ['.cur-bid', 'fx-bump'],
    paper: ['.show-hand', 'fx-shuffle'],
    card: ['.table-area .slot:nth-child(3)', 'fx-pop'],
    place: ['.dadi-board', 'fx-tap'],
  };

  function cue(type) {
    if (ELEMENT_FX[type]) pending = ELEMENT_FX[type];
    switch (type) {
      case 'win': confetti(); break;
      case 'go': banner('GO!', 'mine'); break;
      case 'sold': {
        const g = S && S.game;
        const t = g && g.last && g.last.team && g.teams.find(x => x.id === g.last.team);
        confetti(t ? [t.color, t.ink, '#ffc83d', '#ffffff'] : COLORS);
        shake();
        break;
      }
      case 'unsold': shake(); break;
      case 'correct': burst($('.feed'), ['#2fe07f', '#ffffff', '#ffc83d']); flash('rgba(47,224,127,.22)'); break;
      case 'reveal': burst($('.turn-bar')); break;
      case 'fail': shake(); flash('rgba(255,77,109,.3)'); break;
      case 'buzzer': shake(); flash('rgba(255,200,61,.3)'); break;
      case 'cut': shake(); flash('rgba(255,46,147,.25)'); break;
    }
  }

  const turn = () => banner('YOUR TURN!', 'mine');

  // after every render: entrance animations (only when the screen really changed), splash, score pop
  let lastScreen = null, lastGameId = null, lastScores = null, firstRender = true;
  const POP_SCORES = new Set(['pictionary', 'emojimovie', 'show', 'ramsita']);

  function afterEachRender() {
    const g = S && S.game;
    const key = g ? [g.gameId, g.phase, g.round, g.lotNumber, g.number].join(':') : 'lobby';
    if (key !== lastScreen) {
      lastScreen = key;
      if (!calm()) {
        const st = $('#stage');
        st.classList.remove('screen-enter');
        void st.offsetWidth;
        st.classList.add('screen-enter');
        clearTimeout(afterEachRender.t);
        afterEachRender.t = setTimeout(() => st.classList.remove('screen-enter'), 900);
      }
    }
    const gid = g ? g.gameId : null;
    if (gid && gid !== lastGameId && !firstRender) {
      const info = S.room.games.find(x => x.id === gid);
      if (info) { splash(info); SFX.play('reveal'); }
    }
    lastGameId = gid;
    firstRender = false;

    if (g && g.scores && POP_SCORES.has(gid)) {
      const mine = g.scores[S.you] || 0;
      if (lastScores && lastScores.gid === gid && mine > lastScores.mine) scorePop(mine - lastScores.mine);
      lastScores = { gid, mine };
    } else lastScores = null;

    if (pending) {
      const [sel, cls] = pending;
      pending = null;
      classOnce(document.querySelector(sel), cls);
    }
  }

  /* ---------- wiring ---------- */
  function init() {
    buildWorld();
    buildDie();
    initTilt();
    syncWorld();
    afterRender.push(afterEachRender);
    const roll = $('#rollBtn');
    if (roll) roll.onclick = rollForGame;
    const die = $('#dieBtn');
    if (die) die.onclick = rollForGame;
    // every button answers a tap with a small sound
    document.addEventListener('pointerdown', e => {
      if (e.target.closest && e.target.closest('.btn:not(:disabled), .tile:not(:disabled), .seg button, .tabbar button')) SFX.play('tap');
    });
    const logo = $('#logoWord');
    if (logo) logo.innerHTML = [...'GAMEHUB'].map((ch, i) => `<span style="--i:${i}">${ch}</span>`).join('');
  }
  init();

  return { cue, turn, confetti, burst, shake };
})();
