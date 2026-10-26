// Draw & Guess (skribbl-style).
//   Each turn the drawer picks 1 of 4 random words (movie / food / thing) and draws it.
//   Everyone else types guesses — faster correct guesses score more, and the drawer
//   earns points for every player who gets it. Letters are revealed as hints over time.
const { shuffle, findPlayer, cue, matchGuess } = require('./util');
const WORDS = require('./data/draw-words');

const CHOOSE_MS = 15000;
const REVEAL_MS = 5000;
const DRAWER_PER_GUESS = 60;     // drawer earns this for every correct guess
const ALL_GUESSED_BONUS = 100;   // extra for the drawer when every player gets the word
const MAX_ITEMS = 4000;

function pickChoices(s) {
  const take = (list, cat) => {
    const pool = list.filter(w => !s.used.has(w));
    const w = pool[Math.floor(Math.random() * pool.length)] || list[Math.floor(Math.random() * list.length)];
    s.used.add(w);
    return { word: w, cat };
  };
  return shuffle([take(WORDS.movies, 'Movie'), take(WORDS.food, 'Food'), take(WORDS.things, 'Thing'), take(WORDS.things, 'Thing')]);
}

function startTurn(s) {
  s.phase = 'choose';
  s.choices = pickChoices(s);
  s.word = null;
  s.items = [];
  s.solvers = [];
  s.feed = [];
  s.revealed = [];
  s.timerAt = Date.now() + CHOOSE_MS;
}

function beginDrawing(s, choice) {
  s.word = choice.word;
  s.cat = choice.cat;
  s.phase = 'draw';
  s.startedAt = Date.now();
  s.hintStage = 0;
  s.timerAt = s.startedAt + s.drawMs * 0.5;
}

function endTurn(s) {
  s.phase = 'reveal';
  s.timerAt = Date.now() + REVEAL_MS;
  cue(s, 'reveal');
}

function nextTurn(s) {
  s.turn++;
  if (s.turn >= s.players.length) {
    s.turn = 0;
    s.round++;
  }
  if (s.round > s.rounds) {
    s.phase = 'over';
    s.timerAt = null;
    cue(s, 'win');
    return;
  }
  startTurn(s);
}

function revealLetter(s) {
  const idx = [...s.word].map((ch, i) => i).filter(i => /[a-z0-9]/i.test(s.word[i]) && !s.revealed.includes(i));
  if (idx.length > 2) s.revealed.push(idx[Math.floor(Math.random() * idx.length)]);
}

const drawerOf = s => s.players[s.turn];

