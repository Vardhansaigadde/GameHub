// Shared engine for 13-card rummy-style games (Sequence and 13-card Rummy).
// Players hold 13 cards, draw one (deck or open pile) and throw one each turn,
// and arrange their hand into groups. Declare when all 13 cards form valid groups.
//
// Group kinds:
//   pure sequence  - 3+ consecutive cards of one suit, no joker standing in (A-2-3 and Q-K-A ok)
//   sequence       - same, but jokers may fill gaps
//   set ("dummy")  - 3 or 4 cards of the same number in different suits (jokers may fill in)
// Each game passes a `rules` object that decides which mix of groups wins.
const { shuffle, findPlayer } = require('./util');

const HAND = 13;
const MAX_POINTS = 80;
const FIRST_DROP = 20;
const MIDDLE_DROP = 40;
const WRONG_SHOW = 80;

// ---------- cards ----------
// card = { id, r: 1..13 (0 = printed joker), s: 0..3 (-1 = printed joker) }
function makeDeck(decks, printedJokers) {
  const cards = [];
  let id = 0;
  for (let d = 0; d < decks; d++) {
    for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) cards.push({ id: id++, r, s });
  }
  for (let j = 0; j < printedJokers; j++) cards.push({ id: id++, r: 0, s: -1 });
  return shuffle(cards);
}

const cardPoints = (c, wildRank) => (c.r === 0 || c.r === wildRank ? 0 : c.r === 1 || c.r > 10 ? 10 : c.r);

// ---------- group checks ----------
function isPureSequence(cards) {
  if (cards.length < 3 || cards.some(c => c.r === 0)) return false;
  if (!cards.every(c => c.s === cards[0].s)) return false;
  for (const aceHigh of [false, true]) {
    const ranks = cards.map(c => (aceHigh && c.r === 1 ? 14 : c.r)).sort((a, b) => a - b);
    if (ranks.every((r, i) => i === 0 || r === ranks[i - 1] + 1)) return true;
  }
  return false;
}

// wildRank: number rank acting as joker, or null if this player can't use jokers
function isSequence(cards, wildRank) {
  if (cards.length < 3 || cards.length > 13) return false;
  if (isPureSequence(cards)) return true;
  const isWild = c => c.r === 0 || (wildRank != null && c.r === wildRank);
  const real = cards.filter(c => !isWild(c));
  const wilds = cards.length - real.length;
  if (!real.length) return wilds >= 3 && wildRank != null;
  if (!real.every(c => c.s === real[0].s)) return false;
  for (const aceHigh of [false, true]) {
    const ranks = real.map(c => (aceHigh && c.r === 1 ? 14 : c.r)).sort((a, b) => a - b);
    if (ranks.some((r, i) => i > 0 && r === ranks[i - 1])) continue;
    const span = ranks[ranks.length - 1] - ranks[0] + 1;
    if (span - real.length <= wilds && span <= cards.length) return true;
  }
  return false;
}

function isSet(cards, wildRank) {
  if (cards.length < 3 || cards.length > 4) return false;
  const isWild = c => c.r === 0 || (wildRank != null && c.r === wildRank);
  const real = cards.filter(c => !isWild(c));
  if (!real.length) return wildRank != null;
  if (!real.every(c => c.r === real[0].r)) return false;
  return new Set(real.map(c => c.s)).size === real.length;
}

// The most useful label for a group (pure > sequence > set), or 'invalid'.
function classify(cards, wildRank) {
  if (isPureSequence(cards)) return 'pure';
  if (isSequence(cards, wildRank)) return 'sequence';
  if (isSet(cards, wildRank)) return 'set';
  return 'invalid';
}

