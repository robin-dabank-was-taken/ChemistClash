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

export function preloadPortraits(ids) {
  for (const id of ids) {
    load(portraits, id, `/assets/characters/${id}/portrait.png?v=natural1`);
    load(walks, id, `/assets/characters/${id}/walk.png?v=mz1`);
    load(poses, id, `/assets/characters/${id}/poses.png?v=mz1`);
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
