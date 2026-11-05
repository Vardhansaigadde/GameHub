// Typing Arena: players vote for a typing game, then compete.
//   Car Race    - everyone types the same sentence; your car moves as you type.
//   Word Rain   - the same words fall for everyone; type them before they land. 5 lives.
//   Speed Duel  - one word at a time; the fastest typists score.
//   Kings' Battle - one player against another; each typed word launches a random attack of your king.
//   Monster Raid  - everyone teams up to type down three bosses before they destroy you.
const { shuffle, findPlayer, cue } = require('./util');
const { sentences, words } = require('./data/typing-words');

const COUNTDOWN_MS = 3000;
const RACE_MS = 120000;
const RACE_LAST_CALL_MS = 30000; // once someone finishes, the rest get this long
const RAIN_MS = 60000;
const RAIN_LIVES = 5;
const DUEL_WORDS = 10;
const DUEL_WORD_MS = 9000;
const DUEL_GAP_MS = 1500;
const DUEL_POINTS = [100, 70, 50, 40];

const BATTLE_MS = 150000;
const KO_MS = 2400;
const KING_HP = 150;
const RAID_HP = 100;
const ULT_EVERY = 5;         // words in a row without a typo
const CPU_EVERY_MS = 3500;
const CPU_DMG = 6;
const BATTLE_INTRO_MS = 4000; // the versus screen
const BATTLE_SCENES = ['throne', 'hall', 'chapel', 'gate', 'ramparts', 'bailey'];
const ATTACKS_PER_KING = 4;   // every normal hit is one of these, chosen at random
const HEROES = ['aldric', 'rowan', 'astra', 'florian', 'darius', 'solaris', 'leonix', 'crimson', 'gareth', 'emeric', 'mortis', 'lupus'];
const BOSSES = [
  { name: 'Lion Warlord', art: 'leonix', hp: 90, dmg: 7, every: 4200, attack: 'sword' },
  { name: 'Crimson Knight', art: 'crimson', hp: 130, dmg: 9, every: 3800, attack: 'bolt' },
  { name: 'Lord Mortis', art: 'mortis', hp: 180, dmg: 12, every: 3400, attack: 'fire' },
];

// longer words hit harder and look bigger
const attackFor = len => (len <= 4 ? { type: 'sword', dmg: 7 } : len <= 6 ? { type: 'arrows', dmg: 9 } : len <= 8 ? { type: 'fire', dmg: 12 } : { type: 'bolt', dmg: 15 });
const ULTIMATE = { type: 'meteor', dmg: 28 };

const MODES = [
  { id: 'kings', name: "Kings' Battle", tagline: 'One on one. Type to attack.', maxPlayers: 2 },
  { id: 'raid', name: 'Monster Raid', tagline: 'Team up and type down the bosses.' },
  { id: 'race', name: 'Car Race', tagline: 'Type the sentence. Your car drives.' },
  { id: 'rain', name: 'Word Rain', tagline: 'Zap falling words before they land.' },
  { id: 'duel', name: 'Speed Duel', tagline: 'Fastest fingers take the points.' },
];

const pick = (list, n) => shuffle(list).slice(0, n);

function rainSchedule() {
  const pool = pick(words, words.length);
  const out = [];
  let at = 600, i = 0;
  while (at < RAIN_MS - 4000) {
    const progress = at / RAIN_MS;
    out.push({
      w: pool[i++ % pool.length],
      at: Math.round(at),
      x: 4 + Math.floor(Math.random() * 68),        // left edge, % of the field
      fall: Math.round(7000 - progress * 3500),     // gets faster as time goes on
    });
    at += 1700 - progress * 1050;                   // and words come quicker
  }
  return out;
}

function reset(s) {
  s.phase = 'pick';
  s.mode = null;
  s.votes = {};
  s.results = null;
  s.timerAt = null;
  s.startedAt = null;
}

