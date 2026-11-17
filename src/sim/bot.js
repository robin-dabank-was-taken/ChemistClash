// The computer opponent. It plays through the same act() calls a human does and
// only sees what a human could see, with reaction delays set by difficulty.
import { ROWS, HALF, GASES, RECIPES, TRUMP_ID, countAtoms, findRecipe, missingFor } from '../data.js';
import { familyOf } from '../families.js';
import { makeRng } from './rng.js';
import { act } from './game.js';
import { TUNE, idx, inField, sideOfCol, halfTiles } from './world.js';

// think/move: seconds between decisions. notice: how long an incoming attack
// has to be on the board before the bot reacts to it. lapse: chance it never
// spots a given attack at all. hold: how long it will sit on a finished mix
// waiting to line up a shot. patience: how long it stares at a useless hotbar
// before throwing it away. noise: randomness in recipe choice. giddyFix: chance
// per step to compensate for reversed controls. project: chance its second pot
// is given a big slow-cooked recipe instead of quick ones. trump: how keen it
// is for that recipe to be the trump card.
const LEVELS = {
  easy: { think: 0.62, move: 0.36, notice: 0.5, lapse: 0.35, hold: 0.4, patience: 2.5, noise: 1.3, giddyFix: 0, project: 0.1, trump: 0 },
  normal: { think: 0.36, move: 0.21, notice: 0.28, lapse: 0.18, hold: 1.2, patience: 1.2, noise: 0.6, giddyFix: 0.5, project: 0.45, trump: 0.8 },
  hard: { think: 0.2, move: 0.13, notice: 0.14, lapse: 0.08, hold: 1.8, patience: 0.5, noise: 0.25, giddyFix: 1, project: 0.75, trump: 2.5 },
};

// How much the bot likes each recipe before looking at the board.
const BASE_DESIRE = {
  h2: 1.0, hcl: 1.6, h2o: 1.2, co2: 1.6, so2: 1.8, hcn: 2.4, n2h4: 2.3, hno3: 2.0, chcl3: 2.4, c2h2: 2.0, ph3: 1.8,
  p4: 2.6, c3h8: 3.0, c6h6: 3.0, h2so4: 2.8, c8h18: 3.4, nh4no3: 3.2,
  co: 1.4, cl2: 2.2, h2s: 1.5, n2o: 1.6, ch4: 1.6,
  c2h3cl: 1.8, p2o5: 2.0, c10h8: 2.2, c6h10o5: 2.0,
  o3: 0.9, c2h4: 0.9, h3po4: 0.9, c14h10n2o2: 1.2,
  h2o2: 0.3, c2h6o: 0.2, c9h8o4: 0.2, c6h12o6: 0.2,
  o2: 0.4, n2: 0.1, nh3: 0.8,
  [TRUMP_ID]: 4,
};
// How painful it is to wait for an atom that is not in the hotbar yet.
const SCARCITY = { H: 0.3, C: 0.4, O: 0.6, N: 0.8, Cl: 1.1, S: 1.4, P: 1.4 };
// Recipes too big to finish from one hotbar: only ever built as a project.
const PROJECTS = RECIPES.filter((r) => r.atoms >= 10);
const QUICK = 0; // pot used for fast recipes
const SLOW = 1; // pot that may hold a project

const sum = (obj) => Object.values(obj).reduce((a, b) => a + b, 0);

export function createBot(pid, level = 'normal', seed = (Math.random() * 2 ** 32) >>> 0) {
  return {
    pid,
    level: LEVELS[level] || LEVELS.normal,
    rng: makeRng(seed),
    thinkT: 0.4,
    moveT: 0.3,
    goals: [null, null], // recipe each pot is being built towards
    project: false, // true while the slow pot's goal is a long-term project
    held: [0, 0], // seconds each pot has sat finished, waiting for a good moment
    stuck: 0,
    dump: null, // { pot, thrown } while throwing away a useless hotbar
    seen: new WeakMap(), // per incoming attack: when (and whether) the bot spots it
    wander: null,
    wanderT: 0,
  };
}

export function botStep(game, bot, dt) {
  if (game.phase !== 'playing') return;
  const p = game.players[bot.pid];
  if (p.hp <= 0) return;
  const jitter = () => 0.8 + 0.4 * bot.rng.next();
  bot.wanderT -= dt;
  bot.thinkT -= dt;
  if (bot.thinkT <= 0) {
    const period = bot.level.think * jitter();
    bot.thinkT = period;
    if (p.stun <= 0) think(game, bot, p, period);
  }
  bot.moveT -= dt;
  if (bot.moveT <= 0) {
    bot.moveT = bot.level.move * jitter();
    moveThink(game, bot, p);
  }
}

