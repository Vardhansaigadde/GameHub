// Four in a Row: drop discs into a 7x6 frame. Four in a line wins.
const { findPlayer, cue } = require('./util');

const COLS = 7, ROWS = 6;

function findWin(b, r, c) {
  const who = b[r][c];
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const line = [[r, c]];
    for (const sign of [1, -1]) {
      let rr = r + dr * sign, cc = c + dc * sign;
      while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && b[rr][cc] === who) {
        line.push([rr, cc]);
        rr += dr * sign;
        cc += dc * sign;
      }
    }
    if (line.length >= 4) return line;
  }
  return null;
}

module.exports = {
  id: 'connect4',
  name: 'Four in a Row',
  minPlayers: 2,
  maxPlayers: 2,

  setup(players) {
    return {
      players: players.map(p => ({ id: p.id, name: p.name })),
      board: Array.from({ length: ROWS }, () => Array(COLS).fill(null)), // row 0 = top
      turn: 0,
      phase: 'play',
      last: null,
      moves: 0,
      winLine: null,
      winnerId: null,
    };
  },

  action(s, playerId, a, { isHost }) {
    findPlayer(s, playerId);
    const me = s.players.findIndex(p => p.id === playerId);

    if (a.type === 'rematch') {
      if (s.phase !== 'over') throw new Error('Game not finished');
      if (!isHost) throw new Error('Only the host can start a rematch');
      Object.assign(s, this.setup([s.players[1], s.players[0]])); // the other player starts
      return;
    }

    if (a.type === 'drop') {
      if (s.phase !== 'play') throw new Error('Game over');
      if (s.turn !== me) throw new Error("It's not your turn");
      const c = Number(a.col);
      if (!(c >= 0 && c < COLS)) throw new Error('Pick a column');
      let r = ROWS - 1;
      while (r >= 0 && s.board[r][c] !== null) r--;
      if (r < 0) throw new Error('That column is full');
      s.board[r][c] = me;
      s.last = [r, c];
      s.moves++;
      cue(s, 'place');
      const line = findWin(s.board, r, c);
      if (line) {
        s.winLine = line;
        s.winnerId = playerId;
        s.phase = 'over';
        cue(s, 'win');
      } else if (s.moves === ROWS * COLS) {
        s.phase = 'over';
      } else s.turn = 1 - s.turn;
      return;
    }

    throw new Error('Unknown action');
  },

  view(s, playerId) {
    return {
      phase: s.phase,
      board: s.board,
      me: s.players.findIndex(p => p.id === playerId),
      turnId: s.phase === 'over' ? null : s.players[s.turn].id,
      last: s.last,
      moves: s.moves,
      winLine: s.winLine,
      winnerId: s.winnerId,
      players: s.players,
    };
  },
};
