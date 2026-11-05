/* Typing Arena battles: Kings' Battle and Monster Raid. Words become champion attacks. */
/* Every king has four attacks, one chosen at random for each word, and a 5-word streak ultimate.
   fx picks the animation; shape and colour make it theirs. Damage depends only on the word. */
const HERO = {
  aldric: { name: 'King Aldric', title: 'The Old Crown', color: '#ffc83d', attacks: [
    { name: 'Scepter Spark', fx: 'throw', shape: 'orb', color: '#ffd76a' },
    { name: 'Royal Decree', fx: 'ring', color: '#ffc83d' },
    { name: 'Golden Tribute', fx: 'volley', shape: 'coin', color: '#ffc83d', n: 6 },
    { name: 'Scepter Slam', fx: 'dash', color: '#ffe27a' },
  ], ult: { name: "Crown's Judgement", fx: 'rain', shape: 'coin', color: '#ffc83d', n: 12 } },
  rowan: { name: 'King Rowan', title: 'The Scarlet Sovereign', color: '#e5284f', attacks: [
    { name: 'Mace Smash', fx: 'dash', color: '#ffb300' },
    { name: 'Golden Orb Cannon', fx: 'throw', shape: 'orb', color: '#ffb300', size: 70 },
    { name: 'Scarlet Slash', fx: 'throw', shape: 'crescent', color: '#ff2e4d', size: 70, straight: true },
    { name: 'Royal Charge', fx: 'dash', color: '#ff2e4d', n: 2 },
  ], ult: { name: 'Scarlet Cape Storm', fx: 'volley', shape: 'crescent', color: '#ff2e4d', n: 7 } },
  astra: { name: 'Astra', title: 'The Star King', color: '#8f7bff', attacks: [
    { name: 'Star Shot', fx: 'volley', shape: 'star', color: '#ffe27a', n: 3 },
    { name: 'Constellation Beam', fx: 'beam', color: '#8f7bff' },
    { name: 'Comet Toss', fx: 'throw', shape: 'star', color: '#ffe27a', size: 72 },
    { name: 'Starquake', fx: 'quake', color: '#8f7bff', n: 5 },
  ], ult: { name: 'Falling Stars', fx: 'rain', shape: 'star', color: '#ffe27a', n: 14 } },
  florian: { name: 'Prince Florian', title: 'The Rose Prince', color: '#ff5c8a', attacks: [
    { name: 'Thorn Rose', fx: 'throw', shape: 'rose', color: '#e5284f' },
    { name: 'Petal Storm', fx: 'volley', shape: 'petal', color: '#ff7aa8', n: 9 },
    { name: 'Rose Volley', fx: 'volley', shape: 'rose', color: '#e5284f', n: 4 },
    { name: 'Vine Whip', fx: 'quake', color: '#37a84a', n: 5 },
  ], ult: { name: 'Garden of Thorns', fx: 'quake', color: '#37a84a', n: 7, then: { fx: 'rain', shape: 'petal', color: '#ff7aa8', n: 12 } } },
  darius: { name: 'Darius', title: 'The Griffin Spear', color: '#e0902a', attacks: [
    { name: 'Spear Thrust', fx: 'dash', color: '#e8eefc' },
    { name: 'Spear Throw', fx: 'throw', shape: 'spear', color: '#d7dcea', size: 110, straight: true },
    { name: 'Shield Charge', fx: 'dash', color: '#ffb340', n: 2 },
    { name: 'Griffin Feathers', fx: 'volley', shape: 'petal', color: '#ffb340', n: 6 },
  ], ult: { name: 'Griffin Dive', fx: 'summon', shape: 'griffin', color: '#ffb340' } },
  solaris: { name: 'Solaris', title: 'The Sun King', color: '#ffd23f', attacks: [
    { name: 'Sun Blade', fx: 'dash', color: '#ffe27a' },
    { name: 'Solar Flare', fx: 'beam', color: '#ffb300' },
    { name: 'Sun Shield', fx: 'throw', shape: 'sun', color: '#ffd23f', size: 66 },
    { name: 'Sunburst', fx: 'ring', color: '#ffd23f' },
  ], ult: { name: 'Second Sun', fx: 'rain', shape: 'sun', color: '#ffd23f', n: 1, size: 130 } },
  leonix: { name: 'Leonix', title: 'The Lion Warlord', color: '#d4a93a', attacks: [
    { name: 'Claw Swipe', fx: 'dash', color: '#fff3c4', n: 2 },
    { name: 'Hammer Toss', fx: 'throw', shape: 'hammer', color: '#c79c3a', size: 66 },
    { name: 'Ground Slam', fx: 'quake', color: '#c97a2a', n: 5 },
    { name: 'Lion Roar', fx: 'ring', color: '#d4a93a' },
  ], ult: { name: 'Earthbreaker', fx: 'leap', color: '#c97a2a' } },
  crimson: { name: 'Crimson Knight', title: 'The Blood Oath', color: '#e5192f', attacks: [
    { name: 'Shield Bash', fx: 'dash', color: '#ffc83d' },
    { name: 'Blade Wave', fx: 'throw', shape: 'crescent', color: '#ff2e4d', size: 76, straight: true },
    { name: 'Twin Cuts', fx: 'dash', color: '#ff2e4d', n: 2 },
    { name: 'Blood Burst', fx: 'volley', shape: 'crescent', color: '#ff2e4d', n: 4 },
  ], ult: { name: 'Blood Moon Charge', fx: 'dash', color: '#ff2e4d', n: 4 } },
  gareth: { name: 'Sir Gareth', title: 'The Silver Knight', color: '#cfd8ea', attacks: [
    { name: 'Quick Cut', fx: 'dash', color: '#e8eefc' },
    { name: 'Steel Crescent', fx: 'throw', shape: 'crescent', color: '#dfe7f7', size: 70, straight: true },
    { name: 'Silver Flurry', fx: 'dash', color: '#e8eefc', n: 3 },
    { name: "Knight's Wave", fx: 'ring', color: '#cfd8ea' },
  ], ult: { name: 'Holy Blade', fx: 'pillar', shape: 'blade', color: '#fff6c8' } },
  emeric: { name: 'King Emeric', title: 'The Emerald King', color: '#2fe07f', attacks: [
    { name: 'Emerald Shards', fx: 'volley', shape: 'gem', color: '#2fe07f', n: 4 },
    { name: 'Jewel Lance', fx: 'beam', color: '#17c964' },
    { name: 'Jade Spikes', fx: 'quake', color: '#17c964', n: 5 },
    { name: 'Crown Jewel', fx: 'throw', shape: 'gem', color: '#2fe07f', size: 64 },
  ], ult: { name: 'Lion of Jade', fx: 'summon', shape: 'lion', color: '#2fe07f' } },
  mortis: { name: 'Lord Mortis', title: 'The Bone Lord', color: '#b23cff', attacks: [
    { name: 'Bone Toss', fx: 'throw', shape: 'bone', color: '#f3eee0' },
    { name: 'Soul Skull', fx: 'throw', shape: 'skull', color: '#b23cff', size: 66 },
    { name: 'Bone Spikes', fx: 'quake', color: '#f3eee0', n: 5 },
    { name: 'Soul Beam', fx: 'beam', color: '#b23cff' },
  ], ult: { name: 'Army of Souls', fx: 'rain', shape: 'skull', color: '#b23cff', n: 10 } },
  lupus: { name: 'Lupus', title: 'The Wolf Legion', color: '#9fb0c8', attacks: [
    { name: 'Gladius Cut', fx: 'dash', color: '#e8eefc' },
    { name: 'Battle Howl', fx: 'ring', color: '#9fb0c8' },
    { name: 'Wolf Bite', fx: 'dash', color: '#bcd0ea', n: 2 },
    { name: 'Thrown Gladius', fx: 'throw', shape: 'crescent', color: '#dfe7f7', size: 66, straight: true },
  ], ult: { name: 'Wolf Pack', fx: 'summon', shape: 'wolf', color: '#bcd0ea', n: 3 } },
};
const heroImg = id => `heroes/${id}.webp`;

