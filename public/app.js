const socket = io();
const $ = sel => document.querySelector(sel);

// A secret token identifies you across refreshes so you keep your seat.
const token = localStorage.getItem('gh_token') || (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now());
localStorage.setItem('gh_token', token);

let S = null; // latest { room, game, you }
const afterRender = []; // hooks run after every render (e.g. to re-mount the drawing canvas)
const ui_opts = {}; // host's chosen options per game, e.g. { pictionary: { rounds: 3 } }
// phones get the native share sheet (WhatsApp etc.) instead of copy-to-clipboard
const canShare = !!navigator.share && matchMedia('(pointer: coarse)').matches;
const ui = { arrange: Array(25).fill(null), selected: new Set(), marks: new Set(), dadiSel: null, lastGameKey: null, chatCount: 0 };

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nameOf = id => (S.room.players.find(p => p.id === id) || {}).name || '?';
const isHost = () => S && S.room.hostId === S.you;

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.add('hidden'), 2800);
}
const done = res => res && (res.error || res.message) && toast(res.error || res.message);
const act = payload => socket.emit('action', payload, done);

/* ---------- Icons (Lucide paths) ---------- */
const ICON_PATHS = {
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  crown: '<path d="M11.56 3.27a.5.5 0 0 1 .88 0l2.95 5.6a1 1 0 0 0 1.52.3l4.27-3.67a.5.5 0 0 1 .8.52l-2.83 10.25a1 1 0 0 1-.96.73H5.81a1 1 0 0 1-.96-.73L2.02 6.02a.5.5 0 0 1 .8-.52l4.28 3.67a1 1 0 0 0 1.51-.3z"/><path d="M5 21h14"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
  rotate: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  shuffle: '<path d="m18 14 4 4-4 4"/><path d="m18 2 4 4-4 4"/><path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="M2 6h1.6c1.4 0 2.8.8 3.4 2"/><path d="M22 18h-6.1c-1.4 0-2.6-.7-3.3-1.7l-.5-.7"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  equal: '<line x1="5" x2="19" y1="9" y2="9"/><line x1="5" x2="19" y1="15" y2="15"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  pen: '<path d="M12 20h9"/><path d="M16.38 3.62a1 1 0 0 1 3 3L7.37 18.64a2 2 0 0 1-.85.5l-2.87.84a.5.5 0 0 1-.62-.62l.84-2.87a2 2 0 0 1 .5-.85z"/>',
  eraser: '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>',
  dice: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 8h.01M16 16h.01M16 8h.01M8 16h.01M12 12h.01"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>',
  hand: '<path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON_PATHS[name]}</svg>`;

/* ---------- Avatars (initials, like chess.com default avatars) ---------- */
const AV_COLORS = ['#7d5bbe', '#3f8f5c', '#c25450', '#3b7dc4', '#c9822f', '#a5476f', '#2f8f8a', '#7c6a46'];
function avatar(name, opts = {}) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const initials = name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2) || '?';
  return `<span class="avatar" style="background:${AV_COLORS[h % AV_COLORS.length]}">${esc(initials)}${opts.presence ? '<span class="presence"></span>' : ''}</span>`;
}
const avatarOf = id => avatar(nameOf(id));

/* ---------- Game thumbnails (drawn, not emoji) ---------- */
function thumb(id) {
  const T = {
    housie: `<rect width="96" height="64" fill="#1f5fa8"/><rect x="6" y="9" width="84" height="46" fill="#fff"/>
      ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => `<line x1="${6 + i * 9.33}" y1="15" x2="${6 + i * 9.33}" y2="55" stroke="#1f5fa8" stroke-width=".8"/>`).join('')}
      <rect x="6" y="9" width="84" height="6" fill="#1f5fa8"/><line x1="6" y1="28.3" x2="90" y2="28.3" stroke="#1f5fa8" stroke-width=".8"/><line x1="6" y1="41.6" x2="90" y2="41.6" stroke="#1f5fa8" stroke-width=".8"/>
      <g font-family="Arial" font-weight="700" font-size="7" fill="#111" text-anchor="middle"><text x="10.7" y="24.5">4</text><text x="29.3" y="24.5">27</text><text x="57.3" y="24.5">53</text><text x="20" y="37.8">12</text><text x="48" y="37.8">41</text><text x="85" y="37.8">88</text><text x="38.7" y="51">36</text><text x="66.7" y="51">70</text></g>
      <circle cx="29.3" cy="22" r="4.6" fill="#e6285a" opacity=".55"/><circle cx="48" cy="35.3" r="4.6" fill="#e6285a" opacity=".55"/>`,
    ashtachamma: `<rect width="96" height="64" fill="#b98552"/><rect x="24" y="4" width="56" height="56" fill="none" stroke="#4a2c14" stroke-width="1.6"/>
      ${[1, 2, 3, 4].map(i => `<line x1="${24 + i * 11.2}" y1="4" x2="${24 + i * 11.2}" y2="60" stroke="#4a2c14" stroke-width="1"/><line x1="24" y1="${4 + i * 11.2}" x2="80" y2="${4 + i * 11.2}" stroke="#4a2c14" stroke-width="1"/>`).join('')}
      ${[[2, 0], [2, 4], [0, 2], [4, 2], [2, 2]].map(([r, c]) => { const x = 24 + c * 11.2, y = 4 + r * 11.2; return `<path d="M${x + 2} ${y + 2}L${x + 9.2} ${y + 9.2}M${x + 9.2} ${y + 2}L${x + 2} ${y + 9.2}" stroke="#4a2c14" stroke-width="1"/>`; }).join('')}
      <circle cx="29.6" cy="21" r="3.6" fill="#d23b3b"/><circle cx="74.4" cy="43.4" r="3.6" fill="#2f6fd0"/><circle cx="52" cy="54.6" r="3.6" fill="#d23b3b"/>
      <ellipse cx="11" cy="22" rx="4" ry="6" fill="#f3e8cf"/><ellipse cx="11" cy="40" rx="4" ry="6" fill="#d3b47c"/>`,
    dadi: `<rect width="96" height="64" fill="#b98552"/><g fill="none" stroke="#3e2410" stroke-width="1.6"><rect x="22" y="4" width="56" height="56"/><rect x="31" y="13" width="38" height="38"/><rect x="40" y="22" width="20" height="20"/><path d="M50 4v18M50 42v18M22 32h18M60 32h18"/></g>
      <circle cx="22" cy="4" r="3.6" fill="#f3efe6"/><circle cx="50" cy="13" r="3.6" fill="#f3efe6"/><circle cx="60" cy="32" r="3.6" fill="#f3efe6"/><circle cx="78" cy="60" r="3.6" fill="#1f1c19"/><circle cx="31" cy="32" r="3.6" fill="#1f1c19"/><circle cx="40" cy="42" r="3.6" fill="#1f1c19"/>`,
    show: `<rect width="96" height="64" fill="#6d4a2e"/>
      <g font-family="Segoe Print, Comic Sans MS, cursive" font-size="6.5" font-weight="700" fill="#23307a" text-anchor="middle">
      <g transform="rotate(-8 24 34)"><rect x="8" y="22" width="32" height="22" fill="#fbf6e6"/><text x="24" y="36">Mango</text></g>
      <g transform="rotate(4 50 30)"><rect x="34" y="18" width="32" height="22" fill="#fbf6e6"/><text x="50" y="32">Mango</text></g>
      <g transform="rotate(10 74 36)"><rect x="58" y="24" width="32" height="22" fill="#fbf6e6"/><text x="74" y="38">Kiwi</text></g></g>`,
    bingo: `<rect width="96" height="64" fill="#fbf8ef"/>${[0, 1, 2, 3, 4, 5].map(i => `<line x1="0" y1="${6 + i * 11}" x2="96" y2="${6 + i * 11}" stroke="#b8d1e6" stroke-width=".8"/>`).join('')}<line x1="14" y1="0" x2="14" y2="64" stroke="#e46a6a"/>
      <g stroke="#23307a" stroke-width="1" fill="none"><rect x="30" y="8" width="50" height="50"/>${[1, 2, 3, 4].map(i => `<line x1="${30 + i * 10}" y1="8" x2="${30 + i * 10}" y2="58"/><line x1="30" y1="${8 + i * 10}" x2="80" y2="${8 + i * 10}"/>`).join('')}</g>
      <line x1="30" y1="13" x2="80" y2="13" stroke="#c62828" stroke-width="1.6"/><line x1="30" y1="8" x2="80" y2="58" stroke="#c62828" stroke-width="1.6"/>`,
    ramsita: `<rect width="96" height="64" fill="#6d4a2e"/>
      ${[[14, 18, -12], [38, 30, 8], [60, 14, -4], [70, 38, 14], [30, 42, -6]].map(([x, y, r]) => `<g transform="rotate(${r} ${x + 10} ${y + 7})"><rect x="${x}" y="${y}" width="20" height="14" fill="#f6f0df"/><line x1="${x + 10}" y1="${y}" x2="${x + 10}" y2="${y + 14}" stroke="#d6cbb0"/></g>`).join('')}`,
    ipl: `<rect width="96" height="64" fill="#0b1f4d"/><circle cx="48" cy="70" r="46" fill="#123a8a"/><rect x="30" y="10" width="36" height="44" rx="4" fill="#f4f1ea"/><circle cx="48" cy="25" r="7" fill="#c9a26b"/><path d="M36 46c2-8 22-8 24 0" fill="#1e88e5"/><rect x="8" y="40" width="22" height="12" rx="6" fill="#F9CD05"/><text x="19" y="49" font-family="Arial" font-size="7" font-weight="900" fill="#1c2a6b" text-anchor="middle">CSK</text><rect x="66" y="40" width="22" height="12" rx="6" fill="#D1001C"/><text x="77" y="49" font-family="Arial" font-size="7" font-weight="900" fill="#fff" text-anchor="middle">RCB</text><text x="48" y="61" font-family="Arial" font-size="7" font-weight="900" fill="#f2c14e" text-anchor="middle">SOLD ₹18 Cr</text>`,
    pictionary: `<rect width="96" height="64" fill="#fff"/><path d="M18 46c6-18 16-26 24-10s14 4 20-8 12-6 16 6" fill="none" stroke="#1e88e5" stroke-width="3" stroke-linecap="round"/><circle cx="30" cy="20" r="7" fill="#fdd835"/><path d="M60 52 82 30l5 5-22 22-7 2z" fill="#e53935"/><rect x="0" y="0" width="96" height="64" fill="none" stroke="#ddd"/>`,
    emojimovie: `<rect width="96" height="64" fill="#3c3a37"/><rect x="10" y="12" width="76" height="40" rx="6" fill="#262421"/><text x="48" y="39" font-size="17" text-anchor="middle">🪰😡🔪</text>`,
    mostlikely: `<rect width="96" height="64" fill="#2e3a24"/><rect x="10" y="10" width="76" height="12" rx="3" fill="#81b64c"/><rect x="10" y="27" width="56" height="8" rx="2" fill="#95c45f"/><rect x="10" y="39" width="34" height="8" rx="2" fill="#6d9f43"/><rect x="10" y="51" width="18" height="8" rx="2" fill="#537a2f"/><circle cx="78" cy="31" r="4" fill="#f2c14e"/>`,
    sequence: `<rect width="96" height="64" fill="#22603a"/>
      <g transform="rotate(-16 30 40)"><rect x="18" y="16" width="24" height="34" rx="3" fill="#fff"/><text x="22" y="26" font-family="Georgia" font-size="8" font-weight="700" fill="#c8102e">5♥</text></g>
      <g transform="rotate(-4 46 38)"><rect x="34" y="12" width="24" height="34" rx="3" fill="#fff"/><text x="38" y="22" font-family="Georgia" font-size="8" font-weight="700" fill="#c8102e">6♥</text></g>
      <g transform="rotate(10 62 38)"><rect x="50" y="12" width="24" height="34" rx="3" fill="#fff"/><text x="54" y="22" font-family="Georgia" font-size="8" font-weight="700" fill="#c8102e">7♥</text></g>
      <rect x="66" y="40" width="22" height="16" rx="2" fill="#f2c14e"/><text x="77" y="51" font-family="Arial" font-size="9" font-weight="900" fill="#3a2a05" text-anchor="middle">?</text>`,
    rummy: `<rect width="96" height="64" fill="#22603a"/>
      <g transform="rotate(-16 30 40)"><rect x="18" y="16" width="24" height="34" rx="3" fill="#fff"/><text x="22" y="26" font-family="Georgia" font-size="8" font-weight="700" fill="#c8102e">9♦</text></g>
      <g transform="rotate(-4 46 38)"><rect x="34" y="12" width="24" height="34" rx="3" fill="#fff"/><text x="38" y="22" font-family="Georgia" font-size="8" font-weight="700" fill="#c8102e">10♦</text></g>
      <g transform="rotate(10 62 38)"><rect x="50" y="12" width="24" height="34" rx="3" fill="#fff"/><text x="54" y="22" font-family="Georgia" font-size="8" font-weight="700" fill="#c8102e">J♦</text></g>
      <rect x="70" y="38" width="20" height="22" rx="2" fill="#fff" transform="rotate(14 80 49)"/><text x="80" y="53" font-family="Arial" font-size="9" fill="#7d3cb5" text-anchor="middle" transform="rotate(14 80 49)">★</text>`,
    charades: `<rect width="96" height="64" fill="#3c3a37"/><g transform="rotate(-10 20 22)"><rect x="16" y="14" width="64" height="10" fill="#f4f4f4"/>${[0, 1, 2, 3].map(i => `<path d="M${22 + i * 16} 14h8l-6 10h-8z" fill="#1b1b1b"/>`).join('')}</g><rect x="16" y="26" width="64" height="30" rx="3" fill="#1b1b1b"/><text x="48" y="45" font-family="Segoe Print, Comic Sans MS, cursive" font-size="10" font-weight="700" fill="#f4f4f4" text-anchor="middle">సినిమా</text>`,
    leastcount: `<rect width="96" height="64" fill="#22603a"/>
      <g transform="rotate(-10 36 34)"><rect x="22" y="12" width="28" height="40" rx="3" fill="#fff"/><text x="27" y="23" font-family="Georgia" font-size="9" font-weight="700" fill="#c8102e">A♥</text></g>
      <g transform="rotate(8 58 32)"><rect x="44" y="10" width="28" height="40" rx="3" fill="#fff"/><text x="49" y="21" font-family="Georgia" font-size="9" font-weight="700" fill="#111">5♣</text></g>`,
  };
  return `<svg viewBox="0 0 96 64" aria-hidden="true">${T[id] || '<rect width="96" height="64" fill="#3c3a37"/>'}</svg>`;
}

