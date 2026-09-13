// Shared helpers and UI building blocks.

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const pick = (list) => list[Math.floor(Math.random() * list.length)];

export const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(`pp.${key}`);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem(`pp.${key}`, JSON.stringify(value)); } catch {}
  },
};

/** Restart a CSS animation class on an element. */
export function replay(node, cls) {
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
}

// ---------- Feedback ----------

let hapticSwitch;
export function haptic(kind = 'tap') {
  if (navigator.vibrate) {
    navigator.vibrate(kind === 'heavy' ? [40, 40, 60] : kind === 'success' ? [15, 30, 15] : 12);
    return;
  }
  // iOS Safari has no vibrate(); toggling a native switch control gives a light haptic tick.
  try {
    if (!hapticSwitch) {
      hapticSwitch = el('<label aria-hidden="true" style="position:fixed;left:-100px;top:0;opacity:0;pointer-events:none"><input type="checkbox" switch></label>');
      document.body.append(hapticSwitch);
    }
    const n = kind === 'heavy' ? 3 : kind === 'success' ? 2 : 1;
    for (let i = 0; i < n; i++) setTimeout(() => hapticSwitch.click(), i * 90);
  } catch {}
}

let muted = store.get('muted', false);
export const isMuted = () => muted;
export function setMuted(v) { muted = v; store.set('muted', v); }

let ac;
function audio() {
  ac ??= new (window.AudioContext || window.webkitAudioContext)();
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

function tone(freq, dur, { delay = 0, type = 'sine', vol = 0.18, to } = {}) {
  const a = audio();
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur) {
  const a = audio();
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
  const src = a.createBufferSource();
  const g = a.createGain();
  g.gain.value = 0.7;
  src.buffer = buf;
  src.connect(g).connect(a.destination);
  src.start();
}

const sounds = {
  tap: () => tone(520, 0.06, { type: 'triangle', vol: 0.08 }),
  go: () => { tone(523, 0.1, { type: 'triangle' }); tone(784, 0.18, { delay: 0.09, type: 'triangle' }); },
  count: () => tone(880, 0.12, { type: 'triangle' }),
  tick: () => tone(1400, 0.03, { type: 'square', vol: 0.05 }),
  correct: () => { tone(660, 0.1, { type: 'triangle' }); tone(1046, 0.22, { delay: 0.08, type: 'triangle' }); },
  pass: () => tone(320, 0.18, { type: 'sawtooth', vol: 0.07, to: 180 }),
  buzz: () => tone(140, 0.35, { type: 'square', vol: 0.12 }),
  end: () => { tone(784, 0.15); tone(622, 0.15, { delay: 0.15 }); tone(466, 0.4, { delay: 0.3 }); },
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.2, { delay: i * 0.1, type: 'triangle' })),
  reveal: () => tone(440, 0.35, { to: 880, type: 'triangle', vol: 0.12 }),
  boom: () => { noise(1.3); tone(90, 0.9, { vol: 0.5, to: 30 }); },
};

export function sound(name) {
  if (muted) return;
  try { sounds[name]?.(); } catch {}
}

let wakeLock;
export async function keepAwake() {
  try {
    if (!wakeLock || wakeLock.released) wakeLock = await navigator.wakeLock?.request('screen');
  } catch {}
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wakeLock) keepAwake();
});

export function confetti() {
  const colors = ['#ffd166', '#ef476f', '#06d6a0', '#118ab2', '#ffffff', '#ff9f1c'];
  const box = el('<div class="confetti"></div>');
  for (let i = 0; i < 70; i++) {
    const bit = document.createElement('i');
    bit.style.left = `${Math.random() * 100}%`;
    bit.style.background = colors[i % colors.length];
    bit.style.animationDelay = `${Math.random() * 0.4}s`;
    bit.style.animationDuration = `${1.6 + Math.random() * 1.4}s`;
    bit.style.setProperty('--x', `${(Math.random() * 2 - 1) * 120}px`);
    bit.style.setProperty('--r', `${Math.random() * 720}deg`);
    box.append(bit);
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 3500);
}

// ---------- Timers & sensors ----------

/** 1-second countdown that stops automatically when the screen changes. */
export function countdown(app, seconds, { onTick, onEnd }) {
  let left = seconds;
  const id = setInterval(() => {
    left--;
    onTick?.(left);
    if (left <= 0) {
      clearInterval(id);
      onEnd?.();
    }
  }, 1000);
  const timer = { get left() { return left; }, stop: () => clearInterval(id) };
  app.onLeave(timer.stop);
  return timer;
}

export async function requestTilt() {
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      return (await DeviceOrientationEvent.requestPermission()) === 'granted';
    }
    return 'DeviceOrientationEvent' in window;
  } catch {
    return false;
  }
}

