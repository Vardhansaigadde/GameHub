// IPL Auction: each player runs a franchise and bids for real cricketers.
//   1. Everyone picks a team (CSK, MI, RCB…).
//   2. Players come up one by one (marquee set first, then by role). There are no turns —
//      everyone can bid at any time. The host sets the bid timer; every bid resets it to full.
//      When it runs out the player is SOLD to the highest bidder (or UNSOLD if nobody bid).
//   3. Squad limits: max squad size and max overseas players.
const { shuffle, findPlayer, cue } = require('./util');

let POOL = [];
try { POOL = require('../public/data/ipl-players.json'); } catch { POOL = []; }

const TEAMS = [
  { id: 'csk', name: 'Chennai Super Kings', short: 'CSK', color: '#F9CD05', ink: '#1c2a6b' },
  { id: 'mi', name: 'Mumbai Indians', short: 'MI', color: '#004BA0', ink: '#ffffff' },
  { id: 'rcb', name: 'Royal Challengers Bengaluru', short: 'RCB', color: '#D1001C', ink: '#ffffff' },
  { id: 'kkr', name: 'Kolkata Knight Riders', short: 'KKR', color: '#3A225D', ink: '#F2C14E' },
  { id: 'srh', name: 'Sunrisers Hyderabad', short: 'SRH', color: '#F26522', ink: '#111111' },
  { id: 'dc', name: 'Delhi Capitals', short: 'DC', color: '#17479E', ink: '#ffffff' },
  { id: 'pbks', name: 'Punjab Kings', short: 'PBKS', color: '#DD1F2D', ink: '#ffffff' },
  { id: 'rr', name: 'Rajasthan Royals', short: 'RR', color: '#EA1A85', ink: '#ffffff' },
  { id: 'gt', name: 'Gujarat Titans', short: 'GT', color: '#1B2133', ink: '#D8B26E' },
  { id: 'lsg', name: 'Lucknow Super Giants', short: 'LSG', color: '#0057A8', ink: '#ffffff' },
];

const TIMERS = [10, 15, 20, 30]; // seconds the host can choose; every bid resets the clock to full
const SOLD_MS = 4500;    // SOLD / UNSOLD announcement
const SET_ORDER = ['Batter', 'All-rounder', 'Wicket-keeper', 'Fast bowler', 'Spinner'];
const SET_NAMES = { Marquee: 'Marquee', Batter: 'Batters', 'All-rounder': 'All-rounders', 'Wicket-keeper': 'Wicket-keepers', 'Fast bowler': 'Fast bowlers', Spinner: 'Spinners' };

// money is kept in lakhs (1 crore = 100 lakhs) to avoid float errors
const increment = lakhs => (lakhs < 100 ? 5 : lakhs < 200 ? 10 : lakhs < 500 ? 20 : 25);

function buildLots(size) {
  const ranked = shuffle(POOL.slice()).sort((a, b) => (b.marquee - a.marquee) || (b.base - a.base));
  const chosen = size === 'full' ? ranked : ranked.slice(0, size);
  const marquee = shuffle(chosen.filter(p => p.marquee));
  const rest = chosen.filter(p => !p.marquee);
  // sets by role, highest base price first inside each set, like a real auction
  const lots = marquee.map(p => ({ id: p.id, set: 'Marquee' }));
  for (const role of SET_ORDER) {
    rest.filter(p => p.role === role).sort((a, b) => b.base - a.base || Math.random() - 0.5).forEach(p => lots.push({ id: p.id, set: role }));
  }
  return lots;
}

function nextLot(s) {
  s.lotIdx++;
  s.bid = null;
  s.bids = [];
  if (s.lotIdx >= s.lots.length) {
    s.phase = 'over';
    s.timerAt = null;
    cue(s, 'win');
    return;
  }
  s.phase = 'bidding';
  s.timerAt = Date.now() + s.opts.timer * 1000;
}

const player = id => POOL.find(p => p.id === id);

