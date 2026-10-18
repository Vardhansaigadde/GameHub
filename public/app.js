const socket = io();
const $ = sel => document.querySelector(sel);

// A secret token identifies you across refreshes so you keep your seat.
const token = localStorage.getItem('gh_token') || (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now());
localStorage.setItem('gh_token', token);

let S = null; // latest { room, game, you }
const ui = { arrange: Array(25).fill(null), selected: new Set(), lastGameKey: null, chatCount: 0 };

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nameOf = id => (S.room.players.find(p => p.id === id) || {}).name || '?';
const isHost = () => S && S.room.hostId === S.you;

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.add('hidden'), 2600);
}

const done = res => res && res.error && toast(res.error);
const act = payload => socket.emit('action', payload, done);

/* ---------- Home ---------- */
$('#nameInput').value = localStorage.getItem('gh_name') || '';
const params = new URLSearchParams(location.search);
if (params.get('room')) $('#codeInput').value = params.get('room').toUpperCase();

function getName() {
  const name = $('#nameInput').value.trim();
  if (!name) { $('#homeError').textContent = 'Enter your name first'; $('#nameInput').focus(); return null; }
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
  if (code.length !== 4) { $('#homeError').textContent = 'Room code has 4 letters'; return; }
  socket.emit('join', { code, name, token }, enterRoom);
};
$('#codeInput').addEventListener('keydown', e => e.key === 'Enter' && $('#joinBtn').click());

// Rejoin automatically after refresh / reconnect
socket.on('connect', () => {
  const code = localStorage.getItem('gh_room');
  if (code) socket.emit('join', { code, token }, res => { if (res.error) { localStorage.removeItem('gh_room'); showHome(); } });
});

function showHome() {
  S = null;
  $('#home').classList.remove('hidden');
  $('#room').classList.add('hidden');
  $('#roomBadge').classList.add('hidden');
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
  (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject())
    .then(() => toast('Invite link copied! Send it to your friends.'))
    .catch(() => prompt('Copy this link:', link));
}
$('#copyLink').onclick = copyInvite;
$('#roomBadge').onclick = copyInvite;

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
  $('#home').classList.add('hidden');
  $('#room').classList.remove('hidden');
  $('#roomBadge').classList.remove('hidden');
  $('#roomBadge').textContent = 'Room ' + S.room.code;

  // reset local UI bits when a new game / round starts
  const key = S.game ? `${S.game.gameId}:${S.game.round || ''}:${S.game.phase === 'arrange'}` : 'lobby';
  if (key !== ui.lastGameKey) { ui.arrange = Array(25).fill(null); ui.selected.clear(); ui.lastGameKey = key; }
  if (S.game && S.game.gameId === 'show') {
    for (const c of [...ui.selected]) if (!S.game.myHand.includes(c)) ui.selected.delete(c);
  }
  if (S.game && prevGame && S.game.turnId === S.you && prevGame.turnId !== S.you) document.title = '🔔 Your turn — GameHub';
  else if (!S.game || S.game.turnId !== S.you) document.title = 'GameHub';

  renderSide();
  render();
});

function renderSide() {
  $('#playerList').innerHTML = S.room.players.map(p => `
    <li class="${p.connected ? '' : 'off'}">
      <span class="dot"></span>
      <span>${esc(p.name)}</span>
      ${p.id === S.room.hostId ? '<span class="tag">HOST</span>' : ''}
      ${p.id === S.you ? '<span class="me">(you)</span>' : ''}
      ${isHost() && !S.room.inGame && p.id !== S.you ? `<button class="kick" data-kick="${p.id}">✕</button>` : ''}
    </li>`).join('');

  const log = $('#chatLog');
  const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
  log.innerHTML = S.room.chat.map(m => m.from
    ? `<div><b>${esc(m.from)}:</b> ${esc(m.text)}</div>`
    : `<div class="sys">${esc(m.text)}</div>`).join('');
  if (atBottom || S.room.chat.length !== ui.chatCount) log.scrollTop = log.scrollHeight;
  ui.chatCount = S.room.chat.length;
}

$('#playerList').onclick = e => {
  const id = e.target.dataset.kick;
  if (id) socket.emit('kick', { playerId: id });
};

function render() {
  const stage = $('#stage');
  if (!S.game) stage.innerHTML = renderLobby();
  else stage.innerHTML = `<div class="card">${gameHeader()}${renderers[S.game.gameId]()}</div>`;
}

const EMOJI = { bingo: '🔢', ramsita: '🏹', show: '🃏' };

