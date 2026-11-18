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

// Resolve from this module so GitHub Pages (/ChemistClash/) and localhost both work.
function characterAsset(id, file, version) {
  return new URL(`../../assets/characters/${id}/${file}?v=${version}`, import.meta.url).href;
}

export function preloadPortraits(ids) {
  for (const id of ids) {
    load(portraits, id, characterAsset(id, 'portrait.png', 'natural1'));
    load(walks, id, characterAsset(id, 'walk.png', 'mz1'));
    load(poses, id, characterAsset(id, 'poses.png', 'mz1'));
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

