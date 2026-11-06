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

const toReveal = players => {
  const s = telephone.setup(players);
  for (let r = 0; r < players.length; r++) submitAll(s, players);
  assert.strictEqual(s.phase, 'reveal');
  return s;
};
const heart = (s, id, chain, step) => telephone.action(s, id, { type: 'heart', chain, step }, guest);
const nextStep = s => telephone.action(s, s.players[0].id, { type: 'next' }, host);
const finish = s => { while (s.phase === 'reveal') nextStep(s); };

test('telephone hearts: only shown entries, never your own, and tapping again takes it back', () => {
  const players = P.slice(0, 3);
  const s = toReveal(players);
  const by = s.chains[0][0].by;
  const other = players.find(p => p.id !== by).id;
  assert.throws(() => heart(s, by, 0, 0), /own/);
  assert.throws(() => heart(s, other, 0, 1), /Not yet/);
  assert.throws(() => heart(s, other, 1, 0), /Not yet/);
  heart(s, other, 0, 0);
  let e = telephone.view(s, other).reveal.entries[0];
  assert.deepStrictEqual([e.hearts, e.myHeart], [1, true]);
  assert.strictEqual(telephone.view(s, by).reveal.entries[0].myHeart, false);
  heart(s, other, 0, 0);
  assert.strictEqual(telephone.view(s, other).reveal.entries[0].hearts, 0);
});

test('telephone hearts: entries nobody made cannot score', () => {
  const players = P.slice(0, 3);
  const s = telephone.setup(players);
  telephone.onTimer(s); telephone.onTimer(s); telephone.onTimer(s);
  assert.strictEqual(s.phase, 'reveal');
  const other = players.find(p => p.id !== s.chains[0][0].by).id;
  assert.throws(() => heart(s, other, 0, 0), /Nothing was added/);
});

test('telephone scores: 100 per heart, top of each story gets 50, funniest moment and winner', () => {
  const players = P.slice(0, 3);
  const s = toReveal(players);
  const a = s.chains[0][0].by;
  const others = players.map(p => p.id).filter(id => id !== a);
  heart(s, others[0], 0, 0);
  heart(s, others[1], 0, 0);
  nextStep(s);
  const b = s.chains[0][1].by;
  heart(s, players.find(p => p.id !== b).id, 0, 1);
  finish(s);
  assert.strictEqual(s.phase, 'over');
  const v = telephone.view(s, a);
  assert.strictEqual(v.scores[a], 250);
  assert.strictEqual(v.scores[b], 100);
  assert.deepStrictEqual([v.funniest.chain, v.funniest.step, v.funniest.by, v.funniest.hearts], [0, 0, a, 2]);
  assert.throws(() => heart(s, others[0], 0, 0), /closed/);
});

test('telephone scores: tied top entries share the bonus; no hearts means no scores; rematch resets', () => {
  const players = P.slice(0, 3);
  const s = toReveal(players);
  const first = s.chains[0][0].by, second = s.chains[0][1].by;
  const third = players.map(p => p.id).find(id => id !== first && id !== second);
  heart(s, third, 0, 0);
  nextStep(s);
  heart(s, third, 0, 1);
  finish(s);
  assert.strictEqual(s.scores[first], 150);
  assert.strictEqual(s.scores[second], 150);
  telephone.action(s, 'p0', { type: 'rematch' }, host);
  assert.deepStrictEqual(s.hearts, {});
  assert.strictEqual(telephone.view(s, 'p0').scores, undefined);

  const quiet = toReveal(players);
  finish(quiet);
  assert.ok(Object.values(quiet.scores).every(n => n === 0));
  assert.strictEqual(telephone.view(quiet, 'p0').funniest, undefined);
});

const LINE = [{ c: '#112233', w: 4, p: [1, 2, 30, 40] }, { f: '#ff0000', x: 5, y: 6 }, { k: 1 }];

test('telephone replay: valid strokes come back with the drawing; bad ones mean no replay, not a lost drawing', () => {
  const players = P.slice(0, 3);
  const s = telephone.setup(players);
  submitAll(s, players);
  const v = telephone.view(s, 'p0');
  telephone.action(s, 'p0', { type: 'submit', image: IMG, strokes: LINE }, guest);
  telephone.action(s, 'p1', { type: 'submit', image: IMG, strokes: [{ c: 'url(x)', w: 4, p: [1, 2] }] }, guest);
  telephone.action(s, 'p2', { type: 'submit', image: IMG, strokes: 'nonsense' }, guest);
  assert.strictEqual(s.chains[v.myChain][1].image, IMG);
  assert.deepStrictEqual(s.chains[v.myChain][1].strokes, LINE);
  const after = telephone.view(s, 'p1').prompt; // p1 now describes what p0 drew
  assert.deepStrictEqual(telephone.action(s, 'p1', { type: 'image', chain: after.chain, step: after.step }, guest).strokes, LINE);
  const bad = s.chains.flat().filter(e => e.type === 'image' && !e.strokes);
  assert.strictEqual(bad.length, 2);
  assert.strictEqual(JSON.stringify(telephone.view(s, 'p1')).includes('strokes'), false, 'strokes never travel in normal updates');
});

