// Rules for Doodle Telephone and the Typing Arena battle modes.
const test = require('node:test');
const assert = require('node:assert');
const { telephone, typing, ludo } = require('../games');

const P = ['A', 'B', 'C', 'D', 'E'].map((name, i) => ({ id: 'p' + i, name }));
const guest = { isHost: false }, host = { isHost: true };
const IMG = 'data:image/jpeg;base64,AAAA';

const submitAll = (s, players) => {
  for (const p of players) {
    const v = telephone.view(s, p.id);
    telephone.action(s, p.id, v.kind === 'draw' ? { type: 'submit', image: IMG } : { type: 'submit', text: `${v.kind} by ${p.name}` }, guest);
  }
};

test('telephone: rounds alternate write, draw, describe and each chain visits every player', () => {
  const players = P.slice(0, 4);
  const s = telephone.setup(players, { time: 60 });
  assert.strictEqual(s.drawMs, 60000);
  const kinds = [];
  for (let r = 0; r < players.length; r++) {
    kinds.push(telephone.view(s, 'p0').kind);
    submitAll(s, players);
  }
  assert.deepStrictEqual(kinds, ['write', 'draw', 'describe', 'draw']);
  assert.strictEqual(s.phase, 'reveal');
  for (const chain of s.chains) {
    assert.strictEqual(chain.length, players.length);
    assert.strictEqual(new Set(chain.map(e => e.by)).size, players.length, 'nobody works on the same chain twice');
  }
});

test('telephone: you get the previous step of the chain, passed from the player before you', () => {
  const players = P.slice(0, 3);
  const s = telephone.setup(players);
  submitAll(s, players);
  // p1 draws what p0 wrote; p0 draws what p2 wrote
  assert.strictEqual(telephone.view(s, 'p1').prompt.text, 'write by A');
  assert.strictEqual(telephone.view(s, 'p0').prompt.text, 'write by C');
  submitAll(s, players);
  // p2 describes the drawing p1 made
  const prompt = telephone.view(s, 'p2').prompt;
  assert.strictEqual(prompt.type, 'image');
  assert.strictEqual(s.chains[prompt.chain][prompt.step].by, 'p1');
});

test('telephone: drawings are only given to the right player, then after the reveal reaches them', () => {
  const players = P.slice(0, 3);
  const s = telephone.setup(players);
  submitAll(s, players);
  submitAll(s, players);
  const { chain, step } = telephone.view(s, 'p2').prompt;
  assert.strictEqual(telephone.action(s, 'p2', { type: 'image', chain, step }, guest).image, IMG);
  assert.strictEqual(telephone.action(s, 'p2', { type: 'image', chain, step }, guest).quiet, true);
  assert.throws(() => telephone.action(s, 'p0', { type: 'image', chain, step }, guest), /Not yet/);
  assert.strictEqual(telephone.view(s, 'p0').prompt.image, undefined, 'drawings never travel in normal updates');
});

test('telephone: only real pictures are accepted', () => {
  const players = P.slice(0, 3);
  const s = telephone.setup(players);
  submitAll(s, players);
  for (const bad of ['', 'javascript:alert(1)', 'data:text/html;base64,AAAA', 'data:image/svg+xml;base64,AAAA', `data:image/jpeg;base64,${'A'.repeat(800000)}`]) {
    assert.throws(() => telephone.action(s, 'p0', { type: 'submit', image: bad }, guest), /could not be sent/);
  }
});

test('telephone: running out of time fills the gaps and moves on', () => {
  const players = P.slice(0, 3);
  const s = telephone.setup(players);
  telephone.action(s, 'p0', { type: 'submit', text: 'hello' }, guest);
  telephone.onTimer(s);
  assert.strictEqual(s.round, 1);
  assert.ok(s.chains[1][0].text.length > 0);
  telephone.onTimer(s);
  assert.strictEqual(s.chains[0][1].image, null, 'a missing drawing stays blank');
  assert.strictEqual(telephone.view(s, 'p2').prompt.empty, true);
});

