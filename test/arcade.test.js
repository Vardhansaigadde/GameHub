// Rules for Typing Arena, Ludo, Color Clash and Four in a Row.
const test = require('node:test');
const assert = require('node:assert');
const { typing, ludo, colorclash, connect4 } = require('../games');

const P = ['A', 'B', 'C', 'D'].map((name, i) => ({ id: 'p' + i, name }));
const host = { isHost: true }, guest = { isHost: false };
const throws = (fn, re) => assert.throws(fn, re);

/* ---------- Typing Arena ---------- */
function typingGame(mode, n = 2) {
  const s = typing.setup(P.slice(0, n));
  typing.action(s, 'p0', { type: 'choose', mode }, host);
  assert.strictEqual(s.phase, 'countdown', 'starts as soon as the host picks');
  typing.onTimer(s);
  assert.strictEqual(s.phase, 'play');
  return s;
}

test('typing: only the host picks the game, and it starts straight away with no votes', () => {
  const s = typing.setup(P.slice(0, 3));
  throws(() => typing.action(s, 'p1', { type: 'choose', mode: 'rain' }, guest), /host/);
  throws(() => typing.action(s, 'p1', { type: 'vote', mode: 'rain' }, guest), /Unknown action/);
  throws(() => typing.action(s, 'p0', { type: 'choose', mode: 'nothing' }, host), /Pick/);
  typing.action(s, 'p0', { type: 'choose', mode: 'rain' }, host);
  assert.strictEqual(s.mode, 'rain');
  assert.strictEqual(s.phase, 'countdown');
});

test('typing race: progress is relayed, finishing needs the real text, fastest ranks first', () => {
  const s = typingGame('race');
  assert.deepStrictEqual(typing.stream(s, 'p1', { t: 'p', n: 5 }), { t: 'p', id: 'p1', n: 5 });
  assert.strictEqual(typing.stream(s, 'p1', { t: 'p', n: 99999 }).n, s.text.length, 'progress is capped');
  throws(() => typing.action(s, 'p0', { type: 'finished', typed: 'nope', acc: 100 }, guest), /finished/);
  typing.action(s, 'p1', { type: 'finished', typed: s.text, acc: 97 }, guest);
  assert.ok(s.timerAt - Date.now() <= 90000, 'the others get a last call');
  typing.action(s, 'p0', { type: 'finished', typed: s.text, acc: 90 }, guest);
  assert.strictEqual(s.phase, 'over');
  assert.strictEqual(s.results[0].id, 'p1');
  assert.ok(s.results[0].wpm > 0);
});

test('typing race: time running out ranks unfinished players by progress', () => {
  const s = typingGame('race', 3);
  typing.stream(s, 'p0', { t: 'p', n: 3 });
  typing.stream(s, 'p1', { t: 'p', n: 9 });
  typing.onTimer(s);
  assert.deepStrictEqual(s.results.map(r => r.id), ['p1', 'p0', 'p2']);
});

test('typing race: a real paragraph, and places go in the order cars reach the finish', () => {
  const s = typingGame('race', 4);
  assert.ok(s.text.length > 180, 'long enough to be a paragraph');
  assert.ok(s.text.split('. ').length >= 2);
  for (const id of ['p2', 'p0', 'p3']) typing.action(s, id, { type: 'finished', typed: s.text, acc: 95 }, guest);
  assert.strictEqual(s.phase, 'play', 'the last car can still finish');
  assert.deepStrictEqual(['p2', 'p0', 'p3'].map(id => s.finished[id].place), [1, 2, 3]);
  typing.stream(s, 'p1', { t: 'p', n: 12 });
  typing.onTimer(s);
  assert.deepStrictEqual(s.results.map(r => r.id), ['p2', 'p0', 'p3', 'p1']);
});

test('typing duel: mixes words and sentences, and sentences get more time', () => {
  const s = typingGame('duel', 2);
  assert.strictEqual(s.queue.length, 10);
  assert.strictEqual(s.queue.filter(t => t.includes(' ')).length, 4);
  while (s.phase === 'play') {
    const text = s.queue[s.idx];
    const left = s.timerAt - Date.now();
    assert.ok(text.includes(' ') ? left > 15000 : left <= 9000, text);
    assert.strictEqual(typing.view(s, 'p0').duelMs, text.includes(' ') ? 20000 : 9000);
    typing.action(s, 'p0', { type: 'duel', text }, guest);
    typing.action(s, 'p1', { type: 'duel', text }, guest);
    typing.onTimer(s);
  }
  assert.strictEqual(s.scores.p0, 1000);
});

