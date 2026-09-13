import { esc, shuffle, store, haptic, sound, chips, panel, stage, replay } from '../ui.js';
import { decks } from '../data.js';

const game = {
  id: 'hotseat',
  title: 'Hot Seat',
  emoji: '🔥',
  tagline: 'Most likely to, would you rather, hot takes & more.',
  players: '2+ players',
  c: '#22c55e',
  d: '#15803d',
  rules: [
    'Pick a deck, then read each card out loud.',
    'Most Likely To: on three, everyone points at someone.',
    'Would You Rather / Hot Takes: everyone picks a side — the minority defends themselves.',
    'Never Have I Ever: put a finger down if you have… and explain.',
    'Tap the card or Next for a new one.',
  ],

  settings(box) {
    box.append(panel('Deck', chips({
      options: Object.entries(decks).map(([value, d]) => ({ value, label: `${d.emoji} ${d.name}` })),
      value: store.get('hotseat.deck', 'mostLikely'),
      onChange: (v) => store.set('hotseat.deck', v),
    })));
  },

  start(app) {
    const deck = decks[store.get('hotseat.deck', 'mostLikely')] ?? decks.mostLikely;
    let queue = [];

    const node = stage(app, `
      <div class="center">
        <button class="prompt-card" data-card>
          <div class="kicker" style="opacity:.55">${esc(deck.header)}</div>
          <div class="prompt" data-prompt></div>
        </button>
        <p class="note">${esc(deck.how)}</p>
      </div>
      <div class="actions"><button class="btn" data-next>Next card</button></div>`, { top: `${deck.emoji} ${esc(deck.name)}` });

    const card = node.querySelector('[data-card]');
    const promptEl = node.querySelector('[data-prompt]');
    const next = () => {
      if (!queue.length) queue = shuffle(deck.prompts);
      promptEl.textContent = queue.pop();
      replay(card, 'deal');
      sound('tap');
      haptic();
    };
    card.onclick = next;
    node.querySelector('[data-next]').onclick = next;
    next();
  },
};

export default game;
