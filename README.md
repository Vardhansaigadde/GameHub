# 🎲 GameHub

Play the games we used to play on paper and with cards — **online, with friends in different places**.

| Game | Players | How it works |
|---|---|---|
| 🔢 **Bingo** | 2–8 | Fill your 5x5 grid with 1–25. Take turns calling numbers; everyone cuts them. Each full line = one letter of B‑I‑N‑G‑O. First to 5 lines wins. |
| 🏹 **Ramudu‑Seetha** | 3–6 | Everyone picks a secret chit. Ramudu (1000) must find Seetha. Right guess → Ramudu keeps 1000. Wrong → Seetha steals it. Others score their chit (Lakshmanudu 800, Hanumanthudu 500, Bharathudu 300, Shatrughnudu 200). 5 rounds. |
| 🃏 **Show** | 2–6 | 7 cards each, one Joker rank counts 0. On your turn throw a card (or several of the same rank), then pick from the deck or the open card. Call **SHOW** when you think your total is lowest — wrong call = +40. Lowest score after 5 rounds wins. |

There's also a chat box so you can tease Ramudu while he searches 😄

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