test('telephone replay: huge or malformed stroke lists are refused', () => {
  const players = P.slice(0, 3);
  const cases = [
    Array.from({ length: 3001 }, () => ({ k: 1 })),
    [{ c: '#000000', w: 4, p: Array(60002).fill(1) }],
    [{ c: '#000000', w: 999, p: [1, 2] }],
    [{ c: '#000000', w: 4, p: [1, 2, 3] }],
    [{ c: '#000000', w: 4, p: [1, 99999] }],
    [null],
  ];
  for (const strokes of cases) {
    const s = telephone.setup(players);
    submitAll(s, players);
    const c = telephone.view(s, 'p0').myChain;
    telephone.action(s, 'p0', { type: 'submit', image: IMG, strokes }, guest);
    assert.strictEqual(s.chains[c][1].strokes, null);
  }
});

test('telephone sharing: only what has been revealed can be shared', () => {
  const players = P.slice(0, 3);
  const s = telephone.setup(players);
  assert.throws(() => telephone.action(s, 'p0', { type: 'story', chain: 0 }, guest), /Not yet/);
  submitAll(s, players); submitAll(s, players); submitAll(s, players);
  assert.strictEqual(telephone.action(s, 'p1', { type: 'story', chain: 0 }, guest).entries.length, 1);
  assert.throws(() => telephone.action(s, 'p1', { type: 'story', chain: 1 }, guest), /Not yet/);
  telephone.action(s, 'p0', { type: 'next' }, host);
  telephone.action(s, 'p0', { type: 'next' }, host);
  const story = telephone.action(s, 'p1', { type: 'story', chain: 0 }, guest);
  assert.strictEqual(story.quiet, true);
  assert.strictEqual(story.owner, 'p0');
  assert.strictEqual(story.entries.length, 3);
  assert.strictEqual(story.entries[1].image, undefined, 'pictures are fetched separately');
  while (s.phase === 'reveal') telephone.action(s, 'p0', { type: 'next' }, host);
  assert.strictEqual(telephone.action(s, 'p1', { type: 'story', chain: 2 }, guest).entries.length, 3);
});

/* ---------- battle modes ---------- */
function battle(mode, n = 2) {
  const s = typing.setup(P.slice(0, n));
  typing.action(s, 'p0', { type: 'choose', mode }, host);
  assert.strictEqual(s.phase, 'champ');
  typing.onTimer(s); // the clock ends choosing
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
  assert.throws(() => typing.action(s, 'p0', { type: 'choose', mode: 'kings' }, host), /2 players only/);
  assert.throws(() => typing.action(s, 'p0', { type: 'choose', mode: 'royal' }, host), /2 players only/);
  typing.action(s, 'p0', { type: 'choose', mode: 'raid' }, host);
  assert.strictEqual(s.mode, 'raid');
});

test('kings: one player alone cannot choose it either', () => {
  const s = typing.setup(P.slice(0, 1));
  assert.throws(() => typing.action(s, 'p0', { type: 'choose', mode: 'kings' }, host), /2 players only/);
});

test('battles: sentences appear among the words and hit hardest', () => {
  const s = battle('kings', 2);
  const list = s.b.words.p0;
  assert.ok(list.some(t => t.includes(' ')));
  assert.ok(list.filter(t => t.includes(' ')).length < list.length / 2, 'mostly words');
  s.b.words.p0 = ['bring me my golden sword'];
  const before = s.b.hp.b;
  typing.action(s, 'p0', { type: 'strike', text: 'Bring me my golden sword ' }, guest);
  assert.strictEqual(before - s.b.hp.b, 22);
  assert.strictEqual(s.b.typed.p0, 1);
});

test('choosing kings: pick, change your mind, lock in; the battle starts once everyone is locked', () => {
  const s = typing.setup(P.slice(0, 2));
  typing.action(s, 'p0', { type: 'choose', mode: 'kings' }, host);
  assert.throws(() => typing.action(s, 'p0', { type: 'champReady' }, guest), /first/);
  assert.throws(() => typing.action(s, 'p0', { type: 'champ', hero: 'nobody' }, guest), /Pick a king/);
  typing.action(s, 'p0', { type: 'champ', hero: 'florian' }, guest);
  typing.action(s, 'p0', { type: 'champ', hero: 'mortis' }, guest);
  assert.throws(() => typing.action(s, 'p1', { type: 'champ', hero: 'mortis' }, guest), /took that king/);
  typing.action(s, 'p0', { type: 'champReady' }, guest);
  assert.throws(() => typing.action(s, 'p0', { type: 'champ', hero: 'lupus' }, guest), /locked/);
  assert.strictEqual(s.phase, 'champ');
  typing.action(s, 'p1', { type: 'champ', hero: 'florian' }, guest);
  typing.action(s, 'p1', { type: 'champReady' }, guest);
  assert.strictEqual(s.phase, 'countdown');
  assert.deepStrictEqual(typing.view(s, 'p1').battle.heroes, { p0: 'mortis', p1: 'florian' });
});

