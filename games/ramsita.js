// Ramudu-Seetha chits game: everyone picks a folded chit. Ramudu reveals himself and
// must guess who has Seetha. Guess right -> Ramudu keeps his 1000 points.
// Guess wrong -> Seetha steals the 1000. Everyone else scores their chit's points.
const { shuffle, findPlayer } = require('./util');

const ROLES = [
  { key: 'ramudu', name: 'Ramudu', points: 1000 },
  { key: 'seetha', name: 'Seetha', points: 0 },
  { key: 'lakshmana', name: 'Lakshmanudu', points: 800 },
  { key: 'hanuman', name: 'Hanumanthudu', points: 500 },
  { key: 'bharatha', name: 'Bharathudu', points: 300 },
  { key: 'shatrughna', name: 'Shatrughnudu', points: 200 },
];
const ROUNDS = 5;

function startRound(s) {
  s.round += 1;
  s.phase = 'pick'; // pick -> guess -> reveal (-> pick ...) -> over
  s.chits = shuffle(ROLES.slice(0, s.players.length)).map(role => ({ role, takenBy: null }));
  s.guessedId = null;
  s.correct = null;
  s.roundPoints = {};
}

function roleOf(s, playerId) {
  const chit = s.chits.find(c => c.takenBy === playerId);
  return chit ? chit.role : null;
}

function holder(s, key) {
  return s.chits.find(c => c.role.key === key).takenBy;
}

module.exports = {
  id: 'ramsita',
  name: 'Ramudu-Seetha',
  blurb: 'Pick a secret chit. Ramudu must find Seetha — guess wrong and Seetha steals 1000 points!',
  minPlayers: 3,
  maxPlayers: ROLES.length,

  setup(players) {
    const s = {
      players: players.map(p => ({ id: p.id, name: p.name })),
      scores: Object.fromEntries(players.map(p => [p.id, 0])),
      round: 0,
      totalRounds: ROUNDS,
      history: [],
    };
    startRound(s);
    return s;
  },

  action(s, playerId, a, { isHost }) {
    findPlayer(s, playerId);

    if (a.type === 'pick') {
      if (s.phase !== 'pick') throw new Error('Not picking chits now');
      if (roleOf(s, playerId)) throw new Error('You already picked a chit');
      const chit = s.chits[a.index];
      if (!chit || chit.takenBy) throw new Error('That chit is taken');
      chit.takenBy = playerId;
      if (s.chits.every(c => c.takenBy)) s.phase = 'guess';
      return;
    }

    if (a.type === 'guess') {
      if (s.phase !== 'guess') throw new Error('Not guessing now');
      const ram = holder(s, 'ramudu');
      if (ram !== playerId) throw new Error('Only Ramudu can guess');
      if (a.targetId === playerId || !s.players.some(p => p.id === a.targetId)) throw new Error('Pick another player');
      const seetha = holder(s, 'seetha');
      s.guessedId = a.targetId;
      s.correct = a.targetId === seetha;
      for (const c of s.chits) s.roundPoints[c.takenBy] = c.role.points;
      if (!s.correct) {
        s.roundPoints[seetha] = 1000;
        s.roundPoints[ram] = 0;
      }
      for (const [id, pts] of Object.entries(s.roundPoints)) s.scores[id] += pts;
      s.history.push({ round: s.round, correct: s.correct, points: { ...s.roundPoints } });
      s.phase = s.round >= s.totalRounds ? 'over' : 'reveal';
      return;
    }

    if (a.type === 'next') {
      if (s.phase !== 'reveal') throw new Error('Round not finished');
      startRound(s);
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
    const revealAll = s.phase === 'reveal' || s.phase === 'over';
    const ramId = s.phase === 'pick' ? null : holder(s, 'ramudu');
    return {
      phase: s.phase,
      round: s.round,
      totalRounds: s.totalRounds,
      myRole: roleOf(s, playerId),
      ramId,
      guessedId: s.guessedId,
      correct: s.correct,
      roundPoints: revealAll ? s.roundPoints : null,
      scores: s.scores,
      history: s.history,
      roles: ROLES.slice(0, s.players.length),
      chits: s.chits.map(c => ({
        taken: !!c.takenBy,
        takenBy: c.takenBy,
        role: revealAll || c.takenBy === playerId ? c.role : null,
      })),
      players: s.players.map(p => ({
        id: p.id,
        name: p.name,
        picked: !!roleOf(s, p.id),
        role: revealAll || p.id === playerId || p.id === ramId ? roleOf(s, p.id) : null,
      })),
    };
  },
};