const SHAPE = {
  star: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 1l3 8h8l-6.500 5 2.500 8-7-5-7 5 2.500-8L1 9h8z"/></svg>',
  coin: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="currentColor"/><circle cx="12" cy="12" r="7" fill="none" stroke="#b77a00" stroke-width="2"/></svg>',
  petal: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2c6 5 7 13 0 20C5 15 6 7 12 2z"/></svg>',
  rose: '<svg viewBox="0 0 24 24"><path d="M12 13v10" stroke="#2f8f3e" stroke-width="2.500"/><circle cx="12" cy="8" r="7" fill="currentColor"/><path d="M8 8a4 4 0 0 1 7-2.500M9.500 11a3.500 3.500 0 0 0 5-3" fill="none" stroke="#7a0f25" stroke-width="1.500"/></svg>',
  gem: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 1l9 8-9 14L3 9z"/><path fill="#fff" opacity=".55" d="M12 1l3 8H9z"/></svg>',
  spear: '<svg viewBox="0 0 96 16"><path d="M0 8h74" stroke="#7a4a26" stroke-width="4"/><path fill="currentColor" stroke="#7d869c" d="M70 1l26 7-26 7z"/></svg>',
  hammer: '<svg viewBox="0 0 48 48"><path d="M22 14h5v32h-5z" fill="#3a2a18"/><path fill="currentColor" stroke="#7a5a1a" d="M6 2h36v18H6z"/></svg>',
  crescent: '<svg viewBox="0 0 48 48"><path fill="currentColor" d="M8 2c22 2 36 18 34 44C36 28 24 14 8 2z"/></svg>',
  bone: '<svg viewBox="0 0 48 24"><path fill="currentColor" d="M8 2a6 6 0 0 1 6 6h20a6 6 0 1 1 6 6 6 6 0 1 1-6 6v-6H14a6 6 0 1 1-6-6 6 6 0 0 1 0-6z"/></svg>',
  skull: '<svg viewBox="0 0 24 24"><path fill="#f3eee0" d="M12 1C6 1 2 5 2 11c0 3 1 5 3 6v3c0 1 1 2 2 2h10c1 0 2-1 2-2v-3c2-1 3-3 3-6 0-6-4-10-10-10z"/><circle cx="8" cy="11" r="3" fill="#20102c"/><circle cx="16" cy="11" r="3" fill="#20102c"/><path d="M12 14l-2 3h4zM9 19v3M12 19v3M15 19v3" fill="#20102c" stroke="#20102c"/></svg>',
  sun: '<svg viewBox="0 0 48 48"><g stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M24 2v8M24 38v8M2 24h8M38 24h8M8 8l6 6M34 34l6 6M40 8l-6 6M14 34l-6 6"/></g><circle cx="24" cy="24" r="12" fill="currentColor"/><circle cx="24" cy="24" r="7" fill="#fff6c8"/></svg>',
  blade: '<svg viewBox="0 0 30 130"><path fill="currentColor" stroke="#a7b4cc" d="M11 22h8v86l-4 20-4-20z"/><path fill="#ffc83d" d="M2 16h26v6H2zM12 2h6v14h-6z"/></svg>',
  griffin: '<img src="heroes/griffin.webp" alt="" draggable="false">',
  wolf: '<svg viewBox="0 0 100 70"><path fill="currentColor" d="M2 40l14-10 14-2c14-6 28-4 38 0l6-12 6 10 12 4 6 8-12 4h-8l-6 10 8 14H70l-8-14H40l-10 14H20l6-16-10-6z"/></svg>',
  lion: '<svg viewBox="0 0 48 48"><path fill="currentColor" d="M24 1l5 6 7-3 1 8 8 1-3 7 5 6-6 4 2 8-8 0-3 7-8-4-8 4-3-7-8 0 2-8-6-4 5-6-3-7 8-1 1-8 7 3z"/><circle cx="24" cy="24" r="12" fill="#0d6b3a"/><circle cx="19" cy="21" r="2" fill="#fff"/><circle cx="29" cy="21" r="2" fill="#fff"/><path d="M24 25l-3 3h6zM18 33c4 3 8 3 12 0" stroke="#fff" stroke-width="2" fill="#fff"/></svg>',
};

