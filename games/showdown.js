// Sketch Showdown: everyone gets the same sentence and draws it at the same time.
//   When the timer ends, every drawing is revealed together and players vote for their favourite.
const { shuffle, findPlayer, cue } = require('./util');
const PROMPTS = require('./data/showdown-prompts');

const ROUND_CHOICES = [2, 3, 5];
const TIME_CHOICES = [45, 60, 90];
const VOTE_MS = 30000;
const GRACE_MS = 1500;      // lets last-second auto-submits arrive
const MAX_IMAGE = 700000;   // characters of base64
const IMAGE_RE = /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/;
const POINTS_PER_VOTE = 100;
const WINNER_BONUS = 50;

function startRound(s) {
  s.phase = 'draw';
  s.prompt = s.deck[(s.round - 1) % s.deck.length];
  s.art = {};
  s.done = {};
  s.votes = {};
  s.order = [];
  s.roundPoints = {};
  s.endsAt = Date.now() + s.drawMs;
  s.totalMs = s.drawMs;
  s.timerAt = s.endsAt + GRACE_MS;
  cue(s, 'paper');
}

function startVote(s) {
  s.phase = 'vote';
  s.order = shuffle(s.players.map(p => p.id));
  s.endsAt = Date.now() + VOTE_MS;
  s.totalMs = VOTE_MS;
  s.timerAt = s.endsAt;
  cue(s, 'reveal');
  // nobody to vote for: skip straight to the results
  if (s.players.every(p => !canVote(s, p.id))) finishVote(s);
}

// a player can vote if someone else handed in a drawing
const canVote = (s, id) => s.players.some(p => p.id !== id && s.art[p.id]);

function finishVote(s) {
  s.phase = 'result';
  s.timerAt = null;
  s.endsAt = null;
  const tally = {};
  for (const target of Object.values(s.votes)) tally[target] = (tally[target] || 0) + 1;
  const best = Math.max(0, ...Object.values(tally));
  for (const p of s.players) {
    const pts = (tally[p.id] || 0) * POINTS_PER_VOTE + (best > 0 && tally[p.id] === best ? WINNER_BONUS : 0);
    s.roundPoints[p.id] = pts;
    s.scores[p.id] += pts;
  }
  s.tally = tally;
  s.best = best;
  cue(s, 'win');
}

module.exports = {
  id: 'showdown',
  name: 'Sketch Showdown',
  minPlayers: 2,
  maxPlayers: 8,
  options: [
    { key: 'rounds', label: 'Rounds', choices: ROUND_CHOICES, default: 3 },
    { key: 'time', label: 'Draw time', choices: TIME_CHOICES, default: 60, suffix: 's' },
  ],

  setup(players, opts = {}) {
    const s = {
      players: players.map(p => ({ id: p.id, name: p.name })),
      scores: Object.fromEntries(players.map(p => [p.id, 0])),
      rounds: ROUND_CHOICES.includes(Number(opts.rounds)) ? Number(opts.rounds) : 3,
      drawMs: (TIME_CHOICES.includes(Number(opts.time)) ? Number(opts.time) : 60) * 1000,
      deck: shuffle(PROMPTS),
      round: 1,
      gameNo: (opts.gameNo || 0) + 1,
      tally: {},
      best: 0,
    };
    startRound(s);
    return s;
  },

  onTimer(s) {
    if (s.phase === 'draw') startVote(s);
    else if (s.phase === 'vote') finishVote(s);
  },

  action(s, playerId, a, { isHost }) {
    findPlayer(s, playerId);

    if (a.type === 'submit') {
      if (s.phase !== 'draw') throw new Error('The drawing time is over');
      const image = String(a.image || '');
      if (!IMAGE_RE.test(image) || image.length > MAX_IMAGE) throw new Error('That drawing could not be sent — try again');
      s.art[playerId] = image;
      s.done[playerId] = true;
      cue(s, 'tap');
      if (s.players.every(p => s.done[p.id])) startVote(s);
      return;
    }

    if (a.type === 'unsubmit') {
      if (s.phase !== 'draw') throw new Error('The drawing time is over');
      delete s.done[playerId];
      return;
    }

    // drawings are large, so they are fetched one by one and never travel in normal updates
    if (a.type === 'image') {
      if (s.phase === 'draw') throw new Error('Not yet');
      return { quiet: true, image: s.art[String(a.id)] || null };
    }

    if (a.type === 'vote') {
      if (s.phase !== 'vote') throw new Error('Voting is closed');
      const target = String(a.id);
      if (target === playerId) throw new Error('You cannot vote for your own drawing');
      if (!s.art[target]) throw new Error('Pick a drawing');
      s.votes[playerId] = target;
      cue(s, 'tap');
      if (s.players.every(p => s.votes[p.id] || !canVote(s, p.id))) finishVote(s);
      return;
    }

    if (a.type === 'next') {
      if (s.phase !== 'result') throw new Error('Not yet');
      if (!isHost) throw new Error('Only the host can go on');
      if (s.round >= s.rounds) {
        s.phase = 'over';
        cue(s, 'win');
      } else {
        s.round++;
        startRound(s);
      }
      return;
    }

    if (a.type === 'rematch') {
      if (s.phase !== 'over') throw new Error('Game not finished');
      if (!isHost) throw new Error('Only the host can start a rematch');
      Object.assign(s, this.setup(s.players, { rounds: s.rounds, time: s.drawMs / 1000, gameNo: s.gameNo }));
      return;
    }

    throw new Error('Unknown action');
  },

  view(s, playerId) {
    return {
      phase: s.phase,
      gameNo: s.gameNo,
      round: s.round,
      totalRounds: s.rounds,
      prompt: s.prompt,
      endsAt: s.endsAt,
      totalMs: s.totalMs,
      doneIds: Object.keys(s.done),
      myDone: !!s.done[playerId],
      gallery: s.order.map(id => ({ id, empty: !s.art[id] })),
      myVote: s.votes[playerId] || null,
      votedIds: Object.keys(s.votes),
      tally: s.phase === 'result' || s.phase === 'over' ? s.tally : {},
      best: s.phase === 'result' || s.phase === 'over' ? s.best : 0,
      roundPoints: s.roundPoints,
      scores: s.scores,
      players: s.players,
    };
  },
};
