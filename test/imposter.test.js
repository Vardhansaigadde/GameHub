const test = require('node:test');
const assert = require('node:assert');
const games = require('../games');
const WORDS = require('../games/data/imposter-words');

const g = games.imposter;
const P = ['A', 'B', 'C', 'D'].map((name, i) => ({ id: 'p' + i, name }));
const host = { isHost: true };
const guest = { isHost: false };

function newGame(n = 4, opts = {}) {
  const s = g.setup(P.slice(0, n), opts);
  return s;
}
const everyone = s => s.players.map(p => p.id);
const civilians = s => everyone(s).filter(id => id !== s.imposterId);

function toVote(s) {
  if (s.phase === 'word') for (const id of everyone(s)) g.action(s, id, { type: 'seen' }, guest);
  let n = 0;
  while (s.phase === 'clue') {
    const id = s.order[s.turn];
    g.action(s, id, { type: 'clue', text: 'clue' + n++ }, guest);
  }
}

test('imposter: everyone but one gets the same word, and only sees their own', () => {
  const s = newGame();
  const words = everyone(s).map(id => g.view(s, id).myWord);
  const odd = g.view(s, s.imposterId).myWord;
  assert.strictEqual(words.filter(w => w === odd).length, 1);
  assert.notStrictEqual(odd, g.view(s, civilians(s)[0]).myWord);
  const v = g.view(s, 'p0');
  assert.strictEqual(v.result, null);
  assert.ok(!JSON.stringify(v).includes(s.imposterId === 'p0' ? s.civilWord : s.oddWord), 'the other word never reaches a player');
});

test('imposter: word pairs are all two different words', () => {
  for (const pairs of Object.values(WORDS)) for (const [a, b] of pairs) assert.notStrictEqual(a.toLowerCase(), b.toLowerCase());
});

test('imposter: clues go in turn order, then voting starts', () => {
  const s = newGame(3, { clues: 2 });
  for (const id of everyone(s)) g.action(s, id, { type: 'seen' }, guest);
  assert.strictEqual(s.phase, 'clue');
  const wrong = s.order[1];
  assert.throws(() => g.action(s, wrong, { type: 'clue', text: 'hello' }, guest), /not your turn/);
  toVote(s);
  assert.strictEqual(s.phase, 'vote');
  assert.strictEqual(s.clues.length, 6, 'two clues each');
});

test('imposter: a clue cannot be your word, more than one word, or a repeat', () => {
  const s = newGame(3);
  for (const id of everyone(s)) g.action(s, id, { type: 'seen' }, guest);
  const id = s.order[0];
  const mine = id === s.imposterId ? s.oddWord : s.civilWord;
  assert.throws(() => g.action(s, id, { type: 'clue', text: mine.toUpperCase() }, guest), /Don't say your word/);
  assert.throws(() => g.action(s, id, { type: 'clue', text: 'a very long sentence here' }, guest), /one word/);
  g.action(s, id, { type: 'clue', text: 'Tasty' }, guest);
  assert.throws(() => g.action(s, s.order[1], { type: 'clue', text: 'tasty' }, guest), /already said/);
});

test('imposter: catching the imposter scores for everyone who voted for them', () => {
  const s = newGame(4);
  toVote(s);
  const imp = s.imposterId;
  const [c1, c2, c3] = civilians(s);
  g.action(s, c1, { type: 'vote', targetId: imp }, guest);
  g.action(s, c2, { type: 'vote', targetId: imp }, guest);
  g.action(s, c3, { type: 'vote', targetId: c1 }, guest);
  assert.throws(() => g.action(s, imp, { type: 'vote', targetId: imp }, guest), /yourself/);
  g.action(s, imp, { type: 'vote', targetId: c2 }, guest);
  assert.strictEqual(s.phase, 'reveal');
  const r = g.view(s, c1).result;
  assert.strictEqual(r.caught, true);
  assert.strictEqual(r.imposterId, imp);
  assert.strictEqual(s.scores[c1], 100);
  assert.strictEqual(s.scores[c3], 0);
  assert.strictEqual(s.scores[imp], 0);
  assert.strictEqual(g.view(s, c1).myWord, null, 'words are shown through the result now');
});

test('imposter: a tie at the top lets the imposter escape', () => {
  const s = newGame(4);
  toVote(s);
  const imp = s.imposterId;
  const [c1, c2, c3] = civilians(s);
  g.action(s, c1, { type: 'vote', targetId: imp }, guest);
  g.action(s, c2, { type: 'vote', targetId: c3 }, guest);
  g.action(s, c3, { type: 'vote', targetId: c2 }, guest);
  g.action(s, imp, { type: 'vote', targetId: c1 }, guest);
  assert.strictEqual(s.result.caught, false);
  assert.strictEqual(s.scores[imp], 200 + 2 * 25, 'escape bonus plus two fooled players');
});

test('imposter: timers move the game on when nobody acts', () => {
  const s = newGame(3);
  g.onTimer(s);
  assert.strictEqual(s.phase, 'clue');
  g.onTimer(s); g.onTimer(s); g.onTimer(s);
  assert.strictEqual(s.phase, 'vote');
  assert.ok(s.clues.every(c => c.skipped));
  g.onTimer(s);
  assert.strictEqual(s.phase, 'reveal');
  assert.strictEqual(s.result.caught, false, 'no votes: the imposter escapes');
});

test('imposter: a gone player is skipped on their clue turn and their vote', () => {
  const s = newGame(3);
  for (const id of everyone(s)) g.action(s, id, { type: 'seen' }, guest);
  const stuck = s.order[0];
  assert.strictEqual(g.absentBlock(s, []), null);
  assert.strictEqual(g.absentBlock(s, [stuck]), stuck);
  g.skipAbsent(s, stuck);
  assert.notStrictEqual(s.order[s.turn], stuck);
  toVote(s);
  const [a, b, c] = everyone(s);
  g.action(s, a, { type: 'vote', targetId: b }, guest);
  g.action(s, b, { type: 'vote', targetId: a }, guest);
  assert.strictEqual(g.absentBlock(s, [c]), c);
  g.skipAbsent(s, c);
  assert.strictEqual(s.phase, 'reveal');
});

test('imposter: rounds, then game over and a rematch with the same settings', () => {
  const s = newGame(3, { rounds: 3, theme: 'food' });
  for (let r = 1; r <= 3; r++) {
    g.onTimer(s); g.onTimer(s); g.onTimer(s); g.onTimer(s); g.onTimer(s);
    assert.strictEqual(s.phase, 'reveal');
    assert.throws(() => g.action(s, 'p1', { type: 'next' }, guest), /host/);
    g.action(s, 'p0', { type: 'next' }, host);
  }
  assert.strictEqual(s.phase, 'over');
  assert.ok(WORDS.food.flat().includes(s.civilWord));
  g.action(s, 'p0', { type: 'rematch' }, host);
  assert.strictEqual(s.phase, 'word');
  assert.strictEqual(s.rounds, 3);
  assert.strictEqual(s.theme, 'food');
});
