/* IPL Auction */
ICON_PATHS.plane = '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>';
ICON_PATHS.gavel = '<path d="m14.5 12.5-8 8a2.12 2.12 0 1 1-3-3l8-8"/><path d="m16 16 6-6"/><path d="m8 8 6-6"/><path d="m9 7 8 8"/><path d="m21 11-8-8"/>';

const money = lakhs => (lakhs >= 100 ? `₹${(lakhs / 100).toFixed(2).replace(/\.?0+$/, '')} Cr` : `₹${lakhs} L`);
const moneyWords = lakhs => {
  const cr = Math.floor(lakhs / 100), l = lakhs % 100;
  return [cr ? `${cr} crore` : '', l ? `${l} lakh` : ''].filter(Boolean).join(' ') || 'zero';
};
const teamOf = (g, id) => g.teams.find(t => t.id === id);
const tbadge = (t, big) => (t ? `<span class="tbadge ${big ? 'big' : ''}" style="--tc:${t.color};--ti:${t.ink}">${t.short}</span>` : '');

function photo(p, cls = '') {
  const initials = p.name.split(' ').map(w => w[0]).join('').slice(0, 2);
  return `<div class="ipl-photo ${cls}">${p.img ? `<img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}<span>${esc(initials)}</span></div>`;
}

function playerFacts(p) {
  const age = p.born ? new Date().getFullYear() - p.born : null;
  return `<div class="facts">
    <span class="chip-role">${esc(p.role)}</span>
    <span>${esc(p.country)}</span>
    ${p.overseas ? `<span class="tag-os">${icon('plane')} Overseas</span>` : ''}
    ${age ? `<span>Age ${age}</span>` : ''}
  </div>
  ${p.batting || p.bowling ? `<div class="styles">${p.batting ? `<span>Bat: ${esc(p.batting)}</span>` : ''}${p.bowling ? `<span>Bowl: ${esc(p.bowling)}</span>` : ''}</div>` : ''}`;
}

ui.iplSaid = null;

renderers.ipl = () => {
  const g = S.game;
  const me = g.teamsPlayers.find(p => p.id === S.you);
  const myTeam = me && teamOf(g, me.team);

  if (g.phase === 'teams') {
    const taken = Object.fromEntries(g.teamsPlayers.filter(p => p.team).map(p => [p.team, p]));
    const tiles = g.teams.map(t => {
      const owner = taken[t.id];
      const mine = owner && owner.id === S.you;
      return `<button class="team-tile ${mine ? 'mine' : ''}" style="--tc:${t.color};--ti:${t.ink}" data-game="ipl" data-team="${t.id}" ${owner && !mine ? 'disabled' : ''}>
        ${tbadge(t, true)}<span class="tname">${esc(t.name)}</span>
        <span class="towner">${owner ? (mine ? 'Your team' : esc(owner.name)) : 'Available'}</span></button>`;
    }).join('');
    const ready = g.teamsPlayers.every(p => p.team);
    return {
      tone: me.team ? '' : 'mine',
      turn: me.team ? `You are ${esc(myTeam.name)}. Waiting for others to pick…` : 'Pick your franchise',
      body: `<div class="team-grid">${tiles}</div>
        <p class="hint">Purse ${money(g.opts.purse * 100)} each · squad up to ${g.opts.squad} · max ${g.opts.overseas} overseas · ${g.lotCount} players in the auction</p>
        ${isHost() ? `<div class="actions sticky-actions"><button class="btn btn-primary btn-lg" data-game="ipl" data-begin ${ready ? '' : 'disabled'}>${icon('gavel')} Start the auction</button></div>` : ''}`,
    };
  }

  const purses = g.teamsPlayers.map(p => {
    const t = teamOf(g, p.team);
    const leading = g.bid && g.bid.by === p.id;
    return `<div class="purse ${leading ? 'leading' : ''} ${p.id === S.you ? 'me' : ''}" style="--tc:${t.color}">
      ${tbadge(t)}<div><b>${money(p.purse)}</b><small>${p.squad.length}/${g.opts.squad} · ${p.overseas}/${g.opts.overseas} ✈</small></div></div>`;
  }).join('');

  if (g.phase === 'over') {
    const all = g.teamsPlayers.flatMap(p => p.squad.map(x => ({ ...x, team: p.team })));
    const top = all.sort((a, b) => b.price - a.price)[0];
    const squads = g.teamsPlayers.map(p => {
      const t = teamOf(g, p.team);
      const spent = g.opts.purse * 100 - p.purse;
      return `<div class="squad-card" style="--tc:${t.color};--ti:${t.ink}">
        <div class="squad-head">${tbadge(t)}<div><b>${esc(t.name)}</b><small>${esc(p.name)} · spent ${money(spent)} · left ${money(p.purse)}</small></div></div>
        ${p.squad.length ? `<ul>${p.squad.sort((a, b) => b.price - a.price).map(x => `<li>${photo(x, 'xs')}<span class="nm">${esc(x.name)}<small>${esc(x.role)}${x.overseas ? ' · ✈' : ''}</small></span><b>${money(x.price)}</b></li>`).join('')}</ul>` : '<p class="muted">No players bought</p>'}
      </div>`;
    }).join('');
    return {
      tone: 'win',
      turn: 'Auction complete!',
      body: `${top ? `<div class="headline">${photo(top, 'sm')}<div><small>Most expensive buy</small><b>${esc(top.name)}</b><span>${money(top.price)} · ${esc(teamOf(g, top.team).name)}</span></div></div>` : ''}
        <div class="squads">${squads}</div>
        <div class="actions">${rematchBtn()}</div>`,
    };
  }

  const p = g.phase === 'sold' && g.last ? g.last.player : g.current;
  const lead = g.bid && teamOf(g, g.teamsPlayers.find(x => x.id === g.bid.by).team);

  // announcement overlay after the hammer falls
  let overlay = '';
  if (g.phase === 'sold' && g.last) {
    const t = g.last.team && teamOf(g, g.last.team);
    const key = `${g.lotNumber}:${g.last.unsold ? 'u' : g.last.amount}`;
    const fresh = ui.iplSaid !== key ? 'fresh' : ''; // animate once, not on every re-render
    overlay = g.last.unsold
      ? `<div class="sold-overlay unsold ${fresh}"><div class="stamp">UNSOLD</div><div class="sold-line">${esc(p.name)} goes back to the pool</div></div>`
      : `<div class="sold-overlay ${fresh}" style="--tc:${t.color};--ti:${t.ink}"><div class="stamp">SOLD!</div>${photo(p, 'md')}<div class="sold-line"><b>${esc(p.name)}</b> to <b>${esc(t.name)}</b></div><div class="sold-price">${money(g.last.amount)}</div></div>`;
    if (ui.iplSaid !== key) {
      ui.iplSaid = key;
      SFX.say(g.last.unsold ? `${p.name}, unsold.` : `Sold! ${p.name} to ${t.name}, for ${moneyWords(g.last.amount)}.`);
    }
  }

  // why can't I bid?
  let why = '';
  if (g.paused) why = 'Auction paused';
  else if (g.phase !== 'bidding') why = 'Next player coming up…';
  else if (g.bid && g.bid.by === S.you) why = 'You are the highest bidder';
  else if (me.squad.length >= g.opts.squad) why = 'Your squad is full';
  else if (p.overseas && me.overseas >= g.opts.overseas) why = 'Overseas limit reached';
  else if (g.nextBid > me.purse) why = 'Not enough purse';

  const feed = g.bids.slice().reverse().map(b => {
    const t = teamOf(g, g.teamsPlayers.find(x => x.id === b.by).team);
    return `<li>${tbadge(t)} <span>${money(b.amount)}</span></li>`;
  }).join('');

  return {
    tone: g.phase === 'sold' ? 'win' : why ? '' : 'mine',
    turn: g.phase === 'sold' ? (g.last.unsold ? `${esc(p.name)} — unsold` : `SOLD to ${esc(teamOf(g, g.last.team).name)}!`)
      : g.paused ? 'Auction paused by the host'
      : lead ? `${esc(lead.name)} leads at ${money(g.bid.amount)}` : `Bidding opens at ${money(Math.round(p.base * 100))}`,
    body: `<div class="ipl-top"><span class="set-chip">${esc(g.set || '')}</span><span class="muted">Player ${g.lotNumber} of ${g.lotCount}</span>${g.upcoming.length ? `<span class="muted next-up">Next: ${g.upcoming.map(esc).join(', ')}</span>` : ''}</div>
      <div class="auction">
        <div class="lot-card">
          ${photo(p, 'lg')}
          <div class="lot-info">
            <h2>${esc(p.name)}</h2>
            ${playerFacts(p)}
            <div class="base">Base price <b>${money(Math.round(p.base * 100))}</b></div>
            ${p.credit ? `<a class="credit" href="${esc(p.credit)}" target="_blank" rel="noopener">Photo: Wikimedia Commons</a>` : ''}
          </div>
          ${overlay}
        </div>
        <div class="bid-panel">
          <div class="cur-label">${g.bid ? 'Current bid' : 'No bids yet'}</div>
          <div class="cur-bid">${g.bid ? money(g.bid.amount) : money(Math.round(p.base * 100))}</div>
          <div class="cur-team">${lead ? `${tbadge(lead)} ${esc(lead.name)}` : '<span class="muted">Opening bid at base price</span>'}</div>
          ${g.phase === 'bidding' && !g.paused ? `<div class="clock"><div class="timebar"><span data-deadline="${g.timerAt}" data-total="12000"></span></div><div class="going" data-going="${g.timerAt}"></div></div>` : ''}
          <button class="btn btn-xl bid-btn" style="--tc:${myTeam.color};--ti:${myTeam.ink}" data-game="ipl" data-bid="${g.bid ? g.bid.amount : ''}" ${why ? 'disabled' : ''}>
            ${why ? esc(why) : `Bid ${money(g.nextBid)}`}
          </button>
          <ul class="bid-feed">${feed}</ul>
          ${isHost() ? `<div class="actions host-row"><button class="btn btn-sm" data-game="ipl" data-pause>${g.paused ? `${icon('play')} Resume` : `${icon('pause')} Pause`}</button><button class="btn btn-sm btn-ghost" data-game="ipl" data-end>End auction</button></div>` : ''}
        </div>
      </div>
      <div class="purses">${purses}</div>
      ${me.squad.length ? `<details class="my-squad"><summary>${tbadge(myTeam)} Your squad (${me.squad.length})</summary><ul>${me.squad.map(x => `<li>${photo(x, 'xs')}<span class="nm">${esc(x.name)}<small>${esc(x.role)}</small></span><b>${money(x.price)}</b></li>`).join('')}</ul></details>` : ''}`,
  };
};

handlers.ipl = d => {
  if ('team' in d) act({ type: 'team', team: d.team });
  else if ('begin' in d) act({ type: 'begin' });
  else if ('bid' in d) act({ type: 'bid', on: d.bid === '' ? null : +d.bid });
  else if ('pause' in d) act({ type: 'pause' });
  else if ('end' in d) { if (confirm('End the auction now?')) act({ type: 'end' }); }
};

// "Going once… going twice…" text while the clock runs down
setInterval(() => {
  for (const el of document.querySelectorAll('[data-going]')) {
    const left = +el.dataset.going - serverNow();
    el.textContent = left < 2000 ? 'Going twice…' : left < 4000 ? 'Going once…' : '';
  }
}, 200);
