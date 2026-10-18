// Dadi (Nine Men's Morris): 2 players, 9 pieces each, 24 points on 3 nested squares.
//   1. Place: take turns putting your 9 pieces on empty points.
//   2. Move: slide a piece to a connected empty point. With only 3 pieces left you can jump anywhere.
//   Three in a line (a "mill") -> remove one opponent piece (not from a mill, unless all are in mills).
// You lose when you have fewer than 3 pieces or no legal move.
const { findPlayer } = require('./util');

const PIECES = 9;

// Point index = ring * 8 + k, ring 0 = outer. k goes clockwise from the top-left corner:
// 0 TL, 1 TM, 2 TR, 3 RM, 4 BR, 5 BM, 6 BL, 7 LM
const ADJ = Array.from({ length: 24 }, () => []);
const MILLS = [];
for (let r = 0; r < 3; r++) {
  for (let k = 0; k < 8; k++) {
    const p = r * 8 + k;
    ADJ[p].push(r * 8 + ((k + 1) % 8), r * 8 + ((k + 7) % 8));
    if (k % 2 === 1) {
      if (r > 0) ADJ[p].push(p - 8);
      if (r < 2) ADJ[p].push(p + 8);
    }
  }
  for (const k of [0, 2, 4, 6]) MILLS.push([r * 8 + k, r * 8 + k + 1, r * 8 + ((k + 2) % 8)]);
}
for (const k of [1, 3, 5, 7]) MILLS.push([k, 8 + k, 16 + k]);

const inMill = (board, p) => board[p] != null && MILLS.some(m => m.includes(p) && m.every(q => board[q] === board[p]));
const countOf = (board, c) => board.filter(x => x === c).length;

function canMove(s, c) {
  if (s.placed[c] < PIECES) return s.board.includes(null);
  const mine = s.board.map((x, i) => (x === c ? i : -1)).filter(i => i >= 0);
  if (mine.length === 3) return s.board.includes(null);
  return mine.some(p => ADJ[p].some(q => s.board[q] == null));
}

function removable(s, victim) {
  const theirs = s.board.map((x, i) => (x === victim ? i : -1)).filter(i => i >= 0);
  const free = theirs.filter(p => !inMill(s.board, p));
  return free.length ? free : theirs;
}

function endTurn(s) {
  s.turn = 1 - s.turn;
  const c = s.turn;
  const lost = (s.placed[c] === PIECES && countOf(s.board, c) < 3) || !canMove(s, c);
  if (lost) {
    s.phase = 'over';
    s.winner = 1 - c;
  }
}

module.exports = {
  id: 'dadi',
  name: 'Dadi',
  blurb: 'Nine Men\'s Morris. Place and slide your 9 pieces — make a line of 3 to knock out an opponent piece.',
  minPlayers: 2,
  maxPlayers: 2,

  setup(players) {
    return {
      players: players.map(p => ({ id: p.id, name: p.name })),
      board: Array(24).fill(null), // null | 0 | 1 (player index)
      placed: [0, 0],
      turn: 0,
      mustRemove: false,
      phase: 'play', // play | over
      winner: null,
      lastMove: [],
    };
  },

  action(s, playerId, a, { isHost }) {
    findPlayer(s, playerId);
    const me = s.players.findIndex(p => p.id === playerId);

    if (a.type === 'rematch') {
      if (s.phase !== 'over') throw new Error('Game not finished');
      if (!isHost) throw new Error('Only the host can start a rematch');
      // swap who goes first
      Object.assign(s, this.setup([s.players[1], s.players[0]]));
      return;
    }

    if (s.phase !== 'play' || s.turn !== me) throw new Error("It's not your turn");

    if (a.type === 'remove') {
      if (!s.mustRemove) throw new Error('No mill to remove with');
      const p = Number(a.point);
      if (!removable(s, 1 - me).includes(p)) throw new Error("You can't remove that piece");
      s.board[p] = null;
      s.mustRemove = false;
      s.lastMove = [p];
      endTurn(s);
      return;
    }
    if (s.mustRemove) throw new Error('You made a mill — remove an opponent piece first');

    let to;
    if (a.type === 'place') {
      if (s.placed[me] >= PIECES) throw new Error('All your pieces are placed — move them now');
      to = Number(a.point);
      if (!(to >= 0 && to < 24) || s.board[to] != null) throw new Error('Pick an empty point');
      s.board[to] = me;
      s.placed[me]++;
      s.lastMove = [to];
    } else if (a.type === 'move') {
      if (s.placed[me] < PIECES) throw new Error('Place all your pieces first');
      const from = Number(a.from);
      to = Number(a.to);
      if (s.board[from] !== me) throw new Error('Pick one of your pieces');
      if (!(to >= 0 && to < 24) || s.board[to] != null) throw new Error('Pick an empty point');
      const flying = countOf(s.board, me) === 3;
      if (!flying && !ADJ[from].includes(to)) throw new Error('You can only move along a line to the next point');
      s.board[from] = null;
      s.board[to] = me;
      s.lastMove = [from, to];
    } else {
      throw new Error('Unknown action');
    }

    if (inMill(s.board, to) && countOf(s.board, 1 - me) > 0) {
      s.mustRemove = true;
      return;
    }
    endTurn(s);
  },

  view(s, playerId) {
    const me = s.players.findIndex(p => p.id === playerId);
    const myTurn = s.phase === 'play' && s.turn === me;
    return {
      phase: s.phase,
      board: s.board,
      me,
      turnId: s.phase === 'play' ? s.players[s.turn].id : null,
      mustRemove: s.mustRemove,
      removable: myTurn && s.mustRemove ? removable(s, 1 - me) : [],
      adjacency: ADJ,
      lastMove: s.lastMove,
      winnerId: s.winner == null ? null : s.players[s.winner].id,
      players: s.players.map((p, i) => ({
        id: p.id,
        name: p.name,
        toPlace: PIECES - s.placed[i],
        onBoard: countOf(s.board, i),
      })),
    };
  },
};
