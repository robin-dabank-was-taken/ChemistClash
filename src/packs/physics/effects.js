// Physics recipe effects — same combat verbs as chemistry, glitch zones instead of gas.
import { COLS, ROWS, HALF } from '../../data.js';
import {
  idx, colOf, rowOf, halfTiles, shapeTiles, emit, damage, heal, shieldUp,
  ignite, raiseWall, addStrike, addBolt, glitchify, clearGlitches, leapStrike,
} from '../../sim/world.js';
import { modDamage, modHeal, modShield, modDuration } from '../../sim/traits.js';

const CROSS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
const SQUARE = [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
const TALL = [[0, -1], [0, 0], [0, 1]];
const WIDE = [[-1, 0], [0, 0], [1, 0]];
const DOT = [[0, 0]];

const foeSide = (p) => 1 - p.side;
const mirrorCol = (p) => p.col + (p.side === 0 ? HALF : -HALF);
const ahead = (p, offsets) => shapeTiles(mirrorCol(p), p.row, offsets, foeSide(p));

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

function foeRow(p) {
  const side = foeSide(p);
  const tiles = [];
  for (let c = side * HALF; c < side * HALF + HALF; c++) tiles.push(idx(c, p.row));
  return tiles;
}

function hitFrom(game, attacker, victim, amount, kind) {
  return damage(game, victim, amount, kind, { from: attacker.id });
}

function zoneFamily(kind) {
  if (kind === 'probability') return 'quantum';
  if (kind === 'blackbody') return 'thermal';
  if (kind === 'neutron') return 'nuclear';
  return 'em';
}

function zone(game, p, kind, offsets, dur) {
  const t = modDuration(p, zoneFamily(kind), dur);
  for (const i of ahead(p, offsets)) glitchify(game, i, kind, t);
}

function landVictim(game, p, i) {
  return game.players.find((pl) => pl.hp > 0 && pl.id !== p.id && idx(pl.col, pl.row) === i) || null;
}

export const EFFECTS = {
  sparkbolt(game, p) {
    addBolt(game, p, { kind: 'spark', dmg: modDamage(p, 'em', 6), speed: 18 });
  },

  momentum(game, p) {
    const dmg = modDamage(p, 'kinetic', 12);
    leapStrike(game, p, {
      col: mirrorCol(p),
      row: p.row,
      returnT: 0.28,
      onLand: (i) => {
        const victim = landVictim(game, p, i);
        if (victim) hitFrom(game, p, victim, dmg, 'blast');
      },
    });
  },

  photocannon(game, p) {
    const dmg = modDamage(p, 'em', 8);
    const fireT = modDuration(p, 'em', 1.5);
    for (const dy of [-1, 0, 1]) {
      addBolt(game, p, {
        kind: 'rocket', dmg, speed: 18, dy, ignites: true,
        onHit: (i) => ignite(game, i, fireT),
      });
    }
  },

  coulomb(game, p) {
    addStrike(game, {
      owner: p.id, kind: 'spark', tiles: ahead(p, DOT), delay: 0.2,
      onTile: (_i, victim) => {
        if (victim) hitFrom(game, p, victim, modDamage(p, 'em', 14), 'spark');
      },
    });
  },

  tunnel(game, p) {
    const dmg = modDamage(p, 'quantum', 18);
    leapStrike(game, p, {
      col: mirrorCol(p),
      row: p.row,
      returnT: 0.28,
      onLand: (i) => {
        const victim = landVictim(game, p, i);
        if (victim) hitFrom(game, p, victim, dmg, 'blast');
      },
    });
  },

  impact(game, p) {
    addStrike(game, {
      owner: p.id, kind: 'blast', tiles: column(p), delay: 0.25,
      onTile: (_i, victim) => {
        if (victim) hitFrom(game, p, victim, modDamage(p, 'kinetic', 12), 'blast');
      },
    });
  },

  lorentz(game, p) {
    const dmg = modDamage(p, 'em', 8);
    for (const dy of [-1, 1]) {
      addBolt(game, p, { kind: 'spark', dmg, speed: 16, dy });
    }
  },

  plasma(game, p) {
    addBolt(game, p, {
      kind: 'rocket', dmg: modDamage(p, 'thermal', 14), speed: 18, ignites: true,
    });
    for (const i of foeRow(p)) ignite(game, i, modDuration(p, 'thermal', 2));
  },

  fission(game, p) {
    const dmg = modDamage(p, 'nuclear', 16);
    const fireT = modDuration(p, 'nuclear', 2);
    leapStrike(game, p, {
      col: mirrorCol(p),
      row: p.row,
      returnT: 0.28,
      onLand: (land) => {
        const tiles = shapeTiles(colOf(land), rowOf(land), CROSS, foeSide(p));
        for (const i of tiles) {
          ignite(game, i, fireT);
          const victim = landVictim(game, p, i);
          if (victim) hitFrom(game, p, victim, dmg, 'blast');
        }
      },
    });
  },

  cascade(game, p) {
    addStrike(game, {
      owner: p.id, kind: 'blast', tiles: ahead(p, SQUARE), delay: 0.35,
      onTile: (_i, victim) => {
        if (victim) hitFrom(game, p, victim, modDamage(p, 'kinetic', 22), 'blast');
      },
    });
  },

  entropy(game, p) {
    const dmg = modDamage(p, 'thermal', 8);
    const fireT = modDuration(p, 'thermal', 2.5);
    for (const i of halfTiles(foeSide(p))) {
      ignite(game, i, fireT);
      const victim = landVictim(game, p, i);
      if (victim) hitFrom(game, p, victim, dmg, 'burn');
    }
  },

  neutronjet(game, p) {
    addBolt(game, p, { kind: 'rocket', dmg: modDamage(p, 'nuclear', 24), speed: 16 });
  },

  redshift(game, p) {
    const frost = modDuration(p, 'thermal', 3);
    addStrike(game, {
      owner: p.id, kind: 'frost', tiles: ahead(p, DOT), delay: 0.2,
      onTile: (i, victim) => {
        const tile = game.tiles[i];
        const wasWet = tile?.surf === 'wet';
        if (tile) { tile.surf = 'frost'; tile.t = frost; }
        if (!victim) return;
        hitFrom(game, p, victim, modDamage(p, 'thermal', 10), 'frost');
        victim.chill = Math.max(victim.chill, 3);
        emit(game, 'status', { pid: victim.id, status: 'chill' });
        if (wasWet) {
          victim.frozen = Math.max(victim.frozen, 1.5);
          emit(game, 'status', { pid: victim.id, status: 'frozen' });
        }
      },
    });
  },

  annihilation(game, p) {
    addStrike(game, {
      owner: p.id, kind: 'blast', tiles: ahead(p, SQUARE), delay: 0.4,
      onTile: (_i, victim) => {
        if (victim) hitFrom(game, p, victim, modDamage(p, 'kinetic', 36), 'blast');
      },
    });
  },

  synchrotron(game, p) {
    addBolt(game, p, { kind: 'spark', dmg: modDamage(p, 'em', 20), speed: 22 });
  },

  decohere(game, p) {
    addStrike(game, {
      owner: p.id, kind: 'blast', tiles: ahead(p, DOT), delay: 0.2,
      onTile: (i, victim) => {
        const tile = game.tiles[i];
        let bonus = 0;
        if (tile?.glitch) {
          bonus = 8;
          tile.glitch = null;
        }
        if (!victim) return;
        hitFrom(game, p, victim, modDamage(p, 'quantum', 8 + bonus), 'blast');
        victim.stun = Math.max(victim.stun, 1.5);
        emit(game, 'status', { pid: victim.id, status: 'stun' });
      },
    });
  },

  staticfield(game, p) { zone(game, p, 'static', TALL, 5); },
  chargecorrupt(game, p) { zone(game, p, 'charge', CROSS, 5); },
  blackbodytear(game, p) { zone(game, p, 'blackbody', WIDE, 10); },
  probglitch(game, p) { zone(game, p, 'probability', CROSS, 4.5); },
  neutronscramble(game, p) { zone(game, p, 'neutron', SQUARE, 12); },
  vacfluc(game, p) {
    const pool = halfTiles(foeSide(p));
    const picks = game.rng.shuffle(pool.slice()).slice(0, 4);
    for (const i of picks) glitchify(game, i, 'probability', modDuration(p, 'quantum', 3.5));
  },

  fluxwall(game, p) {
    for (const i of column(p)) raiseWall(game, i, modDuration(p, 'field', 8));
  },
  lattice(game, p) {
    for (const i of ahead(p, CROSS)) raiseWall(game, i, modDuration(p, 'barrier', 10));
  },
  barrier(game, p) {
    for (const i of foeRow(p)) raiseWall(game, i, modDuration(p, 'barrier', 9));
  },
  magnetar(game, p) {
    for (const i of column(p)) raiseWall(game, i, modDuration(p, 'field', 12));
  },

  plasmeshield(game, p) {
    shieldUp(game, p, modShield(p, 18, 'barrier'), modDuration(p, 'barrier', 5));
  },
  kevlarfield(game, p) {
    shieldUp(game, p, modShield(p, 34, 'barrier'), modDuration(p, 'barrier', 10));
  },
  zeropoint(game, p) {
    shieldUp(game, p, modShield(p, 26, 'barrier'), modDuration(p, 'barrier', 8));
  },

  coherence(game, p) { heal(game, p, modHeal(p, 20)); },
  coolbath(game, p) { heal(game, p, modHeal(p, 18)); },
  restore(game, p) {
    heal(game, p, modHeal(p, 32));
    cleanse(p);
  },
  wavepulse(game, p) {
    heal(game, p, modHeal(p, 6));
    for (const i of halfTiles(foeSide(p))) {
      if (game.tiles[i].surf === 'fire') {
        for (const n of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const c = colOf(i) + n[0];
          const r = rowOf(i) + n[1];
          if (c >= 0 && c < COLS && r >= 0 && r < ROWS) ignite(game, idx(c, r), 1);
        }
      }
    }
  },
  standing(game, p) {
    cleanse(p);
    p.haste = Math.max(p.haste, 5);
    emit(game, 'status', { pid: p.id, status: 'haste' });
  },
  inertframe(game, p) {
    for (const i of halfTiles(p.side)) {
      const tile = game.tiles[i];
      if (tile.surf === 'fire') {
        tile.surf = null;
        tile.t = 0;
      }
    }
    clearGlitches(game, p.side);
  },
  phasealign(game, p) {
    cleanse(p);
    heal(game, p, modHeal(p, 10));
    p.haste = Math.max(p.haste, 4);
    emit(game, 'status', { pid: p.id, status: 'haste' });
  },

  hawking(game, p) {
    addStrike(game, {
      owner: p.id, kind: 'trump', tiles: halfTiles(foeSide(p)), delay: 0.8,
      onTile: (_i, victim) => {
        if (victim) hitFrom(game, p, victim, modDamage(p, 'nuke', 80), 'blast');
      },
    });
  },
};