// ---------------------------------------------------------------- reading the board

function situation(game, p) {
  const foe = game.players[1 - p.id];
  const brewing = foe.pots.filter((pot) => pot.state === 'reacting' && pot.recipe).map((pot) => pot.recipe);
  const s = {
    foe,
    hpFrac: p.hp / TUNE.maxHp,
    ownFire: 0, ownGas: 0, foeFire: 0, foeFlammable: 0,
    onFire: game.tiles[idx(p.col, p.row)].surf === 'fire',
    foeWet: game.tiles[idx(foe.col, foe.row)].surf === 'wet',
    foeBrewing: brewing.some((r) => r.time >= 1),
    foeTrump: brewing.some((r) => r.id === TRUMP_ID),
    debuffed: p.giddy > 0 || p.chill > 0 || p.frozen > 0,
  };
  for (const i of halfTiles(p.side)) {
    if (game.tiles[i].surf === 'fire') s.ownFire++;
    if (game.tiles[i].gas) s.ownGas++;
  }
  for (const i of halfTiles(foe.side)) {
    const tile = game.tiles[i];
    if (tile.surf === 'fire') s.foeFire++;
    if (tile.gas && GASES[tile.gas.kind].flammable) s.foeFlammable++;
  }
  return s;
}

function desire(r, s, p) {
  let d = BASE_DESIRE[r.id];
  const hurt = 1 - s.hpFrac;
  const fam = familyOf(r) || r.family;
  const c = p?.character;
  if (c?.buff?.families?.includes(fam)) d *= 1.35;
  if (c?.debuff?.families?.includes(fam)) d *= 0.7;
  if (r.tag === 'shield') return d + (s.foeTrump ? 5 : s.foeBrewing ? 1.5 : 0);
  if (r.tag === 'heal') return d + hurt * 5;
  if (r.tag === 'wall') return d + (s.foeTrump ? 1.2 : 0.6);
  if (r.tag === 'nuke') return d + (hurt > 0.4 ? 1 : 0);
  switch (r.id) {
    case 'o2': d += hurt * 1.2 + Math.min(1.5, s.foeFire * 0.4); break;
    case 'n2': d += Math.min(3, (s.ownFire + s.ownGas) * 0.6); break;
    case 'h2o': d += s.onFire ? 1.5 : 0; break;
    case 'h2': d += s.foeFlammable ? 2.5 : 0; break;
    case 'c2h2': case 'n2h4': d += s.foeFlammable ? 1.5 : 0; break;
    case 'ph3': d += s.foeFlammable ? 1 : 0; break;
    case 'ch4': case 'h2s': case 'co': d += s.foeFire ? 0.6 : 0; break;
    case 'nh3': d += s.debuffed ? 1.5 : 0; break;
    case 'co2': d += s.foeWet ? 1 : 0; break;
    case 'h2so4': d += s.foeWet ? 0.5 : 0; break;
    default:
  }
  return d;
}

const lane = (c) => c % HALF; // position within a half; equal lanes face each other
const aligned = (p, foe, r) => p.row === foe.row && (r.aim === 'row' || lane(p.col) === lane(foe.col));

// ---------------------------------------------------------------- mixing

const hand = (p) => countAtoms(p.hotbar.map((slot) => slot.el));
const finished = (bot, p, k) => !!bot.goals[k] && findRecipe(p.pots[k].atoms) === bot.goals[k];

// What pot k still needs for its goal ({} when it has no goal or is busy).
function needs(bot, p, k) {
  const pot = p.pots[k];
  const goal = bot.goals[k];
  if (!goal || pot.state !== 'idle') return {};
  return missingFor(goal, countAtoms(pot.atoms)) || {};
}