const bt = { key: null, field: null, lastEv: 0, localIdx: 0, streak: 0, wrong: false, boss: null, phase: null, fighters: {} };
const fieldEl = sel => bt.field && bt.field.querySelector(sel);
const SLOTS = { 1: [23], 2: [14, 32], 3: [9, 23, 37], 4: [7, 18, 29, 40] };

function fighterHtml(key, hero, side, x, label, mine) {
  return `<div class="bf-fighter ${side}" data-fighter="${key}" style="left:${side === 'a' ? x : 100 - x}%;z-index:${2 + Math.round(x)}">
    <div class="bf-flip"><img src="${heroImg(hero)}" alt="${esc(HERO[hero].name)}" draggable="false"></div>
    ${label ? `<span class="bf-tag ${mine ? 'me' : ''}">${esc(label)}</span>` : ''}
  </div>`;
}

function buildField(g) {
  const b = g.battle;
  const raid = g.mode === 'raid';
  const f = document.createElement('div');
  f.className = 'bf';
  const count = Math.max(b.sides.a.length, b.sides.b.length);
  f.style.setProperty('--fh', count > 2 ? '56%' : count === 2 ? '64%' : '72%');
  const enemyHero = raid ? b.boss.art : b.cpuHero;
  const nameA = raid ? 'Your party' : HERO[b.heroes[b.sides.a[0]]].name;
  const nameB = raid ? b.boss.name : HERO[b.cpu ? b.cpuHero : b.heroes[b.sides.b[0]]].name;
  const rowA = b.sides.a.map((id, i) => fighterHtml(id, b.heroes[id], 'a', SLOTS[b.sides.a.length][i], nameOf(id), id === S.you)).join('');
  const rowB = raid || b.cpu
    ? fighterHtml('enemy', enemyHero, 'b', 23, '', false)
    : b.sides.b.map((id, i) => fighterHtml(id, b.heroes[id], 'b', SLOTS[b.sides.b.length][i], nameOf(id), id === S.you)).join('');
  f.innerHTML = `
    ${battleScene(b.scene)}
    <div class="bf-bars">
      <div class="bf-bar a"><b>${esc(nameA)}</b><div class="hp"><i class="chip"></i><i class="fill"></i></div><small class="hp-n"></small></div>
      <div class="bf-vs">VS</div>
      <div class="bf-bar b"><b class="bf-name-b">${esc(nameB)}</b><div class="hp"><i class="chip"></i><i class="fill"></i></div><small class="hp-n"></small></div>
    </div>
    ${rowA}${rowB}
    <div class="bf-fx"></div>`;
  bt.boss = raid ? b.boss.index : null;
  bt.fighters = {};
  for (const el of f.querySelectorAll('[data-fighter]')) {
    bt.fighters[el.dataset.fighter] = { el, side: el.classList.contains('a') ? 'a' : 'b', x: parseFloat(el.style.left) };
  }
  if (raid) for (const art of ['leonix', 'crimson', 'mortis']) new Image().src = heroImg(art); // no pop-in when the next boss arrives
  return f;
}

function setHp(hp, max) {
  for (const side of ['a', 'b']) {
    const bar = fieldEl(`.bf-bar.${side}`);
    if (!bar) continue;
    const pct = Math.max(0, Math.min(1, hp[side] / max[side]));
    bar.querySelector('.fill').style.transform = `scaleX(${pct})`;
    bar.querySelector('.chip').style.transform = `scaleX(${pct})`;
    bar.querySelector('.hp-n').textContent = `${hp[side]} / ${max[side]}`;
    bar.classList.toggle('danger', pct < 0.25);
  }
}

