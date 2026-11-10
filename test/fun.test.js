// Funny Fill-in, Story Chain, and Name, Place, Animal, Thing.
const test = require('node:test');
const assert = require('node:assert');
const games = require('../games');

const P = ['A', 'B', 'C', 'D'].map((name, i) => ({ id: 'p' + i, name }));
const host = { isHost: true }, guest = { isHost: false };
const ids = n => P.slice(0, n).map(p => p.id);

/* ---------- Funny Fill-in ---------- */
const fillin = games.fillin;

test('fillin: answers stay anonymous while voting, and you cannot vote for your own', () => {
  const s = fillin.setup(P.slice(0, 3));
  assert.match(s.prompt, /___/);
  ids(3).forEach((id, i) => fillin.action(s, id, { type: 'answer', text: `answer ${i}` }, guest));
  assert.strictEqual(s.phase, 'vote');
  const v = fillin.view(s, 'p0');
  assert.strictEqual(v.choices.length, 3);
  assert.ok(!JSON.stringify(v.choices).includes('p1'), 'no names in the choices');
  assert.strictEqual(v.choices[v.mine], 'answer 0');
  assert.throws(() => fillin.action(s, 'p0', { type: 'vote', index: v.mine }, guest), /own/);
});

test('fillin: each vote scores 100 and the favourite gets 50 more', () => {
  const s = fillin.setup(P.slice(0, 3));
  ids(3).forEach((id, i) => fillin.action(s, id, { type: 'answer', text: `answer ${i}` }, guest));
  const idx = id => s.order.indexOf(id);
  fillin.action(s, 'p0', { type: 'vote', index: idx('p1') }, guest);
  fillin.action(s, 'p2', { type: 'vote', index: idx('p1') }, guest);
  fillin.action(s, 'p1', { type: 'vote', index: idx('p0') }, guest);
  assert.strictEqual(s.phase, 'reveal');
  assert.strictEqual(s.scores.p1, 250);
  assert.strictEqual(s.scores.p0, 100);
  assert.deepStrictEqual(s.result.winners, ['p1']);
  assert.strictEqual(fillin.view(s, 'p0').result.rows[0].id, 'p1');
});

test('fillin: timers and gone players keep it moving; the best answers are kept for the end', () => {
  const s = fillin.setup(P.slice(0, 3), { rounds: 3 });
  fillin.action(s, 'p0', { type: 'answer', text: 'only me' }, guest);
  fillin.onTimer(s);
  assert.strictEqual(s.phase, 'reveal', 'one answer: nothing to vote on');
  fillin.action(s, 'p0', { type: 'next' }, host);
  ids(2).forEach(id => fillin.action(s, id, { type: 'answer', text: 'x' + id }, guest));
  assert.strictEqual(fillin.absentBlock(s, ['p2']), 'p2');
  fillin.skipAbsent(s, 'p2');
  assert.strictEqual(s.phase, 'vote');
  fillin.action(s, 'p0', { type: 'vote', index: s.order.indexOf('p1') }, guest);
  fillin.onTimer(s);
  assert.strictEqual(s.phase, 'reveal');
  fillin.action(s, 'p0', { type: 'next' }, host);
  fillin.onTimer(s); fillin.onTimer(s);
  fillin.action(s, 'p0', { type: 'next' }, host);
  assert.strictEqual(s.phase, 'over');
  assert.ok(fillin.view(s, 'p0').best.some(b => b.text === 'xp1'));
});

/* ---------- Story Chain ---------- */
const story = games.story;

test('story: everyone writes in every story once, seeing only the line before', () => {
  const s = story.setup(P.slice(0, 3));
  const seen = new Set();
  for (let step = 0; step < 3; step++) {
    for (const id of ids(3)) {
      const v = story.view(s, id);
      seen.add(`${id}:${v.myPrev}`);
      assert.ok(!('stories' in v) || v.stories === null, 'no peeking at whole stories');
      story.action(s, id, { type: 'line', text: `${id} wrote at step ${step}` }, guest);
    }
  }
  assert.strictEqual(s.phase, 'reveal');
  for (const st of s.stories) {
    assert.strictEqual(st.lines.length, 3);
    assert.deepStrictEqual(st.lines.map(l => l.by).sort(), ids(3));
  }
});