test('choosing kings: when time runs out, undecided players get different free kings; raid bosses stay out', () => {
  const s = typing.setup(P.slice(0, 2));
  typing.action(s, 'p0', { type: 'choose', mode: 'royal' }, host);
  typing.action(s, 'p0', { type: 'champ', hero: 'gareth' }, guest);
  typing.onTimer(s);
  assert.strictEqual(s.phase, 'countdown');
  assert.strictEqual(s.b.heroes.p0, 'gareth');
  assert.ok(s.b.heroes.p1 && s.b.heroes.p1 !== 'gareth');
  for (let i = 0; i < 30; i++) {
    const r = typing.setup(P.slice(0, 4));
    typing.action(r, 'p0', { type: 'choose', mode: 'raid' }, host);
    assert.throws(() => typing.action(r, 'p0', { type: 'champ', hero: 'mortis' }, guest), /Pick a king/);
    typing.onTimer(r);
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

const royalGame = () => {
  const s = typing.setup(P.slice(0, 2));
  typing.action(s, 'p0', { type: 'choose', mode: 'royal' }, host);
  typing.onTimer(s);
  typing.onTimer(s);
  assert.strictEqual(s.phase, 'play');
  return s;
};
const royalWord = (s, id = 'p0') => typing.view(s, id).battle.royal.word;
const win = (s, id) => {
  typing.action(s, id, { type: 'royalType', text: royalWord(s, id) }, guest);
  if (s.phase === 'play') typing.onTimer(s); // the pause after a strike
};

test('royal duel: both players see the same 3 words then 2 sentences', () => {
  const s = royalGame();
  const seen = [];
  for (let i = 0; i < 5 && s.phase === 'play'; i++) {
    assert.strictEqual(royalWord(s, 'p0'), royalWord(s, 'p1'));
    seen.push(royalWord(s).includes(' '));
    typing.onTimer(s); // nobody typed it
    assert.strictEqual(typing.view(s, 'p0').battle.royal.word, null, 'hidden during the pause');
    typing.onTimer(s);
  }
  assert.deepStrictEqual(seen, [false, false, false, true, true]);
});

test('royal duel: only the first correct answer strikes; a wrong one does nothing', () => {
  const s = royalGame();
  const word = royalWord(s);
  assert.match(typing.action(s, 'p0', { type: 'royalType', text: 'zzzz' }, guest).message, /spelling/);
  assert.strictEqual(s.b.hp.b, 3);
  typing.action(s, 'p1', { type: 'royalType', text: word.toUpperCase() }, guest);
  assert.strictEqual(s.b.hp.a, 2, 'p1 was first, so p0 loses a round');
  assert.strictEqual(typing.action(s, 'p0', { type: 'royalType', text: word }, guest).quiet, true);
  assert.strictEqual(s.b.hp.b, 3, 'too late');
  assert.strictEqual(s.b.events.at(-1).by, 'p1');
  assert.strictEqual(typing.view(s, 'p0').battle.royal.lastWin, 'p1');
});

test('royal duel: first to 3 wins straight away, even 3 rounds in', () => {
  const s = royalGame();
  win(s, 'p0'); win(s, 'p0');
  assert.strictEqual(s.phase, 'play');
  typing.action(s, 'p0', { type: 'royalType', text: royalWord(s) }, guest);
  assert.strictEqual(s.phase, 'ko');
  assert.strictEqual(s.b.winner, 'a');
  assert.strictEqual(s.b.events.at(-1).ult, true, 'the winning blow is the ultimate');
  typing.onTimer(s);
  assert.strictEqual(s.results[0].id, 'p0');
  assert.strictEqual(s.results[0].score, 3);
});

test('royal duel: a close game can go to the fifth round', () => {
  const s = royalGame();
  win(s, 'p0'); win(s, 'p1'); win(s, 'p0'); win(s, 'p1');
  assert.strictEqual(royalWord(s).includes(' '), true);
  typing.action(s, 'p1', { type: 'royalType', text: royalWord(s) }, guest);
  assert.strictEqual(s.b.winner, 'b');
});

test('royal duel: after five rounds the leader wins; level means tie-breaks, then a draw', () => {
  let s = royalGame();
  win(s, 'p0');
  for (let i = 0; i < 4; i++) { typing.onTimer(s); typing.onTimer(s); }
  assert.strictEqual(s.b.winner, 'a');

  s = royalGame();
  for (let i = 0; i < 5; i++) { typing.onTimer(s); typing.onTimer(s); }
  assert.strictEqual(s.phase, 'play');
  assert.strictEqual(typing.view(s, 'p0').battle.royal.round, 6);
  assert.ok(royalWord(s).includes(' '));
  for (let i = 0; i < 3; i++) { typing.onTimer(s); typing.onTimer(s); }
  assert.strictEqual(s.phase, 'ko');
  assert.strictEqual(s.b.winner, null);
  assert.strictEqual(typing.view(s, 'p0').battle.winner, null);
});

test('ludo: the skip option is gone', () => {
  const s = ludo.setup(P.slice(0, 2));
  assert.throws(() => ludo.action(s, 'p0', { type: 'skip' }, host), /Unknown action/);
});
