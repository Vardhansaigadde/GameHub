// Sketch Showdown rules and the Draw & Guess word levels and themes.
const test = require('node:test');
const assert = require('node:assert');
const { showdown, pictionary } = require('../games');
const { THEMES } = require('../games/data/draw-words');

const P = ['A', 'B', 'C', 'D'].map((name, i) => ({ id: 'p' + i, name }));
const guest = { isHost: false }, host = { isHost: true };
const IMG = 'data:image/jpeg;base64,AAAA';
const allDraw = (s, players = P) => players.forEach(p => showdown.action(s, p.id, { type: 'submit', image: IMG }, guest));

test('showdown: everyone gets the same sentence, drawings stay hidden until the reveal', () => {
  const s = showdown.setup(P);
  assert.strictEqual(showdown.view(s, 'p0').prompt, showdown.view(s, 'p3').prompt);
  showdown.action(s, 'p0', { type: 'submit', image: IMG }, guest);
  assert.throws(() => showdown.action(s, 'p1', { type: 'image', id: 'p0' }, guest), /Not yet/);
  assert.deepStrictEqual(showdown.view(s, 'p1').gallery, []);
  for (const bad of ['', 'javascript:alert(1)', 'data:image/svg+xml;base64,AAAA']) {
    assert.throws(() => showdown.action(s, 'p1', { type: 'submit', image: bad }, guest), /could not be sent/);
  }
  showdown.onTimer(s);
  assert.strictEqual(s.phase, 'vote');
  assert.strictEqual(showdown.action(s, 'p1', { type: 'image', id: 'p0' }, guest).image, IMG);
  assert.strictEqual(showdown.view(s, 'p1').gallery.find(g => g.id === 'p2').empty, true, 'no drawing, shown as blank');
});

test('showdown: the reveal starts as soon as everyone is done', () => {
  const s = showdown.setup(P);
  allDraw(s);
  assert.strictEqual(s.phase, 'vote');
  assert.strictEqual(showdown.view(s, 'p0').gallery.length, 4);
});

test('showdown: you cannot vote for yourself or a blank; votes score points; favourite gets a bonus', () => {
  const s = showdown.setup(P);
  showdown.action(s, 'p0', { type: 'submit', image: IMG }, guest);
  showdown.action(s, 'p1', { type: 'submit', image: IMG }, guest);
  showdown.onTimer(s);
  assert.throws(() => showdown.action(s, 'p0', { type: 'vote', id: 'p0' }, guest), /own/);
  assert.throws(() => showdown.action(s, 'p0', { type: 'vote', id: 'p2' }, guest), /Pick/);
  showdown.action(s, 'p0', { type: 'vote', id: 'p1' }, guest);
  showdown.action(s, 'p1', { type: 'vote', id: 'p0' }, guest);
  showdown.action(s, 'p2', { type: 'vote', id: 'p1' }, guest);
  assert.strictEqual(s.phase, 'vote');
  showdown.action(s, 'p3', { type: 'vote', id: 'p1' }, guest);
  assert.strictEqual(s.phase, 'result');
  assert.strictEqual(s.scores.p1, 350);
  assert.strictEqual(s.scores.p0, 100);
});

test('showdown: rounds use different sentences, only the host moves on, rematch restarts', () => {
  const s = showdown.setup(P, { rounds: 2 });
  const first = s.prompt;
  allDraw(s);
  showdown.onTimer(s);
  assert.throws(() => showdown.action(s, 'p1', { type: 'next' }, guest), /host/);
  showdown.action(s, 'p0', { type: 'next' }, host);
  assert.strictEqual(s.round, 2);
  assert.notStrictEqual(s.prompt, first);
  assert.strictEqual(s.phase, 'draw');
  allDraw(s);
  showdown.onTimer(s);
  showdown.action(s, 'p0', { type: 'next' }, host);
  assert.strictEqual(s.phase, 'over');
  showdown.action(s, 'p0', { type: 'rematch' }, host);
  assert.strictEqual(s.phase, 'draw');
  assert.strictEqual(s.gameNo, 2);
  assert.strictEqual(s.rounds, 2);
});

test('showdown: if nobody drew anything the game does not get stuck on voting', () => {
  const s = showdown.setup(P);
  showdown.onTimer(s);
  assert.strictEqual(s.phase, 'result');
});

const levelWords = (s, level) => s.choices.every(c => Object.values(THEMES).some(t => t[level].includes(c.word)));
function nextRound(s) {
  for (let i = 0; i < s.players.length; i++) {
    s.phase = 'reveal';
    pictionary.onTimer(s);
  }
}

test('draw & guess: words go from easy to hard as rounds pass', () => {
  const s = pictionary.setup(P, { rounds: 3 });
  assert.ok(levelWords(s, 'easy'));
  assert.strictEqual(pictionary.view(s, 'p0').level, 'easy');
  nextRound(s);
  assert.ok(levelWords(s, 'medium'));
  nextRound(s);
  assert.ok(levelWords(s, 'hard'));
  const two = pictionary.setup(P, { rounds: 2 });
  nextRound(two);
  assert.ok(levelWords(two, 'hard'), 'the last round is always hard');
});

test('draw & guess: mixed gives one word from each theme; one theme gives four from it', () => {
  const mixed = pictionary.setup(P, {});
  assert.deepStrictEqual(mixed.choices.map(c => c.cat).sort(), ['Animal', 'Food', 'Movie', 'Thing']);
  const food = pictionary.setup(P, { theme: 'food' });
  assert.strictEqual(food.choices.length, 4);
  assert.ok(food.choices.every(c => c.cat === 'Food'));
  assert.strictEqual(new Set(food.choices.map(c => c.word)).size, 4);
  assert.strictEqual(pictionary.view(food, 'p0').roundTheme, 'Food');
});

test('draw & guess: "new each round" uses one theme per round and a different one next round', () => {
  const s = pictionary.setup(P, { theme: 'rotate', rounds: 3 });
  const cats = [];
  for (let r = 0; r < 3; r++) {
    const c = new Set(s.choices.map(x => x.cat));
    assert.strictEqual(c.size, 1);
    cats.push([...c][0]);
    if (r < 2) nextRound(s);
  }
  assert.strictEqual(new Set(cats).size, 3);
});

test('draw & guess: a word never repeats in a game until the list runs out, and rematch keeps the theme', () => {
  const s = pictionary.setup(P, { theme: 'animals', rounds: 2 });
  const a = s.choices.map(c => c.word);
  s.phase = 'reveal';
  pictionary.onTimer(s);
  assert.ok(s.choices.every(c => !a.includes(c.word)));
  s.phase = 'over';
  pictionary.action(s, 'p0', { type: 'rematch' }, host);
  assert.strictEqual(s.theme, 'animals');
});
