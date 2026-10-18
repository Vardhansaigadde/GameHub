// Who's Most Likely To…
//   1. Everyone writes their own questions ("…fall asleep in a movie?").
//   2. One question at a time, everyone secretly votes for a player.
//   3. Results are revealed (counts only — votes stay anonymous); the top pick gets the "title".
//   Bonus: +1 "mind reader" point for voting with the winner.
const { shuffle, findPlayer, cue } = require('./util');

const MAX_PER_PLAYER = 5;

function startVoting(s) {
  s.order = shuffle(s.questions.map(q => q.id));
  s.idx = 0;
  s.votes = {};
  s.phase = 'vote';
}

function reveal(s) {
  const counts = {};
  for (const target of Object.values(s.votes)) counts[target] = (counts[target] || 0) + 1;
  const top = Math.max(0, ...Object.values(counts));
  const winners = top ? Object.keys(counts).filter(id => counts[id] === top) : [];
  for (const [voter, target] of Object.entries(s.votes)) if (winners.includes(target)) s.mind[voter] = (s.mind[voter] || 0) + 1;
  const q = s.questions.find(x => x.id === s.order[s.idx]);
  s.results.push({ text: q.text, counts, winners, voters: Object.keys(s.votes).length });
  s.phase = 'reveal';
  cue(s, 'reveal');
}

module.exports = {
  id: 'mostlikely',
  name: "Who's Most Likely To",
  blurb: 'Everyone writes questions about the group, then votes anonymously. Find out who the gang really thinks…',
  minPlayers: 3,
  maxPlayers: 8,

  setup(players) {
    return {
      players: players.map(p => ({ id: p.id, name: p.name, ready: false })),
      questions: [],
      nextId: 1,
      phase: 'write', // write -> vote -> reveal -> vote ... -> over
      order: [],
      idx: 0,
      votes: {},
      results: [],
      mind: {},
    };
  },

  action(s, playerId, a, { isHost }) {
    const me = findPlayer(s, playerId);

    if (a.type === 'ask') {
      if (s.phase !== 'write') throw new Error('Questions are closed');
      let text = String(a.text || '').trim().replace(/\s+/g, ' ').replace(/^who('?s| is)? most likely to\s*/i, '');
      text = text.replace(/\?+$/, '');
      if (text.length < 3) throw new Error('Write a little more');
      if (text.length > 120) throw new Error('Keep it under 120 letters');
      if (s.questions.filter(q => q.by === playerId).length >= MAX_PER_PLAYER) throw new Error(`Up to ${MAX_PER_PLAYER} questions each`);
      s.questions.push({ id: s.nextId++, text, by: playerId });
      me.ready = false;
      return;
    }

    if (a.type === 'unask') {
      if (s.phase !== 'write') throw new Error('Questions are closed');
      const q = s.questions.find(x => x.id === Number(a.id));
      if (!q || q.by !== playerId) throw new Error('Not your question');
      s.questions = s.questions.filter(x => x !== q);
      return;
    }

    if (a.type === 'ready') {
      if (s.phase !== 'write') throw new Error('Questions are closed');
      if (!s.questions.some(q => q.by === playerId)) throw new Error('Write at least one question first');
      me.ready = !me.ready;
      if (s.players.every(p => p.ready)) startVoting(s);
      return;
    }

    if (a.type === 'begin') {
      if (!isHost) throw new Error('Only the host can start the voting');
      if (s.phase !== 'write') throw new Error('Voting already started');
      if (!s.questions.length) throw new Error('Nobody has written a question yet');
      startVoting(s);
      return;
    }

    if (a.type === 'vote') {
      if (s.phase !== 'vote') throw new Error('Not voting now');
      if (!s.players.some(p => p.id === a.targetId)) throw new Error('Pick a player');
      s.votes[playerId] = a.targetId;
      cue(s, 'tap');
      if (Object.keys(s.votes).length === s.players.length) reveal(s);
      return;
    }

    if (a.type === 'revealNow') {
      if (!isHost) throw new Error('Only the host can do that');
      if (s.phase !== 'vote' || !Object.keys(s.votes).length) throw new Error('Wait for some votes');
      reveal(s);
      return;
    }

    if (a.type === 'next') {
      if (s.phase !== 'reveal') throw new Error('Not now');
      s.idx++;
      s.votes = {};
      if (s.idx >= s.order.length) { s.phase = 'over'; cue(s, 'win'); }
      else s.phase = 'vote';
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
    const q = s.phase === 'vote' || s.phase === 'reveal' ? s.questions.find(x => x.id === s.order[s.idx]) : null;
    return {
      phase: s.phase,
      myQuestions: s.questions.filter(x => x.by === playerId).map(x => ({ id: x.id, text: x.text })),
      totalQuestions: s.questions.length,
      question: q ? q.text : null,
      number: s.idx + 1,
      of: s.order.length,
      myVote: s.votes[playerId] || null,
      voted: Object.keys(s.votes),
      result: s.phase === 'reveal' ? s.results[s.results.length - 1] : null,
      results: s.phase === 'over' ? s.results : null,
      mind: s.mind,
      players: s.players.map(p => ({ id: p.id, name: p.name, ready: p.ready, wrote: s.questions.filter(x => x.by === p.id).length })),
    };
  },
};
