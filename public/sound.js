/* Sounds (synthesised with Web Audio — no audio files) and floating emoji reactions. */
const SFX = (() => {
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem('gh_mute') === '1'; } catch {}

  const ac = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  // browsers only allow audio after a tap
  document.addEventListener('pointerdown', () => { try { ac(); } catch {} }, { once: true });

  function tone(freq, at, dur, { type = 'sine', gain = 0.16, slide = null } = {}) {
    const c = ac(), t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(at, dur, { gain = 0.2, freq = 2000, q = 1, type = 'bandpass' } = {}) {
    const c = ac(), t = c.currentTime + at;
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf;
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.value = gain;
    src.connect(f).connect(g).connect(c.destination);
    src.start(t);
  }

  const knock = at => { tone(140, at, 0.12, { type: 'triangle', gain: 0.3, slide: 60 }); noise(at, 0.06, { freq: 600, gain: 0.35, type: 'lowpass' }); };

  const sounds = {
    tap: () => tone(700, 0, 0.05, { type: 'triangle', gain: 0.08 }),
    turn: () => { tone(660, 0, 0.12, { type: 'triangle' }); tone(990, 0.11, 0.2, { type: 'triangle' }); },
    call: () => { tone(880, 0, 0.35, { gain: 0.14 }); tone(1760, 0, 0.2, { gain: 0.03 }); },
    card: () => noise(0, 0.08, { freq: 3500, gain: 0.3, q: 0.8 }),
    paper: () => { noise(0, 0.14, { freq: 2400, gain: 0.18, q: 0.6 }); noise(0.07, 0.1, { freq: 4200, gain: 0.1 }); },
    shells: () => { for (let i = 0; i < 6; i++) noise(i * 0.045 + Math.random() * 0.02, 0.035, { freq: 2600 + Math.random() * 1800, gain: 0.3, q: 4 }); },
    place: () => knock(0),
    cut: () => { noise(0, 0.22, { freq: 1400, gain: 0.25, q: 0.7 }); tone(330, 0, 0.18, { type: 'sawtooth', gain: 0.05, slide: 110 }); },
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.28, { type: 'triangle', gain: 0.14 })),
    fail: () => { tone(240, 0, 0.18, { type: 'sawtooth', gain: 0.08, slide: 200 }); tone(180, 0.16, 0.3, { type: 'sawtooth', gain: 0.08, slide: 120 }); },
    buzzer: () => { tone(150, 0, 0.45, { type: 'square', gain: 0.07 }); tone(156, 0, 0.45, { type: 'square', gain: 0.06 }); },
    correct: () => { tone(784, 0, 0.12, { type: 'triangle' }); tone(1175, 0.09, 0.25, { type: 'triangle' }); },
    reveal: () => { tone(523, 0, 0.14, { type: 'triangle' }); tone(784, 0.08, 0.28, { type: 'triangle' }); },
    tick: () => tone(1200, 0, 0.04, { type: 'square', gain: 0.04 }),
    bid: () => { tone(520, 0, 0.06, { type: 'square', gain: 0.06 }); tone(780, 0.05, 0.08, { type: 'square', gain: 0.05 }); },
    sold: () => { knock(0); knock(0.2); [784, 988, 1175].forEach((f, i) => tone(f, 0.42 + i * 0.08, 0.3, { type: 'triangle', gain: 0.12 })); },
    unsold: () => { knock(0); tone(300, 0.1, 0.35, { type: 'triangle', gain: 0.1, slide: 150 }); },
    pop: () => tone(880, 0, 0.06, { gain: 0.06, slide: 1500 }),
  };

  const say = text => {
    if (muted || !window.speechSynthesis) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const voice = speechSynthesis.getVoices().find(v => /en[-_]IN/i.test(v.lang)) || speechSynthesis.getVoices().find(v => /^en/i.test(v.lang));
      if (voice) u.voice = voice;
      u.rate = 1.05;
      speechSynthesis.speak(u);
    } catch {}
  };

  return {
    play(type) { if (!muted && sounds[type]) try { sounds[type](); } catch {} },
    say,
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem('gh_mute', muted ? '1' : '0'); } catch {}
      if (muted && window.speechSynthesis) speechSynthesis.cancel();
      if (!muted) sounds.tap();
      return muted;
    },
  };
})();

// ---- mute button
ICON_PATHS.vol = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>';
ICON_PATHS.mute = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/>';
ICON_PATHS.smile = '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/>';
const paintSoundBtn = () => { $('#soundBtn').innerHTML = icon(SFX.muted ? 'mute' : 'vol'); $('#soundBtn').classList.toggle('off', SFX.muted); };
paintSoundBtn();
$('#soundBtn').onclick = () => { SFX.toggle(); paintSoundBtn(); toast(SFX.muted ? 'Sound off' : 'Sound on'); };

// ---- reactions
const REACTIONS = ['😂', '🔥', '👏', '😮', '😡', '❤️', '🤣', '👀'];
$('#reactBtn').innerHTML = icon('smile');
$('#reactBar').innerHTML = REACTIONS.map(e => `<button data-react="${e}" aria-label="React ${e}">${e}</button>`).join('');
$('#reactBtn').onclick = () => $('#reactBar').classList.toggle('hidden');
$('#reactBar').onclick = e => {
  const b = e.target.closest('[data-react]');
  if (b) socket.emit('react', { emoji: b.dataset.react });
};
document.addEventListener('pointerdown', e => {
  if (!e.target.closest('#reactDock')) $('#reactBar').classList.add('hidden');
});

socket.on('react', ({ emoji, from, id }) => {
  const layer = $('#reactLayer');
  if (layer.childElementCount > 30) return;
  const el = document.createElement('div');
  el.className = 'float-react';
  el.style.left = `${8 + Math.random() * 78}%`;
  el.style.setProperty('--drift', `${Math.round(Math.random() * 80 - 40)}px`);
  el.innerHTML = `<span class="e">${emoji}</span><span class="n">${esc(id === (S && S.you) ? 'You' : from)}</span>`;
  layer.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
  SFX.play('pop');
});

// show the reaction button only inside a room
const syncReactDock = () => $('#reactDock').classList.toggle('hidden', !S || $('#room').classList.contains('hidden'));
afterRender.push(syncReactDock);