/* ---------- attack pieces ---------- */
function fx(cls, html = '') {
  const el = document.createElement('div');
  el.className = `fxp ${cls}`;
  el.innerHTML = html;
  fieldEl('.bf-fx').appendChild(el);
  return el;
}
function shapeFx(shape, size, color, flip) {
  const el = fx('p-shape', SHAPE[shape] || '');
  el.style.width = `${size}px`;
  el.style.color = color;
  el.style.filter = `drop-shadow(0 0 8px ${color})`;
  if (shape === 'orb') {
    el.style.height = `${size}px`;
    el.style.borderRadius = '50%';
    el.style.background = `radial-gradient(circle, #fff 12%, ${color} 50%, transparent 74%)`;
  }
  if (flip && el.firstChild) el.firstChild.style.scale = '-1 1';
  return el;
}
function fly(el, x1, y1, x2, y2, ms, o = {}) {
  const midY = o.arc ? Math.min(y1, y2) - o.arc : (y1 + y2) / 2;
  const r1 = o.r1 || 0, r2 = o.r2 || 0;
  const a = el.animate([
    { left: `${x1}%`, top: `${y1}%`, transform: `translate(-50%,-50%) rotate(${r1}deg)` },
    { left: `${(x1 + x2) / 2}%`, top: `${midY}%`, transform: `translate(-50%,-50%) rotate(${(r1 + r2) / 2}deg)`, offset: 0.5 },
    { left: `${x2}%`, top: `${y2}%`, transform: `translate(-50%,-50%) rotate(${r2}deg)` },
  ], { duration: ms, easing: o.easing || 'linear', fill: 'both', delay: o.delay || 0 });
  a.onfinish = () => el.remove();
  return a;
}
function blast(x, y, color, size, ms = 420) {
  const el = fx('p-blast');
  el.style.cssText = `left:${x}%;top:${y}%;width:${size}px;height:${size}px;background:radial-gradient(circle,#fff 6%,${color} 36%,transparent 70%)`;
  el.animate([
    { transform: 'translate(-50%,-50%) scale(.25)', opacity: 1 },
    { transform: 'translate(-50%,-50%) scale(1.4)', opacity: 0 },
  ], { duration: ms, easing: 'ease-out', fill: 'forwards' }).onfinish = () => el.remove();
}
function slashMark(x, y, color, size, tilt) {
  const el = fx('p-slash');
  el.style.cssText = `left:${x}%;top:${y}%;width:${size}px;height:${size}px;border-top-color:${color};border-right-color:${color};rotate:${tilt}deg`;
  el.animate([
    { transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 },
    { transform: 'translate(-50%,-50%) scale(1.25)', opacity: 0 },
  ], { duration: 300, easing: 'ease-out', fill: 'forwards' }).onfinish = () => el.remove();
}
const flash = (amount = 1.8, ms = 260) => bt.field.animate([{ filter: `brightness(${amount})` }, { filter: 'none' }], { duration: ms });
const fieldW = () => bt.field.getBoundingClientRect().width;
function lunge(att, dist, ms = 320) {
  const dir = att.side === 'a' ? 1 : -1;
  att.el.animate([{ translate: '0 0' }, { translate: `${dir * dist}px -6px`, offset: 0.35 }, { translate: '0 0' }], { duration: ms, easing: 'ease-out' });
}

