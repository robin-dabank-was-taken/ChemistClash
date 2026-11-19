// Character basic skills — 2 damage plus a chemist-specific rider. 5s cooldown.
import { COLS, GASES, HALF } from '../data.js';
import {
  idx, colOf, rowOf, halfTiles, inField, sideOfCol, emit, damage,
  acidify, gasify, raiseWall, ignite, explode, addStrike, addBolt,
} from './world.js';

export const SKILL_CD = 5;

const foeSide = (p) => 1 - p.side;
const mirrorCol = (p) => p.col + (p.side === 0 ? HALF : -HALF);

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
  const startC = p.col;
  const startR = p.row;
  const dir = p.side === 0 ? 1 : -1;
  // One leap of 4 tiles (all at once), forced onto the enemy half.
  let landC = startC + dir * 4;
  if (!inField(landC, startR)) landC = dir > 0 ? COLS - 1 : 0;
  if (sideOfCol(landC) === p.side) {
    landC = p.side === 0 ? Math.min(COLS - 1, HALF + 2) : Math.max(0, HALF - 3);
  }
  p.col = landC;
  p.row = startR;
  emit(game, 'move', { pid: p.id });

  // 2×3 mist directly in front of Kuro (2 deep × 3 tall).
  const mist = [];
  for (let depth = 1; depth <= 2; depth++) {
    const c = landC + dir * depth;
    for (let dr = -1; dr <= 1; dr++) {
      const r = startR + dr;
      if (!inField(c, r)) continue;
      mist.push(idx(c, r));
      gasify(game, idx(c, r), 'miasma', 2);
    }
  }
  const foe = game.players[1 - p.id];
  if (foe.hp > 0 && mist.includes(idx(foe.col, foe.row))) {
    damage(game, foe, 2, 'poison');
  }

  // Linger on the enemy tile so the leap is visible, then leap back in one move.
  if (!game.dashes) game.dashes = [];
  game.dashes.push({
    pid: p.id,
    startC,
    startR,
    t: 0.28,
  });
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
