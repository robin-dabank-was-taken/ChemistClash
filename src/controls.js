// Rebindable controls for solo / online (room-code) play. Persisted in localStorage.

const STORAGE_KEY = 'chemistClash.soloBinds.v3';

export const SOLO_BIND_ROWS = [
  { id: 'up', label: 'Move up' },
  { id: 'down', label: 'Move down' },
  { id: 'left', label: 'Move left' },
  { id: 'right', label: 'Move right' },
  { id: 'slot0', label: 'Hotbar 1' },
  { id: 'slot1', label: 'Hotbar 2' },
  { id: 'slot2', label: 'Hotbar 3' },
  { id: 'slot3', label: 'Hotbar 4' },
  { id: 'slot4', label: 'Hotbar 5' },
  { id: 'potA', label: 'Select pot A' },
  { id: 'potB', label: 'Select pot B' },
  { id: 'run', label: 'Confirm reaction' },
  { id: 'clear', label: 'Empty pot' },
  { id: 'skill', label: 'Chemist skill' },
  { id: 'shuffle', label: 'Refresh hotbar' },
  { id: 'bolt', label: 'Fire bolt (2 dmg)' },
];

export const DEFAULT_SOLO_BINDS = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  slot0: 'KeyA',
  slot1: 'KeyS',
  slot2: 'KeyD',
  slot3: 'KeyF',
  slot4: 'KeyG',
  potA: 'KeyQ',
  potB: 'KeyW',
  run: 'KeyC',
  clear: 'KeyV',
  skill: 'KeyE',
  shuffle: 'ShiftLeft',
  bolt: 'Space',
};

let soloBinds = { ...DEFAULT_SOLO_BINDS };

export function loadSoloBinds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      soloBinds = { ...DEFAULT_SOLO_BINDS };
      return soloBinds;
    }
    const parsed = JSON.parse(raw);
    soloBinds = { ...DEFAULT_SOLO_BINDS };
    for (const key of Object.keys(DEFAULT_SOLO_BINDS)) {
      if (typeof parsed[key] === 'string' && parsed[key]) soloBinds[key] = parsed[key];
    }
  } catch {
    soloBinds = { ...DEFAULT_SOLO_BINDS };
  }
  return soloBinds;
}

export function getSoloBinds() {
  return soloBinds;
}

export function saveSoloBinds() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(soloBinds));
  } catch { /* private mode */ }
}

export function resetSoloBinds() {
  soloBinds = { ...DEFAULT_SOLO_BINDS };
  saveSoloBinds();
  return soloBinds;
}

/** Rebind one action. If another action already uses this code, swap them. */
export function rebindSolo(actionId, code) {
  if (!(actionId in soloBinds)) return false;
  if (!code || code === 'Escape') return false;
  const prev = soloBinds[actionId];
  for (const [other, c] of Object.entries(soloBinds)) {
    if (other !== actionId && c === code) {
      soloBinds[other] = prev;
      break;
    }
  }
  soloBinds[actionId] = code;
  saveSoloBinds();
  return true;
}

export function codeLabel(code) {
  if (!code) return '?';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const special = {
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    Comma: ',', Period: '.', Space: 'SPACE', Slash: '/',
    ShiftLeft: 'SHIFT', ShiftRight: 'SHIFT',
    Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']',
    Minus: '-', Equal: '=', Backquote: '`',
  };
  return special[code] || code;
}

function moveLabel(binds) {
  const u = codeLabel(binds.up);
  const d = codeLabel(binds.down);
  const l = codeLabel(binds.left);
  const r = codeLabel(binds.right);
  if (binds.up === 'ArrowUp' && binds.down === 'ArrowDown'
    && binds.left === 'ArrowLeft' && binds.right === 'ArrowRight') {
    return 'ARROWS';
  }
  return `${u}${l}${d}${r}`;
}

/** Build the KEYS_* shape used by Input / HUD for solo & online. */
export function buildSoloKeys(binds = soloBinds) {
  const b = binds;
  return {
    up: [b.up],
    down: [b.down],
    left: [b.left],
    right: [b.right],
    slots: [b.slot0, b.slot1, b.slot2, b.slot3, b.slot4],
    potA: [b.potA],
    potB: [b.potB],
    run: [b.run],
    clear: [b.clear],
    skill: [b.skill],
    shuffle: [b.shuffle],
    bolt: [b.bolt],
    labels: {
      slots: [0, 1, 2, 3, 4].map((i) => codeLabel(b[`slot${i}`])),
      potA: codeLabel(b.potA),
      potB: codeLabel(b.potB),
      run: codeLabel(b.run),
      clear: codeLabel(b.clear),
      skill: codeLabel(b.skill),
      shuffle: codeLabel(b.shuffle),
      bolt: codeLabel(b.bolt),
      move: moveLabel(b),
      toggle: `${codeLabel(b.potA)}/${codeLabel(b.potB)}`,
    },
  };
}

loadSoloBinds();
