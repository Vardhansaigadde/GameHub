function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function findPlayer(state, playerId) {
  const p = state.players.find(x => x.id === playerId);
  if (!p) throw new Error('You are not in this game');
  return p;
}

module.exports = { shuffle, findPlayer };

// Sound cue for clients: bump a counter so every client plays `type` once.
function cue(state, type) {
  state.cue = { n: ((state.cue && state.cue.n) || 0) + 1, type };
}

// Loose answer matching for guessing games: ignores case, spaces and punctuation.
const normalize = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}
// 'exact' | 'close' | null
function matchGuess(guess, answers) {
  const g = normalize(guess);
  if (!g) return null;
  let close = false;
  for (const a of answers) {
    const n = normalize(a);
    if (g === n) return 'exact';
    const allowed = n.length >= 8 ? 2 : n.length >= 4 ? 1 : 0;
    const dist = editDistance(g, n);
    if (dist <= allowed) return 'exact'; // small typos still count
    if (dist <= allowed + 2) close = true;
  }
  return close ? 'close' : null;
}

module.exports.cue = cue;
module.exports.matchGuess = matchGuess;
module.exports.normalize = normalize;