test('typing rain: same schedule for all, scores come in live, ends when everyone is out', () => {
  const s = typingGame('rain');
  assert.ok(s.words.length > 30);
  assert.ok(s.words.every(w => w.x >= 0 && w.x <= 75 && w.fall > 2000));
  assert.ok(s.words.at(-1).fall < s.words[0].fall, 'it speeds up');
  typing.stream(s, 'p0', { t: 's', score: 120, lives: 3 });
  typing.action(s, 'p0', { type: 'rainOut', score: 120 }, guest);
  assert.strictEqual(s.phase, 'play');
  typing.action(s, 'p1', { type: 'rainOut', score: 60 }, guest);
  assert.strictEqual(s.phase, 'over');
  assert.strictEqual(s.results[0].id, 'p0');
});

test('typing duel: exact word scores by order, wrong spelling scores nothing', () => {
  const s = typingGame('duel', 3);
  const word = s.queue[0];
  assert.match(typing.action(s, 'p0', { type: 'duel', text: 'zzz' }, guest).message, /spelling/);
  typing.action(s, 'p1', { type: 'duel', text: word.toUpperCase() }, guest);
  typing.action(s, 'p0', { type: 'duel', text: word }, guest);
  assert.strictEqual(s.scores.p1, 100);
  assert.strictEqual(s.scores.p0, 70);
  typing.action(s, 'p2', { type: 'duel', text: word }, guest);
  assert.strictEqual(s.gap, true, 'word ends when everyone solved it');
  typing.onTimer(s);
  assert.strictEqual(s.idx, 1);
  let guard = 0;
  while (s.phase === 'play' && guard++ < 40) typing.onTimer(s);
  assert.strictEqual(s.phase, 'over');
});

test('typing: play again returns to the vote screen', () => {
  const s = typingGame('duel', 1);
  while (s.phase === 'play') typing.onTimer(s);
  typing.action(s, 'p0', { type: 'again' }, host);
  assert.strictEqual(s.phase, 'pick');
  assert.strictEqual(s.mode, null);
});

/* ---------- Ludo ---------- */
const lroll = (s, id, force) => ludo.action(s, id, { type: 'roll', test: true, force }, guest);

test('ludo: the board path is 57 squares, each seat rotated, ring cells all distinct', () => {
  assert.strictEqual(ludo.PATHS[0].length, 57);
  const ring = new Set(ludo.PATHS[0].slice(0, 51).map(String));
  assert.strictEqual(ring.size, 51);
  assert.deepStrictEqual(ludo.PATHS[1][0], [1, 8]);
  assert.deepStrictEqual(ludo.PATHS[2][0], [8, 13]);
  assert.deepStrictEqual(ludo.PATHS[3][0], [13, 6]);
  // the same physical square has the same ring number from every seat
  for (let seat = 1; seat < 4; seat++) {
    for (let pos = 0; pos <= 50; pos++) {
      const idx = ludo.ringIndex(seat, pos);
      const other = ((idx % 52) + 52) % 52;
      if (other <= 50) assert.deepStrictEqual(ludo.PATHS[seat][pos], ludo.PATHS[0][other]);
    }
  }
});

test('ludo: only a 6 leaves the yard, and a 6 rolls again', () => {
  const s = ludo.setup(P.slice(0, 2));
  lroll(s, 'p0', 3);
  assert.strictEqual(s.turn, 1, 'no move, turn passes');
  lroll(s, 'p1', 6);
  assert.strictEqual(s.phase, 'move');
  ludo.action(s, 'p1', { type: 'move', token: 2 }, guest);
  assert.strictEqual(s.players[1].tokens[2], 0);
  assert.strictEqual(s.turn, 1, 'six rolls again');
  assert.strictEqual(s.phase, 'roll');
});

test('ludo: three sixes in a row lose the turn', () => {
  const s = ludo.setup(P.slice(0, 2));
  s.players[0].tokens[0] = 5;
  for (let i = 0; i < 2; i++) { lroll(s, 'p0', 6); ludo.action(s, 'p0', { type: 'move', token: 0 }, guest); }
  const before = s.players[0].tokens[0];
  lroll(s, 'p0', 6);
  assert.strictEqual(s.turn, 1);
  assert.strictEqual(s.players[0].tokens[0], before);
});

