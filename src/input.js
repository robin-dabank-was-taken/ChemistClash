// Keyboard -> game actions. Bindings use physical key positions (event.code),
// so they sit in the same place on any keyboard layout.
import { act } from './sim/game.js';

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

// Solo vs bot: OSFE-leaning layout — arrows, Q/W pots, E confirm, R discard.
export const KEYS_SOLO = {
  up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
  slots: ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'],
  potA: ['KeyQ'], potB: ['KeyW'], run: ['KeyE'], clear: ['KeyR'],
  labels: {
    slots: ['1', '2', '3', '4', '5'], potA: 'Q', potB: 'W', run: 'E', clear: 'R', move: 'ARROWS',
    toggle: 'Q/W', // legend fallback
  },
};

// Local P1 (WASD) — kept for two-player on one keyboard.
export const KEYS_P1 = {
  up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
  slots: ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'],
  toggle: ['KeyQ'], run: ['KeyE'], clear: ['KeyX'],
  labels: { slots: ['1', '2', '3', '4', '5'], toggle: 'Q', run: 'E', clear: 'X', move: 'WASD' },
};

export const KEYS_P2 = {
  up: ['KeyI', 'ArrowUp'], down: ['KeyK', 'ArrowDown'], left: ['KeyJ', 'ArrowLeft'], right: ['KeyL', 'ArrowRight'],
  slots: ['Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'],
  toggle: ['KeyU'], run: ['KeyO'], clear: ['Comma'],
  labels: { slots: ['6', '7', '8', '9', '0'], toggle: 'U', run: 'O', clear: ',', move: 'IJKL' },
};

const BUFFER = 0.16;
const REPEAT_DELAY = 0.22;

export class Input {
  constructor() {
    this.bindings = new Map();
    this.dispatch = null; // optional (pid, action) => {} for online play
    this.reset();
  }

  // humans: array of { pid, keys }.
  configure(humans) {
    this.bindings.clear();
    const bind = (codes, pid, action) => {
      for (const code of codes || []) this.bindings.set(code, { pid, action });
    };
    for (const { pid, keys } of humans) {
      for (const name in DIRS) bind(keys[name], pid, { type: 'move', dx: DIRS[name][0], dy: DIRS[name][1] });
      keys.slots.forEach((code, i) => bind([code], pid, { type: 'slot', i }));
      if (keys.potA) bind(keys.potA, pid, { type: 'selectPot', pot: 0 });
      if (keys.potB) bind(keys.potB, pid, { type: 'selectPot', pot: 1 });
      if (keys.toggle) bind(keys.toggle, pid, { type: 'toggle' });
      bind(keys.run, pid, { type: 'run' });
      bind(keys.clear, pid, { type: 'clear' });
    }
    this.reset();
  }

  reset() {
    this.queue = [];
    this.held = [new Map(), new Map()];
    this.pending = [null, null];
  }

  keydown(code, repeat) {
    const b = this.bindings.get(code);
    if (!b) return false;
    if (repeat) return true;
    if (b.action.type === 'move') {
      this.held[b.pid].delete(code);
      this.held[b.pid].set(code, { action: b.action, t: 0 });
      this.pending[b.pid] = { action: b.action, ttl: BUFFER };
    } else {
      this.queue.push(b);
    }
    return true;
  }

  keyup(code) {
    const b = this.bindings.get(code);
    if (b) this.held[b.pid].delete(code);
  }

  update(game, dt) {
    const apply = (pid, action) => {
      if (this.dispatch) this.dispatch(pid, action);
      else act(game, pid, action);
    };
    for (const { pid, action } of this.queue) apply(pid, action);
    this.queue.length = 0;
    for (let pid = 0; pid < 2; pid++) {
      const pending = this.pending[pid];
      if (pending) {
        pending.ttl -= dt;
        // Online: fire once immediately; local: keep trying until move lands.
        if (this.dispatch) {
          apply(pid, pending.action);
          this.pending[pid] = null;
          continue;
        }
        if (apply(pid, pending.action) || pending.ttl <= 0) this.pending[pid] = null;
        continue;
      }
      const latest = [...this.held[pid].values()].pop();
      if (!latest) continue;
      latest.t += dt;
      if (latest.t >= REPEAT_DELAY) {
        apply(pid, latest.action);
        if (this.dispatch) latest.t = 0;
      }
    }
  }
}
