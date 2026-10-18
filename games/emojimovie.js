// Emoji Movie Guess: a Telugu movie shown as emojis. Type the name — faster = more points.
// A hint (first letter of each word) appears halfway through. Small typos are accepted.
const { shuffle, findPlayer, cue, matchGuess } = require('./util');
const CLUES = require('./data/emoji-movies');

const CLUE_MS = 35000;
const HINT_MS = 17000;
const REVEAL_MS = 4500;
const POINTS = [100, 80, 65, 55, 50];

function hintFor(answer, level) {
  // level 0: blanks only, level 1: first letter of each word
  return answer.split(' ').map(w => [...w].map((ch, i) => (/[a-z0-9]/i.test(ch) ? (level >= 1 && i === 0 ? ch : '_') : ch)).join(' ')).join('   ');
}

function nextClue(s) {
  s.idx++;
  if (s.idx >= s.queue.length) { s.phase = 'over'; s.timerAt = null; cue(s, 'win'); return; }
  s.phase = 'clue';
  s.hint = 0;
  s.solvers = [];
  s.feed = [];
  s.startedAt = Date.now();
  s.timerAt = s.startedAt + HINT_MS;
}

function revealClue(s) {
  s.phase = 'reveal';
  s.timerAt = Date.now() + REVEAL_MS;
  cue(s, 'reveal');
}

module.exports = {
  id: 'emojimovie',
  name: 'Emoji Movie Guess',
  blurb: 'Guess the Telugu movie from emojis. 🪰😡🔪 = ? Fastest correct answer gets the most points.',
  minPlayers: 2,
  maxPlayers: 8,
  options: [{ key: 'count', label: 'Movies', choices: [10, 15, 20], default: 10 }],

  setup(players, opts = {}) {
    const count = [10, 15, 20].includes(Number(opts.count)) ? Number(opts.count) : 10;
    const s = {
      players: players.map(p => ({ id: p.id, name: p.name })),
      scores: Object.fromEntries(players.map(p => [p.id, 0])),
      queue: shuffle(CLUES.map((_, i) => i)).slice(0, count),
      idx: -1,
      count,
    };
    nextClue(s);
    return s;
  },

  onTimer(s) {
    if (s.phase === 'clue' && s.hint === 0) {
      s.hint = 1;
      s.timerAt = s.startedAt + CLUE_MS;
      cue(s, 'tick');
    } else if (s.phase === 'clue') revealClue(s);
    else if (s.phase === 'reveal') nextClue(s);
  },

  action(s, playerId, a, { isHost }) {
    const me = findPlayer(s, playerId);

    if (a.type === 'guess') {
      if (s.phase !== 'clue') throw new Error('Wait for the next movie');
      if (s.solvers.includes(playerId)) throw new Error('You already got it!');
      const text = String(a.text || '').trim().slice(0, 60);
      if (!text) return;
      const clue = CLUES[s.queue[s.idx]];
      const m = matchGuess(text, clue.a);
      if (m === 'exact') {
        const pts = POINTS[Math.min(s.solvers.length, POINTS.length - 1)];
        s.solvers.push(playerId);
        s.scores[playerId] += pts;
        s.feed.push({ name: me.name, kind: 'correct', pts });
        cue(s, 'correct');
        if (s.solvers.length === s.players.length) revealClue(s);
        return { message: `Correct! +${pts}` };
      }
      s.feed.push({ name: me.name, kind: 'wrong', text });
      if (s.feed.length > 12) s.feed.shift();
      if (m === 'close') return { message: `“${text}” is close!` };
      return;
    }

    if (a.type === 'skip') {
      if (!isHost) throw new Error('Only the host can skip');
      if (s.phase === 'clue') revealClue(s);
      return;
    }

    if (a.type === 'rematch') {
      if (s.phase !== 'over') throw new Error('Game not finished');
      if (!isHost) throw new Error('Only the host can start a rematch');
      Object.assign(s, this.setup(s.players, { count: s.count }));
      return;
    }

    throw new Error('Unknown action');
  },

  view(s, playerId) {
    const clue = s.idx >= 0 && s.idx < s.queue.length ? CLUES[s.queue[s.idx]] : null;
    const solved = s.solvers && s.solvers.includes(playerId);
    const showAnswer = s.phase === 'reveal' || solved;
    return {
      phase: s.phase,
      number: s.idx + 1,
      of: s.queue.length,
      emoji: clue ? clue.e : null,
      endsAt: s.phase === 'clue' ? s.startedAt + CLUE_MS : s.timerAt,
      answer: clue && showAnswer ? clue.a[0] : null,
      year: clue && s.phase === 'reveal' ? clue.y : null,
      hint: clue && !showAnswer ? hintFor(clue.a[0], s.hint) : null,
      solved,
      solvers: s.solvers || [],
      feed: s.feed || [],
      scores: s.scores,
      players: s.players,
    };
  },
};
