// Typing Arena: players vote for a typing game, then compete.
//   Car Race    - everyone types the same sentence; your car moves as you type.
//   Word Rain   - the same words fall for everyone; type them before they land. 5 lives.
//   Speed Duel  - one word at a time; the fastest typists score.
const { shuffle, findPlayer, cue } = require('./util');
const { sentences, words } = require('./data/typing-words');

const COUNTDOWN_MS = 3000;
const RACE_MS = 120000;
const RACE_LAST_CALL_MS = 30000; // once someone finishes, the rest get this long
const RAIN_MS = 60000;
const RAIN_LIVES = 5;
const DUEL_WORDS = 10;
const DUEL_WORD_MS = 9000;
const DUEL_GAP_MS = 1500;
const DUEL_POINTS = [100, 70, 50, 40];

const MODES = [
  { id: 'race', name: 'Car Race', tagline: 'Type the sentence. Your car drives.' },
  { id: 'rain', name: 'Word Rain', tagline: 'Zap falling words before they land.' },
  { id: 'duel', name: 'Speed Duel', tagline: 'Fastest fingers take the points.' },
];

const pick = (list, n) => shuffle(list).slice(0, n);

function rainSchedule() {
  const pool = pick(words, words.length);
  const out = [];
  let at = 600, i = 0;
  while (at < RAIN_MS - 4000) {
    const progress = at / RAIN_MS;
    out.push({
      w: pool[i++ % pool.length],
      at: Math.round(at),
      x: 4 + Math.floor(Math.random() * 68),        // left edge, % of the field
      fall: Math.round(7000 - progress * 3500),     // gets faster as time goes on
    });
    at += 1700 - progress * 1050;                   // and words come quicker
  }
  return out;
}

function reset(s) {
  s.phase = 'pick';
  s.mode = null;
  s.votes = {};
  s.results = null;
  s.timerAt = null;
  s.startedAt = null;
}

function begin(s, mode) {
  s.mode = mode;
  s.phase = 'countdown';
  s.timerAt = Date.now() + COUNTDOWN_MS;
  s.results = null;
  s.prog = {};
  s.finished = {};
  s.scores = {};
  s.rain = {};
  for (const p of s.players) {
    s.prog[p.id] = 0;
    s.scores[p.id] = 0;
    s.rain[p.id] = { score: 0, lives: RAIN_LIVES, done: false };
  }
  if (mode === 'race') s.text = pick(sentences, 1)[0];
  if (mode === 'rain') s.words = rainSchedule();
  if (mode === 'duel') {
    s.queue = pick(words, DUEL_WORDS);
    s.idx = 0;
    s.solvers = [];
    s.gap = false;
  }
  cue(s, 'reveal');
}

function finishGame(s) {
  let rows;
  if (s.mode === 'race') {
    const len = s.text.length;
    const elapsed = Math.max(1000, Date.now() - s.startedAt);
    rows = s.players.map(p => {
      const f = s.finished[p.id];
      const chars = f ? len : s.prog[p.id];
      const ms = f ? f.ms : elapsed;
      return {
        id: p.id,
        wpm: Math.round((chars / 5) / (ms / 60000)),
        acc: f ? f.acc : null,
        done: !!f,
        ms: f ? f.ms : null,
        place: f ? f.place : null,
        pct: Math.round((chars / len) * 100),
      };
    }).sort((a, b) => (a.done !== b.done ? (a.done ? -1 : 1) : a.done ? a.place - b.place : b.pct - a.pct));
  } else if (s.mode === 'rain') {
    rows = s.players.map(p => ({ id: p.id, score: s.rain[p.id].score, lives: s.rain[p.id].lives }))
      .sort((a, b) => b.score - a.score);
  } else {
    rows = s.players.map(p => ({ id: p.id, score: s.scores[p.id] })).sort((a, b) => b.score - a.score);
  }
  s.results = rows;
  s.phase = 'over';
  s.timerAt = null;
  cue(s, 'win');
}

function duelNext(s) {
  s.idx++;
  s.gap = false;
  s.solvers = [];
  if (s.idx >= s.queue.length) return finishGame(s);
  s.timerAt = Date.now() + DUEL_WORD_MS;
}

function duelGap(s) {
  s.gap = true;
  s.timerAt = Date.now() + DUEL_GAP_MS;
}

