/* "What's new" animations for games whose screens are redrawn on every update.
   After each redraw, anything that wasn't on the previous screen gets a short entrance:
   a newly called Housie ball rolls in, a fresh daub stamps, a struck Bingo number gets its line
   drawn, and cards arriving in your hand are dealt in. Things already on screen stay still. */
(() => {
  const RULES = [
    { games: ['housie'], sel: '.housie-head .ball', cls: 'px-roll' },
    { games: ['housie'], sel: '.recent .ball', cls: 'px-slide' },
    { games: ['housie'], sel: '.num-board span.on', cls: 'px-pop' },
    { games: ['housie'], sel: '.tcell.daub', cls: 'px-daub' },
    { games: ['housie'], sel: '.prize-table .won-by', cls: 'px-stamp' },
    { games: ['bingo'], sel: '.bcell.cut', cls: 'px-strike' },
    { games: ['bingo'], sel: '.bingo-word span.done', cls: 'px-letter' },
    { games: ['leastcount', 'rummy', 'sequence'], sel: '.hand:not(.mini-hand) .playing-card', cls: 'px-deal', first: true },
    { games: ['leastcount', 'rummy', 'sequence'], sel: '.table-area .playing-card:not(.back)', cls: 'px-drop' },
    { games: ['rummy', 'sequence'], sel: '.meld', cls: 'px-pop' },
  ];
  const prev = new Map();
  let game = null;

  // a stable name for each element: its data, its text, and how many identical ones came before it
  function keysOf(els) {
    const seen = {};
    return els.map(el => {
      const base = `${el.dataset.card || el.dataset.mark || ''}|${el.textContent.trim().slice(0, 40)}`;
      seen[base] = (seen[base] || 0) + 1;
      return `${base}#${seen[base]}`;
    });
  }

  afterRender.push(() => {
    const g = S && S.game;
    if (!g) { game = null; prev.clear(); return; }
    if (g.gameId !== game) { game = g.gameId; prev.clear(); }
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    RULES.forEach((rule, i) => {
      if (!rule.games.includes(g.gameId)) return;
      const els = [...document.querySelectorAll(`#stage ${rule.sel}`)];
      const keys = keysOf(els);
      const before = prev.get(i);
      prev.set(i, new Set(keys));
      if (calm || (!before && !rule.first)) return;
      let n = 0;
      els.forEach((el, k) => {
        if (before && before.has(keys[k])) return;
        el.style.setProperty('--px', Math.min(n++, 14));
        el.classList.add(rule.cls);
      });
    });
  });
})();
