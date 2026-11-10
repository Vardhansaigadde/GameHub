// Funny Fill-in: everyone gets the same sentence with a blank and writes the funniest answer.
//   1. write:  everyone fills the blank.
//   2. vote:   the answers are shown with no names; vote for your favourite (not your own).
//   3. reveal: names come out; each vote scores, and the favourite gets a bonus.
const { shuffle, findPlayer, cue } = require('./util');
const PROMPTS = require('./data/funny-prompts');

const ROUND_CHOICES = [3, 5, 8];
const WRITE_MS = 60000;
const VOTE_MS = 30000;
const MAX_LEN = 80;
const VOTE_POINTS = 100;
const WIN_BONUS = 50;

function startRound(s) {
  s.phase = 'write';
  s.prompt = s.deck[(s.round - 1) % s.deck.length];
  s.answers = {};
  s.skipped = {};
  s.order = [];
  s.votes = {};
  s.abstain = {};
  s.result = null;
  s.endsAt = Date.now() + WRITE_MS;
  s.totalMs = WRITE_MS;
  s.timerAt = s.endsAt;
  cue(s, 'paper');
}

const canVote = (s, id) => s.order.some(a => a !== id);
const allWritten = s => s.players.every(p => s.answers[p.id] || s.skipped[p.id]);
const allVoted = s => s.players.every(p => s.votes[p.id] !== undefined || s.abstain[p.id] || !canVote(s, p.id));

function startVote(s) {
  s.order = shuffle(Object.keys(s.answers));
  if (s.order.length < 2) return reveal(s);
  s.phase = 'vote';
  s.endsAt = Date.now() + VOTE_MS;
  s.totalMs = VOTE_MS;
  s.timerAt = s.endsAt;
  cue(s, 'reveal');
}

function reveal(s) {
  const counts = {};
  for (const target of Object.values(s.votes)) counts[target] = (counts[target] || 0) + 1;
  const top = Math.max(0, ...Object.values(counts));
  const winners = top ? Object.keys(counts).filter(id => counts[id] === top) : [];
  const points = {};
  for (const id of s.order) {
    const pts = (counts[id] || 0) * VOTE_POINTS + (winners.includes(id) ? WIN_BONUS : 0);
    if (pts) { points[id] = pts; s.scores[id] = (s.scores[id] || 0) + pts; }
  }
  const rows = s.order.map(id => ({ id, text: s.answers[id], votes: counts[id] || 0, winner: winners.includes(id), pts: points[id] || 0 }))
    .sort((a, b) => b.votes - a.votes);
  s.result = { rows, winners };
  for (const id of winners) s.best.push({ prompt: s.prompt, text: s.answers[id], by: id, votes: counts[id] });
  s.phase = 'reveal';
  s.endsAt = null;
  s.timerAt = null;
  cue(s, 'reveal');
}

module.exports = {
  id: 'fillin',
  name: 'Funny Fill-in',
  minPlayers: 3,
  maxPlayers: 8,
  options: [{ key: 'rounds', label: 'Rounds', choices: ROUND_CHOICES, default: 5 }],

  setup(players, opts = {}) {
    const s = {
      players: players.map(p => ({ id: p.id, name: p.name })),
      scores: Object.fromEntries(players.map(p => [p.id, 0])),
      rounds: ROUND_CHOICES.includes(Number(opts.rounds)) ? Number(opts.rounds) : 5,
      opts: { rounds: opts.rounds },
      deck: shuffle(PROMPTS),
      round: 1,
      best: [],
    };
    startRound(s);
    return s;
  },

  onTimer(s) {
    if (s.phase === 'write') startVote(s);
    else if (s.phase === 'vote') reveal(s);
  },

  absentBlock(s, absentIds) {
    const here = id => s.players.some(p => p.id === id);
    if (s.phase === 'write') return absentIds.find(id => here(id) && !s.answers[id] && !s.skipped[id]) || null;
    if (s.phase === 'vote') return absentIds.find(id => here(id) && s.votes[id] === undefined && !s.abstain[id] && canVote(s, id)) || null;
    return null;
  },

  skipAbsent(s, id) {
    if (s.phase === 'write') { s.skipped[id] = true; if (allWritten(s)) startVote(s); }
    else if (s.phase === 'vote') { s.abstain[id] = true; if (allVoted(s)) reveal(s); }
  },

  action(s, playerId, a, { isHost }) {
    findPlayer(s, playerId);

    if (a.type === 'answer') {
      if (s.phase !== 'write') throw new Error('Answers are closed');
      const text = String(a.text || '').trim().replace(/\s+/g, ' ');
      if (text.length < 1) throw new Error('Write something funny');
      if (text.length > MAX_LEN) throw new Error(`Keep it under ${MAX_LEN} letters`);
      s.answers[playerId] = text;
      cue(s, 'tap');
      if (allWritten(s)) startVote(s);
      return;
    }

    if (a.type === 'unanswer') {
      if (s.phase !== 'write') throw new Error('Answers are closed');
      delete s.answers[playerId];
      return;
    }

    if (a.type === 'vote') {
      if (s.phase !== 'vote') throw new Error('Voting is closed');
      const target = s.order[Number(a.index)];
      if (!target) throw new Error('Pick an answer');
      if (target === playerId) throw new Error("You can't vote for your own answer");
      s.votes[playerId] = target;
      cue(s, 'tap');
      if (allVoted(s)) reveal(s);
      return;
    }

    if (a.type === 'revealNow') {
      if (!isHost) throw new Error('Only the host can do that');
      if (s.phase === 'write') { if (!Object.keys(s.answers).length) throw new Error('Wait for some answers'); startVote(s); return; }
      if (s.phase === 'vote') { reveal(s); return; }
      throw new Error('Not now');
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
    return {
      phase: s.phase,
      round: s.round,
      rounds: s.rounds,
      prompt: s.prompt,
      myAnswer: s.answers[playerId] || null,
      written: Object.keys(s.answers),
      // during the vote, answers travel without names; you only learn which one is yours
      choices: s.phase === 'vote' ? s.order.map(id => s.answers[id]) : null,
      mine: s.phase === 'vote' ? s.order.indexOf(playerId) : -1,
      myVote: s.phase === 'vote' && s.votes[playerId] ? s.order.indexOf(s.votes[playerId]) : -1,
      voted: Object.keys(s.votes),
      endsAt: s.endsAt,
      totalMs: s.totalMs,
      result: s.phase === 'reveal' ? s.result : null,
      best: s.phase === 'over' ? s.best : null,
      scores: s.scores,
      players: s.players,
    };
  },
};