function gameHeader() {
  const g = S.room.games.find(x => x.id === S.game.gameId);
  const round = S.game.round ? `<span class="pill">Round ${S.game.round} / ${S.game.totalRounds}</span>` : '';
  return `<div class="game-head">
    <h2>${EMOJI[g.id]} ${esc(g.name)} ${round}</h2>
    ${isHost() ? '<button data-end class="ghost">End game</button>' : ''}
  </div>`;
}

function renderLobby() {
  const n = S.room.players.length;
  const tiles = S.room.games.map(g => `
    <button class="game-tile ${g.id === S.room.gameId ? 'selected' : ''}" data-select="${g.id}" ${isHost() ? '' : 'disabled'}>
      <div class="emoji">${EMOJI[g.id] || '🎮'}</div>
      <h4>${esc(g.name)}</h4>
      <p>${esc(g.blurb)}</p>
      <div class="count">${g.minPlayers}-${g.maxPlayers} players</div>
    </button>`).join('');
  const g = S.room.games.find(x => x.id === S.room.gameId);
  const ok = n >= g.minPlayers && n <= g.maxPlayers;
  return `<div class="card lobby">
    <h2>Lobby</h2>
    <p class="subtle">Share code <b>${S.room.code}</b> or the invite link with friends. ${isHost() ? 'Pick a game and start!' : 'Waiting for the host to start…'}</p>
    <div class="game-grid">${tiles}</div>
    ${isHost()
      ? `<div class="actions"><button class="primary big" data-start ${ok ? '' : 'disabled'}>Start ${esc(g.name)}</button></div>
         ${ok ? '' : `<p class="subtle" style="text-align:center">${esc(g.name)} needs ${g.minPlayers}-${g.maxPlayers} players — you have ${n}.</p>`}`
      : `<p class="subtle" style="text-align:center">Host picked <b>${esc(g.name)}</b>.</p>`}
  </div>`;
}

/* ---------- Click handling (event delegation) ---------- */
$('#stage').addEventListener('click', e => {
  const el = e.target.closest('button');
  if (!el || el.disabled) return;
  const d = el.dataset;
  if ('select' in d) socket.emit('selectGame', { gameId: d.select });
  else if ('start' in d) socket.emit('start', null, done);
  else if ('end' in d) { if (confirm('End this game for everyone and go back to the lobby?')) socket.emit('endGame'); }
  else if ('rematch' in d) act({ type: 'rematch' });
  else if ('next' in d) act({ type: 'next' });
  else if (d.game && handlers[d.game]) handlers[d.game](d, el);
});

/* ---------- Bingo ---------- */
const LETTERS = ['B', 'I', 'N', 'G', 'O'];

function bingoGrid(board, called, opts = {}) {
  const cut = new Set(called);
  const last = called[called.length - 1];
  return `<div class="bingo-grid ${opts.small ? 'small' : ''}">${board.map((n, i) => {
    if (n == null) return `<button class="cell empty" data-game="bingo" data-place="${i}">tap</button>`;
    const cls = ['cell', cut.has(n) ? 'cut' : '', n === last ? 'last' : ''].join(' ');
    if (opts.clickable && !cut.has(n)) return `<button class="${cls}" data-game="bingo" data-call="${n}">${n}</button>`;
    if (opts.arranging) return `<button class="${cls}" data-game="bingo" data-unplace="${i}">${n}</button>`;
    return `<div class="${cls}">${n}</div>`;
  }).join('')}</div>`;
}

const lettersBar = lines => `<div class="bingo-letters">${LETTERS.map((l, i) => `<span class="${i < lines ? 'on' : ''}">${l}</span>`).join('')}</div>`;

const renderers = {};
const handlers = {};

