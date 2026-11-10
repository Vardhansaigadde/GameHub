// Hand Cricket: pick 1 to 6; the same number as the bowler is out.
const test = require('node:test');
const assert = require('node:assert');
const { handcricket: hc } = require('../games');

const P = n => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i }));
const host = { isHost: true }, guest = { isHost: false };
const pick = (s, id, n) => hc.action(s, id, { type: 'pick', n }, guest);
// coin, then the toss winner's choice (nobody answers, so they bat), then the first ball
const toPlay = s => { let k = 0; while (s.phase !== 'play' && k++ < 8) hc.onTimer(s); };
// call (nobody calls, so the coin calls for them), then the coin lands
const toChoice = s => { let k = 0; while (s.phase !== 'choice' && s.phase !== 'decided' && k++ < 4) hc.onTimer(s); };
// both players pick; then the result shows and the next ball starts
function ball(s, bat, bowl) {
  if (s.batterId !== 'ai') pick(s, s.batterId, bat); else s.picks.bat = bat;
  if (s.bowlerId !== 'ai') pick(s, s.bowlerId, bowl); else { s.picks.bowl = bowl; hc.skipAbsent(s, s.bowlerId); }
  if (s.picks.bat !== null && s.picks.bowl !== null && !s.gap) hc.skipAbsent(s, s.batterId);
  assert.strictEqual(s.gap, true);
  hc.onTimer(s);
}

test('handcricket: any group from 1 to 8; an odd group gets the computer on the smaller team', () => {
  for (const n of [3, 5, 7]) {
    const s = hc.setup(P(n));
    assert.strictEqual(s.mode, 'teams');
    assert.strictEqual(s.sides.a.length, s.sides.b.length, 'even teams once the computer joins');
    assert.deepStrictEqual(s.sides.b.slice(-1), ['ai'], 'the computer bats and bowls last');
    assert.ok(!s.sides.a.includes('ai'));
    assert.deepStrictEqual([...s.sides.a, ...s.sides.b].filter(id => id !== 'ai').sort(), P(n).map(p => p.id).sort(), 'every player is on a team');
  }
  assert.strictEqual(hc.setup(P(1)).mode, 'ai');
  assert.strictEqual(hc.setup(P(2)).mode, 'duel');
  const s = hc.setup(P(6));
  assert.strictEqual(s.mode, 'teams');
  assert.strictEqual(s.sides.a.length, 3);
  assert.strictEqual(s.sides.b.length, 3);
  assert.deepStrictEqual([...s.sides.a, ...s.sides.b].sort(), P(6).map(p => p.id).sort());
});

test('handcricket: different numbers score, the same number is out, picks stay secret', () => {
  const s = hc.setup(P(2), { overs: 2, wickets: 1 });
  toPlay(s); // toss
  assert.strictEqual(s.phase, 'play');
  const bat = s.batterId, bowl = s.bowlerId;
  assert.throws(() => pick(s, bat, 7), /1 to 6/);
  pick(s, bat, 4);
  assert.strictEqual(hc.view(s, bowl).picked.bat, true);
  assert.ok(!JSON.stringify(hc.view(s, bowl)).includes('"bat":4'), 'the bowler cannot see the number');
  assert.throws(() => pick(s, bat, 5), /already/);
  pick(s, bowl, 2);
  assert.strictEqual(s.inns[0].runs, 4);
  assert.strictEqual(s.stats[bat].runs, 4);
  hc.onTimer(s);
  ball(s, 3, 3);
  assert.strictEqual(s.inns[0].wickets, 1);
  assert.strictEqual(s.stats[bowl].wickets, 1);
  assert.strictEqual(s.phase, 'break', 'one wicket ends the innings');
  assert.deepStrictEqual(s.inns[0].log, [4, 'W']);
});

test('handcricket: the chase ends as soon as the target is passed', () => {
  const s = hc.setup(P(2), { overs: 5 });
  toPlay(s);
  ball(s, 6, 1); ball(s, 2, 2);         // 6 runs, then out
  hc.onTimer(s);                        // innings break over
  assert.strictEqual(s.innings, 2);
  ball(s, 5, 1);
  assert.strictEqual(s.phase, 'play');
  ball(s, 2, 1);                        // 7 > 6
  assert.strictEqual(s.phase, 'over');
  assert.strictEqual(s.winner, s.inns[1].side);
  assert.deepStrictEqual(s.margin, { by: 'wickets', n: 1, balls: 28 });
});

