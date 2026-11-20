// Persistent local player id + display name for ranked queue.

const ID_KEY = 'chemistPlayerId';
const NAME_KEY = 'chemistPlayerName';

function randomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getPlayerId() {
  if (typeof localStorage === 'undefined') return randomId();
  let id = localStorage.getItem(ID_KEY);
  if (!id) {
    id = randomId();
    localStorage.setItem(ID_KEY, id);
  }
  return id;
}

export function getPlayerName() {
  if (typeof localStorage === 'undefined') return 'Challenger';
  const n = (localStorage.getItem(NAME_KEY) || '').trim();
  return n || 'Challenger';
}

export function setPlayerName(name) {
  const clean = String(name || '').trim().slice(0, 18);
  if (typeof localStorage !== 'undefined') {
    if (clean) localStorage.setItem(NAME_KEY, clean);
    else localStorage.removeItem(NAME_KEY);
  }
  return clean || 'Challenger';
}