/* ---------- Static chrome ---------- */
$('#copyLink').innerHTML = canShare ? `${icon('share')} Share invite` : `${icon('link')} Copy invite link`;
$('#leaveBtn').innerHTML = `${icon('logout')} Leave room`;
$('#chatSend').innerHTML = icon('send');
$('#charadesThumb').innerHTML = thumb('charades');

function gameRow(g, opts = {}) {
  const tag = opts.button ? 'button' : 'div';
  return `<${tag} class="game-row ${opts.selected ? 'selected' : ''}" ${opts.button ? `data-select="${g.id}" ${opts.disabled ? 'disabled' : ''}` : ''}>
    <span class="thumb">${thumb(g.id)}</span>
    <span><h4>${esc(g.name)}</h4><p>${esc(g.blurb)}</p><span class="players-needed">${g.minPlayers === g.maxPlayers ? g.minPlayers : `${g.minPlayers}–${g.maxPlayers}`} players</span></span>
  </${tag}>`;
}

fetch('/api/games').then(r => r.json()).then(list => {
  $('#catalog').innerHTML = list.map(g => gameRow(g)).join('');
}).catch(() => {});

/* ---------- Home ---------- */
$('#nameInput').value = localStorage.getItem('gh_name') || '';
const params = new URLSearchParams(location.search);
if (params.get('room')) $('#codeInput').value = params.get('room').toUpperCase();

function getName() {
  const name = $('#nameInput').value.trim();
  if (!name) { $('#homeError').textContent = 'Enter your name first.'; $('#nameInput').focus(); return null; }
  localStorage.setItem('gh_name', name);
  return name;
}

function enterRoom(res) {
  if (res.error) { $('#homeError').textContent = res.error; localStorage.removeItem('gh_room'); return; }
  $('#homeError').textContent = '';
  localStorage.setItem('gh_room', res.code);
  history.replaceState(null, '', '?room=' + res.code);
}

$('#createBtn').onclick = () => {
  const name = getName();
  if (name) socket.emit('create', { name, token }, enterRoom);
};
$('#joinBtn').onclick = () => {
  const name = getName();
  const code = $('#codeInput').value.trim().toUpperCase();
  if (!name) return;
  if (code.length !== 4) { $('#homeError').textContent = 'Room codes have 4 letters.'; return; }
  socket.emit('join', { code, name, token }, enterRoom);
};
$('#codeInput').addEventListener('keydown', e => e.key === 'Enter' && $('#joinBtn').click());
$('#nameInput').addEventListener('keydown', e => e.key === 'Enter' && ($('#codeInput').value.trim() ? $('#joinBtn') : $('#createBtn')).click());

// Rejoin automatically after refresh / reconnect
socket.on('connect', () => {
  const code = localStorage.getItem('gh_room');
  if (code && $('#charades').classList.contains('hidden')) socket.emit('join', { code, token, name: localStorage.getItem('gh_name') || undefined }, res => { if (res.error) { localStorage.removeItem('gh_room'); showHome(); } });
});

function showHome() {
  S = null;
  $('#reactDock').classList.add('hidden');
  $('#charades').classList.add('hidden');
  $('#home').classList.remove('hidden');
  $('#room').classList.add('hidden');
  $('#roomChip').classList.add('hidden');
  document.title = 'GameHub — play with friends';
}

$('#leaveBtn').onclick = () => {
  socket.emit('leave');
  localStorage.removeItem('gh_room');
  history.replaceState(null, '', '/');
  showHome();
};
socket.on('kicked', () => { localStorage.removeItem('gh_room'); showHome(); toast('You were removed from the room'); });

const inviteLink = () => `${location.origin}/?room=${S.room.code}`;
function copyInvite() {
  const link = inviteLink();
  if (canShare) {
    navigator.share({ title: 'GameHub', text: `Join my GameHub room ${S.room.code}`, url: link }).catch(() => {});
    return;
  }
  (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject())
    .then(() => toast('Invite link copied — send it to your friends'))
    .catch(() => prompt('Copy this link:', link));
}
$('#copyLink').onclick = copyInvite;
$('#roomChip').onclick = copyInvite;

$('#chatForm').onsubmit = e => {
  e.preventDefault();
  const text = $('#chatInput').value.trim();
  if (text) socket.emit('chat', { text });
  $('#chatInput').value = '';
};

/* ---------- State updates ---------- */
socket.on('state', state => {
  const prevGame = S && S.game;
  S = state;
  ui.skew = state.now ? state.now - Date.now() : 0; // server clock minus ours, for countdowns
  const g0 = S.game;
  if (g0 && g0.cue && (!prevGame || prevGame.gameId !== g0.gameId || !prevGame.cue || prevGame.cue.n !== g0.cue.n) && prevGame) window.SFX && SFX.play(g0.cue.type);
  $('#home').classList.add('hidden');
  $('#charades').classList.add('hidden');
  $('#room').classList.remove('hidden');
  $('#roomChip').classList.remove('hidden');
  $('#roomChip').innerHTML = `${icon('link')} Room <b>${S.room.code}</b>`;

  // reset local-only UI bits whenever a new game or round starts
  const g = S.game;
  const fresh = g && g.called ? g.called.length === 0 : '';
  const key = g ? `${g.gameId}:${g.round || ''}:${g.phase === 'arrange' || g.phase === 'words'}:${fresh}` : 'lobby';
  if (key !== ui.lastGameKey) { ui.arrange = Array(25).fill(null); ui.selected.clear(); ui.marks.clear(); ui.dadiSel = null; ui.lastGameKey = key; }
  if (g && g.gameId === 'leastcount') for (const c of [...ui.selected]) if (!g.myHand.includes(c)) ui.selected.delete(c);
  syncAutoCall();

  const myTurnNow = g && g.turnId === S.you;
  if (myTurnNow && !(prevGame && prevGame.turnId === S.you)) {
    document.title = '● Your turn — GameHub';
    if (prevGame && navigator.vibrate) navigator.vibrate(120);
    if (prevGame && window.SFX) SFX.play('turn');
  }
  else if (!myTurnNow) document.title = `Room ${S.room.code} — GameHub`;

  renderSide();
  render();
  renderTabs();
  syncWakeLock();
});

function renderSide() {
  $('#playerCount').textContent = `${S.room.players.length}/8`;
  $('#playerList').innerHTML = S.room.players.map(p => `
    <li class="${p.connected ? '' : 'offline'}">
      ${avatar(p.name, { presence: true })}
      <span class="pname">${esc(p.name)}</span>
      ${p.id === S.room.hostId ? `<span class="host-badge" title="Host">${icon('crown')}</span>` : ''}
      ${p.id === S.you ? '<span class="you">you</span>' : ''}
      ${isHost() && !S.room.inGame && p.id !== S.you ? `<button class="btn kick" data-kick="${p.id}" title="Remove ${esc(p.name)}" aria-label="Remove ${esc(p.name)}">${icon('x')}</button>` : ''}
    </li>`).join('');

  const log = $('#chatLog');
  const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
  log.innerHTML = S.room.chat.map(m => m.from
    ? `<div><b>${esc(m.from)}</b> ${esc(m.text)}</div>`
    : `<div class="sys">${esc(m.text)}</div>`).join('') || '<div class="sys">No messages yet.</div>';
  if (atBottom || S.room.chat.length !== ui.chatCount) log.scrollTop = log.scrollHeight;
  const myName = nameOf(S.you);
  const fresh = S.room.chat.filter(m => m.from && m.from !== myName && m.at > (ui.lastChatAt || 0));
  if (ui.lastChatAt && fresh.length && isPhone() && ui.tab !== 'chat') toast(`${fresh[fresh.length - 1].from}: ${fresh[fresh.length - 1].text}`);
  ui.lastChatAt = Math.max(ui.lastChatAt || 1, ...S.room.chat.map(m => m.at));
  ui.chatCount = S.room.chat.length;
}

