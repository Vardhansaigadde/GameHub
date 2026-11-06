const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('socket.io');
const games = require('./games');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// extensions: lets /terms and /privacy work without .html
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.get('/health', (req, res) => res.send('ok'));

const HOWTO = require('./games/howto');
const GAME_LIST = Object.values(games).map(g => ({
  id: g.id, name: g.name, minPlayers: g.minPlayers, maxPlayers: g.maxPlayers, options: g.options || null,
  cat: (HOWTO.games[g.id] || {}).cat || 'party',
  tagline: (HOWTO.games[g.id] || {}).tagline || '',
  steps: (HOWTO.games[g.id] || {}).steps || [],
}));
app.get('/api/games', (req, res) => res.json({ categories: HOWTO.categories, games: GAME_LIST }));

const MAX_PLAYERS = 8;
const ROOM_IDLE_MS = 30 * 60 * 1000; // delete rooms nobody is connected to for 30 min
// a phone locking or a page refreshing is not leaving: players get this long to come back
const GONE_GRACE_MS = Number(process.env.GONE_GRACE_MS) || 15000;

// code -> room
const rooms = new Map();
// socket.id -> { code, token }
const sockets = new Map();

function makeCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code;
  do {
    code = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  } while (rooms.has(code));
  return code;
}

const newId = () => crypto.randomBytes(4).toString('hex');

function cleanName(name) {
  const n = String(name || '').trim().slice(0, 16);
  return n || 'Player';
}

function publicRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    gameId: room.gameId,
    inGame: !!room.state,
    players: room.players.map(p => ({ id: p.id, name: p.name, connected: !!p.socketId })),
  };
}

// Players the game may stop waiting for: gone for longer than the grace period.
const absentIds = room => room.players.filter(p => !p.socketId && p.goneAt && Date.now() - p.goneAt >= GONE_GRACE_MS).map(p => p.id);

// Once the host has skipped someone, their turns pass by themselves until they come back.
function runAutoSkips(room) {
  const game = room.state && games[room.gameId];
  if (!game || !game.absentBlock || !room.autoSkip.size) return;
  for (let i = 0; i < 40; i++) {
    const id = game.absentBlock(room.state, [...room.autoSkip]);
    if (!id) return;
    game.skipAbsent(room.state, id);
  }
}

function broadcast(room) {
  runAutoSkips(room);
  const pub = publicRoom(room);
  const logic = room.state && games[room.gameId];
  const waitingOn = logic && logic.absentBlock ? logic.absentBlock(room.state, absentIds(room)) : null;
  for (const p of room.players) {
    if (!p.socketId) continue;
    let game = null;
    if (room.state) {
      game = games[room.gameId].view(room.state, p.id);
      game.gameId = room.gameId;
      game.cue = room.state.cue || null; // sound cue: { n, type } — clients play it when n changes
      game.timerAt = room.state.timerAt || null;
      game.waitingOn = waitingOn;
    }
    // the game list never changes and chat changes rarely, so each is only sent when needed
    const sent = p.sent || (p.sent = {});
    const extra = {};
    if (!sent.games) { extra.games = GAME_LIST; sent.games = true; }
    if (sent.chat !== room.chatN) { extra.chat = room.chat.slice(-50); sent.chat = room.chatN; }
    io.to(p.socketId).emit('state', { room: { ...pub, ...extra }, game, you: p.id, now: Date.now() });
  }
  scheduleTimer(room);
}

// Games with a countdown set state.timerAt; when it passes, the server calls game.onTimer(state).
function scheduleTimer(room) {
  clearTimeout(room.tick);
  const game = room.state && games[room.gameId];
  if (!game || !game.onTimer || !room.state.timerAt) return;
  room.tick = setTimeout(() => {
    if (!room.state || !room.state.timerAt) return;
    if (Date.now() < room.state.timerAt) return scheduleTimer(room);
    room.state.timerAt = null;
    try {
      game.onTimer(room.state);
      broadcast(room);
    } catch (e) {
      console.error('Game timer failed', room.gameId, e);
    }
  }, Math.max(0, room.state.timerAt - Date.now()) + 20);
}

// Late joiners / refreshes get any streamed data the game keeps (e.g. the drawing so far)
function syncStream(room, player) {
  const game = room.state && games[room.gameId];
  if (game && game.streamSync && player.socketId) io.to(player.socketId).emit('stream', { sync: true, items: game.streamSync(room.state) });
}

