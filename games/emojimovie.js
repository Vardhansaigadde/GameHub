// Emoji Movie Guess: a Telugu movie shown as emojis. Type the name — faster = more points.
// As time runs down, hints appear one at a time in a random order: hero, heroine, director and
// release year. First letters come last. Answering sooner scores more. Small typos are accepted.
const { shuffle, findPlayer, cue, matchGuess } = require('./util');
const CLUES = require('./data/emoji-movies');

const CLUE_MS = 56000;
const FIRST_HINT_MS = 16000; // players get this long with only the emojis
const HINT_EVERY_MS = 8000;
const HINT_PENALTY = 10;  // points off for each hint already showing
const MIN_POINTS = 20;
const REVEAL_MS = 4500;
const POINTS = [100, 80, 65, 55, 50];

function maskFor(answer, firstLetters) {
  return answer.split(' ').map(w => [...w].map((ch, i) => {
    if (!/[a-z0-9]/i.test(ch)) return ch;
    return firstLetters && i === 0 ? ch : '_';
  }).join(' ')).join('   ');
}

// the same random order for everyone in the room, different for each movie
function hintsFor(clue) {
  const all = [
    { label: 'Hero', value: clue.hero },
    { label: 'Heroine', value: clue.heroine },
    { label: 'Director', value: clue.director },
    { label: 'Released', value: String(clue.y) },
  ];
  return shuffle(all.filter(h => h.value));
}

function nextClue(s) {
  s.idx++;
  if (s.idx >= s.queue.length) { s.phase = 'over'; s.timerAt = null; cue(s, 'win'); return; }
  s.phase = 'clue';
  s.hint = 0;
  s.hints = hintsFor(CLUES[s.queue[s.idx]]);
  s.solvers = [];
  s.feed = [];
  s.startedAt = Date.now();
  s.timerAt = s.startedAt + FIRST_HINT_MS;
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
    // one hint each time, and the first letters after all of them
    if (s.phase === 'clue' && s.hint <= s.hints.length) {
      s.hint++;
      s.timerAt = s.hint <= s.hints.length ? s.startedAt + FIRST_HINT_MS + s.hint * HINT_EVERY_MS : s.startedAt + CLUE_MS;
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
        const pts = Math.max(MIN_POINTS, POINTS[Math.min(s.solvers.length, POINTS.length - 1)] - s.hint * HINT_PENALTY);
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
      hints: !clue ? [] : s.phase === 'reveal' ? s.hints : s.hints.slice(0, s.hint),
      hint: clue && !showAnswer ? maskFor(clue.a[0], s.hint > s.hints.length) : null,
      totalMs: CLUE_MS,
      solved,
      solvers: s.solvers || [],
      feed: s.feed || [],
      scores: s.scores,
      players: s.players,
    };
  },
};
