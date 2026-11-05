// Snakes & Ladders (Vaikunthapali): roll, climb ladders, slide down snakes.
// You need the exact roll to land on 100. A 6 gives another roll.
const { findPlayer, cue } = require('./util');

const LADDERS = { 4: 25, 13: 46, 33: 49, 42: 63, 50: 69, 62: 81, 74: 92 };
const SNAKES = { 27: 5, 40: 3, 43: 18, 54: 31, 66: 45, 76: 58, 89: 53, 99: 41 };
const FINISH = 100;

module.exports = {
  id: 'snakes',
  name: 'Snakes & Ladders',
  minPlayers: 2,
  maxPlayers: 6,
  LADDERS,
  SNAKES,

  setup(players) {
    return {
      players: players.map(p => ({ id: p.id, name: p.name, pos: 0 })),
      turn: 0,
      roll: null,
      rolls: 0,
      last: null, // { id, from, landed, to, kind } for the animation
      phase: 'play',
      winnerId: null,
      log: [],
    };
  },

  action(s, playerId, a, { isHost }) {
    const me = findPlayer(s, playerId);
    const log = t => { s.log.push(t); if (s.log.length > 5) s.log.shift(); };

    if (a.type === 'rematch') {
      if (s.phase !== 'over') throw new Error('Game not finished');
      if (!isHost) throw new Error('Only the host can start a rematch');
      Object.assign(s, this.setup(s.players));
      return;
    }

    if (a.type === 'skip') {
      if (!isHost) throw new Error('Only the host can skip a turn');
      if (s.phase === 'over') return;
      s.turn = (s.turn + 1) % s.players.length;
      return;
    }

    if (a.type === 'roll') {
      if (s.phase !== 'play') throw new Error('Game over');
      if (s.players[s.turn] !== me) throw new Error("It's not your turn");
      const roll = a.test && a.force ? Number(a.force) : 1 + Math.floor(Math.random() * 6);
      s.roll = roll;
      s.rolls++;
      cue(s, 'dice');
      const from = me.pos;
      const landed = from + roll;
      if (landed > FINISH) {
        s.last = { id: me.id, from, landed: from, to: from, kind: 'stay' };
        log(`${me.name} rolled ${roll} — needs exactly ${FINISH - from}`);
      } else {
        let to = landed, kind = 'step';
        if (LADDERS[landed]) { to = LADDERS[landed]; kind = 'ladder'; log(`${me.name} climbed a ladder to ${to}!`); cue(s, 'correct'); }
        else if (SNAKES[landed]) { to = SNAKES[landed]; kind = 'snake'; log(`${me.name} got bitten — down to ${to}!`); cue(s, 'cut'); }
        else log(`${me.name} rolled ${roll}`);
        me.pos = to;
        s.last = { id: me.id, from, landed, to, kind };
        if (to === FINISH) {
          s.phase = 'over';
          s.winnerId = me.id;
          cue(s, 'win');
          return;
        }
      }
      if (roll !== 6) s.turn = (s.turn + 1) % s.players.length;
      return;
    }

    throw new Error('Unknown action');
  },

  view(s) {
    return {
      phase: s.phase,
      turnId: s.phase === 'over' ? null : s.players[s.turn].id,
      roll: s.roll,
      rolls: s.rolls,
      last: s.last,
      winnerId: s.winnerId,
      log: s.log,
      ladders: LADDERS,
      snakes: SNAKES,
      players: s.players.map(p => ({ id: p.id, name: p.name, pos: p.pos })),
    };
  },
};
