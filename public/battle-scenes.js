/* The battlefields for Kings' Battle and Monster Raid: three rooms inside the castle and three
   places outside it, one chosen at random per battle. Hand-drawn SVG, lit to suit the painted kings.
   Everything sits in one wide picture anchored to the floor. The full height always shows,
   phones crop only the sides, and the important parts stay near the middle. */
const SCENE_NAMES = {
  throne: 'The Throne Room', hall: 'The Great Hall', chapel: 'The Royal Chapel',
  gate: 'The Castle Gate', ramparts: 'The Storm Ramparts', bailey: 'The Inner Courtyard',
};

const art = {
  defs: (brick, mortar) => `<defs>
    <radialGradient id="bsWarm"><stop offset="0" stop-color="#ffd488" stop-opacity=".9"/><stop offset=".38" stop-color="#ff9a3d" stop-opacity=".34"/><stop offset="1" stop-color="#ff7a20" stop-opacity="0"/></radialGradient>
    <radialGradient id="bsCool"><stop offset="0" stop-color="#cfe4ff" stop-opacity=".9"/><stop offset=".4" stop-color="#7fa8e8" stop-opacity=".3"/><stop offset="1" stop-color="#5f86d0" stop-opacity="0"/></radialGradient>
    <radialGradient id="bsVig" cx=".5" cy=".55" r=".72"><stop offset=".5" stop-color="#05030f" stop-opacity="0"/><stop offset="1" stop-color="#05030f" stop-opacity=".82"/></radialGradient>
    <linearGradient id="bsCyl"><stop offset="0" stop-color="#000" stop-opacity=".62"/><stop offset=".36" stop-color="#fff" stop-opacity=".13"/><stop offset=".62" stop-color="#000" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity=".68"/></linearGradient>
    <linearGradient id="bsDown" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".62"/><stop offset=".6" stop-color="#000" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
    <linearGradient id="bsUp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".62"/></linearGradient>
    <linearGradient id="bsShaft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0c0" stop-opacity=".42"/><stop offset="1" stop-color="#fff0c0" stop-opacity="0"/></linearGradient>
    <pattern id="bsBrick" width="72" height="36" patternUnits="userSpaceOnUse"><rect width="72" height="36" fill="${brick}"/><rect x="2" y="2" width="32" height="14" fill="#fff" opacity=".035"/><rect x="38" y="2" width="32" height="14" fill="#000" opacity=".07"/><rect x="-16" y="20" width="32" height="14" fill="#000" opacity=".05"/><rect x="20" y="20" width="32" height="14" fill="#fff" opacity=".05"/><path d="M0 .5h72M0 18.500h72M36 0v18M18 18v18M54 18v18" stroke="${mortar}" stroke-width="1.500"/></pattern>
  </defs>`,

  // checker or stone floor shrinking towards a vanishing point behind the scene
  floor(top, a, b, rows = 9, cols = 44) {
    const bottom = 400, vy = top - 80;
    const yAt = r => top + (bottom - top) * ((r / rows) ** 1.7);
    const xAt = (c, y) => 400 + (c - cols / 2) * 62 * ((y - vy) / (bottom - vy));
    let dA = '', dB = '';
    for (let r = 0; r < rows; r++) {
      const y1 = yAt(r), y2 = yAt(r + 1);
      for (let c = 0; c < cols; c++) {
        const q = `M${xAt(c, y1).toFixed(1)} ${y1.toFixed(1)}L${xAt(c + 1, y1).toFixed(1)} ${y1.toFixed(1)}L${xAt(c + 1, y2).toFixed(1)} ${y2.toFixed(1)}L${xAt(c, y2).toFixed(1)} ${y2.toFixed(1)}z`;
        if ((r + c) % 2) dA += q; else dB += q;
      }
    }
    return `<rect x="-200" y="${top}" width="1200" height="${bottom - top}" fill="${a}"/><path d="${dA}" fill="${a}"/><path d="${dB}" fill="${b}"/>`;
  },
  round: (x, w, top, bot) => `M${x} ${bot}V${top + w / 2}A${w / 2} ${w / 2} 0 0 1 ${x + w} ${top + w / 2}V${bot}z`,
  pointed(x, w, top, bot) {
    const sp = top + w * 0.95, c = x + w / 2;
    return `M${x} ${bot}V${sp}Q${x} ${top + w * 0.3} ${c} ${top}Q${x + w} ${top + w * 0.3} ${x + w} ${sp}V${bot}z`;
  },
  flame(x, y, s) {
    return `<g class="bs-flicker" style="animation-delay:${-(x % 7) / 10}s"><path d="M${x} ${y - 24 * s}c${7 * s} ${9 * s} ${10 * s} ${14 * s} ${10 * s} ${19 * s}a${10 * s} ${5.5 * s} 0 0 1 ${-20 * s} 0c0 ${-5 * s} ${3 * s} ${-10 * s} ${10 * s} ${-19 * s}z" fill="#f2641d"/><path d="M${x} ${y - 16 * s}c${4 * s} ${6 * s} ${6 * s} ${9 * s} ${6 * s} ${12 * s}a${6 * s} ${3.5 * s} 0 0 1 ${-12 * s} 0c0 ${-3 * s} ${2 * s} ${-6 * s} ${6 * s} ${-12 * s}z" fill="#ffc94d"/><path d="M${x} ${y - 8 * s}c${2 * s} ${3 * s} ${3 * s} ${4 * s} ${3 * s} ${6 * s}a${3 * s} ${2 * s} 0 0 1 ${-6 * s} 0c0 ${-2 * s} ${1 * s} ${-3 * s} ${3 * s} ${-6 * s}z" fill="#fff7d0"/></g>`;
  },
  torch(x, y, s = 1) {
    return `<circle class="bs-glow" style="animation-delay:${-(x % 9) / 10}s" cx="${x}" cy="${y - 14 * s}" r="${64 * s}" fill="url(#bsWarm)"/><path d="M${x - 2.500 * s} ${y + 26 * s}l${-2 * s} ${-26 * s}h${9 * s}l${-2 * s} ${26 * s}z" fill="#2a1a10"/><path d="M${x - 8 * s} ${y + 2 * s}h${16 * s}l${-3 * s} ${-8 * s}h${-10 * s}z" fill="#1d1a22"/>${art.flame(x, y - 3 * s, s)}`;
  },
  column(x, w, bot, base, top = 0) {
    return `<rect x="${x}" y="${top}" width="${w}" height="${bot - top}" fill="${base}"/><rect x="${x}" y="${top}" width="${w}" height="${bot - top}" fill="url(#bsCyl)"/><path d="M${x - w * 0.14} ${bot - w * 0.32}h${w * 1.28}v${w * 0.32}h${-w * 1.28}z" fill="${base}"/><path d="M${x - w * 0.14} ${bot - w * 0.32}h${w * 1.28}v${w * 0.32}h${-w * 1.28}z" fill="url(#bsCyl)"/><path d="M${x + w * 0.2} ${top}V${bot}M${x + w * 0.5} ${top}V${bot}M${x + w * 0.8} ${top}V${bot}" stroke="#000" stroke-opacity=".22" stroke-width="1.500"/>`;
  },
  banner(x, y, w, h, c, trim = '#d9a93a') {
    const m = x + w / 2;
    return `<g class="bs-sway" style="animation-delay:${-(x % 5)}s"><path d="M${x - 4} ${y}h${w + 8}" stroke="#2a1a10" stroke-width="4"/><path d="M${x} ${y}h${w}v${h}l${-w / 2} ${w * 0.5}-${w / 2} ${-w * 0.5}z" fill="${c}"/><path d="M${x} ${y}h${w * 0.22}v${h + w * 0.1}l${-w * 0.22} ${-w * 0.1}zM${x + w} ${y}h${-w * 0.24}v${h + w * 0.12}l${w * 0.24} ${-w * 0.12}z" fill="#000" opacity=".3"/><path d="M${x + 3} ${y}v${h}l${w / 2 - 3} ${w * 0.47}l${w / 2 - 3} ${-w * 0.47}V${y}" fill="none" stroke="${trim}" stroke-width="1.800"/><path d="M${m - w * 0.28} ${y + h * 0.36}l${w * 0.05} ${-h * 0.15} ${w * 0.11} ${h * 0.07} ${w * 0.12} ${-h * 0.13} ${w * 0.12} ${h * 0.13} ${w * 0.11} ${-h * 0.07} ${w * 0.05} ${h * 0.15}z" fill="${trim}"/></g>`;
  },
  merlons(x1, x2, y, w, h, gap, fill) {
    let d = '';
    for (let x = x1; x < x2; x += w + gap) d += `M${x} ${y}v${-h}h${w}v${h}z`;
    return `<path d="${d}" fill="${fill}"/>`;
  },
  tower(x, w, top, bot, fill, roof) {
    const r = roof ? `<path d="M${x - w * 0.1} ${top - 9}L${x + w / 2} ${top - w * 1.1}L${x + w * 1.1} ${top - 9}z" fill="${roof}"/><path d="M${x + w / 2} ${top - w * 1.1}L${x + w * 1.1} ${top - 9}H${x + w * 0.62}z" fill="#000" opacity=".35"/>` : '';
    return `${r}<rect x="${x}" y="${top}" width="${w}" height="${bot - top}" fill="${fill}"/><rect x="${x}" y="${top}" width="${w}" height="${bot - top}" fill="url(#bsCyl)"/><rect x="${x - 6}" y="${top - 10}" width="${w + 12}" height="14" fill="${fill}"/><rect x="${x - 6}" y="${top - 10}" width="${w + 12}" height="14" fill="url(#bsCyl)"/>${art.merlons(x - 6, x + w + 6, top - 10, w / 7, 9, w / 7, fill)}`;
  },
  win: (x, y, w, h, c = '#ffb347') => `<path class="bs-win" style="animation-delay:${-(x % 11) / 3}s" d="${art.round(x, w, y, y + h)}" fill="${c}"/>`,
  vignette: '<rect x="-200" width="1200" height="400" fill="url(#bsVig)"/>',
  svg: inner => `<svg class="bs-art" viewBox="-200 0 1200 400" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${inner}</svg>`,
  motes(n, color) {
    return Array.from({ length: n }, () => `<i class="bs-mote" style="left:${Math.round(Math.random() * 100)}%;bottom:${Math.round(Math.random() * 40)}%;background:${color};--t:${(7 + Math.random() * 8).toFixed(1)}s;--d:-${(Math.random() * 12).toFixed(1)}s;--dx:${Math.round(Math.random() * 50 - 25)}px"></i>`).join('');
  },
};

