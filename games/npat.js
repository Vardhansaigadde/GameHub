// Name, Place, Animal, Thing: a letter is drawn and everyone races to fill all four.
//   The first to fill all four can press STOP; everyone else gets a few seconds more.
//   Then everyone checks the answers and can flag fakes. Unique answers score 10, shared ones 5.
const { shuffle, findPlayer, cue, normalize } = require('./util');

const CATS = ['name', 'place', 'animal', 'thing'];
const LETTERS = 'ABCDEFGHIJKLMNOPRSTVW'.split('');
const ROUND_CHOICES = [3, 5, 8];
const TIME_CHOICES = [60, 90, 120];
const SPIN_MS = 2800;
const STOP_GRACE_MS = 3000;
const CHECK_MS = 40000;
const MAX_LEN = 30;
const UNIQUE = 10;
const SHARED = 5;

function startRound(s) {
  s.letter = s.letters[(s.round - 1) % s.letters.length];
  s.answers = Object.fromEntries(s.players.map(p => [p.id, { name: '', place: '', animal: '', thing: '' }]));
  s.flags = {};       // `${playerId}:${cat}` -> [flagger ids]
  s.stopBy = null;
  s.roundPoints = null;
  s.phase = 'spin';
  s.endsAt = Date.now() + SPIN_MS;
  s.totalMs = SPIN_MS;
  s.timerAt = s.endsAt;
  cue(s, 'roll');
}

// an answer counts if it starts with the letter and has at least two letters
const startsOk = (s, text) => { const n = normalize(text); return n.length >= 2 && n[0] === s.letter.toLowerCase(); };
const others = s => Math.max(1, s.players.length - 1);
const rejected = (s, key) => (s.flags[key] || []).length >= Math.ceil(others(s) / 2);

function startCheck(s) {
  s.phase = 'check';
  s.endsAt = Date.now() + CHECK_MS;
  s.totalMs = CHECK_MS;
  s.timerAt = s.endsAt;
  cue(s, 'reveal');
}

function score(s) {
  const pts = Object.fromEntries(s.players.map(p => [p.id, { total: 0 }]));
  for (const cat of CATS) {
    const valid = s.players.filter(p => startsOk(s, s.answers[p.id][cat]) && !rejected(s, `${p.id}:${cat}`));
    const groups = {};
    for (const p of valid) { const k = normalize(s.answers[p.id][cat]); groups[k] = (groups[k] || 0) + 1; }
    for (const p of s.players) {
      const ok = valid.includes(p);
      const v = ok ? (groups[normalize(s.answers[p.id][cat])] > 1 ? SHARED : UNIQUE) : 0;
      pts[p.id][cat] = v;
      pts[p.id].total += v;
    }
  }
  for (const p of s.players) s.scores[p.id] += pts[p.id].total;
  s.roundPoints = pts;
  s.phase = 'result';
  s.endsAt = null;
  s.timerAt = null;
  cue(s, 'correct');
}

module.exports = {
  id: 'npat',
  name: 'Name, Place, Animal, Thing',
  minPlayers: 2,
  maxPlayers: 8,
  options: [
    { key: 'rounds', label: 'Rounds', choices: ROUND_CHOICES, default: 5 },
    { key: 'time', label: 'Time', choices: TIME_CHOICES, default: 90, suffix: 's' },
  ],

  setup(players, opts = {}) {
    const s = {
      players: players.map(p => ({ id: p.id, name: p.name })),
      scores: Object.fromEntries(players.map(p => [p.id, 0])),
      rounds: ROUND_CHOICES.includes(Number(opts.rounds)) ? Number(opts.rounds) : 5,
      writeMs: (TIME_CHOICES.includes(Number(opts.time)) ? Number(opts.time) : 90) * 1000,
      opts: { rounds: opts.rounds, time: opts.time },
      letters: shuffle(LETTERS),
      round: 1,
    };
    startRound(s);
    return s;
  },

  onTimer(s) {
    if (s.phase === 'spin') {
      s.phase = 'write';
      s.endsAt = Date.now() + s.writeMs;
      s.totalMs = s.writeMs;
      s.timerAt = s.endsAt;
      cue(s, 'go');
    } else if (s.phase === 'write') startCheck(s);
    else if (s.phase === 'check') score(s);
  },

  action(s, playerId, a, { isHost }) {
    findPlayer(s, playerId);

    if (a.type === 'fill') {
      if (s.phase !== 'write') return { quiet: true };
      if (!CATS.includes(a.cat)) throw new Error('Pick a box');
      s.answers[playerId][a.cat] = String(a.text || '').replace(/\s+/g, ' ').trimStart().slice(0, MAX_LEN);
      return { quiet: true };
    }

    if (a.type === 'stop') {
      if (s.phase !== 'write') throw new Error('Not now');
      if (s.stopBy) return;
      const mine = s.answers[playerId];
      if (a.answers && typeof a.answers === 'object') for (const c of CATS) mine[c] = String(a.answers[c] || '').replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
      if (!CATS.every(c => startsOk(s, mine[c]))) throw new Error(`Fill all four with words starting with ${s.letter} first`);
      s.stopBy = playerId;
      s.endsAt = Math.min(s.endsAt, Date.now() + STOP_GRACE_MS);
      s.timerAt = s.endsAt;
      cue(s, 'buzzer');
      return;
    }

    if (a.type === 'flag') {
      if (s.phase !== 'check') throw new Error('Not checking now');
      const target = String(a.id || '');
      if (!CATS.includes(a.cat) || !s.answers[target]) throw new Error('Pick an answer');
      if (target === playerId) throw new Error("You can't flag your own answer");
      const key = `${target}:${a.cat}`;
      const list = s.flags[key] || (s.flags[key] = []);
      const i = list.indexOf(playerId);
      if (i >= 0) list.splice(i, 1); else list.push(playerId);
      return;
    }

    if (a.type === 'score') {
      if (s.phase !== 'check') throw new Error('Not now');
      if (!isHost) throw new Error('Only the host can do that');
      score(s);
      return;
    }

    if (a.type === 'next') {
      if (s.phase !== 'result') throw new Error('Not yet');
      if (!isHost) throw new Error('Only the host can go on');
      if (s.round >= s.rounds) { s.phase = 'over'; cue(s, 'win'); }
      else { s.round++; startRound(s); }
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
    const open = s.phase === 'check' || s.phase === 'result';
    const table = open ? Object.fromEntries(s.players.map(p => [p.id, Object.fromEntries(CATS.map(c => {
      const key = `${p.id}:${c}`;
      const flags = s.flags[key] || [];
      return [c, { text: s.answers[p.id][c], ok: startsOk(s, s.answers[p.id][c]), flags: flags.length, myFlag: flags.includes(playerId), out: rejected(s, key) }];
    }))])) : null;
    return {
      phase: s.phase,
      round: s.round,
      rounds: s.rounds,
      letter: s.phase === 'spin' ? null : s.letter,
      spinLetter: s.letter, // the spin lands on it; only shown after the spin
      cats: CATS,
      myAnswers: s.answers[playerId] || null,
      filled: Object.fromEntries(s.players.map(p => [p.id, CATS.filter(c => startsOk(s, s.answers[p.id][c])).length])),
      stopBy: s.stopBy,
      endsAt: s.endsAt,
      totalMs: s.totalMs,
      table,
      needed: Math.ceil(others(s) / 2),
      roundPoints: s.roundPoints,
      scores: s.scores,
      players: s.players,
    };
  },
};