function begin(s, mode) {
  s.mode = mode;
  const battle = mode === 'kings' || mode === 'raid';
  s.phase = 'countdown';
  s.timerAt = Date.now() + (battle ? BATTLE_INTRO_MS : COUNTDOWN_MS);
  s.results = null;
  s.prog = {};
  s.finished = {};
  s.scores = {};
  s.rain = {};
  for (const p of s.players) {
    s.prog[p.id] = 0;
    s.scores[p.id] = 0;
    s.rain[p.id] = { score: 0, lives: RAIN_LIVES, done: false };
  }
  if (mode === 'race') s.text = pick(sentences, 1)[0];
  if (mode === 'rain') s.words = rainSchedule();
  if (mode === 'kings' || mode === 'raid') s.b = newBattle(s, mode);
  if (mode === 'duel') {
    s.queue = pick(words, DUEL_WORDS);
    s.idx = 0;
    s.solvers = [];
    s.gap = false;
  }
  cue(s, battle ? 'tap' : 'reveal');
}

function newBattle(s, mode) {
  const sides = { a: [], b: [] };
  s.players.forEach((p, i) => (mode === 'raid' || i % 2 === 0 ? sides.a : sides.b).push(p.id));
  const b = {
    sides,
    cpu: mode === 'kings' && !sides.b.length, // playing alone: the enemy king fights back by himself
    hp: {}, max: {}, words: {}, idx: {}, streak: {}, dmg: {}, typed: {},
    events: [], evId: 0, boss: 0, winner: null, endAt: 0, nextHit: 0,
    heroes: {},
    scene: BATTLE_SCENES[Math.floor(Math.random() * BATTLE_SCENES.length)],
  };
  // kings are dealt out at random, so nobody needs to choose; raid bosses stay on the enemy side
  const deck = shuffle(mode === 'raid' ? HEROES.filter(h => !BOSSES.some(x => x.art === h)) : HEROES);
  s.players.forEach((p, i) => { b.heroes[p.id] = deck[i % deck.length]; });
  b.cpuHero = deck[s.players.length % deck.length];
  for (const p of s.players) {
    b.words[p.id] = pick(words, words.length);
    b.idx[p.id] = 0;
    b.streak[p.id] = 0;
    b.dmg[p.id] = 0;
    b.typed[p.id] = 0;
  }
  if (mode === 'raid') {
    b.max.a = b.hp.a = RAID_HP;
    b.max.b = b.hp.b = BOSSES[0].hp * s.players.length;
  } else {
    b.max.a = b.hp.a = KING_HP;
    b.max.b = b.hp.b = KING_HP;
  }
  return b;
}

function battleEvent(s, ev) {
  const b = s.b;
  b.events.push({ id: ++b.evId, hp: { ...b.hp }, pick: Math.floor(Math.random() * ATTACKS_PER_KING), ...ev });
  if (b.events.length > 12) b.events.shift();
}

function battleKo(s, winner) {
  s.b.winner = winner;
  s.phase = 'ko';
  s.timerAt = Date.now() + KO_MS;
  s.b.nextHit = 0;
}

function battleTimers(s) {
  const b = s.b;
  s.timerAt = b.nextHit ? Math.min(b.endAt, b.nextHit) : b.endAt;
}

function scheduleEnemy(s, first) {
  const b = s.b;
  if (s.mode === 'raid') b.nextHit = Date.now() + BOSSES[b.boss].every + (first ? 1500 : 0);
  else if (b.cpu) b.nextHit = Date.now() + CPU_EVERY_MS;
}

function enemyStrike(s) {
  const b = s.b;
  const boss = s.mode === 'raid' ? BOSSES[b.boss] : null;
  const dmg = boss ? boss.dmg : CPU_DMG;
  b.hp.a = Math.max(0, b.hp.a - dmg);
  battleEvent(s, { type: boss ? boss.attack : 'sword', side: 'b', dmg, by: null });
  if (b.hp.a === 0) return battleKo(s, 'b');
  scheduleEnemy(s);
  battleTimers(s);
}

