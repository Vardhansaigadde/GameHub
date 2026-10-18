const housie = require('./housie');
const ashtachamma = require('./ashtachamma');
const dadi = require('./dadi');
const bingo = require('./bingo');
const ramsita = require('./ramsita');
const show = require('./show');

module.exports = Object.fromEntries([housie, ashtachamma, dadi, bingo, ramsita, show].map(g => [g.id, g]));