$('#playerList').onclick = e => {
  const b = e.target.closest('[data-kick]');
  if (b) socket.emit('kick', { playerId: b.dataset.kick });
};

/* ---------- Frame ---------- */
const renderers = {};
const handlers = {};

function render() {
  // keep anything the player is typing when someone else's move re-renders the page
  const typing = $('#stage input[id]');
  const keep = typing && { id: typing.id, value: typing.value, focused: document.activeElement === typing };
  $('#stage').innerHTML = S.game ? renderGame() : renderLobby();
  for (const f of afterRender) f();
  tickCountdowns();
  const again = keep && document.getElementById(keep.id);
  if (again) { again.value = keep.value; if (keep.focused) again.focus(); }
}

function renderGame() {
  const g = S.game;
  const info = S.room.games.find(x => x.id === g.gameId);
  const r = renderers[g.gameId]();
  const round = g.round && g.totalRounds ? `<span class="round">Round ${g.round} of ${g.totalRounds}</span>` : '';
  return `<div class="game">
    <div class="game-bar">
      <span class="title"><span class="thumb-mini">${thumb(g.gameId)}</span>${esc(info.name)}</span>${round}
      <span class="spacer"></span>
      ${isHost() ? `<button class="btn btn-sm btn-ghost" data-end aria-label="End game">${icon('flag')}<span class="lbl">End game</span></button>` : ''}
    </div>
    <div class="turn-bar ${r.tone || ''}">${r.tone === 'mine' ? '<span class="tag">Your turn</span>' : ''}<span>${r.turn}</span></div>
    <div class="game-body">${r.body}</div>
  </div>`;
}

function renderLobby() {
  const n = S.room.players.length;
  const g = S.room.games.find(x => x.id === S.room.gameId);
  const ok = n >= g.minPlayers && n <= g.maxPlayers;
  const rows = S.room.games.map(x => gameRow(x, { button: true, selected: x.id === S.room.gameId, disabled: !isHost() })).join('');
  return `<div class="game lobby">
    <div class="game-bar"><span class="title">Lobby</span><span class="spacer"></span><span class="round">${n} player${n === 1 ? '' : 's'} here</span></div>
    <div class="game-body">
      <h2>${isHost() ? 'Choose a game' : `Waiting for ${esc(nameOf(S.room.hostId))} to start`}</h2>
      <div class="share-box">
        <span class="muted">Room code</span><span class="code">${S.room.code}</span><span class="spacer" style="flex:1"></span>
        <button class="btn btn-sm" data-copy>${canShare ? `${icon('share')} Share invite` : `${icon('link')} Copy invite link`}</button>
      </div>
      <!-- selected game, its settings and the Play button sit above the list so phones don't scroll for them -->
      <div class="selected-game">
        <div class="sel-head"><span class="thumb">${thumb(g.id)}</span><div><small class="muted">Selected game</small><b>${esc(g.name)}</b></div></div>
        ${isHost() && g.options ? optionsHtml(g) : ''}
        ${isHost()
          ? `<div class="actions"><button class="btn btn-primary btn-lg" data-start ${ok ? '' : 'disabled'}>${icon('play')} Play ${esc(g.name)}</button></div>
             ${ok ? '' : `<p class="hint">${esc(g.name)} needs ${g.minPlayers === g.maxPlayers ? g.minPlayers : `${g.minPlayers}–${g.maxPlayers}`} players — ${n} in the room.</p>`}`
          : ''}
      </div>
      ${isHost() ? '<h3 class="hand-title">All games</h3>' : ''}
      <div class="catalog-list">${rows}</div>
    </div>
  </div>`;
}

function resultBanner(text) {
  return `<div class="result-banner">${icon('trophy', 'trophy')}<h3>${text}</h3></div>`;
}

function scoreboard(scores, opts = {}) {
  const ids = Object.keys(scores).sort((a, b) => (opts.lowestWins ? scores[a] - scores[b] : scores[b] - scores[a]));
  return `<table class="scoreboard">
    <tr><th></th><th>Player</th>${opts.extra ? `<th class="num">${opts.extra.title}</th>` : ''}<th class="num">Total</th></tr>
    ${ids.map((id, i) => `<tr class="${id === S.you ? 'me' : ''}">
      <td class="rank">${i + 1}</td>
      <td><span class="pcell">${avatarOf(id)}${esc(nameOf(id))}</span></td>
      ${opts.extra ? `<td class="num">${opts.extra.value(id)}</td>` : ''}
      <td class="num"><b>${scores[id]}</b></td></tr>`).join('')}
  </table>`;
}

const rematchBtn = () => (isHost() ? `<button class="btn btn-primary btn-lg" data-rematch>${icon('rotate')} Play again</button>` : '');
const tilt = i => `--tilt:${[-3, 2, -1.5, 3, -2.5, 1.5, -1, 2.5][i % 8]}deg`;

/* ---------- Click handling ---------- */
$('#stage').addEventListener('click', e => {
  const el = e.target.closest('button');
  if (!el || el.disabled) return;
  const d = el.dataset;
  if ('select' in d) socket.emit('selectGame', { gameId: d.select });
  else if ('start' in d) socket.emit('start', { options: ui_opts[S.room.gameId] || {} }, done);
  else if ('opt' in d) { const [gid, key] = d.opt.split(':'); ui_opts[gid] = { ...(ui_opts[gid] || {}), [key]: d.val }; render(); }
  else if ('copy' in d) copyInvite();
  else if ('end' in d) { if (confirm('End this game for everyone and go back to the lobby?')) socket.emit('endGame'); }
  else if ('rematch' in d) act({ type: 'rematch' });
  else if ('next' in d) act({ type: 'next' });
  else if (d.game && handlers[d.game]) handlers[d.game](d, el);
});

/* ======================= Housie ======================= */
// The host's browser drives auto-calling so the server stays simple.
let autoTimer = null;
function syncAutoCall() {
  const want = S && S.game && S.game.gameId === 'housie' && S.game.auto && S.game.phase === 'play' && isHost();
  if (want && !autoTimer) autoTimer = setInterval(() => act({ type: 'call' }), 5000);
  if (!want && autoTimer) { clearInterval(autoTimer); autoTimer = null; }
}

const BALL_COLORS = ['#d63c3c', '#e07b24', '#d6b11f', '#3e9b4f', '#2f86c9', '#3b4fb8', '#8a44b5', '#c23d8a', '#555'];
const ballColor = n => BALL_COLORS[Math.min(8, Math.floor((n === 90 ? 89 : n) / 10))];
const ball = (n, sm) => `<div class="ball ${sm ? 'sm' : ''} ${n ? '' : 'empty'}" style="--ball:${n ? ballColor(n) : '#bbb'}"><span>${n || '—'}</span></div>`;
const ticketNo = id => String([...id].reduce((h, c) => (h * 33 + c.charCodeAt(0)) % 997, 7)).padStart(3, '0');

function ticketHtml(ticket, called, opts = {}) {
  const cut = new Set(called);
  const cells = ticket.flatMap(row => row.map(n => {
    if (n == null) return '<div class="tcell blank"></div>';
    const daub = opts.interactive ? ui.marks.has(n) : cut.has(n);
    return opts.interactive
      ? `<button class="tcell ${daub ? 'daub' : ''}" data-game="housie" data-mark="${n}" aria-pressed="${daub}">${n}</button>`
      : `<div class="tcell ${daub ? 'daub' : ''}">${n}</div>`;
  })).join('');
  return `<div class="ticket ${opts.small ? 'small' : ''}">
    <div class="ticket-head"><span>TAMBOLA</span><span>No. ${ticketNo(opts.owner || S.you)}</span></div>
    <div class="ticket-grid">${cells}</div>
  </div>`;
}

renderers.housie = () => {
  const g = S.game;
  const calledSet = new Set(g.called);
  const board = `<div class="num-board" aria-label="Called numbers">${[...Array(90)].map((_, i) => `<span class="${calledSet.has(i + 1) ? 'on' : ''} ${g.lastCalled === i + 1 ? 'last' : ''}">${i + 1}</span>`).join('')}</div>`;
  const prizes = `<table class="prize-table">${g.prizes.map(p => `<tr><td><b>${esc(p.name)}</b></td><td>${p.winnerId
    ? `<span class="won-by">${icon('trophy')} ${esc(nameOf(p.winnerId))}</span>`
    : g.phase === 'play' ? `<button class="btn btn-sm btn-gold" data-game="housie" data-claim="${p.key}">Claim</button>` : '<span class="muted">—</span>'}</td></tr>`).join('')}</table>`;

  if (g.phase === 'over') {
    const full = g.prizes.find(p => p.key === 'full').winnerId;
    const tickets = g.players.filter(p => g.prizes.some(z => z.winnerId === p.id))
      .map(p => `<div><div class="who">${esc(p.name)}</div>${ticketHtml(p.ticket, g.called, { small: true, owner: p.id })}</div>`).join('');
    return {
      tone: 'win',
      turn: full ? `Full House — ${esc(nameOf(full))}!` : 'All 90 numbers called.',
      body: `${resultBanner(full === S.you ? 'You got Full House!' : 'Game over')}${prizes}<div class="boards">${tickets}</div><div class="actions">${rematchBtn()}</div>`,
    };
  }

  const recent = g.called.slice(-6, -1).reverse().map(n => ball(n, true)).join('');
  const host = isHost() ? `<div class="actions sticky-actions">
      <button class="btn btn-primary btn-lg" data-game="housie" data-call ${g.auto ? 'disabled' : ''}>Call next number</button>
      <button class="btn btn-lg" data-game="housie" data-auto="${g.auto ? 0 : 1}">${g.auto ? `${icon('pause')} Stop auto` : `${icon('play')} Auto every 5s`}</button>
    </div>` : '';
  return {
    tone: isHost() && !g.called.length ? 'mine' : '',
    turn: g.lastCalled ? `Number <b>${g.lastCalled}</b> called${g.auto ? ' · auto-calling' : ''}` : isHost() ? 'You are the caller — call the first number' : `Waiting for ${esc(nameOf(S.room.hostId))} to call the first number`,
    body: `<div class="housie-head">${ball(g.lastCalled)}<div><div class="recent">${recent}</div><div class="called-count">${g.called.length} called · ${g.remaining} left</div></div></div>
      ${host}
      ${ticketHtml(g.myTicket, g.called, { interactive: true })}
      <p class="hint">Tap a number on your ticket to daub it. Claim a prize when it's complete — a wrong claim is a Bogey.</p>
      ${prizes}
      <div class="log-line">${g.log.slice(-2).map(esc).join(' · ')}</div>
      ${board}`,
  };
};