/* ---------- animations, each calling done() at the moment of impact ---------- */
const MOVE_FX = {
  // run across the field and hit; n is how many slashes
  dash(att, tx, m, pow, done) {
    const dir = att.side === 'a' ? 1 : -1;
    const dx = ((tx - att.x) / 100) * fieldW() - dir * fieldW() * 0.13;
    const hits = m.n || 1;
    const hold = 120 + hits * 100;
    att.el.style.zIndex = 60;
    att.el.animate([
      { translate: '0 0', filter: 'none' },
      { translate: `${dx}px -8px`, filter: `drop-shadow(0 0 14px ${m.color})`, offset: 170 / (340 + hold) },
      { translate: `${dx}px -8px`, filter: `drop-shadow(0 0 14px ${m.color})`, offset: (170 + hold) / (340 + hold) },
      { translate: '0 0', filter: 'none' },
    ], { duration: 340 + hold, easing: 'ease-in-out' }).onfinish = () => { att.el.style.zIndex = 2 + Math.round(att.side === 'a' ? att.x : 100 - att.x); };
    for (let i = 0; i < hits; i++) {
      setTimeout(() => {
        SFX.play('slash');
        slashMark(tx + (i % 2 ? 4 : -4) * dir, 52 - (i % 3) * 6, m.color, 110 * pow, 30 + i * 70);
        if (hits > 2) flash(1.35, 120);
        if (i === hits - 1) done();
      }, 170 + i * 100);
    }
  },
  // one projectile
  throw(att, tx, m, pow, done) {
    SFX.play('arrow');
    lunge(att, 20);
    const dir = att.side === 'a' ? 1 : -1;
    const el = shapeFx(m.shape, (m.size || 42) * pow, m.color, dir < 0);
    fly(el, att.x, 52, tx, 56, 400, m.straight ? { arc: 4 } : { arc: 10, r2: dir * 720 });
    setTimeout(() => { blast(tx, 56, m.color, 110 * pow); done(); }, 400);
  },
  // many small projectiles
  volley(att, tx, m, pow, done) {
    SFX.play('arrow');
    lunge(att, 12, 500);
    const n = m.n || 3, dir = att.side === 'a' ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const el = shapeFx(m.shape, 26 * pow, m.color, dir < 0);
      el.style.opacity = 0;
      el.animate([{ opacity: 1 }, { opacity: 1 }], { delay: i * 70, duration: 340, fill: 'both' });
      fly(el, att.x, 44 + Math.random() * 18, tx + Math.random() * 8 - 4, 46 + Math.random() * 20, 340, { delay: i * 70, arc: Math.random() * 16, r2: dir * 500 });
    }
    setTimeout(() => { blast(tx, 54, m.color, 90 * pow); done(); }, 340 + (n - 1) * 70);
  },
  // a straight blast of energy
  beam(att, tx, m, pow, done) {
    SFX.play('zap');
    lunge(att, 10);
    const left = Math.min(att.x, tx), width = Math.abs(tx - att.x);
    const el = fx('p-beam');
    el.style.cssText = `left:${left}%;width:${width}%;height:${18 * pow}px;top:50%;background:linear-gradient(180deg,transparent,${m.color} 25%,#fff 50%,${m.color} 75%,transparent);box-shadow:0 0 22px ${m.color};transform-origin:${att.side === 'a' ? 'left' : 'right'} center`;
    el.animate([{ transform: 'translateY(-50%) scale(0,1)' }, { transform: 'translateY(-50%) scale(1,1)', offset: 0.3 }, { transform: 'translateY(-50%) scale(1,1.3)', offset: 0.6 }, { transform: 'translateY(-50%) scale(1,0)' }], { duration: 480, fill: 'forwards' }).onfinish = () => el.remove();
    setTimeout(() => { blast(tx, 52, m.color, 120 * pow); done(); }, 170);
  },
  // an expanding shockwave
  ring(att, tx, m, pow, done) {
    SFX.play('zap');
    lunge(att, 8);
    const el = fx('p-ring');
    el.style.cssText = `left:${att.x}%;top:52%;border-color:${m.color};box-shadow:0 0 18px ${m.color},inset 0 0 18px ${m.color}`;
    const reach = Math.abs(tx - att.x) / 100 * fieldW() * 2 / 60;
    el.animate([{ transform: 'translate(-50%,-50%) scale(.2)', opacity: 1 }, { transform: `translate(-50%,-50%) scale(${reach})`, opacity: 0.8, offset: 0.8 }, { transform: `translate(-50%,-50%) scale(${reach * 1.2})`, opacity: 0 }], { duration: 480, easing: 'ease-out', fill: 'forwards' }).onfinish = () => el.remove();
    setTimeout(done, 380);
  },
  // spikes tearing along the ground
  quake(att, tx, m, pow, done) {
    SFX.play('boom');
    const n = m.n || 6;
    for (let i = 1; i <= n; i++) {
      const x = att.x + ((tx - att.x) * i) / n;
      setTimeout(() => {
        const el = fx('p-spike');
        el.style.cssText = `left:${x}%;border-bottom-color:${m.color};border-bottom-width:${(40 + i * 7) * pow}px`;
        el.animate([{ transform: 'translateX(-50%) scaleY(0)' }, { transform: 'translateX(-50%) scaleY(1.1)', offset: 0.3 }, { transform: 'translateX(-50%) scaleY(1)', offset: 0.7 }, { transform: 'translateX(-50%) scaleY(0)' }], { duration: 480, fill: 'forwards' }).onfinish = () => el.remove();
      }, i * 50);
    }
    setTimeout(() => {
      FX.shake();
      if (m.then) MOVE_FX[m.then.fx](att, tx, m.then, pow, done);
      else done();
    }, n * 50);
  },
  // things falling from the sky on the target
  rain(att, tx, m, pow, done) {
    SFX.play('fire');
    const n = m.n || 8;
    const size = m.size || 34;
    for (let i = 0; i < n; i++) {
      const el = shapeFx(m.shape, size * (n === 1 ? 1 : 0.8 + Math.random() * 0.6), m.color);
      el.style.opacity = 0;
      el.animate([{ opacity: 1 }, { opacity: 1 }], { delay: i * 55, duration: n === 1 ? 650 : 400, fill: 'both' });
      const x = tx + (n === 1 ? 0 : Math.random() * 34 - 17);
      fly(el, x + 10, -14, x, 44 + Math.random() * 26, n === 1 ? 650 : 400, { delay: i * 55, easing: 'ease-in', r2: 300 });
    }
    setTimeout(() => {
      blast(tx, 56, m.color, n === 1 ? 300 : 210, 620);
      SFX.play('boom');
      FX.shake();
      flash(2, 340);
      done();
    }, (n === 1 ? 650 : 400) + (n - 1) * 55 * 0.7);
  },
  // a column of light with a giant weapon inside
  pillar(att, tx, m, pow, done) {
    SFX.play('zap');
    const col = fx('p-pillar');
    col.style.cssText = `left:${tx}%;background:linear-gradient(90deg,transparent,${m.color},#fff,${m.color},transparent)`;
    col.animate([{ transform: 'translateX(-50%) scaleX(0)', opacity: 0 }, { transform: 'translateX(-50%) scaleX(1)', opacity: 1, offset: 0.3 }, { transform: 'translateX(-50%) scaleX(.6)', opacity: 1, offset: 0.7 }, { transform: 'translateX(-50%) scaleX(0)', opacity: 0 }], { duration: 800, fill: 'forwards' }).onfinish = () => col.remove();
    const blade = shapeFx(m.shape, 58, '#eef3ff');
    fly(blade, tx, -30, tx, 44, 420, { easing: 'cubic-bezier(.6,0,1,1)' });
    setTimeout(() => {
      blast(tx, 60, m.color, 260, 600);
      SFX.play('boom');
      FX.shake();
      flash(2.2, 360);
      done();
    }, 420);
  },
  // a spirit beast runs across the field
  summon(att, tx, m, pow, done) {
    SFX.play('fire');
    const n = m.n || 1, dir = att.side === 'a' ? 1 : -1;
    const size = n > 1 ? 86 : 150;
    for (let i = 0; i < n; i++) {
      const el = shapeFx(m.shape, size, m.color, dir < 0);
      el.style.opacity = 0;
      el.animate([{ opacity: 0.95 }, { opacity: 0.95 }], { delay: i * 130, duration: 620, fill: 'both' });
      const y = n > 1 ? 44 + i * 12 : 46;
      fly(el, dir > 0 ? -18 : 118, m.shape === 'griffin' ? 6 : y, tx + dir * 10, y, 620, { delay: i * 130, easing: 'ease-in' });
    }
    setTimeout(() => {
      blast(tx, 54, m.color, 260, 620);
      SFX.play('boom');
      FX.shake();
      flash(2, 340);
      done();
    }, 620 + (n - 1) * 130);
  },
  // jump onto the enemy and smash the ground
  leap(att, tx, m, pow, done) {
    SFX.play('fire');
    const dir = att.side === 'a' ? 1 : -1;
    const dx = ((tx - att.x) / 100) * fieldW() - dir * fieldW() * 0.12;
    att.el.style.zIndex = 60;
    att.el.animate([
      { translate: '0 0' }, { translate: `${dx / 2}px -120px`, offset: 0.25 }, { translate: `${dx}px 0`, offset: 0.5 }, { translate: `${dx}px 0`, offset: 0.7 }, { translate: '0 0' },
    ], { duration: 1000, easing: 'ease-in-out' }).onfinish = () => { att.el.style.zIndex = 2 + Math.round(att.side === 'a' ? att.x : 100 - att.x); };
    setTimeout(() => {
      SFX.play('boom');
      FX.shake();
      flash(1.8, 320);
      blast(tx, 72, m.color, 280, 600);
      for (let i = -3; i <= 3; i++) {
        const el = fx('p-spike');
        el.style.cssText = `left:${tx + i * 7}%;border-bottom-color:${m.color};border-bottom-width:${80 - Math.abs(i) * 16}px`;
        el.animate([{ transform: 'translateX(-50%) scaleY(0)' }, { transform: 'translateX(-50%) scaleY(1)', offset: 0.3 }, { transform: 'translateX(-50%) scaleY(0)' }], { duration: 520, fill: 'forwards' }).onfinish = () => el.remove();
      }
      done();
    }, 500);
  },
};