test('story: the host reads line by line; laughs score, but not on your own line', () => {
  const s = story.setup(P.slice(0, 3));
  story.onTimer(s); story.onTimer(s);
  ids(3).forEach(id => story.action(s, id, { type: 'line', text: 'a funny line ' + id }, guest));
  assert.strictEqual(s.phase, 'reveal');
  assert.throws(() => story.action(s, 'p0', { type: 'laugh', story: 0, line: 2 }, guest), /Not read out yet|Pick a line/);
  assert.throws(() => story.action(s, 'p1', { type: 'next' }, guest), /host/);
  story.action(s, 'p0', { type: 'next' }, host); story.action(s, 'p0', { type: 'next' }, host); story.action(s, 'p0', { type: 'next' }, host);
  const line = s.stories[0].lines[2];
  const fan = ids(3).find(id => id !== line.by);
  assert.throws(() => story.action(s, line.by, { type: 'laugh', story: 0, line: 2 }, guest), /own/);
  story.action(s, fan, { type: 'laugh', story: 0, line: 2 }, guest);
  assert.strictEqual(s.scores[line.by], 50);
  story.action(s, fan, { type: 'laugh', story: 0, line: 2 }, guest);
  assert.strictEqual(s.scores[line.by], 0, 'tapping again takes it back');
  assert.throws(() => story.action(s, fan, { type: 'laugh', story: 0, line: 0 }, guest), /Pick a line/, 'skipped lines cannot be laughed at');
});

test('story: a gone player is skipped, and the end shows every story', () => {
  const s = story.setup(P.slice(0, 3));
  story.action(s, 'p0', { type: 'line', text: 'hello there' }, guest);
  story.action(s, 'p1', { type: 'line', text: 'general kenobi' }, guest);
  assert.strictEqual(story.absentBlock(s, ['p2']), 'p2');
  story.skipAbsent(s, 'p2');
  assert.strictEqual(s.step, 1);
  story.onTimer(s); story.onTimer(s);
  while (s.phase === 'reveal') story.action(s, 'p0', { type: 'next' }, host);
  assert.strictEqual(s.phase, 'over');
  assert.strictEqual(story.view(s, 'p1').stories.length, 3);
});

/* ---------- Name, Place, Animal, Thing ---------- */
const npat = games.npat;
function writing(n = 3) {
  const s = npat.setup(P.slice(0, n));
  npat.onTimer(s); // the spin lands
  assert.strictEqual(s.phase, 'write');
  return s;
}
const fill = (s, id, words) => ['name', 'place', 'animal', 'thing'].forEach((cat, i) => npat.action(s, id, { type: 'fill', cat, text: words[i] }, guest));

test('npat: STOP only works once all four start with the letter, then everyone gets 3 more seconds', () => {
  const s = writing();
  const L = s.letter;
  fill(s, 'p0', [L + 'ani', L + 'una', 'zebra', L + 'ox']);
  assert.throws(() => npat.action(s, 'p0', { type: 'stop' }, guest), /Fill all four/);
  fill(s, 'p0', [L + 'ani', L + 'una', L + 'eer', L + 'ox']);
  npat.action(s, 'p0', { type: 'stop' }, guest);
  assert.strictEqual(s.stopBy, 'p0');
  assert.ok(s.endsAt - Date.now() <= 3000);
  npat.onTimer(s);
  assert.strictEqual(s.phase, 'check');
});

test('npat: unique answers score 10, shared 5, wrong letter or flagged out 0', () => {
  const s = writing(3);
  const L = s.letter;
  fill(s, 'p0', [L + 'aaa', L + 'bbb', L + 'ccc', 'wrong']);
  fill(s, 'p1', [L + 'aaa', L + 'xyz', L + 'ccc', '']);
  fill(s, 'p2', [L + 'qqq', L + 'bbb', L + 'fake', L + 'ddd']);
  npat.onTimer(s);
  assert.throws(() => npat.action(s, 'p2', { type: 'flag', id: 'p2', cat: 'animal' }, guest), /own/);
  npat.action(s, 'p0', { type: 'flag', id: 'p2', cat: 'animal' }, guest); // 1 of 2 others is enough
  assert.strictEqual(npat.view(s, 'p0').table.p2.animal.out, true);
  npat.action(s, 'p0', { type: 'score' }, host);
  const r = s.roundPoints;
  assert.deepStrictEqual([r.p0.name, r.p0.place, r.p0.animal, r.p0.thing], [5, 5, 5, 0]);
  assert.deepStrictEqual([r.p1.name, r.p1.place, r.p1.animal, r.p1.thing], [5, 10, 5, 0]);
  assert.deepStrictEqual([r.p2.name, r.p2.place, r.p2.animal, r.p2.thing], [10, 5, 0, 10]);
  assert.strictEqual(s.scores.p2, 25);
});

test('npat: rounds use different letters and end in game over', () => {
  const s = npat.setup(P.slice(0, 2), { rounds: 3 });
  const letters = [];
  for (let r = 0; r < 3; r++) {
    letters.push(s.letter);
    npat.onTimer(s); npat.onTimer(s); npat.onTimer(s);
    assert.strictEqual(s.phase, 'result');
    npat.action(s, 'p0', { type: 'next' }, host);
  }
  assert.strictEqual(s.phase, 'over');
  assert.strictEqual(new Set(letters).size, 3);
  assert.strictEqual(npat.view(s, 'p0').letter, s.letter);
});