handlers.housie = d => {
  if ('mark' in d) {
    const n = +d.mark;
    if (!S.game.called.includes(n) && !ui.marks.has(n)) return toast(`${n} hasn't been called yet`);
    ui.marks.has(n) ? ui.marks.delete(n) : ui.marks.add(n);
    render();
  } else if ('call' in d) act({ type: 'call' });
  else if ('auto' in d) act({ type: 'auto', on: d.auto === '1' });
  else if ('claim' in d) act({ type: 'claim', prize: d.claim });
};

/* ======================= Ashta Chamma ======================= */
const SEAT_COLORS = ['#d23b3b', '#2f6fd0', '#2f9e55', '#e0a81f'];
const tokenHtml = (color, attrs = '') => attrs
  ? `<button class="token" style="--c:${color}" ${attrs}></button>`
  : `<span class="token" style="--c:${color}"></span>`;

renderers.ashtachamma = () => {
  const g = S.game;
  const safe = new Set(g.safe);
  const homes = {};
  g.players.forEach(p => { homes[p.home.join(',')] = SEAT_COLORS[p.color]; });
  const myMoves = new Set(g.legal);

  const cells = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
    const here = [];
    g.players.forEach(p => p.pawns.forEach(pw => {
      if (!pw.cell || pw.cell[0] !== r || pw.cell[1] !== c) return;
      const col = SEAT_COLORS[p.color];
      here.push(p.id === S.you && myMoves.has(pw.i) ? tokenHtml(col, `data-game="ashtachamma" data-pawn="${pw.i}" aria-label="Move pawn"`) : tokenHtml(col));
    }));
    const key = `${r},${c}`;
    const cls = ['acell', safe.has(key) ? 'safe' : '', key === '2,2' ? 'centre' : '', key in homes ? 'home' : ''].join(' ');
    cells.push(`<div class="${cls}" ${key in homes ? `style="--seat:${homes[key]}"` : ''}>${here.join('')}</div>`);
  }

  const yards = g.players.map(p => {
    const col = SEAT_COLORS[p.color];
    const waiting = p.pawns.filter(pw => pw.pos === -1).map(pw => (p.id === S.you && myMoves.has(pw.i)
      ? tokenHtml(col, `data-game="ashtachamma" data-pawn="${pw.i}" aria-label="Bring pawn onto the board"`) : tokenHtml(col))).join('');
    return `<div class="yard ${p.id === g.turnId ? 'active' : ''}">
      <span class="token" style="--c:${col}"></span>
      <span class="name">${esc(p.name)}${p.id === S.you ? ' (you)' : ''}<small>${p.finished}/4 home · ${p.hasCut ? 'can enter inner ring' : 'needs a cut'}</small></span>
      <span class="tokens">${waiting}</span>
    </div>`;
  }).join('');

  const shells = (g.shells || [true, false, true, false]).map(up => `<span class="cowrie ${g.shells ? (up ? 'up' : 'down') : 'down'}"></span>`).join('');
  const rollName = g.roll === 8 ? 'Ashta — 8' : g.roll === 4 ? 'Chamma — 4' : g.roll ? `${g.roll}` : '';
  const myTurn = g.turnId === S.you;

  let turn, tone = '';
  if (g.phase === 'over') { turn = g.winnerId === S.you ? 'You win!' : `${esc(nameOf(g.winnerId))} wins!`; tone = 'win'; }
  else if (!myTurn) turn = `${esc(nameOf(g.turnId))} is ${g.phase === 'roll' ? 'throwing' : 'moving'}`;
  else if (g.phase === 'roll') { turn = 'Throw the shells'; tone = 'mine'; }
  else { turn = `You threw ${rollName}. Choose a pawn to move.`; tone = 'mine'; }

  return {
    tone,
    turn,
    body: `<div class="ashta-wrap">
      <div class="ashta-board wood"><div class="ashta-grid">${cells.join('')}</div></div>
      <div class="ashta-side">
        <div class="throw-row">
          <div class="shell-tray table-top">${shells}</div>
          <div class="throw-result">${rollName || '&nbsp;'}</div>
          ${myTurn && g.phase === 'roll' ? '<button class="btn btn-primary btn-lg btn-block" data-game="ashtachamma" data-roll>Throw shells</button>' : ''}
        </div>
        ${g.phase === 'over' ? rematchBtn() : ''}
        <div class="yard-list">${yards}</div>
      </div>
    </div>
    <div class="log-line">${g.log.slice(-2).map(esc).join(' · ')}</div>
    <p class="hint">Shells up: 1–3 move that many · all 4 = Chamma (4) · none = Ashta (8). Pawns enter the board only on a 4 or 8. 4, 8 and cutting a pawn give another throw. Crossed squares are safe; cut a pawn before entering the inner ring.</p>`,
  };
};

handlers.ashtachamma = d => {
  if ('roll' in d) act({ type: 'roll' });
  else if ('pawn' in d) act({ type: 'move', pawn: +d.pawn });
};

/* ======================= Dadi ======================= */
function dadiXY(p) {
  const r = Math.floor(p / 8), k = p % 8, lo = r, hi = 6 - r;
  return [[lo, lo], [3, lo], [hi, lo], [hi, 3], [hi, hi], [3, hi], [lo, hi], [lo, 3]][k];
}

renderers.dadi = () => {
  const g = S.game;
  const myTurn = g.turnId === S.you;
  const meP = g.players[g.me];
  const placing = meP && meP.toPlace > 0;
  const flying = meP && !placing && meP.onBoard === 3;
  const unit = 52, pad = 28, size = unit * 6 + pad * 2;
  const xy = p => dadiXY(p).map(v => pad + v * unit);

  let targets = [];
  if (myTurn && !g.mustRemove && ui.dadiSel != null) {
    targets = flying ? g.board.map((x, i) => (x == null ? i : -1)).filter(i => i >= 0)
      : g.adjacency[ui.dadiSel].filter(q => g.board[q] == null);
  }

  let lines = '';
  for (let r = 0; r < 3; r++) {
    const a = pad + r * unit, b = size - pad - r * unit;
    lines += `<rect x="${a}" y="${a}" width="${b - a}" height="${b - a}"/>`;
  }
  const m = pad + 3 * unit;
  lines += `<line x1="${m}" y1="${pad}" x2="${m}" y2="${pad + 2 * unit}"/><line x1="${m}" y1="${size - pad}" x2="${m}" y2="${size - pad - 2 * unit}"/>`;
  lines += `<line x1="${pad}" y1="${m}" x2="${pad + 2 * unit}" y2="${m}"/><line x1="${size - pad}" y1="${m}" x2="${size - pad - 2 * unit}" y2="${m}"/>`;

  const points = g.board.map((owner, p) => {
    const [x, y] = xy(p);
    let clickable = false;
    if (myTurn && g.phase === 'play') {
      if (g.mustRemove) clickable = g.removable.includes(p);
      else if (placing) clickable = owner == null;
      else clickable = owner === g.me || targets.includes(p);
    }
    const isTarget = targets.includes(p);
    const piece = owner == null
      ? `<circle r="${isTarget ? 10 : 7}" class="hole ${isTarget ? 'target' : placing && clickable ? 'placeable' : ''}"/>`
      : `<circle r="19" fill="url(#marble${owner})" filter="url(#shadow)"/>`;
    const rings = (g.lastMove.includes(p) ? '<circle r="24" class="last-ring"/>' : '')
      + (ui.dadiSel === p ? '<circle r="23" class="sel-ring"/>' : '')
      + (g.mustRemove && clickable ? '<circle r="23" class="rm-ring"/>' : '');
    return `<g transform="translate(${x},${y})" ${clickable ? `class="clickable" data-point="${p}" role="button" aria-label="Point ${p + 1}"` : ''}><circle r="26" fill="transparent"/>${piece}${rings}</g>`;
  }).join('');

  const defs = `<defs>
    <radialGradient id="marble0" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#ebe5d9"/><stop offset="1" stop-color="#a39b8e"/></radialGradient>
    <radialGradient id="marble1" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#7a7570"/><stop offset=".5" stop-color="#2a2724"/><stop offset="1" stop-color="#0b0a09"/></radialGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="1.6" flood-opacity=".55"/></filter>
  </defs>`;

  let turn, tone = '';
  if (g.phase === 'over') {
    tone = 'win';
    turn = g.result === 'draw' ? `Draw — ${esc(g.drawReason)}` : g.winnerId === S.you ? 'You win!' : `${esc(nameOf(g.winnerId))} wins!`;
  } else if (!myTurn) turn = `${esc(nameOf(g.turnId))} is thinking…`;
  else {
    tone = 'mine';
    if (g.mustRemove) { turn = 'Mill! Remove one of your opponent\'s pieces'; tone = 'alert'; }
    else if (placing) turn = `Place a piece — ${meP.toPlace} left`;
    else if (ui.dadiSel == null) turn = flying ? 'Three pieces left — you can jump to any empty point' : 'Pick a piece to move';
    else turn = 'Move to a highlighted point';
  }

  const seats = g.players.map((p, i) => `<div class="seat ${p.id === g.turnId ? 'active' : ''}">
      <span class="marble-key ${i === 0 ? 'w' : 'b'}"></span>
      <span><b>${esc(p.name)}</b>${p.id === S.you ? ' (you)' : ''}<small>${p.toPlace ? `${p.toPlace} to place · ` : ''}${p.onBoard} on board</small></span>
    </div>`).join('');

  let drawUi = '';
  if (g.phase === 'play') {
    if (g.drawOfferBy && g.drawOfferBy !== S.you) {
      drawUi = `<div class="draw-offer">${esc(nameOf(g.drawOfferBy))} offers a draw
        <button class="btn btn-sm btn-primary" data-game="dadi" data-draw="acceptDraw">${icon('check')} Accept</button>
        <button class="btn btn-sm" data-game="dadi" data-draw="declineDraw">${icon('x')} Decline</button></div>`;
    } else if (g.drawOfferBy === S.you) {
      drawUi = '<p class="hint">Draw offered — waiting for your opponent.</p>';
    } else {
      drawUi = `<div class="actions"><button class="btn btn-sm btn-ghost" data-game="dadi" data-draw="offerDraw">${icon('equal')} Offer draw</button></div>`;
    }
  }
  const quietNote = g.phase === 'play' && g.quiet >= g.quietLimit - 20
    ? `<p class="hint">${g.quiet}/${g.quietLimit} moves without a capture — the game is drawn at ${g.quietLimit}.</p>` : '';

  return {
    tone,
    turn,
    body: `<div class="seat-strip">${seats}</div>
      <div class="dadi-board wood"><svg viewBox="0 0 ${size} ${size}">${defs}<g class="lines">${lines}</g>${points}</svg></div>
      ${drawUi}${quietNote}
      ${g.phase === 'over' ? `<div class="actions">${rematchBtn()}</div>` : ''}
      <p class="hint">Place all 9, then slide along the lines. Three in a row removes an opponent piece. Fewer than 3 pieces or no move = you lose.</p>`,
  };
};