// ---------- engine ----------
function createGame(cfg) {
  // cfg: { id, name, blurb, minPlayers, maxPlayers, decks(n), printedJokers(n), hiddenJoker, rules(kinds) -> null | error, rulesText }
  const wildFor = (s, p) => (!cfg.hiddenJoker || p.revealed ? s.wildRank : null);

  function groupsOf(p) {
    return p.groups.map(ids => ids.map(id => p.hand.find(c => c.id === id)));
  }

  function normalize(p) {
    // keep groups consistent with the hand: drop missing ids, add new cards to a loose group
    const inHand = new Set(p.hand.map(c => c.id));
    const seen = new Set();
    p.groups = p.groups.map(g => g.filter(id => inHand.has(id) && !seen.has(id) && seen.add(id))).filter(g => g.length);
    const loose = p.hand.filter(c => !seen.has(c.id)).map(c => c.id);
    if (loose.length) p.groups.push(loose);
  }

  function startRound(s) {
    s.round += 1;
    const deck = makeDeck(cfg.decks(s.players.length), cfg.printedJokers);
    // the wild joker card is a random number card turned up under the deck
    let wildIdx = deck.findIndex(c => c.r !== 0);
    s.wildCard = deck.splice(wildIdx, 1)[0];
    s.wildRank = s.wildCard.r;
    for (const p of s.players) {
      p.hand = deck.splice(0, HAND);
      p.groups = [];
      normalize(p);
      p.out = false;
      p.wrongShow = false;
      p.drew = false;
      p.revealed = false;
    }
    s.pile = [deck.pop()];
    s.deck = deck;
    s.turn = (s.round - 1) % s.players.length;
    s.step = 'draw';
    s.phase = 'play'; // play | roundOver | over
    s.result = null;
    s.roundPoints = {};
    s.log = [];
  }

  const log = (s, t) => { s.log.push(t); if (s.log.length > 8) s.log.shift(); };
  const active = s => s.players.filter(p => !p.out);

  function advance(s) {
    if (active(s).length <= 1) return endRound(s, active(s)[0] || null);
    do s.turn = (s.turn + 1) % s.players.length; while (s.players[s.turn].out);
    s.step = 'draw';
  }

  function loserPoints(s, p) {
    const groups = groupsOf(p);
    const kinds = groups.map(g => classify(g, s.wildRank));
    const hasPure = kinds.includes('pure');
    let pts = 0;
    groups.forEach((g, i) => {
      if (hasPure && kinds[i] !== 'invalid') return; // melded cards don't count once you have a pure sequence
      pts += g.reduce((t, c) => t + cardPoints(c, s.wildRank), 0);
    });
    return Math.min(MAX_POINTS, pts);
  }

  function endRound(s, winner) {
    for (const p of s.players) {
      if (p.out) continue; // dropped / wrong-show points were already given
      s.roundPoints[p.id] = p === winner ? 0 : loserPoints(s, p);
    }
    for (const [id, pts] of Object.entries(s.roundPoints)) s.scores[id] += pts;
    s.result = { winnerId: winner ? winner.id : null };
    s.phase = s.round >= s.totalRounds ? 'over' : 'roundOver';
  }

  return {
    id: cfg.id,
    name: cfg.name,
    blurb: cfg.blurb,
    minPlayers: cfg.minPlayers,
    maxPlayers: cfg.maxPlayers,

    setup(players) {
      const s = {
        players: players.map(p => ({ id: p.id, name: p.name, hand: [], groups: [] })),
        scores: Object.fromEntries(players.map(p => [p.id, 0])),
        round: 0,
        totalRounds: 5,
      };
      startRound(s);
      return s;
    },

    action(s, playerId, a, { isHost }) {
      const me = findPlayer(s, playerId);

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
      if (s.phase !== 'play') throw new Error('Round is over');

      if (a.type === 'arrange') {
        // client sends its full grouping; it must contain exactly the cards in hand
        const groups = Array.isArray(a.groups) ? a.groups.map(g => (Array.isArray(g) ? g.map(Number) : [])) : [];
        const flat = groups.flat();
        const ids = new Set(me.hand.map(c => c.id));
        if (flat.length !== me.hand.length || new Set(flat).size !== flat.length || !flat.every(id => ids.has(id))) {
          throw new Error('Arrangement does not match your cards');
        }
        me.groups = groups.filter(g => g.length);
        return;
      }

      if (a.type === 'reveal') {
        if (!cfg.hiddenJoker) throw new Error('The joker is already open');
        if (me.revealed) throw new Error('You already see the joker');
        const g = groupsOf(me)[Number(a.group)];
        if (!g || !isPureSequence(g)) throw new Error('Show a pure sequence (3+ in a row, same suit, no joker)');
        me.revealed = true;
        log(s, `${me.name} showed a pure sequence and can now see the joker`);
        return { message: `The joker is ${['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][s.wildRank]} — those cards are wild for you now` };
      }

      if (me.out) throw new Error('You are out of this round');
      const myTurn = s.players[s.turn].id === playerId;
      if (!myTurn) throw new Error("It's not your turn");

      if (a.type === 'drop') {
        if (s.step !== 'draw') throw new Error('You can only drop before picking a card');
        const pts = me.drew ? MIDDLE_DROP : FIRST_DROP;
        me.out = true;
        s.roundPoints[me.id] = pts;
        log(s, `${me.name} dropped (+${pts})`);
        advance(s);
        return;
      }

      if (a.type === 'draw') {
        if (s.step !== 'draw') throw new Error('You already picked a card');
        let card;
        if (a.from === 'pile') {
          if (!s.pile.length) throw new Error('The open pile is empty');
          card = s.pile.pop();
          log(s, `${me.name} picked the open card`);
        } else {
          if (!s.deck.length) {
            const top = s.pile.pop();
            s.deck = shuffle(s.pile);
            s.pile = top ? [top] : [];
          }
          card = s.deck.pop();
          log(s, `${me.name} picked from the deck`);
        }
        me.hand.push(card);
        me.drew = true;
        normalize(me);
        s.step = 'discard';
        return;
      }

      if (a.type === 'discard' || a.type === 'declare') {
        if (s.step !== 'discard') throw new Error('Pick a card first');
        const card = me.hand.find(c => c.id === Number(a.card));
        if (!card) throw new Error('Choose a card to throw');
        me.hand = me.hand.filter(c => c !== card);
        normalize(me);

        if (a.type === 'discard') {
          s.pile.push(card);
          advance(s);
          return;
        }

        // declare: the thrown card is closed face down; the other 13 must all be grouped
        s.pile.push(card);
        const wild = s.wildRank; // at declaration everyone may use the joker
        const groups = groupsOf(me);
        const kinds = groups.map(g => classify(g, wild));
        let problem = null;
        if (kinds.includes('invalid')) problem = 'some groups are not valid sequences or sets';
        else problem = cfg.rules(kinds, groups);
        if (problem) {
          me.out = true;
          me.wrongShow = true;
          s.roundPoints[me.id] = WRONG_SHOW;
          log(s, `${me.name} made a wrong show (+${WRONG_SHOW}): ${problem}`);
          advance(s);
          return { message: `Wrong show — ${problem}. +${WRONG_SHOW} points.` };
        }
        log(s, `${me.name} declared!`);
        endRound(s, me);
        return;
      }

      throw new Error('Unknown action');
    },

    view(s, playerId) {
      const me = s.players.find(p => p.id === playerId);
      const ended = s.phase !== 'play';
      const myWild = me ? wildFor(s, me) : null;
      const showWild = !cfg.hiddenJoker || ended || (me && me.revealed);
      return {
        phase: s.phase,
        round: s.round,
        totalRounds: s.totalRounds,
        turnId: s.phase === 'play' ? s.players[s.turn].id : null,
        step: s.step,
        hiddenJoker: !!cfg.hiddenJoker,
        rulesText: cfg.rulesText,
        wildCard: showWild ? s.wildCard : null,
        myGroups: me ? groupsOf(me).map(g => ({ cards: g, kind: classify(g, myWild) })) : [],
        myOut: !!(me && me.out),
        myRevealed: !!(me && me.revealed),
        openCard: s.pile.length ? s.pile[s.pile.length - 1] : null,
        deckCount: s.deck.length,
        scores: s.scores,
        roundPoints: ended ? s.roundPoints : null,
        result: s.result,
        log: s.log,
        players: s.players.map(p => ({
          id: p.id,
          name: p.name,
          cardCount: p.hand.length,
          out: p.out,
          wrongShow: !!p.wrongShow,
          revealed: !!p.revealed,
          groups: ended ? groupsOf(p).map(g => ({ cards: g, kind: classify(g, s.wildRank) })) : undefined,
        })),
      };
    },
  };
}

module.exports = { createGame, classify, isPureSequence, isSequence, isSet };