test('telephone: you can edit until the round ends; only the host runs the reveal', () => {
  const players = P.slice(0, 3);
  const s = telephone.setup(players);
  telephone.action(s, 'p0', { type: 'submit', text: 'first' }, guest);
  telephone.action(s, 'p0', { type: 'unsubmit' }, guest);
  telephone.action(s, 'p0', { type: 'submit', text: 'second' }, guest);
  assert.strictEqual(s.chains[0][0].text, 'second');
  telephone.action(s, 'p1', { type: 'submit', text: 'x' }, guest);
  telephone.action(s, 'p2', { type: 'submit', text: 'y' }, guest);
  submitAll(s, players);
  submitAll(s, players);
  assert.strictEqual(s.phase, 'reveal');
  assert.throws(() => telephone.action(s, 'p1', { type: 'next' }, guest), /host/);
  assert.strictEqual(telephone.view(s, 'p1').reveal.entries.length, 1);
  let n = 0;
  while (s.phase === 'reveal') { telephone.action(s, 'p0', { type: 'next' }, host); n++; }
  assert.strictEqual(n, 3 * 3, 'every step of every chain');
  assert.strictEqual(telephone.view(s, 'p1').reveal.entries.length, 3);
  telephone.action(s, 'p0', { type: 'rematch' }, host);
  assert.strictEqual(s.phase, 'round');
  assert.strictEqual(s.gameNo, 2);
});

/* ---------- battle modes ---------- */
function battle(mode, n = 2) {
  const s = typing.setup(P.slice(0, n));
  P.slice(0, n).forEach(p => typing.action(s, p.id, { type: 'vote', mode }, guest));
  assert.strictEqual(s.phase, 'countdown');
  typing.onTimer(s);
  assert.strictEqual(s.phase, 'play');
  return s;
}
const nextWord = (s, id) => typing.view(s, id).battle.myWords[0];
const hit = (s, id) => typing.action(s, id, { type: 'strike', text: nextWord(s, id) }, guest);

test("kings: one player each side, words strike the enemy, longer words hit harder", () => {
  const s = battle('kings', 2);
  assert.deepStrictEqual(s.b.sides, { a: ['p0'], b: ['p1'] });
  const before = s.b.hp.b;
  s.b.words.p0 = ['dog', 'tiger', 'keyboard', 'lightning'];
  hit(s, 'p0');
  assert.strictEqual(before - s.b.hp.b, 7);
  assert.strictEqual(s.b.events.at(-1).type, 'sword');
  hit(s, 'p0');
  assert.strictEqual(s.b.events.at(-1).type, 'arrows');
  hit(s, 'p0');
  assert.strictEqual(s.b.events.at(-1).type, 'fire');
  hit(s, 'p0');
  assert.strictEqual(s.b.events.at(-1).type, 'bolt');
  assert.strictEqual(s.b.hp.a, s.b.max.a, 'your own king is untouched');
});

test('kings: wrong spelling does nothing and sends no update', () => {
  const s = battle('kings');
  const r = typing.action(s, 'p0', { type: 'strike', text: 'zzzz' }, guest);
  assert.strictEqual(r.quiet, true);
  assert.strictEqual(s.b.hp.b, s.b.max.b);
});

test('kings: five words in a row call a meteor; a typo resets the streak', () => {
  const s = battle('kings');
  for (let i = 0; i < 4; i++) hit(s, 'p0');
  typing.stream(s, 'p0', { t: 'm' });
  assert.strictEqual(s.b.streak.p0, 0);
  for (let i = 0; i < 4; i++) { hit(s, 'p0'); assert.notStrictEqual(s.b.events.at(-1).type, 'meteor'); }
  hit(s, 'p0');
  assert.strictEqual(s.b.events.at(-1).type, 'meteor');
  assert.strictEqual(s.b.events.at(-1).dmg, 28);
});

test('kings: a KO ends the battle with damage rankings', () => {
  const s = battle('kings', 2);
  s.b.hp.b = 3;
  hit(s, 'p0');
  assert.strictEqual(s.phase, 'ko');
  assert.strictEqual(s.b.winner, 'a');
  assert.strictEqual(typing.view(s, 'p1').battle.winner, 'a');
  typing.onTimer(s);
  assert.strictEqual(s.phase, 'over');
  assert.strictEqual(s.results[0].id, 'p0');
  assert.strictEqual(s.results[0].side, 'a');
});

test('kings: time up gives the win to the healthier king', () => {
  const s = battle('kings');
  s.b.hp.a = 10;
  s.b.endAt = 0;
  typing.onTimer(s);
  assert.strictEqual(s.phase, 'ko');
  assert.strictEqual(s.b.winner, 'b');
});

