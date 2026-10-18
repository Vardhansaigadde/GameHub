# 🎲 GameHub

Play the board, paper and card games we grew up with — **online, with friends in different places**.

| Game | Players | How it works |
|---|---|---|
| **IPL Auction** | 2–8 | Everyone picks a franchise (CSK, MI, RCB, KKR, SRH, DC, PBKS, RR, GT, LSG) and bids for real cricketers with a purse. Marquee set first, then batters, all-rounders, keepers, fast bowlers and spinners. Every bid resets the clock — "going once, going twice", then a live **SOLD to …** announcement (spoken aloud) with the player's photo. Squad and overseas limits; host can pause or end. |
| **Draw & Guess** | 2–8 | skribbl-style: the drawer picks 1 of 4 random words (a Telugu movie, a food or an everyday thing) and draws it with pens, colours, fill, eraser and undo. Others type guesses — faster guesses score more, the drawer scores for each correct guess, and letters are revealed as hints. Works with a finger on phones. |
| **Emoji Movie Guess** | 2–8 | A Telugu movie as emojis (🪰😡🔪 = *Eega*). Type the name — first correct answer gets 100, then 80, 65… Small typos are accepted; a hint appears halfway. 88 movies. |
| **Who's Most Likely To** | 3–8 | Everyone writes their own questions ("…fall asleep in a movie?"), then votes anonymously on each one. Results are revealed as bars and the winner gets the title. Bonus "mind reader" points for voting with the group. |
| **Housie** | 2–8 | Tambola. Everyone gets a printed-style ticket; the host calls numbers (or turns on auto-call). Daub your numbers and claim Early Five, Top/Middle/Bottom Line, Four Corners and Full House. Wrong claim = Bogey! |
| **Ashta Chamma** | 2–4 | Throw 4 cowrie shells (1–3, Chamma = 4, Ashta = 8). Pawns start off the board and enter only on a 4 or 8. Race round the outer ring, then the inner ring, to the centre. Cut an opponent before entering the inner ring. 4, 8 and cuts give another throw. |
| **Dadi** | 2 | Nine Men's Morris. Place 9 pieces, then slide them. Three in a line removes an opponent piece; with 3 left you can jump. Under 3 pieces or stuck = you lose. Offer a draw any time; the game is also drawn after 50 moves with no capture. |
| **Show** | 3–8 | Everyone writes one word; each word goes on 4 chits, all chits are mixed and dealt 4 each. Everyone picks a chit and they all pass to the next player in joining order at once (the last player passes to the first). Collect 4 of the same word and press SHOW — 1st place. Everyone else races to press SHOW for 2nd, 3rd, 4th… Marks per round: 4 players = 1000 / 750 / 500 / 250. |
| **Sequence** | 2–6 | 13 cards each. A joker number is picked but kept hidden — show a pure sequence (e.g. 5‑6‑7 of hearts) to see it, then those cards are wild for you. Finish with all 13 cards in sequences plus at most one "dummy" set (same number, different suits, 3 or 4 cards); at least one sequence must be pure. Drop: 20 / 40, wrong declare: 80. Lowest total after 5 rounds wins. |
| **13-Card Rummy** | 2–6 | Indian rummy: wild joker open from the start plus printed jokers. Declare with at least 2 sequences (1 pure); the rest sequences or sets. Same drop / wrong-declare / scoring as Sequence. |
| **Bingo** | 2–8 | Write 1–25 on your notebook grid. Take turns calling numbers; everyone cuts them. Each full line = one letter of B‑I‑N‑G‑O. First to 5 lines wins. |
| **Ramudu‑Seetha** | 3–6 | Everyone picks a folded chit. Ramudu (1000) must find Seetha. Right guess → Ramudu keeps 1000. Wrong → Seetha takes it. Others score their chit (Lakshmanudu 800, Hanumanthudu 500, Bharathudu 300, Shatrughnudu 200). 5 rounds. |
| **Least Count** | 2–6 | 7 cards each, one Joker rank counts 0. Throw a card (or several of the same rank), then pick from the deck or the open card. Call SHOW when you think your total is lowest — wrong call = +40. Lowest score after 5 rounds wins. |

Every room has chat, **emoji reactions** that float across everyone's screen, and **sounds** (dice, cards, bids, SOLD gavel, correct guesses…) with a mute button in the top bar.

### Dumb Charades (Telugu movies)

On the home page, **Dumb Charades** gives random Telugu movie names for playing in person — no room needed. Tap *Show* so only the actor sees the movie, run the 60/90/120 s timer, and keep Team A / Team B scores. *Easy* uses films from 1995 onward that have their own Wikipedia page; *All movies* uses the full list. After the first visit it also works offline.

The list (`public/data/telugu-movies.json`, 5,360 films from 1931 to 2026) is built from Wikipedia's year-by-year "List of Telugu films of …" pages. Run `npm run movies` to refresh it.

## On phones

GameHub is built for phones too: a bottom tab bar switches between **Game**, **Players** and **Chat** (with an unread badge), the main buttons stay pinned above it, **Share invite** opens WhatsApp and other apps, and your phone vibrates when it's your turn. In Chrome or Safari choose **Add to Home Screen** to install it like an app.

## Run it on your computer

```bash
npm install
npm start
```

Open http://localhost:3000, enter your name, **Create a room**, and share the 4-letter code or invite link.

## Put it online for free (Render)

1. Create a GitHub account and a new empty repository called `gamehub`.
2. Push this folder to it:
   ```bash
   git remote add origin https://github.com/<your-username>/gamehub.git
   git push -u origin main
   ```
3. Go to https://render.com → sign in with GitHub → **New → Blueprint** → pick the `gamehub` repo. It reads `render.yaml` and deploys automatically.
4. You get a link like `https://gamehub-xxxx.onrender.com` — send it to your friends!

Note: the free plan sleeps after ~15 minutes with no one playing, so the first visit can take ~30–50 seconds to wake up.

## Adding a new game

Each game is one file in `games/` with `setup`, `action` and `view` functions, plus a renderer in `public/app.js`. Register it in `games/index.js`.

## IPL player data

`public/data/ipl-players.json` is built from `scripts/ipl/players.txt` (names, roles, game base prices) plus Wikipedia for each player's free-licensed photo (Wikimedia Commons, credited on screen), batting/bowling style and age. Edit the list and run `node scripts/ipl/fetch-players.js` to refresh it. Team names are used for fun only — no logos.
