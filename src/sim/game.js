// The rules of a match. Pure simulation: no DOM, no drawing. Everything a
// player (human or bot) can do goes through act(); time advances through step().
import { COLS, ROWS, GASES, findRecipe, buildBag } from '../data.js';
import '../families.js'; // stamp recipe.family at load
import { DEFAULT_CHARACTER_ID } from '../characters.js';
import { makeRng } from './rng.js';
import { EFFECTS } from './effects.js';
import { attachCharacter } from './traits.js';
import {
  TUNE, idx, inField, sideOfCol, emit, damage, reactionRate, explode, stepBolt,
} from './world.js';
import { castSkill } from './skills.js';

const HOTBAR_SIZE = 5;
const MAX_EVENTS = 4000;

// Atoms come off a shuffled bag; an empty bag is replaced by a fresh one, so
// the supply is endless but never drifts far from the bag's proportions.
function drawAtom(game, p) {
  if (!p.bag.length) p.bag = game.rng.shuffle(buildBag());
  return p.bag.pop();
}

function makePlayer(game, id, name, characterId) {
  const p = {
    id, name,
    side: id, // 0 = left half, 1 = right half
    col: id === 0 ? 1 : COLS - 2,
    row: id === 0 ? 1 : 2,
    hp: TUNE.maxHp,
    moveCd: 0, hurtT: 0, hazardCd: 0,
    bag: [],
    hotbar: [],
    pots: [0, 1].map(() => ({ atoms: [], state: 'idle', recipe: null, t: 0, total: 0 })),
    activePot: 0,
    shield: 0, shieldT: 0, haste: 0, giddy: 0, chill: 0, frozen: 0, stun: 0,
    skillCd: 0, healAmp: 0,
  };
  attachCharacter(p, characterId || DEFAULT_CHARACTER_ID);
  for (let i = 0; i < HOTBAR_SIZE; i++) p.hotbar.push({ el: drawAtom(game, p) });
  return p;
}

export function createGame({
  seed = (Math.random() * 2 ** 32) >>> 0,
  names = ['Player 1', 'Player 2'],
  characters = [DEFAULT_CHARACTER_ID, DEFAULT_CHARACTER_ID],
} = {}) {
  const game = {
    rng: makeRng(seed),
    time: 0,
    phase: 'countdown', // countdown -> playing -> over
    countdown: TUNE.countdown,
    winner: null, // player id, or -1 for a draw
    tiles: Array.from({ length: COLS * ROWS }, () => ({ surf: null, t: 0, gas: null, wall: null })),
    players: [],
    bolts: [],
    strikes: [],
    fuses: [],
    dashes: [], // timed skill leaps (e.g. Kuro return)
    events: [], // drained by whoever is presenting the match
  };
  game.players.push(
    makePlayer(game, 0, names[0], characters[0]),
    makePlayer(game, 1, names[1], characters[1]),
  );
  return game;
}

// ---------------------------------------------------------------- actions

function tryMove(game, p, dx, dy) {
  if (p.frozen > 0 || p.stun > 0 || p.moveCd > 0) return false;
  if (p.giddy > 0) {
    dx = -dx;
    dy = -dy;
  }
  const c = p.col + dx;
  const r = p.row + dy;
  if (!inField(c, r) || sideOfCol(c) !== p.side) return false;
  if (game.tiles[idx(c, r)].wall) return false;
  p.col = c;
  p.row = r;
  p.moveCd = TUNE.moveCd * (p.chill > 0 ? TUNE.chillMove : 1) * (p.haste > 0 ? TUNE.hasteMove : 1);
  emit(game, 'move', { pid: p.id });
  return true;
}

function throwAtom(game, p, i) {
  const slot = p.hotbar[i];
  const pot = p.pots[p.activePot];
  if (!slot) return false;
  if (pot.state !== 'idle') {
    emit(game, 'deny', { pid: p.id });
    return false;
  }
  pot.atoms.push(slot.el);
  emit(game, 'throw', { pid: p.id, pot: p.activePot, el: slot.el });
  slot.el = drawAtom(game, p); // the next atom takes its place at once
  return true;
}