/** Heads Up–style tilt: screen toward the floor = down, toward the ceiling = up. */
export function watchTilt(app, { onDown, onUp }) {
  let armed = false; // must pass through upright first, so a phone lying flat doesn't trigger
  const rad = Math.PI / 180;
  const handler = (e) => {
    if (e.beta == null || e.gamma == null) return;
    const faceUp = Math.cos(e.beta * rad) * Math.cos(e.gamma * rad); // +1 face up, -1 face down, 0 upright
    if (armed) {
      if (faceUp < -0.7) { armed = false; onDown(); }
      else if (faceUp > 0.7) { armed = false; onUp(); }
    } else if (Math.abs(faceUp) < 0.35) {
      armed = true;
    }
  };
  window.addEventListener('deviceorientation', handler);
  app.onLeave(() => window.removeEventListener('deviceorientation', handler));
}

/** Shrink a text element's font until it fits its box. */
export function fit(node, max, min = 28) {
  let size = max;
  node.style.fontSize = `${size}px`;
  const maxH = (node.parentElement?.clientHeight || window.innerHeight * 0.5) * 0.95;
  while (size > min && (node.scrollWidth > node.clientWidth + 1 || node.offsetHeight > maxH)) {
    size -= 3;
    node.style.fontSize = `${size}px`;
  }
}

// ---------- Controls ----------

/** Make Enter/Return in a text field submit its form, on every keyboard. */
export function submitOnEnter(input) {
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      input.form?.requestSubmit();
    }
  });
}

function field(label, sub, control) {
  const node = el(`<div class="field"><div><span class="label">${esc(label)}</span>${sub ? `<span class="sub">${esc(sub)}</span>` : ''}</div></div>`);
  node.append(control);
  return node;
}

export function panel(title, ...children) {
  const node = el(`<div class="panel">${title ? `<div class="panel-title">${esc(title)}</div>` : ''}</div>`);
  node.append(...children);
  return node;
}

export function stepper({ label, sub, value, min, max, onChange }) {
  const ctl = el('<div class="stepper"><button aria-label="Less">−</button><output></output><button aria-label="More">+</button></div>');
  const [minus, plus] = ctl.querySelectorAll('button');
  const out = ctl.querySelector('output');
  const sync = () => {
    out.textContent = value;
    minus.disabled = value <= min;
    plus.disabled = value >= max;
  };
  const change = (delta) => {
    const next = value + delta;
    if (next < min || next > max) return;
    value = next;
    sync();
    haptic();
    sound('tap');
    onChange(value);
  };
  minus.onclick = () => change(-1);
  plus.onclick = () => change(1);
  sync();
  return field(label, sub, ctl);
}

export function toggle({ label, sub, value, onChange }) {
  const sw = el(`<button class="switch ${value ? 'on' : ''}" role="switch" aria-checked="${value}"></button>`);
  sw.onclick = () => {
    value = !value;
    sw.classList.toggle('on', value);
    sw.setAttribute('aria-checked', String(value));
    haptic();
    sound('tap');
    onChange(value);
  };
  return field(label, sub, sw);
}

function choiceGroup(container, options, value, onChange) {
  const buttons = options.map((o) => {
    const b = el(`<button class="${o.value === value ? 'on' : ''}">${esc(o.label)}</button>`);
    b.onclick = () => {
      buttons.forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      haptic();
      sound('tap');
      onChange(o.value);
    };
    return b;
  });
  container.append(...buttons);
  return container;
}

export function segmented({ label, options, value, onChange }) {
  const node = el(`<div>${label ? `<div class="panel-title">${esc(label)}</div>` : ''}<div class="seg"></div></div>`);
  choiceGroup(node.querySelector('.seg'), options, value, onChange);
  return node;
}

export function chips({ options, value, onChange }) {
  const node = choiceGroup(el('<div class="chips"></div>'), options, value, onChange);
  node.querySelectorAll('button').forEach((b) => b.classList.add('chip'));
  // Bring the selected chip into view.
  requestAnimationFrame(() => node.querySelector('.on')?.scrollIntoView({ block: 'nearest', inline: 'center' }));
  return node;
}

