import { esc, shuffle, store, haptic, sound, segmented, panel, teamsEditor, teamNames, stage, scoreboard, countdown, replay } from '../ui.js';
import { taboo } from '../data.js';

const signed = (n) => (n > 0 ? `+${n}` : `${n}`);

const game = {
  id: 'taboo',
  title: 'Forbidden Words',
  emoji: '🤐',
  tagline: "Get them to say it — without the obvious words.",
  players: '4+ · 2 teams',
  c: '#ff4fa3',
  d: '#c2186f',
  rules: [
    'The clue-giver gets their team to say the word at the top of the card.',
    "You can't say any of the forbidden words underneath — or any part of the main word.",
    'Someone from the other team watches the screen and hits BUZZ if you slip up (−1).',
    'Got it = +1. Skip is free. When time runs out, swap teams.',
  ],

  settings(box) {
    box.append(
      teamsEditor('taboo.teams'),
      panel('', segmented({ label: 'Turn length', options: [45, 60, 90].map((s) => ({ value: s, label: `${s}s` })), value: store.get('taboo.seconds', 60), onChange: (v) => store.set('taboo.seconds', v) })),
    );
  },

  start(app) {
    const teams = teamNames('taboo.teams');
    const secs = store.get('taboo.seconds', 60);
    const scores = [0, 0];
    let team = 0;
    let deck = [];
    const draw = () => {
      if (!deck.length) deck = shuffle(taboo);
      return deck.pop();
    };

    const ready = () => stage(app, `
      <div class="center">
        <div class="emoji-xl bounce">🤐</div>
        <div class="title-xl pop">${esc(teams[team])}</div>
        <p class="lead">Clue-giver takes the phone. Someone from ${esc(teams[1 - team])} watches for forbidden words!</p>
        ${scoreboard(teams, scores, team)}
      </div>
      <div class="actions"><button class="btn" data-go>Start · ${secs}s</button></div>`, {
      bind: (n) => { n.querySelector('[data-go]').onclick = turn; },
    });

    function turn() {
      const log = [];
      let card = draw();
      const node = stage(app, `
        <div class="center">
          <div class="taboo-card" data-card></div>
          <div class="note">This turn: <b data-pts>0</b></div>
        </div>
        <div class="actions row three">
          <button class="btn red" data-buzz>Buzz</button>
          <button class="btn ghost" data-skip>Skip</button>
          <button class="btn green" data-got>Got it</button>
        </div>`, { top: `<span class="timer" data-t>${secs}</span>` });
      const cardEl = node.querySelector('[data-card]');
      const pts = node.querySelector('[data-pts]');
      const timeEl = node.querySelector('[data-t]');

      const show = () => {
        cardEl.innerHTML = `<div class="taboo-word">${esc(card[0])}</div><ul>${card[1].map((w) => `<li>${esc(w)}</li>`).join('')}</ul>`;
        replay(cardEl, 'pop');
      };
      const act = (p) => {
        log.push({ word: card[0], p });
        scores[team] += p;
        pts.textContent = signed(log.reduce((sum, x) => sum + x.p, 0));
        sound(p > 0 ? 'correct' : p < 0 ? 'buzz' : 'pass');
        haptic(p > 0 ? 'success' : p < 0 ? 'heavy' : 'tap');
        card = draw();
        show();
      };
      node.querySelector('[data-buzz]').onclick = () => act(-1);
      node.querySelector('[data-skip]').onclick = () => act(0);
      node.querySelector('[data-got]').onclick = () => act(1);
      show();
      sound('go');

      countdown(app, secs, {
        onTick: (s) => {
          timeEl.textContent = s;
          timeEl.classList.toggle('low', s <= 10);
          if (s <= 5) sound('tick');
        },
        onEnd: () => { sound('end'); haptic('heavy'); summary(log); },
      });
    }

    function summary(log) {
      const total = log.reduce((sum, x) => sum + x.p, 0);
      stage(app, `
        <div class="center">
          <div class="title-xl pop">Time's up!</div>
          <div class="title-l">${esc(teams[team])} · ${signed(total)} ${Math.abs(total) === 1 ? 'point' : 'points'}</div>
          <div class="list">${log.map((x) => `<div class="list-item ${x.p ? '' : 'no'}"><span>${esc(x.word)}</span><span>${x.p > 0 ? '✓' : x.p < 0 ? '🚫' : 'skip'}</span></div>`).join('')}</div>
          ${scoreboard(teams, scores, 1 - team)}
        </div>
        <div class="actions"><button class="btn" data-next>Next: ${esc(teams[1 - team])}</button></div>`, {
        bind: (n) => { n.querySelector('[data-next]').onclick = () => { team = 1 - team; ready(); }; },
      });
    }

    ready();
  },
};

export default game;
