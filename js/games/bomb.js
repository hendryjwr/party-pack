import { esc, pick, store, haptic, sound, segmented, panel, stage, replay } from '../ui.js';
import { bombCategories, bombLetters } from '../data.js';

const game = {
  id: 'bomb',
  title: 'Pass the Bomb',
  emoji: '💣',
  tagline: 'Answer fast and pass it on before it blows!',
  players: '3+ players',
  c: '#ff7a1a',
  d: '#c2410c',
  rules: [
    'Sit in a circle. The screen shows a category (or some letters).',
    'Say something that fits — no repeats, no hesitating — then pass the phone on.',
    'The fuse is secret and the ticking speeds up as it burns.',
    "Whoever's holding the phone when it goes BOOM loses the round.",
  ],

  settings(box) {
    box.append(panel('', segmented({
      label: 'Prompts',
      options: [{ value: 'categories', label: 'Categories' }, { value: 'letters', label: 'Letters' }],
      value: store.get('bomb.mode', 'categories'),
      onChange: (v) => store.set('bomb.mode', v),
    })));
  },

  start(app) {
    const mode = store.get('bomb.mode', 'categories');
    const pool = mode === 'letters' ? bombLetters : bombCategories;
    let last = '';
    const prompt = () => {
      let p;
      do { p = pick(pool); } while (p === last && pool.length > 1);
      last = p;
      return p;
    };

    const light = () => {
      const node = stage(app, `
        <div class="center">
          <div class="bomb" data-bomb>💣</div>
          <div class="kicker">${mode === 'letters' ? 'Say a word containing' : 'Name…'}</div>
          <div class="title-xl pop" data-prompt>${esc(prompt())}</div>
          <p class="lead">Answer, then pass the phone! ➡️</p>
        </div>
        <div class="actions"><button class="btn ghost sm" data-new>New prompt</button></div>`, { cls: 'bomb-stage' });
      const bombEl = node.querySelector('[data-bomb]');
      const promptEl = node.querySelector('[data-prompt]');
      node.querySelector('[data-new]').onclick = () => {
        promptEl.textContent = prompt();
        replay(promptEl, 'pop');
        haptic();
      };

      const fuse = 18000 + Math.random() * 37000;
      const started = performance.now();
      let timeout;
      const tick = () => {
        const progress = (performance.now() - started) / fuse;
        if (progress >= 1) return boom();
        sound('tick');
        replay(bombEl, 'beat');
        node.style.setProperty('--heat', progress.toFixed(2));
        // Speeds up as the fuse burns, with jitter so nobody can count it.
        timeout = setTimeout(tick, Math.max(120, 900 - 760 * progress) * (0.8 + Math.random() * 0.4));
      };
      tick();
      app.onLeave(() => clearTimeout(timeout));
    };

    const boom = () => {
      sound('boom');
      haptic('heavy');
      stage(app, `
        <div class="center">
          <div class="emoji-xl pop" style="font-size:140px">💥</div>
          <div class="title-xl shake">BOOM!</div>
          <p class="lead">Whoever's holding the phone loses this round!</p>
        </div>
        <div class="actions"><button class="btn" data-next>Next round</button></div>`, {
        cls: 'boom-stage',
        bind: (n) => { n.querySelector('[data-next]').onclick = () => { sound('go'); light(); }; },
      });
    };

    light();
  },
};

export default game;
