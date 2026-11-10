/* Funny party games: Funny Fill-in, Story Chain, and Name, Place, Animal, Thing. */

const fnTag = g => `<span class="pill">Round ${g.round} of ${g.rounds}</span>`;
const fnHostNext = (g, last) => (isHost()
  ? `<button class="btn btn-primary btn-lg" data-next>${last ? 'See results' : 'Next round'} ${icon('arrow')}</button>`
  : `<span class="muted">${esc(nameOf(S.room.hostId))} starts the next round</span>`);

/* ======================= Funny Fill-in ======================= */
const fi = { key: null, written: [], voted: [], vote: -1, burst: false, focus: null };
const fiPrompt = (prompt, fill) => esc(prompt).split('___').join(fill !== undefined ? `<mark class="fi-fill">${fill}</mark>` : '<span class="fi-blank"></span>');

renderers.fillin = () => {
  const g = S.game;
  const key = `${g.round}:${g.phase}`;
  const fresh = key !== fi.key;
  if (fresh) { fi.key = key; fi.written = []; fi.voted = []; fi.vote = -1; }
  const wrap = body => `<div class="fn fi${fresh ? ' fn-fresh' : ''}">${body}</div>`;
  const time = g.endsAt ? timeBar(g.endsAt, g.totalMs) : '';

  if (g.phase === 'write') {
    const pills = ipPills(g, g.written, fi.written, fresh);
    fi.written = [...g.written];
    const typed = $('#fiInput') ? $('#fiInput').value : '';
    const form = g.myAnswer
      ? `<div class="fi-sent"><span class="fi-sent-label">${icon('check')} Your answer</span><b>${esc(g.myAnswer)}</b><button class="btn btn-sm btn-ghost" data-game="fillin" data-unanswer>${icon('pen')} Change</button></div>`
      : `<form class="fi-form join-row" data-fi-form><input id="fiInput" maxlength="80" autocomplete="off" placeholder="Your funniest answer…" aria-label="Your answer" value="${esc(typed)}"><button class="btn btn-primary" type="submit">${icon('send')} Send</button></form>`;
    return {
      tone: g.myAnswer ? '' : 'mine',
      turn: g.myAnswer ? `Waiting for the others… ${g.written.length} of ${g.players.length} in` : 'Fill in the blank. Make it funny!',
      body: wrap(`<div class="fn-top">${fnTag(g)}</div>
        <div class="fi-card"><span class="fi-quote" aria-hidden="true">“</span><p>${fiPrompt(g.prompt)}</p></div>
        ${form}${time}
        <div class="pass-status">${pills}</div>
        ${isHost() ? `<div class="actions"><button class="btn btn-sm btn-ghost" data-game="fillin" data-revealnow ${g.written.length ? '' : 'disabled'}>Start voting now</button></div>` : ''}`),
    };
  }

  if (g.phase === 'vote') {
    const just = !fresh && g.myVote >= 0 && g.myVote !== fi.vote;
    fi.vote = g.myVote;
    const notes = g.choices.map((t, i) => {
      const mine = i === g.mine;
      const on = g.myVote === i;
      return `<button class="fi-note c${i % 6} ${on ? 'on' : ''} ${just && on ? 'just' : ''}" style="--i:${i}" data-game="fillin" data-vote="${i}" ${mine ? 'disabled' : ''}>
        ${mine ? '<span class="fi-yours">Yours</span>' : ''}${on ? `<span class="fi-tick">${icon('check')}</span>` : ''}<span class="fi-note-text">${esc(t)}</span></button>`;
    }).join('');
    const pills = ipPills(g, g.voted, fi.voted, fresh);
    fi.voted = [...g.voted];
    return {
      tone: g.myVote >= 0 ? '' : 'mine',
      turn: g.myVote >= 0 ? `Voted — ${g.voted.length} in` : 'Vote for the funniest answer!',
      body: wrap(`<div class="fn-top">${fnTag(g)}</div>
        <div class="fi-card small"><p>${fiPrompt(g.prompt)}</p></div>
        <div class="fi-notes">${notes}</div>${time}
        <div class="pass-status">${pills}</div>
        ${isHost() ? `<div class="actions"><button class="btn btn-sm btn-ghost" data-game="fillin" data-revealnow ${g.voted.length ? '' : 'disabled'}>Reveal now</button></div>` : ''}`),
    };
  }

  if (g.phase === 'reveal') {
    const r = g.result;
    if (fresh && r.winners.length) fi.burst = true;
    const top = r.rows.find(x => x.winner);
    const notes = r.rows.map((row, i) => `<div class="fi-note fi-res c${i % 6} ${row.winner ? 'win' : ''}" style="--i:${i}">
        ${row.winner ? `<span class="fi-crown">${icon('crown')}</span>` : ''}
        <span class="fi-note-text">${esc(row.text)}</span>
        <span class="fi-by">${avatar(nameOf(row.id))}<b>${esc(nameOf(row.id))}</b><span class="fi-votes">${row.votes} vote${row.votes === 1 ? '' : 's'}</span>${row.pts ? `<span class="fi-pts">+${row.pts}</span>` : ''}</span></div>`).join('');
    return {
      tone: 'win',
      turn: r.winners.length > 1 ? `It's a ${r.winners.length}-way tie!` : top ? `${esc(nameOf(top.id))} wins the round!` : 'No votes this time',
      body: wrap(`<div class="fn-top">${fnTag(g)}</div>
        <div class="fi-card ${top ? 'winner' : 'small'}"><p>${top ? fiPrompt(g.prompt, esc(top.text)) : fiPrompt(g.prompt)}</p></div>
        <div class="fi-notes">${notes || '<p class="hint">Nobody answered this one.</p>'}</div>
        <div class="actions">${fnHostNext(g, g.round >= g.rounds)}</div>`),
    };
  }

  const fame = (g.best || []).map((b, i) => `<div class="fi-fame" style="--i:${i}"><p>${fiPrompt(b.prompt, esc(b.text))}</p><span>${avatar(nameOf(b.by))} ${esc(nameOf(b.by))} · ${b.votes} vote${b.votes === 1 ? '' : 's'}</span></div>`).join('');
  return {
    tone: 'win',
    turn: 'Game over! The best answers',
    body: wrap(`${fame ? `<h3 class="fn-title">${icon('trophy')} Hall of fame</h3><div class="fi-fames">${fame}</div>` : ''}
      <h3 class="fn-title">Final scores</h3>${scoreboard(g.scores)}<div class="actions">${rematchBtn()}</div>`),
  };
};