function scheduleCleanup(room) {
  clearTimeout(room.cleanupTimer);
  if (room.players.some(p => p.socketId)) return;
  room.cleanupTimer = setTimeout(() => rooms.delete(room.code), ROOM_IDLE_MS);
}

function passHost(room) {
  const next = room.players.find(p => p.socketId);
  if (!next || next.id === room.hostId) return;
  room.hostId = next.id;
  addChat(room, null, `${next.name} is now the host.`);
}

// When the grace period ends: a host who has not come back hands over, and the game may stop waiting.
function scheduleGoneCheck(room) {
  clearTimeout(room.goneTimer);
  room.goneTimer = setTimeout(() => {
    try {
      if (rooms.get(room.code) !== room) return;
      const host = room.players.find(p => p.id === room.hostId);
      if (!host || !host.socketId) passHost(room);
      broadcast(room);
    } catch (e) {
      console.error('Absence check failed', e);
    }
  }, GONE_GRACE_MS + 50);
}

function attach(socket, room, player) {
  // a player can only be in one room per socket
  const prev = sockets.get(socket.id);
  if (prev && (prev.code !== room.code || prev.token !== player.token)) detach(socket, true);
  player.socketId = socket.id;
  player.goneAt = null;
  player.sent = null; // a fresh connection needs everything
  room.autoSkip.delete(player.id);
  sockets.set(socket.id, { code: room.code, token: player.token });
  clearTimeout(room.cleanupTimer);
}

function detach(socket, leaving) {
  const info = sockets.get(socket.id);
  sockets.delete(socket.id);
  if (!info) return;
  const room = rooms.get(info.code);
  if (!room) return;
  const player = room.players.find(p => p.token === info.token);
  if (!player || player.socketId !== socket.id) return;
  player.socketId = null;
  player.goneAt = Date.now();
  // in the lobby a leaving player is removed; mid-game they keep their seat so they can rejoin
  if (leaving && !room.state) {
    room.players = room.players.filter(p => p !== player);
  }
  if (room.players.length === 0) {
    rooms.delete(room.code);
    return;
  }
  if (room.hostId === player.id && (leaving || !room.players.includes(player))) passHost(room);
  scheduleCleanup(room);
  scheduleGoneCheck(room);
  broadcast(room);
}

function current(socket) {
  const info = sockets.get(socket.id);
  if (!info) return {};
  const room = rooms.get(info.code);
  if (!room) return {};
  const player = room.players.find(p => p.token === info.token);
  return { room, player };
}

function addChat(room, from, text) {
  room.chat.push({ from, text: String(text).slice(0, 300), at: Date.now() });
  room.chatN = (room.chatN || 0) + 1;
  if (room.chat.length > 100) room.chat.shift();
}

