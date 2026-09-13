import { el, esc, shuffle, pick, store, haptic, sound, stepper, toggle, chips, panel, playersEditor, passAndReveal, stage } from '../ui.js';
import { categories, relatedPairs } from '../data.js';

// Imposter words are single things or people — never actions.
const cats = () => categories.filter((c) => c.id !== 'actions');
const cfg = () => ({ category: 'random', imposters: 1, related: 0, hint: true, ...store.get('imposter', {}) });
const players = () => store.get('players', []);

/** Hidden players (imposters + related word) must stay a minority. */
function counts(c) {
  const max = Math.max(1, Math.floor((players().length - 1) / 2));
  const imp = Math.min(c.imposters, max);
  return { max, imp, rel: Math.min(c.related, max - imp) };
}

const game = {
  id: 'imposter',
  title: 'Imposter',
  emoji: '🕵️',
  tagline: 'Everyone knows the word… except the imposter.',
  players: '3+ players',
  c: '#ff4d6d',
  d: '#b5174a',
  rules: [
    'Pass the phone round. Each person holds the card to secretly see the word.',
    "The imposter doesn't get a word — just a warning that they're the imposter.",
    "If you've added related-word players, they get a similar word (e.g. Tea instead of Coffee) and aren't told it's different.",
    'Going round the circle, everyone says ONE word about the secret. Be vague, but prove you know it.',
    "After a lap or two, vote on who's hiding something. A caught imposter can still win by guessing the word.",
  ],

  settings(box, app) {
    const c = cfg();
    const save = () => store.set('imposter', c);
    const hidden = el('<div></div>');
    const renderHidden = () => {
      const { max, imp, rel } = counts(c);
      hidden.replaceChildren(panel('Hidden players',
        stepper({ label: 'Imposters', sub: 'Get no word', value: imp, min: 0, max, onChange: (v) => { c.imposters = v; save(); renderHidden(); } }),
        stepper({ label: 'Related word', sub: "Similar word — they don't know", value: rel, min: 0, max: max - imp, onChange: (v) => { c.related = v; save(); renderHidden(); } }),
        toggle({ label: 'Imposters see category', value: c.hint, onChange: (v) => { c.hint = v; save(); } }),
      ));
      app.refresh();
    };
    box.append(
      playersEditor({ min: 3, onChange: renderHidden }),
      panel('Category', chips({
        options: [{ value: 'random', label: '🎲 Random' }, ...cats().map((x) => ({ value: x.id, label: `${x.emoji} ${x.name}` }))],
        value: c.category,
        onChange: (v) => { c.category = v; save(); },
      })),
      hidden,
    );
    renderHidden();
  },

  canPlay() {
    if (players().length < 3) return 'Add at least 3 players';
    const { imp, rel } = counts(cfg());
    if (imp + rel === 0) return 'Add an imposter or a related-word player';
    return null;
  },

  start(app) {
    const c = cfg();
    const list = players();
    const { imp, rel } = counts(c);
    const cat = cats().find((x) => x.id === c.category) ?? pick(cats());

    let word = pick(cat.words);
    let relWord = null;
    if (rel > 0) {
      const [a, b] = pick(relatedPairs[cat.id]);
      const flip = Math.random() < 0.5; // randomise which half the majority gets
      word = flip ? b : a;
      relWord = flip ? a : b;
    }

    const seats = shuffle(list.map((_, i) => i));
    const impSet = new Set(seats.slice(0, imp));
    const relSet = new Set(relWord ? seats.slice(imp, imp + rel) : []);
    // Never make a no-word imposter go first.
    const starter = list[pick(list.map((_, i) => i).filter((i) => !impSet.has(i)))];

    passAndReveal(app, {
      players: list,
      secret: (i) => impSet.has(i)
        ? `<div class="emoji-xl">🕵️</div><div class="kicker">You are the</div><div class="big">Imposter</div>
           ${c.hint ? `<div class="note">Category: <b>${esc(cat.name)}</b></div>` : ''}<div class="note">Blend in!</div>`
        : `<div class="emoji-xl">${cat.emoji}</div><div class="kicker">Your word is</div><div class="big">${esc(relSet.has(i) ? relWord : word)}</div>`,
      onDone: discuss,
    });

    function discuss() {
      sound('go');
      stage(app, `
        <div class="center">
          <div class="emoji-xl bounce">🗣️</div>
          <div class="kicker">First up</div>
          <div class="title-xl pop">${esc(starter)}</div>
          <p class="lead">Go round the circle — one word each about your secret. Do a couple of laps, then vote!</p>
        </div>
        <div class="actions"><button class="btn" data-reveal>Reveal 👀</button></div>`, {
        bind: (n) => { n.querySelector('[data-reveal]').onclick = result; },
      });
    }

    function result() {
      sound('reveal');
      haptic('heavy');
      const names = (set) => [...set].map((i) => list[i]).join(' & ');
      const block = (label, set, detail) => set.size === 0 ? '' : `
        <div class="word-card pop">
          <div class="kicker">${label}</div>
          <div class="word sm">${esc(names(set))}</div>
          <div class="note">${esc(detail)}</div>
        </div>`;
      stage(app, `
        <div class="center">
          <div class="kicker">The word was</div>
          <div class="title-xl pop">${esc(word)}</div>
          ${block(impSet.size > 1 ? 'Imposters' : 'Imposter', impSet, 'had no word')}
          ${relWord ? block('Related word', relSet, `had ${relWord}`) : ''}
        </div>
        <div class="actions">
          <button class="btn" data-again>Play again</button>
          <button class="btn ghost sm" data-settings>Change settings</button>
        </div>`, {
        bind: (n) => {
          n.querySelector('[data-again]').onclick = () => game.start(app);
          n.querySelector('[data-settings]').onclick = () => app.lobby();
        },
      });
    }
  },
};

export default game;
