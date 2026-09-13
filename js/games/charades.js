import { esc, shuffle, pick, store, haptic, sound, chips, segmented, toggle, panel, stage, countdown, requestTilt, watchTilt, fit, confetti } from '../ui.js';
import { categories } from '../data.js';

const cfg = () => ({ category: 'movies', seconds: 60, tilt: true, ...store.get('charades', {}) });

const game = {
  id: 'charades',
  title: 'Charades',
  emoji: '🎭',
  tagline: 'Phone on your forehead. Tilt to score!',
  players: '2+ players',
  c: '#ffa600',
  d: '#e05a00',
  rules: [
    'The guesser holds the phone on their forehead, screen facing out.',
    'Everyone else acts it out, describes it, hums it — anything but saying the word.',
    'Tilt the phone DOWN when you get it. Tilt UP to pass. (Or tap the buttons.)',
    'Get as many as you can before time runs out, then hand the phone on.',
  ],

  settings(box) {
    const c = cfg();
    const save = () => store.set('charades', c);
    box.append(
      panel('Category', chips({
        options: [{ value: 'random', label: '🎲 Random' }, ...categories.map((x) => ({ value: x.id, label: `${x.emoji} ${x.name}` }))],
        value: c.category,
        onChange: (v) => { c.category = v; save(); },
      })),
      panel('',
        segmented({ label: 'Round length', options: [30, 60, 90, 120].map((s) => ({ value: s, label: `${s}s` })), value: c.seconds, onChange: (v) => { c.seconds = v; save(); } }),
        toggle({ label: 'Tilt to answer', sub: 'Down = correct · Up = pass', value: c.tilt, onChange: (v) => { c.tilt = v; save(); } }),
      ),
    );
  },

  async start(app) {
    const c = cfg();
    const tilt = c.tilt ? await requestTilt() : false; // iOS asks for motion permission here
    const cat = categories.find((x) => x.id === c.category) ?? pick(categories);
    let deck = shuffle(cat.words);
    const results = [];

    let n = 3;
    const intro = stage(app, `
      <div class="center">
        <div class="emoji-xl bounce">🤳</div>
        <div class="title-l">On your forehead!</div>
        <div class="mega pop" data-n>3</div>
        <p class="lead">${tilt ? 'Tilt down = correct<br>Tilt up = pass' : 'Tap the buttons to score'}</p>
      </div>`, { top: `${cat.emoji} ${esc(cat.name)}` });
    sound('count');
    haptic();
    const iv = setInterval(() => {
      n--;
      if (n > 0) {
        const num = intro.querySelector('[data-n]');
        num.textContent = n;
        num.classList.remove('pop'); void num.offsetWidth; num.classList.add('pop');
        sound('count');
        haptic();
      } else {
        clearInterval(iv);
        play();
      }
    }, 1000);
    app.onLeave(() => clearInterval(iv));

    function play() {
      let word = '';
      let busy = false;
      const node = stage(app, `
        <div class="center"><div class="hu-word" data-word></div></div>
        <div class="actions row">
          <button class="btn ghost" data-pass>Pass</button>
          <button class="btn" data-ok>Correct</button>
        </div>`, { top: `<span class="timer" data-t>${c.seconds}</span>` });
      const wordEl = node.querySelector('[data-word]');
      const timeEl = node.querySelector('[data-t]');

      const next = () => {
        if (!deck.length) deck = shuffle(cat.words);
        word = deck.pop();
        wordEl.textContent = word;
        fit(wordEl, 130, 34);
      };
      const mark = (ok) => {
        if (busy) return;
        busy = true;
        results.push({ word, ok });
        sound(ok ? 'correct' : 'pass');
        haptic(ok ? 'success' : 'tap');
        node.classList.add(ok ? 'flash-good' : 'flash-bad');
        wordEl.textContent = ok ? 'Correct!' : 'Pass';
        fit(wordEl, 130, 34);
        setTimeout(() => {
          node.classList.remove('flash-good', 'flash-bad');
          busy = false;
          next();
        }, 700);
      };

      node.querySelector('[data-pass]').onclick = () => mark(false);
      node.querySelector('[data-ok]').onclick = () => mark(true);
      next();
      sound('go');
      countdown(app, c.seconds, {
        onTick: (left) => {
          timeEl.textContent = left;
          timeEl.classList.toggle('low', left <= 10);
          if (left <= 5) sound('tick');
        },
        onEnd: () => { sound('end'); haptic('heavy'); done(); },
      });
      if (tilt) watchTilt(app, { onDown: () => mark(true), onUp: () => mark(false) });
    }

    function done() {
      const good = results.filter((r) => r.ok).length;
      if (good >= 5) confetti();
      stage(app, `
        <div class="center">
          <div class="kicker">Time's up!</div>
          <div class="mega pop">${good}</div>
          <div class="title-l">correct</div>
          <div class="list">${results.map((r) => `<div class="list-item ${r.ok ? '' : 'no'}"><span>${esc(r.word)}</span><span>${r.ok ? '✓' : '✕'}</span></div>`).join('')}</div>
        </div>
        <div class="actions">
          <button class="btn" data-again>Next player</button>
          <button class="btn ghost sm" data-settings>Change category</button>
        </div>`, {
        bind: (node) => {
          node.querySelector('[data-again]').onclick = () => game.start(app);
          node.querySelector('[data-settings]').onclick = () => app.lobby();
        },
      });
    }
  },
};

export default game;
