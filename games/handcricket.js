// Hand Cricket: the batter and the bowler each secretly pick 1 to 6.
//   Different numbers: the batter scores what they picked. Same number: OUT.
//   1 player plays the computer, 2 players play each other, and 4, 6 or 8 players split into two teams.
//   Each side bats once; the side batting second chases the target.
//   Overs format: each innings is limited to the chosen overs. Test format: no limit, bat until all out.
const { shuffle, findPlayer, cue } = require('./util');

const AI = 'ai';
const FORMATS = ['overs', 'test'];
const OVER_CHOICES = [1, 2, 3, 5];
const WICKET_CHOICES = [1, 2, 3];
const TOSS_MS = 3500;
const BALL_MS = 12000;
const GAP_MS = 2300;   // time to watch the hands and the result before the next ball
const BREAK_MS = 5000;
const SIDE_NAMES = { a: 'Blue', b: 'Orange' };

const rand = () => 1 + Math.floor(Math.random() * 6);
const sideOf = (s, id) => (s.sides.a.includes(id) ? 'a' : 'b');
const other = side => (side === 'a' ? 'b' : 'a');
const inn = s => s.inns[s.innings - 1];

// the computer mostly picks at random, but sometimes plays the human's favourite number
function aiPick(s, role) {
  const human = role === 'bowl' ? s.batterId : s.bowlerId;
  const counts = (s.habits[human] || {})[role === 'bowl' ? 'bat' : 'bowl'] || {};
  const fav = Object.keys(counts).sort((x, y) => counts[y] - counts[x])[0];
  if (fav && Math.random() < (role === 'bowl' ? 0.3 : 0.15)) {
    if (role === 'bowl') return Number(fav);
    let n = rand(); while (n === Number(fav)) n = rand(); return n; // when batting, dodge their favourite
  }
  return rand();
}

function startBall(s) {
  const i = inn(s);
  const batting = s.sides[i.side], bowling = s.sides[other(i.side)];
  s.batterId = batting[i.wickets % batting.length];
  s.bowlerId = bowling[Math.floor(i.balls / 6) % bowling.length];
  s.picks = { bat: null, bowl: null };
  if (s.batterId === AI) s.picks.bat = aiPick(s, 'bat');
  if (s.bowlerId === AI) s.picks.bowl = aiPick(s, 'bowl');
  s.gap = false;
  s.phase = 'play';
  s.endsAt = Date.now() + BALL_MS;
  s.totalMs = BALL_MS;
  s.timerAt = s.endsAt;
}

function startInnings(s, side) {
  s.inns.push({ side, runs: 0, wickets: 0, balls: 0, log: [], maxWickets: s.mode === 'teams' ? s.sides[side].length : s.wickets });
  s.innings = s.inns.length;
  startBall(s);
}

function bowl(s) {
  const i = inn(s);
  const { bat, bowl: b } = s.picks;
  const out = bat === b;
  const st = s.stats;
  for (const [id, role, n] of [[s.batterId, 'bat', bat], [s.bowlerId, 'bowl', b]]) {
    const h = s.habits[id] || (s.habits[id] = { bat: {}, bowl: {} });
    h[role][n] = (h[role][n] || 0) + 1;
  }
  i.balls++;
  st[s.batterId].balls++;
  st[s.bowlerId].bowled++;
  if (out) {
    i.wickets++;
    st[s.batterId].outs++;
    st[s.bowlerId].wickets++;
  } else {
    i.runs += bat;
    st[s.batterId].runs += bat;
  }
  i.log.push(out ? 'W' : bat);
  s.last = { bat, bowl: b, out, runs: out ? 0 : bat, batter: s.batterId, bowler: s.bowlerId, n: i.balls };
  s.gap = true;
  s.endsAt = null;
  s.timerAt = Date.now() + GAP_MS;
  cue(s, out ? 'cut' : 'tap');
}

function inningsOver(s) {
  const i = inn(s);
  if (i.wickets >= i.maxWickets || (s.overs && i.balls >= s.overs * 6)) return true;
  return s.innings === 2 && i.runs >= s.inns[0].runs + 1;
}

function afterGap(s) {
  if (!inningsOver(s)) return startBall(s);
  if (s.innings === 1) {
    s.phase = 'break';
    s.gap = false;
    s.endsAt = Date.now() + BREAK_MS;
    s.totalMs = BREAK_MS;
    s.timerAt = s.endsAt;
    cue(s, 'reveal');
    return;
  }
  const [first, second] = s.inns;
  s.winner = second.runs > first.runs ? second.side : second.runs < first.runs ? first.side : null;
  s.margin = !s.winner ? null : s.winner === second.side
    ? { by: 'wickets', n: second.maxWickets - second.wickets, balls: s.overs ? s.overs * 6 - second.balls : null }
    : { by: 'runs', n: first.runs - second.runs };
  s.phase = 'over';
  s.gap = false;
  s.timerAt = null;
  s.endsAt = null;
  cue(s, 'win');
}

