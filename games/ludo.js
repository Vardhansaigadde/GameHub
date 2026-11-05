// Ludo: 2-4 players, 4 tokens each on the classic 15x15 board.
//   A 6 brings a token out of the yard and gives another roll (three 6s in a row loses the turn).
//   Landing on an opponent sends them back to the yard and gives another roll.
//   Reaching home (exact roll) also gives another roll. First to bring all 4 home wins.
const { findPlayer, cue } = require('./util');

const TOKENS = 4;
const RING_END = 50;  // last square on the shared ring, relative to your start
const HOME = 56;      // the centre
const YARD = -1;

// The shared ring, clockwise from the red start square.
const RING = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 7], [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], [7, 14], [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9], [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], [14, 7], [14, 6],
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0], [7, 0], [6, 0],
];
const SAFE_RING = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const SEATS = { 2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3] };
const SEAT_NAMES = ['Red', 'Green', 'Yellow', 'Blue'];

const rotate = ([r, c], times) => {
  for (let i = 0; i < times; i++) [r, c] = [c, 14 - r];
  return [r, c];
};

// every square a seat walks: ring (0-50), home column (51-55), centre (56)
function pathFor(seat) {
  const base = [];
  for (let i = 0; i <= RING_END; i++) base.push(RING[i]);
  for (let c = 1; c <= 5; c++) base.push([7, c]);
  base.push([7, 6]);
  return base.map(cell => rotate(cell, seat));
}
const PATHS = [0, 1, 2, 3].map(pathFor);
const ringIndex = (seat, pos) => (pos + seat * 13) % 52;

function legal(s, pi, roll) {
  const out = [];
  s.players[pi].tokens.forEach((pos, i) => {
    if (pos === HOME) return;
    if (pos === YARD) { if (roll === 6) out.push(i); return; }
    if (pos + roll <= HOME) out.push(i);
  });
  return out;
}

function nextTurn(s) {
  s.turn = (s.turn + 1) % s.players.length;
  s.sixes = 0;
  s.phase = 'roll';
  s.roll = null;
}

module.exports = {
  id: 'ludo',
  name: 'Ludo',
  minPlayers: 2,
  maxPlayers: 4,

  setup(players) {
    const seats = SEATS[players.length];
    return {
      players: players.map((p, i) => ({ id: p.id, name: p.name, seat: seats[i], tokens: Array(TOKENS).fill(YARD) })),
      turn: 0,
      phase: 'roll', // roll -> move -> ... | over
      roll: null,
      sixes: 0,
      winnerId: null,
      log: [],
      rolls: 0,
    };
  },

  action(s, playerId, a, { isHost }) {
    findPlayer(s, playerId);
    const pi = s.players.findIndex(p => p.id === playerId);
    const me = s.players[pi];
    const log = t => { s.log.push(t); if (s.log.length > 5) s.log.shift(); };

    if (a.type === 'rematch') {
      if (s.phase !== 'over') throw new Error('Game not finished');
      if (!isHost) throw new Error('Only the host can start a rematch');
      Object.assign(s, this.setup(s.players));
      return;
    }

    if (a.type === 'skip') {
      if (!isHost) throw new Error('Only the host can skip a turn');
      if (s.phase === 'over') return;
      log(`${s.players[s.turn].name}'s turn was skipped`);
      nextTurn(s);
      return;
    }

    if (s.phase === 'over') throw new Error('Game over');
    if (s.turn !== pi) throw new Error("It's not your turn");

    if (a.type === 'roll') {
      if (s.phase !== 'roll') throw new Error('Move a token first');
      s.roll = a.force && a.force >= 1 && a.force <= 6 && a.test ? a.force : 1 + Math.floor(Math.random() * 6);
      s.lastRoll = s.roll; // stays on the dice after the turn moves on
      s.rolls++;
      cue(s, 'dice');
      if (s.roll === 6) {
        s.sixes++;
        if (s.sixes === 3) {
          log(`${me.name} rolled three 6s — turn lost!`);
          nextTurn(s);
          return;
        }
      } else s.sixes = 0;
      if (!legal(s, pi, s.roll).length) {
        log(`${me.name} rolled ${s.roll} — no move`);
        const again = s.roll === 6;
        if (again) { s.phase = 'roll'; } else nextTurn(s);
        return;
      }
      log(`${me.name} rolled ${s.roll}`);
      s.phase = 'move';
      return;
    }

    if (a.type === 'move') {
      if (s.phase !== 'move') throw new Error('Roll the dice first');
      const i = Number(a.token);
      if (!legal(s, pi, s.roll).includes(i)) throw new Error("That token can't move");
      let extra = s.roll === 6;
      me.tokens[i] = me.tokens[i] === YARD ? 0 : me.tokens[i] + s.roll;
      const pos = me.tokens[i];
      cue(s, 'place');

      if (pos === HOME) {
        log(`${me.name} brought a token home!`);
        cue(s, 'correct');
        extra = true;
        if (me.tokens.every(t => t === HOME)) {
          s.phase = 'over';
          s.winnerId = me.id;
          cue(s, 'win');
          return;
        }
      } else if (pos <= RING_END) {
        const idx = ringIndex(me.seat, pos);
        if (!SAFE_RING.has(idx)) {
          for (const other of s.players) {
            if (other === me) continue;
            other.tokens.forEach((t, k) => {
              if (t >= 0 && t <= RING_END && ringIndex(other.seat, t) === idx) {
                other.tokens[k] = YARD;
                extra = true;
                cue(s, 'cut');
                log(`${me.name} sent ${other.name}'s token back!`);
              }
            });
          }
        }
      }
      if (extra) { s.phase = 'roll'; s.roll = null; } else nextTurn(s);
      return;
    }

    throw new Error('Unknown action');
  },

  view(s, playerId) {
    const pi = s.players.findIndex(p => p.id === playerId);
    return {
      phase: s.phase,
      turnId: s.phase === 'over' ? null : s.players[s.turn].id,
      roll: s.roll,
      lastRoll: s.lastRoll || null,
      rolls: s.rolls,
      winnerId: s.winnerId,
      log: s.log,
      legal: s.phase === 'move' && s.turn === pi ? legal(s, pi, s.roll) : [],
      paths: PATHS,
      safe: [...SAFE_RING].map(i => RING[i]),
      players: s.players.map(p => ({
        id: p.id,
        name: p.name,
        seat: p.seat,
        colour: SEAT_NAMES[p.seat],
        tokens: p.tokens,
        home: p.tokens.filter(t => t === HOME).length,
      })),
    };
  },
};
module.exports.SAFE_RING = SAFE_RING;
module.exports.ringIndex = ringIndex;
module.exports.PATHS = PATHS;
