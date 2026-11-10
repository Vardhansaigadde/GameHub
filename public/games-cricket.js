/* Hand Cricket: pick 1 to 6; same number as the bowler and you're out. */

const hc = { key: null, fx: null };
const HC_BAT = '<svg class="icon" viewBox="0 0 24 24"><path d="M14.5 3.5l6 6-9.5 9.5a2 2 0 0 1-2.8 0L5 15.8a2 2 0 0 1 0-2.8z"/><path d="M5.5 15.5 2 19l3 3 3.5-3.5"/></svg>';
const HC_BALL = '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M5.5 6.5c3 3 3 8 0 11M18.5 6.5c-3 3-3 8 0 11"/></svg>';
const hcName = (g, id) => (id === S.you ? 'You' : esc(g.names[id] || '?'));
const hcSide = (g, side) => esc(g.sideNames[side] || side);
const hcOvers = balls => `${Math.floor(balls / 6)}.${balls % 6}`;
const hcFingers = n => `<span class="hc-fingers">${'<i></i>'.repeat(n)}</span>`;

function hcThisOver(g, i) {
  const start = g.gap && i.balls > 0 && i.balls % 6 === 0 ? i.balls - 6 : i.balls - (i.balls % 6);
  const done = i.log.slice(start);
  const dots = done.map(v => `<span class="hc-dot ${v === 'W' ? 'w' : v >= 4 ? 'b' + v : ''}">${v === 'W' ? 'W' : v}</span>`);
  while (dots.length < 6) dots.push('<span class="hc-dot empty"></span>');
  return dots.join('');
}

const hcFormat = g => (g.overs ? `${g.overs} over${g.overs === 1 ? '' : 's'}` : 'Test match · till all out');

function hcBoard(g) {
  const i = g.inns[g.innings - 1];
  const left = g.overs ? g.overs * 6 - i.balls : null;
  const need = g.innings === 2 ? g.target - i.runs : 0;
  const chase = g.innings === 2
    ? `<div class="hc-chase">${i.runs >= g.target ? '<b>Target reached!</b>' : left === null
      ? `Need <b>${need}</b> to win · <b>${i.maxWickets - i.wickets}</b> wicket${i.maxWickets - i.wickets === 1 ? '' : 's'} left`
      : `Need <b>${need}</b> off <b>${left}</b> ball${left === 1 ? '' : 's'}`}</div>`
    : `<div class="hc-chase">1st innings · ${hcFormat(g)}</div>`;
  return `<div class="hc-board side-${i.side}">
    <div class="hc-total"><small>${hcSide(g, i.side)} batting</small><b>${i.runs}<span>/${i.wickets}</span></b><em>Overs ${hcOvers(i.balls)}${g.overs ? ` / ${g.overs}` : ''}</em></div>
    ${chase}
    <div class="hc-over"><small>This over</small><div>${hcThisOver(g, i)}</div></div></div>`;
}

function hcHand(g, role) {
  if (g.gap && g.last) {
    const n = g.last[role];
    return `<div class="hc-hand show ${role} ${g.last.out ? 'out' : ''}"><b>${n}</b>${hcFingers(n)}</div>`;
  }
  if (g.picked && g.picked[role]) return `<div class="hc-hand ready ${role}">${icon('check')}<small>Picked</small></div>`;
  return `<div class="hc-hand wait ${role}"><b>?</b><small>Thinking…</small></div>`;
}

function hcResult(g) {
  const l = g.last;
  if (!g.gap || !l) return '';
  if (l.out) return `<div class="hc-result out"><b>OUT!</b><small>${hcName(g, l.bowler)} ${l.bowler === S.you ? 'take' : 'takes'} the wicket</small></div>`;
  const label = l.runs === 6 ? 'SIX!' : l.runs === 4 ? 'FOUR!' : `+${l.runs}`;
  const cls = l.runs === 6 ? 'six' : l.runs === 4 ? 'four' : 'runs';
  return `<div class="hc-result ${cls}"><b>${label}</b><small>${l.runs === 6 || l.runs === 4 ? `${l.runs} runs` : `${l.runs} run${l.runs === 1 ? '' : 's'}`}</small></div>`;
}

