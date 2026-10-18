const bingo = require('./bingo');
const ramsita = require('./ramsita');
const show = require('./show');

module.exports = { [bingo.id]: bingo, [ramsita.id]: ramsita, [show.id]: show };
