// Board primitives shared by the rules and the recipe effects: tiles, surfaces,
// gas, damage, and the two ways an attack reaches the other side (strikes, bolts).
import { COLS, ROWS, HALF, GASES } from '../data.js';

export const TUNE = {
  maxHp: 100,
  moveCd: 0.13, // seconds between steps
  fizzleTime: 0.4,
  hazardTick: 0.5, // how often standing in fire / acid / gas hurts
  fireDmg: 4,
  acidDmg: 3,
  countdown: 3,
  heatStep: 0.1, // reaction-rate change per burning (+) or frosted (-) tile on your side
  rateMin: 0.5,
  rateMax: 2,
  hasteRate: 1.3,
  hasteMove: 0.7,
  chillMove: 1.8,
};

export const idx = (c, r) => r * COLS + c;
export const colOf = (i) => i % COLS;
export const rowOf = (i) => Math.floor(i / COLS);
export const sideOfCol = (c) => (c < HALF ? 0 : 1);
export const inField = (c, r) => c >= 0 && c < COLS && r >= 0 && r < ROWS;

export function halfTiles(side) {
  const out = [];
  for (let r = 0; r < ROWS; r++) for (let c = side * HALF; c < side * HALF + HALF; c++) out.push(idx(c, r));
  return out;
}

export function neighbors(i) {
  const c = colOf(i);
  const r = rowOf(i);
  const out = [];
  if (c > 0) out.push(i - 1);
  if (c < COLS - 1) out.push(i + 1);
  if (r > 0) out.push(i - COLS);
  if (r < ROWS - 1) out.push(i + COLS);
  return out;
}

// Tiles of a shape centred on (cc, cr), clipped to one side of the board.
export function shapeTiles(cc, cr, offsets, side) {
  const out = [];
  for (const [dc, dr] of offsets) {
    const c = cc + dc;
    const r = cr + dr;
    if (inField(c, r) && sideOfCol(c) === side) out.push(idx(c, r));
  }
  return out;
}

export function occupant(game, i) {
  return game.players.find((p) => p.hp > 0 && idx(p.col, p.row) === i) || null;
}

export function emit(game, type, data) {
  game.events.push({ type, ...data });
}

// ---------------------------------------------------------------- players

export function damage(game, p, amount, kind = 'hit', opts = {}) {
  if (p.hp <= 0 || amount <= 0) return 0;
  let left = amount;
  if (p.shield > 0) {
    const absorbed = Math.min(p.shield, left);
    p.shield -= absorbed;
    left -= absorbed;
    emit(game, 'shield-hit', { pid: p.id, amount: absorbed });
    if (p.shield <= 0) {
      p.shieldT = 0;
      emit(game, 'shield-break', { pid: p.id });
    }
  }
  if (left <= 0) return 0;
  p.hp = Math.max(0, p.hp - left);
  p.hurtT = 0.25;
  emit(game, 'damage', { pid: p.id, amount: left, kind });
  if (opts.from != null && !opts.skipLifeSteal) {
    const attacker = game.players[opts.from];
    if (attacker && attacker.lifeSteal > 0) {
      const steal = Math.round(left * attacker.lifeSteal);
      attacker.lifeSteal = 0;
      if (steal > 0) heal(game, attacker, steal);
    }
  }
  return left;
}

// A stronger or longer shield replaces what is there; shields never add up.
export function shieldUp(game, p, amount, dur) {
  p.shield = Math.max(p.shield, amount);
  p.shieldT = Math.max(p.shieldT, dur);
  emit(game, 'status', { pid: p.id, status: 'shield' });
}

export function heal(game, p, amount) {
  let amt = amount;
  if (p.healAmp && p.healAmp > 1) {
    amt = Math.round(amount * p.healAmp);
    p.healAmp = 0;
  }
  if (p.healCut && p.healCut > 0) amt = Math.round(amt * 0.5);
  const before = p.hp;
  p.hp = Math.min(TUNE.maxHp, p.hp + amt);
  emit(game, 'heal', { pid: p.id, amount: p.hp - before });
}

export function knockback(game, p) {
  const c = p.col + (p.side === 0 ? -1 : 1);
  if (inField(c, p.row) && sideOfCol(c) === p.side && !game.tiles[idx(c, p.row)].wall) {
    p.col = c;
    emit(game, 'move', { pid: p.id });
  }
}

// How fast this player's reactions run right now. Every burning tile on your
// side heats your lab (faster); every frosted tile cools it (slower).
export function labHeat(game, side) {
  let heat = 0;
  for (const i of halfTiles(side)) {
    const s = game.tiles[i].surf;
    if (s === 'fire') heat++;
    else if (s === 'frost') heat--;
  }
  return heat;
}

