# 🎲 GameHub

Play the board, paper and card games we grew up with — **online, with friends in different places**.

| Game | Players | How it works |
|---|---|---|
| **Housie** | 2–8 | Tambola. Everyone gets a printed-style ticket; the host calls numbers (or turns on auto-call). Daub your numbers and claim Early Five, Top/Middle/Bottom Line, Four Corners and Full House. Wrong claim = Bogey! |
| **Ashta Chamma** | 2–4 | Throw 4 cowrie shells (1–3, Chamma = 4, Ashta = 8). Pawns start off the board and enter only on a 4 or 8. Race round the outer ring, then the inner ring, to the centre. Cut an opponent before entering the inner ring. 4, 8 and cuts give another throw. |
| **Dadi** | 2 | Nine Men's Morris. Place 9 pieces, then slide them. Three in a line removes an opponent piece; with 3 left you can jump. Under 3 pieces or stuck = you lose. Offer a draw any time; the game is also drawn after 50 moves with no capture. |
| **Show** | 3–8 | Everyone writes one word; each word goes on 4 chits, all chits are mixed and dealt 4 each. Everyone picks a chit and they all pass to the next player at once. Collect 4 of the same word and press SHOW — 1st place. Everyone else races to press SHOW for 2nd, 3rd, 4th… Marks per round: 4 players = 1000 / 750 / 500 / 250. |
| **Bingo** | 2–8 | Write 1–25 on your notebook grid. Take turns calling numbers; everyone cuts them. Each full line = one letter of B‑I‑N‑G‑O. First to 5 lines wins. |
| **Ramudu‑Seetha** | 3–6 | Everyone picks a folded chit. Ramudu (1000) must find Seetha. Right guess → Ramudu keeps 1000. Wrong → Seetha takes it. Others score their chit (Lakshmanudu 800, Hanumanthudu 500, Bharathudu 300, Shatrughnudu 200). 5 rounds. |
| **Least Count** | 2–6 | 7 cards each, one Joker rank counts 0. Throw a card (or several of the same rank), then pick from the deck or the open card. Call SHOW when you think your total is lowest — wrong call = +40. Lowest score after 5 rounds wins. |

There's also a chat box in every room.

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