// a big portrait slash across the screen before an ultimate
function cutIn(heroId, move, side) {
  const dir = side === 'a' ? 1 : -1;
  const el = fx('p-cutin', `<img src="${heroImg(heroId)}" alt=""><b>${esc(move.name)}</b>`);
  el.style.setProperty('--c', move.color);
  el.animate([
    { transform: `translateX(${-dir * 110}%)` }, { transform: 'translateX(0)', offset: 0.2 }, { transform: `translateX(${dir * 4}%)`, offset: 0.8 }, { transform: `translateX(${dir * 110}%)` },
  ], { duration: 720, easing: 'ease-in-out', fill: 'forwards' }).onfinish = () => el.remove();
}

// the attack's name floats up from whoever used it
function moveCallout(move, att) {
  const el = fx('p-callout', esc(move.name));
  el.style.left = `${Math.max(20, Math.min(80, att.x))}%`;
  el.style.color = move.color;
  el.animate([{ transform: 'translate(-50%,8px) scale(.7)', opacity: 0 }, { transform: 'translate(-50%,0) scale(1)', opacity: 1, offset: 0.15 }, { transform: 'translate(-50%,-6px) scale(1)', opacity: 1, offset: 0.75 }, { transform: 'translate(-50%,-16px) scale(1)', opacity: 0 }], { duration: 950, easing: 'ease-out' }).onfinish = () => el.remove();
}

const POWER = { sword: 0.85, arrows: 1, fire: 1.12, bolt: 1.3, meteor: 1.5 };
const heroOfEvent = (g, ev) => {
  if (ev.by) return g.battle.heroes[ev.by];
  return g.battle.boss ? g.battle.boss.art : g.battle.cpuHero;
};

function impact(ev, targets, tx) {
  // attacks fly at different speeds, so a slow one landing late must not restore health
  if (ev.id > (bt.hpEv || 0)) {
    bt.hpEv = ev.id;
    setHp(ev.hp, bt.lastMax);
  }
  for (const t of targets) {
    t.el.animate([
      { filter: 'brightness(2.4) saturate(.3)', translate: `${t.side === 'a' ? -14 : 14}px 0` },
      { filter: 'brightness(1)', translate: `${t.side === 'a' ? 6 : -6}px 0`, offset: 0.5 },
      { filter: 'none', translate: '0 0' },
    ], { duration: 300 });
  }
  const num = fx(`p-dmg ${ev.ult ? 'crit' : ''}`, `-${ev.dmg}`);
  num.style.left = `${tx + (Math.random() * 8 - 4)}%`;
  num.animate([{ transform: 'translate(-50%,0) scale(.6)', opacity: 1 }, { transform: 'translate(-50%,-34px) scale(1.2)', opacity: 1, offset: 0.4 }, { transform: 'translate(-50%,-66px) scale(1)', opacity: 0 }], { duration: 800, easing: 'ease-out' }).onfinish = () => num.remove();
  if (ev.down !== undefined) bossDown();
}

