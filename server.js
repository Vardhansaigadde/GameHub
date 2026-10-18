const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('socket.io');
const games = require('./games');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (req, res) => res.send('ok'));

const MAX_PLAYERS = 8;
const ROOM_IDLE_MS = 30 * 60 * 1000; // delete rooms nobody is connected to for 30 min

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
    chat: room.chat.slice(-50),
    games: Object.values(games).map(g => ({ id: g.id, name: g.name, minPlayers: g.minPlayers, maxPlayers: g.maxPlayers, blurb: g.blurb })),
  };
}

function broadcast(room) {
  const pub = publicRoom(room);
  for (const p of room.players) {
    if (!p.socketId) continue;
    let game = null;
    if (room.state) {
      game = games[room.gameId].view(room.state, p.id);
      game.gameId = room.gameId;
    }
    io.to(p.socketId).emit('state', { room: pub, game, you: p.id });
  }
}

function scheduleCleanup(room) {
  clearTimeout(room.cleanupTimer);
  if (room.players.some(p => p.socketId)) return;
  room.cleanupTimer = setTimeout(() => rooms.delete(room.code), ROOM_IDLE_MS);
}

function attach(socket, room, player) {
  // a player can only be in one room per socket
  const prev = sockets.get(socket.id);
  if (prev && (prev.code !== room.code || prev.token !== player.token)) detach(socket, true);
  player.socketId = socket.id;
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
  // in the lobby a leaving player is removed; mid-game they keep their seat so they can rejoin
  if (leaving && !room.state) {
    room.players = room.players.filter(p => p !== player);
  }
  if (room.players.length === 0) {
    rooms.delete(room.code);
    return;
  }
  if (room.hostId === player.id && !room.players.includes(player)) {
    room.hostId = room.players[0].id;
  }
  scheduleCleanup(room);
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
  if (room.chat.length > 100) room.chat.shift();
}

io.on('connection', socket => {
  const reply = (cb, data) => typeof cb === 'function' && cb(data);

  socket.on('create', ({ name, token } = {}, cb) => {
    if (!token) return reply(cb, { error: 'Missing token' });
    const code = makeCode();
    const player = { id: newId(), token, name: cleanName(name), socketId: null };
    const room = { code, hostId: player.id, gameId: 'bingo', players: [player], state: null, chat: [] };
    rooms.set(code, room);
    attach(socket, room, player);
    reply(cb, { code });
    broadcast(room);
  });

  socket.on('join', ({ code, name, token } = {}, cb) => {
    const room = rooms.get(String(code || '').toUpperCase().trim());
    if (!room) return reply(cb, { error: 'Room not found. Check the code.' });
    if (!token) return reply(cb, { error: 'Missing token' });
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
  });

  socket.on('leave', () => detach(socket, true));
  socket.on('disconnect', () => detach(socket, false));

  socket.on('selectGame', ({ gameId } = {}) => {
    const { room, player } = current(socket);
    if (!room || room.hostId !== player.id || room.state || !games[gameId]) return;
    room.gameId = gameId;
    broadcast(room);
  });

  socket.on('start', (_, cb) => {
    const { room, player } = current(socket);
    if (!room) return reply(cb, { error: 'Not in a room' });
    if (room.hostId !== player.id) return reply(cb, { error: 'Only the host can start' });
    const game = games[room.gameId];
    const n = room.players.length;
    if (n < game.minPlayers || n > game.maxPlayers) {
      return reply(cb, { error: `${game.name} needs ${game.minPlayers}-${game.maxPlayers} players (you have ${n}).` });
    }
    room.state = game.setup(room.players.map(p => ({ id: p.id, name: p.name })));
    addChat(room, null, `${player.name} started ${game.name}!`);
    reply(cb, {});
    broadcast(room);
  });

  socket.on('action', (action = {}, cb) => {
    const { room, player } = current(socket);
    if (!room || !room.state) return reply(cb, { error: 'No game running' });
    try {
      games[room.gameId].action(room.state, player.id, action, { isHost: room.hostId === player.id });
      reply(cb, {});
      broadcast(room);
    } catch (e) {
      reply(cb, { error: e.message });
    }
  });

  socket.on('endGame', () => {
    const { room, player } = current(socket);
    if (!room || room.hostId !== player.id || !room.state) return;
    room.state = null;
    // drop players who left during the game
    room.players = room.players.filter(p => p.socketId);
    addChat(room, null, 'Back to the lobby.');
    broadcast(room);
  });

  socket.on('kick', ({ playerId } = {}) => {
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

  socket.on('chat', ({ text } = {}) => {
    const { room, player } = current(socket);
    if (!room || !String(text || '').trim()) return;
    addChat(room, player.name, String(text).trim());
    broadcast(room);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`GameHub running on http://localhost:${PORT}`));