function clearPot(game, p) {
  const pot = p.pots[p.activePot];
  if (pot.state !== 'idle' || !pot.atoms.length) {
    emit(game, 'deny', { pid: p.id });
    return false;
  }
  pot.atoms = [];
  emit(game, 'clear', { pid: p.id, pot: p.activePot });
  return true;
}

function finishPot(game, p, k) {
  const pot = p.pots[k];
  const recipe = pot.recipe;
  pot.atoms = [];
  pot.state = 'idle';
  pot.recipe = null;
  pot.t = 0;
  pot.total = 0;
  if (recipe) {
    emit(game, 'react-done', { pid: p.id, pot: k, recipe: recipe.id });
    EFFECTS[recipe.id](game, p, recipe);
  } else {
    emit(game, 'fizzle', { pid: p.id, pot: k });
  }
}

function runPot(game, p) {
  const k = p.activePot;
  const pot = p.pots[k];
  if (pot.state !== 'idle' || !pot.atoms.length) {
    emit(game, 'deny', { pid: p.id });
    return false;
  }
  // Atoms that do not add up to a known molecule still "react": they fizzle.
  pot.recipe = findRecipe(pot.atoms);
  pot.state = 'reacting';
  pot.t = 0;
  pot.total = pot.recipe ? pot.recipe.time : TUNE.fizzleTime;
  emit(game, 'react-start', { pid: p.id, pot: k, recipe: pot.recipe ? pot.recipe.id : null });
  if (pot.total <= 0) finishPot(game, p, k);
  return true;
}

// action: move | slot | toggle | selectPot | run | clear | skill
export function act(game, pid, action) {
  if (game.phase !== 'playing') return false;
  const p = game.players[pid];
  if (p.hp <= 0) return false;
  if (action.type === 'move') return tryMove(game, p, action.dx, action.dy);
  if (p.stun > 0) {
    // Knocked out: hands off the bench until it wears off.
    emit(game, 'deny', { pid });
    return false;
  }
  switch (action.type) {
    case 'slot':
      return throwAtom(game, p, action.i);
    case 'toggle':
      p.activePot = 1 - p.activePot;
      emit(game, 'toggle', { pid });
      return true;
    case 'selectPot': {
      const pot = action.pot === 1 ? 1 : 0;
      if (p.activePot === pot) return true;
      p.activePot = pot;
      emit(game, 'toggle', { pid });
      return true;
    }
    case 'run':
      return runPot(game, p);
    case 'clear':
      return clearPot(game, p);
    case 'skill':
      return castSkill(game, p);
    default:
      return false;
  }
}

// ---------------------------------------------------------------- time

const tick = (v, dt) => (v > dt ? v - dt : 0);

function stepPlayer(game, p, dt) {
  p.moveCd = tick(p.moveCd, dt);
  p.hurtT = tick(p.hurtT, dt);
  p.hazardCd = tick(p.hazardCd, dt);
  p.skillCd = tick(p.skillCd || 0, dt);
  p.haste = tick(p.haste, dt);
  p.giddy = tick(p.giddy, dt);
  p.chill = tick(p.chill, dt);
  p.frozen = tick(p.frozen, dt);
  p.stun = tick(p.stun, dt);
  if (p.shieldT > 0) {
    p.shieldT = tick(p.shieldT, dt);
    if (p.shieldT === 0) p.shield = 0;
  }

  const rate = reactionRate(game, p);
  for (let k = 0; k < p.pots.length; k++) {
    const pot = p.pots[k];
    if (pot.state !== 'reacting') continue;
    // Only real reactions care about lab temperature; a fizzle is just a fizzle.
    pot.t += dt * (pot.recipe ? rate : 1);
    if (pot.t >= pot.total) finishPot(game, p, k);
  }
}

