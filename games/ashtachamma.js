// Ashta Chamma: 5x5 board, 4 pawns each, 4 cowrie shells as dice.
//   Shells facing up: 1, 2, 3 -> move that many. 4 up -> 4 (Chamma), 0 up -> 8 (Ashta).
//   Chamma / Ashta, and cutting an opponent, give another throw.
// Pawns go around the outer ring anticlockwise, then the inner ring clockwise, then to the centre.
// You can enter the inner ring only after you have cut (captured) at least one opponent pawn.
// Home squares (middle of each side) and the centre are safe. First to bring all 4 pawns to the centre wins.
const { findPlayer } = require('./util');

const PAWNS = 4;
const OUTER_LEN = 16;
const FINISH = 24; // path index of the centre square

// Path for the player sitting at the bottom; other seats are rotations of it.
const BASE_PATH = [
  // outer ring, anticlockwise from bottom-middle
  [4, 2], [4, 3], [4, 4], [3, 4], [2, 4], [1, 4], [0, 4], [0, 3],
  [0, 2], [0, 1], [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [4, 1],
  // inner ring, clockwise
  [3, 1], [2, 1], [1, 1], [1, 2], [1, 3], [2, 3], [3, 3], [3, 2],
  // centre
  [2, 2],
];
const rotate = ([r, c], times) => {
  for (let i = 0; i < times; i++) [r, c] = [c, 4 - r];
  return [r, c];
};
const SAFE = new Set(['4,2', '2,4', '0,2', '2,0', '2,2']);
const SEATS = { 2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3] };

function cellOf(s, playerIdx, pos) {
  return rotate(BASE_PATH[pos], s.players[playerIdx].seat);
}

function legalPawns(s, pi, roll) {
  const p = s.players[pi];
  return p.pawns
    .map((pos, i) => ({ pos, i }))
    .filter(({ pos }) => {
      const to = pos + roll;
      if (pos === FINISH || to > FINISH) return false;
      if (to >= OUTER_LEN && !p.hasCut) return false;
      return true;
    })
    .map(({ i }) => i);
}

function nextTurn(s) {
  s.turn = (s.turn + 1) % s.players.length;
  s.phase = 'roll';
  s.roll = null;
}

module.exports = {
  id: 'ashtachamma',
  name: 'Ashta Chamma',
  blurb: 'The classic shell-throwing board game. Cut an opponent to enter the inner ring and race your 4 pawns home.',
  minPlayers: 2,
  maxPlayers: 4,

  setup(players) {
    const seats = SEATS[players.length];
    return {
      players: players.map((p, i) => ({ id: p.id, name: p.name, seat: seats[i], pawns: Array(PAWNS).fill(0), hasCut: false })),
      turn: 0,
      phase: 'roll', // roll -> move -> roll ... | over
      roll: null,
      shells: null,
      extra: false,
      winnerId: null,
      log: [],
    };
  },

  action(s, playerId, a, { isHost }) {
    findPlayer(s, playerId);
    const pi = s.players.findIndex(p => p.id === playerId);
    const me = s.players[pi];
    const log = text => { s.log.push(text); if (s.log.length > 6) s.log.shift(); };

    if (a.type === 'roll') {
      if (s.phase !== 'roll' || s.turn !== pi) throw new Error("It's not your turn to throw");
      s.shells = [0, 1, 2, 3].map(() => Math.random() < 0.5);
      const up = s.shells.filter(Boolean).length;
      s.roll = up === 0 ? 8 : up;
      s.extra = s.roll === 4 || s.roll === 8;
      const name = s.roll === 8 ? 'ASHTA (8)!' : s.roll === 4 ? 'CHAMMA (4)!' : String(s.roll);
      if (!legalPawns(s, pi, s.roll).length) {
        log(`${me.name} threw ${name} — no move`);
        if (s.extra) { s.phase = 'roll'; } else nextTurn(s);
        return;
      }
      log(`${me.name} threw ${name}`);
      s.phase = 'move';
      return;
    }

    if (a.type === 'move') {
      if (s.phase !== 'move' || s.turn !== pi) throw new Error("It's not your turn to move");
      const i = Number(a.pawn);
      if (!legalPawns(s, pi, s.roll).includes(i)) throw new Error("That pawn can't move");
      me.pawns[i] += s.roll;
      let extra = s.extra;

      if (me.pawns[i] === FINISH) {
        log(`🏠 ${me.name}'s pawn reached the centre!`);
        if (me.pawns.every(p => p === FINISH)) {
          s.phase = 'over';
          s.winnerId = me.id;
          return;
        }
        extra = true;
      } else {
        const [r, c] = cellOf(s, pi, me.pawns[i]);
        if (!SAFE.has(`${r},${c}`)) {
          for (const [oi, other] of s.players.entries()) {
            if (oi === pi) continue;
            other.pawns.forEach((pos, k) => {
              if (pos === 0 || pos === FINISH) return;
              const [or, oc] = cellOf(s, oi, pos);
              if (or === r && oc === c) {
                other.pawns[k] = 0;
                me.hasCut = true;
                extra = true;
                log(`⚔️ ${me.name} cut ${other.name}'s pawn!`);
              }
            });
          }
        }
      }
      if (extra) { s.phase = 'roll'; s.roll = null; } else nextTurn(s);
      return;
    }

    if (a.type === 'rematch') {
      if (s.phase !== 'over') throw new Error('Game not finished');
      if (!isHost) throw new Error('Only the host can start a rematch');
      Object.assign(s, this.setup(s.players));
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
      shells: s.shells,
      winnerId: s.winnerId,
      log: s.log,
      legal: s.phase === 'move' && s.turn === pi ? legalPawns(s, pi, s.roll) : [],
      safe: [...SAFE],
      players: s.players.map((p, idx) => ({
        id: p.id,
        name: p.name,
        color: p.seat,
        hasCut: p.hasCut,
        home: cellOf(s, idx, 0),
        finished: p.pawns.filter(x => x === FINISH).length,
        pawns: p.pawns.map((pos, i) => ({ i, pos, cell: cellOf(s, idx, pos) })),
      })),
    };
  },
};
