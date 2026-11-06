// Every turn-based game must be able to carry on when a player has gone.
const test = require('node:test');
const assert = require('node:assert');
const games = require('../games');

const P = ['A', 'B', 'C', 'D'].map((name, i) => ({ id: 'p' + i, name }));
const guest = { isHost: false };

for (const id of ['ludo', 'snakes', 'colorclash', 'ashtachamma', 'leastcount']) {
  test(`${id}: skipping a gone player's turn moves to the next player`, () => {
    const g = games[id];
    const players = P.slice(0, 3);
    const s = g.setup(players);
    const current = () => g.view(s, 'p1').turnId;
    const stuck = current();
    assert.strictEqual(g.absentBlock(s, []), null, 'nobody has gone');
    assert.strictEqual(g.absentBlock(s, players.map(p => p.id).filter(x => x !== stuck)), null, 'only the current player blocks');
    assert.strictEqual(g.absentBlock(s, [stuck]), stuck);
    g.skipAbsent(s, stuck);
    assert.notStrictEqual(current(), stuck);
  });
}

for (const id of ['connect4', 'dadi']) {
  test(`${id}: two-player game passes the turn to the player still here`, () => {
    const g = games[id];
    const s = g.setup(P.slice(0, 2));
    const stuck = g.view(s, 'p1').turnId;
    assert.strictEqual(g.absentBlock(s, [stuck]), stuck);
    g.skipAbsent(s, stuck);
    assert.notStrictEqual(g.view(s, 'p1').turnId, stuck);
  });
}

for (const id of ['sequence', 'rummy']) {
  test(`${id}: a gone player drops out of the round; the last one left wins it`, () => {
    const g = games[id];
    const s = g.setup(P.slice(0, 3));
    let stuck = g.view(s, 'p0').turnId;
    assert.strictEqual(g.absentBlock(s, [stuck]), stuck);
    g.skipAbsent(s, stuck);
    assert.strictEqual(s.players.find(p => p.id === stuck).out, true);
    assert.ok(s.roundPoints[stuck] > 0);
    stuck = g.view(s, 'p0').turnId;
    g.skipAbsent(s, stuck);
    assert.notStrictEqual(s.phase, 'play', 'only one player left, so the round ends');
  });
}

test('leastcount: skipping mid-turn keeps the cards correct', () => {
  const g = games.leastcount;
  const s = g.setup(P.slice(0, 3));
  const stuck = s.players[s.turn];
  const count = stuck.hand.length;
  g.action(s, stuck.id, { type: 'throw', cards: [stuck.hand[0]] }, guest);
  g.skipAbsent(s, stuck.id);
  assert.strictEqual(stuck.hand.length, count);
  assert.strictEqual(s.phase, 'throw');
  assert.strictEqual(s.pending, null);
});

test('bingo: a gone player gets a random board, then their turns can be skipped', () => {
  const g = games.bingo;
  const s = g.setup(P.slice(0, 2));
  g.action(s, 'p0', { type: 'ready', board: Array.from({ length: 25 }, (_, i) => i + 1) }, guest);
  assert.strictEqual(g.absentBlock(s, ['p1']), 'p1');
  g.skipAbsent(s, 'p1');
  assert.strictEqual(s.phase, 'play');
  assert.deepStrictEqual([...s.players[1].board].sort((a, b) => a - b), Array.from({ length: 25 }, (_, i) => i + 1));
  s.turn = 1;
  assert.strictEqual(g.absentBlock(s, ['p1']), 'p1');
  g.skipAbsent(s, 'p1');
  assert.strictEqual(s.turn, 0);
});

test('show: words, passing and the race all carry on without a gone player', () => {
  const g = games.show;
  const s = g.setup(P.slice(0, 3));
  g.action(s, 'p0', { type: 'word', word: 'mango' }, guest);
  g.action(s, 'p1', { type: 'word', word: 'tiger' }, guest);
  assert.strictEqual(g.absentBlock(s, ['p2']), 'p2');
  g.skipAbsent(s, 'p2');
  assert.strictEqual(s.phase, 'pass');
  for (const id of ['p0', 'p1']) g.action(s, id, { type: 'pick', chit: s.players.find(p => p.id === id).hand[0].id }, guest);
  const before = s.passes;
  assert.strictEqual(g.absentBlock(s, ['p2']), 'p2');
  g.skipAbsent(s, 'p2');
  assert.strictEqual(s.passes, before + 1, 'the chits moved round');
  s.phase = 'race';
  s.raceStart = Date.now();
  s.ranking = [{ id: 'p0', ms: 0 }];
  assert.strictEqual(g.absentBlock(s, ['p2']), null, 'p1 can still press SHOW');
  s.ranking.push({ id: 'p1', ms: 5 });
  assert.strictEqual(g.absentBlock(s, ['p2']), 'p2');
  g.skipAbsent(s, 'p2');
  assert.notStrictEqual(s.phase, 'race');
});

test('ramsita: a gone player takes a chit, and a gone Ramudu guesses at random', () => {
  const g = games.ramsita;
  const s = g.setup(P.slice(0, 4));
  for (const id of ['p0', 'p1', 'p2']) g.action(s, id, { type: 'pick', index: s.chits.findIndex(c => !c.takenBy) }, guest);
  assert.strictEqual(g.absentBlock(s, ['p3']), 'p3');
  g.skipAbsent(s, 'p3');
  assert.strictEqual(s.phase, 'guess');
  const ram = s.chits.find(c => c.role.key === 'ramudu').takenBy;
  assert.strictEqual(g.absentBlock(s, [ram]), ram);
  g.skipAbsent(s, ram);
  assert.notStrictEqual(s.phase, 'guess');
});
