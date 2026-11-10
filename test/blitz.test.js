// Typing Arena: Word Blitz — the whole group races to type the same word.
const test = require('node:test');
const assert = require('node:assert');
const { typing } = require('../games');

const P = ['A', 'B', 'C', 'D'].map((name, i) => ({ id: 'p' + i, name }));
const host = { isHost: true }, guest = { isHost: false };

function blitz(rounds, n = 3) {
  const s = typing.setup(P.slice(0, n));
  typing.action(s, 'p0', { type: 'choose', mode: 'blitz', rounds }, host);
  typing.onTimer(s); // countdown over
  return s;
}
const word = s => typing.view(s, 'p0').blitz.word;

test('blitz: the host sets any number of rounds, kept between 1 and 100', () => {
  assert.strictEqual(blitz(7).queue.length, 7);
  assert.strictEqual(blitz(250).queue.length, 100);
  assert.strictEqual(blitz(0).queue.length, 1);
  assert.strictEqual(blitz('lots').queue.length, 10, 'nonsense falls back to 10');
  const long = blitz(100).queue;
  for (let i = 1; i < long.length; i++) assert.notStrictEqual(long[i], long[i - 1], 'never the same word twice in a row');
});

test('blitz: needs at least 2 players', () => {
  const s = typing.setup(P.slice(0, 1));
  assert.throws(() => typing.action(s, 'p0', { type: 'choose', mode: 'blitz', rounds: 5 }, host), /at least 2/);
});

test('blitz: everyone sees the same word; the first to type it wins and the round ends', () => {
  const s = blitz(5);
  const w = word(s);
  assert.ok(w);
  assert.strictEqual(typing.view(s, 'p2').blitz.word, w);
  assert.deepStrictEqual(typing.action(s, 'p1', { type: 'blitz', text: w + 'x' }, guest), { message: 'Not quite — check the spelling' });
  typing.action(s, 'p2', { type: 'blitz', text: ` ${w.toUpperCase()} ` }, guest);
  const v = typing.view(s, 'p0').blitz;
  assert.strictEqual(v.gap, true);
  assert.strictEqual(v.word, null, 'the word is hidden between rounds');
  assert.strictEqual(v.last.winner, 'p2');
  assert.strictEqual(s.scores.p2, 100);
  assert.deepStrictEqual(typing.action(s, 'p1', { type: 'blitz', text: w }, guest), { quiet: true }, 'too late');
  assert.strictEqual(s.scores.p1, 0);
});

test('blitz: wins in a row earn a growing bonus; losing a round resets the streak', () => {
  const s = blitz(6);
  const win = id => { typing.action(s, id, { type: 'blitz', text: word(s) }, guest); typing.onTimer(s); };
  win('p1'); win('p1'); win('p1');
  assert.strictEqual(s.scores.p1, 100 + 125 + 150);
  assert.strictEqual(s.streak.p1, 3);
  win('p0');
  assert.strictEqual(s.streak.p1, 0);
  win('p1');
  assert.strictEqual(s.scores.p1, 375 + 100);
});

test('blitz: time running out ends the round with no winner, then the game ends with results', () => {
  const s = blitz(2);
  typing.onTimer(s); // time up
  assert.strictEqual(typing.view(s, 'p0').blitz.last.winner, null);
  typing.onTimer(s); // next word
  typing.action(s, 'p2', { type: 'blitz', text: word(s) }, guest);
  typing.onTimer(s);
  assert.strictEqual(s.phase, 'over');
  assert.strictEqual(s.results[0].id, 'p2');
  assert.strictEqual(s.results[0].wins, 1);
});

test('blitz: typing progress is shared live, clamped to the word', () => {
  const s = blitz(3);
  const out = typing.stream(s, 'p1', { t: 'b', n: 999 });
  assert.deepStrictEqual(out, { t: 'b', id: 'p1', n: word(s).length, i: 0 });
  typing.action(s, 'p1', { type: 'blitz', text: word(s) }, guest);
  assert.strictEqual(typing.stream(s, 'p1', { t: 'b', n: 2 }), null, 'nothing between rounds');
});
