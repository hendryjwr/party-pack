import { el, esc, shuffle, store, haptic, sound, stepper, panel, teamsEditor, teamNames, stage, scoreboard, confetti } from '../ui.js';
import { spectrums } from '../data.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const points = (distance) => (distance <= 4 ? 4 : distance <= 12 ? 3 : distance <= 20 ? 2 : 0);

// Dial geometry: value 0 (far left) … 100 (far right) around a semicircle centred at (100, 100).
const at = (v, r) => {
  const a = Math.PI * (1 - v / 100);
  return [100 + r * Math.cos(a), 100 - r * Math.sin(a)];
};
function wedge(from, to, r) {
  const [x1, y1] = at(clamp(from, 0, 100), r);
  const [x2, y2] = at(clamp(to, 0, 100), r);
  return `M100 100 L${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
}

function dial({ card, target = null, guess = null, onGuess }) {
  const zones = target == null ? '' : `
    <path d="${wedge(target - 20, target + 20, 92)}" fill="#ffd166"/>
    <path d="${wedge(target - 12, target + 12, 92)}" fill="#ff9f1c"/>
    <path d="${wedge(target - 4, target + 4, 92)}" fill="#ef476f"/>
    ${[[0, 4], [-8, 3], [8, 3], [-16, 2], [16, 2]]
      .filter(([o]) => target + o >= 2 && target + o <= 98)
      .map(([o, p]) => { const [x, y] = at(target + o, 74); return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="dial-num">${p}</text>`; })
      .join('')}`;
  const node = el(`
    <div class="dial">
      <div class="dial-ends"><span>← ${esc(card[0])}</span><span>${esc(card[1])} →</span></div>
      <svg viewBox="0 0 200 106" role="img" aria-label="Dial">
        <path d="M8 100 A92 92 0 0 1 192 100 Z" class="dial-bg"/>
        ${zones}
        <g class="needle" style="display:none"><line x1="100" y1="100" x2="100" y2="14"/><circle cx="100" cy="100" r="9"/></g>
      </svg>
    </div>`);
  const svg = node.querySelector('svg');
  const needle = node.querySelector('.needle');
  const setNeedle = (v) => {
    needle.style.display = '';
    needle.setAttribute('transform', `rotate(${((v - 50) * 1.8).toFixed(1)} 100 100)`);
  };
  if (guess != null) setNeedle(guess);
  if (onGuess) {
    const move = (e) => {
      const r = svg.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 200;
      const y = ((e.clientY - r.top) / r.height) * 106;
      let a = Math.atan2(100 - y, x - 100);
      if (a < 0) a = x < 100 ? Math.PI : 0;
      const v = 100 * (1 - a / Math.PI);
      setNeedle(v);
      onGuess(v);
    };
    svg.addEventListener('pointerdown', (e) => { svg.setPointerCapture(e.pointerId); move(e); haptic(); });
    svg.addEventListener('pointermove', (e) => { if (svg.hasPointerCapture(e.pointerId)) move(e); });
  }
  return node;
}

const game = {
  id: 'wavelength',
  title: 'Wavelength',
  emoji: '📡',
  tagline: "Read your team's mind on a sliding scale.",
  players: '4+ · 2 teams',
  c: '#7b5cff',
  d: '#4b2fd1',
  rules: [
    'Split into two teams. On your turn, one player is the Psychic.',
    'The Psychic secretly sees where the target sits between two extremes, e.g. Cold ↔ Hot.',
    'They give ONE clue that fits that spot. Target near Hot? Maybe "Lava".',
    'Their team talks it over and drags the needle to where they think the target is.',
    'Bullseye = 4, close = 3, nearby = 2. First team to the goal wins.',
  ],

  settings(box) {
    box.append(
      teamsEditor('wavelength.teams'),
      panel('', stepper({ label: 'Play to', sub: 'points', value: store.get('wavelength.goal', 10), min: 5, max: 30, onChange: (v) => store.set('wavelength.goal', v) })),
    );
  },

  start(app) {
    const teams = teamNames('wavelength.teams');
    const goal = store.get('wavelength.goal', 10);
    const scores = [0, 0];
    let team = 0;
    let deck = [];
    let card;
    let target;
    let guess = 50;

    const draw = () => {
      if (!deck.length) deck = shuffle(spectrums);
      card = deck.pop();
      target = 4 + Math.random() * 92;
    };
    const score = () => `${scores[0]} – ${scores[1]}`;

    const psychic = () => stage(app, `
      <div class="center">
        <div class="kicker">${esc(teams[team])}</div>
        <div class="title-l">Psychic only!</div>
        <p class="note">Everyone else look away 👀</p>
        <div class="w" data-dial></div>
        <p class="lead">Give ONE clue that lands on the red zone.</p>
      </div>
      <div class="actions">
        <button class="btn" data-hide>Hide & show team</button>
        <button class="btn ghost sm" data-new>Different card</button>
      </div>`, {
      top: score(),
      bind: (n) => {
        n.querySelector('[data-dial]').append(dial({ card, target }));
        n.querySelector('[data-new]').onclick = () => { sound('tap'); draw(); psychic(); };
        n.querySelector('[data-hide]').onclick = () => { sound('go'); guess = 50; guessing(); };
      },
    });

    const guessing = () => stage(app, `
      <div class="center">
        <div class="kicker">${esc(teams[team])}</div>
        <div class="title-l">Where's the target?</div>
        <div class="w" data-dial></div>
        <p class="lead">Hear the clue, argue, then drag the needle.</p>
      </div>
      <div class="actions"><button class="btn" data-lock>Lock it in 🔒</button></div>`, {
      top: score(),
      bind: (n) => {
        n.querySelector('[data-dial]').append(dial({ card, guess, onGuess: (v) => { guess = v; } }));
        n.querySelector('[data-lock]').onclick = reveal;
      },
    });

    const reveal = () => {
      const pts = points(Math.abs(guess - target));
      scores[team] += pts;
      const winner = scores.findIndex((s) => s >= goal);
      sound(winner >= 0 ? 'win' : pts ? 'correct' : 'buzz');
      haptic(pts ? 'success' : 'heavy');
      if (pts === 4 || winner >= 0) confetti();
      stage(app, `
        <div class="center">
          <div class="title-xl pop">${pts === 4 ? 'Bullseye!' : pts ? `+${pts} points` : 'Missed!'}</div>
          <div class="w" data-dial></div>
          ${scoreboard(teams, scores, team)}
          ${winner >= 0 ? `<div class="title-l pop">🏆 ${esc(teams[winner])} win!</div>` : ''}
        </div>
        <div class="actions">
          ${winner >= 0 ? '<button class="btn" data-again>Play again</button>' : `<button class="btn" data-next>Next: ${esc(teams[1 - team])}</button>`}
        </div>`, {
        bind: (n) => {
          n.querySelector('[data-dial]').append(dial({ card, target, guess }));
          n.querySelector('[data-next]')?.addEventListener('click', () => { team = 1 - team; draw(); psychic(); });
          n.querySelector('[data-again]')?.addEventListener('click', () => game.start(app));
        },
      });
    };

    draw();
    psychic();
  },
};

export default game;
