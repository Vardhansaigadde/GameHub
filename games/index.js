const housie = require('./housie');
const ashtachamma = require('./ashtachamma');
const dadi = require('./dadi');
const show = require('./show');
const bingo = require('./bingo');
const ramsita = require('./ramsita');
const leastcount = require('./leastcount');
const sequence = require('./sequence');
const rummy = require('./rummy');

module.exports = Object.fromEntries([housie, ashtachamma, dadi, show, sequence, rummy, bingo, ramsita, leastcount].map(g => [g.id, g]));
