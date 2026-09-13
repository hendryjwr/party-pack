import { esc, shuffle, store, haptic, sound, chips, segmented, panel, teamsEditor, teamNames, stage, scoreboard, countdown, confetti, replay, submitOnEnter } from '../ui.js';
import { categories } from '../data.js';

const ROUNDS = [
  { title: 'Describe it', emoji: '🗣️', rule: "Describe the name any way you like — just don't say it, spell it or rhyme it." },
  { title: 'One word', emoji: '☝️', rule: 'You get exactly ONE word per slip. Choose wisely!' },
  { title: 'Act it out', emoji: '🎭', rule: 'Charades! No talking, no sounds, no mouthing words.' },
];

const SOURCES = [
  { value: 'mixed', label: '🎲 Mixed', ids: ['famous', 'movies', 'animals', 'places', 'objects', 'food', 'jobs', 'sports'] },
  { value: 'famous', label: '⭐️ People', ids: ['famous'] },
  { value: 'movies', label: '🎬 Movies & TV', ids: ['movies'] },
  { value: 'animals', label: '🦁 Animals', ids: ['animals'] },
  { value: 'places', label: '📍 Places', ids: ['places'] },
  { value: 'things', label: '🪥 Things', ids: ['objects', 'food'] },
];
const poolFor = (value) => {
  const ids = (SOURCES.find((s) => s.value === value) ?? SOURCES[0]).ids;
  return categories.filter((c) => ids.includes(c.id)).flatMap((c) => c.words);
};