export function reactionRate(game, p) {
  const base = Math.min(TUNE.rateMax, Math.max(TUNE.rateMin, 1 + TUNE.heatStep * labHeat(game, p.side)));
  return p.haste > 0 ? base * TUNE.hasteRate : base;
}

// ---------------------------------------------------------------- walls
// A solid wall occupies a tile: nothing can step onto it, and bolts smash into it.

export function raiseWall(game, i, dur) {
  if (occupant(game, i)) return false; // never wall someone into place
  const tile = game.tiles[i];
  tile.wall = { t: tile.wall ? Math.max(tile.wall.t, dur) : dur };
  emit(game, 'wall', { i });
  return true;
}

export function breakWall(game, i) {
  const tile = game.tiles[i];
  if (!tile.wall) return false;
  tile.wall = null;
  emit(game, 'wall-break', { i });
  return true;
}

// ---------------------------------------------------------------- surfaces
// A tile has at most one surface (fire, wet, acid, frost) plus at most one gas.
// Walls sit on top of surfaces and are separate from them.

const isFlammable = (tile, game) => {
  if (!tile.gas) return false;
  const gases = game?.pack?.gases || GASES;
  return !!gases[tile.gas.kind]?.flammable;
};

function setSurf(tile, surf, dur) {
  tile.t = tile.surf === surf ? Math.max(tile.t, dur) : dur;
  tile.surf = surf;
}

export function ignite(game, i, dur) {
  const tile = game.tiles[i];
  if (tile.wall) breakWall(game, i); // organic / oxide walls burn or crack in the heat
  if (isFlammable(tile, game)) {
    explode(game, i);
    return;
  }
  if (tile.surf === 'wet') {
    // Boils the water off instead of catching.
    tile.surf = null;
    tile.t = 0;
    emit(game, 'steam', { i });
  } else if (tile.surf === 'frost') {
    setSurf(tile, 'wet', 2.5);
    emit(game, 'steam', { i });
  } else {
    if (tile.surf !== 'fire') emit(game, 'ignite', { i });
    setSurf(tile, 'fire', dur);
  }
}

export function douse(game, i, dur) {
  const tile = game.tiles[i];
  if (tile.surf === 'frost') return; // freezes on contact; the ice stays
  if (tile.surf === 'fire') emit(game, 'steam', { i });
  setSurf(tile, 'wet', dur);
}

// Returns true if the tile was wet, i.e. whoever stands there is frozen solid.
export function chill(game, i, dur) {
  const tile = game.tiles[i];
  const wasWet = tile.surf === 'wet';
  if (tile.surf === 'fire') emit(game, 'steam', { i });
  setSurf(tile, 'frost', dur);
  return wasWet;
}

// Returns true if the tile was wet: acid hitting water is violently exothermic.
export function acidify(game, i, dur) {
  const tile = game.tiles[i];
  if (tile.wall) breakWall(game, i); // acid eats through a wall
  const wasWet = tile.surf === 'wet';
  if (wasWet) emit(game, 'steam', { i });
  setSurf(tile, 'acid', dur);
  return wasWet;
}

export function gasify(game, i, kind, dur) {
  const tile = game.tiles[i];
  tile.gas = { kind, t: dur };
  tile.glitch = null;
  emit(game, 'gas', { i, kind });
  const gases = game.pack?.gases || GASES;
  if (tile.surf === 'fire' && gases[kind]?.flammable) explode(game, i);
}

/** Physics zone: same combat knobs as gas, different presentation. */
export function glitchify(game, i, kind, dur) {
  const tile = game.tiles[i];
  tile.glitch = { kind, t: dur };
  tile.gas = null;
  const table = game.pack?.glitches || {};
  if (tile.surf === 'fire' && table[kind]?.unstable) explodeGlitch(game, i);
  emit(game, 'glitch', { i, kind });
}

export function clearGlitches(game, side) {
  for (const i of halfTiles(side)) {
    if (game.tiles[i].glitch) {
      game.tiles[i].glitch = null;
      emit(game, 'glitch-clear', { i });
    }
  }
}

export function explode(game, i) {
  const tile = game.tiles[i];
  if (!isFlammable(tile, game)) return;
  const gases = game.pack?.gases || GASES;
  const power = gases[tile.gas.kind]?.boom || 10;
  tile.gas = null;
  emit(game, 'explosion', { i, power });
  breakWall(game, i);
  const victim = occupant(game, i);
  if (victim) damage(game, victim, power, 'blast');
  ignite(game, i, 1.5);
  // Neighbouring flammable gas goes up a beat later, so clouds chain visibly.
  for (const n of neighbors(i)) if (isFlammable(game.tiles[n], game)) game.fuses.push({ i: n, t: 0.09 });
}