handlers.dadi = d => {
  if ('draw' in d) act({ type: d.draw });
};

// SVG points aren't buttons, so Dadi gets its own click listener
$('#stage').addEventListener('click', e => {
  const el = e.target.closest('g.clickable');
  if (!el || !S.game || S.game.gameId !== 'dadi') return;
  const g = S.game, p = +el.dataset.point;
  if (g.mustRemove) return act({ type: 'remove', point: p });
  if (g.players[g.me].toPlace > 0) return act({ type: 'place', point: p });
  if (g.board[p] === g.me) { ui.dadiSel = ui.dadiSel === p ? null : p; return render(); }
  if (ui.dadiSel != null) { act({ type: 'move', from: ui.dadiSel, to: p }); ui.dadiSel = null; }
});

/* ======================= Show (chits) ======================= */
renderers.show = () => {
  const g = S.game;
  const n = g.players.length;
  const myIdx = g.players.findIndex(p => p.id === S.you);
  const nextName = esc(g.players[(myIdx + 1) % n].name);
  const placeOf = id => g.ranking.findIndex(r => r.id === id);
  const ord = k => ['1st', '2nd', '3rd'][k] || `${k + 1}th`;

  if (g.phase === 'words') {
    const pills = g.players.map(p => `<span class="pill ${p.wrote ? 'ok' : ''}">${p.wrote ? icon('check') : icon('pen')} ${esc(p.name)}</span>`).join('');
    if (!g.myWord) {
      return {
        tone: 'mine',
        turn: 'Write one word — it will go on 4 chits',
        body: `<form class="word-form" data-word-form>
            <input id="wordInput" maxlength="14" placeholder="e.g. Mango, Bahubali, Goa…" autocomplete="off" aria-label="Your word">
            <button class="btn btn-primary" type="submit">${icon('pen')} Write</button>
          </form>
          <p class="hint">Any name works — a film, a fruit, a place. Every player's word becomes 4 chits; all chits get mixed and dealt.</p>
          <div class="pass-status">${pills}</div>`,
      };
    }
    return {
      turn: 'Waiting for everyone to write their word',
      body: `<div class="table-top"><div class="chit-row"><div class="chit" style="${tilt(1)}"><span class="word">${esc(g.myWord)}</span></div></div></div>
        <div class="pass-status">${pills}</div>`,
    };
  }

  const raceList = (withPoints) => `<ol class="race-list">${g.ranking.map((r, k) => `<li>
      <span class="place">${ord(k)}</span>${avatarOf(r.id)}<b>${esc(nameOf(r.id))}</b>
      <span class="ms">${k === 0 ? 'SHOW!' : r.ms == null ? 'did not press' : `+${(r.ms / 1000).toFixed(2)}s`}${withPoints ? ` · <span class="plus">+${g.roundPoints[r.id]}</span>` : ''}</span></li>`).join('')}</ol>`;

  if (g.phase === 'roundOver' || g.phase === 'over') {
    const winner = g.ranking[0].id;
    const winnerWord = g.players.find(p => p.id === winner).hand[0].word;
    const best = Math.max(...Object.values(g.scores));
    const champs = Object.keys(g.scores).filter(id => g.scores[id] === best);
    return {
      tone: 'win',
      turn: `${esc(nameOf(winner))} called SHOW with four “${esc(winnerWord)}”`,
      body: `${g.phase === 'over' ? resultBanner(`${champs.map(nameOf).map(esc).join(' & ')} win${champs.length > 1 ? '' : 's'} with ${best}`) : ''}
        ${raceList(true)}
        ${scoreboard(g.scores, { extra: { title: 'This round', value: id => `<span class="plus">+${g.roundPoints[id]}</span>` } })}
        <div class="actions">${g.phase === 'over' ? rematchBtn() : `<button class="btn btn-primary btn-lg" data-next>Next round ${icon('arrow')}</button>`}</div>`,
    };
  }

  if (g.phase === 'race') {
    const mine = placeOf(S.you);
    const body = `${mine === -1
      ? '<div class="actions"><button class="btn btn-gold btn-xl big-show" data-game="show" data-show>SHOW!</button></div>'
      : `<p class="center"><b>You placed ${ord(mine)}</b></p>`}
      ${raceList(false)}
      ${isHost() ? '<div class="actions"><button class="btn btn-sm btn-ghost" data-game="show" data-force>End round now</button></div>' : ''}`;
    return {
      tone: mine === -1 ? 'alert' : '',
      turn: mine === -1 ? `${esc(nameOf(g.ranking[0].id))} called SHOW — hit it fast!` : 'Waiting for the others to press SHOW',
      body,
    };
  }

  // pass phase
  const hand = g.myHand.map((c, i) => `<button class="chit ${g.myPick === c.id ? 'picked' : ''}" style="${tilt(i)}" data-game="show" data-chit="${c.id}" aria-pressed="${g.myPick === c.id}">
      <span class="word">${esc(c.word)}</span></button>`).join('');
  const pills = g.players.map(p => `<span class="pill ${p.picked ? 'ok' : ''}">${p.picked ? icon('check') : icon('hand')} ${esc(p.name)}</span>`).join('');
  const words = [...new Set(g.players.map(p => p.word))].map(esc).join(' · ');
  // chits always move to the next player in joining order, and the last player passes to the first
  const order = [...g.players, g.players[0]].map(p => `<span class="${p.id === S.you ? 'me' : ''}">${esc(p.name)}</span>`).join(' → ');
  let turn, tone = 'mine';
  if (g.canShow) { turn = 'You have four of a kind — press SHOW!'; tone = 'alert'; }
  else if (g.myPick != null) { turn = 'Passing… waiting for everyone to choose'; tone = ''; }
  else turn = `Choose a chit to pass to ${nextName}`;
  return {
    tone,
    turn,
    body: `<div class="table-top"><div class="show-hand">${hand}</div></div>
      <div class="actions sticky-actions"><button class="btn btn-gold btn-xl big-show" data-game="show" data-show ${g.canShow ? '' : 'disabled'}>SHOW</button></div>
      <div class="pass-status">${pills}</div>
      <p class="pass-order">Passing order: ${order}</p>
      <p class="hint">Pass ${g.passes + 1} · chits in play: ${words}. All chits move at once when everyone has chosen. Tap your chosen chit again to change it.</p>`,
  };
};

handlers.show = (d, el) => {
  if ('write' in d) {
    const input = $('#wordInput');
    const word = input.value.trim();
    if (!word) return toast('Write a word first');
    act({ type: 'word', word });
  } else if ('chit' in d) {
    const id = +d.chit;
    act(S.game.myPick === id ? { type: 'unpick' } : { type: 'pick', chit: id });
  } else if ('show' in d) act({ type: 'show' });
  else if ('force' in d) act({ type: 'forceEnd' });
};
$('#stage').addEventListener('submit', e => {
  if (!e.target.matches('[data-word-form]')) return;
  e.preventDefault();
  handlers.show({ write: '' });
});

/* ======================= Bingo ======================= */
const LETTERS = ['B', 'I', 'N', 'G', 'O'];

function bingoGrid(board, called, opts = {}) {
  const cut = new Set(called);
  const last = called[called.length - 1];
  return `<div class="bingo-grid">${board.map((n, i) => {
    if (n == null) return `<button class="bcell empty" data-game="bingo" data-place="${i}" aria-label="Write next number here">+</button>`;
    const cls = ['bcell', cut.has(n) ? 'cut' : '', n === last && !opts.small ? 'last' : ''].join(' ');
    if (opts.clickable && !cut.has(n)) return `<button class="${cls}" data-game="bingo" data-call="${n}">${n}</button>`;
    if (opts.arranging) return `<button class="${cls}" data-game="bingo" data-unplace="${i}">${n}</button>`;
    return `<div class="${cls}">${n}</div>`;
  }).join('')}</div>`;
}
const bingoWord = lines => `<div class="bingo-word">${LETTERS.map((l, i) => `<span class="${i < lines ? 'done' : ''}">${l}</span>`).join('')}</div>`;

renderers.bingo = () => {
  const g = S.game;
  const me = g.players.find(p => p.id === S.you);

  if (g.phase === 'arrange') {
    if (g.myBoard) {
      const waiting = g.players.filter(p => !p.ready).map(p => esc(p.name)).join(', ');
      return {
        turn: `Board locked. Waiting for ${waiting}`,
        body: `<div class="notebook">${bingoWord(0)}${bingoGrid(g.myBoard, [])}</div>
          <div class="actions"><button class="btn" data-game="bingo" data-unready>${icon('pen')} Change my board</button></div>`,
      };
    }
    const next = ui.arrange.filter(x => x != null).length + 1;
    const full = next > 25;
    return {
      tone: 'mine',
      turn: full ? 'Board complete — lock it in' : `Write your numbers: tap a box to write <b>${next}</b>`,
      body: `<div class="notebook">${bingoWord(0)}${bingoGrid(ui.arrange, [], { arranging: true })}</div>
        <div class="actions">
          <button class="btn" data-game="bingo" data-random>${icon('shuffle')} Fill randomly</button>
          <button class="btn" data-game="bingo" data-clear>${icon('eraser')} Clear</button>
          <button class="btn btn-primary" data-game="bingo" data-ready ${full ? '' : 'disabled'}>${icon('lock')} Lock board</button>
        </div>
        <p class="hint">Tap a written number to rub it out.</p>`,
    };
  }

  const tally = `<table class="scoreboard"><tr><th></th><th>Player</th><th class="num">Lines</th></tr>${g.players.map((p, i) => `<tr class="${p.id === S.you ? 'me' : ''}">
      <td class="rank">${i + 1}</td><td><span class="pcell">${avatar(p.name)}${esc(p.name)}</span></td>
      <td class="num"><span class="lines-tally">${LETTERS.slice(0, p.lines).join('') || '–'}</span> ${p.lines}/5</td></tr>`).join('')}</table>`;

  if (g.phase === 'over') {
    const won = g.winners.includes(S.you);
    return {
      tone: 'win',
      turn: won ? 'BINGO — you win!' : `${g.winners.map(nameOf).map(esc).join(' & ')} shouted BINGO!`,
      body: `${resultBanner(won ? 'BINGO!' : `${g.winners.map(nameOf).map(esc).join(' & ')} won`)}
        <div class="boards">${g.players.map(p => `<div><div class="who">${esc(p.name)} · ${p.lines} lines</div><div class="notebook small">${bingoGrid(p.board, g.called, { small: true })}</div></div>`).join('')}</div>
        <div class="actions">${rematchBtn()}</div>`,
    };
  }

  const myTurn = g.turnId === S.you;
  return {
    tone: myTurn ? 'mine' : '',
    turn: myTurn ? 'Call a number — tap one on your board' : `${esc(nameOf(g.turnId))} is calling${g.lastCalled ? ` · last number <b>${g.lastCalled}</b>` : ''}`,
    body: `<div class="notebook">${bingoWord(me.lines)}${bingoGrid(g.myBoard, g.called, { clickable: myTurn })}</div>
      ${tally}
      <div class="called-row">${g.called.map(n => `<span>${n}</span>`).join('')}</div>`,
  };
};