function hcTeams(g) {
  if (g.mode !== 'teams') return '';
  const col = side => `<div class="hc-col side-${side} ${g.inns.length && g.inns[g.innings - 1].side === side ? 'batting' : ''}">
    <h4>${hcSide(g, side)}${side === g.mySide ? ' <small>(your team)</small>' : ''}</h4>
    ${g.sides[side].map(id => {
      const st = g.stats[id];
      const now = id === g.batterId ? 'bat' : id === g.bowlerId ? 'bowl' : '';
      return `<div class="hc-row ${now} ${st.outs ? 'gone' : ''}">${avatar(g.names[id])}<span class="hc-rn">${hcName(g, id)}</span>
        ${now === 'bat' ? HC_BAT : now === 'bowl' ? HC_BALL : ''}<b>${st.runs}<small>(${st.balls})</small></b>${st.wickets ? `<em>${st.wickets}w</em>` : ''}</div>`;
    }).join('')}</div>`;
  return `<div class="hc-teams">${col('a')}${col('b')}</div>`;
}

function hcScorecard(g, i, n) {
  const rows = g.sides[i.side].map(id => {
    const st = g.stats[id];
    return `<tr><td><span class="pcell">${avatar(g.names[id])}${hcName(g, id)}</span></td><td class="num"><b>${st.runs}</b> <small>(${st.balls})</small></td><td class="num">${st.outs ? 'out' : 'not out'}</td></tr>`;
  }).join('');
  const bowlers = g.sides[i.side === 'a' ? 'b' : 'a'].map(id => `${hcName(g, id)} ${g.stats[id].wickets}w`).join(' · ');
  return `<div class="hc-card side-${i.side}" style="--i:${n}"><div class="hc-card-head"><b>${hcSide(g, i.side)}</b><span>${i.runs}/${i.wickets} <small>(${hcOvers(i.balls)} ov)</small></span></div>
    <table class="scoreboard"><tr><th>Batter</th><th class="num">Runs</th><th class="num"></th></tr>${rows}</table><p class="hc-bowl">${HC_BALL} ${bowlers}</p></div>`;
}

// ---------- the stadium around the game ----------
function hcStadium(inner, mood = '') {
  return `<div class="hc-stadium ${mood}">
    <div class="hc-sky" aria-hidden="true"><span class="hc-tower l"><i></i></span><span class="hc-tower r"><i></i></span><span class="hc-beam l"></span><span class="hc-beam r"></span></div>
    <div class="hc-inner">${inner}</div></div>`;
}

const HC_TALK = {
  six: ['SIX! Into the stands — the crowd is on its feet!', 'Massive hit! That ball has gone out of the ground!', 'What a strike! Six all the way!'],
  four: ['FOUR! Races away to the rope.', 'Cracking shot — that is four!', 'Beautifully timed, through the gap for four!'],
  out: ['OUT! The stumps are flying!', 'Clean bowled! What a delivery!', 'Gone! The bowler read that perfectly!'],
  1: ['Pushed away for a quick single.', 'Tapped and run — one run.'],
  2: ['Good running, they come back for two.', 'Into the gap — two runs.'],
  3: ['Lovely placement, they run three!', 'Chased down near the rope — three runs.'],
  5: ['Five runs! Overthrows and chaos!', 'Five! The fielders are in a muddle.'],
};
function hcTalk(g) {
  const l = g.last;
  if (g.gap && l) {
    const list = l.out ? HC_TALK.out : l.runs === 6 ? HC_TALK.six : l.runs === 4 ? HC_TALK.four : HC_TALK[l.runs];
    return list[(l.n + g.innings * 3) % list.length];
  }
  const i = g.inns[g.innings - 1];
  if (!i.balls) return `${hcName(g, g.batterId)} ${g.batterId === S.you ? 'take' : 'takes'} guard. ${hcName(g, g.bowlerId)} ${g.bowlerId === S.you ? 'are' : 'is'} ready to bowl…`;
  if (i.balls % 6 === 0) return `New over! ${hcName(g, g.bowlerId)} ${g.bowlerId === S.you ? 'have' : 'has'} the ball.`;
  return `${hcName(g, g.bowlerId)} ${g.bowlerId === S.you ? 'run' : 'runs'} in to bowl…`;
}

const hcStumps = (end, hit) => `<span class="hc-stumps ${end} ${hit ? 'hit' : ''}"><i></i><i></i><i></i><b class="bail b1"></b><b class="bail b2"></b></span>`;
function hcPitch(g) {
  const l = g.gap && g.last;
  const shot = !l ? '' : l.out ? 'out' : l.runs === 6 ? 'six' : l.runs === 4 ? 'four' : 'runs';
  return `<div class="hc-pitch">${hcStumps('bat', shot === 'out')}<span class="hc-crease bat"></span><span class="hc-crease bowl"></span>${hcStumps('bowl', false)}
    ${l ? `<span class="hc-ballfx ${shot}"><i></i></span>` : '<span class="hc-ballfx ready"><i></i></span>'}</div>`;
}