handlers.fillin = d => {
  if ('unanswer' in d) act({ type: 'unanswer' });
  else if ('vote' in d) act({ type: 'vote', index: +d.vote });
  else if ('revealnow' in d) act({ type: 'revealNow' });
};

/* ======================= Story Chain ======================= */
// one shared story: lines appear for everyone as they are written; only new lines animate
const st = { count: 0, game: null, focus: null };
const ST_LAUGH = '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M7 13.5a5 5 0 0 0 10 0z" fill="currentColor" stroke="none"/><path d="m8 8.5 2.2 1.3L8 11M16 8.5l-2.2 1.3L16 11"/></svg>';
const stWho = id => (id === S.you ? 'You' : esc(nameOf(id)));

function stLine(l, i, isNew) {
  if (l.skipped) return `<div class="st-line skipped ${isNew ? 'new' : ''}"><p>…and then ${esc(nameOf(l.by))} fell asleep.</p></div>`;
  const me = l.by === S.you;
  const laugh = l.auto ? '' : `<button class="st-laugh ${l.mine ? 'on' : ''}" data-game="story" data-laugh="${i}" ${me ? 'disabled' : ''} aria-pressed="${l.mine}" aria-label="Laugh at this line">${ST_LAUGH}${l.n ? `<b>${l.n}</b>` : ''}</button>`;
  return `<div class="st-line ${i === 0 ? 'first' : ''} ${isNew ? 'new' : ''}"><p>${esc(l.text)}</p>
    <span class="st-meta">${avatar(nameOf(l.by))}<span>${stWho(l.by)}${l.auto ? ' · a ready-made start' : ''}</span>${laugh}</span></div>`;
}