handlers.bingo = d => {
  if ('place' in d) {
    const next = ui.arrange.filter(x => x != null).length + 1;
    if (next <= 25) ui.arrange[+d.place] = next;
    render();
  } else if ('unplace' in d) {
    // rub out a number and shift the higher ones down so numbering stays 1..n
    const removed = ui.arrange[+d.unplace];
    ui.arrange = ui.arrange.map(n => (n == null || n === removed ? null : n > removed ? n - 1 : n));
    render();
  } else if ('random' in d) {
    const nums = [...Array(25)].map((_, i) => i + 1);
    for (let i = nums.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [nums[i], nums[j]] = [nums[j], nums[i]]; }
    ui.arrange = nums;
    render();
  } else if ('clear' in d) {
    ui.arrange = Array(25).fill(null);
    render();
  } else if ('ready' in d) act({ type: 'ready', board: ui.arrange });
  else if ('unready' in d) { ui.arrange = S.game.myBoard.slice(); act({ type: 'unready' }); }
  else if ('call' in d) act({ type: 'call', number: +d.call });
};

/* ======================= Ramudu-Seetha ======================= */
renderers.ramsita = () => {
  const g = S.game;
  const legend = `<p class="legend">Chits: ${g.roles.map(r => `${esc(r.name)} ${r.points}`).join(' · ')}</p>`;

  if (g.phase === 'pick') {
    const picked = !!g.myRole;
    const chits = g.chits.map((c, i) => {
      const mine = c.takenBy === S.you;
      if (mine) return `<div class="chit mine" style="${tilt(i)}"><span class="word">${esc(c.role.name)}</span><span class="pts">${c.role.points}</span><span class="taker">You</span></div>`;
      return `<button class="chit folded ${c.taken ? 'taken' : ''}" style="${tilt(i)}" data-game="ramsita" data-pick="${i}" ${c.taken || picked ? 'disabled' : ''} aria-label="Pick chit ${i + 1}">
        ${c.taken ? `<span class="taker">${esc(nameOf(c.takenBy))}</span>` : ''}</button>`;
    }).join('');
    const waiting = g.players.filter(p => !p.picked).map(p => esc(p.name)).join(', ');
    return {
      tone: picked ? '' : 'mine',
      turn: picked ? `Waiting for ${waiting} to pick` : 'Pick a chit',
      body: `<div class="table-top"><div class="chit-row gap-bottom">${chits}</div></div>${legend}${scoreboard(g.scores)}`,
    };
  }

  if (g.phase === 'guess') {
    const iAmRam = g.ramId === S.you;
    const slip = `<div class="role-slip paper"><small>Your chit</small><div class="role">${esc(g.myRole.name)}</div><small>${g.myRole.points} points${g.myRole.key === 'seetha' ? ' — stay calm! If Ramudu guesses wrong, you take his 1000.' : ''}</small></div>`;
    if (iAmRam) {
      const suspects = g.players.filter(p => p.id !== S.you)
        .map(p => `<button class="btn btn-lg" data-game="ramsita" data-guess="${p.id}">${avatar(p.name)} ${esc(p.name)}</button>`).join('');
      return {
        tone: 'mine',
        turn: 'You are Ramudu — who is Seetha?',
        body: `${slip}<div class="suspects">${suspects}</div><p class="hint">Question everyone in the chat before you choose.</p>`,
      };
    }
    return {
      turn: `${esc(nameOf(g.ramId))} is Ramudu and is looking for Seetha`,
      body: `${slip}${legend}${scoreboard(g.scores)}`,
    };
  }

  const seetha = g.players.find(p => p.role && p.role.key === 'seetha');
  const turn = g.correct
    ? `${esc(nameOf(g.ramId))} found Seetha — it was ${esc(seetha.name)}`
    : `Wrong guess! ${esc(nameOf(g.ramId))} picked ${esc(nameOf(g.guessedId))}. Seetha was ${esc(seetha.name)} and takes 1000.`;
  const roleOfId = id => g.players.find(p => p.id === id).role;
  const chits = g.players.map((p, i) => `<div class="chit" style="${tilt(i)}"><span class="word">${esc(p.role.name)}</span><span class="pts">+${g.roundPoints[p.id]}</span><span class="taker">${esc(p.name)}</span></div>`).join('');
  const table = scoreboard(g.scores, { extra: { title: 'This round', value: id => `${esc(roleOfId(id).name)} <span class="plus">+${g.roundPoints[id]}</span>` } });

  if (g.phase === 'over') {
    const best = Math.max(...Object.values(g.scores));
    const winners = Object.keys(g.scores).filter(id => g.scores[id] === best);
    return {
      tone: 'win',
      turn,
      body: `${resultBanner(`${winners.map(nameOf).map(esc).join(' & ')} win${winners.length > 1 ? '' : 's'} with ${best}`)}${table}<div class="actions">${rematchBtn()}</div>`,
    };
  }
  return {
    tone: g.correct ? 'win' : 'alert',
    turn,
    body: `<div class="table-top"><div class="chit-row gap-bottom">${chits}</div></div>${table}
      <div class="actions"><button class="btn btn-primary btn-lg" data-next>Next round ${icon('arrow')}</button></div>`,
  };
};

handlers.ramsita = d => {
  if ('pick' in d) act({ type: 'pick', index: +d.pick });
  else if ('guess' in d) act({ type: 'guess', targetId: d.guess });
};

/* ======================= Least Count ======================= */
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const cRank = c => (c % 13) + 1;

function cardHtml(c, opts = {}) {
  if (c == null) return '<div class="playing-card back"></div>';
  const r = RANKS[c % 13], s = SUITS[Math.floor(c / 13)];
  const red = s === '♥' || s === '♦';
  const joker = S.game && cRank(c) === S.game.jokerRank && !opts.noJoker;
  const cls = `playing-card ${red ? 'red' : ''} ${joker ? 'joker' : ''} ${opts.sel ? 'sel' : ''}`;
  const inner = `<div>${r}${s}</div><div class="suit-big">${s}</div><div class="r2">${r}${s}</div>`;
  if (opts.button) return `<button class="${cls}" data-game="leastcount" ${opts.attrs || `data-card="${c}"`} ${opts.disabled ? 'disabled' : ''}>${inner}</button>`;
  return `<div class="${cls}">${inner}</div>`;
}

renderers.leastcount = () => {
  const g = S.game;
  const myTurn = g.turnId === S.you;
  const ended = g.phase === 'roundOver' || g.phase === 'over';

  const seats = g.players.filter(p => p.id !== S.you).map(p => `<div class="seat ${p.id === g.turnId && !ended ? 'active' : ''}">
      ${avatar(p.name)}<span><b>${esc(p.name)}</b><small>${p.cardCount} card${p.cardCount === 1 ? '' : 's'}</small></span></div>`).join('');

  if (ended) {
    const r = g.result;
    const caller = esc(nameOf(r.callerId));
    const turn = r.success
      ? `${caller} called SHOW with ${r.totals[r.callerId]} — lowest, scores 0`
      : `${caller} called SHOW with ${r.totals[r.callerId]} but wasn't lowest — +${g.penalty} penalty`;
    const hands = g.players.map(p => `<div class="slot"><div class="label">${esc(p.name)} · ${r.totals[p.id]}</div><div class="hand mini-hand" style="padding-top:0">${p.hand.map(c => cardHtml(c)).join('')}</div></div>`).join('');
    const table = scoreboard(g.scores, { lowestWins: true, extra: { title: 'This round', value: id => `+${r.points[id]}` } });
    if (g.phase === 'over') {
      const best = Math.min(...Object.values(g.scores));
      const winners = Object.keys(g.scores).filter(id => g.scores[id] === best);
      return {
        tone: 'win',
        turn,
        body: `<div class="felt"><div class="table-area">${hands}</div></div>${resultBanner(`${winners.map(nameOf).map(esc).join(' & ')} win${winners.length > 1 ? '' : 's'} with ${best}`)}${table}<div class="actions">${rematchBtn()}</div>`,
      };
    }
    return {
      tone: r.success ? 'win' : 'alert',
      turn,
      body: `<div class="felt"><div class="table-area">${hands}</div></div>${table}
        <div class="actions"><button class="btn btn-primary btn-lg" data-next>Next round ${icon('arrow')}</button></div>`,
    };
  }

  let turn;
  if (!myTurn) turn = `${esc(nameOf(g.turnId))} is playing`;
  else if (g.phase === 'throw') turn = 'Select card(s) to throw — or call SHOW';
  else turn = 'Pick a card: from the deck or the open card';

  const selectedRanks = [...ui.selected].map(cRank);
  const hand = g.myHand.map(c => {
    const blocked = !myTurn || g.phase !== 'throw' || (selectedRanks.length && !ui.selected.has(c) && cRank(c) !== selectedRanks[0]);
    return cardHtml(c, { button: true, sel: ui.selected.has(c), disabled: blocked });
  }).join('');

  const canDraw = myTurn && g.phase === 'draw';
  const deckSlot = canDraw ? '<button class="playing-card back" data-game="leastcount" data-draw="deck" aria-label="Pick from deck"></button>' : cardHtml(null);
  const openSlot = g.openCard == null ? '<div class="label">empty</div>' : cardHtml(g.openCard, { button: canDraw, attrs: 'data-draw="pile" aria-label="Pick the open card"' });

  return {
    tone: myTurn ? 'mine' : '',
    turn,
    body: `<div class="seat-strip">${seats}</div>
      <div class="felt">
        <div class="table-area">
          <div class="slot"><div class="label">Joker</div>${cardHtml(g.jokerCard, { noJoker: true })}</div>
          <div class="slot"><div class="label">Deck · ${g.deckCount}</div>${deckSlot}</div>
          <div class="slot"><div class="label">Open card</div>${openSlot}</div>
          ${g.pending ? `<div class="slot"><div class="label">${esc(nameOf(g.turnId))} threw</div><div class="hand mini-hand" style="padding-top:0">${g.pending.map(c => cardHtml(c)).join('')}</div></div>` : ''}
        </div>
        <div class="hand">${hand}</div>
        <div class="hand-total">Hand total <b>${g.myTotal}</b></div>
      </div>
      ${myTurn && g.phase === 'throw' ? `<div class="actions sticky-actions">
        <button class="btn btn-primary btn-lg" data-game="leastcount" data-throw ${ui.selected.size ? '' : 'disabled'}>Throw ${ui.selected.size || ''} card${ui.selected.size === 1 ? '' : 's'}</button>
        <button class="btn btn-gold btn-lg" data-game="leastcount" data-show>SHOW (${g.myTotal})</button>
      </div>` : ''}
      <div class="log-line">${g.log.slice(-3).map(esc).join(' · ')}</div>
      <p class="hint">A=1 · J=11 · Q=12 · K=13 · Joker rank counts 0. Lowest total after ${g.totalRounds} rounds wins.</p>`,
  };
};

