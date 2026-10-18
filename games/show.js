// Show (chits passing game):
//   Every player writes one word (any name — a film, a fruit, a friend...).
//   Each word is copied onto 4 chits, all chits are mixed and dealt 4 per player.
//   Everyone picks one chit to pass; once all have picked, the chits move to the next
//   player in joining order (last player passes to the first) at the same time. Repeat.
//   Collect 4 chits with the same word -> press SHOW (1st place).
//   Then everyone else races to press SHOW — 2nd, 3rd, 4th... in the order they press.
const { shuffle, findPlayer } = require('./util');

const PER_WORD = 4;
const ROUNDS = 5;
const MAX_WORD = 14;

const rankPoints = (rank, n) => Math.round((1000 * (n - rank)) / n); // 4 players: 1000, 750, 500, 250

function deal(s) {
  let id = 0;
  const chits = shuffle(s.players.flatMap(p => Array.from({ length: PER_WORD }, () => ({ id: id++, word: p.word }))));
  s.players.forEach((p, i) => {
    p.hand = chits.slice(i * PER_WORD, (i + 1) * PER_WORD);
    p.pick = null;
  });
  s.passes = 0;
  s.ranking = [];
  s.raceStart = null;
  s.roundPoints = null;
  s.phase = 'pass';
}

const hasSet = hand => hand.length === PER_WORD && hand.every(c => c.word === hand[0].word);

function finishRound(s) {
  const n = s.players.length;
  // anyone who never pressed (e.g. disconnected) is placed last, in seat order
  for (const p of s.players) if (!s.ranking.some(r => r.id === p.id)) s.ranking.push({ id: p.id, ms: null });
  s.roundPoints = {};
  s.ranking.forEach((r, i) => {
    s.roundPoints[r.id] = rankPoints(i, n);
    s.scores[r.id] += s.roundPoints[r.id];
  });
  s.phase = s.round >= s.totalRounds ? 'over' : 'roundOver';
}

module.exports = {
  id: 'show',
  name: 'Show',
  blurb: 'Everyone writes a word on 4 chits. Pass chits around — collect 4 of the same and hit SHOW first!',
  minPlayers: 3,
  maxPlayers: 8,

  setup(players) {
    return {
      players: players.map(p => ({ id: p.id, name: p.name, word: null, hand: [], pick: null })),
      scores: Object.fromEntries(players.map(p => [p.id, 0])),
      round: 1,
      totalRounds: ROUNDS,
      phase: 'words', // words -> pass -> race -> roundOver -> pass ... -> over
      passes: 0,
      ranking: [],
    };
  },

  action(s, playerId, a, { isHost }) {
    const me = findPlayer(s, playerId);

    if (a.type === 'word') {
      if (s.phase !== 'words') throw new Error('Words are already locked');
      const word = String(a.word || '').trim().replace(/\s+/g, ' ').slice(0, MAX_WORD);
      if (!word) throw new Error('Write a word first');
      if (s.players.some(p => p !== me && p.word && p.word.toLowerCase() === word.toLowerCase())) {
        throw new Error('Someone already wrote that — pick another word');
      }
      me.word = word;
      if (s.players.every(p => p.word)) deal(s);
      return;
    }

    if (a.type === 'pick') {
      if (s.phase !== 'pass') throw new Error('Not passing now');
      const chit = me.hand.find(c => c.id === Number(a.chit));
      if (!chit) throw new Error('Pick one of your chits');
      me.pick = chit.id;
      if (s.players.every(p => p.pick != null)) {
        // everyone hands their chit to the next player at the same moment
        const outgoing = s.players.map(p => p.hand.find(c => c.id === p.pick));
        s.players.forEach((p, i) => {
          p.hand = p.hand.filter(c => c.id !== p.pick);
          p.hand.push(outgoing[(i - 1 + s.players.length) % s.players.length]);
          p.pick = null;
        });
        s.passes++;
      }
      return;
    }

    if (a.type === 'unpick') {
      if (s.phase !== 'pass') throw new Error('Not passing now');
      me.pick = null;
      return;
    }

    if (a.type === 'show') {
      if (s.ranking.some(r => r.id === playerId)) throw new Error('You already pressed SHOW');
      if (s.phase === 'pass') {
        if (!hasSet(me.hand)) throw new Error('You need 4 chits with the same word to call SHOW');
        s.phase = 'race';
        s.raceStart = Date.now();
        s.ranking.push({ id: playerId, ms: 0 });
        return;
      }
      if (s.phase !== 'race') throw new Error('Not now');
      s.ranking.push({ id: playerId, ms: Date.now() - s.raceStart });
      if (s.ranking.length === s.players.length) finishRound(s);
      return;
    }

    if (a.type === 'forceEnd') {
      if (!isHost) throw new Error('Only the host can do that');
      if (s.phase !== 'race') throw new Error('No race running');
      finishRound(s);
      return;
    }

    if (a.type === 'next') {
      if (s.phase !== 'roundOver') throw new Error('Round not finished');
      s.round++;
      deal(s);
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
    const me = s.players.find(p => p.id === playerId);
    const ended = s.phase === 'roundOver' || s.phase === 'over';
    return {
      phase: s.phase,
      round: s.round,
      totalRounds: s.totalRounds,
      myWord: me ? me.word : null,
      myHand: me ? me.hand : [],
      myPick: me ? me.pick : null,
      canShow: !!me && s.phase === 'pass' && hasSet(me.hand),
      passes: s.passes,
      ranking: s.ranking,
      roundPoints: s.roundPoints,
      scores: s.scores,
      players: s.players.map(p => ({
        id: p.id,
        name: p.name,
        wrote: !!p.word,
        word: s.phase === 'words' ? null : p.word,
        picked: p.pick != null,
        hand: ended ? p.hand : undefined,
      })),
    };
  },
};