test('kings: playing alone, the enemy king fights back', () => {
  const s = battle('kings', 1);
  assert.strictEqual(s.b.cpu, true);
  const before = s.b.hp.a;
  s.b.nextHit = 1;
  typing.onTimer(s);
  assert.strictEqual(s.b.hp.a, before - 6);
  assert.ok(s.b.nextHit > 1);
});

test('raid: everyone is on one side, bosses fight back, three bosses must fall', () => {
  const s = battle('raid', 3);
  assert.strictEqual(s.b.sides.a.length, 3);
  assert.strictEqual(typing.view(s, 'p0').battle.boss.art, 'leonix');
  s.b.nextHit = 1;
  typing.onTimer(s);
  assert.strictEqual(s.b.hp.a, 93);
  for (let i = 0; i < 2; i++) {
    s.b.hp.b = 1;
    hit(s, 'p1');
    assert.strictEqual(s.b.boss, i + 1);
    assert.strictEqual(s.b.hp.b, s.b.max.b, 'the next boss arrives at full health');
    assert.strictEqual(s.phase, 'play');
  }
  s.b.hp.b = 1;
  hit(s, 'p2');
  assert.strictEqual(s.phase, 'ko');
  assert.strictEqual(s.b.winner, 'a');
});

test('raid: the party falls at zero health or when time runs out', () => {
  let s = battle('raid', 2);
  s.b.hp.a = 1;
  s.b.nextHit = 1;
  typing.onTimer(s);
  assert.strictEqual(s.b.winner, 'b');
  s = battle('raid', 2);
  s.b.endAt = 0;
  typing.onTimer(s);
  assert.strictEqual(s.b.winner, 'b');
});

test('kings: only two players can battle; three or more cannot choose it', () => {
  const s = typing.setup(P.slice(0, 3));
  assert.throws(() => typing.action(s, 'p0', { type: 'vote', mode: 'kings' }, guest), /2 players only/);
  typing.action(s, 'p0', { type: 'vote', mode: 'raid' }, guest);
  assert.strictEqual(s.votes.p0, 'raid');
});

test('kings are dealt automatically: different for each player, and raid bosses stay out of the party', () => {
  const s = battle('kings', 2);
  const v = typing.view(s, 'p0').battle.heroes;
  assert.ok(v.p0 && v.p1);
  assert.notStrictEqual(v.p0, v.p1);
  assert.notStrictEqual(s.b.cpuHero, v.p0);
  assert.throws(() => typing.action(s, 'p0', { type: 'champ', hero: 'lupus' }, guest), /Unknown action/, 'there is no picker');
  for (let i = 0; i < 30; i++) {
    const r = battle('raid', 4);
    const heroes = Object.values(r.b.heroes);
    assert.strictEqual(new Set(heroes).size, 4);
    assert.ok(!heroes.some(h => ['leonix', 'crimson', 'mortis'].includes(h)));
  }
});

test('kings: each hit carries a random attack, shared with everyone, and damage still follows the word', () => {
  const s = battle('kings', 2);
  const seen = new Set();
  s.b.max.b = s.b.hp.b = 100000;
  s.b.words.p0 = ['dog'];
  for (let i = 0; i < 40; i++) {
    typing.stream(s, 'p0', { t: 'm' }); // keeps the streak off the ultimate
    const before = s.b.hp.b;
    hit(s, 'p0');
    assert.strictEqual(before - s.b.hp.b, 7);
    seen.add(s.b.events.at(-1).pick);
  }
  assert.ok([...seen].every(n => n >= 0 && n < 4));
  assert.ok(seen.size > 1, 'attacks vary');
  assert.strictEqual(typing.view(s, 'p1').battle.events.at(-1).pick, s.b.events.at(-1).pick);
});

test('battles happen on different backgrounds, and both players see the same one', () => {
  const seen = new Set();
  for (let i = 0; i < 120; i++) {
    const s = battle('kings', 2);
    assert.strictEqual(typing.view(s, 'p0').battle.scene, typing.view(s, 'p1').battle.scene);
    seen.add(s.b.scene);
  }
  assert.strictEqual(seen.size, 6);
});

test('ludo: the skip option is gone', () => {
  const s = ludo.setup(P.slice(0, 2));
  assert.throws(() => ludo.action(s, 'p0', { type: 'skip' }, host), /Unknown action/);
});