module.exports = {
  id: 'handcricket',
  name: 'Hand Cricket',
  minPlayers: 1,
  maxPlayers: 8,
  allowedCounts: [1, 2, 4, 6, 8],
  options: [
    { key: 'format', label: 'Format', choices: FORMATS, labels: ['Overs', 'Test (till all out)'], default: 'overs' },
    { key: 'overs', label: 'Overs', choices: OVER_CHOICES, default: 2, showIf: { format: 'overs' } },
    // lives only matter when one batter plays alone (vs the computer, or 1 vs 1); in teams everyone gets one life
    { key: 'wickets', label: 'Lives', choices: WICKET_CHOICES, default: 1, players: [1, 2] },
  ],

  setup(players, opts = {}) {
    const n = players.length;
    if (!this.allowedCounts.includes(n)) throw new Error('Hand Cricket needs 1, 2, 4, 6 or 8 players');
    const mode = n === 1 ? 'ai' : n === 2 ? 'duel' : 'teams';
    const ids = shuffle(players.map(p => p.id));
    const sides = mode === 'ai' ? { a: [ids[0]], b: [AI] } : { a: ids.slice(0, n / 2), b: ids.slice(n / 2) };
    const names = Object.fromEntries(players.map(p => [p.id, p.name]));
    names[AI] = 'Computer';
    const all = [...sides.a, ...sides.b];
    const s = {
      players: players.map(p => ({ id: p.id, name: p.name })),
      mode,
      sides,
      names,
      format: opts.format === 'test' ? 'test' : 'overs',
      overs: opts.format === 'test' ? null : OVER_CHOICES.includes(Number(opts.overs)) ? Number(opts.overs) : 2,
      wickets: WICKET_CHOICES.includes(Number(opts.wickets)) ? Number(opts.wickets) : 1,
      opts: { format: opts.format, overs: opts.overs, wickets: opts.wickets },
      stats: Object.fromEntries(all.map(id => [id, { runs: 0, balls: 0, outs: 0, wickets: 0, bowled: 0 }])),
      habits: {},
      inns: [],
      innings: 0,
      toss: Math.random() < 0.5 ? 'a' : 'b',
      phase: 'toss',
      last: null,
      winner: null,
    };
    s.endsAt = Date.now() + TOSS_MS;
    s.totalMs = TOSS_MS;
    s.timerAt = s.endsAt;
    cue(s, 'roll');
    return s;
  },

  onTimer(s) {
    if (s.phase === 'toss') startInnings(s, s.toss);
    else if (s.phase === 'break') startInnings(s, other(s.inns[0].side));
    else if (s.phase === 'play') {
      if (s.gap) return afterGap(s);
      // time's up: anyone who has not picked gets a random number
      if (s.picks.bat === null) s.picks.bat = rand();
      if (s.picks.bowl === null) s.picks.bowl = rand();
      bowl(s);
    }
  },

  absentBlock(s, absentIds) {
    if (s.phase !== 'play' || s.gap) return null;
    if (s.picks.bat === null && absentIds.includes(s.batterId)) return s.batterId;
    if (s.picks.bowl === null && absentIds.includes(s.bowlerId)) return s.bowlerId;
    return null;
  },

  skipAbsent(s, id) {
    if (s.phase !== 'play' || s.gap) return;
    if (id === s.batterId && s.picks.bat === null) s.picks.bat = rand();
    if (id === s.bowlerId && s.picks.bowl === null) s.picks.bowl = rand();
    if (s.picks.bat !== null && s.picks.bowl !== null) bowl(s);
  },

  action(s, playerId, a, { isHost }) {
    findPlayer(s, playerId);

    if (a.type === 'pick') {
      if (s.phase !== 'play' || s.gap) throw new Error('Wait for the next ball');
      const n = Number(a.n);
      if (!Number.isInteger(n) || n < 1 || n > 6) throw new Error('Pick a number from 1 to 6');
      const role = playerId === s.batterId ? 'bat' : playerId === s.bowlerId ? 'bowl' : null;
      if (!role) throw new Error("You're not batting or bowling this ball");
      if (s.picks[role] !== null) throw new Error('You already picked');
      s.picks[role] = n;
      if (s.picks.bat !== null && s.picks.bowl !== null) bowl(s);
      return;
    }

    if (a.type === 'rematch') {
      if (s.phase !== 'over') throw new Error('Game not finished');
      if (!isHost) throw new Error('Only the host can start a rematch');
      Object.assign(s, this.setup(s.players, s.opts));
      return;
    }

    throw new Error('Unknown action');
  },

  view(s, playerId) {
    const playing = s.phase === 'play' && !s.gap;
    const role = playing ? (playerId === s.batterId ? 'bat' : playerId === s.bowlerId ? 'bowl' : null) : null;
    return {
      phase: s.phase,
      mode: s.mode,
      sides: s.sides,
      sideNames: s.mode === 'teams' ? SIDE_NAMES : { a: s.names[s.sides.a[0]], b: s.names[s.sides.b[0]] },
      names: s.names,
      mySide: sideOf(s, playerId),
      format: s.format,
      overs: s.overs,
      toss: s.toss,
      innings: s.innings,
      inns: s.inns,
      target: s.innings === 2 || s.phase === 'break' ? s.inns[0].runs + 1 : null,
      batterId: s.batterId || null,
      bowlerId: s.bowlerId || null,
      myRole: role,
      myPick: role ? s.picks[role] : null,
      picked: s.phase === 'play' ? { bat: s.picks.bat !== null, bowl: s.picks.bowl !== null } : null,
      gap: !!s.gap,
      last: s.last,
      endsAt: s.endsAt,
      totalMs: s.totalMs,
      stats: s.stats,
      winner: s.winner,
      margin: s.margin || null,
      players: s.players,
    };
  },
};