function bossDown() {
  const boss = bt.fighters.enemy;
  SFX.play('boom');
  if (boss) boss.el.animate([{ rotate: '0deg', opacity: 1 }, { rotate: '60deg', translate: '0 20px', opacity: 0 }], { duration: 650, fill: 'forwards', easing: 'ease-in' });
  setTimeout(() => {
    const g = S && S.game;
    if (!g || !g.battle || !g.battle.boss || !bt.field || g.battle.winner === 'a' || !boss) return;
    boss.el.getAnimations().forEach(a => a.cancel());
    boss.el.querySelector('img').src = heroImg(g.battle.boss.art);
    fieldEl('.bf-name-b').textContent = g.battle.boss.name;
    bt.lastMax = g.battle.max;
    setHp(g.battle.hp, g.battle.max);
    boss.el.animate([{ translate: '120px 0', opacity: 0 }, { translate: '0 0', opacity: 1 }], { duration: 500, easing: 'cubic-bezier(.2,1.4,.4,1)' });
    SFX.play('reveal');
  }, 800);
}

function playEvent(g, ev) {
  const fighters = Object.values(bt.fighters);
  const targetSide = ev.side === 'a' ? 'b' : 'a';
  const targets = fighters.filter(f => f.side === targetSide);
  const tx = targets.reduce((sum, f) => sum + f.x, 0) / (targets.length || 1);
  if (!motionOk()) { impact(ev, targets, tx); return; }
  const att = (ev.by && bt.fighters[ev.by]) || bt.fighters.enemy || fighters.find(f => f.side === ev.side);
  const heroId = heroOfEvent(g, ev);
  const hero = HERO[heroId] || HERO.aldric;
  const move = ev.ult ? hero.ult : hero.attacks[(ev.pick || 0) % hero.attacks.length];
  const pow = POWER[ev.type] || 1;
  const go = () => {
    if (!bt.field) return;
    if (!ev.ult) moveCallout(move, att);
    MOVE_FX[move.fx](att, tx, move, pow, () => impact(ev, targets, tx));
  };
  if (ev.ult) {
    cutIn(heroId, move, ev.side);
    setTimeout(go, 620);
  } else go();
}

