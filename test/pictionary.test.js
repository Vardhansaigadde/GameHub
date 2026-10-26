// Run with: npm test
const test = require('node:test');
const assert = require('node:assert');
const { pictionary } = require('../games');

const P = ['Khyati', 'Ravi', 'Priya', 'Sita'].map((name, i) => ({ id: 'p' + i, name }));
const host = { isHost: true };

function startTurn() {
  const s = pictionary.setup(P, { rounds: 2, time: 80 });
  pictionary.action(s, 'p0', { type: 'choose', index: 0 }, host);
  return s;
}

test('faster and earlier guesses score more', () => {
  const s = startTurn();
  pictionary.action(s, 'p1', { type: 'guess', text: s.word }, {});
  const first = s.scores.p1;
  assert.ok(first >= 300 && first <= 340, `first instant guess ~340, got ${first}`);
  s.startedAt -= 60000; // 60 of 80 seconds gone
  pictionary.action(s, 'p2', { type: 'guess', text: s.word }, {});
  assert.ok(s.scores.p2 < first, 'a later guess scores less');
});

test('drawer gets 60 per correct guess', () => {
  const s = startTurn();
  pictionary.action(s, 'p1', { type: 'guess', text: s.word }, {});
  pictionary.action(s, 'p2', { type: 'guess', text: s.word }, {});
  assert.strictEqual(s.scores.p0, 120);
});

test('drawer gets a +100 bonus when everyone guesses', () => {
  const s = startTurn();
  for (const id of ['p1', 'p2', 'p3']) pictionary.action(s, id, { type: 'guess', text: s.word }, {});
  assert.strictEqual(s.scores.p0, 3 * 60 + 100);
  assert.strictEqual(s.phase, 'reveal');
  assert.ok(s.feed.some(f => f.kind === 'bonus' && f.pts === 100));
});

test('no bonus if someone misses before time runs out', () => {
  const s = startTurn();
  pictionary.action(s, 'p1', { type: 'guess', text: s.word }, {});
  pictionary.action(s, 'p2', { type: 'guess', text: s.word }, {});
  while (s.phase === 'draw') pictionary.onTimer(s);
  assert.strictEqual(s.scores.p0, 120);
  assert.ok(!s.feed.some(f => f.kind === 'bonus'));
});

test('wrong guesses cost nothing and small typos count', () => {
  const s = startTurn();
  pictionary.action(s, 'p1', { type: 'guess', text: 'definitely wrong' }, {});
  assert.strictEqual(s.scores.p1, 0);
  const typo = s.word.length > 4 ? s.word.slice(0, -1) : s.word;
  pictionary.action(s, 'p1', { type: 'guess', text: typo }, {});
  assert.ok(s.scores.p1 > 0, `"${typo}" should count for "${s.word}"`);
});