export function explodeGlitch(game, i) {
  const tile = game.tiles[i];
  const table = game.pack?.glitches || {};
  if (!tile.glitch || !table[tile.glitch.kind]?.unstable) return;
  const power = table[tile.glitch.kind].boom || 12;
  tile.glitch = null;
  emit(game, 'explosion', { i, power });
  breakWall(game, i);
  const victim = occupant(game, i);
  if (victim) damage(game, victim, power, 'blast');
  ignite(game, i, 1.2);
  for (const n of neighbors(i)) {
    const g = game.tiles[n].glitch;
    if (g && table[g.kind]?.unstable) game.fuses.push({ i: n, t: 0.09, glitch: true });
  }
}

// ---------------------------------------------------------------- attacks

// A telegraphed area effect: `tiles` are marked for `delay` seconds, then
// `onTile(i, victim)` runs for each one (victim = the non-owner standing there).
export function addStrike(game, { owner, kind, tiles, delay, onTile, gas = null }) {
  game.strikes.push({ owner, kind, tiles, delay, onTile, gas, t: 0 });
  emit(game, 'telegraph', { owner, kind, tiles });
}

// A projectile that flies toward the other side. Optional `dy` steps the row
// once per column crossed (diagonal bolts).
export function addBolt(game, p, { kind, dmg, speed, ignites = false, onHit = null, dy = 0 }) {
  game.bolts.push({
    owner: p.id, kind, dmg, speed, ignites, onHit, dy,
    originCol: p.col, originRow: p.row,
    row: p.row, x: p.col, dir: p.side === 0 ? 1 : -1, age: 0, dead: false,
  });
  emit(game, 'bolt', { owner: p.id, kind });
}

export function stepBolt(game, b, dt) {
  const prev = b.x;
  b.x += b.dir * b.speed * dt;
  b.age += dt;
  // Visit every tile centre crossed this step, in flight order.
  let c = b.dir > 0 ? Math.floor(prev) + 1 : Math.ceil(prev) - 1;
  while (b.dir > 0 ? c <= b.x : c >= b.x) {
    if (c < 0 || c >= COLS) {
      b.dead = true;
      return;
    }
    // Diagonal bolts step one row per column; bounce off the top/bottom edges
    // instead of flying out of the board.
    if (b.dy) {
      let next = b.row + b.dy;
      if (next < 0 || next >= ROWS) {
        b.dy = -b.dy;
        next = b.row + b.dy;
        emit(game, 'bolt-bounce', { owner: b.owner, kind: b.kind, c, row: b.row });
      }
      b.row = Math.max(0, Math.min(ROWS - 1, next));
    }
    const i = idx(c, b.row);
    if (b.ignites && isFlammable(game.tiles[i], game)) explode(game, i);
    if (game.tiles[i].wall) {
      emit(game, 'bolt-hit', { i, kind: b.kind });
      breakWall(game, i);
      if (b.onHit) b.onHit(i, null);
      b.dead = true;
      return;
    }
    const victim = occupant(game, i);
    if (victim && victim.id !== b.owner) {
      emit(game, 'bolt-hit', { i, kind: b.kind });
      damage(game, victim, b.dmg, b.kind, { from: b.owner, skipLifeSteal: !!b.skipLifeSteal });
      if (b.onHit) b.onHit(i, victim);
      b.dead = true;
      return;
    }
    c += b.dir;
  }
}

// Leap onto the foe half, run onLand, then snap back via game.dashes.
export function leapStrike(game, p, { col, row = p.row, returnT = 0.28, onLand = null }) {
  const startC = p.col;
  const startR = p.row;
  const foe = 1 - p.side;
  const lo = foe * HALF;
  const hi = lo + HALF - 1;
  let landC = Math.max(lo, Math.min(hi, col));
  let landR = Math.max(0, Math.min(ROWS - 1, row));

  const free = (c, r) => inField(c, r) && sideOfCol(c) === foe && !game.tiles[idx(c, r)].wall;
  if (!free(landC, landR)) {
    let found = null;
    for (let d = 0; d < HALF; d++) {
      for (const c of [landC - d, landC + d]) {
        if (c >= lo && c <= hi && free(c, landR)) {
          found = c;
          break;
        }
      }
      if (found != null) break;
    }
    if (found == null) {
      if (onLand) onLand(idx(landC, landR));
      return false;
    }
    landC = found;
  }

  p.col = landC;
  p.row = landR;
  emit(game, 'move', { pid: p.id });
  if (onLand) onLand(idx(landC, landR));
  if (!game.dashes) game.dashes = [];
  game.dashes.push({ pid: p.id, startC, startR, t: returnT });
  return true;
}

export function washAcid(game, i) {
  const tile = game.tiles[i];
  if (tile.surf !== 'acid') return false;
  tile.surf = null;
  tile.t = 0;
  return true;
}
