// Doodle Telephone: the telephone game played with drawings.
//   Everyone writes a sentence. It moves to the next player, who draws it. That drawing moves on,
//   and the next player (who never saw the sentence) describes it. Draw, describe, repeat.
//   After every chain has gone round the group, the chains are revealed step by step.
const { findPlayer, cue } = require('./util');

const WRITE_MS = 45000;
const DESCRIBE_MS = 40000;
const DRAW_CHOICES = [60, 90, 120];
const GRACE_MS = 1500;         // lets last-second auto-submits arrive
const MAX_TEXT = 90;
const MAX_IMAGE = 700000;      // characters of base64
const IMAGE_RE = /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/;

const kindOf = round => (round === 0 ? 'write' : round % 2 === 1 ? 'draw' : 'describe');

// In round r, player p works on the chain started r seats before them.
const chainFor = (s, seat, round) => (seat - round + s.players.length * 2) % s.players.length;

function startRound(s, round) {
  s.round = round;
  s.done = {};
  const kind = kindOf(round);
  const ms = kind === 'write' ? WRITE_MS : kind === 'draw' ? s.drawMs : DESCRIBE_MS;
  s.endsAt = Date.now() + ms;
  s.totalMs = ms;
  s.timerAt = s.endsAt + GRACE_MS;
  s.phase = 'round';
  cue(s, 'paper');
}

function fillMissing(s) {
  const kind = kindOf(s.round);
  s.players.forEach((p, seat) => {
    const chain = s.chains[chainFor(s, seat, s.round)];
    if (chain[s.round]) return;
    chain[s.round] = kind === 'draw'
      ? { by: p.id, type: 'image', image: null }
      : { by: p.id, type: 'text', text: kind === 'write' ? 'A mystery sentence nobody wrote' : '…no idea what this is!' };
  });
}

function endRound(s) {
  fillMissing(s);
  if (s.round + 1 < s.players.length) startRound(s, s.round + 1);
  else {
    s.phase = 'reveal';
    s.timerAt = null;
    s.reveal = { chain: 0, step: 0 };
    cue(s, 'reveal');
  }
}

module.exports = {
  id: 'telephone',
  name: 'Doodle Telephone',
  minPlayers: 3,
  maxPlayers: 8,
  options: [{ key: 'time', label: 'Drawing time', choices: DRAW_CHOICES, default: 90, suffix: 's' }],

  setup(players, opts = {}) {
    const secs = DRAW_CHOICES.includes(Number(opts.time)) ? Number(opts.time) : 90;
    const s = {
      players: players.map(p => ({ id: p.id, name: p.name })),
      drawMs: secs * 1000,
      chains: players.map(() => []),
      gameNo: (opts.gameNo || 0) + 1,
      reveal: null,
    };
    startRound(s, 0);
    return s;
  },

  onTimer(s) {
    if (s.phase === 'round') endRound(s);
  },

  action(s, playerId, a, { isHost }) {
    findPlayer(s, playerId);
    const seat = s.players.findIndex(p => p.id === playerId);

    if (a.type === 'submit') {
      if (s.phase !== 'round') throw new Error('This round is over');
      const kind = kindOf(s.round);
      const chain = s.chains[chainFor(s, seat, s.round)];
      if (kind === 'draw') {
        const image = String(a.image || '');
        if (image.length > MAX_IMAGE || !IMAGE_RE.test(image)) throw new Error('That drawing could not be sent');
        chain[s.round] = { by: playerId, type: 'image', image };
      } else {
        const text = String(a.text || '').trim().replace(/\s+/g, ' ').slice(0, MAX_TEXT);
        if (!text) throw new Error('Write something first');
        chain[s.round] = { by: playerId, type: 'text', text };
      }
      s.done[playerId] = true;
      if (s.players.every(p => s.done[p.id])) endRound(s);
      return;
    }

    if (a.type === 'unsubmit') {
      if (s.phase !== 'round') throw new Error('This round is over');
      delete s.done[playerId];
      return;
    }

    // drawings are sent on request, so ordinary updates stay small
    if (a.type === 'image') {
      const c = Number(a.chain), st = Number(a.step);
      const entry = s.chains[c] && s.chains[c][st];
      if (!entry || entry.type !== 'image') throw new Error('No drawing there');
      const isMyPrompt = s.phase === 'round' && st === s.round - 1 && c === chainFor(s, seat, s.round);
      const isRevealed = s.phase === 'over' || (s.phase === 'reveal' && (c < s.reveal.chain || (c === s.reveal.chain && st <= s.reveal.step)));
      if (!isMyPrompt && !isRevealed) throw new Error('Not yet!');
      return { quiet: true, image: entry.image };
    }

    if (a.type === 'next') {
      if (s.phase !== 'reveal') throw new Error('Nothing to reveal');
      if (!isHost) throw new Error('Only the host controls the reveal');
      const r = s.reveal;
      if (r.step + 1 < s.players.length) {
        r.step++;
        cue(s, 'paper');
      } else if (r.chain + 1 < s.players.length) {
        r.chain++;
        r.step = 0;
        cue(s, 'reveal');
      } else {
        s.phase = 'over';
        cue(s, 'win');
      }
      return;
    }

    if (a.type === 'rematch') {
      if (s.phase !== 'over') throw new Error('Game not finished');
      if (!isHost) throw new Error('Only the host can start again');
      Object.assign(s, this.setup(s.players, { time: s.drawMs / 1000, gameNo: s.gameNo }));
      return;
    }

    throw new Error('Unknown action');
  },

  view(s, playerId) {
    const seat = s.players.findIndex(p => p.id === playerId);
    const out = {
      phase: s.phase,
      gameNo: s.gameNo,
      round: s.round,
      totalRounds: undefined,
      steps: s.players.length,
      stepNumber: s.round + 1,
      kind: s.phase === 'round' ? kindOf(s.round) : null,
      endsAt: s.phase === 'round' ? s.endsAt : null,
      totalMs: s.totalMs,
      doneIds: Object.keys(s.done || {}),
      myDone: !!(s.done && s.done[playerId]),
      players: s.players,
      prompt: null,
      myChain: null,
      reveal: null,
    };
    if (s.phase === 'round' && seat >= 0) {
      const c = chainFor(s, seat, s.round);
      out.myChain = c;
      const prev = s.round > 0 ? s.chains[c][s.round - 1] : null;
      if (prev) out.prompt = prev.type === 'text' ? { type: 'text', text: prev.text } : { type: 'image', chain: c, step: s.round - 1, empty: !prev.image };
    }
    if (s.phase === 'reveal' || s.phase === 'over') {
      const r = s.reveal;
      const chainNo = s.phase === 'over' ? s.players.length - 1 : r.chain;
      const stepNo = s.phase === 'over' ? s.players.length - 1 : r.step;
      out.reveal = {
        chain: chainNo,
        step: stepNo,
        lastStep: stepNo === s.players.length - 1,
        lastChain: chainNo === s.players.length - 1,
        owner: s.players[chainNo].id,
        entries: s.chains[chainNo].slice(0, stepNo + 1).map((e, i) => ({
          by: e.by,
          type: e.type,
          text: e.text,
          step: i,
          empty: e.type === 'image' && !e.image,
        })),
      };
    }
    return out;
  },
};
