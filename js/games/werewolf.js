import { el, esc, shuffle, store, haptic, sound, stepper, toggle, panel, playersEditor, passAndReveal, stage, confetti } from '../ui.js';

const ROLES = {
  werewolf: { name: 'Werewolf', emoji: '🐺', blurb: 'Each night, pick someone to eat. By day, act innocent.' },
  seer: { name: 'Seer', emoji: '🔮', blurb: "Each night, point at someone — the narrator tells you if they're a werewolf." },
  doctor: { name: 'Doctor', emoji: '🩺', blurb: 'Each night, choose one person to save. You can pick yourself.' },
  hunter: { name: 'Hunter', emoji: '🏹', blurb: "If you're eliminated, take someone down with you." },
  villager: { name: 'Villager', emoji: '🧑‍🌾', blurb: 'Find the werewolves and vote them out before it’s too late.' },
};

const cfg = () => ({ wolves: 1, seer: true, doctor: true, hunter: false, ...store.get('werewolf', {}) });
const players = () => store.get('players', []);
const maxWolves = () => Math.max(1, Math.floor(players().length / 3));

const game = {
  id: 'werewolf',
  title: 'Werewolf',
  emoji: '🐺',
  tagline: 'Secret roles. Night kills. Hunt the wolves.',
  players: '5+ & a narrator',
  c: '#9b5de5',
  d: '#5b2ba8',
  rules: [
    "You need a narrator who isn't in the player list — they run the game.",
    'Pass the phone round so everyone secretly sees their role, then hand it to the narrator.',
    'Night: everyone closes their eyes. The narrator wakes each role in turn using the script.',
    'Day: the narrator reveals who died. Everyone argues, accuses and votes someone out.',
    'Villagers win when every werewolf is gone. Werewolves win when they equal or outnumber everyone else.',
  ],

  settings(box, app) {
    const c = cfg();
    const save = () => store.set('werewolf', c);
    const roles = el('<div></div>');
    const renderRoles = () => {
      roles.replaceChildren(panel('Roles',
        stepper({ label: '🐺 Werewolves', value: Math.min(c.wolves, maxWolves()), min: 1, max: maxWolves(), onChange: (v) => { c.wolves = v; save(); } }),
        toggle({ label: '🔮 Seer', value: c.seer, onChange: (v) => { c.seer = v; save(); } }),
        toggle({ label: '🩺 Doctor', value: c.doctor, onChange: (v) => { c.doctor = v; save(); } }),
        toggle({ label: '🏹 Hunter', value: c.hunter, onChange: (v) => { c.hunter = v; save(); } }),
      ));
      app.refresh();
    };
    box.append(playersEditor({ min: 5, onChange: renderRoles }), roles);
    renderRoles();
  },

  canPlay() {
    return players().length < 5 ? 'Add at least 5 players (plus a narrator)' : null;
  },

  start(app) {
    const c = cfg();
    const list = players();
    let roles = Array(Math.min(c.wolves, maxWolves())).fill('werewolf');
    if (c.seer) roles.push('seer');
    if (c.doctor) roles.push('doctor');
    if (c.hunter) roles.push('hunter');
    while (roles.length < list.length) roles.push('villager');
    roles = shuffle(roles.slice(0, list.length));
    const seats = list.map((name, i) => ({ name, role: roles[i], alive: true }));
    const has = (role) => seats.some((s) => s.role === role);

    passAndReveal(app, {
      players: list,
      secret: (i) => {
        const role = ROLES[seats[i].role];
        const pack = seats.filter((s, j) => j !== i && s.role === 'werewolf').map((s) => s.name);
        return `<div class="emoji-xl">${role.emoji}</div><div class="kicker">You are a</div><div class="big">${role.name}</div>
          <div class="note">${esc(role.blurb)}</div>
          ${seats[i].role === 'werewolf' && pack.length ? `<div class="note"><b>Your pack:</b> ${esc(pack.join(', '))}</div>` : ''}`;
      },
      onDone: narrator,
    });

    function narrator() {
      sound('go');
      const night = [
        'Everyone, close your eyes. 😴',
        'Werewolves, wake up and silently agree on someone to kill. Werewolves, sleep.',
        ...(has('seer') ? ["Seer, wake up and point at someone. (Nod if they're a werewolf, shake if not.) Seer, sleep."] : []),
        ...(has('doctor') ? ['Doctor, wake up and point at someone to save. Doctor, sleep.'] : []),
        'Everyone, wake up!',
      ];
      const day = [
        'Announce who was killed (unless the doctor saved them). They are out and must stay silent.',
        'Discuss, accuse, then vote. Majority eliminates a player.',
        ...(has('hunter') ? ['If the Hunter is eliminated, they immediately choose someone to take with them.'] : []),
        'Then night falls again…',
      ];
      let showRoles = false;
      let won = false;

      const node = stage(app, `
        <div class="center top">
          <div class="title-l" style="text-align:center">Narrator</div>
          <div class="panel"><div class="panel-title">🌙 Night — read aloud</div><ol class="script">${night.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>
          <div class="panel"><div class="panel-title">☀️ Day</div><ol class="script">${day.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>
          <div class="panel">
            <div class="field"><span class="panel-title">Players · tap to eliminate</span><button class="chip" data-roles>Show roles</button></div>
            <div data-win></div>
            <div class="seats"></div>
          </div>
        </div>
        <div class="actions"><button class="btn" data-again>Deal again</button></div>`);

      const seatsEl = node.querySelector('.seats');
      const winEl = node.querySelector('[data-win]');
      const rolesBtn = node.querySelector('[data-roles]');

      const render = () => {
        seatsEl.replaceChildren(...seats.map((s) => {
          const b = el(`<button class="seat ${s.alive ? '' : 'dead'}">
            <span>${showRoles ? ROLES[s.role].emoji : '👤'}</span>
            <span class="seat-name">${esc(s.name)}</span>
            <span class="seat-role">${showRoles ? ROLES[s.role].name : ''}${s.alive ? '' : ' 💀'}</span>
          </button>`);
          b.onclick = () => {
            s.alive = !s.alive;
            haptic(s.alive ? 'tap' : 'heavy');
            sound(s.alive ? 'tap' : 'buzz');
            render();
          };
          return b;
        }));
        const wolves = seats.filter((s) => s.alive && s.role === 'werewolf').length;
        const others = seats.filter((s) => s.alive && s.role !== 'werewolf').length;
        const winner = wolves === 0 ? '🎉 Village wins!' : wolves >= others ? '🐺 Werewolves win!' : '';
        winEl.innerHTML = winner ? `<div class="word-card pop"><div class="word sm">${winner}</div></div>` : '';
        if (winner && !won) {
          sound('win');
          confetti();
          // The narrator is usually scrolled down at the player list — bring the result into view.
          winEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        won = Boolean(winner);
      };

      rolesBtn.onclick = () => {
        showRoles = !showRoles;
        rolesBtn.textContent = showRoles ? 'Hide roles' : 'Show roles';
        rolesBtn.classList.toggle('on', showRoles);
        render();
      };
      node.querySelector('[data-again]').onclick = () => game.start(app);
      render();
    }
  },
};

export default game;
