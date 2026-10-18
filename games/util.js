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
