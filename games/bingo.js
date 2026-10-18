// Classic notebook Bingo: everyone writes 1-25 on a 5x5 grid, players take turns
// calling a number, everyone cuts it. Each full row/column/diagonal = one letter
// of B-I-N-G-O. First to 5 lines wins.
const { shuffle, findPlayer, cue } = require('./util');

const SIZE = 5;
const WIN_LINES = 5;

const LINES = [];
for (let i = 0; i < SIZE; i++) {
  LINES.push([...Array(SIZE)].map((_, j) => i * SIZE + j)); // row
  LINES.push([...Array(SIZE)].map((_, j) => j * SIZE + i)); // column
}
LINES.push([...Array(SIZE)].map((_, j) => j * SIZE + j));
LINES.push([...Array(SIZE)].map((_, j) => j * SIZE + (SIZE - 1 - j)));

function countLines(board, called) {
  const cut = new Set(called);
  return LINES.filter(line => line.every(i => cut.has(board[i]))).length;
}

function isValidBoard(board) {
  if (!Array.isArray(board) || board.length !== SIZE * SIZE) return false;
  const sorted = board.map(Number).sort((a, b) => a - b);
  return sorted.every((n, i) => n === i + 1);
}

module.exports = {
  id: 'bingo',
  name: 'Bingo',
  blurb: 'Fill your 5x5 grid with 1-25, take turns calling numbers. First to cut 5 lines shouts BINGO!',
  minPlayers: 2,
  maxPlayers: 8,

  setup(players) {
    return {
      phase: 'arrange', // arrange -> play -> over
      players: players.map(p => ({ id: p.id, name: p.name, board: null })),
      called: [],
      turn: 0,
      winners: [],
    };
  },

  action(s, playerId, a, { isHost }) {
    const me = findPlayer(s, playerId);

    if (a.type === 'ready') {
      if (s.phase !== 'arrange') throw new Error('Game already started');
      if (!isValidBoard(a.board)) throw new Error('Board must contain each number 1-25 exactly once');
      me.board = a.board.map(Number);
      if (s.players.every(p => p.board)) {
        s.phase = 'play';
        s.turn = Math.floor(Math.random() * s.players.length);
      }
      return;
    }

    if (a.type === 'unready') {
      if (s.phase !== 'arrange') throw new Error('Game already started');
      me.board = null;
      return;
    }

    if (a.type === 'call') {
      if (s.phase !== 'play') throw new Error('Not calling numbers now');
      if (s.players[s.turn].id !== playerId) throw new Error("It's not your turn");
      const n = Number(a.number);
      if (!(n >= 1 && n <= 25) || s.called.includes(n)) throw new Error('Pick a number that is not cut yet');
      s.called.push(n);
      s.winners = s.players.filter(p => countLines(p.board, s.called) >= WIN_LINES).map(p => p.id);
      cue(s, s.winners.length ? 'win' : 'call');
      if (s.winners.length) s.phase = 'over';
      else s.turn = (s.turn + 1) % s.players.length;
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
    const me = s.players.find(p => p.id === playerId);
    return {
      phase: s.phase,
      myBoard: me ? me.board : null,
      called: s.called,
      lastCalled: s.called[s.called.length - 1] || null,
      turnId: s.phase === 'play' ? s.players[s.turn].id : null,
      winners: s.winners,
      players: s.players.map(p => ({
        id: p.id,
        name: p.name,
        ready: !!p.board,
        lines: p.board ? countLines(p.board, s.called) : 0,
        // boards stay secret until the game ends
        board: s.phase === 'over' ? p.board : undefined,
      })),
    };
  },
};
