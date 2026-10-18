// Sequence: 13 cards each. A joker number is chosen at random but kept hidden —
// you only get to see it after showing a pure sequence (e.g. 5-6-7 of hearts).
// Finish with all 13 cards grouped: sequences (same suit, in a row) plus at most one
// "dummy" set (same number, different suits, 3 or 4 cards). At least one sequence must be pure.
// e.g. 3 + 3 + 3 + 4 all sequences, or three sequences + one dummy.
const { createGame } = require('./rummycore');

module.exports = createGame({
  id: 'sequence',
  name: 'Sequence',
  blurb: 'Rummy with a hidden joker. Show a pure sequence to see it, then finish with sequences and at most one dummy set.',
  minPlayers: 2,
  maxPlayers: 6,
  decks: n => (n <= 2 ? 1 : 2),
  printedJokers: 0,
  hiddenJoker: true,
  rulesText: 'Need: at least 1 pure sequence · rest sequences · at most 1 dummy (same number, different suits, 3 or 4 cards).',
  rules(kinds) {
    if (!kinds.includes('pure')) return 'you need at least one pure sequence';
    if (kinds.filter(k => k === 'set').length > 1) return 'only one dummy set is allowed';
    return null;
  },
});
