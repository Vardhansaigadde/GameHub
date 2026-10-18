const list = [
  require('./ipl'),
  require('./pictionary'),
  require('./housie'),
  require('./ashtachamma'),
  require('./dadi'),
  require('./show'),
  require('./emojimovie'),
  require('./mostlikely'),
  require('./sequence'),
  require('./rummy'),
  require('./bingo'),
  require('./ramsita'),
  require('./leastcount'),
];

module.exports = Object.fromEntries(list.map(g => [g.id, g]));
