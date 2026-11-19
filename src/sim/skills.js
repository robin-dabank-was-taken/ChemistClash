// Character basic skills — 2 damage plus a chemist-specific rider. 5s cooldown.
import { GASES, HALF } from '../data.js';
import {
  idx, colOf, rowOf, halfTiles, inField, sideOfCol, emit, damage,
  acidify, gasify, raiseWall, ignite, explode, addStrike, addBolt,
} from './world.js';

export const SKILL_CD = 5;

const CROSS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];

const foeSide = (p) => 1 - p.side;
const mirrorCol = (p) => p.col + (p.side === 0 ? HALF : -HALF);

function frontCol(p) {
  const dir = p.side === 0 ? 1 : -1;
  let c = p.col;
  while (inField(c + dir, p.row) && sideOfCol(c + dir) === p.side) c += dir;
  return c;
}

function akari(game, p) {
  addBolt(game, p, {
    kind: 'acid', dmg: 2, speed: 18,
    onHit: (i) => acidify(game, i, 2),
  });
}

function sora(game, p) {
  const mc = mirrorCol(p);
  const mr = p.row;
  const side = foeSide(p);
  const rings = new Map();
  for (const i of halfTiles(side)) {
    const d = Math.max(Math.abs(colOf(i) - mc), Math.abs(rowOf(i) - mr));
    if (!rings.has(d)) rings.set(d, []);
    rings.get(d).push(i);
  }
  const windup = 0.25;
  const gap = 0.22;
  for (const d of [...rings.keys()].sort((a, b) => a - b)) {
    addStrike(game, {
      owner: p.id,
      kind: 'base',
      tiles: rings.get(d),
      delay: windup + d * gap,
      onTile: (_i, victim) => {
        if (victim) damage(game, victim, 2, 'base');
      },
    });
  }
}

function kuro(game, p) {
  const dest = frontCol(p);
  if (dest !== p.col) {
    p.col = dest;
    emit(game, 'move', { pid: p.id });
  }
  addBolt(game, p, { kind: 'spark', dmg: 2, speed: 18 });
  const side = foeSide(p);
  const mc = mirrorCol(p);
  const mr = p.row;
  for (const [dc, dr] of CROSS) {
    const c = mc + dc;
    const r = mr + dr;
    if (!inField(c, r) || sideOfCol(c) !== side) continue;
    gasify(game, idx(c, r), 'miasma', 2);
  }
}

function rin(game, p) {
  addBolt(game, p, { kind: 'rocket', dmg: 2, speed: 20, ignites: true });
  for (const i of halfTiles(foeSide(p))) {
    const tile = game.tiles[i];
    if (!tile.gas) continue;
    if (GASES[tile.gas.kind]?.flammable) explode(game, i);
    else {
      tile.gas = null;
      ignite(game, i, 1.5);
    }
  }
}

function yui(game, p) {
  addBolt(game, p, { kind: 'spark', dmg: 2, speed: 16 });
  const dir = p.side === 0 ? 1 : -1;
  const c = p.col + dir;
  if (inField(c, p.row) && sideOfCol(c) === p.side) {
    raiseWall(game, idx(c, p.row), 4);
  }
}

function hana(game, p) {
  addBolt(game, p, { kind: 'spark', dmg: 2, speed: 16 });
  p.healAmp = 2;
  emit(game, 'status', { pid: p.id, status: 'healamp' });
}

function baseline(game, p) {
  addBolt(game, p, { kind: 'spark', dmg: 2, speed: 16 });
}

const SKILLS = { akari, sora, kuro, rin, yui, hana, baseline };

export function castSkill(game, p) {
  if ((p.skillCd || 0) > 0) {
    emit(game, 'deny', { pid: p.id });
    return false;
  }
  const id = p.characterId || 'baseline';
  (SKILLS[id] || baseline)(game, p);
  p.skillCd = SKILL_CD;
  emit(game, 'skill', { pid: p.id, skill: id });
  return true;
}