renderers.bingo = () => {
  const g = S.game;
  const me = g.players.find(p => p.id === S.you);

  if (g.phase === 'arrange') {
    if (g.myBoard) {
      const waiting = g.players.filter(p => !p.ready).map(p => esc(p.name)).join(', ');
      return `<div class="status">Board locked ✅ Waiting for: ${waiting}</div>
        ${bingoGrid(g.myBoard, [])}
        <div class="actions"><button data-game="bingo" data-unready>Change my board</button></div>`;
    }
    const next = ui.arrange.filter(x => x != null).length + 1;
    const full = next > 25;
    return `<div class="status">${full ? 'Board ready! Lock it in.' : `Tap boxes to place your numbers — next: <b>${next}</b>`}</div>
      ${bingoGrid(ui.arrange, [], { arranging: true })}
      <div class="actions">
        <button data-game="bingo" data-random>🎲 Random fill</button>
        <button data-game="bingo" data-clear>Clear</button>
        <button class="primary" data-game="bingo" data-ready ${full ? '' : 'disabled'}>Lock board</button>
      </div>
      <p class="subtle" style="text-align:center">Tip: tap a placed number to remove it.</p>`;
  }

  const scoreRows = g.players.map(p => `<tr><td>${esc(p.name)}${p.id === S.you ? ' (you)' : ''}</td><td class="num"><b>${LETTERS.slice(0, p.lines).join('') || '–'}</b> (${p.lines}/5)</td></tr>`).join('');

  if (g.phase === 'over') {
    const names = g.winners.map(nameOf).map(esc).join(' & ');
    const won = g.winners.includes(S.you);
    return `<div class="confetti">${won ? '🎉🏆🎉' : '🎊'}</div>
      <div class="status ${won ? 'you' : ''}">${won ? 'BINGO! You win!' : `${names} won!`}</div>
      <div class="boards">${g.players.map(p => `<div class="b"><b>${esc(p.name)}</b> · ${p.lines} lines${bingoGrid(p.board, g.called, { small: true })}</div>`).join('')}</div>
      ${isHost() ? '<div class="actions"><button class="primary big" data-rematch>Play again</button></div>' : ''}`;
  }

  const myTurn = g.turnId === S.you;
  return `<div class="status ${myTurn ? 'you' : ''}">${myTurn ? 'Your turn — tap a number to call it!' : `${esc(nameOf(g.turnId))} is calling…`}
      ${g.lastCalled ? ` · Last called: <b>${g.lastCalled}</b>` : ''}</div>
    ${lettersBar(me.lines)}
    ${bingoGrid(g.myBoard, g.called, { clickable: myTurn })}
    <table class="score-table">${scoreRows}</table>
    <div class="called-list">${g.called.map(n => `<span>${n}</span>`).join('')}</div>`;
};

handlers.bingo = d => {
  if ('place' in d) {
    const next = ui.arrange.filter(x => x != null).length + 1;
    if (next <= 25) ui.arrange[+d.place] = next;
    render();
  } else if ('unplace' in d) {
    // remove the number and shift the higher ones down so numbering stays 1..n
    const removed = ui.arrange[+d.unplace];
    ui.arrange = ui.arrange.map(n => (n == null || n === removed ? null : n > removed ? n - 1 : n));
    render();
  } else if ('random' in d) {
    const nums = [...Array(25)].map((_, i) => i + 1).sort(() => Math.random() - 0.5);
    ui.arrange = nums;
    render();
  } else if ('clear' in d) {
    ui.arrange = Array(25).fill(null);
    render();
  } else if ('ready' in d) {
    act({ type: 'ready', board: ui.arrange });
  } else if ('unready' in d) {
    ui.arrange = S.game.myBoard.slice();
    act({ type: 'unready' });
  } else if ('call' in d) {
    act({ type: 'call', number: +d.call });
  }
};

/* ---------- Ramudu-Seetha ---------- */
function scoreTable(scores, extraCol, lowestWins) {
  const rows = S.room.players
    .filter(p => p.id in scores)
    .sort((a, b) => (lowestWins ? scores[a.id] - scores[b.id] : scores[b.id] - scores[a.id]));
  return `<table class="score-table">
    <tr><th>Player</th>${extraCol ? `<th class="num">${extraCol.title}</th>` : ''}<th class="num">Total</th></tr>
    ${rows.map(p => `<tr><td>${esc(p.name)}${p.id === S.you ? ' (you)' : ''}</td>
      ${extraCol ? `<td class="num">${extraCol.value(p.id)}</td>` : ''}
      <td class="num"><b>${scores[p.id]}</b></td></tr>`).join('')}
  </table>`;
}