function stBook(g, fresh) {
  const start = fresh ? 0 : st.count;
  const lines = g.lines.map((l, i) => stLine(l, i, i >= start && !fresh)).join('');
  const writing = g.phase === 'write' && g.writerId
    ? `<div class="st-writing">${avatar(nameOf(g.writerId))}<span>${g.writerId === S.you ? 'Your turn to write…' : `${esc(nameOf(g.writerId))} is writing`}</span><span class="st-dots"><i></i><i></i><i></i></span></div>` : '';
  return `<div class="st-book" id="stBook"><div class="st-head">${g.phase === 'over' ? 'The End' : 'Our story'}</div>
    ${lines || '<p class="st-empty">The page is empty… someone is about to start the story!</p>'}${writing}</div>`;
}

renderers.story = () => {
  const g = S.game;
  const fresh = st.game !== g.seats.join() || g.lines.length < st.count;
  const book = stBook(g, fresh);
  st.count = g.lines.length;
  st.game = g.seats.join();

  if (g.phase === 'write') {
    const mine = g.writerId === S.you;
    const first = !g.lines.length;
    const typed = mine && $('#stInput') ? $('#stInput').value : '';
    const order = g.seats.map(id => `<span class="st-seat ${id === g.writerId ? 'now' : ''} ${id === g.nextId ? 'next' : ''}" title="${esc(nameOf(id))}">${avatar(nameOf(id))}<small>${id === S.you ? 'You' : esc(nameOf(id))}</small></span>`).join('<i class="st-arrow">›</i>');
    const form = mine
      ? `<form class="st-form" data-st-form>
          ${first && g.ideas ? `<div class="st-ideas"><span>Need an idea?</span>${g.ideas.map(t => `<button type="button" class="chip" data-game="story" data-idea="${esc(t)}">${esc(t)}</button>`).join('')}</div>` : ''}
          <textarea id="stInput" maxlength="140" rows="2" placeholder="${first ? 'Start the story…' : 'What happens next?'}" aria-label="${first ? 'The first line' : 'The next line'}">${esc(typed)}</textarea>
          <div class="st-row"><span class="st-count" id="stCount">${typed.length}/140</span><button class="btn btn-primary" type="submit">${icon('pen')} ${first ? 'Start the story' : 'Add my line'}</button></div></form>`
      : `<p class="st-wait">${g.nextId === S.you ? "You're next — read along and get your line ready!" : 'Read along — your turn will come round.'}</p>`;
    return {
      tone: mine ? 'mine' : 'live',
      turn: mine ? (first ? 'You start the story!' : 'Your turn — add the next line') : `${esc(nameOf(g.writerId))} is ${first ? 'starting the story' : 'adding a line'}…`,
      body: `<div class="fn st">
        <div class="fn-top"><span class="pill">Line ${g.turnNo} of ${g.totalTurns}</span><span class="pill">Round ${g.lap} of ${g.laps}</span></div>
        <div class="st-order">${order}</div>
        ${book}
        ${form}
        ${g.endsAt ? timeBar(g.endsAt, g.totalMs) : ''}</div>`,
    };
  }

  // the end: the finished story, the funniest line and the scores
  let best = null;
  g.lines.forEach(l => { if (!l.skipped && !l.auto && l.n && (!best || l.n > best.n)) best = l; });
  return {
    tone: 'win',
    turn: 'The end! Laugh at your favourite lines',
    body: `<div class="fn st ${fresh ? 'fn-fresh' : ''}">
      ${best ? `<div class="st-best"><span>${icon('trophy')} Funniest line</span><p>${esc(best.text)}</p><small>${esc(nameOf(best.by))} · ${best.n} laugh${best.n === 1 ? '' : 's'}</small></div>` : ''}
      ${book}
      <h3 class="fn-title">Scores</h3>${scoreboard(g.scores)}
      <div class="actions">${rematchBtn()}</div></div>`,
  };
};