function battleTick(s) {
  const b = s.b;
  const now = Date.now();
  if (now >= b.endAt) {
    // time up: the king with more health (as a share) wins; bosses still alive beat the raid
    if (s.mode === 'raid') return battleKo(s, 'b');
    return battleKo(s, b.hp.a / b.max.a >= b.hp.b / b.max.b ? 'a' : 'b');
  }
  if (b.nextHit && now >= b.nextHit) return enemyStrike(s);
  battleTimers(s);
}

function strike(s, playerId, text) {
  const b = s.b;
  const word = b.words[playerId][b.idx[playerId] % b.words[playerId].length];
  if (String(text || '').trim().toLowerCase() !== word) return { quiet: true, message: 'Check the spelling' };
  b.idx[playerId]++;
  b.typed[playerId]++;
  b.streak[playerId]++;
  const ult = b.streak[playerId] % ULT_EVERY === 0;
  const atk = ult ? ULTIMATE : attackFor(word.length);
  const side = b.sides.a.includes(playerId) ? 'a' : 'b';
  const target = side === 'a' ? 'b' : 'a';
  const dmg = Math.min(atk.dmg, b.hp[target]);
  b.hp[target] -= dmg;
  b.dmg[playerId] += dmg;

  if (s.mode === 'raid' && b.hp.b === 0) {
    battleEvent(s, { type: atk.type, side, dmg, by: playerId, ult, down: b.boss });
    if (b.boss + 1 < BOSSES.length) {
      b.boss++;
      b.max.b = b.hp.b = BOSSES[b.boss].hp * s.players.length;
      scheduleEnemy(s, true);
      battleTimers(s);
    } else battleKo(s, 'a');
    return;
  }
  battleEvent(s, { type: atk.type, side, dmg, by: playerId, ult });
  if (b.hp[target] === 0) battleKo(s, side);
}

function finishGame(s) {
  let rows;
  if (s.mode === 'kings' || s.mode === 'raid') {
    rows = s.players.map(p => ({
      id: p.id,
      score: s.b.dmg[p.id],
      words: s.b.typed[p.id],
      side: s.b.sides.a.includes(p.id) ? 'a' : 'b',
    })).sort((a, c) => c.score - a.score);
  } else if (s.mode === 'race') {
    const len = s.text.length;
    const elapsed = Math.max(1000, Date.now() - s.startedAt);
    rows = s.players.map(p => {
      const f = s.finished[p.id];
      const chars = f ? len : s.prog[p.id];
      const ms = f ? f.ms : elapsed;
      return {
        id: p.id,
        wpm: Math.round((chars / 5) / (ms / 60000)),
        acc: f ? f.acc : null,
        done: !!f,
        ms: f ? f.ms : null,
        place: f ? f.place : null,
        pct: Math.round((chars / len) * 100),
      };
    }).sort((a, b) => (a.done !== b.done ? (a.done ? -1 : 1) : a.done ? a.place - b.place : b.pct - a.pct));
  } else if (s.mode === 'rain') {
    rows = s.players.map(p => ({ id: p.id, score: s.rain[p.id].score, lives: s.rain[p.id].lives }))
      .sort((a, b) => b.score - a.score);
  } else {
    rows = s.players.map(p => ({ id: p.id, score: s.scores[p.id] })).sort((a, b) => b.score - a.score);
  }
  s.results = rows;
  s.phase = 'over';
  s.timerAt = null;
  cue(s, 'win');
}

function duelNext(s) {
  s.idx++;
  s.gap = false;
  s.solvers = [];
  if (s.idx >= s.queue.length) return finishGame(s);
  s.timerAt = Date.now() + DUEL_WORD_MS;
}