renderers.ramsita = () => {
  const g = S.game;

  if (g.phase === 'pick') {
    const picked = !!g.myRole;
    const chits = g.chits.map((c, i) => {
      const mine = c.takenBy === S.you;
      return `<button class="chit ${c.taken ? 'taken' : ''} ${mine ? 'mine' : ''}" data-game="ramsita" data-pick="${i}" ${c.taken || picked ? 'disabled' : ''}>
        ${mine ? `<div>${esc(c.role.name)}</div><div class="pts">${c.role.points} pts</div>` : '<div>📜</div>'}
        ${c.taken ? `<div class="who">${esc(nameOf(c.takenBy))}</div>` : ''}
      </button>`;
    }).join('');
    const waiting = g.players.filter(p => !p.picked).map(p => esc(p.name)).join(', ');
    return `<div class="status ${picked ? '' : 'you'}">${picked ? `Waiting for: ${waiting}` : 'Pick a chit! 🤞'}</div>
      <div class="chits">${chits}</div>
      ${roleLegend(g)}
      ${scoreTable(g.scores)}`;
  }

  if (g.phase === 'guess') {
    const iAmRam = g.ramId === S.you;
    const top = `<div class="role-card">Your chit: <div class="big-role">${esc(g.myRole.name)}</div>${g.myRole.points} pts
      ${g.myRole.key === 'seetha' ? '<div class="subtle">Stay calm 🤫 If Ramudu guesses wrong, you steal 1000!</div>' : ''}</div>`;
    if (iAmRam) {
      const suspects = g.players.filter(p => p.id !== S.you)
        .map(p => `<button data-game="ramsita" data-guess="${p.id}">${esc(p.name)}</button>`).join('');
      return `${top}<div class="status you">🏹 You are Ramudu! Who is Seetha?</div><div class="suspects">${suspects}</div>
        <p class="subtle" style="text-align:center">Use the chat to question everyone first 😉</p>`;
    }
    return `${top}<div class="status">🏹 <b>${esc(nameOf(g.ramId))}</b> is Ramudu and is searching for Seetha…</div>
      ${roleLegend(g)}${scoreTable(g.scores)}`;
  }

  // reveal / over
  const seetha = g.players.find(p => p.role && p.role.key === 'seetha');
  const banner = g.correct
    ? `🎯 ${esc(nameOf(g.ramId))} found Seetha (${esc(seetha.name)})!`
    : `😈 Wrong! ${esc(nameOf(g.ramId))} picked ${esc(nameOf(g.guessedId))}. Seetha was ${esc(seetha.name)} — she steals 1000!`;
  const roleOfId = id => g.players.find(p => p.id === id).role;
  const table = scoreTable(g.scores, { title: 'Chit / this round', value: id => `${esc(roleOfId(id).name)} · +${g.roundPoints[id]}` });

  if (g.phase === 'over') {
    const best = Math.max(...Object.values(g.scores));
    const winners = Object.keys(g.scores).filter(id => g.scores[id] === best);
    return `<div class="status">${banner}</div>
      <div class="confetti">🏆</div>
      <div class="status ${winners.includes(S.you) ? 'you' : ''}">${winners.map(nameOf).map(esc).join(' & ')} win${winners.length > 1 ? '' : 's'} with ${best} points!</div>
      ${table}
      ${isHost() ? '<div class="actions"><button class="primary big" data-rematch>Play again</button></div>' : ''}`;
  }
  return `<div class="status">${banner}</div>${table}
    <div class="actions"><button class="primary big" data-next>Next round ▶</button></div>`;
};

function roleLegend(g) {
  return `<p class="subtle" style="text-align:center;font-size:.85rem">Chits: ${g.roles.map(r => `${esc(r.name)} (${r.points})`).join(' · ')}</p>`;
}

handlers.ramsita = d => {
  if ('pick' in d) act({ type: 'pick', index: +d.pick });
  else if ('guess' in d) act({ type: 'guess', targetId: d.guess });
};

/* ---------- Show ---------- */
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const cRank = c => (c % 13) + 1;

function cardHtml(c, opts = {}) {
  if (c == null) return `<div class="playing-card back"></div>`;
  const r = RANKS[c % 13], s = SUITS[Math.floor(c / 13)];
  const red = s === '♥' || s === '♦';
  const joker = S.game && cRank(c) === S.game.jokerRank && !opts.noJoker;
  const cls = `playing-card ${red ? 'red' : ''} ${joker ? 'joker' : ''} ${opts.sel ? 'sel' : ''}`;
  const inner = `<div>${r}${s}</div><div class="suit-big">${s}</div><div class="r2">${r}${s}</div>`;
  if (opts.button) return `<button class="${cls}" data-game="show" ${opts.attrs || `data-card="${c}"`} ${opts.disabled ? 'disabled' : ''}>${inner}</button>`;
  return `<div class="${cls}">${inner}</div>`;
}

