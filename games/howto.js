// Short "How to play" steps and the home-page section for each game.
module.exports = {
  categories: [
    { id: 'drawing', name: 'Drawing games' },
    { id: 'party', name: 'Party games' },
    { id: 'paper', name: 'Paper & chits' },
    { id: 'board', name: 'Board games' },
    { id: 'cards', name: 'Card games' },
  ],
  games: {
    telephone: {
      cat: 'drawing',
      tagline: 'What you write is never what comes back',
      steps: [
        'Everyone secretly writes a funny sentence.',
        'Each sentence moves to the next player, who draws it.',
        'That drawing moves on, and the next player describes what they see.',
        'Keep going round. Then watch every chain unfold, with drawings replaying line by line, and tap the heart on anything funny.',
        'Each heart scores 100, the top entry in each story gets 50 more, and the highest score wins. Share your best story as one image.',
      ],
    },
    showdown: {
      cat: 'drawing',
      tagline: 'Same sentence. Very different drawings.',
      steps: [
        'Everyone gets the same funny sentence and draws it at the same time.',
        'When the timer ends, all the drawings are revealed together.',
        'Vote for your favourite. You cannot vote for your own.',
        'Each vote scores 100, and the favourite gets a bonus. Highest score wins.',
      ],
    },
    typing: {
      cat: 'party',
      tagline: 'Race, zap and duel with your keyboard',
      steps: [
        "The host picks the challenge. Kings' Battle (2 players): choose your king, and everything you type launches a random attack.",
        'Royal Duel (2 players): both get the same 3 words and 2 sentences. Whoever types it first strikes, and the first to win 3 rounds wins.',
        'Longer words hit harder, sentences hit hardest, and 5 in a row without a typo unleash an ultimate. Monster Raid: team up against three bosses.',
        'Car Race: type the paragraph and your car drives. First home wins, then second, third and so on. Word Rain: zap falling words.',
        'Speed Duel: one word or sentence at a time, fastest typists score most.',
        'Word Blitz (the whole group): the host sets any number of rounds. Everyone gets the same word, and the first to type it wins the round. Win in a row for bonus points.',
      ],
    },
    ludo: {
      cat: 'board',
      tagline: 'The classic race home',
      steps: [
        'Roll a 6 to bring a token out of your yard.',
        'Tap a glowing token to move it. A 6 rolls again (three 6s lose the turn).',
        'Land on an opponent to send them back and roll again. Star squares are safe.',
        'Bring all 4 tokens home with an exact roll to win.',
      ],
    },
    snakes: {
      cat: 'board',
      tagline: 'Climb ladders, dodge snakes',
      steps: [
        'Tap the dice on your turn. A 6 rolls again.',
        'Land on a ladder to climb up.',
        'Land on a snake\'s head and slide down.',
        'First to land exactly on 100 wins.',
      ],
    },
    colorclash: {
      cat: 'cards',
      tagline: 'Match, skip, reverse, +4!',
      steps: [
        'Play a card matching the colour or the value, or a wild card.',
        'Skip, Reverse and +2 mess with the next player. Wild +4 is the big one.',
        'No match? Draw a card, then play it or pass.',
        'One card left? Press ONE! before someone catches you for +2. Empty hand wins.',
      ],
    },
    connect4: {
      cat: 'board',
      tagline: 'Drop four in a line',
      steps: [
        'Take turns dropping a disc into a column.',
        'Discs fall to the lowest free slot.',
        'Four in a line wins: across, up or diagonal.',
      ],
    },
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
      cat: 'drawing',
      tagline: 'Draw it, guess it',
      steps: [
        'On your turn, pick 1 of 4 words and draw it. The host chooses the theme, and words get harder each round.',
        'Everyone else types guesses — faster guesses score more.',
        'The drawer scores for every correct guess — and a bonus if everyone gets it.',
        'Letters are revealed as hints while time runs out.',
      ],
    },
    emojimovie: {
      cat: 'party',
      tagline: 'Telugu movies in emojis',
      steps: [
        'A Telugu movie appears as emojis, like 🪰😡🔪.',
        'Type the movie name — small spelling mistakes are fine.',
        'As time runs down, hints appear one at a time in a random order: hero, heroine, director or release year.',
        'First correct answer gets 100, then 80, 65… Each hint showing takes 10 points off.',
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
    imposter: {
      cat: 'party',
      tagline: 'One of you has a different word…',
      steps: [
        'Everyone gets the same secret word except one player, who gets a similar one. Nobody knows who it is, not even the imposter.',
        'One by one, give a one-word clue about your word. Do not make it too obvious!',
        'Vote for who you think has the different word.',
        'Catch the imposter and everyone who voted for them scores. If the imposter escapes, they score big.',
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
