// What each finished reaction actually does. Keyed by recipe id (see data.js).
import { COLS, ROWS, HALF } from '../data.js';
import {
  idx, colOf, rowOf, halfTiles, neighbors, shapeTiles, sideOfCol, emit, damage, heal, shieldUp, knockback,
  ignite, douse, chill, acidify, gasify, raiseWall, breakWall, addStrike, addBolt,
} from './world.js';
import { modDamage, modHeal, modShield, modDuration } from './traits.js';

const CROSS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
const SQUARE = [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
const TALL = [[0, -1], [0, 0], [0, 1]];
const WIDE = [[-1, 0], [0, 0], [1, 0]];
const RING = SQUARE.filter(([dc, dr]) => dc || dr);
const DOT = [[0, 0]];

const foeSide = (p) => 1 - p.side;
const foeOf = (game, p) => game.players[1 - p.id];
// The tile "4 ahead": same row, same position on the other half of the board.
const mirrorCol = (p) => p.col + (p.side === 0 ? HALF : -HALF);
const ahead = (p, offsets) => shapeTiles(mirrorCol(p), p.row, offsets, foeSide(p));

function status(game, p, name, dur) {
  p[name] = Math.max(p[name], dur);
  emit(game, 'status', { pid: p.id, status: name });
}

function cleanse(p) {
  p.giddy = 0;
  p.chill = 0;
  p.frozen = 0;
  p.stun = 0;
}

function column(p) {
  const tiles = [];
  for (let r = 0; r < ROWS; r++) tiles.push(idx(mirrorCol(p), r));
  return tiles;
}

// The four tiles of the enemy half that share the caster's row.
function foeRow(p) {
  const side = foeSide(p);
  const tiles = [];
  for (let c = side * HALF; c < side * HALF + HALF; c++) tiles.push(idx(c, p.row));
  return tiles;
}

// A 2x2 block starting at the mirror tile, expanding toward the enemy backline
// and staying on the board when the caster is on the top or bottom row.
function crystalBlock(p) {
  const dc = p.side === 0 ? 1 : -1;
  const dr = p.row >= ROWS - 1 ? -1 : 1;
  return ahead(p, [[0, 0], [dc, 0], [0, dr], [dc, dr]]);
}

function wallStrike(game, p, tiles, delay, dur) {
  addStrike(game, {
    owner: p.id, kind: 'wall', tiles, delay,
    onTile: (i) => raiseWall(game, i, dur),
  });
}

function gasCloud(game, p, kind, offsets, dur, family = 'toxin') {
  const t = modDuration(p, family, dur);
  addStrike(game, {
    owner: p.id, kind: 'gas', gas: kind, tiles: ahead(p, offsets), delay: 0.4,
    onTile: (i) => gasify(game, i, kind, t),
  });
}

export const EFFECTS = {
  h2(game, p) {
    addBolt(game, p, { kind: 'spark', dmg: modDamage(p, 'organic', 6), speed: 16, ignites: true });
  },

  hcl(game, p) {
    addBolt(game, p, { kind: 'acid', dmg: modDamage(p, 'acid', 12), speed: 13, onHit: (i) => acidify(game, i, modDuration(p, 'acid', 3)) });
  },

  o2(game, p) {
    heal(game, p, modHeal(p, 6));
    const side = foeSide(p);
    const burning = halfTiles(side).filter((i) => game.tiles[i].surf === 'fire');
    for (const i of burning) {
      ignite(game, i, 3);
      for (const n of neighbors(i)) if (sideOfCol(n % COLS) === side) ignite(game, n, 3);
    }
    emit(game, 'fan', { side, count: burning.length });
  },

  n2(game, p) {
    for (const i of halfTiles(p.side)) {
      const tile = game.tiles[i];
      if (tile.surf === 'fire') {
        tile.surf = null;
        tile.t = 0;
      }
      tile.gas = null;
    }
    emit(game, 'blanket', { side: p.side });
  },

  co(game, p) {
    gasCloud(game, p, 'co', TALL, 6);
  },

  cl2(game, p) {
    gasCloud(game, p, 'cl2', CROSS, 5);
  },

  h2o(game, p) {
    const tiles = [];
    for (let c = 0; c < COLS; c++) tiles.push(idx(c, p.row));
    const wet = modDuration(p, 'aqueous', 5);
    const dmg = modDamage(p, 'aqueous', 6);
    addStrike(game, {
      owner: p.id, kind: 'water', tiles, delay: 0.2,
      onTile: (i, victim) => {
        breakWall(game, i);
        douse(game, i, wet);
        if (victim) {
          damage(game, victim, dmg, 'water');
          knockback(game, victim);
        }
      },
    });
  },

  co2(game, p) {
    const frost = modDuration(p, 'aqueous', 4);
    const dmg = modDamage(p, 'aqueous', 8);
    addStrike(game, {
      owner: p.id, kind: 'frost', tiles: column(p), delay: 0.45,
      onTile: (i, victim) => {
        const wasWet = chill(game, i, frost);
        if (!victim) return;
        damage(game, victim, dmg, 'frost');
        status(game, victim, 'chill', 3);
        if (wasWet) status(game, victim, 'frozen', 1.5);
      },
    });
  },

  c2h3cl(game, p) {
    wallStrike(game, p, column(p), 0.45, modDuration(p, 'polymer', 8));
  },

  p2o5(game, p) {
    wallStrike(game, p, ahead(p, CROSS), 0.5, modDuration(p, 'polymer', 10));
  },

  c10h8(game, p) {
    wallStrike(game, p, crystalBlock(p), 0.55, modDuration(p, 'polymer', 12));
  },

  c6h10o5(game, p) {
    wallStrike(game, p, foeRow(p), 0.5, modDuration(p, 'polymer', 9));
  },

  o3(game, p) {
    shieldUp(game, p, modShield(p, 20, 'oxidizer'), modDuration(p, 'oxidizer', 6));
  },

  c2h4(game, p) {
    shieldUp(game, p, modShield(p, 25, 'polymer'), modDuration(p, 'polymer', 8));
  },

  h3po4(game, p) {
    shieldUp(game, p, modShield(p, 35, 'acid'), modDuration(p, 'acid', 10));
  },

  c14h10n2o2(game, p) {
    shieldUp(game, p, modShield(p, 60, 'polymer'), modDuration(p, 'polymer', 15));
  },

  h2s(game, p) {
    gasCloud(game, p, 'h2s', WIDE, 5);
  },

  n2o(game, p) {
    gasCloud(game, p, 'n2o', CROSS, 4.5);
  },

  so2(game, p) {
    const foe = foeOf(game, p);
    const target = idx(foe.col, foe.row);
    const others = game.rng.shuffle(halfTiles(foeSide(p)).filter((i) => i !== target)).slice(0, 4);
    addStrike(game, {
      owner: p.id, kind: 'acid', tiles: [target, ...others], delay: 0.7,
      onTile: (i, victim) => {
        acidify(game, i, modDuration(p, 'acid', 4));
        if (victim) damage(game, victim, modDamage(p, 'acid', 8), 'acid');
      },
    });
  },

  hcn(game, p) {
    addStrike(game, {
      owner: p.id, kind: 'cyanide', tiles: ahead(p, DOT), delay: 0.45,
      onTile: (_i, victim) => {
        if (victim) damage(game, victim, modDamage(p, 'toxin', 22), 'poison');
      },
    });
  },

  n2h4(game, p) {
    addBolt(game, p, { kind: 'rocket', dmg: modDamage(p, 'oxidizer', 20), speed: 22, ignites: true, onHit: (i) => ignite(game, i, modDuration(p, 'oxidizer', 2)) });
  },

  hno3(game, p) {
    addStrike(game, {
      owner: p.id, kind: 'acid', tiles: column(p), delay: 0.5,
      onTile: (i, victim) => {
        acidify(game, i, modDuration(p, 'acid', 3.5));
        if (victim) damage(game, victim, modDamage(p, 'acid', 12), 'acid');
      },
    });
  },

  chcl3(game, p) {
    addStrike(game, {
      owner: p.id, kind: 'knockout', tiles: ahead(p, DOT), delay: 0.5,
      onTile: (_i, victim) => {
        if (!victim) return;
        damage(game, victim, modDamage(p, 'toxin', 6), 'poison');
        status(game, victim, 'stun', 1.5);
      },
    });
  },

  nh3(game, p) {
    cleanse(p);
    status(game, p, 'haste', 5);
  },

  // Alkali splash at the mirror tile, then Chebyshev rings expand over the enemy half.
  // Each ring telegraphs and resolves on its own delay so the foe can step off it.
  nh4oh(game, p) {
    const mc = mirrorCol(p);
    const mr = p.row;
    const side = foeSide(p);
    const dmg = modDamage(p, 'base', 12);
    const rings = new Map();
    for (const i of halfTiles(side)) {
      const d = Math.max(Math.abs(colOf(i) - mc), Math.abs(rowOf(i) - mr));
      if (!rings.has(d)) rings.set(d, []);
      rings.get(d).push(i);
    }
    const windup = 0.4;
    const gap = 0.3;
    for (const d of [...rings.keys()].sort((a, b) => a - b)) {
      const tiles = rings.get(d);
      addStrike(game, {
        owner: p.id,
        kind: 'base',
        tiles,
        delay: windup + d * gap,
        onTile: (_i, victim) => {
          if (victim) damage(game, victim, dmg, 'base');
        },
      });
    }
  },

  h2o2(game, p) {
    heal(game, p, modHeal(p, 22));
  },

  c2h6o(game, p) {
    heal(game, p, modHeal(p, 16));
  },

  c9h8o4(game, p) {
    heal(game, p, modHeal(p, 35));
    cleanse(p);
  },

  c6h12o6(game, p) {
    heal(game, p, modHeal(p, 45));
    status(game, p, 'haste', 4);
  },

  c2h2(game, p) {
    const side = foeSide(p);
    const tiles = [];
    for (let c = side * HALF; c < side * HALF + HALF; c++) tiles.push(idx(c, p.row));
    addStrike(game, {
      owner: p.id, kind: 'fire', tiles, delay: 0.3,
      onTile: (i, victim) => {
        if (victim) damage(game, victim, modDamage(p, 'organic', 16), 'burn');
        ignite(game, i, modDuration(p, 'organic', 3));
      },
    });
  },

  ph3(game, p) {
    addStrike(game, {
      owner: p.id, kind: 'fire', tiles: ahead(p, CROSS), delay: 0.5,
      onTile: (i, victim) => {
        if (victim) damage(game, victim, modDamage(p, 'organic', 8), 'burn');
        ignite(game, i, modDuration(p, 'organic', 4));
      },
    });
  },

  ch4(game, p) {
    gasCloud(game, p, 'ch4', SQUARE, 7, 'organic');
  },

  p4(game, p) {
    addStrike(game, {
      owner: p.id, kind: 'fire', tiles: halfTiles(foeSide(p)), delay: 0.7,
      onTile: (i, victim) => {
        if (victim) damage(game, victim, modDamage(p, 'oxidizer', 8), 'burn');
        ignite(game, i, modDuration(p, 'oxidizer', 3));
      },
    });
  },

  h2so4(game, p) {
    addStrike(game, {
      owner: p.id, kind: 'acid', tiles: ahead(p, SQUARE), delay: 0.7,
      onTile: (i, victim) => {
        const wasWet = acidify(game, i, modDuration(p, 'acid', 5));
        if (victim) damage(game, victim, modDamage(p, 'acid', wasWet ? 34 : 24), 'acid');
      },
    });
  },

  c3h8(game, p) {
    const dmg = modDamage(p, 'organic', 26);
    addStrike(game, {
      owner: p.id, kind: 'blast', tiles: ahead(p, CROSS), delay: 0.7,
      onTile: (i, victim) => {
        emit(game, 'explosion', { i, power: dmg });
        if (victim) damage(game, victim, dmg, 'blast');
        ignite(game, i, modDuration(p, 'organic', 2));
      },
    });
  },

  c6h6(game, p) {
    addStrike(game, {
      owner: p.id, kind: 'solvent', tiles: ahead(p, RING), delay: 0.7,
      onTile: (_i, victim) => {
        if (victim) damage(game, victim, modDamage(p, 'toxin', 20), 'poison');
      },
    });
  },

  c8h18(game, p) {
    const side = foeSide(p);
    const tiles = [];
    for (let r = Math.max(0, p.row - 1); r <= Math.min(ROWS - 1, p.row + 1); r++) {
      for (let c = side * HALF; c < side * HALF + HALF; c++) tiles.push(idx(c, r));
    }
    addStrike(game, {
      owner: p.id, kind: 'fire', tiles, delay: 0.5,
      onTile: (i, victim) => {
        if (victim) damage(game, victim, modDamage(p, 'organic', 24), 'burn');
        ignite(game, i, modDuration(p, 'organic', 3));
      },
    });
  },

  // Oleanolic acid, the trump card: nowhere on the enemy side is safe.
  c30h48o3(game, p) {
    addStrike(game, {
      owner: p.id, kind: 'trump', tiles: halfTiles(foeSide(p)), delay: 1.2,
      onTile: (_i, victim) => {
        if (victim) damage(game, victim, modDamage(p, 'nuke', 80), 'blast');
      },
    });
  },

  nh4no3(game, p) {
    const centre = idx(mirrorCol(p), p.row);
    const core = modDamage(p, 'organic', 45);
    const splash = modDamage(p, 'organic', 30);
    addStrike(game, {
      owner: p.id, kind: 'blast', tiles: ahead(p, SQUARE), delay: 0.9,
      onTile: (i, victim) => {
        emit(game, 'explosion', { i, power: i === centre ? core : splash });
        if (victim) damage(game, victim, i === centre ? core : splash, 'blast');
        ignite(game, i, modDuration(p, 'organic', 2));
      },
    });
  },
};