module.exports = {
  id: 'typing',
  name: 'Typing Arena',
  minPlayers: 1,
  maxPlayers: 8,

  setup(players) {
    const s = { players: players.map(p => ({ id: p.id, name: p.name })) };
    reset(s);
    return s;
  },

  onTimer(s) {
    if (s.phase === 'countdown') {
      s.phase = 'play';
      s.startedAt = Date.now();
      s.timerAt = s.startedAt + (s.mode === 'race' ? RACE_MS : s.mode === 'rain' ? RAIN_MS : DUEL_WORD_MS);
      cue(s, 'go');
    } else if (s.phase === 'play') {
      if (s.mode === 'duel') {
        if (s.gap) duelNext(s);
        else { duelGap(s); cue(s, 'tick'); }
      } else finishGame(s);
    }
  },

  // fast progress updates, relayed live to everyone else
  stream(s, playerId, d) {
    if (s.phase !== 'play' || !d) return null;
    if (d.t === 'p' && s.mode === 'race') {
      const n = Math.max(0, Math.min(s.text.length, Number(d.n) || 0));
      s.prog[playerId] = n;
      return { t: 'p', id: playerId, n };
    }
    if (d.t === 's' && s.mode === 'rain') {
      const r = s.rain[playerId];
      if (!r) return null;
      r.score = Math.max(0, Number(d.score) || 0);
      r.lives = Math.max(0, Math.min(RAIN_LIVES, Number(d.lives) || 0));
      return { t: 's', id: playerId, score: r.score, lives: r.lives };
    }
    return null;
  },

  action(s, playerId, a, { isHost }) {
    findPlayer(s, playerId);

    if (a.type === 'vote') {
      if (s.phase !== 'pick') throw new Error('The game already started');
      if (!MODES.some(m => m.id === a.mode)) throw new Error('Pick a typing game');
      s.votes[playerId] = a.mode;
      cue(s, 'tap');
      if (Object.keys(s.votes).length === s.players.length) this.action(s, playerId, { type: 'start' }, { isHost: true });
      return;
    }

    if (a.type === 'start') {
      if (s.phase !== 'pick') throw new Error('The game already started');
      if (!isHost) throw new Error('Only the host can start');
      const tally = {};
      for (const m of Object.values(s.votes)) tally[m] = (tally[m] || 0) + 1;
      const top = Math.max(0, ...Object.values(tally));
      if (!top) throw new Error('Vote for a typing game first');
      const best = Object.keys(tally).filter(m => tally[m] === top);
      begin(s, best[Math.floor(Math.random() * best.length)]);
      return;
    }

    if (a.type === 'finished') {
      if (s.phase !== 'play' || s.mode !== 'race') throw new Error('Not racing now');
      if (s.finished[playerId]) return;
      if (String(a.typed) !== s.text) throw new Error('Keep typing — the sentence is not finished');
      s.prog[playerId] = s.text.length;
      s.finished[playerId] = {
        ms: Date.now() - s.startedAt,
        acc: Math.max(0, Math.min(100, Math.round(Number(a.acc) || 0))),
        place: Object.keys(s.finished).length + 1,
      };
      cue(s, 'correct');
      if (Object.keys(s.finished).length === s.players.length) finishGame(s);
      else s.timerAt = Math.min(s.timerAt, Date.now() + RACE_LAST_CALL_MS);
      return;
    }

    if (a.type === 'rainOut') {
      if (s.phase !== 'play' || s.mode !== 'rain') return;
      const r = s.rain[playerId];
      r.done = true;
      r.lives = 0;
      r.score = Math.max(r.score, Number(a.score) || 0);
      if (s.players.every(p => s.rain[p.id].done)) finishGame(s);
      return;
    }

    if (a.type === 'duel') {
      if (s.phase !== 'play' || s.mode !== 'duel' || s.gap) return;
      if (s.solvers.includes(playerId)) return;
      if (String(a.text || '').trim().toLowerCase() !== s.queue[s.idx]) return { message: 'Not quite — check the spelling' };
      const pts = DUEL_POINTS[Math.min(s.solvers.length, DUEL_POINTS.length - 1)];
      s.solvers.push(playerId);
      s.scores[playerId] += pts;
      cue(s, 'correct');
      if (s.solvers.length === s.players.length) duelGap(s);
      return { message: `+${pts}` };
    }

    if (a.type === 'again') {
      if (s.phase !== 'over') throw new Error('Game not finished');
      if (!isHost) throw new Error('Only the host can start again');
      reset(s);
      return;
    }

    if (a.type === 'rematch') return this.action(s, playerId, { type: 'again' }, { isHost });

    throw new Error('Unknown action');
  },

  view(s) {
    const duelWord = s.mode === 'duel' && s.queue && s.idx < s.queue.length ? s.queue[s.idx] : null;
    return {
      phase: s.phase,
      modes: MODES,
      votes: s.votes,
      mode: s.mode,
      startedAt: s.startedAt,
      text: s.mode === 'race' ? s.text : null,
      prog: s.prog || {},
      finished: s.finished || {},
      words: s.mode === 'rain' ? s.words : null,
      rain: s.rain || {},
      rainMs: RAIN_MS,
      word: s.phase === 'play' ? duelWord : null,
      number: s.mode === 'duel' ? s.idx + 1 : undefined,
      of: s.mode === 'duel' ? DUEL_WORDS : undefined,
      solvers: s.solvers || [],
      gap: !!s.gap,
      duelMs: DUEL_WORD_MS,
      scores: s.scores || {},
      results: s.results,
      players: s.players,
    };
  },
};