handlers.leastcount = d => {
  if ('card' in d) {
    const c = +d.card;
    ui.selected.has(c) ? ui.selected.delete(c) : ui.selected.add(c);
    render();
  } else if ('throw' in d) {
    act({ type: 'throw', cards: [...ui.selected] });
    ui.selected.clear();
  } else if ('draw' in d) act({ type: 'draw', from: d.draw });
  else if ('show' in d) {
    if (confirm(`Call SHOW with ${S.game.myTotal}? If someone has equal or lower, you get +${S.game.penalty}.`)) act({ type: 'show' });
  }
};

/* ======================= Sequence & 13-Card Rummy ======================= */
const RSUITS = ['♠', '♥', '♦', '♣'];
const RRANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const KIND_LABEL = { pure: 'Pure sequence', sequence: 'Sequence', set: 'Set', invalid: '' };
ui.rsel = new Set();

function rcard(c, opts = {}) {
  if (!c) return '<div class="playing-card back"></div>';
  const g = S.game;
  if (c.r === 0) {
    const inner = '<div>★</div><div class="suit-big">JOKER</div><div class="r2">★</div>';
    return opts.button
      ? `<button class="playing-card printed-joker ${opts.sel ? 'sel' : ''}" data-game="rummy" data-rcard="${c.id}" ${opts.disabled ? 'disabled' : ''}>${inner}</button>`
      : `<div class="playing-card printed-joker">${inner}</div>`;
  }
  const s = RSUITS[c.s], r = RRANKS[c.r];
  const red = c.s === 1 || c.s === 2;
  const wild = g.wildCard && c.r === g.wildCard.r && !opts.noJoker;
  const cls = `playing-card ${red ? 'red' : ''} ${wild ? 'joker' : ''} ${opts.sel ? 'sel' : ''}`;
  const inner = `<div>${r}${s}</div><div class="suit-big">${s}</div><div class="r2">${r}${s}</div>`;
  if (opts.button) return `<button class="${cls}" ${opts.attrs || `data-game="rummy" data-rcard="${c.id}"`} ${opts.disabled ? 'disabled' : ''}>${inner}</button>`;
  return `<div class="${cls}">${inner}</div>`;
}

function rummyGroups(groups, opts = {}) {
  return `<div class="meld-row">${groups.map((grp, gi) => `<div class="meld ${grp.kind}">
      <div class="meld-cards">${grp.cards.map(c => rcard(c, opts.interactive ? { button: true, sel: ui.rsel.has(c.id) } : {})).join('')}</div>
      <div class="meld-label">
        ${grp.kind === 'invalid' ? `<span class="muted">${grp.cards.length} card${grp.cards.length === 1 ? '' : 's'}</span>` : `<span class="kind">${icon('check')} ${KIND_LABEL[grp.kind]}</span>`}
        ${opts.interactive && ui.rsel.size && !grp.cards.every(c => ui.rsel.has(c.id)) ? `<button class="btn btn-sm" data-game="rummy" data-addto="${gi}">Move here</button>` : ''}
        ${opts.interactive && opts.canReveal && grp.kind === 'pure' ? `<button class="btn btn-sm btn-gold" data-game="rummy" data-reveal="${gi}">Show → see joker</button>` : ''}
      </div>
    </div>`).join('')}</div>`;
}

function sendArrangement(groups) {
  act({ type: 'arrange', groups: groups.filter(g => g.length) });
}

renderers.rummy = () => {
  const g = S.game;
  const myTurn = g.turnId === S.you;
  const ended = g.phase !== 'play';
  const hand = g.myGroups.flatMap(x => x.cards);
  for (const id of [...ui.rsel]) if (!hand.some(c => c.id === id)) ui.rsel.delete(id);

  const seats = g.players.filter(p => p.id !== S.you).map(p => `<div class="seat ${p.id === g.turnId ? 'active' : ''}">
      ${avatar(p.name)}<span><b>${esc(p.name)}</b><small>${p.out ? (p.wrongShow ? 'wrong show' : 'dropped') : `${p.cardCount} cards`}${g.hiddenJoker && p.revealed ? ' · sees joker' : ''}</small></span></div>`).join('');

  if (ended) {
    const w = g.result.winnerId;
    const others = g.players.map(p => `<div class="end-hand">
        <div class="who">${avatar(p.name)} <b>${esc(p.name)}</b> <span class="${p.id === w ? 'plus' : 'minus'}">${p.id === w ? 'Declared · 0' : `+${g.roundPoints[p.id]}`}</span>${p.out ? ` <span class="muted">(${p.wrongShow ? 'wrong show' : 'dropped'})</span>` : ''}</div>
        ${rummyGroups(p.groups)}</div>`).join('');
    const table = scoreboard(g.scores, { lowestWins: true, extra: { title: 'This round', value: id => `+${g.roundPoints[id]}` } });
    const best = Math.min(...Object.values(g.scores));
    const champs = Object.keys(g.scores).filter(id => g.scores[id] === best);
    return {
      tone: 'win',
      turn: w ? `${esc(nameOf(w))} declared and wins the round` : 'Round over',
      body: `<div class="felt"><div class="table-area"><div class="slot"><div class="label">Joker</div>${rcard(g.wildCard, { noJoker: true })}</div></div></div>
        ${g.phase === 'over' ? resultBanner(`${champs.map(nameOf).map(esc).join(' & ')} win${champs.length > 1 ? '' : 's'} with ${best} points`) : ''}
        <div class="end-hands">${others}</div>
        ${table}
        <div class="actions">${g.phase === 'over' ? rematchBtn() : `<button class="btn btn-primary btn-lg" data-next>Next round ${icon('arrow')}</button>`}</div>`,
    };
  }

  let turn, tone = '';
  if (g.myOut) turn = 'You are out of this round — watch the others finish';
  else if (!myTurn) turn = `${esc(nameOf(g.turnId))} is playing`;
  else if (g.step === 'draw') { turn = 'Pick a card from the deck or the open pile'; tone = 'mine'; }
  else { turn = 'Throw a card — or select your last card and Declare'; tone = 'mine'; }

  const canDraw = myTurn && g.step === 'draw' && !g.myOut;
  const deck = canDraw ? '<button class="playing-card back" data-game="rummy" data-draw="deck" aria-label="Pick from deck"></button>' : rcard(null);
  const open = g.openCard ? rcard(g.openCard, canDraw ? { button: true, attrs: 'data-game="rummy" data-draw="pile" aria-label="Pick the open card"' } : {}) : '<div class="label">empty</div>';
  const joker = g.wildCard
    ? rcard(g.wildCard, { noJoker: true })
    : '<div class="playing-card back hidden-joker"><span>?</span></div>';

  const one = ui.rsel.size === 1;
  const canThrow = myTurn && g.step === 'discard' && !g.myOut;
  const canReveal = g.hiddenJoker && !g.myRevealed && !g.myOut;
  const tools = `<div class="actions sticky-actions">
      <button class="btn" data-game="rummy" data-sort>${icon('shuffle')} Sort</button>
      <button class="btn" data-game="rummy" data-group ${ui.rsel.size >= 2 ? '' : 'disabled'}>Group selected</button>
      ${canThrow ? `<button class="btn btn-primary" data-game="rummy" data-throw ${one ? '' : 'disabled'}>Throw</button>
        <button class="btn btn-gold" data-game="rummy" data-declare ${one ? '' : 'disabled'}>Declare</button>` : ''}
      ${canDraw ? `<button class="btn btn-ghost" data-game="rummy" data-drop>Drop</button>` : ''}
    </div>`;

  return {
    tone,
    turn,
    body: `<div class="seat-strip">${seats}</div>
      <div class="felt">
        <div class="table-area">
          <div class="slot"><div class="label">${g.wildCard ? 'Joker' : 'Joker (hidden)'}</div>${joker}</div>
          <div class="slot"><div class="label">Deck · ${g.deckCount}</div>${deck}</div>
          <div class="slot"><div class="label">Open card</div>${open}</div>
        </div>
      </div>
      <h3 class="hand-title">Your hand <span class="muted">· tap cards to select</span></h3>
      ${rummyGroups(g.myGroups, { interactive: true, canReveal })}
      ${tools}
      <div class="log-line">${g.log.slice(-2).map(esc).join(' · ')}</div>
      <p class="hint">${esc(g.rulesText)} ${g.hiddenJoker ? 'Show a pure sequence to see the joker. ' : ''}Drop before picking: 20 (first turn) or 40. Wrong declare: 80. Lowest total after ${g.totalRounds} rounds wins.</p>`,
  };
};
renderers.sequence = renderers.rummy;

handlers.rummy = d => {
  const g = S.game;
  const groups = g.myGroups.map(x => x.cards.map(c => c.id));
  const without = ids => groups.map(gr => gr.filter(id => !ids.includes(id)));
  if ('rcard' in d) {
    const id = +d.rcard;
    ui.rsel.has(id) ? ui.rsel.delete(id) : ui.rsel.add(id);
    render();
  } else if ('draw' in d) act({ type: 'draw', from: d.draw });
  else if ('group' in d) {
    const ids = groups.flat().filter(id => ui.rsel.has(id));
    ui.rsel.clear();
    sendArrangement([...without(ids), ids]);
  } else if ('addto' in d) {
    const ids = groups.flat().filter(id => ui.rsel.has(id));
    const next = without(ids);
    next[+d.addto].push(...ids);
    ui.rsel.clear();
    sendArrangement(next);
  } else if ('sort' in d) {
    // one group per suit, jokers on their own, each sorted by number
    const cards = g.myGroups.flatMap(x => x.cards);
    const bySuit = [[], [], [], [], []];
    for (const c of cards) bySuit[c.r === 0 ? 4 : c.s].push(c);
    ui.rsel.clear();
    sendArrangement(bySuit.map(arr => arr.sort((a, b) => a.r - b.r).map(c => c.id)));
  } else if ('reveal' in d) act({ type: 'reveal', group: +d.reveal });
  else if ('throw' in d) { act({ type: 'discard', card: [...ui.rsel][0] }); ui.rsel.clear(); }
  else if ('declare' in d) {
    if (confirm('Declare? The selected card is closed and your other 13 cards must all be in valid groups. A wrong declare costs 80 points.')) {
      act({ type: 'declare', card: [...ui.rsel][0] });
      ui.rsel.clear();
    }
  } else if ('drop' in d) {
    if (confirm('Drop out of this round?')) act({ type: 'drop' });
  }
};
handlers.sequence = handlers.rummy;

