import test from 'node:test';
import assert from 'node:assert/strict';
import { COLS, HALF } from '../src/data.js';
import { createGame, step, act } from '../src/sim/game.js';
import { createBot, botStep } from '../src/sim/bot.js';
import { EFFECTS } from '../src/packs/physics/effects.js';
import { GLITCHES } from '../src/packs/physics/tokens.js';
import { RECIPES } from '../src/packs/physics/recipes.js';
import { TUNE, idx, glitchify } from '../src/sim/world.js';

const DT = 1 / 60;

function playing(seed = 7, characters = ['junseo', 'minjae']) {
  const game = createGame({ seed, packId: 'physics', characters });
  step(game, TUNE.countdown + DT);
  assert.equal(game.phase, 'playing');
  return game;
}

function run(game, seconds) {
  for (let n = 0; n < Math.round(seconds / DT); n++) step(game, DT);
}

test('every physics recipe has an effect and unique key', () => {
  assert.equal(new Set(RECIPES.map((r) => r.key)).size, RECIPES.length);
  for (const r of RECIPES) {
    assert.equal(typeof EFFECTS[r.id], 'function', `${r.id} has no effect`);
  }
});

test('unstable glitches deal no tick damage', () => {
  assert.equal(GLITCHES.blackbody.dmg, 0);
  assert.equal(GLITCHES.neutron.dmg, 0);
  const game = playing();
  const p = game.players[1];
  Object.assign(p, { col: 5, row: 1 });
  glitchify(game, idx(5, 1), 'neutron', 5);
  const hp = p.hp;
  run(game, 2);
  assert.equal(p.hp, hp);
});

test('momentum kick leaps then returns home', () => {
  // sua has no kinetic buff/debuff — baseline 12 dmg
  const game = playing(3, ['sua', 'junseo']);
  const p = game.players[0];
  const foe = game.players[1];
  Object.assign(p, { col: 1, row: 1 });
  Object.assign(foe, { col: 5, row: 1 });
  const start = { col: p.col, row: p.row };
  game.events.length = 0;
  EFFECTS.momentum(game, p);
  assert.equal(p.col, 5, 'leaped to mirror');
  const hits = game.events.filter((e) => e.type === 'damage' && e.pid === 1);
  assert.equal(hits.reduce((n, e) => n + e.amount, 0), 12);
  run(game, 0.4);
  assert.equal(p.col, start.col);
  assert.equal(p.row, start.row);
});

test('yerin skill raises a barrier wall on the front line', () => {
  const game = playing(4, ['yerin', 'junseo']);
  const p = game.players[0];
  Object.assign(p, { col: HALF - 1, row: 1 });
  assert.ok(act(game, 0, { type: 'skill' }));
  const walls = game.tiles.map((t, i) => (t.wall ? i : -1)).filter((i) => i >= 0);
  assert.ok(walls.length >= 2, `expected multi-tile wall, got ${walls.length}`);
  assert.ok(walls.every((i) => i % COLS === HALF - 1));
  assert.ok(walls.every((i) => game.tiles[i].wall.t > 6));
});

test('doyun skill arms lifesteal on the next hit', () => {
  const game = playing(5, ['doyun', 'junseo']);
  const p = game.players[0];
  const foe = game.players[1];
  Object.assign(p, { col: 1, row: 1, hp: 50 });
  Object.assign(foe, { col: 5, row: 1 });
  assert.ok(act(game, 0, { type: 'skill' }));
  assert.equal(p.lifeSteal, 0.5);
  run(game, 0.5);
  assert.equal(p.lifeSteal, 0.5, 'skill bolt does not consume');
  EFFECTS.sparkbolt(game, p);
  run(game, 1);
  assert.equal(p.lifeSteal, 0);
  assert.ok(p.hp > 50, 'lifesteal healed doyun');
});

test('decohere pays off on glitch tiles', () => {
  const game = playing(6);
  Object.assign(game.players[0], { col: 1, row: 1 });
  Object.assign(game.players[1], { col: 5, row: 1, hazardCd: 99 });
  glitchify(game, idx(5, 1), 'static', 4);
  game.events.length = 0;
  EFFECTS.decohere(game, game.players[0]);
  run(game, 0.5);
  const hits = game.events.filter((e) => e.type === 'damage' && e.pid === 1);
  assert.equal(hits.reduce((n, e) => n + e.amount, 0), 16); // 8 + 8 glitch bonus
  assert.equal(game.tiles[idx(5, 1)].glitch, null);
  assert.ok(game.players[1].stun > 0);
});

test('physics bots finish matches without crashing', () => {
  for (const seed of [11, 22]) {
    const game = createGame({
      seed, packId: 'physics', characters: ['junseo', 'minjae'],
    });
    const bots = [createBot(0, 'normal', seed + 1), createBot(1, 'normal', seed + 2)];
    for (let n = 0; n < 60 * 180 && game.phase !== 'over'; n++) {
      for (const bot of bots) botStep(game, bot, DT);
      step(game, DT);
      game.events.length = 0;
      if (n % 30) continue;
      for (const p of game.players) {
        const dashing = (game.dashes || []).some((d) => d.pid === p.id);
        if (!dashing) {
          assert.ok(p.col >= p.side * HALF && p.col < p.side * HALF + HALF);
        }
      }
    }
    assert.equal(game.phase, 'over', `physics match seed ${seed}`);
  }
});
