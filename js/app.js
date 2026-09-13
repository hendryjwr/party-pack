import { el, esc, haptic, sound, keepAwake, openRules, isMuted, setMuted } from './ui.js';
import imposter from './games/imposter.js';
import wavelength from './games/wavelength.js';
import charades from './games/charades.js';
import fishbowl from './games/fishbowl.js';
import taboo from './games/taboo.js';
import bomb from './games/bomb.js';
import werewolf from './games/werewolf.js';
import hotseat from './games/hotseat.js';

const games = [imposter, wavelength, charades, fishbowl, taboo, bomb, werewolf, hotseat];

// Always open at the top rather than wherever the page was last scrolled.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
const root = document.getElementById('app');
let leaveFns = [];
let refreshPlay = () => {};

const app = {
  game: null,
  /** Replace the current screen, running any cleanup (timers, sensors) the old one registered. */
  show(node) {
    const fns = leaveFns;
    leaveFns = [];
    fns.forEach((fn) => { try { fn(); } catch {} });
    document.querySelectorAll('.sheet-back').forEach((s) => s.remove());
    root.replaceChildren(node);
    window.scrollTo(0, 0);
  },
  onLeave(fn) { leaveFns.push(fn); },
  home: renderHome,
  lobby() { renderLobby(app.game); },
  refresh() { refreshPlay(); },
};

function renderHome() {
  app.game = null;
  const node = el(`
    <div class="screen home burst"><div class="inner">
      <div class="topbar"><span class="icon-spacer"></span><button class="icon-btn" data-sound aria-label="Toggle sound">${isMuted() ? '🔇' : '🔊'}</button></div>
      <h1 class="logo">Party<br>Pack</h1>
      <div class="tagline">Pass the phone · play together</div>
      <div class="grid">
        ${games.map((g, i) => `
          <button class="tile" data-i="${i}" style="--c:${g.c};--d:${g.d}">
            <span class="t-emoji">${g.emoji}</span>
            <span class="t-title">${esc(g.title)}</span>
            <span class="t-sub">${esc(g.players)}</span>
          </button>`).join('')}
      </div>
    </div></div>`);
  node.querySelectorAll('.tile').forEach((t) => {
    t.onclick = () => {
      haptic();
      sound('tap');
      keepAwake();
      app.game = games[Number(t.dataset.i)];
      app.lobby();
    };
  });
  node.querySelector('[data-sound]').onclick = (e) => {
    setMuted(!isMuted());
    e.currentTarget.textContent = isMuted() ? '🔇' : '🔊';
    sound('tap');
  };
  app.show(node);
}

function renderLobby(g) {
  const node = el(`
    <div class="screen stage burst lobby" style="--c:${g.c};--d:${g.d}"><div class="inner">
      <div class="topbar">
        <button class="icon-btn" data-back aria-label="Back">←</button>
        <button class="icon-btn" data-rules aria-label="How to play">?</button>
      </div>
      <div class="hero">
        <div class="emoji-xl bounce">${g.emoji}</div>
        <div class="title-xl">${esc(g.title)}</div>
        <p class="lead">${esc(g.tagline)}</p>
        <div class="row" style="justify-content:center;align-items:center;flex-wrap:wrap;gap:10px;margin-top:6px">
          <span class="badge" style="flex:none">${esc(g.players)}</span>
          <button class="btn ghost how" style="flex:none" data-how>📖 How to play</button>
        </div>
      </div>
      <div class="settings"></div>
      <div class="play-bar">
        <div class="play-reason"></div>
        <button class="btn play">Play</button>
      </div>
    </div></div>`);
  const play = node.querySelector('.play');
  const reason = node.querySelector('.play-reason');
  refreshPlay = () => {
    const why = g.canPlay?.() ?? null;
    play.disabled = Boolean(why);
    reason.textContent = why ?? '';
  };
  node.querySelector('[data-back]').onclick = () => { sound('tap'); app.home(); };
  node.querySelector('[data-rules]').onclick = () => openRules(g);
  node.querySelector('[data-how]').onclick = () => openRules(g);
  play.onclick = () => {
    haptic();
    sound('go');
    keepAwake();
    g.start(app);
  };
  app.show(node);
  g.settings?.(node.querySelector('.settings'), app);
  refreshPlay();
}

renderHome();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js');
}