/* ======================= Dumb Charades (offline movie picker) ======================= */
const CH = {
  movies: null,
  mode: (() => { try { return localStorage.getItem('ch_mode') || 'easy'; } catch { return 'easy'; } })(),
  queue: [],
  current: null,
  shown: false,
  secs: 90,
  left: 90,
  timer: null,
  teams: [0, 0],
  team: 0,
};

async function loadMovies() {
  if (CH.movies) return CH.movies;
  CH.movies = await (await fetch('data/telugu-movies.json')).json();
  return CH.movies;
}

function chPool() {
  return CH.mode === 'easy' ? CH.movies.filter(m => m.e) : CH.movies;
}

function chNext() {
  if (!CH.queue.length) {
    const pool = chPool().slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    CH.queue = pool;
  }
  CH.current = CH.queue.pop();
  CH.shown = false;
}

function chBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach(t => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.2, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2);
    });
  } catch {}
}

function chStop() { clearInterval(CH.timer); CH.timer = null; }

function renderCharades() {
  const el = $('#charadesBody');
  if (!CH.movies) { el.innerHTML = '<p class="muted center">Loading movies…</p>'; return; }
  const pool = chPool();
  const m = CH.current;
  const mm = String(Math.floor(CH.left / 60)), ss = String(CH.left % 60).padStart(2, '0');
  el.innerHTML = `
    <div class="ch-toolbar">
      <div class="seg" role="group" aria-label="Movie list">
        <button class="${CH.mode === 'easy' ? 'on' : ''}" data-ch="mode-easy">Easy</button>
        <button class="${CH.mode === 'all' ? 'on' : ''}" data-ch="mode-all">All movies</button>
      </div>
      <span class="muted">${pool.length.toLocaleString()} Telugu movies</span>
    </div>

    <div class="clap ${CH.shown ? 'open' : ''}">
      <div class="clap-top"></div>
      <div class="clap-body">
        ${!m ? '<div class="clap-hint">Tap <b>New movie</b> to start</div>'
          : CH.shown ? `<div class="clap-title">${esc(m.t)}</div><div class="clap-year">${m.y}</div>`
          : '<div class="clap-hint">Only the actor should look.<br>Tap <b>Show</b> to see the movie.</div>'}
      </div>
    </div>

    <div class="actions">
      ${m ? `<button class="btn btn-lg" data-ch="toggle">${CH.shown ? 'Hide' : 'Show'}</button>` : ''}
      <button class="btn btn-primary btn-lg" data-ch="next">New movie</button>
    </div>

    <div class="ch-timer ${CH.left <= 10 && CH.timer ? 'low' : ''} ${CH.left === 0 ? 'done' : ''}">
      <div class="time">${mm}:${ss}</div>
      <div class="actions" style="margin-top:6px">
        <button class="btn" data-ch="${CH.timer ? 'pause' : 'start'}">${CH.timer ? `${icon('pause')} Pause` : `${icon('play')} Start`}</button>
        <button class="btn btn-ghost" data-ch="reset">${icon('rotate')} Reset</button>
        <div class="seg">${[60, 90, 120].map(s => `<button class="${CH.secs === s ? 'on' : ''}" data-ch="secs-${s}">${s}s</button>`).join('')}</div>
      </div>
    </div>

    <div class="ch-teams">
      ${[0, 1].map(t => `<div class="ch-team ${CH.team === t ? 'active' : ''}">
        <div class="tname">Team ${t ? 'B' : 'A'}${CH.team === t ? ' · acting' : ''}</div>
        <div class="tscore">${CH.teams[t]}</div>
        <div class="actions" style="margin-top:4px"><button class="btn btn-sm" data-ch="minus-${t}">−1</button><button class="btn btn-sm btn-primary" data-ch="plus-${t}">+1</button></div>
      </div>`).join('')}
    </div>
    <div class="actions">
      <button class="btn btn-primary btn-lg" data-ch="guessed">${icon('check')} Guessed it!</button>
      <button class="btn btn-lg" data-ch="switch">Next team ${icon('arrow')}</button>
    </div>
    <p class="hint">Movie names come from Wikipedia's year-by-year lists of Telugu films. Easy = films from 1995 onward that have their own Wikipedia page.</p>`;
}

$('#charades').addEventListener('click', e => {
  const b = e.target.closest('[data-ch]');
  if (!b) return;
  const a = b.dataset.ch;
  if (a.startsWith('mode-')) {
    CH.mode = a.slice(5);
    try { localStorage.setItem('ch_mode', CH.mode); } catch {}
    CH.queue = [];
    CH.current = null;
  } else if (a === 'next') { chNext(); }
  else if (a === 'toggle') CH.shown = !CH.shown;
  else if (a === 'start') {
    if (CH.left === 0) CH.left = CH.secs;
    CH.timer = setInterval(() => {
      CH.left = Math.max(0, CH.left - 1);
      if (CH.left === 0) { chStop(); chBeep(); }
      renderCharades();
    }, 1000);
  } else if (a === 'pause') chStop();
  else if (a === 'reset') { chStop(); CH.left = CH.secs; }
  else if (a.startsWith('secs-')) { chStop(); CH.secs = +a.slice(5); CH.left = CH.secs; }
  else if (a.startsWith('plus-')) CH.teams[+a.slice(5)]++;
  else if (a.startsWith('minus-')) CH.teams[+a.slice(6)] = Math.max(0, CH.teams[+a.slice(6)] - 1);
  else if (a === 'guessed') { CH.teams[CH.team]++; chStop(); CH.left = CH.secs; chNext(); }
  else if (a === 'switch') { CH.team = 1 - CH.team; chStop(); CH.left = CH.secs; chNext(); }
  renderCharades();
});

function showCharades() {
  $('#home').classList.add('hidden');
  $('#room').classList.add('hidden');
  $('#charades').classList.remove('hidden');
  document.title = 'Dumb Charades — GameHub';
  renderCharades();
  loadMovies().then(renderCharades).catch(() => { $('#charadesBody').innerHTML = '<p class="form-error center">Could not load the movie list.</p>'; });
}
$('#openCharades').onclick = () => { history.pushState(null, '', '?charades'); showCharades(); };
$('#charadesBack').onclick = () => { chStop(); history.pushState(null, '', '/'); $('#charades').classList.add('hidden'); showHome(); };
if (params.has('charades')) showCharades();

// Cache the app so Dumb Charades keeps working without internet after the first visit
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

/* ======================= Phones ======================= */
const isPhone = () => matchMedia('(max-width: 900px)').matches;
ui.tab = 'game';
ui.chatSeenAt = Date.now();

function renderTabs() {
  if (!S) return;
  const myName = nameOf(S.you);
  if (ui.tab === 'chat') ui.chatSeenAt = Date.now();
  const unread = S.room.chat.filter(m => m.from && m.from !== myName && m.at > ui.chatSeenAt).length;
  const label = { game: S.game ? 'Game' : 'Lobby', players: `Players · ${S.room.players.length}`, chat: 'Chat' };
  const ic = { game: 'dice', players: 'users', chat: 'chat' };
  for (const b of document.querySelectorAll('#tabbar [data-tab]')) {
    const t = b.dataset.tab;
    b.classList.toggle('on', t === ui.tab);
    b.setAttribute('aria-pressed', t === ui.tab);
    b.innerHTML = `${icon(ic[t])}<span>${label[t]}</span>${t === 'chat' && unread ? `<span class="badge">${unread > 9 ? '9+' : unread}</span>` : ''}`;
  }
  $('#room').dataset.tab = ui.tab;
}

$('#tabbar').addEventListener('click', e => {
  const b = e.target.closest('[data-tab]');
  if (!b) return;
  ui.tab = b.dataset.tab;
  renderTabs();
  window.scrollTo(0, 0);
  if (ui.tab === 'chat') { const log = $('#chatLog'); log.scrollTop = log.scrollHeight; }
});

// Keep the screen awake while a game or charades is on (phones dim fast otherwise)
let wakeLock = null;
async function syncWakeLock() {
  const want = document.visibilityState === 'visible' && ((S && S.game) || !$('#charades').classList.contains('hidden'));
  try {
    if (want && !wakeLock && navigator.wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!want && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch { wakeLock = null; }
}
document.addEventListener('visibilitychange', syncWakeLock);
$('#openCharades').addEventListener('click', syncWakeLock);

/* ======================= Game options & countdowns ======================= */
function optionsHtml(g) {
  const chosen = ui_opts[g.id] || {};
  return `<div class="options">${g.options.map(o => {
    const cur = String(chosen[o.key] ?? o.default);
    const custom = o.custom
      ? `<label class="opt-custom">${esc(o.custom.prefix || '')}<input type="number" inputmode="numeric" id="opt-${g.id}-${o.key}" data-optinput="${g.id}:${o.key}" min="${o.custom.min}" max="${o.custom.max}" step="${o.custom.step}" value="${esc(cur)}" aria-label="${esc(o.label)} (custom)">${esc(o.custom.suffix || '')}</label>`
      : '';
    return `<div class="opt"><span class="opt-label">${esc(o.label)}</span><div class="seg">${o.choices.map((c, i) => `<button class="${String(c) === cur ? 'on' : ''}" data-opt="${g.id}:${o.key}" data-val="${c}">${esc(o.labels ? o.labels[i] : `${c}${o.suffix || ''}`)}</button>`).join('')}</div>${custom}</div>`;
  }).join('')}</div>`;
}

const serverNow = () => Date.now() + (ui.skew || 0);
// Elements with data-deadline show seconds left; data-total turns them into a shrinking bar.
function tickCountdowns() {
  for (const el of document.querySelectorAll('[data-deadline]')) {
    const left = Math.max(0, +el.dataset.deadline - serverNow());
    if (el.dataset.total) el.style.width = `${Math.min(100, (left / +el.dataset.total) * 100)}%`;
    else el.textContent = Math.ceil(left / 1000);
    el.classList.toggle('low', left < 5000);
  }
}
setInterval(tickCountdowns, 200);

// typed option values (e.g. a custom purse); kept within the option's limits
$('#stage').addEventListener('change', e => {
  const el = e.target.closest('[data-optinput]');
  if (!el) return;
  const [gid, key] = el.dataset.optinput.split(':');
  const min = +el.min, max = +el.max, step = +el.step || 1;
  let v = Math.round((+el.value || min) / step) * step;
  v = Math.min(max, Math.max(min, v));
  ui_opts[gid] = { ...(ui_opts[gid] || {}), [key]: v };
  render();
});