io.on('connection', socket => {
  const reply = (cb, data) => typeof cb === 'function' && cb(data);
  // nothing a visitor sends may take the server down for everyone else
  const on = (event, handler) => socket.on(event, (...args) => {
    try {
      handler(...args);
    } catch (e) {
      console.error(`Bad "${event}" message:`, e.message);
      reply(args[args.length - 1], { error: 'Something went wrong' });
    }
  });

  on('create', ({ name, token, gameId } = {}, cb) => {
    if (!token || typeof token !== 'string') return reply(cb, { error: 'Missing token' });
    const code = makeCode();
    const player = { id: newId(), token, name: cleanName(name), socketId: null };
    const room = { code, hostId: player.id, gameId: Object.hasOwn(games, String(gameId)) ? String(gameId) : 'housie', players: [player], state: null, chat: [], chatN: 0, autoSkip: new Set() };
    rooms.set(code, room);
    attach(socket, room, player);
    reply(cb, { code });
    broadcast(room);
  });

  on('join', ({ code, name, token } = {}, cb) => {
    const room = rooms.get(String(code || '').toUpperCase().trim());
    if (!room) return reply(cb, { error: 'Room not found. Check the code.' });
    if (!token || typeof token !== 'string') return reply(cb, { error: 'Missing token' });
    let player = room.players.find(p => p.token === token);
    if (player) {
      if (name) player.name = cleanName(name);
    } else {
      if (room.state) return reply(cb, { error: 'A game is in progress. Ask the host to end it, then join.' });
      if (room.players.length >= MAX_PLAYERS) return reply(cb, { error: 'Room is full.' });
      player = { id: newId(), token, name: cleanName(name), socketId: null };
      room.players.push(player);
    }
    attach(socket, room, player);
    reply(cb, { code: room.code });
    broadcast(room);
    syncStream(room, player);
  });

  on('leave', () => detach(socket, true));
  on('disconnect', () => detach(socket, false));

  on('selectGame', ({ gameId } = {}) => {
    const { room, player } = current(socket);
    if (!room || room.hostId !== player.id || room.state || !Object.hasOwn(games, String(gameId))) return;
    room.gameId = String(gameId);
    broadcast(room);
  });

  on('start', (opts, cb) => {
    const { room, player } = current(socket);
    if (!room) return reply(cb, { error: 'Not in a room' });
    if (room.hostId !== player.id) return reply(cb, { error: 'Only the host can start' });
    const game = games[room.gameId];
    const n = room.players.length;
    if (n < game.minPlayers || n > game.maxPlayers) {
      return reply(cb, { error: `${game.name} needs ${game.minPlayers}-${game.maxPlayers} players (you have ${n}).` });
    }
    room.state = game.setup(room.players.map(p => ({ id: p.id, name: p.name })), (opts && opts.options) || {});
    addChat(room, null, `${player.name} started ${game.name}!`);
    reply(cb, {});
    broadcast(room);
  });

  on('action', (action = {}, cb) => {
    const { room, player } = current(socket);
    if (!room || !room.state) return reply(cb, { error: 'No game running' });
    try {
      const result = games[room.gameId].action(room.state, player.id, action, { isHost: room.hostId === player.id });
      reply(cb, result || {});
      if (!(result && result.quiet)) broadcast(room);
    } catch (e) {
      reply(cb, { error: e.message });
    }
  });

  on('endGame', () => {
    const { room, player } = current(socket);
    if (!room || room.hostId !== player.id || !room.state) return;
    clearTimeout(room.tick);
    room.state = null;
    room.autoSkip.clear();
    // drop players who left during the game
    room.players = room.players.filter(p => p.socketId);
    addChat(room, null, 'Back to the lobby.');
    broadcast(room);
  });

  // the host stops waiting for a player who has gone
  on('skipAbsent', (_, cb) => {
    const { room, player } = current(socket);
    if (!room || !room.state) return reply(cb, { error: 'No game running' });
    if (room.hostId !== player.id) return reply(cb, { error: 'Only the host can do that' });
    const game = games[room.gameId];
    const id = game.absentBlock ? game.absentBlock(room.state, absentIds(room)) : null;
    if (!id) return reply(cb, { error: 'Nobody to skip right now' });
    room.autoSkip.add(id);
    const gone = room.players.find(p => p.id === id);
    addChat(room, null, `${gone ? gone.name : 'A player'} left, so their turns are skipped until they return.`);
    reply(cb, {});
    broadcast(room);
  });

  on('kick', ({ playerId } = {}) => {
    const { room, player } = current(socket);
    if (!room || room.hostId !== player.id || room.state || playerId === player.id) return;
    const target = room.players.find(p => p.id === playerId);
    if (!target) return;
    room.players = room.players.filter(p => p !== target);
    if (target.socketId) {
      sockets.delete(target.socketId);
      io.to(target.socketId).emit('kicked');
    }
    broadcast(room);
  });

  // Fast, high-volume game data (drawing strokes) — relayed to everyone else, not via full state
  on('stream', data => {
    const { room, player } = current(socket);
    const game = room && room.state && games[room.gameId];
    if (!game || !game.stream) return;
    let out;
    try { out = game.stream(room.state, player.id, data); } catch { return; }
    if (!out) return;
    for (const p of room.players) if (p.socketId && p !== player) io.to(p.socketId).emit('stream', out);
  });

  // Floating emoji reactions, rate-limited per socket
  const REACTIONS = ['😂', '🔥', '👏', '😮', '😡', '❤️', '🤣', '👀'];
  let lastReact = 0;
  on('react', ({ emoji } = {}) => {
    const { room, player } = current(socket);
    if (!room || !REACTIONS.includes(emoji) || Date.now() - lastReact < 350) return;
    lastReact = Date.now();
    for (const p of room.players) if (p.socketId) io.to(p.socketId).emit('react', { emoji, from: player.name, id: player.id });
  });

  on('chat', ({ text } = {}) => {
    const { room, player } = current(socket);
    if (!room || !String(text || '').trim()) return;
    addChat(room, player.name, String(text).trim());
    broadcast(room);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`GameHub running on http://localhost:${PORT}`));
