// Loads character portraits, walk sheets, and pose sheets (idle/cast/hurt/death).
const portraits = new Map();
const walks = new Map();
const poses = new Map();

function load(map, id, path) {
  if (map.has(id)) return;
  const img = new Image();
  img.decoding = 'async';
  img.src = path;
  map.set(id, img);
}

function packFolder(pack) {
  return pack === 'physics' ? 'physicists' : 'chemists';
}

// Resolve from this module so GitHub Pages (/ChemistClash/) and localhost both work.
function characterAsset(id, pack, file, version) {
  return new URL(
    `../../assets/characters/${packFolder(pack)}/${id}/${file}?v=${version}`,
    import.meta.url,
  ).href;
}

/** Preload sheets for character objects `{ id, pack }`, or bare id strings (chemistry). */
export function preloadPortraits(chars) {
  for (const entry of chars) {
    const id = typeof entry === 'string' ? entry : entry.id;
    const pack = typeof entry === 'string' ? 'chemistry' : (entry.pack || 'chemistry');
    load(portraits, id, characterAsset(id, pack, 'portrait.png', 'pack21'));
    load(walks, id, characterAsset(id, pack, 'walk.png', 'pack21'));
    load(poses, id, characterAsset(id, pack, 'poses.png', 'pack21'));
  }
}

function ready(map, id) {
  const img = map.get(id);
  return img && img.complete && img.naturalWidth ? img : null;
}

export function getPortrait(id) {
  return ready(portraits, id);
}

export function getWalkSheet(id) {
  return ready(walks, id);
}

export function getPoseSheet(id) {
  return ready(poses, id);
}

export const POSE = { idle: 0, cast: 1, hurt: 2, death: 3 };
