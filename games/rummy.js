// 13-card Rummy (Indian rules): the wild joker is open from the start, plus printed jokers.
// Declare with at least 2 sequences, one of them pure; the rest can be sequences or sets.
const { createGame } = require('./rummycore');

module.exports = createGame({
  id: 'rummy',
  name: '13-Card Rummy',
  blurb: 'Classic Indian rummy. Make 2 sequences (one pure) and sets, then declare. Lowest points win.',
  minPlayers: 2,
  maxPlayers: 6,
  decks: n => (n <= 2 ? 1 : 2),
  printedJokers: 2,
  hiddenJoker: false,
  rulesText: 'Need: at least 2 sequences, 1 of them pure · the rest sequences or sets (same number, different suits).',
  rules(kinds) {
    if (!kinds.includes('pure')) return 'you need at least one pure sequence';
    if (kinds.filter(k => k === 'pure' || k === 'sequence').length < 2) return 'you need at least two sequences';
    return null;
  },
});
