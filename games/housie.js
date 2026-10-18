// Housie / Tambola: everyone gets a 3x9 ticket with 15 numbers (1-90).
// The host calls numbers (one by one, or automatically). Players tap to mark numbers
// and claim prizes. Claims are checked against the called numbers — a wrong claim is a "Bogey!".
const { shuffle, findPlayer } = require('./util');

const PRIZES = [
  { key: 'early5', name: 'Early Five' },
  { key: 'top', name: 'Top Line' },
  { key: 'middle', name: 'Middle Line' },
  { key: 'bottom', name: 'Bottom Line' },
  { key: 'corners', name: 'Four Corners' },
  { key: 'full', name: 'Full House' },
];

// column c holds 1-9, 10-19, ..., 80-90
const colRange = c => (c === 0 ? [1, 9] : c === 8 ? [80, 90] : [c * 10, c * 10 + 9]);

function makeTicket() {
  for (;;) {
    // how many numbers each column gets (1-3, total 15)
    const counts = Array(9).fill(1);
    let extra = 6;
    while (extra) {
      const c = Math.floor(Math.random() * 9);
      if (counts[c] < 3) { counts[c]++; extra--; }
    }
    // which rows each column's numbers sit in; every row must end up with exactly 5
    const grid = [Array(9).fill(null), Array(9).fill(null), Array(9).fill(null)];
    const rowCount = [0, 0, 0];
    for (let c = 0; c < 9; c++) {
      for (const r of shuffle([0, 1, 2]).slice(0, counts[c]).sort()) { grid[r][c] = 0; rowCount[r]++; }
    }
    if (rowCount.some(n => n !== 5)) continue;
    for (let c = 0; c < 9; c++) {
      const [lo, hi] = colRange(c);
      const nums = shuffle([...Array(hi - lo + 1)].map((_, i) => lo + i)).slice(0, counts[c]).sort((a, b) => a - b);
      let k = 0;
      for (let r = 0; r < 3; r++) if (grid[r][c] === 0) grid[r][c] = nums[k++];
    }
    return grid;
  }
}

function prizeNumbers(ticket, key) {
  const row = r => ticket[r].filter(n => n != null);
  switch (key) {
    case 'top': return row(0);
    case 'middle': return row(1);
    case 'bottom': return row(2);
    case 'corners': return [row(0)[0], row(0)[4], row(2)[0], row(2)[4]];
    case 'full': return [...row(0), ...row(1), ...row(2)];
    default: return null;
  }
}

function isValidClaim(ticket, key, called) {
  const cut = new Set(called);
  if (key === 'early5') return ticket.flat().filter(n => n != null && cut.has(n)).length >= 5;
  return prizeNumbers(ticket, key).every(n => cut.has(n));
}

module.exports = {
  id: 'housie',
  name: 'Housie',
  blurb: 'Tambola! Mark your ticket as numbers are called and race to claim Early Five, Lines and Full House.',
  minPlayers: 2,
  maxPlayers: 8,

  setup(players) {
    return {
      players: players.map(p => ({ id: p.id, name: p.name, ticket: makeTicket() })),
      bag: shuffle([...Array(90)].map((_, i) => i + 1)),
      called: [],
      winners: {}, // prize key -> playerId
      auto: false,
      phase: 'play', // play -> over
      log: [],
    };
  },

  action(s, playerId, a, { isHost }) {
    const me = findPlayer(s, playerId);
    const log = text => { s.log.push(text); if (s.log.length > 10) s.log.shift(); };

    if (a.type === 'call') {
      if (!isHost) throw new Error('Only the host calls numbers');
      if (s.phase !== 'play') throw new Error('Game over');
      if (!s.bag.length) { s.phase = 'over'; return; }
      s.called.push(s.bag.pop());
      if (!s.bag.length) s.phase = 'over';
      return;
    }

    if (a.type === 'auto') {
      if (!isHost) throw new Error('Only the host can change auto-call');
      s.auto = !!a.on;
      return;
    }

    if (a.type === 'claim') {
      if (s.phase !== 'play') throw new Error('Game over');
      const prize = PRIZES.find(p => p.key === a.prize);
      if (!prize) throw new Error('Unknown prize');
      if (s.winners[prize.key]) throw new Error(`${prize.name} is already won`);
      if (!isValidClaim(me.ticket, prize.key, s.called)) {
        log(`🚫 ${me.name} claimed ${prize.name} — BOGEY!`);
        return { message: `Bogey! Not all your ${prize.name} numbers are called yet.` };
      }
      s.winners[prize.key] = playerId;
      log(`🏆 ${me.name} won ${prize.name}!`);
      if (prize.key === 'full') { s.phase = 'over'; s.auto = false; }
      return;
    }

    if (a.type === 'rematch') {
      if (s.phase !== 'over') throw new Error('Game not finished');
      if (!isHost) throw new Error('Only the host can start a rematch');
      Object.assign(s, this.setup(s.players));
      return;
    }

    throw new Error('Unknown action');
  },

  view(s, playerId) {
    const me = s.players.find(p => p.id === playerId);
    return {
      phase: s.phase,
      myTicket: me ? me.ticket : null,
      called: s.called,
      lastCalled: s.called[s.called.length - 1] || null,
      remaining: s.bag.length,
      auto: s.auto,
      prizes: PRIZES.map(p => ({ ...p, winnerId: s.winners[p.key] || null })),
      log: s.log,
      // tickets of prize winners are shown so everyone can verify
      players: s.players.map(p => ({
        id: p.id,
        name: p.name,
        ticket: s.phase === 'over' || Object.values(s.winners).includes(p.id) ? p.ticket : undefined,
      })),
    };
  },
};
