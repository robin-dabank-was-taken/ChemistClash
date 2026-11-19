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
// Longer pause before the first hold-repeat so a normal tap is exactly one tile.
const REPEAT_INITIAL = 0.38;
const REPEAT_DELAY = 0.16;
// Client-side gate for online so two packets can't land as two steps.
const ONLINE_MOVE_CD = 0.15;

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
    this.moveCd = [0, 0];
  }

  keydown(code, repeat) {
    const b = this.bindings.get(code);
    if (!b) return false;
    if (repeat) return true;
    if (b.action.type === 'move') {
      this.held[b.pid].delete(code);
      // t counts up; first repeat after REPEAT_INITIAL, then every REPEAT_DELAY.
      this.held[b.pid].set(code, { action: b.action, t: 0, repeated: false });
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
    for (let pid = 0; pid < 2; pid++) {
      this.moveCd[pid] = Math.max(0, this.moveCd[pid] - dt);
    }

    const apply = (pid, action) => {
      if (action.type === 'move' && this.dispatch) {
        if (this.moveCd[pid] > 0) return false;
        this.moveCd[pid] = ONLINE_MOVE_CD;
        this.dispatch(pid, action);
        return true;
      }
      if (this.dispatch) {
        this.dispatch(pid, action);
        return true;
      }
      return act(game, pid, action);
    };

    for (const { pid, action } of this.queue) apply(pid, action);
    this.queue.length = 0;

    for (let pid = 0; pid < 2; pid++) {
      const pending = this.pending[pid];
      if (pending) {
        pending.ttl -= dt;
        const ok = apply(pid, pending.action);
        if (ok || pending.ttl <= 0) {
          this.pending[pid] = null;
          // Restart hold clock from the successful first step (or give-up).
          for (const h of this.held[pid].values()) {
            h.t = 0;
            h.repeated = false;
          }
        }
        continue;
      }

      const latest = [...this.held[pid].values()].pop();
      if (!latest) continue;
      latest.t += dt;
      const need = latest.repeated ? REPEAT_DELAY : REPEAT_INITIAL;
      if (latest.t >= need) {
        if (apply(pid, latest.action)) {
          latest.t = 0;
          latest.repeated = true;
        } else {
          // Blocked (wall / cd): keep trying without accelerating into a double.
          latest.t = need;
        }
      }
    }
  }
}