function stepHazards(game, p) {
  const tile = game.tiles[idx(p.col, p.row)];
  if (tile.surf === 'frost') p.chill = Math.max(p.chill, 1);
  const gas = tile.gas ? GASES[tile.gas.kind] : null;
  if (gas && gas.giddy) p.giddy = Math.max(p.giddy, gas.giddy);
  if (p.hazardCd > 0) return;
  // The cooldown starts even when a shield soaks the tick, so shields drain at
  // the same pace health would.
  let exposed = false;
  if (tile.surf === 'fire') {
    damage(game, p, TUNE.fireDmg, 'burn');
    exposed = true;
  }
  if (tile.surf === 'acid') {
    damage(game, p, TUNE.acidDmg, 'acid');
    exposed = true;
  }
  if (gas && gas.dmg) {
    damage(game, p, gas.dmg, 'gas');
    exposed = true;
  }
  if (exposed) p.hazardCd = TUNE.hazardTick;
}

export function step(game, dt) {
  if (game.phase === 'over') return;
  if (game.phase === 'countdown') {
    game.countdown -= dt;
    if (game.countdown <= 0) {
      game.phase = 'playing';
      emit(game, 'go', {});
    }
    return;
  }
  game.time += dt;

  for (const p of game.players) stepPlayer(game, p, dt);

  for (const b of game.bolts) stepBolt(game, b, dt);
  game.bolts = game.bolts.filter((b) => !b.dead);

  const landed = [];
  for (const s of game.strikes) {
    s.t += dt;
    if (s.t >= s.delay) landed.push(s);
  }
  if (landed.length) {
    game.strikes = game.strikes.filter((s) => s.t < s.delay);
    for (const s of landed) {
      emit(game, 'strike', { owner: s.owner, kind: s.kind, gas: s.gas, tiles: s.tiles });
      // Where the victim stands is fixed before any tile resolves, so an effect
      // that moves them (knockback) cannot push them into a second hit.
      const foe = game.players[1 - s.owner];
      const hitTile = foe.hp > 0 ? idx(foe.col, foe.row) : -1;
      for (const i of s.tiles) s.onTile(i, i === hitTile ? foe : null);
    }
  }

  if (game.fuses.length) {
    const lit = [];
    for (const f of game.fuses) {
      f.t -= dt;
      if (f.t <= 0) lit.push(f.i);
    }
    game.fuses = game.fuses.filter((f) => f.t > 0);
    for (const i of lit) explode(game, i);
  }

  if (game.dashes?.length) {
    for (const d of game.dashes) {
      d.t -= dt;
      if (d.t > 0) continue;
      const p = game.players[d.pid];
      if (p && p.hp > 0) {
        p.col = d.startC;
        p.row = d.startR;
        emit(game, 'move', { pid: p.id });
      }
    }
    game.dashes = game.dashes.filter((d) => d.t > 0);
  }

  for (const tile of game.tiles) {
    if (tile.surf) {
      tile.t -= dt;
      if (tile.t <= 0) {
        tile.surf = null;
        tile.t = 0;
      }
    }
    if (tile.gas) {
      tile.gas.t -= dt;
      if (tile.gas.t <= 0) tile.gas = null;
    }
    if (tile.wall) {
      tile.wall.t -= dt;
      if (tile.wall.t <= 0) tile.wall = null;
    }
  }

  for (const p of game.players) stepHazards(game, p);

  const down = game.players.filter((p) => p.hp <= 0);
  if (down.length) {
    game.phase = 'over';
    game.winner = down.length === 2 ? -1 : 1 - down[0].id;
    emit(game, 'ko', { winner: game.winner });
  }

  // Nobody is listening (headless run): do not let the log grow without bound.
  if (game.events.length > MAX_EVENTS) game.events.splice(0, game.events.length - MAX_EVENTS);
}