function chooseGoal(bot, p, k, s, mustUseHand = false) {
  const have = countAtoms(p.pots[k].atoms);
  const free = hand(p);
  const otherGoal = bot.goals[1 - k];
  // Atoms the other pot is waiting for are spoken for - unless that pot is a
  // project, which only gets what the quick pot has no use for.
  if (!(k === QUICK && bot.project)) {
    const need = needs(bot, p, 1 - k);
    for (const el in need) free[el] = Math.max(0, (free[el] || 0) - need[el]);
  }
  let best = null;
  let bestScore = -Infinity;
  for (const r of RECIPES) {
    if (r === otherGoal) continue;
    const miss = missingFor(r, have);
    if (!miss) continue;
    let inHand = 0;
    let waitCost = 0;
    for (const el in miss) {
      const got = Math.min(miss[el], free[el] || 0);
      inHand += got;
      waitCost += (miss[el] - got) * SCARCITY[el];
    }
    if (mustUseHand && inHand === 0) continue;
    const score = desire(r, s, p) + 0.5 * inHand - waitCost - 0.12 * sum(miss) + bot.rng.next() * bot.level.noise;
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return best;
}

// A big recipe for the slow pot to collect over time, or null to keep it quick.
function chooseProject(bot, s) {
  if (bot.rng.next() >= bot.level.project) return null;
  const hurt = 1 - s.hpFrac;
  const weight = (r) => {
    if (r.id === TRUMP_ID) return bot.level.trump;
    if (r.tag === 'heal') return hurt * 4;
    if (r.tag === 'shield') return 1.5;
    if (r.tag === 'wall') return 2.2;
    return r.atoms > 20 ? 2 : 3;
  };
  let roll = bot.rng.next() * PROJECTS.reduce((total, r) => total + weight(r), 0);
  for (const r of PROJECTS) {
    roll -= weight(r);
    if (roll <= 0 && weight(r) > 0) return r;
  }
  return null;
}

function shouldFire(bot, p, s, r, k) {
  const waited = bot.held[k];
  if (r.tag === 'shield') return p.shield <= 5 || waited > 8;
  if (r.tag === 'heal') return p.hp <= TUNE.maxHp - 15 || waited > 6;
  if (r.tag === 'wall') return aligned(p, s.foe, r) || waited > bot.level.hold * 0.7;
  switch (r.id) {
    case 'n2': return s.ownFire + s.ownGas > 0 || waited > 5;
    case 'o2': return p.hp <= TUNE.maxHp - 6 || s.foeFire > 0 || waited > 3;
    default:
  }
  if (r.aim === 'self' || r.aim === 'field') return true;
  // Slow reactions are aimed by walking while they cook; instant ones by waiting.
  if (r.time > 0) return true;
  return aligned(p, s.foe, r) || waited > bot.level.hold;
}

function think(game, bot, p, period) {
  const s = situation(game, p);
  const go = (action) => void act(game, bot.pid, action);
  // While a project is cooking up, the quick pot gets first pick of every atom.
  const order = bot.project ? [QUICK, SLOW] : [p.activePot, 1 - p.activePot];

  // Throwing away a hotbar nothing wants: into a pot, then empty the pot.
  if (bot.dump) {
    const k = bot.dump.pot;
    const pot = p.pots[k];
    const wanted = needs(bot, p, 1 - k);
    const useful = p.hotbar.some((slot) => wanted[slot.el] > 0);
    if (pot.state !== 'idle') {
      bot.dump = null;
    } else if (!useful && bot.dump.thrown < 5) {
      if (p.activePot !== k) return go({ type: 'toggle' });
      bot.dump.thrown++;
      return go({ type: 'slot', i: bot.rng.int(p.hotbar.length) });
    } else {
      if (pot.atoms.length && p.activePot !== k) return go({ type: 'toggle' });
      bot.dump = null;
      bot.goals[k] = null;
      bot.stuck = 0;
      if (pot.atoms.length) return go({ type: 'clear' });
    }
  }

  // 1. A pot holds exactly what we were building: use it when the moment is right.
  for (const k of order) {
    if (p.pots[k].state !== 'idle' || !finished(bot, p, k)) {
      bot.held[k] = 0;
      continue;
    }
    bot.held[k] += period;
    if (!shouldFire(bot, p, s, bot.goals[k], k)) continue;
    if (p.activePot !== k) return go({ type: 'toggle' });
    bot.goals[k] = null;
    bot.held[k] = 0;
    if (k === SLOW) bot.project = false;
    return go({ type: 'run' });
  }

  // 2. Make sure every idle pot is working towards something reachable.
  for (const k of [QUICK, SLOW]) {
    const pot = p.pots[k];
    if (pot.state !== 'idle') continue;
    const goal = bot.goals[k];
    if (goal && missingFor(goal, countAtoms(pot.atoms))) continue;
    if (k === SLOW) {
      const project = pot.atoms.length ? null : chooseProject(bot, s);
      bot.project = !!project;
      bot.goals[k] = project || chooseGoal(bot, p, k, s);
    } else {
      bot.goals[k] = chooseGoal(bot, p, k, s);
    }
  }

  // 3. Throw in an atom some pot is waiting for.
  for (const k of order) {
    const miss = needs(bot, p, k);
    const i = p.hotbar.findIndex((slot) => miss[slot.el] > 0);
    if (i < 0) continue;
    bot.stuck = 0;
    if (p.activePot !== k) return go({ type: 'toggle' });
    return go({ type: 'slot', i });
  }

  // 4. Nothing in the hotbar helps, and it will not change until something is
  // thrown. Retarget a quick pot at what we do hold, or throw the hotbar away.
  bot.stuck += period;
  if (bot.stuck < bot.level.patience) return;
  bot.stuck = 0;
  const spare = [QUICK, SLOW].filter((k) => p.pots[k].state === 'idle' && !finished(bot, p, k) && !(k === SLOW && bot.project));
  for (const k of spare) {
    const goal = chooseGoal(bot, p, k, s, true);
    if (goal) {
      bot.goals[k] = goal;
      return;
    }
  }
  if (!spare.length) return;
  spare.sort((a, b) => p.pots[a].atoms.length - p.pots[b].atoms.length);
  bot.dump = { pot: spare[0], thrown: 0 };
}

// ---------------------------------------------------------------- moving

// Decided once per attack, so a bot that misses a telegraph keeps missing it.
function spots(bot, attack, age, scale = 1) {
  let s = bot.seen.get(attack);
  if (!s) {
    s = { at: bot.level.notice * (0.7 + 0.6 * bot.rng.next()), blind: bot.rng.next() < bot.level.lapse };
    bot.seen.set(attack, s);
  }
  return !s.blind && age >= s.at * scale;
}

function danger(game, bot, p, c, r) {
  const i = idx(c, r);
  const tile = game.tiles[i];
  let d = 0;
  if (tile.surf === 'fire') d += 6;
  else if (tile.surf === 'acid') d += 5;
  else if (tile.surf === 'frost') d += 1.5;
  else if (tile.surf === 'wet') d += 0.4;
  if (tile.gas) {
    const gas = GASES[tile.gas.kind];
    if (gas.dmg) d += 5;
    if (gas.flammable) d += 3;
    if (gas.giddy) d += 3.5;
  }
  for (const s of game.strikes) {
    if (s.owner !== p.id && s.tiles.includes(i) && spots(bot, s, s.t)) d += 12;
  }
  for (const b of game.bolts) {
    if (b.owner === p.id || b.row !== r || !spots(bot, b, b.age, 0.5)) continue;
    if (b.dir > 0 ? b.x <= c : b.x >= c) d += 8;
  }
  return d;
}

const STEPS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];