handlers.story = d => {
  if ('laugh' in d) { act({ type: 'laugh', line: +d.laugh }); if (window.SFX) SFX.play('tap'); }
  else if ('idea' in d) { const t = $('#stInput'); if (t) { t.value = d.idea; t.focus(); const c = $('#stCount'); if (c) c.textContent = `${t.value.length}/140`; } }
};

/* ======================= Name, Place, Animal, Thing ======================= */
const NP_LABEL = { name: 'Name', place: 'Place', animal: 'Animal', thing: 'Thing' };
const NP_ICON = {
  name: '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  place: '<svg class="icon" viewBox="0 0 24 24"><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  animal: '<svg class="icon" viewBox="0 0 24 24"><circle cx="6" cy="10" r="2"/><circle cx="10" cy="5.5" r="2"/><circle cx="14" cy="5.5" r="2"/><circle cx="18" cy="10" r="2"/><path d="M12 11c-3 0-6 4.5-6 7 0 2 2 2.5 3 2s2-1 3-1 2 .5 3 1 3 0 3-2c0-2.5-3-7-6-7z"/></svg>',
  thing: '<svg class="icon" viewBox="0 0 24 24"><path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/></svg>',
};
const NP_LETTERS = 'ABCDEFGHIJKLMNOPRSTVW';
const np = { key: null, round: 0, vals: null, timers: {}, focus: null, burst: false };
const npNorm = t => String(t || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
const npOk = (g, t) => { const n = npNorm(t); return n.length >= 2 && n[0] === g.letter.toLowerCase(); };
const npState = (g, t) => (!t || !t.trim() ? '' : npOk(g, t) ? 'good' : 'wrong');

renderers.npat = () => {
  const g = S.game;
  if (np.round !== g.round) { np.round = g.round; np.vals = null; }
  if (!np.vals && g.myAnswers) np.vals = { ...g.myAnswers };
  const key = `${g.round}:${g.phase}:${g.stopBy || ''}`;
  const fresh = key !== np.key;
  np.key = key;
  const wrap = body => `<div class="fn np${fresh ? ' fn-fresh' : ''}">${body}</div>`;

  if (g.phase === 'spin') {
    const strip = [...NP_LETTERS, ...NP_LETTERS, g.spinLetter];
    return {
      tone: 'live',
      turn: 'Picking a letter…',
      body: wrap(`<div class="fn-top">${fnTag(g)}</div>
        <div class="np-spin"><div class="np-reel"><div class="np-strip" style="--n:${strip.length - 1}">${strip.map(l => `<span>${l}</span>`).join('')}</div></div><p>Get ready…</p></div>`),
    };
  }

  if (g.phase === 'write') {
    const allOk = g.cats.every(c => npOk(g, np.vals[c]));
    const cells = g.cats.map((c, i) => `<label class="np-cell ${npState(g, np.vals[c])}" style="--i:${i}" data-cell="${c}">
        <span class="np-ic">${NP_ICON[c]}</span><span class="np-lb">${NP_LABEL[c]}</span>
        <input data-np="${c}" maxlength="30" value="${esc(np.vals[c] || '')}" placeholder="${g.letter}…" autocomplete="off" autocapitalize="words" spellcheck="false" aria-label="${NP_LABEL[c]} starting with ${g.letter}"></label>`).join('');
    const stopped = g.stopBy
      ? `<div class="np-stopped">${icon('hand')} <b>${g.stopBy === S.you ? 'You' : esc(nameOf(g.stopBy))} pressed STOP!</b> <span class="np-secs secs" data-deadline="${g.endsAt}"></span></div>` : '';
    return {
      tone: g.stopBy ? 'alert' : 'live',
      turn: g.stopBy ? 'Quick! Finish your answers!' : `Words starting with ${g.letter} — go!`,
      body: wrap(`<div class="fn-top">${fnTag(g)}</div>
        <div class="np-head"><div class="np-letter">${g.letter}</div><div><b>Words starting with ${g.letter}</b><small>Fill all four, then hit STOP before anyone else</small></div></div>
        ${stopped}
        <div class="np-grid">${cells}</div>
        ${g.stopBy ? '' : `<div class="np-stop-wrap"><button class="np-stop" data-game="npat" data-stop ${allOk ? '' : 'disabled'}>STOP!</button></div>`}
        ${timeBar(g.endsAt, g.totalMs)}`),
    };
  }

  if (g.phase === 'check' || g.phase === 'result') {
    const result = g.phase === 'result';
    if (result && fresh) np.burst = true;
    const order = result ? [...g.players].sort((a, b) => g.roundPoints[b.id].total - g.roundPoints[a.id].total) : g.players;
    const topPts = result ? Math.max(...g.players.map(p => g.roundPoints[p.id].total)) : 0;
    const cards = order.map((p, pi) => {
      const rows = g.cats.map((c, ci) => {
        const a = g.table[p.id][c];
        const bad = !a.ok || a.out;
        const pts = result ? g.roundPoints[p.id][c] : null;
        const inner = `<span class="np-k">${NP_ICON[c]}</span><span class="np-t">${a.text ? esc(a.text) : '—'}</span>
          ${!result && a.flags ? `<span class="np-flags">${icon('flag')} ${a.flags}/${g.needed}</span>` : ''}
          ${result ? `<span class="np-pts p${pts}" style="--j:${pi * 4 + ci}">+${pts}</span>` : ''}`;
        const cls = `np-ans ${!a.text ? 'empty' : bad ? 'bad' : 'ok'} ${a.myFlag ? 'flagged' : ''}`;
        return !result && a.text && p.id !== S.you
          ? `<button class="${cls}" data-game="npat" data-flag="${p.id}:${c}" aria-pressed="${a.myFlag}" title="Tap to flag as fake">${inner}</button>`
          : `<div class="${cls}">${inner}</div>`;
      }).join('');
      const win = result && topPts > 0 && g.roundPoints[p.id].total === topPts;
      return `<div class="np-card ${p.id === S.you ? 'me' : ''} ${win ? 'win' : ''}" style="--i:${pi}">
        <div class="np-card-head">${avatar(p.name)}<b>${esc(p.name)}</b>${result ? `<span class="np-total">+${g.roundPoints[p.id].total}</span>` : ''}</div>${rows}</div>`;
    }).join('');
    return {
      tone: result ? 'win' : 'live',
      turn: result ? `Round ${g.round} scores` : 'Check the answers — tap any fake to flag it',
      body: wrap(`<div class="fn-top">${fnTag(g)}<span class="np-letter small">${g.letter}</span></div>
        ${result ? '' : `<p class="hint np-hint">Answers must start with <b>${g.letter}</b>. Tap someone's answer to flag it as fake — ${g.needed} flag${g.needed === 1 ? '' : 's'} knock${g.needed === 1 ? 's' : ''} it out.</p>`}
        <div class="np-cards">${cards}</div>
        ${result ? '' : timeBar(g.endsAt, g.totalMs)}
        <div class="actions">${result ? fnHostNext(g, g.round >= g.rounds) : isHost() ? `<button class="btn btn-primary btn-lg" data-game="npat" data-score>${icon('check')} Score it</button>` : ''}</div>`),
    };
  }

  return {
    tone: 'win',
    turn: 'Game over!',
    body: wrap(`<h3 class="fn-title">Final scores</h3>${scoreboard(g.scores)}<div class="actions">${rematchBtn()}</div>`),
  };
};

handlers.npat = d => {
  if ('stop' in d) act({ type: 'stop', answers: np.vals });
  else if ('flag' in d) { const [id, cat] = d.flag.split(':'); act({ type: 'flag', id, cat }); }
  else if ('score' in d) act({ type: 'score' });
};

/* ---------- typing, sending and focus for all three ---------- */
$('#stage').addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'stInput') { const c = $('#stCount'); if (c) c.textContent = `${t.value.length}/140`; return; }
  if (!t.dataset || !t.dataset.np) return;
  const g = S.game;
  if (!g || g.gameId !== 'npat' || !np.vals) return;
  const cat = t.dataset.np;
  np.vals[cat] = t.value;
  const cell = t.closest('.np-cell');
  if (cell) { cell.classList.remove('good', 'wrong'); const s = npState(g, t.value); if (s) cell.classList.add(s); }
  const stop = $('[data-stop]');
  if (stop) stop.disabled = !g.cats.every(c => npOk(g, np.vals[c]));
  clearTimeout(np.timers[cat]);
  np.timers[cat] = setTimeout(() => act({ type: 'fill', cat, text: np.vals[cat] }), 250);
});
$('#stage').addEventListener('focusin', e => { if (e.target.dataset && e.target.dataset.np) np.focus = e.target.dataset.np; });
$('#stage').addEventListener('submit', e => {
  if (e.target.matches('[data-fi-form]')) {
    e.preventDefault();
    const text = $('#fiInput').value.trim();
    if (text) act({ type: 'answer', text });
  } else if (e.target.matches('[data-st-form]')) {
    e.preventDefault();
    const text = $('#stInput').value.trim();
    if (text) act({ type: 'line', text });
  }
});
$('#stage').addEventListener('keydown', e => {
  if (e.target.id === 'stInput' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.target.form.requestSubmit(); }
});

afterRender.push(() => {
  const g = S.game;
  if (!g) return;
  // the screen redraws when others act, so take focus back whenever nothing else has it
  const focusOnce = (store, k, sel) => {
    const el = $(sel);
    if (!el) return;
    const a = document.activeElement;
    if (store.focus !== k || !a || a === document.body) {
      store.focus = k;
      el.focus();
      if (el.setSelectionRange) el.setSelectionRange(el.value.length, el.value.length);
    }
  };
  if (g.gameId === 'fillin') {
    if (g.phase === 'write' && !g.myAnswer) focusOnce(fi, `${g.round}`, '#fiInput');
    if (fi.burst) {
      fi.burst = false;
      setTimeout(() => { const el = $('.fi-res.win'); if (el && typeof FX !== 'undefined') FX.burst(el, ['#ffc83d', '#ff2e93', '#2fe07f', '#ffffff']); }, 900);
    }
  } else if (g.gameId === 'story') {
    if (g.phase === 'write' && g.writerId === S.you) focusOnce(st, `w${g.turnNo}`, '#stInput');
    // keep the newest line in view as the story grows
    const book = $('#stBook');
    if (book && g.lines.length !== st.scrolled) { st.scrolled = g.lines.length; book.scrollTop = book.scrollHeight; }
  } else if (g.gameId === 'npat') {
    if (g.phase === 'write') {
      const k = `${g.round}`;
      if (np.focus === null || np.focusRound !== k) { np.focusRound = k; np.focus = 'name'; }
      const el = document.querySelector(`[data-np="${np.focus}"]`);
      const a = document.activeElement;
      if (el && a !== el && !(a && a.matches('input, textarea') && !a.dataset.np)) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }
    if (np.burst) {
      np.burst = false;
      setTimeout(() => { const el = $('.np-card.win'); if (el && typeof FX !== 'undefined') FX.burst(el, ['#2fe07f', '#ffc83d', '#38c6ff', '#ffffff']); }, 700);
    }
  }
});