function koAnimation(g) {
  const b = g.battle;
  const loser = b.winner === 'a' ? 'b' : 'a';
  bt.hpEv = Infinity; // nothing still in the air may change the final health
  setHp(b.hp, b.max);
  for (const f of Object.values(bt.fighters)) {
    if (f.side !== loser) continue;
    anim(f.el, [{ rotate: '0deg', translate: '0 0', opacity: 1 }, { rotate: `${loser === 'a' ? -78 : 78}deg`, translate: '0 18px', opacity: 0.7 }], { duration: 700, fill: 'forwards', easing: 'cubic-bezier(.5,0,1,1)' });
  }
  const text = fx('p-ko', 'K.O.!');
  anim(text, [{ transform: 'translate(-50%,-50%) scale(3)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }], { duration: 450, easing: 'cubic-bezier(.2,1.4,.4,1)' });
  SFX.play('boom');
  FX.shake();
}

/* ---------- the versus screen before a battle ---------- */
function battleVs(g) {
  const b = g.battle;
  const left = b.heroes[S.you] || b.heroes[b.sides.a[0]];
  const raid = g.mode === 'raid';
  const rival = b.sides.b[0] && b.sides.a.includes(S.you) ? b.sides.b[0] : b.sides.a.find(id => id !== S.you);
  const right = raid ? b.boss.art : b.cpu ? b.cpuHero : b.heroes[rival];
  const leftWho = 'You';
  const rightWho = raid ? `Boss 1 of ${b.boss.count}` : b.cpu ? 'Computer' : nameOf(rival);
  const side = (hero, who, cls) => `<div class="vs-side ${cls}" style="--c:${HERO[hero].color}"><img src="${heroImg(hero)}" alt="" draggable="false"><b>${esc(HERO[hero].name)}</b><small>${esc(who)} · ${esc(HERO[hero].title)}</small></div>`;
  return {
    tone: 'live',
    turn: raid ? `You are ${esc(HERO[left].name)}. Beat all three bosses together!` : `You are ${esc(HERO[left].name)}. Get ready to type!`,
    body: `<div class="vs-screen">${side(left, leftWho, 'l')}<div class="vs-mid"><span>VS</span><div class="count-big" data-deadline="${g.timerAt}"></div></div>${side(right, rightWho, 'r')}<div class="vs-arena">${esc(SCENE_NAMES[b.scene] || '')}</div></div>`,
  };
}

/* ---------- the typing panel ---------- */
const currentWord = g => g.battle.myWords[bt.localIdx - g.battle.myIdx] || '';

function wordHtml(word, typed) {
  let good = 0;
  while (good < typed.length && typed[good] === word[good]) good++;
  const bad = typed.length > good;
  return `<span class="bw-good">${esc(word.slice(0, good))}</span><span class="${bad ? 'bw-bad' : 'bw-next'}">${esc(word.slice(good, good + 1))}</span>${esc(word.slice(good + 1))}`;
}

function paintPanel(g) {
  const word = currentWord(g);
  const input = $('#battleInput');
  const typed = input ? input.value.trim().toLowerCase() : '';
  const wordEl = $('#battleWord');
  const every = g.battle.ultEvery;
  const pips = bt.streak % every;
  const ultNext = pips === every - 1;
  const hero = HERO[g.battle.heroes[S.you]] || HERO.aldric;
  if (wordEl) wordEl.innerHTML = wordHtml(word, typed);
  const tag = $('#battleAttack');
  if (tag) {
    tag.textContent = ultNext ? hero.ult.name : hero.name;
    tag.className = `bw-attack ${ultNext ? 'ult' : ''}`;
  }
  const meter = $('#battleStreak');
  if (meter) meter.innerHTML = Array.from({ length: every }, (_, i) => `<i class="${i < pips ? 'on' : ''}"></i>`).join('');
}

function typingBattle(g) {
  const b = g.battle;
  const raid = g.mode === 'raid';
  if (g.phase === 'ko') {
    return { tone: 'win', turn: battleHeadline(g), body: '<div id="battleSlot"></div>' };
  }
  return {
    tone: 'live',
    turn: raid ? `Boss ${b.boss.index + 1} of ${b.boss.count}: ${esc(b.boss.name)} — type to attack!` : `You are ${esc(HERO[b.heroes[S.you]].name)} — type to strike!`,
    body: `<div id="battleSlot"></div>
      <div class="timebar"><span data-deadline="${b.endAt}" data-total="${b.totalMs}"></span></div>
      <div class="bw-panel">
        <div class="bw-top"><span id="battleAttack" class="bw-attack"></span><span class="bw-streak" title="Five words without a typo unleashes your ultimate"><span id="battleStreak" class="bw-pips"></span></span></div>
        <div id="battleWord" class="bw-word" aria-live="polite"></div>
        <input id="battleInput" class="type-input" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Type the word…" aria-label="Type the word">
      </div>`,
  };
}

function battleHeadline(g) {
  const b = g.battle;
  if (g.mode === 'raid') return b.winner === 'a' ? 'Raid cleared! All bosses defeated!' : `The bosses won — ${b.bossesDown} of 3 defeated`;
  if (b.cpu) return b.winner === 'a' ? `You defeated ${HERO[b.cpuHero].name}!` : `${HERO[b.cpuHero].name} defeated you!`;
  const champ = b.sides[b.winner][0];
  return `${esc(nameOf(champ))} wins as ${esc(HERO[b.heroes[champ]].name)}!`;
}

$('#stage').addEventListener('input', e => {
  if (e.target.id !== 'battleInput') return;
  const g = S.game;
  if (!g || !g.battle || g.phase !== 'play') return;
  const input = e.target;
  const typed = input.value.trim().toLowerCase();
  const word = currentWord(g);
  if (word && typed === word) {
    act({ type: 'strike', text: typed });
    bt.localIdx++;
    bt.streak++;
    bt.wrong = false;
    input.value = '';
    input.classList.remove('bad');
    paintPanel(g);
    return;
  }
  const bad = !word.startsWith(typed);
  input.classList.toggle('bad', bad);
  if (bad && !bt.wrong) {
    bt.wrong = true;
    bt.streak = 0;
    socket.emit('stream', { t: 'm' });
    SFX.play('tick');
    anim(input, [{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], { duration: 140 });
  } else if (!bad) {
    bt.wrong = false;
    SFX.play('key');
  }
  paintPanel(g);
});
$('#stage').addEventListener('paste', e => { if (e.target.id === 'battleInput') e.preventDefault(); });

// strikes update the arena directly, so the input never loses focus on a phone
livePatch.typing = g => {
  if (!g.battle || g.phase !== 'play' || bt.phase !== 'play' || !$('#battleInput') || !$('#battleSlot')) return false;
  // a new boss changes the heading, so that one update does a full redraw
  return !g.battle.boss || g.battle.boss.index === bt.boss;
};

afterRender.push(() => {
  const g = S && S.game;
  if (!g || g.gameId !== 'typing' || !g.battle || (g.phase !== 'play' && g.phase !== 'ko')) {
    bt.phase = g && g.phase;
    return;
  }
  const b = g.battle;
  const key = `${g.mode}:${g.startedAt}`;
  if (key !== bt.key) {
    bt.key = key;
    bt.field = buildField(g);
    bt.lastEv = b.events.length ? b.events[b.events.length - 1].id : 0;
    bt.localIdx = b.myIdx;
    bt.streak = b.myStreak;
    bt.wrong = false;
    bt.lastMax = b.max;
    bt.hpEv = bt.lastEv;
    setHp(b.hp, b.max);
    bt.koShown = false;
  }
  const slot = $('#battleSlot');
  if (slot && bt.field.parentElement !== slot) slot.appendChild(bt.field);
  if (bt.localIdx < b.myIdx) bt.localIdx = b.myIdx;
  for (const ev of b.events) {
    if (ev.id > bt.lastEv) {
      bt.lastEv = ev.id;
      playEvent(g, ev);
    }
  }
  if (b.boss && b.boss.index === bt.boss) bt.lastMax = b.max;
  if (b.boss && b.boss.index !== bt.boss) bt.boss = b.boss.index;
  if (g.phase === 'play') {
    const input = $('#battleInput');
    if (input && document.activeElement !== input && bt.phase !== 'play') input.focus();
    paintPanel(g);
  }
  if (g.phase === 'ko' && !bt.koShown) {
    bt.koShown = true;
    setTimeout(() => { if (S && S.game && S.game.phase === 'ko') koAnimation(S.game); }, 500);
  }
  bt.phase = g.phase;
});
