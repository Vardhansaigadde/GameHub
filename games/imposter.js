// Imposter: everyone gets the same secret word except one player, who gets a similar one
// (and doesn't know they're the odd one out).
//   1. word:   everyone looks at their word.
//   2. clue:   one by one, each player gives a one-word clue about their word.
//   3. vote:   everyone votes for who they think the imposter is.
//   4. reveal: if the most votes land on the imposter alone, they're caught;
//              otherwise the imposter escapes.
const { shuffle, findPlayer, cue, normalize } = require('./util');
const WORDS = require('./data/imposter-words');

const ROUND_CHOICES = [3, 5, 7];
const CLUE_CHOICES = [1, 2];
const THEMES = ['mixed', 'food', 'places', 'things', 'animals', 'life'];
const WORD_MS = 12000;
const CLUE_MS = 30000;
const VOTE_MS = 45000;
const CATCH_POINTS = 100;   // each player who voted for the imposter, when they're caught
const ESCAPE_POINTS = 200;  // the imposter, when they escape
const FOOL_POINTS = 25;     // the imposter, for each player who voted for someone else

function pairsFor(theme) {
  if (theme !== 'mixed' && WORDS[theme]) return WORDS[theme];
  return Object.values(WORDS).flat();
}

function startRound(s) {
  const pair = s.deck[(s.round - 1) % s.deck.length];
  const flip = Math.random() < 0.5;
  s.civilWord = flip ? pair[1] : pair[0];
  s.oddWord = flip ? pair[0] : pair[1];
  s.imposterId = s.players[Math.floor(Math.random() * s.players.length)].id;
  s.order = shuffle(s.players.map(p => p.id));
  s.turn = 0;
  s.lap = 1;
  s.clues = [];
  s.seen = {};
  s.votes = {};
  s.abstain = {};
  s.result = null;
  s.phase = 'word';
  s.endsAt = Date.now() + WORD_MS;
  s.totalMs = WORD_MS;
  s.timerAt = s.endsAt;
  cue(s, 'paper');
}

const wordOf = (s, id) => (id === s.imposterId ? s.oddWord : s.civilWord);

function startClues(s) {
  s.phase = 'clue';
  s.turn = 0;
  s.lap = 1;
  startTurn(s);
}

function startTurn(s) {
  s.endsAt = Date.now() + CLUE_MS;
  s.totalMs = CLUE_MS;
  s.timerAt = s.endsAt;
}

function addClue(s, id, text, skipped = false) {
  s.clues.push({ id, text, lap: s.lap, skipped });
  s.turn++;
  if (s.turn >= s.order.length) {
    if (s.lap < s.clueRounds) { s.lap++; s.turn = 0; } else { startVote(s); return; }
  }
  startTurn(s);
}

function startVote(s) {
  s.phase = 'vote';
  s.endsAt = Date.now() + VOTE_MS;
  s.totalMs = VOTE_MS;
  s.timerAt = s.endsAt;
  cue(s, 'reveal');
}

const allVoted = s => s.players.every(p => s.votes[p.id] || s.abstain[p.id]);

function reveal(s) {
  const counts = {};
  for (const target of Object.values(s.votes)) counts[target] = (counts[target] || 0) + 1;
  const top = Math.max(0, ...Object.values(counts));
  const leaders = top ? Object.keys(counts).filter(id => counts[id] === top) : [];
  const caught = leaders.length === 1 && leaders[0] === s.imposterId;
  const points = {};
  if (caught) {
    for (const [voter, target] of Object.entries(s.votes)) if (target === s.imposterId) points[voter] = CATCH_POINTS;
  } else {
    const fooled = Object.entries(s.votes).filter(([voter, target]) => voter !== s.imposterId && target !== s.imposterId).length;
    points[s.imposterId] = ESCAPE_POINTS + fooled * FOOL_POINTS;
  }
  for (const [id, pts] of Object.entries(points)) s.scores[id] = (s.scores[id] || 0) + pts;
  s.result = { imposterId: s.imposterId, civilWord: s.civilWord, oddWord: s.oddWord, counts, caught, points, votes: { ...s.votes } };
  s.phase = 'reveal';
  s.endsAt = null;
  s.timerAt = null;
  cue(s, 'reveal');
}

