// Story Chain: one story per player, each starting from a silly opening line.
//   Every step, everyone adds one line to a different story, seeing only the line before.
//   Then the stories are read out line by line; tap the laugh button on the funniest lines.
const { shuffle, findPlayer, cue } = require('./util');
const OPENERS = require('./data/story-openers');

const LAP_CHOICES = [1, 2];
const WRITE_MS = 50000;
const MAX_LEN = 140;
const LAUGH_POINTS = 50;

function startStep(s) {
  s.phase = 'write';
  s.written = {};
  s.endsAt = Date.now() + WRITE_MS;
  s.totalMs = WRITE_MS;
  s.timerAt = s.endsAt;
}

// at step k, the player in seat i writes in story (i + k) mod n
const storyFor = (s, id) => (s.seats.indexOf(id) + s.step) % s.seats.length;
const prevLine = st => (st.lines.length ? st.lines[st.lines.length - 1].text : st.opener);

function addLine(s, id, text, skipped = false) {
  s.stories[storyFor(s, id)].lines.push({ by: id, text, skipped });
  s.written[id] = true;
  if (s.seats.every(p => s.written[p])) finishStep(s);
}

function finishStep(s) {
  s.step++;
  if (s.step >= s.totalSteps) {
    s.phase = 'reveal';
    s.rs = 0;  // story being read
    s.rl = 0;  // lines of it shown so far (the opener is always shown)
    s.endsAt = null;
    s.timerAt = null;
    cue(s, 'reveal');
    return;
  }
  startStep(s);
  cue(s, 'paper');
}

module.exports = {
  id: 'story',
  name: 'Story Chain',
  minPlayers: 2,
  maxPlayers: 8,
  options: [{ key: 'laps', label: 'Lines each', choices: LAP_CHOICES, default: 1, labels: ['1 per story', '2 per story'] }],

  setup(players, opts = {}) {
    const laps = LAP_CHOICES.includes(Number(opts.laps)) ? Number(opts.laps) : 1;
    const seats = shuffle(players.map(p => p.id));
    const openers = shuffle(OPENERS);
    const s = {
      players: players.map(p => ({ id: p.id, name: p.name })),
      scores: Object.fromEntries(players.map(p => [p.id, 0])),
      seats,
      laps,
      opts: { laps },
      stories: seats.map((_, i) => ({ opener: openers[i % openers.length], lines: [] })),
      step: 0,
      totalSteps: seats.length * laps,
      laughs: {}, // `${story}:${line}` -> [playerIds]
    };
    startStep(s);
    return s;
  },

  onTimer(s) {
    if (s.phase !== 'write') return;
    for (const id of s.seats) if (!s.written[id]) s.stories[storyFor(s, id)].lines.push({ by: id, text: '', skipped: true });
    finishStep(s);
  },

  absentBlock(s, absentIds) {
    if (s.phase !== 'write') return null;
    return absentIds.find(id => s.seats.includes(id) && !s.written[id]) || null;
  },

  skipAbsent(s, id) {
    if (s.phase === 'write' && !s.written[id]) addLine(s, id, '', true);
  },

  action(s, playerId, a, { isHost }) {
    findPlayer(s, playerId);

    if (a.type === 'line') {
      if (s.phase !== 'write') throw new Error('Not writing now');
      if (s.written[playerId]) throw new Error('You already added your line');
      const text = String(a.text || '').trim().replace(/\s+/g, ' ');
      if (text.length < 3) throw new Error('Write a little more');
      if (text.length > MAX_LEN) throw new Error(`Keep it under ${MAX_LEN} letters`);
      addLine(s, playerId, text);
      cue(s, 'tap');
      return;
    }

    if (a.type === 'next') {
      if (s.phase !== 'reveal') throw new Error('Not now');
      if (!isHost) throw new Error('Only the host reads the stories');
      const story = s.stories[s.rs];
      if (s.rl < story.lines.length) s.rl++;
      else if (s.rs < s.stories.length - 1) { s.rs++; s.rl = 0; cue(s, 'paper'); }
      else { s.phase = 'over'; cue(s, 'win'); }
      return;
    }

    if (a.type === 'laugh') {
      if (s.phase !== 'reveal' && s.phase !== 'over') throw new Error('Not now');
      const si = Number(a.story), li = Number(a.line);
      const story = s.stories[si];
      const line = story && story.lines[li];
      if (!line || line.skipped) throw new Error('Pick a line');
      if (s.phase === 'reveal' && (si > s.rs || (si === s.rs && li >= s.rl))) throw new Error('Not read out yet');
      if (line.by === playerId) throw new Error("You can't laugh at your own line");
      const key = `${si}:${li}`;
      const list = s.laughs[key] || (s.laughs[key] = []);
      const i = list.indexOf(playerId);
      if (i >= 0) { list.splice(i, 1); s.scores[line.by] -= LAUGH_POINTS; } else { list.push(playerId); s.scores[line.by] += LAUGH_POINTS; }
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
    const laughs = key => ({ n: (s.laughs[key] || []).length, mine: (s.laughs[key] || []).includes(playerId) });
    const shown = (si) => {
      const st = s.stories[si];
      const count = s.phase === 'over' || si < s.rs ? st.lines.length : si === s.rs ? s.rl : 0;
      return { opener: st.opener, total: st.lines.length, lines: st.lines.slice(0, count).map((l, li) => ({ ...l, ...laughs(`${si}:${li}`) })) };
    };
    const reading = s.phase === 'reveal' || s.phase === 'over';
    const mine = s.phase === 'write' ? s.stories[storyFor(s, playerId)] : null;
    return {
      phase: s.phase,
      step: s.step + 1,
      steps: s.totalSteps,
      myPrev: mine ? prevLine(mine) : null,
      myFirst: mine ? !mine.lines.length : false,
      done: s.phase === 'write' && !!s.written[playerId],
      written: s.phase === 'write' ? Object.keys(s.written) : [],
      endsAt: s.endsAt,
      totalMs: s.totalMs,
      storyNo: reading ? s.rs + 1 : 0,
      storyCount: s.stories.length,
      stories: reading ? s.stories.map((_, si) => (s.phase === 'over' || si <= s.rs ? shown(si) : null)).filter(Boolean) : null,
      atEnd: s.phase === 'reveal' && s.rs === s.stories.length - 1 && s.rl >= s.stories[s.rs].lines.length,
      lineDone: s.phase === 'reveal' && s.rl >= s.stories[s.rs].lines.length,
      scores: s.scores,
      players: s.players,
    };
  },
};