export function playersEditor({ min, onChange }) {
  const node = el(`
    <div class="panel">
      <div class="panel-title">Players <span data-count></span></div>
      <div class="names"></div>
      <form class="add">
        <input placeholder="Add a name" autocomplete="off" autocapitalize="words" enterkeyhint="next" maxlength="20">
        <button type="submit" aria-label="Add player">+</button>
      </form>
      <div class="note" data-hint></div>
    </div>`);
  const names = node.querySelector('.names');
  const input = node.querySelector('input');
  const render = () => {
    const list = store.get('players', []);
    node.querySelector('[data-count]').textContent = `(${list.length})`;
    node.querySelector('[data-hint]').textContent = list.length < min ? `Add at least ${min} players.` : '';
    names.replaceChildren(...list.map((name, i) => {
      const chip = el(`<span class="name-chip">${esc(name)}<button type="button" aria-label="Remove ${esc(name)}">✕</button></span>`);
      chip.querySelector('button').onclick = () => {
        list.splice(i, 1);
        store.set('players', list);
        haptic();
        render();
        onChange?.();
      };
      return chip;
    }));
  };
  submitOnEnter(input);
  node.querySelector('form').onsubmit = (e) => {
    e.preventDefault();
    const name = input.value.trim();
    const list = store.get('players', []);
    if (name && !list.some((n) => n.toLowerCase() === name.toLowerCase())) {
      list.push(name);
      store.set('players', list);
      haptic();
      sound('tap');
      render();
      onChange?.();
    }
    input.value = '';
    input.focus(); // keep the keyboard up for the next name
  };
  render();
  return node;
}

export function teamsEditor(key) {
  const teams = store.get(key, ['Team 1', 'Team 2']);
  const node = el(`<div class="panel"><div class="panel-title">Teams</div><div class="row">
    <input class="text-input" maxlength="16" aria-label="Team 1 name">
    <input class="text-input" maxlength="16" aria-label="Team 2 name"></div></div>`);
  node.querySelectorAll('input').forEach((input, i) => {
    input.value = teams[i];
    input.oninput = () => { teams[i] = input.value; store.set(key, teams); };
  });
  return node;
}

export const teamNames = (key) => store.get(key, ['Team 1', 'Team 2']).map((n, i) => n.trim() || `Team ${i + 1}`);

export const scoreboard = (names, scores, active = -1) => `
  <div class="scores">${names.map((n, i) => `<div class="score ${i === active ? 'on' : ''}"><span>${esc(n)}</span><b>${scores[i]}</b></div>`).join('')}</div>`;

// ---------- Screens ----------

export function openRules(game) {
  const back = el(`
    <div class="sheet-back" style="--c:${game.c};--d:${game.d}">
      <div class="sheet" role="dialog" aria-label="How to play">
        <h2>${game.emoji} How to play</h2>
        <ol class="steps">${game.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ol>
        <button class="btn color">Got it</button>
      </div>
    </div>`);
  const close = () => back.remove();
  back.onclick = (e) => { if (e.target === back) close(); };
  back.querySelector('.btn').onclick = close;
  document.body.append(back);
}

/** Full-screen in-game layout with quit + rules buttons. `bind` runs after the screen is shown. */
export function stage(app, html, { bind, top = '', cls = '' } = {}) {
  const g = app.game;
  const node = el(`
    <div class="screen stage burst ${cls}" style="--c:${g.c};--d:${g.d}"><div class="inner">
      <div class="topbar">
        <button class="icon-btn" data-exit aria-label="Quit game">✕</button>
        <div class="top-mid">${top}</div>
        <button class="icon-btn" data-rules aria-label="How to play">?</button>
      </div>
      <div class="body">${html}</div>
    </div></div>`);
  node.querySelector('[data-exit]').onclick = () => {
    if (confirm('Quit this game?')) app.lobby();
  };
  node.querySelector('[data-rules]').onclick = () => openRules(g);
  app.show(node);
  bind?.(node);
  return node;
}

/** Pass the phone round; each player holds the card to privately see their secret. */
export function passAndReveal(app, { players, secret, onDone }) {
  let i = 0;
  const step = () => {
    const last = i === players.length - 1;
    let seen = false;
    stage(app, `
      <div class="center">
        <div class="kicker">Player ${i + 1} of ${players.length} · pass the phone to</div>
        <div class="title-xl pop">${esc(players[i])}</div>
        <div class="reveal" data-card>
          <div class="reveal-cover">
            <div class="emoji-xl">🤫</div>
            <div class="title-l">Hold to reveal</div>
            <div class="note">Make sure nobody's peeking!</div>
          </div>
          <div class="reveal-secret">${secret(i)}</div>
        </div>
      </div>
      <div class="actions">
        <button class="btn" data-next disabled>${last ? "Everyone's ready!" : `Hide & pass to ${esc(players[i + 1])}`}</button>
      </div>`, {
      bind: (node) => {
        const card = node.querySelector('[data-card]');
        const next = node.querySelector('[data-next]');
        card.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          card.classList.add('open');
          haptic();
          if (!seen) {
            seen = true;
            next.disabled = false;
          }
        });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => card.addEventListener(t, () => card.classList.remove('open')));
        card.addEventListener('contextmenu', (e) => e.preventDefault());
        next.onclick = () => {
          sound('tap');
          if (last) onDone();
          else { i++; step(); }
        };
      },
    });
  };
  step();
}
