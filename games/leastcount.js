// Least Count card game.
// Each player gets 7 cards. On your turn: throw one card (or several of the same rank),
// then pick one card from the deck or the previous player's thrown card.
// One card is opened as the Joker at the start: cards of that rank count 0.
// Think your hand total is the lowest? Call SHOW instead of throwing.
//   Lowest -> you score 0, everyone else scores their hand total.
//   Not lowest -> you get your total + 40 penalty, the actual lowest scores 0.
// Lowest total score after all rounds wins.
const { shuffle, findPlayer, cue } = require('./util');

const HAND_SIZE = 7;
const PENALTY = 40;
const ROUNDS = 5;

const rank = card => (card % 13) + 1; // 1 = Ace ... 11 J, 12 Q, 13 K
const cardValue = (card, jokerRank) => (rank(card) === jokerRank ? 0 : rank(card));
const handTotal = (hand, jokerRank) => hand.reduce((t, c) => t + cardValue(c, jokerRank), 0);

function startRound(s) {
  s.round += 1;
  const deck = shuffle([...Array(52).keys()]);
  s.jokerCard = deck.pop();
  s.jokerRank = rank(s.jokerCard);
  for (const p of s.players) p.hand = deck.splice(0, HAND_SIZE);
  s.pile = [deck.pop()];
  s.deck = deck;
  s.pending = null; // cards thrown this turn, go on the pile after the draw
  s.turn = (s.round - 1) % s.players.length;
  s.phase = 'throw'; // throw -> draw -> throw ... | roundOver | over
  s.result = null;
  s.log = [];
}

function addLog(s, text) {
  s.log.push(text);
  if (s.log.length > 8) s.log.shift();
}

module.exports = {
  id: 'leastcount',
  name: 'Least Count',
  blurb: 'Keep your card total lowest. Throw, pick, and call SHOW when you think you have the least!',
  minPlayers: 2,
  maxPlayers: 6,

  setup(players) {
    const s = {
      players: players.map(p => ({ id: p.id, name: p.name, hand: [] })),
      scores: Object.fromEntries(players.map(p => [p.id, 0])),
      round: 0,
      totalRounds: ROUNDS,
    };
    startRound(s);
    return s;
  },

  action(s, playerId, a, { isHost }) {
    const me = findPlayer(s, playerId);
    const myTurn = s.players[s.turn].id === playerId;

    if (a.type === 'throw') {
      if (s.phase !== 'throw' || !myTurn) throw new Error("It's not your turn to throw");
      const cards = Array.isArray(a.cards) ? a.cards.map(Number) : [];
      if (!cards.length) throw new Error('Select at least one card');
      if (new Set(cards).size !== cards.length || !cards.every(c => me.hand.includes(c))) throw new Error('Invalid cards');
      if (!cards.every(c => rank(c) === rank(cards[0]))) throw new Error('You can only throw cards of the same rank together');
      if (cards.length === me.hand.length) throw new Error('Keep at least one card in hand');
      me.hand = me.hand.filter(c => !cards.includes(c));
      s.pending = cards;
      s.phase = 'draw';
      cue(s, 'card');
      return;
    }

    if (a.type === 'draw') {
      if (s.phase !== 'draw' || !myTurn) throw new Error("It's not your turn to pick");
      let card;
      if (a.from === 'pile') {
        if (!s.pile.length) throw new Error('No card to pick there');
        card = s.pile.pop();
        addLog(s, `${me.name} picked the open card`);
      } else {
        if (!s.deck.length) {
          s.deck = shuffle(s.pile);
          s.pile = [];
        }
        card = s.deck.pop();
        addLog(s, `${me.name} picked from the deck`);
      }
      me.hand.push(card);
      s.pile.push(...s.pending);
      s.pending = null;
      s.turn = (s.turn + 1) % s.players.length;
      s.phase = 'throw';
      return;
    }

    if (a.type === 'show') {
      if (s.phase !== 'throw' || !myTurn) throw new Error('You can call SHOW only at the start of your turn');
      const totals = Object.fromEntries(s.players.map(p => [p.id, handTotal(p.hand, s.jokerRank)]));
      const mine = totals[playerId];
      const lowestOther = Math.min(...s.players.filter(p => p.id !== playerId).map(p => totals[p.id]));
      const success = mine < lowestOther;
      const points = {};
      for (const p of s.players) points[p.id] = totals[p.id];
      if (success) {
        points[playerId] = 0;
      } else {
        points[playerId] = mine + PENALTY;
        for (const p of s.players) if (p.id !== playerId && totals[p.id] === lowestOther) points[p.id] = 0;
      }
      for (const [id, pts] of Object.entries(points)) s.scores[id] += pts;
      s.result = { callerId: playerId, success, totals, points };
      cue(s, success ? 'win' : 'fail');
      s.phase = s.round >= s.totalRounds ? 'over' : 'roundOver';
      return;
    }

    if (a.type === 'next') {
      if (s.phase !== 'roundOver') throw new Error('Round not finished');
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
    const me = s.players.find(p => p.id === playerId);
    const ended = s.phase === 'roundOver' || s.phase === 'over';
    return {
      phase: s.phase,
      round: s.round,
      totalRounds: s.totalRounds,
      turnId: s.players[s.turn].id,
      jokerCard: s.jokerCard,
      jokerRank: s.jokerRank,
      myHand: me ? me.hand.slice().sort((a, b) => rank(a) - rank(b) || a - b) : [],
      myTotal: me ? handTotal(me.hand, s.jokerRank) : 0,
      openCard: s.pile.length ? s.pile[s.pile.length - 1] : null,
      pending: s.pending,
      deckCount: s.deck.length,
      scores: s.scores,
      result: s.result,
      log: s.log,
      penalty: PENALTY,
      players: s.players.map(p => ({
        id: p.id,
        name: p.name,
        cardCount: p.hand.length,
        hand: ended ? p.hand : undefined,
      })),
    };
  },
};