const game = {
  id: 'fishbowl',
  title: 'Fishbowl',
  emoji: '🐟',
  tagline: 'Describe it. One word. Act it out.',
  players: '4+ · 2 teams',
  c: '#00b8d4',
  d: '#00809a',
  rules: [
    'Split into two teams. Everyone secretly adds a few names to the bowl — or hit auto-fill.',
    'Round 1: describe it. Round 2: one word only. Round 3: act it out. Same slips every round!',
    'On your turn, clue as many slips as you can for your team before time runs out.',
    'Empty the bowl and the round ends — you keep your leftover time for the next round.',
    'Most slips guessed after all three rounds wins.',
  ],

  settings(box) {
    box.append(
      teamsEditor('fishbowl.teams'),
      panel('', segmented({ label: 'Turn length', options: [30, 45, 60, 90].map((s) => ({ value: s, label: `${s}s` })), value: store.get('fishbowl.seconds', 60), onChange: (v) => store.set('fishbowl.seconds', v) })),
    );
  },

  start(app) {
    const teams = teamNames('fishbowl.teams');
    const seconds = store.get('fishbowl.seconds', 60);
    const slips = [];
    let bowl = [];
    let round = 0;
    let scores = [0, 0];
    let team = 0;
    let carry = null;
    let guessed = [];

    fill();

    function fill() {
      let source = store.get('fishbowl.source', 'mixed');
      let flashTimer;
      const node = stage(app, `
        <div class="center">
          <div class="bowl pop" data-bowl><span data-count>${slips.length}</span><small>in the bowl</small></div>
          <p class="lead">Pass the phone round — everyone secretly adds a few names.</p>
          <form class="add">
            <input placeholder="Type a name…" autocomplete="off" autocapitalize="words" enterkeyhint="done" maxlength="40">
            <button type="submit" aria-label="Add to bowl">+</button>
          </form>
          <div class="note" data-flash>&nbsp;</div>
          <div class="panel w" style="text-align:left">
            <div class="panel-title">Or auto-fill with…</div>
            <div data-sources></div>
            <div class="row">
              <button class="btn ghost sm" data-add="5">+5</button>
              <button class="btn ghost sm" data-add="10">+10</button>
              <button class="btn ghost sm" data-add="20">+20</button>
            </div>
          </div>
        </div>
        <div class="actions"><button class="btn" data-start disabled>Start game</button></div>`, { top: 'Fill the bowl' });

      const count = node.querySelector('[data-count]');
      const flash = node.querySelector('[data-flash]');
      const startBtn = node.querySelector('[data-start]');
      const input = node.querySelector('input');
      node.querySelector('[data-sources]').append(chips({
        options: SOURCES,
        value: source,
        onChange: (v) => { source = v; store.set('fishbowl.source', v); },
      }));

      const update = (message) => {
        count.textContent = slips.length;
        startBtn.disabled = slips.length < 5;
        replay(node.querySelector('[data-bowl]'), 'pop');
        flash.textContent = message;
        clearTimeout(flashTimer);
        flashTimer = setTimeout(() => { flash.innerHTML = '&nbsp;'; }, 1600);
      };

      submitOnEnter(input);
      node.querySelector('form').onsubmit = (e) => {
        e.preventDefault();
        const name = input.value.trim();
        input.value = '';
        if (!name) return;
        slips.push(name);
        haptic();
        sound('tap');
        update('Added ✓ — hidden in the bowl');
      };

      node.querySelectorAll('[data-add]').forEach((b) => {
        b.onclick = () => {
          const have = new Set(slips.map((s) => s.toLowerCase()));
          const extra = shuffle(poolFor(source).filter((w) => !have.has(w.toLowerCase()))).slice(0, Number(b.dataset.add));
          slips.push(...extra);
          haptic('success');
          sound('correct');
          update(extra.length ? `Added ${extra.length} random slips 🎲` : 'No more new ones in that set — try another');
        };
      });

      startBtn.onclick = () => {
        bowl = shuffle(slips);
        roundIntro();
      };
      app.onLeave(() => clearTimeout(flashTimer));
    }

    function roundIntro() {
      sound('go');
      const r = ROUNDS[round];
      stage(app, `
        <div class="center">
          <div class="kicker">Round ${round + 1} of 3</div>
          <div class="emoji-xl bounce">${r.emoji}</div>
          <div class="title-xl pop">${r.title}</div>
          <p class="lead">${r.rule}</p>
          ${carry ? `<p class="note">${esc(teams[team])} emptied the bowl — they keep going with ${carry}s left!</p>` : ''}
          ${scoreboard(teams, scores, team)}
        </div>
        <div class="actions"><button class="btn" data-go>Let's go</button></div>`, {
        bind: (n) => { n.querySelector('[data-go]').onclick = ready; },
      });
    }

    function ready() {
      const r = ROUNDS[round];
      stage(app, `
        <div class="center">
          <div class="kicker">${r.emoji} ${r.title} · ${bowl.length} slips left</div>
          <div class="title-xl pop">${esc(teams[team])}</div>
          <p class="lead">Pick a clue-giver. Only they look at the screen!</p>
          ${scoreboard(teams, scores, team)}
        </div>
        <div class="actions"><button class="btn" data-go>Start · ${carry ?? seconds}s</button></div>`, {
        bind: (n) => { n.querySelector('[data-go]').onclick = turn; },
      });
    }

    function turn() {
      const r = ROUNDS[round];
      const secs = carry ?? seconds;
      carry = null;
      guessed = [];
      let current = bowl.pop();

      const node = stage(app, `
        <div class="center">
          <div class="kicker">${r.emoji} ${r.title} · <span data-left>${bowl.length}</span> left</div>
          <div class="word-card" data-card><div class="word" data-word></div></div>
        </div>
        <div class="actions row">
          <button class="btn ghost" data-skip>Skip</button>
          <button class="btn green" data-got>Got it!</button>
        </div>`, { top: `<span class="timer" data-t>${secs}</span>` });
      const wordEl = node.querySelector('[data-word]');
      const left = node.querySelector('[data-left]');
      const skip = node.querySelector('[data-skip]');
      const timeEl = node.querySelector('[data-t]');

      const show = () => {
        wordEl.textContent = current;
        left.textContent = bowl.length;
        skip.disabled = bowl.length === 0;
        replay(node.querySelector('[data-card]'), 'pop');
      };
      show();
      sound('go');

      const timer = countdown(app, secs, {
        onTick: (s) => {
          timeEl.textContent = s;
          timeEl.classList.toggle('low', s <= 10);
          if (s <= 5) sound('tick');
        },
        onEnd: () => {
          bowl = shuffle([...bowl, current]);
          sound('end');
          haptic('heavy');
          turnOver();
        },
      });

      skip.onclick = () => {
        if (!bowl.length) return;
        bowl.unshift(current);
        current = bowl.pop();
        sound('pass');
        haptic();
        show();
      };

      node.querySelector('[data-got]').onclick = () => {
        scores[team]++;
        guessed.push(current);
        sound('correct');
        haptic('success');
        if (bowl.length) {
          current = bowl.pop();
          show();
          return;
        }
        // Bowl emptied — round over.
        const remaining = timer.left;
        timer.stop();
        round++;
        if (round >= ROUNDS.length) return gameOver();
        bowl = shuffle(slips);
        carry = remaining >= 3 ? remaining : null;
        if (!carry) team = 1 - team;
        roundIntro();
      };
    }

    function turnOver() {
      stage(app, `
        <div class="center">
          <div class="title-xl pop">Time's up!</div>
          <div class="title-l">${esc(teams[team])} +${guessed.length}</div>
          <div class="list">${guessed.map((g) => `<div class="list-item"><span>${esc(g)}</span><span>✓</span></div>`).join('')}</div>
          ${scoreboard(teams, scores, 1 - team)}
        </div>
        <div class="actions"><button class="btn" data-next>Next: ${esc(teams[1 - team])}</button></div>`, {
        bind: (n) => { n.querySelector('[data-next]').onclick = () => { team = 1 - team; ready(); }; },
      });
    }

    function gameOver() {
      sound('win');
      confetti();
      const headline = scores[0] === scores[1] ? "It's a tie!" : `${esc(teams[scores[0] > scores[1] ? 0 : 1])} win!`;
      stage(app, `
        <div class="center">
          <div class="emoji-xl bounce">🏆</div>
          <div class="title-xl pop">${headline}</div>
          ${scoreboard(teams, scores)}
        </div>
        <div class="actions">
          <button class="btn" data-again>Play again · same slips</button>
          <button class="btn ghost sm" data-new>New bowl</button>
        </div>`, {
        bind: (n) => {
          n.querySelector('[data-again]').onclick = () => {
            scores = [0, 0];
            team = 0;
            round = 0;
            carry = null;
            bowl = shuffle(slips);
            roundIntro();
          };
          n.querySelector('[data-new]').onclick = () => game.start(app);
        },
      });
    }
  },
};

export default game;