module.exports = {
  id: 'pictionary',
  name: 'Draw & Guess',
  blurb: 'Pick a word, draw it, and everyone races to guess. Telugu movies, food and everyday things — bad drawings welcome!',
  minPlayers: 2,
  maxPlayers: 8,
  options: [
    { key: 'rounds', label: 'Rounds', choices: [2, 3, 4], default: 3 },
    { key: 'time', label: 'Draw time', choices: [60, 80, 100], default: 80, suffix: 's' },
  ],

  setup(players, opts = {}) {
    const s = {
      players: players.map(p => ({ id: p.id, name: p.name })),
      scores: Object.fromEntries(players.map(p => [p.id, 0])),
      rounds: [2, 3, 4].includes(Number(opts.rounds)) ? Number(opts.rounds) : 3,
      drawMs: ([60, 80, 100].includes(Number(opts.time)) ? Number(opts.time) : 80) * 1000,
      round: 1,
      turn: 0,
      used: new Set(),
    };
    startTurn(s);
    return s;
  },

  onTimer(s) {
    if (s.phase === 'choose') {
      beginDrawing(s, s.choices[Math.floor(Math.random() * s.choices.length)]);
    } else if (s.phase === 'draw') {
      s.hintStage++;
      if (s.hintStage === 1) { revealLetter(s); s.timerAt = s.startedAt + s.drawMs * 0.75; cue(s, 'tick'); }
      else if (s.hintStage === 2) { revealLetter(s); s.timerAt = s.startedAt + s.drawMs; cue(s, 'tick'); }
      else endTurn(s);
    } else if (s.phase === 'reveal') nextTurn(s);
  },

  // drawing data from the drawer, relayed live to everyone else
  stream(s, playerId, d) {
    if (s.phase !== 'draw' || drawerOf(s).id !== playerId || !d || typeof d !== 'object') return null;
    let item;
    if (d.t === 's' && Array.isArray(d.p) && d.p.length >= 2 && d.p.length <= 400) {
      item = { t: 's', id: String(d.id).slice(0, 12), c: String(d.c).slice(0, 9), w: Math.min(40, Math.max(1, Number(d.w) || 4)), p: d.p.slice(0, 400).map(n => Math.round(Number(n) || 0)) };
    } else if (d.t === 'f') {
      item = { t: 'f', id: String(d.id).slice(0, 12), c: String(d.c).slice(0, 9), x: Math.round(Number(d.x) || 0), y: Math.round(Number(d.y) || 0) };
    } else if (d.t === 'u') {
      const last = s.items.length ? s.items[s.items.length - 1].id : null;
      if (!last) return null;
      s.items = s.items.filter(it => it.id !== last);
      return { t: 'u', id: last };
    } else if (d.t === 'c') {
      s.items = [];
      return { t: 'c' };
    } else return null;
    if (s.items.length >= MAX_ITEMS) return null;
    s.items.push(item);
    return item;
  },

  streamSync(s) {
    return s.phase === 'draw' || s.phase === 'reveal' ? s.items : [];
  },

  action(s, playerId, a, { isHost }) {
    const me = findPlayer(s, playerId);
    const drawer = drawerOf(s);

    if (a.type === 'choose') {
      if (s.phase !== 'choose' || drawer.id !== playerId) throw new Error('Not your turn to choose');
      const c = s.choices[Number(a.index)];
      if (!c) throw new Error('Pick one of the words');
      beginDrawing(s, c);
      return;
    }

    if (a.type === 'guess') {
      const text = String(a.text || '').trim().slice(0, 60);
      if (!text) return;
      const say = (kind, extra = {}) => { s.feed.push({ name: me.name, kind, ...extra }); if (s.feed.length > 14) s.feed.shift(); };
      if (s.phase !== 'draw' || playerId === drawer.id || s.solvers.includes(playerId)) {
        // drawer and players who already guessed can still chat, but only among themselves
        say('chat', { text, private: true });
        return;
      }
      const m = matchGuess(text, [s.word]);
      if (m === 'exact') {
        const left = Math.max(0, s.startedAt + s.drawMs - Date.now()) / s.drawMs;
        const pts = Math.round(80 + 220 * left) + Math.max(0, 40 - s.solvers.length * 10);
        s.solvers.push(playerId);
        s.scores[playerId] += pts;
        s.scores[drawer.id] += DRAWER_PER_GUESS;
        say('correct', { pts });
        cue(s, 'correct');
        if (s.solvers.length === s.players.length - 1) {
          // everyone got it — reward the drawer for a clear drawing
          s.scores[drawer.id] += ALL_GUESSED_BONUS;
          s.feed.push({ name: drawer.name, kind: 'bonus', pts: ALL_GUESSED_BONUS });
          endTurn(s);
        }
        return { message: `You got it! +${pts}` };
      }
      say('guess', { text });
      if (m === 'close') return { message: `“${text}” is close!` };
      return;
    }

    if (a.type === 'skip') {
      if (!isHost && playerId !== drawer.id) throw new Error('Only the host or drawer can skip');
      if (s.phase === 'choose') { s.word = s.choices[0].word; endTurn(s); }
      else if (s.phase === 'draw') endTurn(s);
      return;
    }

    if (a.type === 'rematch') {
      if (s.phase !== 'over') throw new Error('Game not finished');
      if (!isHost) throw new Error('Only the host can start a rematch');
      Object.assign(s, this.setup(s.players, { rounds: s.rounds, time: s.drawMs / 1000 }));
      return;
    }

    throw new Error('Unknown action');
  },

  view(s, playerId) {
    const drawer = drawerOf(s);
    const isDrawer = drawer.id === playerId;
    const solved = (s.solvers || []).includes(playerId);
    const knows = isDrawer || solved || s.phase === 'reveal' || s.phase === 'over';
    const mask = s.word ? [...s.word].map((ch, i) => (/[a-z0-9]/i.test(ch) ? (s.revealed.includes(i) ? ch : '_') : ch)).join('') : null;
    return {
      phase: s.phase,
      round: s.round,
      totalRounds: s.rounds,
      drawerId: drawer.id,
      endsAt: s.phase === 'draw' ? s.startedAt + s.drawMs : s.timerAt,
      totalMs: s.phase === 'draw' ? s.drawMs : CHOOSE_MS,
      isDrawer,
      choices: isDrawer && s.phase === 'choose' ? s.choices : null,
      word: knows ? s.word : null,
      cat: s.phase !== 'choose' ? s.cat : null,
      mask: knows ? null : mask,
      solved,
      solvers: s.solvers || [],
      // private chat from people who already know the word is only shown to others who know it
      feed: (s.feed || []).filter(f => !f.private || knows),
      scores: s.scores,
      players: s.players,
    };
  },
};
