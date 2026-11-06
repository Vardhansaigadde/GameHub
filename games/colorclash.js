// Color Clash: the classic shedding card game. Match the colour or the value, or play a wild.
//   Skip, Reverse and +2 in each colour; Wild and Wild +4 change the colour.
//   No playable card? Draw one, then play it or pass.
//   Down to one card? Press ONE! before someone catches you (+2 cards). First to empty their hand wins.
const { shuffle, findPlayer, cue } = require('./util');

const COLORS = ['red', 'yellow', 'green', 'blue'];
const HAND = 7;

function makeDeck() {
  const cards = [];
  let id = 0;
  for (const c of COLORS) {
    cards.push({ id: id++, c, v: '0' });
    for (const v of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', '+2']) {
      cards.push({ id: id++, c, v }, { id: id++, c, v });
    }
  }
  for (let i = 0; i < 4; i++) cards.push({ id: id++, c: 'wild', v: 'wild' }, { id: id++, c: 'wild', v: '+4' });
  return shuffle(cards);
}

const isPlayable = (s, card) => card.c === 'wild' || card.c === s.color || card.v === s.top.v;

function drawCards(s, player, n) {
  for (let i = 0; i < n; i++) {
    if (!s.deck.length) {
      if (!s.pile.length) return;
      s.deck = shuffle(s.pile);
      s.pile = [];
    }
    player.hand.push(s.deck.pop());
  }
}

const step = (s, n = 1) => { s.turn = (s.turn + s.dir * n + s.players.length * 2) % s.players.length; };

module.exports = {
  // who the game is stuck waiting for, out of the players who have gone
  absentBlock(s, absent) {
    const id = s.phase !== 'over' ? s.players[s.turn].id : null;
    return id && absent.includes(id) ? id : null;
  },
  skipAbsent(s) { s.drew = null; step(s); },

  id: 'colorclash',
  name: 'Color Clash',
  minPlayers: 2,
  maxPlayers: 8,

  setup(players) {
    const deck = makeDeck();
    const list = players.map(p => ({ id: p.id, name: p.name, hand: deck.splice(0, HAND) }));
    // the first open card must be a plain number
    let idx = deck.findIndex(c => /^\d$/.test(c.v));
    const top = deck.splice(idx, 1)[0];
    return {
      players: list,
      deck,
      pile: [],
      top,
      color: top.c,
      turn: 0,
      dir: 1,
      drew: null,    // card id drawn this turn: only that card can be played, or pass
      oneOpen: null, // player who has one card and hasn't said ONE yet
      phase: 'play',
      winnerId: null,
      log: [],
      plays: 0,
    };
  },

  action(s, playerId, a, { isHost }) {
    const me = findPlayer(s, playerId);
    const log = t => { s.log.push(t); if (s.log.length > 5) s.log.shift(); };

    if (a.type === 'rematch') {
      if (s.phase !== 'over') throw new Error('Game not finished');
      if (!isHost) throw new Error('Only the host can start a rematch');
      Object.assign(s, this.setup(s.players));
      return;
    }
    if (s.phase !== 'play') throw new Error('Game over');

    if (a.type === 'skip') {
      if (!isHost) throw new Error('Only the host can skip a turn');
      s.drew = null;
      step(s);
      return;
    }

    if (a.type === 'one') {
      if (s.oneOpen !== playerId) throw new Error('Nothing to call right now');
      s.oneOpen = null;
      log(`${me.name} called ONE!`);
      cue(s, 'buzzer');
      return;
    }

    if (a.type === 'catch') {
      if (!s.oneOpen || s.oneOpen === playerId) throw new Error('Nobody to catch');
      const target = s.players.find(p => p.id === s.oneOpen);
      drawCards(s, target, 2);
      s.oneOpen = null;
      log(`${me.name} caught ${target.name}! +2 cards`);
      cue(s, 'cut');
      return;
    }

    if (s.players[s.turn] !== me) throw new Error("It's not your turn");

    if (a.type === 'draw') {
      if (s.drew != null) throw new Error('You already drew — play it or pass');
      drawCards(s, me, 1);
      const card = me.hand[me.hand.length - 1];
      cue(s, 'card');
      if (card && isPlayable(s, card)) {
        s.drew = card.id;
        log(`${me.name} drew a card`);
      } else {
        log(`${me.name} drew and passed`);
        step(s);
      }
      return;
    }

    if (a.type === 'pass') {
      if (s.drew == null) throw new Error('Draw a card first');
      s.drew = null;
      log(`${me.name} passed`);
      step(s);
      return;
    }

    if (a.type === 'play') {
      const card = me.hand.find(c => c.id === Number(a.card));
      if (!card) throw new Error('Pick a card from your hand');
      if (s.drew != null && card.id !== s.drew) throw new Error('You can only play the card you drew');
      if (!isPlayable(s, card)) throw new Error('That card does not match');
      if (card.c === 'wild' && !COLORS.includes(a.color)) throw new Error('Choose a colour');

      me.hand = me.hand.filter(c => c !== card);
      s.pile.push(s.top);
      s.top = card;
      s.color = card.c === 'wild' ? a.color : card.c;
      s.drew = null;
      s.plays++;
      // a new play means nobody can be caught for an earlier one, except the player who just played
      s.oneOpen = me.hand.length === 1 ? me.id : null;
      cue(s, 'card');

      if (!me.hand.length) {
        s.phase = 'over';
        s.winnerId = me.id;
        s.oneOpen = null;
        cue(s, 'win');
        return;
      }

      const n = s.players.length;
      if (card.v === 'reverse') {
        s.dir *= -1;
        log(`${me.name} reversed the direction!`);
        step(s, n === 2 ? 2 : 1); // with two players a reverse acts like a skip
      } else if (card.v === 'skip') {
        step(s);
        log(`${s.players[s.turn].name} was skipped!`);
        step(s);
      } else if (card.v === '+2' || card.v === '+4') {
        step(s);
        const victim = s.players[s.turn];
        drawCards(s, victim, card.v === '+2' ? 2 : 4);
        log(`${victim.name} draws ${card.v.slice(1)} and misses a turn!`);
        cue(s, 'cut');
        step(s);
      } else {
        step(s);
      }
      return;
    }

    throw new Error('Unknown action');
  },

  view(s, playerId) {
    const me = s.players.find(p => p.id === playerId);
    const myTurn = s.phase === 'play' && s.players[s.turn] === me;
    return {
      phase: s.phase,
      turnId: s.phase === 'over' ? null : s.players[s.turn].id,
      top: s.top,
      color: s.color,
      dir: s.dir,
      plays: s.plays,
      drew: myTurn ? s.drew : null,
      myHand: me ? me.hand : [],
      playable: myTurn ? me.hand.filter(c => (s.drew == null || c.id === s.drew) && isPlayable(s, c)).map(c => c.id) : [],
      oneOpen: s.oneOpen,
      deckCount: s.deck.length,
      winnerId: s.winnerId,
      log: s.log,
      players: s.players.map(p => ({ id: p.id, name: p.name, count: p.hand.length })),
    };
  },
};
