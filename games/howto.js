// Short "How to play" steps and the home-page section for each game.
module.exports = {
  categories: [
    { id: 'party', name: 'Party games' },
    { id: 'paper', name: 'Paper & chits' },
    { id: 'board', name: 'Board games' },
    { id: 'cards', name: 'Card games' },
  ],
  games: {
    ipl: {
      cat: 'party',
      tagline: 'Build your dream IPL squad',
      steps: [
        'Everyone picks a franchise — CSK, MI, RCB and more.',
        'Players come up one by one. Anyone can bid at any time.',
        'Every bid resets the clock. When it runs out, the highest bidder gets the player.',
        'Watch your purse, squad size and overseas limit.',
      ],
    },
    pictionary: {
      cat: 'party',
      tagline: 'Draw it, guess it',
      steps: [
        'On your turn, pick 1 of 4 words and draw it.',
        'Everyone else types guesses — faster guesses score more.',
        'The drawer scores for every player who guesses right.',
        'Letters are revealed as hints while time runs out.',
      ],
    },
    emojimovie: {
      cat: 'party',
      tagline: 'Telugu movies in emojis',
      steps: [
        'A Telugu movie appears as emojis, like 🪰😡🔪.',
        'Type the movie name — small spelling mistakes are fine.',
        'First correct answer gets 100, then 80, 65…',
        'A hint shows up halfway through.',
      ],
    },
    mostlikely: {
      cat: 'party',
      tagline: 'Who in the gang would…?',
      steps: [
        'Everyone writes questions: "Who\'s most likely to…?"',
        'Vote secretly for one player on each question.',
        'Results are revealed — the top pick gets the title.',
        'Vote with the group to earn mind-reader points.',
      ],
    },
    housie: {
      cat: 'paper',
      tagline: 'Tambola with the gang',
      steps: [
        'Everyone gets a ticket with 15 numbers.',
        'The host calls numbers — tap them on your ticket.',
        'Claim Early Five, a Line, Four Corners or Full House.',
        'Claim too early and it\'s a Bogey!',
      ],
    },
    show: {
      cat: 'paper',
      tagline: 'Pass chits, collect four',
      steps: [
        'Everyone writes one word; it goes on 4 chits.',
        'Chits are mixed and dealt — 4 each.',
        'Everyone passes one chit to the next player at the same time.',
        'Collect 4 of the same word and hit SHOW. Others race for 2nd, 3rd…',
      ],
    },
    bingo: {
      cat: 'paper',
      tagline: 'Notebook Bingo, 1 to 25',
      steps: [
        'Write numbers 1–25 on your grid (or fill randomly).',
        'Take turns calling a number — everyone cuts it.',
        'Each full row, column or diagonal is a letter of BINGO.',
        'First to 5 lines wins.',
      ],
    },
    ramsita: {
      cat: 'paper',
      tagline: 'Ramudu, find Seetha!',
      steps: [
        'Everyone picks a folded chit with a secret role.',
        'Ramudu reveals himself and guesses who is Seetha.',
        'Right guess: Ramudu keeps 1000. Wrong: Seetha takes it.',
        'Everyone else scores their chit. 5 rounds.',
      ],
    },
    ashtachamma: {
      cat: 'board',
      tagline: 'Throw the shells, race home',
      steps: [
        'Throw 4 shells: 1–3 up moves that many, all 4 = 4, none = 8.',
        'A pawn enters the board only on a 4 or 8.',
        'Go round the outer ring, then the inner ring, to the centre.',
        'Cut an opponent before entering the inner ring. Crossed squares are safe.',
      ],
    },
    dadi: {
      cat: 'board',
      tagline: 'Three in a row',
      steps: [
        'Take turns placing your 9 pieces.',
        'Then slide them along the lines to a free point.',
        'Three in a line lets you remove an opponent\'s piece.',
        'Fewer than 3 pieces or no move left — you lose.',
      ],
    },
    sequence: {
      cat: 'cards',
      tagline: 'Rummy with a hidden joker',
      steps: [
        'Each player gets 13 cards. Pick one, throw one each turn.',
        'Show a pure sequence (like 5‑6‑7 ♥) to see the hidden joker.',
        'Finish with sequences and at most one dummy set, then Declare.',
        'Lowest points after 5 rounds wins.',
      ],
    },
    rummy: {
      cat: 'cards',
      tagline: 'Classic Indian rummy',
      steps: [
        'Each player gets 13 cards. Pick one, throw one each turn.',
        'Group cards into sequences and sets (jokers are wild).',
        'You need 2 sequences, one of them pure, to Declare.',
        'Lowest points after 5 rounds wins.',
      ],
    },
    leastcount: {
      cat: 'cards',
      tagline: 'Keep your total lowest',
      steps: [
        'Each player gets 7 cards. One rank is the joker (0 points).',
        'Throw a card (or a pair), then pick one up.',
        'Think your total is lowest? Call SHOW.',
        'Wrong call costs 40. Lowest total after 5 rounds wins.',
      ],
    },
  },
};