module.exports = {
  id: 'ipl',
  name: 'IPL Auction',
  blurb: 'Pick a franchise and bid for real cricketers with your purse. Live clock, SOLD announcements, squad limits.',
  minPlayers: 2,
  maxPlayers: 8,
  options: [
    { key: 'size', label: 'Players in auction', choices: [40, 80, 'full'], labels: ['Quick · 40', 'Standard · 80', 'Full'], default: 40 },
    { key: 'purse', label: 'Purse', choices: [60, 100, 120], labels: ['₹60 Cr', '₹100 Cr', '₹120 Cr'], default: 100 },
    { key: 'squad', label: 'Max squad', choices: [11, 15, 18], default: 15 },
    { key: 'timer', label: 'Bid timer', choices: TIMERS, default: 15, suffix: 's' },
  ],
  TEAMS,

  setup(players, opts = {}) {
    const size = opts.size === 'full' ? 'full' : [40, 80].includes(Number(opts.size)) ? Number(opts.size) : 40;
    const purse = [60, 100, 120].includes(Number(opts.purse)) ? Number(opts.purse) : 100;
    const squad = [11, 15, 18].includes(Number(opts.squad)) ? Number(opts.squad) : 15;
    const timer = TIMERS.includes(Number(opts.timer)) ? Number(opts.timer) : 15;
    return {
      players: players.map(p => ({ id: p.id, name: p.name, team: null, purse: purse * 100, squad: [] })),
      opts: { size, purse, squad, timer, overseas: Math.min(8, Math.floor(squad / 2)) },
      phase: 'teams', // teams -> bidding -> sold -> bidding ... -> over
      lots: buildLots(size),
      lotIdx: -1,
      bid: null, // { by: playerId, amount: lakhs }
      bids: [],
      last: null, // last result: { lot, by, amount } or { lot, unsold: true }
      history: [],
      paused: null,
    };
  },

  onTimer(s) {
    if (s.phase === 'bidding') {
      const lot = s.lots[s.lotIdx];
      if (s.bid) {
        const owner = s.players.find(p => p.id === s.bid.by);
        owner.purse -= s.bid.amount;
        owner.squad.push({ id: lot.id, price: s.bid.amount });
        s.last = { lot: lot.id, by: owner.id, team: owner.team, amount: s.bid.amount };
        cue(s, 'sold');
      } else {
        s.last = { lot: lot.id, unsold: true };
        cue(s, 'unsold');
      }
      s.history.push(s.last);
      s.phase = 'sold';
      s.timerAt = Date.now() + SOLD_MS;
    } else if (s.phase === 'sold') nextLot(s);
  },

  action(s, playerId, a, { isHost }) {
    const me = findPlayer(s, playerId);

    if (a.type === 'team') {
      if (s.phase !== 'teams') throw new Error('Teams are locked');
      const t = TEAMS.find(x => x.id === a.team);
      if (!t) throw new Error('Pick a team');
      if (s.players.some(p => p !== me && p.team === t.id)) throw new Error(`${t.short} is already taken`);
      me.team = t.id;
      cue(s, 'tap');
      return;
    }

    if (a.type === 'begin') {
      if (!isHost) throw new Error('Only the host can start the auction');
      if (s.phase !== 'teams') throw new Error('Auction already started');
      if (!s.players.every(p => p.team)) throw new Error('Everyone needs to pick a team first');
      if (!s.lots.length) throw new Error('No player data found');
      cue(s, 'reveal');
      nextLot(s);
      return;
    }

    if (a.type === 'bid') {
      if (s.phase !== 'bidding' || s.paused) throw new Error('No bidding right now');
      const lot = player(s.lots[s.lotIdx].id);
      const base = Math.round(lot.base * 100);
      const amount = s.bid ? s.bid.amount + increment(s.bid.amount) : base;
      // the client says which bid it saw, so two quick taps don't double-raise
      const seen = a.on == null ? null : Number(a.on);
      if (seen !== (s.bid ? s.bid.amount : null)) throw new Error('Someone bid first — try again');
      if (s.bid && s.bid.by === playerId) throw new Error('You are already the highest bidder');
      if (me.squad.length >= s.opts.squad) throw new Error('Your squad is full');
      if (lot.overseas && me.squad.filter(x => player(x.id).overseas).length >= s.opts.overseas) throw new Error(`Overseas limit (${s.opts.overseas}) reached`);
      if (amount > me.purse) throw new Error('Not enough purse left');
      s.bid = { by: playerId, amount };
      s.bids.push({ by: playerId, amount });
      if (s.bids.length > 12) s.bids.shift();
      s.timerAt = Date.now() + s.opts.timer * 1000; // full clock again after every bid
      cue(s, 'bid');
      return;
    }

    if (a.type === 'timer') {
      if (!isHost) throw new Error('Only the host can change the timer');
      const secs = Number(a.secs);
      if (!TIMERS.includes(secs)) throw new Error('Pick a timer length');
      s.opts.timer = secs;
      // apply straight away to the player on the block
      if (s.phase === 'bidding' && !s.paused) s.timerAt = Date.now() + secs * 1000;
      else if (s.paused) s.paused = secs * 1000;
      return;
    }

    if (a.type === 'pause') {
      if (!isHost) throw new Error('Only the host can pause');
      if (s.phase !== 'bidding') throw new Error('Nothing to pause');
      if (s.paused) { s.timerAt = Date.now() + s.paused; s.paused = null; }
      else { s.paused = Math.max(3000, s.timerAt - Date.now()); s.timerAt = null; }
      cue(s, 'tap');
      return;
    }

    if (a.type === 'end') {
      if (!isHost) throw new Error('Only the host can end the auction');
      s.phase = 'over';
      s.timerAt = null;
      cue(s, 'win');
      return;
    }

    if (a.type === 'rematch') {
      if (s.phase !== 'over') throw new Error('Auction not finished');
      if (!isHost) throw new Error('Only the host can restart');
      Object.assign(s, this.setup(s.players, s.opts));
      return;
    }

    throw new Error('Unknown action');
  },

  view(s, playerId) {
    const lot = s.lotIdx >= 0 && s.lotIdx < s.lots.length ? s.lots[s.lotIdx] : null;
    const cur = lot ? player(lot.id) : null;
    const me = s.players.find(p => p.id === playerId);
    const next = s.bid ? s.bid.amount + increment(s.bid.amount) : cur ? Math.round(cur.base * 100) : null;
    return {
      phase: s.phase,
      teams: TEAMS,
      timers: TIMERS,
      opts: s.opts,
      lotNumber: s.lotIdx + 1,
      lotCount: s.lots.length,
      set: lot ? SET_NAMES[lot.set] : null,
      current: cur,
      bid: s.bid,
      nextBid: next,
      bids: s.bids,
      paused: !!s.paused,
      last: s.last ? { ...s.last, player: player(s.last.lot) } : null,
      upcoming: s.lots.slice(s.lotIdx + 1, s.lotIdx + 4).map(l => player(l.id).name),
      me: me ? me.id : null,
      teamsPlayers: s.players.map(p => ({
        id: p.id,
        name: p.name,
        team: p.team,
        purse: p.purse,
        overseas: p.squad.filter(x => player(x.id).overseas).length,
        squad: p.squad.map(x => ({ ...player(x.id), price: x.price })),
      })),
    };
  },
};
