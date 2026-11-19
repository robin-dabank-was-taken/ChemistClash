// Character basic skills — 2 damage plus a chemist-specific rider. 5s cooldown.
import { COLS, HALF } from '../data.js';
import {
  idx, colOf, rowOf, halfTiles, inField, sideOfCol, emit, damage,
  acidify, gasify, glitchify, raiseWall, addStrike, addBolt, leapStrike,
} from './world.js';
import { modDuration } from './traits.js';

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
  const dir = p.side === 0 ? 1 : -1;
  let landC = p.col + dir * 4;
  if (!inField(landC, p.row)) landC = dir > 0 ? COLS - 1 : 0;
  if (sideOfCol(landC) === p.side) {
    landC = p.side === 0 ? Math.min(COLS - 1, HALF + 2) : Math.max(0, HALF - 3);
  }
  leapStrike(game, p, {
    col: landC,
    row: p.row,
    returnT: 0.28,
    onLand: (land) => {
      const landC2 = colOf(land);
      const landR = rowOf(land);
      const mist = [];
      for (let depth = 1; depth <= 2; depth++) {
        const c = landC2 + dir * depth;
        for (let dr = -1; dr <= 1; dr++) {
          const r = landR + dr;
          if (!inField(c, r)) continue;
          mist.push(idx(c, r));
          gasify(game, idx(c, r), 'miasma', 2);
        }
      }
      const foe = game.players[1 - p.id];
      if (foe.hp > 0 && mist.includes(idx(foe.col, foe.row))) {
        damage(game, foe, 2, 'poison', { from: p.id });
      }
    },
  });
}

function rin(game, p) {
  // Skill poke must not consume the buff (bolt resolves later).
  addBolt(game, p, { kind: 'rocket', dmg: 2, speed: 20, ignites: true });
  game.bolts[game.bolts.length - 1].skipLifeSteal = true;
  p.lifeSteal = 0.5;
  emit(game, 'status', { pid: p.id, status: 'lifesteal' });
}

function yui(game, p) {
  addBolt(game, p, { kind: 'spark', dmg: 2, speed: 16 });
  const dir = p.side === 0 ? 1 : -1;
  let c = p.col + dir;
  // Clamp to frontmost own column so the wall still lands at the front line.
  if (!inField(c, p.row) || sideOfCol(c) !== p.side) {
    c = p.side === 0 ? HALF - 1 : HALF;
  }
  const dur = modDuration(p, 'polymer', 6);
  for (let dr = -1; dr <= 1; dr++) {
    const r = p.row + dr;
    if (!inField(c, r)) continue;
    raiseWall(game, idx(c, r), dur);
  }
}

function hana(game, p) {
  addBolt(game, p, { kind: 'spark', dmg: 2, speed: 16 });
  p.healAmp = 2;
  emit(game, 'status', { pid: p.id, status: 'healamp' });
}

// ---- Physics cast ---------------------------------------------------------

function junseo(game, p) {
  addBolt(game, p, {
    kind: 'spark', dmg: 2, speed: 20,
    onHit: (i) => glitchify(game, i, 'static', 2),
  });
}

function minjae(game, p) {
  leapStrike(game, p, {
    col: mirrorCol(p),
    row: p.row,
    returnT: 0.28,
    onLand: (i) => {
      const foe = game.players[1 - p.id];
      if (foe.hp > 0 && idx(foe.col, foe.row) === i) {
        damage(game, foe, 2, 'blast', { from: p.id });
      }
    },
  });
}

function hajun(game, p) {
  const dir = p.side === 0 ? 1 : -1;
  let landC = p.col + dir * 4;
  if (!inField(landC, p.row)) landC = dir > 0 ? COLS - 1 : 0;
  if (sideOfCol(landC) === p.side) {
    landC = p.side === 0 ? Math.min(COLS - 1, HALF + 2) : Math.max(0, HALF - 3);
  }
  leapStrike(game, p, {
    col: landC,
    row: p.row,
    returnT: 0.28,
    onLand: (land) => {
      const landC2 = colOf(land);
      const landR = rowOf(land);
      const mist = [];
      for (let depth = 1; depth <= 2; depth++) {
        const c = landC2 + dir * depth;
        for (let dr = -1; dr <= 1; dr++) {
          const r = landR + dr;
          if (!inField(c, r)) continue;
          mist.push(idx(c, r));
          glitchify(game, idx(c, r), 'probability', 2);
        }
      }
      const foe = game.players[1 - p.id];
      if (foe.hp > 0 && mist.includes(idx(foe.col, foe.row))) {
        damage(game, foe, 2, 'blast', { from: p.id });
      }
    },
  });
}

function yerin(game, p) {
  addBolt(game, p, { kind: 'spark', dmg: 2, speed: 16 });
  const dir = p.side === 0 ? 1 : -1;
  let c = p.col + dir;
  if (!inField(c, p.row) || sideOfCol(c) !== p.side) {
    c = p.side === 0 ? HALF - 1 : HALF;
  }
  const dur = modDuration(p, 'barrier', 6);
  for (let dr = -1; dr <= 1; dr++) {
    const r = p.row + dr;
    if (!inField(c, r)) continue;
    raiseWall(game, idx(c, r), dur);
  }
}

function doyun(game, p) {
  addBolt(game, p, { kind: 'rocket', dmg: 2, speed: 18, ignites: true });
  game.bolts[game.bolts.length - 1].skipLifeSteal = true;
  p.lifeSteal = 0.5;
  emit(game, 'status', { pid: p.id, status: 'lifesteal' });
}

function sua(game, p) {
  addBolt(game, p, { kind: 'spark', dmg: 2, speed: 16 });
  p.healAmp = 2;
  emit(game, 'status', { pid: p.id, status: 'healamp' });
}

function baseline(game, p) {
  addBolt(game, p, { kind: 'spark', dmg: 2, speed: 16 });
}

const SKILLS = {
  akari, sora, kuro, rin, yui, hana,
  junseo, minjae, hajun, yerin, doyun, sua,
  baseline,
};

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