test('ludo: landing on an opponent captures and rolls again, safe squares protect', () => {
  const s = ludo.setup(P.slice(0, 2)); // seats 0 and 2
  // seat 2 token on ring 30 = its pos 4; seat 0 at pos 28 rolls 2
  s.players[1].tokens[0] = 4;
  s.players[0].tokens[0] = 28;
  lroll(s, 'p0', 2);
  ludo.action(s, 'p0', { type: 'move', token: 0 }, guest);
  assert.strictEqual(s.players[1].tokens[0], -1, 'captured');
  assert.strictEqual(s.turn, 0, 'capture rolls again');

  const t = ludo.setup(P.slice(0, 2));
  t.players[1].tokens[0] = 0;                 // on its start square: ring 26, safe
  t.players[0].tokens[0] = 24;
  lroll(t, 'p0', 2);
  ludo.action(t, 'p0', { type: 'move', token: 0 }, guest);
  assert.strictEqual(t.players[1].tokens[0], 0, 'safe square');
});

test('ludo: home needs the exact roll and all four win', () => {
  const s = ludo.setup(P.slice(0, 2));
  s.players[0].tokens = [55, 56, 56, 56];
  lroll(s, 'p0', 3);
  assert.strictEqual(s.turn, 1, 'overshoot: no move');
  s.turn = 0;
  s.phase = 'roll';
  lroll(s, 'p0', 1);
  ludo.action(s, 'p0', { type: 'move', token: 0 }, guest);
  assert.strictEqual(s.phase, 'over');
  assert.strictEqual(s.winnerId, 'p0');
});

/* ---------- Color Clash ---------- */
function clash(n = 3) {
  const s = colorclash.setup(P.slice(0, n));
  s.top = { id: 900, c: 'red', v: '5' };
  s.color = 'red';
  return s;
}
const card = (id, c, v) => ({ id, c, v });

test('clash: deck is 108 cards and every player gets 7', () => {
  const s = colorclash.setup(P.slice(0, 4));
  const total = s.deck.length + 1 + s.players.reduce((t, p) => t + p.hand.length, 0);
  assert.strictEqual(total, 108);
  assert.ok(s.players.every(p => p.hand.length === 7));
  assert.match(s.top.v, /^\d$/);
});

test('clash: must match colour or value; wrong card and wrong turn are refused', () => {
  const s = clash();
  s.players[0].hand = [card(1, 'blue', '7'), card(2, 'red', '9'), card(3, 'blue', '5'), card(4, 'green', '1')];
  throws(() => colorclash.action(s, 'p1', { type: 'draw' }, guest), /your turn/);
  throws(() => colorclash.action(s, 'p0', { type: 'play', card: 1 }, guest), /match/);
  colorclash.action(s, 'p0', { type: 'play', card: 3 }, guest);
  assert.strictEqual(s.color, 'blue', 'matching value changes colour');
  assert.strictEqual(s.turn, 1);
});

test('clash: skip, reverse, +2 and wild +4 do their job', () => {
  let s = clash(3);
  s.players[0].hand = [card(1, 'red', 'skip'), card(9, 'red', '1'), card(8, 'red', '2')];
  colorclash.action(s, 'p0', { type: 'play', card: 1 }, guest);
  assert.strictEqual(s.turn, 2, 'skip');

  s = clash(3);
  s.players[0].hand = [card(1, 'red', 'reverse'), card(9, 'red', '1')];
  colorclash.action(s, 'p0', { type: 'play', card: 1 }, guest);
  assert.strictEqual(s.turn, 2, 'reverse goes the other way');
  assert.strictEqual(s.dir, -1);

  s = clash(2);
  s.players[0].hand = [card(1, 'red', 'reverse'), card(9, 'red', '1')];
  colorclash.action(s, 'p0', { type: 'play', card: 1 }, guest);
  assert.strictEqual(s.turn, 0, 'with two players reverse acts like skip');

  s = clash(3);
  s.players[0].hand = [card(1, 'wild', '+4'), card(9, 'red', '1')];
  const before = s.players[1].hand.length;
  throws(() => colorclash.action(s, 'p0', { type: 'play', card: 1 }, guest), /colour/);
  colorclash.action(s, 'p0', { type: 'play', card: 1, color: 'green' }, guest);
  assert.strictEqual(s.color, 'green');
  assert.strictEqual(s.players[1].hand.length, before + 4);
  assert.strictEqual(s.turn, 2, 'victim misses a turn');
});