renderers.handcricket = () => {
  const g = S.game;
  const i = g.inns[g.innings - 1];
  const key = `${g.phase}:${g.innings}:${i ? i.balls : 0}:${g.gap}`;
  const fresh = key !== hc.key;
  hc.key = key;
  const wrap = body => `<div class="hc${fresh ? ' hc-fresh' : ''}">${body}</div>`;

  const matchLine = `<p class="hc-sub">${g.mode === 'ai' ? 'You vs the computer' : g.mode === 'duel' ? '1 vs 1' : `${hcSide(g, 'a')} vs ${hcSide(g, 'b')}`} · ${hcFormat(g)}</p>`;
  // who won the toss, in words: "You", a player's name, or a team ("Blue")
  const tossName = () => (g.mode === 'teams' ? `Team ${hcSide(g, g.toss)}` : hcName(g, g.sides[g.toss][0]));
  const wonVerb = () => (g.mode !== 'teams' && g.sides[g.toss][0] === S.you ? 'win' : 'wins');

  const callerName = () => (g.mode === 'teams' ? `Team ${hcSide(g, g.callSide)}` : hcName(g, g.caller));
  const COIN = `<span class="f a"><b>H</b><small>Heads</small></span><span class="f b"><b>T</b><small>Tails</small></span>`;

  if (g.phase === 'call') {
    const mine = g.caller === S.you;
    return {
      tone: mine ? 'mine' : 'live',
      turn: mine ? 'Call it — heads or tails?' : `${hcName(g, g.caller)} is calling the toss…`,
      body: wrap(`${hcStadium(`<div class="hc-choice">
          <div class="hc-coin idle">${COIN}</div>
          <h3>${mine ? 'You call the toss!' : `${callerName()} ${g.mode !== 'teams' && mine ? 'call' : 'calls'} the toss`}</h3>
          ${mine
            ? `<div class="hc-pick2"><button class="hc-opt heads" data-game="handcricket" data-call="heads"><span class="hc-face">H</span><b>Heads</b></button>
               <button class="hc-opt tails" data-game="handcricket" data-call="tails"><span class="hc-face">T</span><b>Tails</b></button></div>`
            : `<p class="hc-sub">${g.mode === 'teams' ? `Captain ${hcName(g, g.caller)} is` : `${hcName(g, g.caller)} is`} choosing heads or tails…</p><div class="hc-think"><i></i><i></i><i></i></div>`}
          ${matchLine}</div>`, 'buzz')}
        ${timeBar(g.endsAt, g.totalMs)}${hcTeams(g)}`),
    };
  }

  if (g.phase === 'toss') {
    const callBy = g.caller === 'ai' ? 'The computer' : callerName();
    const callVerb = g.caller === S.you && g.mode !== 'teams' ? 'called' : 'called';
    return {
      tone: 'live',
      turn: `${callBy} ${callVerb} ${g.call}. The coin is in the air…`,
      body: wrap(`${hcStadium(`<div class="hc-toss"><p class="hc-called">${callBy} ${callVerb} <b>${g.call.toUpperCase()}</b></p>
        <div class="hc-coin land-${g.coin}">${COIN}</div>
        <p class="hc-toss-text">It's <b>${g.coin === 'heads' ? 'HEADS' : 'TAILS'}</b>! <b>${tossName()}</b> ${wonVerb()} the toss!</p>${matchLine}</div>`, 'buzz')}
        ${hcTeams(g)}`),
    };
  }

  if (g.phase === 'choice') {
    const mine = g.captain === S.you;
    const who = hcName(g, g.captain);
    return {
      tone: mine ? 'mine' : 'live',
      turn: mine ? 'You won the toss! Bat or bowl first?' : `${who} won the toss and is deciding…`,
      body: wrap(`${hcStadium(`<div class="hc-choice">
          <span class="hc-coin-small">${g.toss === 'a' ? HC_BAT : HC_BALL}</span>
          <h3>${mine ? 'You won the toss!' : `${tossName()} ${wonVerb()} the toss`}</h3>
          ${mine
            ? `<p class="hc-sub">What would you like to do first?</p>
               <div class="hc-pick2"><button class="hc-opt bat" data-game="handcricket" data-toss="bat">${HC_BAT}<b>Bat first</b><small>Set a target</small></button>
               <button class="hc-opt bowl" data-game="handcricket" data-toss="bowl">${HC_BALL}<b>Bowl first</b><small>Chase it down</small></button></div>`
            : `<p class="hc-sub">${g.mode === 'teams' ? `Captain ${who} is` : `${who} is`} choosing to bat or bowl…</p><div class="hc-think"><i></i><i></i><i></i></div>`}
        </div>`, 'buzz')}
        ${timeBar(g.endsAt, g.totalMs)}${hcTeams(g)}`),
    };
  }

  if (g.phase === 'decided') {
    const who = g.captain === 'ai' ? 'The computer' : g.mode === 'teams' ? `Team ${hcSide(g, g.toss)}` : hcName(g, g.captain);
    const verb = g.captain === S.you && g.mode !== 'teams' ? 'chose' : 'chose';
    return {
      tone: 'live',
      turn: `${who} won the toss and ${verb} to ${g.choseBat ? 'bat' : 'bowl'} first`,
      body: wrap(`${hcStadium(`<div class="hc-choice decided">
          <span class="hc-coin-small big ${g.choseBat ? 'bat' : 'bowl'}">${g.choseBat ? HC_BAT : HC_BALL}</span>
          <h3>${who} won the toss</h3>
          <p class="hc-decision">and chose to <b>${g.choseBat ? 'BAT' : 'BOWL'}</b> first</p>
          <p class="hc-sub">${hcSide(g, g.firstBat)} ${g.mode !== 'teams' && g.sides[g.firstBat][0] === S.you ? 'bat' : 'bats'} first</p>${matchLine}
        </div>`, 'buzz')}
        ${hcTeams(g)}`),
    };
  }

  if (g.phase === 'break') {
    const first = g.inns[0];
    const chaser = first.side === 'a' ? 'b' : 'a';
    return {
      tone: 'live',
      turn: 'Innings break',
      body: wrap(`${hcStadium(`<div class="hc-break"><small>Innings break</small><p>${hcSide(g, first.side)} scored</p><b>${first.runs}<span>/${first.wickets}</span></b>
        <p class="hc-target">${hcSide(g, chaser)} need <em>${g.target}</em> to win${g.overs ? ` from ${g.overs * 6} balls` : ' — no overs limit, till all out'}</p></div>`, 'buzz')}
        ${timeBar(g.endsAt, g.totalMs)}${hcTeams(g)}`),
    };
  }

  if (g.phase === 'play') {
    const role = g.myRole;
    const pad = role
      ? `<div class="hc-pad">${[1, 2, 3, 4, 5, 6].map(n => `<button class="hc-num ${g.myPick === n ? 'on' : ''}" style="--i:${n}" data-game="handcricket" data-pick="${n}" ${g.myPick ? 'disabled' : ''} aria-label="Pick ${n}"><b>${n}</b>${hcFingers(n)}</button>`).join('')}</div>
         <p class="hc-tip">${g.myPick ? `You picked <b>${g.myPick}</b>. Waiting…` : role === 'bat' ? 'Pick a number — you score it unless the bowler picks the same!' : 'Pick a number — match the batter to take a wicket!'} <span class="hc-keys">Keys 1–6 work too</span></p>`
      : '';
    let turn;
    if (g.gap && g.last) turn = g.last.out ? `OUT! ${hcName(g, g.last.batter)} ${g.last.batter === S.you ? 'are' : 'is'} out` : `${hcName(g, g.last.batter)} ${g.last.batter === S.you ? 'score' : 'scores'} ${g.last.runs}`;
    else if (role === 'bat') turn = "You're batting — pick 1 to 6!";
    else if (role === 'bowl') turn = "You're bowling — try to match their number!";
    else turn = `${hcName(g, g.batterId)} ${g.batterId === S.you ? 'bat' : 'bats'}, ${hcName(g, g.bowlerId)} ${g.bowlerId === S.you ? 'bowl' : 'bowls'}`;
    const bst = g.stats[g.batterId], wst = g.stats[g.bowlerId];
    return {
      tone: g.gap && g.last && g.last.out ? 'alert' : role && !g.myPick ? 'mine' : 'live',
      turn,
      body: wrap(`${hcStadium(`${hcBoard(g)}
        <div class="hc-talk"><span class="hc-mic">${icon('chat')}</span><span>${hcTalk(g)}</span></div>
        <div class="hc-field">
          <div class="hc-player bat">${avatar(g.names[g.batterId])}<b>${hcName(g, g.batterId)}</b><small>${HC_BAT} ${bst.runs} (${bst.balls})</small></div>
          <div class="hc-mid">${hcHand(g, 'bat')}<span class="hc-vs">VS</span>${hcHand(g, 'bowl')}</div>
          <div class="hc-player bowl">${avatar(g.names[g.bowlerId])}<b>${hcName(g, g.bowlerId)}</b><small>${HC_BALL} ${wst.wickets} wkt${wst.wickets === 1 ? '' : 's'}</small></div>
          ${hcPitch(g)}
        </div>`, g.gap && g.last ? (g.last.out ? 'groan' : g.last.runs >= 4 ? `cheer r${g.last.runs}` : 'clap') : '')}
        ${g.gap ? '<div class="timebar"></div>' : timeBar(g.endsAt, g.totalMs)}
        ${g.gap ? hcResult(g) : pad}${hcTeams(g)}`),
    };
  }

  // over
  const all = Object.keys(g.stats);
  const mvp = all.sort((x, y) => (g.stats[y].runs + g.stats[y].wickets * 15) - (g.stats[x].runs + g.stats[x].wickets * 15))[0];
  const won = g.winner;
  let head;
  if (!won) head = "It's a tie!";
  else if (g.mode === 'ai') head = won === g.mySide ? 'You won!' : 'The computer won!';
  else head = `${hcSide(g, won)} won!`;
  const by = !won ? 'Both sides scored the same' : g.margin.by === 'runs' ? `by ${g.margin.n} run${g.margin.n === 1 ? '' : 's'}` : `by ${g.margin.n} wicket${g.margin.n === 1 ? '' : 's'}${g.margin.balls ? ` with ${g.margin.balls} ball${g.margin.balls === 1 ? '' : 's'} left` : ''}`;
  const mine = won && (g.mode === 'ai' ? won === g.mySide : g.sides[won].includes(S.you));
  return {
    tone: 'win',
    turn: `${head} ${by}`,
    body: wrap(`${hcStadium(`<div class="hc-final ${mine ? 'mine' : ''} ${won ? 'side-' + won : ''}"><span class="hc-cup">${icon('trophy')}</span><b>${head}</b><small>${by}</small></div>`, 'cheer r6 party')}
      <div class="hc-mvp">${icon('crown')} Player of the match: <b>${hcName(g, mvp)}</b> — ${g.stats[mvp].runs} run${g.stats[mvp].runs === 1 ? '' : 's'}${g.stats[mvp].wickets ? `, ${g.stats[mvp].wickets} wicket${g.stats[mvp].wickets === 1 ? '' : 's'}` : ''}</div>
      <div class="hc-cards">${g.inns.map((x, n) => hcScorecard(g, x, n)).join('')}</div>
      <div class="actions">${rematchBtn()}</div>`),
  };
};

handlers.handcricket = d => {
  if ('pick' in d) act({ type: 'pick', n: +d.pick });
  else if ('toss' in d) act({ type: 'tossChoice', choice: d.toss });
  else if ('call' in d) act({ type: 'call', call: d.call });
};

// number keys pick too, when you're batting or bowling and not typing somewhere
document.addEventListener('keydown', e => {
  const g = S && S.game;
  if (!g || g.gameId !== 'handcricket' || g.phase !== 'play' || !g.myRole || g.myPick) return;
  if (e.target.matches && e.target.matches('input, textarea')) return;
  const n = Number(e.key);
  if (n >= 1 && n <= 6) { act({ type: 'pick', n }); if (window.SFX) SFX.play('tap'); }
});

afterRender.push(() => {
  const g = S && S.game;
  if (!g || g.gameId !== 'handcricket' || typeof FX === 'undefined') return;
  const sky = $('.hc-stadium');
  const fireworks = (n, colors) => {
    if (!sky) return;
    const r = sky.getBoundingClientRect();
    for (let k = 0; k < n; k++) {
      setTimeout(() => {
        const dot = document.createElement('span');
        dot.style.cssText = `position:fixed;left:${r.left + r.width * (0.15 + Math.random() * 0.7)}px;top:${r.top + 20 + Math.random() * 60}px;width:1px;height:1px`;
        document.body.appendChild(dot);
        FX.burst(dot, colors);
        setTimeout(() => dot.remove(), 50);
      }, k * 260);
    }
  };
  if (g.phase === 'over') {
    if (hc.fx !== 'over') { hc.fx = 'over'; fireworks(5, ['#ffc83d', '#ff2e93', '#38c6ff', '#2fe07f', '#ffffff']); }
    return;
  }
  if (!g.gap || !g.last) return;
  const k = `${g.innings}:${g.last.n}`;
  if (hc.fx === k) return;
  hc.fx = k;
  // wait for the ball to reach the bat before celebrating
  setTimeout(() => {
    if (g.last.runs === 6) { fireworks(3, ['#ffc83d', '#ff2e93', '#ffffff', '#2fe07f']); if (window.SFX) SFX.play('win'); }
    else if (g.last.runs === 4) { FX.burst($('.hc-result'), ['#38c6ff', '#ffffff', '#ffc83d']); if (window.SFX) SFX.play('correct'); }
  }, 650);
});