// Where to stand so the next aimed attack lands on the opponent.
function aimSpot(game, bot, p) {
  const foe = game.players[1 - p.id];
  for (let k = 0; k < 2; k++) {
    const pot = p.pots[k];
    let r = null;
    if (pot.state === 'reacting' && pot.recipe && pot.total - pot.t < 0.9) r = pot.recipe;
    else if (pot.state === 'idle' && finished(bot, p, k)) r = bot.goals[k];
    if (!r) continue;
    if (r.aim === 'row') return { c: p.col, r: foe.row };
    // The benzene ring misses its own centre, so aim one row off.
    const row = r.id === 'c6h6' ? foe.row + (foe.row < ROWS - 1 ? 1 : -1) : foe.row;
    if (r.aim === 'mirror') return { c: p.side * HALF + lane(foe.col), r: row };
  }
  return null;
}

function moveThink(game, bot, p) {
  if (p.frozen > 0 || p.stun > 0) return;
  const ok = (c, r) => inField(c, r) && sideOfCol(c) === p.side && !game.tiles[idx(c, r)].wall;
  if (bot.wanderT <= 0 || !bot.wander) {
    bot.wander = { c: p.side * HALF + bot.rng.int(HALF), r: bot.rng.int(ROWS) };
    bot.wanderT = 1 + bot.rng.next() * 2;
  }
  const aim = aimSpot(game, bot, p);
  const dist = (spot, c, r) => Math.abs(spot.c - c) + Math.abs(spot.r - r);

  let best = STEPS[0];
  let bestScore = -Infinity;
  for (const step of STEPS) {
    const c = p.col + step[0];
    const r = p.row + step[1];
    if (!ok(c, r)) continue;
    // Look one step further so the bot walks out of big danger zones instead
    // of freezing in the middle because every neighbour looks equally bad.
    let escape = Infinity;
    for (const [dc, dr] of STEPS) if (ok(c + dc, r + dr)) escape = Math.min(escape, danger(game, bot, p, c + dc, r + dr));
    let score = -danger(game, bot, p, c, r) - 0.45 * escape;
    if (aim) score -= 0.8 * dist(aim, c, r);
    else score -= 0.12 * dist(bot.wander, c, r);
    if (step !== STEPS[0]) score -= 0.05;
    score += bot.rng.next() * 0.04;
    if (score > bestScore) {
      bestScore = score;
      best = step;
    }
  }
  if (best === STEPS[0]) return;
  let [dx, dy] = best;
  if (p.giddy > 0 && bot.rng.next() < bot.level.giddyFix) {
    dx = -dx;
    dy = -dy;
  }
  act(game, bot.pid, { type: 'move', dx, dy });
}

export const BOT_LEVELS = Object.keys(LEVELS);
