// Story Chain: one story for the whole group.
//   A random player writes the first line, then the story passes round the circle and each player
//   adds the next line. Every line shows up for everyone straight away, so all can follow along.
//   Tap the laugh button on the funniest lines (not your own): each laugh scores.
const { shuffle, findPlayer, cue } = require('./util');
const OPENERS = require('./data/story-openers');

const LAP_CHOICES = [2, 3, 4, 5];
const TURN_MS = 45000;
const MAX_LEN = 140;
const LAUGH_POINTS = 50;

const writerOf = s => s.seats[s.turn % s.seats.length];

function startTurn(s) {
  s.endsAt = Date.now() + TURN_MS;
  s.totalMs = TURN_MS;
  s.timerAt = s.endsAt;
}

function addLine(s, line) {
  s.lines.push(line);
  s.turn++;
  if (s.turn >= s.totalTurns) {
    s.phase = 'over';
    s.endsAt = null;
    s.timerAt = null;
    cue(s, 'win');
    return;
  }
  startTurn(s);
  cue(s, 'paper');
}

// the writer is out of time or gone: a missing first line becomes one of the ready-made openings
function skipTurn(s) {
  const id = writerOf(s);
  if (!s.lines.length) addLine(s, { by: id, text: s.ideas[0], auto: true });
  else addLine(s, { by: id, text: '', skipped: true });
}

module.exports = {
  id: 'story',
  name: 'Story Chain',
  minPlayers: 2,
  maxPlayers: 8,
  options: [{ key: 'laps', label: 'Lines each', choices: LAP_CHOICES, default: 3 }],

  setup(players, opts = {}) {
    const laps = LAP_CHOICES.includes(Number(opts.laps)) ? Number(opts.laps) : 3;
    const seats = shuffle(players.map(p => p.id));
    const s = {
      players: players.map(p => ({ id: p.id, name: p.name })),
      scores: Object.fromEntries(players.map(p => [p.id, 0])),
      seats,
      laps,
      opts: { laps },
      lines: [],
      turn: 0,
      totalTurns: seats.length * laps,
      ideas: shuffle(OPENERS).slice(0, 3), // suggestions for whoever starts the story
      laughs: {}, // line index -> [playerIds]
      phase: 'write',
    };
    startTurn(s);
    return s;
  },

  onTimer(s) {
    if (s.phase === 'write') skipTurn(s);
  },

  absentBlock(s, absentIds) {
    if (s.phase !== 'write') return null;
    const id = writerOf(s);
    return absentIds.includes(id) ? id : null;
  },

  skipAbsent(s, id) {
    if (s.phase === 'write' && writerOf(s) === id) skipTurn(s);
  },

  action(s, playerId, a, { isHost }) {
    findPlayer(s, playerId);

    if (a.type === 'line') {
      if (s.phase !== 'write') throw new Error('The story is finished');
      if (writerOf(s) !== playerId) throw new Error("It's not your turn to write");
      const text = String(a.text || '').trim().replace(/\s+/g, ' ');
      if (text.length < 3) throw new Error('Write a little more');
      if (text.length > MAX_LEN) throw new Error(`Keep it under ${MAX_LEN} letters`);
      addLine(s, { by: playerId, text });
      return;
    }

    if (a.type === 'laugh') {
      const li = Number(a.line);
      const line = s.lines[li];
      if (!line || line.skipped || line.auto) throw new Error('Pick a line');
      if (line.by === playerId) throw new Error("You can't laugh at your own line");
      const list = s.laughs[li] || (s.laughs[li] = []);
      const i = list.indexOf(playerId);
      if (i >= 0) { list.splice(i, 1); s.scores[line.by] -= LAUGH_POINTS; } else { list.push(playerId); s.scores[line.by] += LAUGH_POINTS; }
      return;
    }

    if (a.type === 'rematch') {
      if (s.phase !== 'over') throw new Error('Game not finished');
      if (!isHost) throw new Error('Only the host can start a rematch');
      Object.assign(s, this.setup(s.players, s.opts));
      return;
    }

    throw new Error('Unknown action');
  },

  view(s, playerId) {
    const writing = s.phase === 'write';
    const writer = writing ? writerOf(s) : null;
    return {
      phase: s.phase,
      lines: s.lines.map((l, i) => ({ ...l, n: (s.laughs[i] || []).length, mine: (s.laughs[i] || []).includes(playerId) })),
      seats: s.seats,
      writerId: writer,
      nextId: writing && s.turn + 1 < s.totalTurns ? s.seats[(s.turn + 1) % s.seats.length] : null,
      turnNo: Math.min(s.turn + 1, s.totalTurns),
      totalTurns: s.totalTurns,
      lap: Math.min(Math.floor(s.turn / s.seats.length) + 1, s.laps),
      laps: s.laps,
      ideas: writing && writer === playerId && !s.lines.length ? s.ideas : null,
      endsAt: s.endsAt,
      totalMs: s.totalMs,
      scores: s.scores,
      players: s.players,
    };
  },
};