module.exports = {
  id: 'imposter',
  name: 'Imposter',
  minPlayers: 3,
  maxPlayers: 8,
  options: [
    { key: 'rounds', label: 'Rounds', choices: ROUND_CHOICES, default: 3 },
    { key: 'clues', label: 'Clues each', choices: CLUE_CHOICES, default: 1 },
    { key: 'theme', label: 'Words', choices: THEMES, labels: ['Mixed', 'Food', 'Places', 'Things', 'Animals', 'Life'], default: 'mixed' },
  ],

  setup(players, opts = {}) {
    const theme = THEMES.includes(opts.theme) ? opts.theme : 'mixed';
    const s = {
      players: players.map(p => ({ id: p.id, name: p.name })),
      scores: Object.fromEntries(players.map(p => [p.id, 0])),
      rounds: ROUND_CHOICES.includes(Number(opts.rounds)) ? Number(opts.rounds) : 3,
      clueRounds: CLUE_CHOICES.includes(Number(opts.clues)) ? Number(opts.clues) : 1,
      theme,
      opts: { rounds: opts.rounds, clues: opts.clues, theme },
      deck: shuffle(pairsFor(theme)),
      round: 1,
    };
    startRound(s);
    return s;
  },

  onTimer(s) {
    if (s.phase === 'word') startClues(s);
    else if (s.phase === 'clue') addClue(s, s.order[s.turn], '', true);
    else if (s.phase === 'vote') reveal(s);
  },

  // the game waits on: the player whose turn it is to give a clue, or anyone yet to look at their word or vote
  absentBlock(s, absentIds) {
    if (s.phase === 'clue') return absentIds.includes(s.order[s.turn]) ? s.order[s.turn] : null;
    if (s.phase === 'word') return absentIds.find(id => !s.seen[id] && s.players.some(p => p.id === id)) || null;
    if (s.phase === 'vote') return absentIds.find(id => !s.votes[id] && !s.abstain[id] && s.players.some(p => p.id === id)) || null;
    return null;
  },

  skipAbsent(s, id) {
    if (s.phase === 'clue' && s.order[s.turn] === id) addClue(s, id, '', true);
    else if (s.phase === 'word') {
      s.seen[id] = true;
      if (s.players.every(p => s.seen[p.id])) startClues(s);
    } else if (s.phase === 'vote') {
      s.abstain[id] = true;
      if (allVoted(s)) reveal(s);
    }
  },

  action(s, playerId, a, { isHost }) {
    findPlayer(s, playerId);

    if (a.type === 'seen') {
      if (s.phase !== 'word') throw new Error('Not now');
      s.seen[playerId] = true;
      cue(s, 'tap');
      if (s.players.every(p => s.seen[p.id])) startClues(s);
      return;
    }

    if (a.type === 'clue') {
      if (s.phase !== 'clue') throw new Error('Not giving clues now');
      if (s.order[s.turn] !== playerId) throw new Error("It's not your turn");
      const text = String(a.text || '').trim().replace(/\s+/g, ' ');
      if (!text) throw new Error('Type a clue');
      if (text.length > 24 || text.split(' ').length > 2) throw new Error('Keep it to one word');
      const mine = normalize(wordOf(s, playerId));
      const said = normalize(text);
      if (said.includes(mine) || (said.length >= 3 && mine.includes(said))) throw new Error("Don't say your word!");
      if (s.clues.some(c => !c.skipped && normalize(c.text) === said)) throw new Error('Someone already said that');
      addClue(s, playerId, text);
      cue(s, 'tap');
      return;
    }

    if (a.type === 'vote') {
      if (s.phase !== 'vote') throw new Error('Voting is closed');
      const target = String(a.targetId || '');
      if (target === playerId) throw new Error("You can't vote for yourself");
      if (!s.players.some(p => p.id === target)) throw new Error('Pick a player');
      s.votes[playerId] = target;
      cue(s, 'tap');
      if (allVoted(s)) reveal(s);
      return;
    }

    if (a.type === 'revealNow') {
      if (!isHost) throw new Error('Only the host can do that');
      if (s.phase !== 'vote' || !Object.keys(s.votes).length) throw new Error('Wait for some votes');
      reveal(s);
      return;
    }

    if (a.type === 'next') {
      if (s.phase !== 'reveal') throw new Error('Not yet');
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
    const playing = s.phase === 'word' || s.phase === 'clue' || s.phase === 'vote';
    return {
      phase: s.phase,
      round: s.round,
      rounds: s.rounds,
      clueRounds: s.clueRounds,
      lap: s.lap,
      theme: s.theme,
      myWord: playing ? wordOf(s, playerId) : null,
      order: s.order,
      turnId: s.phase === 'clue' ? s.order[s.turn] : null,
      clues: s.clues,
      seen: Object.keys(s.seen),
      voted: Object.keys(s.votes),
      myVote: s.votes[playerId] || null,
      endsAt: s.endsAt,
      totalMs: s.totalMs,
      result: s.phase === 'reveal' ? s.result : null,
      scores: s.scores,
      players: s.players.map(p => ({ id: p.id, name: p.name })),
    };
  },
};