test('handcricket: overs run out, bowlers change every over, a tie is a tie', () => {
  const s = hc.setup(P(4), { overs: 1 });
  toPlay(s);
  const bowlers = new Set();
  for (let b = 0; b < 6; b++) { bowlers.add(s.bowlerId); ball(s, 1, 2); }
  assert.strictEqual(bowlers.size, 1, 'one bowler for the whole over');
  assert.strictEqual(s.phase, 'break');
  assert.strictEqual(s.inns[0].runs, 6);
  hc.onTimer(s);
  for (let b = 0; b < 6; b++) ball(s, 1, 2);
  assert.strictEqual(s.phase, 'over');
  assert.strictEqual(s.winner, null);
});

test('handcricket: in teams every batter gets one life, and team and player totals add up', () => {
  const s = hc.setup(P(4), { overs: 5 });
  toPlay(s);
  const side = s.inns[0].side;
  const first = s.batterId;
  ball(s, 4, 1); ball(s, 3, 3);
  assert.notStrictEqual(s.batterId, first, 'next batter comes in');
  ball(s, 2, 5); ball(s, 6, 6);
  assert.strictEqual(s.phase, 'break', 'both batters out: all out');
  const runs = s.sides[side].reduce((t, id) => t + s.stats[id].runs, 0);
  assert.strictEqual(runs, s.inns[0].runs);
  assert.strictEqual(s.inns[0].runs, 6);
});

test('handcricket: playing the computer works on its own, and timeouts pick for you', () => {
  const s = hc.setup(P(1), { overs: 1 });
  toPlay(s);
  assert.ok(s.sides.b.includes('ai'));
  assert.notStrictEqual(s.picks[s.batterId === 'ai' ? 'bat' : 'bowl'], null, 'the computer picks straight away');
  let guard = 0;
  while (s.phase !== 'over' && guard++ < 100) hc.onTimer(s);
  assert.strictEqual(s.phase, 'over');
  assert.strictEqual(s.inns.length, 2);
  hc.action(s, 'p0', { type: 'rematch' }, host);
  assert.ok(['call', 'toss'].includes(s.phase), 'a rematch starts with a new toss');
  assert.strictEqual(s.overs, 1);
});

test('handcricket: a gone batter or bowler gets a random pick so the game carries on', () => {
  const s = hc.setup(P(2));
  toPlay(s);
  pick(s, s.batterId, 3);
  assert.strictEqual(hc.absentBlock(s, [s.bowlerId]), s.bowlerId);
  hc.skipAbsent(s, s.bowlerId);
  assert.strictEqual(s.gap, true);
});

test('handcricket: a Test match has no overs limit; the innings ends only when everyone is out', () => {
  const s = hc.setup(P(2), { format: 'test', overs: 1, wickets: 2 });
  assert.strictEqual(s.format, 'test');
  assert.strictEqual(s.overs, null, 'overs are ignored in a Test');
  toPlay(s);
  for (let b = 0; b < 20; b++) ball(s, 1, 2);   // 20 balls, well past any overs limit
  assert.strictEqual(s.phase, 'play');
  assert.strictEqual(s.inns[0].runs, 20);
  ball(s, 4, 4);
  assert.strictEqual(s.phase, 'play', 'one wicket down, one to go');
  ball(s, 5, 5);
  assert.strictEqual(s.phase, 'break', 'all out');
  hc.onTimer(s);
  ball(s, 6, 1); ball(s, 6, 1); ball(s, 6, 1); ball(s, 3, 1);
  assert.strictEqual(s.phase, 'over');
  assert.strictEqual(s.margin.balls, null, 'no "balls left" in a Test');
});

test('handcricket: Overs is the default format', () => {
  const s = hc.setup(P(2));
  assert.strictEqual(s.format, 'overs');
  assert.strictEqual(s.overs, 2);
  assert.deepStrictEqual(hc.options.find(o => o.key === 'overs').showIf, { format: 'overs' });
});

test('handcricket: wickets are only offered for 1 or 2 players, and teams ignore them', () => {
  const lives = hc.options.find(o => o.key === 'wickets');
  assert.strictEqual(lives.label, 'Wickets');
  assert.deepStrictEqual(lives.players, [1, 2]);
  const s = hc.setup(P(4), { wickets: 3 });
  toPlay(s);
  assert.strictEqual(s.inns[0].maxWickets, 2, 'a team of 2 is all out after 2 wickets');
});