renderers.show = () => {
  const g = S.game;
  const myTurn = g.turnId === S.you;
  const ended = g.phase === 'roundOver' || g.phase === 'over';

  const opponents = g.players.filter(p => p.id !== S.you).map(p => `
    <div class="opp ${p.id === g.turnId && !ended ? 'turn' : ''}">
      <div><b>${esc(p.name)}</b></div>
      <div>🃏 ${p.cardCount} card${p.cardCount === 1 ? '' : 's'}</div>
    </div>`).join('');

  if (ended) {
    const r = g.result;
    const callerName = esc(nameOf(r.callerId));
    const banner = r.success
      ? `✅ ${callerName} called SHOW with ${r.totals[r.callerId]} — lowest! Scores 0.`
      : `❌ ${callerName} called SHOW with ${r.totals[r.callerId]} but wasn't lowest! +${g.penalty} penalty.`;
    const hands = g.players.map(p => `<div class="opp"><b>${esc(p.name)}</b> · ${r.totals[p.id]} pts
      <div class="hand mini-hand">${p.hand.map(c => cardHtml(c)).join('')}</div></div>`).join('');
    const table = scoreTable(g.scores, { title: 'This round', value: id => `+${r.points[id]}` }, true);
    if (g.phase === 'over') {
      const best = Math.min(...Object.values(g.scores));
      const winners = Object.keys(g.scores).filter(id => g.scores[id] === best);
      return `<div class="status">${banner}</div><div class="opponents">${hands}</div>
        <div class="confetti">🏆</div>
        <div class="status ${winners.includes(S.you) ? 'you' : ''}">${winners.map(nameOf).map(esc).join(' & ')} win${winners.length > 1 ? '' : 's'} with the lowest score (${best})!</div>
        ${table}
        ${isHost() ? '<div class="actions"><button class="primary big" data-rematch>Play again</button></div>' : ''}`;
    }
    return `<div class="status">${banner}</div><div class="opponents">${hands}</div>${table}
      <div class="actions"><button class="primary big" data-next>Next round ▶</button></div>`;
  }

  let status;
  if (!myTurn) status = `${esc(nameOf(g.turnId))} is playing…`;
  else if (g.phase === 'throw') status = 'Your turn: select card(s) to throw — or call SHOW!';
  else status = 'Now pick a card: from the deck or the open card';

  const selectedRanks = [...ui.selected].map(cRank);
  const hand = g.myHand.map(c => {
    // once you select a card you can only add cards of the same rank
    const blocked = !myTurn || g.phase !== 'throw' || (selectedRanks.length && !ui.selected.has(c) && cRank(c) !== selectedRanks[0]);
    return cardHtml(c, { button: true, sel: ui.selected.has(c), disabled: blocked });
  }).join('');

  const canDraw = myTurn && g.phase === 'draw';
  const deckSlot = canDraw
    ? `<button class="playing-card back" data-game="show" data-draw="deck" title="Pick from deck"></button>`
    : cardHtml(null);
  const openSlot = g.openCard == null ? '<div class="subtle">empty</div>'
    : cardHtml(g.openCard, { button: canDraw, attrs: 'data-draw="pile" title="Pick this card"' });

  return `<div class="opponents">${opponents}</div>
    <div class="status ${myTurn ? 'you' : ''}">${status}</div>
    <div class="table-area">
      <div class="slot"><div class="label">Joker (counts 0)</div>${cardHtml(g.jokerCard, { noJoker: true })}</div>
      <div class="slot"><div class="label">Deck (${g.deckCount})</div>${deckSlot}</div>
      <div class="slot"><div class="label">Open card</div>${openSlot}</div>
      ${g.pending ? `<div class="slot"><div class="label">${esc(nameOf(g.turnId))} threw</div><div class="hand mini-hand" style="padding:0">${g.pending.map(c => cardHtml(c)).join('')}</div></div>` : ''}
    </div>
    <div class="hand">${hand}</div>
    <p style="text-align:center">Your hand total: <b>${g.myTotal}</b></p>
    ${myTurn && g.phase === 'throw' ? `<div class="actions">
      <button class="primary" data-game="show" data-throw ${ui.selected.size ? '' : 'disabled'}>Throw ${ui.selected.size || ''} card${ui.selected.size === 1 ? '' : 's'}</button>
      <button data-game="show" data-show style="border-color:var(--accent2)">📢 SHOW (${g.myTotal})</button>
    </div>` : ''}
    <div class="log">${g.log.slice(-3).map(esc).join(' · ')}</div>
    <p class="subtle" style="text-align:center;font-size:.8rem">A=1 · J=11 · Q=12 · K=13 · Joker rank = 0. Lowest total score after ${g.totalRounds} rounds wins.</p>`;
};

handlers.show = d => {
  if ('card' in d) {
    const c = +d.card;
    ui.selected.has(c) ? ui.selected.delete(c) : ui.selected.add(c);
    render();
  } else if ('throw' in d) {
    act({ type: 'throw', cards: [...ui.selected] });
    ui.selected.clear();
  } else if ('draw' in d) {
    act({ type: 'draw', from: d.draw });
  } else if ('show' in d) {
    if (confirm(`Call SHOW with ${S.game.myTotal}? If someone has equal or lower, you get +${S.game.penalty}.`)) act({ type: 'show' });
  }
};
