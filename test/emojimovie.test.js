// Emoji Movie Guess: hints appear one at a time in a random order, and make answers worth a little less.
const test = require('node:test');
const assert = require('node:assert');
const { emojimovie } = require('../games');
const CLUES = require('../games/data/emoji-movies');

const P = ['A', 'B', 'C'].map((name, i) => ({ id: 'p' + i, name }));
const guest = { isHost: false };
// a game whose first movie is the one named
const start = title => {
  const s = emojimovie.setup(P);
  s.queue = [CLUES.findIndex(c => c.a[0] === title), s.queue[1]];
  s.idx = -1;
  s.phase = 'reveal';
  emojimovie.onTimer(s); // moves on to the chosen movie
  return s;
};

test('every movie has good hints that never give away the title', () => {
  assert.strictEqual(CLUES.length, 88);
  for (const c of CLUES) {
    assert.ok(c.director, `${c.a[0]} has a director`);
    assert.ok(c.y > 1900, `${c.a[0]} has a year`);
    assert.ok(c.hero || c.heroine, `${c.a[0]} has a lead`);
    for (const value of [c.hero, c.heroine, c.director]) {
      for (const answer of c.a) assert.ok(!String(value || '').toLowerCase().includes(answer.toLowerCase()), `${answer} is in "${value}"`);
    }
  }
});

test('hints appear one at a time, all four kinds are used, then first letters, then time is up', () => {
  const s = start('Hi Nanna');
  const seen = () => emojimovie.view(s, 'p0');
  assert.deepStrictEqual(seen().hints, []);
  assert.strictEqual(seen().hint, '_ _   _ _ _ _ _');
  for (let i = 1; i <= 4; i++) {
    emojimovie.onTimer(s);
    assert.strictEqual(seen().hints.length, i);
    assert.strictEqual(seen().hint, '_ _   _ _ _ _ _', 'no letters yet');
    assert.strictEqual(s.phase, 'clue');
  }
  assert.deepStrictEqual(seen().hints.map(h => h.label).sort(), ['Director', 'Hero', 'Heroine', 'Released']);
  assert.deepStrictEqual(Object.fromEntries(seen().hints.map(h => [h.label, h.value])), { Hero: 'Nani', Heroine: 'Mrunal Thakur', Director: 'Shouryuv', Released: '2023' });
  emojimovie.onTimer(s);
  assert.strictEqual(seen().hint, 'H _   N _ _ _ _');
  emojimovie.onTimer(s);
  assert.strictEqual(s.phase, 'reveal');
  assert.strictEqual(seen().answer, 'Hi Nanna');
  assert.strictEqual(seen().year, 2023);
});

test('the first hint comes at 16 seconds, then one every 8, with 8 seconds left after the letters', () => {
  const s = start('Hi Nanna');
  const due = () => s.timerAt - s.startedAt;
  const times = [due()];
  for (let i = 0; i < 5; i++) {
    emojimovie.onTimer(s);
    times.push(due());
  }
  assert.deepStrictEqual(times, [16000, 24000, 32000, 40000, 48000, 56000]);
  assert.strictEqual(emojimovie.view(s, 'p0').totalMs, 56000);
});

test('the order is random, the same for all players, and a missing fact is simply left out', () => {
  const orders = new Set();
  for (let i = 0; i < 40; i++) {
    const s = start('Hi Nanna');
    for (let h = 0; h < 4; h++) emojimovie.onTimer(s);
    const a = emojimovie.view(s, 'p0').hints, b = emojimovie.view(s, 'p2').hints;
    assert.deepStrictEqual(a, b);
    orders.add(a.map(h => h.label).join());
  }
  assert.ok(orders.size > 3, 'the order changes');
  const noHero = start('Arundhati');
  assert.deepStrictEqual(noHero.hints.map(h => h.label).sort(), ['Director', 'Heroine', 'Released']);
});

test('nothing leaks before it should: no answer, no year, no future hint', () => {
  const s = start('Hi Nanna');
  const before = JSON.stringify(emojimovie.view(s, 'p0'));
  for (const secret of ['Nanna', 'Shouryuv', 'Mrunal', '2023']) assert.ok(!before.includes(secret), secret);
});

test('answering sooner scores more; order still matters; points never fall too low', () => {
  const s = emojimovie.setup(P);
  const answer = () => CLUES[s.queue[s.idx]].a[0];
  emojimovie.action(s, 'p0', { type: 'guess', text: answer() }, guest);
  assert.strictEqual(s.scores.p0, 100, 'no hints yet');
  emojimovie.onTimer(s);
  emojimovie.onTimer(s);
  emojimovie.action(s, 'p1', { type: 'guess', text: answer() }, guest);
  assert.strictEqual(s.scores.p1, 60, 'second place is 80, minus 2 hints');
  s.hint = 6;
  emojimovie.action(s, 'p2', { type: 'guess', text: answer() }, guest);
  assert.strictEqual(s.scores.p2, 20, 'never below the minimum');
  assert.strictEqual(s.phase, 'reveal');
  emojimovie.onTimer(s);
  assert.deepStrictEqual(emojimovie.view(s, 'p0').hints, [], 'the next movie starts with no hints');
});
