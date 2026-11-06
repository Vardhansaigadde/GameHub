// Runs the real server and talks to it the way browsers do.
const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { io } = require('socket.io-client');

const PORT = 3977;
const URL = `http://127.0.0.1:${PORT}`;
const wait = ms => new Promise(r => setTimeout(r, ms));
let server;
const clients = [];

function client() {
  const c = io(URL, { forceNew: true, transports: ['websocket'] });
  c.on('state', s => { c.state = s; c.bytes = JSON.stringify(s).length; });
  clients.push(c);
  return new Promise(r => c.on('connect', () => r(c)));
}
const send = (c, ev, data) => new Promise(r => c.emit(ev, data, r));
let n = 0;
async function room(gameId, count) {
  const host = await client();
  const { code } = await send(host, 'create', { name: 'Host', token: `t${++n}`, gameId });
  const others = [];
  for (let i = 0; i < count - 1; i++) {
    const c = await client();
    c.token = `t${++n}`;
    await send(c, 'join', { code, name: `P${i}`, token: c.token });
    others.push(c);
  }
  await wait(40);
  return { host, others, code };
}

test.before(async () => {
  server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT, GONE_GRACE_MS: '150' }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    const up = await fetch(`${URL}/health`).then(r => r.ok).catch(() => false);
    if (up) return;
    await wait(100);
  }
  throw new Error('server did not start');
});
test.after(() => {
  clients.forEach(c => c.close());
  server.kill();
});

test('the Terms and Privacy pages are served and linked from the home page', async () => {
  const home = await fetch(URL).then(r => r.text());
  for (const [page, title] of [['/terms', 'Terms and Conditions'], ['/privacy', 'Privacy Policy']]) {
    const res = await fetch(URL + page);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes(`<h1>${title}</h1>`));
    assert.ok(html.includes('id="legalPage"'), 'the offline copy recognises it');
    assert.ok(home.includes(`href="${page}"`));
  }
});

test('malformed messages cannot crash the server', async () => {
  const { host, others } = await room('ludo', 2);
  const bad = await client();
  for (const ev of ['create', 'join', 'leave', 'selectGame', 'start', 'action', 'endGame', 'kick', 'stream', 'react', 'chat', 'skipAbsent']) {
    for (const payload of [null, undefined, 42, 'x', [], { toString: 1 }, { token: {}, name: { toString: 1 }, text: { toString: 1 }, gameId: ['ludo'] }]) {
      bad.emit(ev, payload);
      host.emit(ev === 'leave' || ev === 'endGame' ? 'react' : ev, payload);
      others[0].emit(ev === 'leave' ? 'react' : ev, payload);
    }
  }
  await wait(250);
  assert.strictEqual(server.exitCode, null, 'still running');
  assert.ok(await fetch(`${URL}/health`).then(r => r.ok));
  const fresh = await client();
  assert.ok((await send(fresh, 'create', { name: 'New', token: 'after-bad' })).code);
});

test('a game picked on the home page opens in the new room; a bad name falls back safely', async () => {
  const a = await client();
  await send(a, 'create', { name: 'A', token: `t${++n}`, gameId: 'ludo' });
  await wait(30);
  assert.strictEqual(a.state.room.gameId, 'ludo');
  const b = await client();
  await send(b, 'create', { name: 'B', token: `t${++n}`, gameId: 'constructor' });
  await wait(30);
  assert.strictEqual(b.state.room.gameId, 'housie');
});

test('a host who leaves mid-game hands over at once, and the new host can run the game', async () => {
  const { host, others } = await room('ludo', 3);
  await send(host, 'start', { options: {} });
  await wait(30);
  const oldHost = others[0].state.room.hostId;
  host.emit('leave');
  await wait(50);
  const now = others[0].state.room.hostId;
  assert.notStrictEqual(now, oldHost);
  assert.strictEqual(now, others[0].state.you);
  others[0].emit('endGame');
  await wait(40);
  assert.strictEqual(others[1].state.game, null);
});

test('a host who drops keeps the role through a quick return, and loses it after the grace period', async () => {
  const quick = await room('ludo', 2);
  const hostId = quick.others[0].state.room.hostId;
  const token = `t${n - 1}`;
  quick.host.close();
  await wait(40);
  const back = await client();
  await send(back, 'join', { code: quick.code, token: `t${n - 1}`, name: 'Host' });
  await wait(250);
  assert.ok(token);
  assert.ok(quick.others[0].state.room.players.some(p => p.id === hostId));

  const slow = await room('ludo', 2);
  const was = slow.others[0].state.room.hostId;
  slow.host.close();
  await wait(50);
  assert.strictEqual(slow.others[0].state.room.hostId, was, 'not yet');
  await wait(250);
  assert.notStrictEqual(slow.others[0].state.room.hostId, was);
});

test('the host can skip a gone player, whose later turns then pass by themselves until they return', async () => {
  const { host, others, code } = await room('ludo', 3);
  await send(host, 'start', { options: {} });
  await wait(30);
  const turnOf = () => host.state.game.turnId;
  const me = host.state.you;
  // keep rolling until it is the turn of the player who will leave
  const ravi = others[0], raviId = ravi.state.you, sita = others[1];
  const byId = id => (id === me ? host : id === raviId ? ravi : sita);
  assert.ok((await send(host, 'skipAbsent', {})).error, 'nobody to skip yet');
  for (let i = 0; i < 40 && turnOf() !== raviId; i++) {
    const g = host.state.game, who = byId(g.turnId);
    if (g.phase === 'roll') await send(who, 'action', { type: 'roll' });
    else await send(who, 'action', { type: 'move', token: who.state.game.legal[0] });
    await wait(5);
  }
  assert.strictEqual(turnOf(), raviId);
  ravi.close();
  await wait(50);
  assert.strictEqual(host.state.game.waitingOn, null, 'grace period first');
  await wait(250);
  assert.strictEqual(host.state.game.waitingOn, raviId);
  assert.ok((await send(sita, 'skipAbsent', {})).error, 'host only');
  await send(host, 'skipAbsent', {});
  await wait(40);
  assert.notStrictEqual(turnOf(), raviId);
  // play on: Ravi's turns never stop the game
  for (let i = 0; i < 30; i++) {
    const g = host.state.game;
    if (g.phase === 'over') break;
    assert.notStrictEqual(g.turnId, raviId);
    const who = byId(g.turnId);
    if (g.phase === 'roll') await send(who, 'action', { type: 'roll' });
    else await send(who, 'action', { type: 'move', token: who.state.game.legal[0] });
    await wait(5);
  }
  // back again: Ravi plays once more
  const back = await client();
  await send(back, 'join', { code, token: ravi.token, name: 'P0' });
  await wait(40);
  assert.strictEqual(back.state.you, raviId);
});

test('updates stay small: game list and chat are sent once, then only when they change', async () => {
  const { host, others } = await room('typing', 2);
  assert.ok(others[0].state.room.games.length > 10, 'first update has the list');
  await send(host, 'start', { options: {} });
  await wait(40);
  assert.strictEqual(others[0].state.room.games, undefined);
  assert.ok(others[0].state.room.chat, 'chat changed: a game started');
  await send(host, 'action', { type: 'choose', mode: 'raid' });
  await wait(40);
  assert.strictEqual(others[0].state.room.chat, undefined, 'chat unchanged');
  assert.ok(others[0].bytes < 3500, `was ${others[0].bytes} bytes`);
  host.emit('chat', { text: 'hello' });
  await wait(40);
  assert.strictEqual(others[0].state.room.chat.at(-1).text, 'hello');
});