function duelGap(s) {
  s.gap = true;
  s.timerAt = Date.now() + DUEL_GAP_MS;
}

module.exports = {
  id: 'typing',
  name: 'Typing Arena',
  minPlayers: 1,
  maxPlayers: 8,

  setup(players) {
    const s = { players: players.map(p => ({ id: p.id, name: p.name })) };
    reset(s);
    return s;
  },

  onTimer(s) {
    if (s.phase === 'countdown') {
      s.phase = 'play';
      s.startedAt = Date.now();
      s.timerAt = s.startedAt + (s.mode === 'race' ? RACE_MS : s.mode === 'rain' ? RAIN_MS : DUEL_WORD_MS);
      if (s.b && (s.mode === 'kings' || s.mode === 'raid')) {
        s.b.endAt = s.startedAt + BATTLE_MS;
        scheduleEnemy(s, true);
        battleTimers(s);
      }
      cue(s, 'go');
    } else if (s.phase === 'ko') {
      finishGame(s);
    } else if (s.phase === 'play') {
      if (s.mode === 'kings' || s.mode === 'raid') battleTick(s);
      else if (s.mode === 'duel') {
        if (s.gap) duelNext(s);
        else { duelGap(s); cue(s, 'tick'); }
      } else finishGame(s);
    }
  },

  // fast progress updates, relayed live to everyone else
  stream(s, playerId, d) {
    if (s.phase !== 'play' || !d) return null;
    if (d.t === 'm' && s.b && (s.mode === 'kings' || s.mode === 'raid')) {
      s.b.streak[playerId] = 0; // a typo breaks the streak towards the ultimate
      return null;
    }
    if (d.t === 'p' && s.mode === 'race') {
      const n = Math.max(0, Math.min(s.text.length, Number(d.n) || 0));
      s.prog[playerId] = n;
      return { t: 'p', id: playerId, n };
    }
    if (d.t === 's' && s.mode === 'rain') {
      const r = s.rain[playerId];
      if (!r) return null;
      r.score = Math.max(0, Number(d.score) || 0);
      r.lives = Math.max(0, Math.min(RAIN_LIVES, Number(d.lives) || 0));
      return { t: 's', id: playerId, score: r.score, lives: r.lives };
    }
    return null;
  },

  action(s, playerId, a, { isHost }) {
    findPlayer(s, playerId);

    if (a.type === 'vote') {
      if (s.phase !== 'pick') throw new Error('The game already started');
      const picked = MODES.find(m => m.id === a.mode);
      if (!picked) throw new Error('Pick a typing game');
      if (picked.maxPlayers && s.players.length > picked.maxPlayers) throw new Error(`${picked.name} is for ${picked.maxPlayers} players only`);
      s.votes[playerId] = a.mode;
      cue(s, 'tap');
      if (Object.keys(s.votes).length === s.players.length) this.action(s, playerId, { type: 'start' }, { isHost: true });
      return;
    }

    if (a.type === 'start') {
      if (s.phase !== 'pick') throw new Error('The game already started');
      if (!isHost) throw new Error('Only the host can start');
      const tally = {};
      for (const m of Object.values(s.votes)) tally[m] = (tally[m] || 0) + 1;
      const top = Math.max(0, ...Object.values(tally));
      if (!top) throw new Error('Vote for a typing game first');
      const best = Object.keys(tally).filter(m => tally[m] === top);
      begin(s, best[Math.floor(Math.random() * best.length)]);
      return;
    }

    if (a.type === 'strike') {
      if (s.phase !== 'play' || (s.mode !== 'kings' && s.mode !== 'raid')) return { quiet: true };
      return strike(s, playerId, a.text);
    }

    if (a.type === 'finished') {
      if (s.phase !== 'play' || s.mode !== 'race') throw new Error('Not racing now');
      if (s.finished[playerId]) return;
      if (String(a.typed) !== s.text) throw new Error('Keep typing — the sentence is not finished');
      s.prog[playerId] = s.text.length;
      s.finished[playerId] = {
        ms: Date.now() - s.startedAt,
        acc: Math.max(0, Math.min(100, Math.round(Number(a.acc) || 0))),
        place: Object.keys(s.finished).length + 1,
      };
      cue(s, 'correct');
      if (Object.keys(s.finished).length === s.players.length) finishGame(s);
      else s.timerAt = Math.min(s.timerAt, Date.now() + RACE_LAST_CALL_MS);
      return;
    }

    if (a.type === 'rainOut') {
      if (s.phase !== 'play' || s.mode !== 'rain') return;
      const r = s.rain[playerId];
      r.done = true;
      r.lives = 0;
      r.score = Math.max(r.score, Number(a.score) || 0);
      if (s.players.every(p => s.rain[p.id].done)) finishGame(s);
      return;
    }

    if (a.type === 'duel') {
      if (s.phase !== 'play' || s.mode !== 'duel' || s.gap) return;
      if (s.solvers.includes(playerId)) return;
      if (String(a.text || '').trim().toLowerCase() !== s.queue[s.idx]) return { message: 'Not quite — check the spelling' };
      const pts = DUEL_POINTS[Math.min(s.solvers.length, DUEL_POINTS.length - 1)];
      s.solvers.push(playerId);
      s.scores[playerId] += pts;
      cue(s, 'correct');
      if (s.solvers.length === s.players.length) duelGap(s);
      return { message: `+${pts}` };
    }

    if (a.type === 'again') {
      if (s.phase !== 'over') throw new Error('Game not finished');
      if (!isHost) throw new Error('Only the host can start again');
      reset(s);
      return;
    }

    if (a.type === 'rematch') return this.action(s, playerId, { type: 'again' }, { isHost });

    throw new Error('Unknown action');
  },

  view(s, playerId) {
    const duelWord = s.mode === 'duel' && s.queue && s.idx < s.queue.length ? s.queue[s.idx] : null;
    return {
      phase: s.phase,
      modes: MODES,
      votes: s.votes,
      mode: s.mode,
      startedAt: s.startedAt,
      text: s.mode === 'race' ? s.text : null,
      prog: s.prog || {},
      finished: s.finished || {},
      words: s.mode === 'rain' ? s.words : null,
      rain: s.rain || {},
      rainMs: RAIN_MS,
      word: s.phase === 'play' ? duelWord : null,
      number: s.mode === 'duel' ? s.idx + 1 : undefined,
      of: s.mode === 'duel' ? DUEL_WORDS : undefined,
      solvers: s.solvers || [],
      gap: !!s.gap,
      duelMs: DUEL_WORD_MS,
      scores: s.scores || {},
      results: s.results,
      players: s.players,
      battle: s.b && (s.mode === 'kings' || s.mode === 'raid') ? {
        sides: s.b.sides,
        heroes: s.b.heroes,
        scene: s.b.scene,
        cpuHero: s.b.cpuHero,
        cpu: s.b.cpu,
        hp: s.b.hp,
        max: s.b.max,
        events: s.b.events,
        winner: s.b.winner,
        endAt: s.b.endAt,
        totalMs: BATTLE_MS,
        ultEvery: ULT_EVERY,
        boss: s.mode === 'raid' ? { index: s.b.boss, count: BOSSES.length, name: BOSSES[s.b.boss].name, art: BOSSES[s.b.boss].art } : null,
        bossesDown: s.b.winner === 'a' && s.mode === 'raid' ? BOSSES.length : s.b.boss,
        myIdx: s.b.idx[playerId] || 0,
        myWords: s.b.words[playerId] ? Array.from({ length: 6 }, (_, i) => s.b.words[playerId][(s.b.idx[playerId] + i) % s.b.words[playerId].length]) : [],
        myStreak: s.b.streak[playerId] || 0,
      } : null,
    };
  },
};