const SCENES = {
  /* INSIDE: golden throne under a great stained-glass window */
  throne() {
    const a = art;
    const panes = ['#ffcf5c', '#e5484d', '#3f7fe0', '#ffcf5c', '#2fb37a', '#e5484d'];
    let glass = '';
    for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) glass += `<rect x="${302 + c * 33}" y="${58 + r * 36}" width="33" height="36" fill="${panes[(r * 2 + c) % panes.length]}"/>`;
    return a.svg(`${a.defs('#3a3350', '#221d33')}
      <rect x="-200" width="1200" height="290" fill="url(#bsBrick)"/><rect x="-200" width="1200" height="290" fill="url(#bsDown)"/>
      <clipPath id="bsArch"><path d="${a.round(302, 196, 32, 240)}"/></clipPath>
      <path d="${a.round(288, 224, 18, 248)}" fill="#6b6078"/><path d="${a.round(288, 224, 18, 248)}" fill="url(#bsDown)" opacity=".5"/>
      <g clip-path="url(#bsArch)" class="bs-pulse"><rect x="302" y="20" width="196" height="222" fill="#ffcf5c"/>${glass}<circle cx="400" cy="95" r="50" fill="#fff1b8"/><path d="M400 56l9 26h27l-22 16 8 27-22-17-22 17 8-27-22-16h27z" fill="#e5484d"/></g>
      <path d="M335 50v190M368 42v198M400 32v208M433 42v198M466 50v190M302 94h196M302 130h196M302 166h196M302 202h196" stroke="#1a1426" stroke-width="3" fill="none"/>
      <path class="bs-shaft" d="M305 240L120 400H680L495 240z" fill="url(#bsShaft)"/>
      ${a.floor(286, '#2a2438', '#463d58')}
      <path d="M360 286h80l135 114H225z" fill="#7d1426"/><path d="M360 286h7l-112 114h-30zM440 286h-7l112 114h30z" fill="#d9a93a"/><path d="M360 286h80l135 114H225z" fill="url(#bsUp)" opacity=".45"/>
      <path d="M300 286h200l14-14H286zM314 272h172l12-12H302zM326 260h148l10-10H316z" fill="#5d5470"/><path d="M286 272h228v14H286zM302 260h196v12H302zM316 250h168v10H316z" fill="#4a4259"/>
      <circle class="bs-glow" cx="400" cy="172" r="120" fill="url(#bsWarm)" opacity=".55"/>
      <path d="M362 250V140l9-34 9 20 20-40 20 40 9-20 9 34v110z" fill="#c9962e"/><path d="M372 250V146l8-12 20-28 20 28 8 12v104z" fill="#8c1a2e"/><path d="M372 150l28-38v138h-28z" fill="#000" opacity=".16"/><path d="M350 250v-52h14v52zM436 250v-52h14v52z" fill="#a97a22"/><path d="M346 196h22v8h-22zM432 196h22v8h-22z" fill="#e6b84a"/><path d="M362 218h76v14h-76z" fill="#b01f35"/><path d="M388 88l-6-14 9 5 9-10 9 10 9-5-6 14z" fill="#ffd968"/>
      ${a.column(218, 44, 292, '#574d68')}${a.column(538, 44, 292, '#574d68')}
      ${a.banner(148, 46, 44, 150, '#8c1a2e')}${a.banner(608, 46, 44, 150, '#1c3f8f')}
      ${a.column(88, 66, 322, '#4f4660')}${a.column(646, 66, 322, '#4f4660')}
      ${a.torch(240, 150, 0.9)}${a.torch(560, 150, 0.9)}${a.torch(121, 170, 1.15)}${a.torch(679, 170, 1.15)}
      ${a.column(-34, 84, 372, '#3c3449')}${a.column(750, 84, 372, '#3c3449')}${a.column(-200, 110, 400, '#2f2839')}${a.column(890, 110, 400, '#2f2839')}
      ${a.vignette}`) + a.motes(14, '#ffe6a8');
  },

  /* INSIDE: timber roof, roaring fireplace, candle chandeliers */
  hall() {
    const a = art;
    const chandelier = (x, y, s, i) => {
      const flames = [-46, -23, 0, 23, 46].map(dx => `<path d="M${x + dx * s - 2} ${y + 6 * s}v${-12 * s}h4v${12 * s}z" fill="#efe3c6"/>${a.flame(x + dx * s, y - 6 * s, 0.42 * s)}`).join('');
      return `<g class="bs-swing" style="animation-delay:${-i}s;transform-origin:${x}px 0"><path d="M${x} 0V${y - 16 * s}" stroke="#14100c" stroke-width="3"/><path d="M${x} ${y - 16 * s}L${x - 48 * s} ${y + 6 * s}M${x} ${y - 16 * s}L${x + 48 * s} ${y + 6 * s}" stroke="#14100c" stroke-width="2"/><circle cx="${x}" cy="${y}" r="${70 * s}" fill="url(#bsWarm)" class="bs-glow"/><ellipse cx="${x}" cy="${y + 7 * s}" rx="${52 * s}" ry="${7 * s}" fill="none" stroke="#14100c" stroke-width="${4 * s}"/>${flames}</g>`;
    };
    const shield = (x, y, c) => `<path d="M${x - 19} ${y - 22}h38v22c0 14-9 22-19 28-10-6-19-14-19-28z" fill="${c}" stroke="#d9a93a" stroke-width="3"/><path d="M${x} ${y - 22}v50M${x - 19} ${y}h38" stroke="#d9a93a" stroke-width="2.500"/><path d="M${x - 34} ${y - 30}L${x + 34} ${y + 34}M${x + 34} ${y - 30}L${x - 34} ${y + 34}" stroke="#a9b1c0" stroke-width="3.500" style="mix-blend-mode:normal"/>`;
    const table = (x1, x2, top) => `<path d="M${x1} ${top}h${x2 - x1}l${(x1 < 400 ? -26 : 26)} 22H${x1 + (x1 < 400 ? -26 : 26)}z" fill="#5a3a20"/><path d="M${x1 + (x1 < 400 ? -26 : 26)} ${top + 22}H${x2 + (x1 < 400 ? -26 : 26)}v6H${x1 + (x1 < 400 ? -26 : 26)}z" fill="#2f1d0f"/><path d="M${x1 + 6} ${top + 28}v22M${x2 - 26} ${top + 28}v22" stroke="#2f1d0f" stroke-width="6"/>`;
    const goblet = (x, y) => `<path d="M${x - 5} ${y - 12}h10l-2 8h-6zM${x - 1} ${y - 4}h2v4h-2zM${x - 4} ${y}h8v2h-8z" fill="#d9a93a"/>`;
    const truss = x => `<path d="M${x} 0V96M${x - 74} 96Q${x} 8 ${x + 74} 96" fill="none" stroke="#2b1a0d" stroke-width="13"/><path d="M${x - 88} 96h176" stroke="#3a2412" stroke-width="15"/>`;
    return a.svg(`${a.defs('#4b3c34', '#2e241e')}
      <rect x="-200" width="1200" height="300" fill="url(#bsBrick)"/><rect x="-200" width="1200" height="110" fill="#1b110a"/>
      <rect x="-200" y="96" width="1200" height="150" fill="url(#bsDown)" opacity=".7"/>
      ${truss(-100)}${truss(90)}${truss(280)}${truss(520)}${truss(710)}${truss(900)}<path d="M-200 12h1200M-200 48h1200" stroke="#2b1a0d" stroke-width="9"/>
      <rect x="-200" y="214" width="1200" height="76" fill="#3f2a18"/><path d="M-200 214h1200" stroke="#26180c" stroke-width="6"/>${Array.from({ length: 31 }, (_, i) => `<path d="M${i * 40 - 200} 214v76" stroke="#26180c" stroke-width="2"/>`).join('')}
      ${a.floor(286, '#4a3018', '#5e3e20', 8)}
      <ellipse class="bs-glow" cx="400" cy="312" rx="280" ry="44" fill="url(#bsWarm)"/>
      <path d="M274 290V128h252v162z" fill="#6b5a4e"/><rect x="274" y="128" width="252" height="162" fill="url(#bsDown)" opacity=".35"/><path d="M256 128h288v-18H256z" fill="#7d6a5c"/><path d="M256 128h288v5H256z" fill="#000" opacity=".4"/>
      <path d="${a.round(308, 184, 150, 290)}" fill="#120a06"/><circle class="bs-glow" cx="400" cy="256" r="104" fill="url(#bsWarm)"/>
      <path d="M340 286l50-14M460 286l-50-14M360 278l80 8" stroke="#2c1a0e" stroke-width="10" stroke-linecap="round"/>
      ${a.flame(400, 280, 3)}${a.flame(362, 282, 2)}${a.flame(438, 282, 2.1)}${a.flame(382, 284, 1.5)}${a.flame(420, 284, 1.4)}
      <path d="M382 110h36l-3 8h-30z" fill="#d9a93a"/><path d="M400 62l22 10v20c0 12-11 18-22 24-11-6-22-12-22-24V72z" fill="#8c1a2e" stroke="#d9a93a" stroke-width="3"/><path d="M388 90l2-11 5 5 5-8 5 8 5-5 2 11z" fill="#ffd968"/>
      ${shield(164, 172, '#1c3f8f')}${shield(636, 172, '#8c1a2e')}
      ${a.banner(214, 108, 38, 96, '#8c1a2e')}${a.banner(548, 108, 38, 96, '#1c3f8f')}
      ${a.torch(50, 184, 1)}${a.torch(750, 184, 1)}${shield(-90, 172, '#8c1a2e')}${shield(890, 172, '#1c3f8f')}
      ${table(36, 204, 296)}${table(596, 764, 296)}${goblet(78, 298)}${goblet(150, 298)}${goblet(644, 298)}${goblet(722, 298)}
      ${chandelier(150, 76, 1, 0)}${chandelier(650, 76, 1, 1.4)}
      ${a.vignette}`) + a.motes(16, '#ffb65c');
  },

  /* INSIDE: tall gothic arches and a rose window throwing colour on the floor */
  chapel() {
    const a = art;
    const cols = ['#e5484d', '#3f7fe0', '#ffcf5c', '#7c4dff', '#2fb37a', '#e5484d', '#3f7fe0', '#ffcf5c'];
    const petals = cols.map((c, i) => `<path transform="rotate(${i * 45} 400 112)" d="M400 112L382 56a20 20 0 0 1 36 0z" fill="${c}"/>`).join('');
    const spokes = cols.map((_, i) => `<path transform="rotate(${i * 45 + 22.5} 400 112)" d="M400 112V36" stroke="#120f22" stroke-width="3.500"/>`).join('');
    const lancet = (x, c1, c2) => `<path class="bs-pulse" d="${a.pointed(x, 40, 120, 262)}" fill="${c1}"/><path d="M${x} 170h40M${x} 205h40M${x} 238h40M${x + 20} 124v138" stroke="#120f22" stroke-width="3"/><rect x="${x + 4}" y="176" width="14" height="26" fill="${c2}"/><rect x="${x + 22}" y="210" width="14" height="24" fill="${c2}"/>`;
    const candles = (x, y, n) => Array.from({ length: n }, (_, i) => `<rect x="${x + i * 13 - 2}" y="${y - (i % 2) * 8}" width="5" height="${18 + (i % 2) * 8}" fill="#efe3c6"/>${a.flame(x + i * 13 + 0.5, y - (i % 2) * 8, 0.4)}`).join('');
    const stand = (x, s) => `<path d="M${x} ${290 + 40 * s}V${250 - 10 * s}M${x - 18 * s} ${290 + 40 * s}h${36 * s}M${x - 20 * s} ${250 - 10 * s}h${40 * s}" stroke="#2a2438" stroke-width="${5 * s}"/><circle class="bs-glow" cx="${x}" cy="${234 - 10 * s}" r="${48 * s}" fill="url(#bsWarm)"/>${candles(x - 13 * s, 240 - 10 * s, 3)}`;
    return a.svg(`${a.defs('#3a3f5c', '#232740')}
      <rect x="-200" width="1200" height="292" fill="url(#bsBrick)"/><rect x="-200" width="1200" height="292" fill="url(#bsDown)"/>
      <path d="${a.pointed(186, 428, 0, 292)}" fill="#2c3049"/><path d="${a.pointed(212, 376, 10, 292)}" fill="#343955"/><path d="${a.pointed(238, 324, 18, 292)}" fill="#2a2e47"/>
      <circle cx="400" cy="112" r="92" fill="#5a607e"/><circle cx="400" cy="112" r="82" fill="#120f22"/><g class="bs-pulse">${petals}<circle cx="400" cy="112" r="24" fill="#fff1b8"/></g>${spokes}<circle cx="400" cy="112" r="24" fill="none" stroke="#120f22" stroke-width="4"/><circle cx="400" cy="112" r="76" fill="none" stroke="#120f22" stroke-width="4"/>
      ${lancet(282, '#3f7fe0', '#ffcf5c')}${lancet(478, '#e5484d', '#ffcf5c')}
      <path class="bs-shaft" d="M340 180L190 400H610L460 180z" fill="url(#bsShaft)"/>
      ${a.floor(290, '#2b2e44', '#454a68')}
      <g class="bs-pool"><ellipse cx="320" cy="340" rx="74" ry="16" fill="#3f7fe0" opacity=".35"/><ellipse cx="400" cy="360" rx="96" ry="20" fill="#ffcf5c" opacity=".28"/><ellipse cx="490" cy="336" rx="74" ry="16" fill="#e5484d" opacity=".35"/></g>
      <path d="M340 292V252h120v40z" fill="#5d6280"/><path d="M332 252h136v-9H332z" fill="#efe3c6"/><path d="M332 243h136v5H332z" fill="#d9a93a"/><path d="M340 258h120v34H340z" fill="url(#bsUp)"/>
      <path d="M396 200h8v43h-8zM384 212h32v8h-32z" fill="#e6b84a"/>${candles(346, 226, 3)}${candles(428, 226, 3)}
      <circle class="bs-glow" cx="400" cy="226" r="74" fill="url(#bsWarm)"/>
      ${a.column(138, 50, 296, '#555b78')}${a.column(612, 50, 296, '#555b78')}
      ${a.banner(204, 70, 28, 96, '#2b4a9a')}${a.banner(568, 70, 28, 96, '#8c1a2e')}
      ${a.column(30, 74, 332, '#474c68')}${a.column(696, 74, 332, '#474c68')}
      ${a.column(-120, 90, 372, '#3a3f5c')}${a.column(830, 90, 372, '#3a3f5c')}${stand(216, 1)}${stand(584, 1)}${stand(118, 1.2)}${stand(682, 1.2)}
      ${a.vignette}`) + a.motes(12, '#dce8ff');
  },

  /* OUTSIDE: the great gatehouse under the moon, firelight spilling out */
  gate() {
    const a = art;
    const stars = Array.from({ length: 34 }, (_, i) => `<circle class="bs-star" style="animation-delay:${-(i % 7)}s" cx="${(i * 97) % 800}" cy="${(i * 53) % 140}" r="${i % 3 ? 1 : 1.6}" fill="#fff"/>`).join('');
    const bars = [342, 362, 382, 402, 422, 442, 458].map(x => `<path d="M${x} 176v76l3 10 3-10v-76" fill="#1a1820"/>`).join('');
    const stone = '#4d5570';
    return a.svg(`${a.defs('#3e4560', '#262b40')}
      <rect x="-200" width="1200" height="400" fill="#0c1230"/><rect x="-200" width="1200" height="240" fill="url(#bsSkyN)"/>
      <defs><linearGradient id="bsSkyN" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#070a22"/><stop offset="1" stop-color="#2a3468"/></linearGradient></defs>
      ${stars}<circle cx="640" cy="66" r="100" fill="url(#bsCool)"/><circle cx="640" cy="66" r="31" fill="#eef3ff"/><circle cx="630" cy="58" r="6" fill="#cdd8ef"/><circle cx="650" cy="76" r="4" fill="#cdd8ef"/>
      <g class="bs-drift"><path d="M80 80c30-22 70-22 96-4 30-14 70-8 88 12H70zM900 50c30-22 70-22 96-4 30-14 70-8 88 12H890z" fill="#1c2450" opacity=".85"/></g>
      <rect x="-200" y="150" width="1200" height="160" fill="url(#bsBrick)"/><rect x="-200" y="150" width="1200" height="70" fill="url(#bsDown)" opacity=".4"/>${a.merlons(-200, 1000, 150, 18, 14, 16, '#3e4560')}
      ${a.tower(18, 92, 96, 310, stone, '#3b1f35')}${a.tower(690, 92, 96, 310, stone, '#3b1f35')}
      ${a.win(58, 150, 12, 26)}${a.win(730, 150, 12, 26)}
      <rect x="312" y="70" width="176" height="240" fill="url(#bsBrick)"/>${a.merlons(306, 494, 70, 20, 14, 14, '#3e4560')}
      ${a.tower(232, 88, 44, 312, stone, '#3b1f35')}${a.tower(480, 88, 44, 312, stone, '#3b1f35')}
      ${a.win(270, 110, 12, 30)}${a.win(518, 110, 12, 30)}${a.win(270, 200, 10, 26)}${a.win(520, 200, 10, 26)}
      <path d="${a.round(322, 156, 150, 312)}" fill="#6a6f8a"/><path d="${a.round(334, 132, 162, 312)}" fill="#3a1d0c"/>
      <path class="bs-pulse" d="${a.round(334, 132, 162, 312)}" fill="#a84a18" opacity=".7"/><path d="M360 312v-84h80v84z" fill="#ffb45c" opacity=".55"/><path d="M382 312v-110h36v110z" fill="#ffe2a6" opacity=".5"/><circle class="bs-glow" cx="400" cy="262" r="96" fill="url(#bsWarm)"/>
      <path d="M340 312v-34h30v34zM430 312v-34h30v34z" fill="#2a160a" opacity=".6"/>${bars}<path d="M336 176h128M336 202h128M336 228h128" stroke="#1a1820" stroke-width="5"/>
      <path d="M382 98l18-10 18 10v22c0 10-9 15-18 20-9-5-18-10-18-20z" fill="#8c1a2e" stroke="#d9a93a" stroke-width="2.500"/><path d="M390 118l2-10 4 4 4-7 4 7 4-4 2 10z" fill="#ffd968"/>
      ${a.banner(244, 150, 30, 92, '#8c1a2e')}${a.banner(526, 150, 30, 92, '#1c3f8f')}
      ${a.torch(322, 214, 0.9)}${a.torch(478, 214, 0.9)}${a.torch(170, 228, 1)}${a.torch(630, 228, 1)}
      ${a.floor(310, '#2c3044', '#3b4058', 7)}
      <path d="M322 310h156l120 90H202z" fill="#ff9a3d" opacity=".2"/>
      <rect x="-200" y="306" width="1200" height="9" fill="#14161f" opacity=".6"/>
      <g class="bs-fog"><ellipse cx="120" cy="318" rx="340" ry="18" fill="#a8b8e0" opacity=".12"/><ellipse cx="700" cy="322" rx="340" ry="16" fill="#a8b8e0" opacity=".1"/></g>
      ${a.vignette}`) + a.motes(10, '#ffb65c');
  },

  /* OUTSIDE: on top of the castle wall in a thunderstorm */
  ramparts() {
    const a = art;
    const pole = (x, c, i) => `<path d="M${x} 300V78" stroke="#7a6a58" stroke-width="5"/><g class="bs-whip" style="animation-delay:${-i * 0.4}s;transform-origin:${x}px 88px"><path d="M${x} 82c30-8 58 14 96-2l-14 26 14 26c-38 14-66-8-96 0z" fill="${c}"/><path d="M${x} 82c30-8 58 14 96-2l-4 8c-36 14-62-8-92-1z" fill="#000" opacity=".25"/></g>`;
    const rev = (x, c, i) => `<path d="M${x} 300V78" stroke="#7a6a58" stroke-width="5"/><g class="bs-whip" style="animation-delay:${-i * 0.4}s;transform-origin:${x}px 88px"><path d="M${x} 82c-30-8-58 14-96-2l14 26-14 26c38 14 66-8 96 0z" fill="${c}"/></g>`;
    return `<div class="bs-flash"></div>` + a.svg(`${a.defs('#4a4c5e', '#2c2d3a')}
      <defs><linearGradient id="bsSkyS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d0f1f"/><stop offset=".7" stop-color="#2f3650"/><stop offset="1" stop-color="#55506a"/></linearGradient></defs>
      <rect x="-200" width="1200" height="400" fill="url(#bsSkyS)" class="bs-skyfill"/>
      <g class="bs-drift fast"><path d="M-100 70c60-46 150-46 210-10 50-32 150-24 190 22 60-30 150-24 190 12 50-30 160-26 210 8H-100zM800 70c60-46 150-46 210-10 50-32 150-24 190 22 60-30 150-24 190 12H800z" fill="#14172c" opacity=".92"/></g>
      <path class="bs-bolt" d="M560 0l-26 62h20l-32 58h18l-40 80 62-94h-20l30-50h-22l26-56z" fill="#eaf3ff"/>
      <path d="M-200 262l120-40 80 28 100-50 90 34 120-62 110 54 140-40 240 60 200-30v94H-200z" fill="#2a2d44"/>
      ${a.tower(600, 62, 112, 280, '#3a3c52', '#1f1a2c')}${a.tower(708, 54, 142, 280, '#34364b', '#1f1a2c')}<rect x="560" y="196" width="240" height="84" fill="#34364b"/>${a.merlons(560, 800, 196, 14, 10, 14, '#34364b')}${a.win(624, 150, 12, 26)}${a.win(728, 176, 10, 24)}${a.win(610, 224, 10, 22)}${a.win(676, 226, 10, 22)}
      ${a.tower(42, 56, 148, 280, '#34364b', '#1f1a2c')}${a.win(64, 186, 10, 24)}
      ${pole(164, '#8c1a2e', 0)}${rev(636, '#1c3f8f', 1)}
      <rect x="-200" y="222" width="1200" height="86" fill="url(#bsBrick)"/><rect x="-200" y="222" width="1200" height="86" fill="url(#bsUp)" opacity=".4"/>${a.merlons(-212, 1012, 222, 58, 46, 38, '#4a4c5e')}
      <path d="M${Array.from({ length: 13 }, (_, i) => `${i * 96 - 212} 176.500h58`).join('M')}" stroke="#7d8097" stroke-width="3"/>
      ${a.torch(106, 208, 1)}${a.torch(694, 208, 1)}${a.torch(394, 204, 0.8)}${a.torch(-90, 208, 1)}${a.torch(890, 208, 1)}
      ${a.floor(306, '#33354a', '#44475e', 7)}
      <g class="bs-wet"><path d="M100 330h150l-18 12H90zM540 350h160l-12 14H530zM340 380h130l-8 12H330z" fill="#b8c8ee" opacity=".16"/></g>
      ${a.vignette}`) + '<div class="bs-rain"></div>';
  },

  /* OUTSIDE: the inner courtyard at sunset, keep rising behind stone arcades */
  bailey() {
    const a = art;
    const arches = [-160, -50, 60, 170, 280, 410, 520, 630, 740, 850].map(x => `<path d="${a.round(x, 90, 192, 292)}" fill="#201420"/><circle class="bs-glow" style="animation-delay:${-x % 9}s" cx="${x + 45}" cy="266" r="44" fill="url(#bsWarm)"/>`).join('');
    return a.svg(`${a.defs('#6e5a56', '#493a38')}
      <defs><linearGradient id="bsSkyD" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2150"/><stop offset=".55" stop-color="#b6484f"/><stop offset="1" stop-color="#f3a154"/></linearGradient></defs>
      <rect x="-200" width="1200" height="300" fill="url(#bsSkyD)"/>
      <circle cx="400" cy="130" r="150" fill="url(#bsWarm)"/><circle cx="400" cy="130" r="36" fill="#ffe7a8"/>
      <g class="bs-drift"><path d="M40 60c40-18 90-14 120 2 40-12 90-8 110 8H30zM500 40c40-18 90-14 120 2 40-12 90-8 110 8H490z" fill="#6b2c4c" opacity=".7"/></g>
      ${a.tower(320, 160, 56, 220, '#463440', '#2c1b28')}${a.win(356, 100, 16, 34)}${a.win(428, 100, 16, 34)}${a.win(392, 150, 16, 34)}
      ${a.tower(150, 74, 84, 220, '#3e2e38', '#2c1b28')}${a.tower(576, 74, 84, 220, '#3e2e38', '#2c1b28')}${a.win(180, 120, 12, 26)}${a.win(606, 120, 12, 26)}
      <rect x="-200" y="138" width="1200" height="166" fill="url(#bsBrick)"/><rect x="-200" y="138" width="1200" height="50" fill="#000" opacity=".12"/>${a.merlons(-200, 1000, 138, 20, 14, 18, '#6e5a56')}
      ${arches}${[-60, 50, 160, 270, 400, 510, 620, 730, 840].map(x => `<rect x="${x - 10}" y="186" width="20" height="108" fill="#7d6864"/><rect x="${x - 10}" y="186" width="20" height="108" fill="url(#bsCyl)"/>`).join('')}
      <path d="M-200 180h1200v8H-200z" fill="#8a7470"/><path d="M-200 188h1200v5H-200z" fill="#000" opacity=".3"/>
      ${a.win(-100, 148, 12, 24)}${a.win(890, 148, 12, 24)}${a.win(100, 148, 12, 24)}${a.win(220, 148, 12, 24)}${a.win(340, 148, 12, 24)}${a.win(450, 148, 12, 24)}${a.win(570, 148, 12, 24)}${a.win(690, 148, 12, 24)}
      ${a.banner(198, 192, 28, 66, '#8c1a2e')}${a.banner(574, 192, 28, 66, '#1c3f8f')}${a.banner(386, 192, 28, 66, '#8c1a2e')}
      ${a.floor(298, '#5c4a44', '#6f5a52', 8)}
      <ellipse cx="400" cy="350" rx="240" ry="34" fill="#ffb060" opacity=".18"/>
      <path d="M46 300h86v-14h-86zM34 300h110v36H34z" fill="#6f5e58"/><rect x="34" y="300" width="110" height="36" fill="url(#bsCyl)"/><path d="M46 286v-60h6v60zM126 286v-60h6v60zM40 230l49-28 49 28z" fill="#2c1b18"/><path d="M89 226v44" stroke="#2c1b18" stroke-width="2"/>
      ${a.torch(724, 250, 1.1)}
      ${a.vignette}`) + a.motes(12, '#ffd48a') + '<div class="bs-birds"><i></i><i></i><i></i></div>';
  },
};

function battleScene(id) {
  const key = SCENES[id] ? id : 'throne';
  return `<div class="bs bs-${key}" aria-hidden="true">${SCENES[key]()}</div>`;
}