test('clash: drawing — a playable card can be played or passed; unplayable passes automatically', () => {
  let s = clash();
  s.players[0].hand = [card(1, 'blue', '7')];
  s.deck.push(card(50, 'green', '2'));
  colorclash.action(s, 'p0', { type: 'draw' }, guest);
  assert.strictEqual(s.turn, 1, 'unplayable draw passes');

  s = clash();
  s.players[0].hand = [card(1, 'red', '7'), card(2, 'blue', '7')];
  s.deck.push(card(50, 'red', '2'));
  colorclash.action(s, 'p0', { type: 'draw' }, guest);
  assert.strictEqual(s.drew, 50);
  throws(() => colorclash.action(s, 'p0', { type: 'play', card: 1 }, guest), /drew/);
  colorclash.action(s, 'p0', { type: 'pass' }, guest);
  assert.strictEqual(s.turn, 1);
});

test('clash: ONE! — call it to be safe, or get caught for +2; empty hand wins', () => {
  const s = clash();
  s.players[0].hand = [card(1, 'red', '7'), card(2, 'red', '8')];
  colorclash.action(s, 'p0', { type: 'play', card: 1 }, guest);
  assert.strictEqual(s.oneOpen, 'p0');
  colorclash.action(s, 'p1', { type: 'catch' }, guest);
  assert.strictEqual(s.players[0].hand.length, 3);
  assert.strictEqual(s.oneOpen, null);

  const t = clash();
  t.players[0].hand = [card(1, 'red', '7'), card(2, 'red', '8')];
  colorclash.action(t, 'p0', { type: 'play', card: 1 }, guest);
  colorclash.action(t, 'p0', { type: 'one' }, guest);
  throws(() => colorclash.action(t, 'p1', { type: 'catch' }, guest), /catch/);
  t.turn = 0;
  t.top = { id: 901, c: 'red', v: '3' };
  colorclash.action(t, 'p0', { type: 'play', card: 2 }, guest);
  assert.strictEqual(t.phase, 'over');
  assert.strictEqual(t.winnerId, 'p0');
});

test('clash: the deck reshuffles from the pile instead of running out', () => {
  const s = clash(2);
  s.deck = [];
  s.pile = [card(70, 'green', '1'), card(71, 'green', '2')];
  s.players[0].hand = [card(1, 'blue', '7')];
  colorclash.action(s, 'p0', { type: 'draw' }, guest);
  assert.strictEqual(s.players[0].hand.length, 2);
});

/* ---------- Four in a Row ---------- */
const drop = (s, id, col) => connect4.action(s, id, { type: 'drop', col }, guest);

test('four in a row: discs stack, full columns are refused, turns alternate', () => {
  const s = connect4.setup(P.slice(0, 2));
  drop(s, 'p0', 3);
  assert.strictEqual(s.board[5][3], 0);
  throws(() => drop(s, 'p0', 3), /your turn/);
  drop(s, 'p1', 3);
  assert.strictEqual(s.board[4][3], 1);
  for (let i = 0; i < 4; i++) drop(s, i % 2 ? 'p1' : 'p0', 3);
  throws(() => drop(s, 'p0', 3), /full/);
});

test('four in a row: vertical, horizontal and diagonal wins', () => {
  let s = connect4.setup(P.slice(0, 2));
  for (const [id, c] of [['p0', 0], ['p1', 1], ['p0', 0], ['p1', 1], ['p0', 0], ['p1', 1], ['p0', 0]]) drop(s, id, c);
  assert.strictEqual(s.winnerId, 'p0');
  assert.strictEqual(s.winLine.length, 4);

  s = connect4.setup(P.slice(0, 2));
  for (const [id, c] of [['p0', 0], ['p1', 0], ['p0', 1], ['p1', 1], ['p0', 2], ['p1', 2], ['p0', 3]]) drop(s, id, c);
  assert.strictEqual(s.winnerId, 'p0');

  s = connect4.setup(P.slice(0, 2));
  for (const [id, c] of [['p0', 0], ['p1', 1], ['p0', 1], ['p1', 2], ['p0', 3], ['p1', 2], ['p0', 2], ['p1', 3], ['p0', 4], ['p1', 3], ['p0', 3]]) drop(s, id, c);
  assert.strictEqual(s.winnerId, 'p0');
});

test('four in a row: rematch lets the other player start', () => {
  const s = connect4.setup(P.slice(0, 2));
  for (const [id, c] of [['p0', 0], ['p1', 1], ['p0', 0], ['p1', 1], ['p0', 0], ['p1', 1], ['p0', 0]]) drop(s, id, c);
  connect4.action(s, 'p0', { type: 'rematch' }, host);
  assert.strictEqual(s.players[0].id, 'p1');
  assert.strictEqual(s.phase, 'play');
});
