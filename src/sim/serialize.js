// Snapshot / hydrate for authoritative net play. Display clients never call
// step/act; they only paint what the host sends.
import { createGame } from './game.js';
import { attachCharacter } from './traits.js';

function snapTile(t) {
  return {
    surf: t.surf,
    t: t.t,
    gas: t.gas ? { kind: t.gas.kind, t: t.gas.t } : null,
    glitch: t.glitch ? { kind: t.glitch.kind, t: t.glitch.t } : null,
    wall: t.wall ? { t: t.wall.t } : null,
  };
}

function snapPlayer(p) {
  return {
    id: p.id,
    name: p.name,
    side: p.side,
    col: p.col,
    row: p.row,
    hp: p.hp,
    moveCd: p.moveCd,
    hurtT: p.hurtT,
    hazardCd: p.hazardCd,
    bag: p.bag.slice(),
    hotbar: p.hotbar.map((s) => ({ el: s.el })),
    pots: p.pots.map((pot) => ({
      atoms: pot.atoms.slice(),
      state: pot.state,
      recipe: pot.recipe ? pot.recipe.id : null,
      t: pot.t,
      total: pot.total,
    })),
    activePot: p.activePot,
    shield: p.shield,
    shieldT: p.shieldT,
    haste: p.haste,
    giddy: p.giddy,
    chill: p.chill,
    frozen: p.frozen,
    stun: p.stun,
    skillCd: p.skillCd || 0,
    healAmp: p.healAmp || 0,
    lifeSteal: p.lifeSteal || 0,
    healCut: p.healCut || 0,
    boltCd: p.boltCd || 0,
    characterId: p.characterId,
  };
}

function snapBolt(b) {
  return {
    x: b.x, row: b.row, dir: b.dir, speed: b.speed, age: b.age,
    owner: b.owner, kind: b.kind, dmg: b.dmg,
    ignites: !!b.ignites, dead: !!b.dead,
  };
}

function snapStrike(s) {
  return {
    owner: s.owner, kind: s.kind, gas: s.gas,
    tiles: s.tiles.slice(), t: s.t, delay: s.delay,
  };
}

export function snapshotGame(game) {
  return {
    rng: game.rng.getState(),
    packId: game.packId || 'chemistry',
    time: game.time,
    phase: game.phase,
    countdown: game.countdown,
    winner: game.winner,
    tiles: game.tiles.map(snapTile),
    players: game.players.map(snapPlayer),
    bolts: game.bolts.map(snapBolt),
    strikes: game.strikes.map(snapStrike),
    fuses: game.fuses.map((f) => ({ i: f.i, t: f.t, glitch: !!f.glitch })),
    dashes: (game.dashes || []).map((d) => ({
      pid: d.pid, startC: d.startC, startR: d.startR, t: d.t,
    })),
  };
}

export function hydrateGame(snap, into = null) {
  const game = into || createGame({
    seed: snap.rng,
    names: snap.players.map((p) => p.name),
    characters: snap.players.map((p) => p.characterId),
    packId: snap.packId || 'chemistry',
  });
  game.rng.setState(snap.rng);
  game.packId = snap.packId || game.packId;
  game.time = snap.time;
  game.phase = snap.phase;
  game.countdown = snap.countdown;
  game.winner = snap.winner;
  game.tiles = snap.tiles.map((t) => ({
    surf: t.surf,
    t: t.t,
    gas: t.gas ? { kind: t.gas.kind, t: t.gas.t } : null,
    glitch: t.glitch ? { kind: t.glitch.kind, t: t.glitch.t } : null,
    wall: t.wall ? { t: t.wall.t } : null,
  }));
  game.players = snap.players.map((sp) => {
    const p = {
      id: sp.id,
      name: sp.name,
      side: sp.side,
      col: sp.col,
      row: sp.row,
      hp: sp.hp,
      moveCd: sp.moveCd,
      hurtT: sp.hurtT,
      hazardCd: sp.hazardCd,
      bag: sp.bag.slice(),
      hotbar: sp.hotbar.map((s) => ({ el: s.el })),
      pots: sp.pots.map((pot) => ({
        atoms: pot.atoms.slice(),
        state: pot.state,
        recipe: pot.recipe ? (game.pack.RECIPE_BY_ID[pot.recipe] || null) : null,
        t: pot.t,
        total: pot.total,
      })),
      activePot: sp.activePot,
      shield: sp.shield,
      shieldT: sp.shieldT,
      haste: sp.haste,
      giddy: sp.giddy,
      chill: sp.chill,
      frozen: sp.frozen,
      stun: sp.stun,
      skillCd: sp.skillCd || 0,
      healAmp: sp.healAmp || 0,
      lifeSteal: sp.lifeSteal || 0,
      healCut: sp.healCut || 0,
      boltCd: sp.boltCd || 0,
    };
    attachCharacter(p, sp.characterId);
    return p;
  });
  game.bolts = snap.bolts.map((b) => ({ ...b, onHit: null }));
  game.strikes = snap.strikes.map((s) => ({ ...s, tiles: s.tiles.slice(), onTile: () => {} }));
  game.fuses = snap.fuses.map((f) => ({ i: f.i, t: f.t, glitch: !!f.glitch }));
  game.dashes = (snap.dashes || []).map((d) => ({
    pid: d.pid, startC: d.startC, startR: d.startR, t: d.t,
  }));
  game.events = [];
  return game;
}