test('handcricket: the toss winner chooses to bat or bowl; only they can choose', () => {
  const s = hc.setup(P(2));
  assert.strictEqual(s.phase, 'call');
  toChoice(s);
  assert.strictEqual(s.phase, 'choice');
  const winner = s.sides[s.toss][0];
  const loser = s.sides[s.toss === 'a' ? 'b' : 'a'][0];
  assert.strictEqual(hc.view(s, loser).captain, winner);
  assert.throws(() => hc.action(s, loser, { type: 'tossChoice', choice: 'bat' }, guest), /won the toss/);
  hc.action(s, winner, { type: 'tossChoice', choice: 'bowl' }, guest);
  assert.strictEqual(s.phase, 'decided');
  assert.strictEqual(s.choseBat, false);
  hc.onTimer(s);
  assert.strictEqual(s.phase, 'play');
  assert.notStrictEqual(s.inns[0].side, s.toss, 'chose to bowl, so the other side bats');
  assert.strictEqual(s.bowlerId, winner);
});

test('handcricket: teams: the captain of the winning side chooses; a gone captain bats', () => {
  const s = hc.setup(P(4));
  toChoice(s);
  const captain = s.sides[s.toss][0];
  const mate = s.sides[s.toss][1];
  assert.throws(() => hc.action(s, mate, { type: 'tossChoice', choice: 'bowl' }, guest), /decides/);
  assert.strictEqual(hc.absentBlock(s, [captain]), captain);
  hc.skipAbsent(s, captain);
  assert.strictEqual(s.choseBat, true);
  hc.onTimer(s);
  assert.strictEqual(s.inns[0].side, s.toss);
});

test('handcricket: when the computer wins the toss it decides by itself', () => {
  for (let k = 0; k < 30; k++) {
    const s = hc.setup(P(1));
    toChoice(s);
    if (s.sides[s.toss][0] === 'ai') { assert.strictEqual(s.phase, 'decided'); assert.strictEqual(typeof s.choseBat, 'boolean'); return; }
    assert.strictEqual(s.phase, 'choice');
  }
  assert.fail('the computer never won the toss in 30 tries');
});

test('handcricket: one side calls heads or tails; a right call wins the toss', () => {
  for (let k = 0; k < 40; k++) {
    const s = hc.setup(P(2));
    assert.strictEqual(s.phase, 'call');
    const caller = s.caller;
    const other = s.players.find(p => p.id !== caller).id;
    assert.throws(() => hc.action(s, other, { type: 'call', call: 'heads' }, guest), /calls the toss/);
    assert.throws(() => hc.action(s, caller, { type: 'call', call: 'edge' }, guest), /heads or tails/);
    hc.action(s, caller, { type: 'call', call: 'tails' }, guest);
    assert.strictEqual(s.phase, 'toss');
    assert.strictEqual(hc.view(s, other).call, 'tails');
    assert.strictEqual(s.toss, s.coin === 'tails' ? s.callSide : (s.callSide === 'a' ? 'b' : 'a'));
    hc.onTimer(s);
    assert.strictEqual(s.phase, 'choice');
    assert.strictEqual(s.captain, s.sides[s.toss][0]);
  }
});

test('handcricket: a gone caller gets a random call, and the computer calls for itself', () => {
  const s = hc.setup(P(2));
  assert.strictEqual(hc.absentBlock(s, [s.caller]), s.caller);
  hc.skipAbsent(s, s.caller);
  assert.strictEqual(s.phase, 'toss');
  assert.ok(['heads', 'tails'].includes(s.call));
  for (let k = 0; k < 30; k++) {
    const a = hc.setup(P(1));
    if (a.caller === 'ai') { assert.strictEqual(a.phase, 'toss'); return; }
  }
  assert.fail('the computer never called in 30 tries');
});

test('handcricket: with 3 players the computer plays its part in a full match', () => {
  const s = hc.setup(P(3), { format: 'test' }); // till all out, so every batter gets a turn
  let guard = 0;
  while (s.phase !== 'over' && guard++ < 2000) hc.onTimer(s);
  assert.strictEqual(s.phase, 'over');
  const aiSide = s.sides.a.includes('ai') ? 'a' : 'b';
  const st = s.stats.ai;
  assert.ok(st.balls > 0, 'the computer batted');
  assert.strictEqual(s.sides[aiSide].length, 2);
});
