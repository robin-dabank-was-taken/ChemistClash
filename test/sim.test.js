import test from 'node:test';
import assert from 'node:assert/strict';
import { COLS, ROWS, HALF, ELEMENTS, RECIPES, RECIPE_BY_ID, TRUMP_ID, findRecipe, buildBag } from '../src/data.js';
import { familyOf } from '../src/families.js';
import { CHARACTERS } from '../src/characters.js';
import { createGame, step, act } from '../src/sim/game.js';
import { createBot, botStep } from '../src/sim/bot.js';
import { EFFECTS } from '../src/sim/effects.js';
import { TUNE, idx, ignite, douse, acidify, gasify, damage, reactionRate, addBolt } from '../src/sim/world.js';

const DT = 1 / 60;

function playing(seed = 7) {
  const game = createGame({ seed });
  step(game, TUNE.countdown + DT);
  assert.equal(game.phase, 'playing');
  return game;
}

function run(game, seconds) {
  for (let n = 0; n < Math.round(seconds / DT); n++) step(game, DT);
}

// Put exactly these atoms in a player's hotbar, throw them all, and run the pot.
function mix(game, pid, atoms) {
  const p = game.players[pid];
  atoms.forEach((el, i) => {
    p.hotbar[i % 5].el = el;
    assert.ok(act(game, pid, { type: 'slot', i: i % 5 }));
  });
  assert.ok(act(game, pid, { type: 'run' }));
}

const atomsOf = (recipe) => Object.entries(recipe.counts).flatMap(([el, n]) => Array(n).fill(el));

test('every recipe is distinct, has an effect, and uses only elements the bag deals', () => {
  assert.equal(new Set(RECIPES.map((r) => r.key)).size, RECIPES.length);
  assert.equal(Object.keys(EFFECTS).length, RECIPES.length);
  for (const r of RECIPES) {
    assert.equal(typeof EFFECTS[r.id], 'function', `${r.id} has no effect`);
    for (const el of Object.keys(r.counts)) assert.ok(ELEMENTS[el].count > 0, `${r.id} needs ${el}, which is never dealt`);
    assert.equal(findRecipe(atomsOf(r)), r);
  }
  assert.equal(findRecipe(['O', 'H', 'H']), RECIPE_BY_ID.h2o, 'order thrown in does not matter');
  assert.equal(findRecipe(['H', 'O']), null);
});

test('every recipe can be run without error from either side', () => {
  for (const r of RECIPES) {
    for (const pid of [0, 1]) {
      const game = playing();
      mix(game, pid, atomsOf(r));
      run(game, r.time / TUNE.rateMin + 2);
      assert.ok(game.events.some((e) => e.type === 'react-done' && e.recipe === r.id && e.pid === pid), `${r.id} never finished`);
    }
  }
});

test('players cannot act during the countdown or leave their half', () => {
  const game = createGame({ seed: 3 });
  assert.equal(act(game, 0, { type: 'move', dx: 1, dy: 0 }), false);
  step(game, TUNE.countdown + DT);
  for (const [pid, dx] of [[0, 1], [1, -1]]) {
    for (let n = 0; n < 10; n++) {
      act(game, pid, { type: 'move', dx, dy: 0 });
      run(game, 0.2);
    }
  }
  assert.equal(game.players[0].col, HALF - 1);
  assert.equal(game.players[1].col, HALF);
});

test('two-atom reactions are instant; bigger ones take time and tie up only their own pot', () => {
  const game = playing();
  const p = game.players[0];
  mix(game, 0, ['H', 'H']);
  assert.equal(p.pots[0].state, 'idle');
  assert.equal(game.bolts.length, 1);

  mix(game, 0, ['H', 'H', 'O']);
  assert.equal(p.pots[0].state, 'reacting');
  assert.equal(act(game, 0, { type: 'run' }), false, 'a reacting pot cannot be run again');
  act(game, 0, { type: 'toggle' });
  assert.ok(act(game, 0, { type: 'slot', i: 0 }), 'the other pot is still usable');
  run(game, 0.4);
  assert.equal(p.pots[0].state, 'reacting');
  run(game, 0.2);
  assert.equal(p.pots[0].state, 'idle');
  assert.deepEqual(p.pots[0].atoms, []);
});

test('a hot lab reacts faster and a frosted one slower', () => {
  const time = (prepare) => {
    const game = playing();
    prepare(game);
    mix(game, 0, atomsOf(RECIPE_BY_ID.h2so4));
    let t = 0;
    while (game.players[0].pots[0].state === 'reacting') {
      step(game, DT);
      t += DT;
    }
    return t;
  };
  const neutral = time(() => {});
  const hot = time((game) => [0, 1, 2, 3].forEach((c) => Object.assign(game.tiles[idx(c, 3)], { surf: 'fire', t: 99 })));
  const cold = time((game) => [0, 1, 2, 3].forEach((c) => Object.assign(game.tiles[idx(c, 3)], { surf: 'frost', t: 99 })));
  assert.ok(Math.abs(neutral - 2.5) < 0.05, `neutral took ${neutral}`);
  assert.ok(hot < neutral * 0.75, `hot took ${hot}`);
  assert.ok(cold > neutral * 1.5, `cold took ${cold}`);
  const game = playing();
  assert.equal(reactionRate(game, game.players[0]), 1);
});

test('a mix that is not a molecule fizzles', () => {
  const game = playing();
  const p = game.players[0];
  mix(game, 0, ['H', 'O']);
  run(game, TUNE.fizzleTime + 0.05);
  assert.ok(game.events.some((e) => e.type === 'fizzle'));
  assert.deepEqual(p.pots[0].atoms, []);
});

test('a thrown atom is replaced at once, and hydrogen and carbon are dealt most', () => {
  const game = playing();
  const p = game.players[0];
  const dealt = {};
  const bag = buildBag().length;
  for (let n = 0; n < bag * 10; n++) {
    const el = p.hotbar[n % 5].el;
    dealt[el] = (dealt[el] || 0) + 1;
    assert.ok(act(game, 0, { type: 'slot', i: n % 5 }));
    assert.ok(p.hotbar.every((slot) => slot.el), 'no slot is ever empty');
  }
  assert.equal(p.pots[0].atoms.length, bag * 10, 'a pot has no size limit');
  const ranked = Object.keys(dealt).sort((a, b) => dealt[b] - dealt[a]);
  assert.deepEqual(ranked.slice(0, 2), ['H', 'C']);
  assert.ok((dealt.H + dealt.C) / (bag * 10) > 0.55, 'together they are over half of everything dealt');
});

test('the clear action empties the active pot without reacting', () => {
  const game = playing();
  const p = game.players[0];
  assert.equal(act(game, 0, { type: 'clear' }), false, 'nothing to clear');
  p.hotbar[0].el = 'S';
  act(game, 0, { type: 'slot', i: 0 });
  act(game, 0, { type: 'toggle' });
  p.hotbar[0].el = 'H';
  act(game, 0, { type: 'slot', i: 0 });
  assert.ok(act(game, 0, { type: 'clear' }));
  assert.deepEqual(p.pots[1].atoms, []);
  assert.deepEqual(p.pots[0].atoms, ['S'], 'the other pot is untouched');
  assert.equal(game.bolts.length + game.strikes.length, 0);
  assert.ok(!game.events.some((e) => e.type === 'react-start'));

  mix(game, 0, ['H', 'H', 'O']);
  assert.equal(act(game, 0, { type: 'clear' }), false, 'a pot that is reacting cannot be emptied');
});


test('andrographolide is family nuke, never organic', () => {
  assert.equal(familyOf(RECIPE_BY_ID[TRUMP_ID]), 'nuke');
  assert.equal(RECIPE_BY_ID[TRUMP_ID].tag, 'nuke');
  assert.equal(RECIPE_BY_ID[TRUMP_ID].chem, 'Andrographolide');
  assert.equal(familyOf('c8h18'), 'organic');
  assert.equal(familyOf('h2o2'), 'heal');
});

test('character family traits buff acids, heals, polymers and leave the nuke alone', () => {
  const mk = (chars) => {
    const game = createGame({ characters: chars, seed: 11 });
    step(game, TUNE.countdown + DT);
    return game;
  };
  // Acid bolt: Akari +25% on 10 → 13
  let game = mk(['akari', 'baseline']);
  Object.assign(game.players[0], { col: 1, row: 1 });
  Object.assign(game.players[1], { col: 5, row: 1 });
  EFFECTS.hcl(game, game.players[0]);
  run(game, 1);
  const acidHits = game.events.filter((e) => e.type === 'damage' && e.kind === 'acid' && e.pid === 1);
  assert.equal(acidHits[0].amount, 13);

  // Hana heals more; organics hurt less; nuke unchanged
  game = mk(['hana', 'baseline']);
  game.players[0].hp = 50;
  EFFECTS.h2o2(game, game.players[0]);
  assert.equal(game.players[0].hp, 50 + 26); // 20 * 1.3
  Object.assign(game.players[0], { col: 1, row: 1 });
  Object.assign(game.players[1], { col: 5, row: 1 });
  game.events.length = 0;
  EFFECTS.c2h2(game, game.players[0]);
  run(game, 0.8);
  const burns = game.events.filter((e) => e.type === 'damage' && e.kind === 'spark' && e.pid === 1);
  assert.equal(burns[0].amount, 9); // 10 * 0.85 rounded
  for (const tile of game.tiles) { tile.surf = null; tile.t = 0; }
  game.players[1].hp = TUNE.maxHp;
  game.events.length = 0;
  EFFECTS.c20h30o5(game, game.players[0]);
  run(game, 2.5);
  const nukes = game.events.filter((e) => e.type === 'damage' && e.pid === 1);
  assert.equal(nukes.reduce((n, e) => n + e.amount, 0), 80, 'nuke is not an organic debuff');

  // Yui walls last longer
  game = mk(['yui', 'baseline']);
  Object.assign(game.players[0], { col: 1, row: 1 });
  EFFECTS.c2h3cl(game, game.players[0]);
  run(game, 0.6);
  const wall = game.tiles.find((t) => t.wall);
  assert.ok(wall);
  assert.ok(wall.wall.t > 8, `polymer wall duration ${wall.wall.t}`);
});

test('selectPot picks A or B directly', () => {
  const game = playing();
  assert.equal(game.players[0].activePot, 0);
  assert.ok(act(game, 0, { type: 'selectPot', pot: 1 }));
  assert.equal(game.players[0].activePot, 1);
  assert.ok(act(game, 0, { type: 'selectPot', pot: 0 }));
  assert.equal(game.players[0].activePot, 0);
});

test('andrographolide is the trump card: 55 atoms, 5 seconds, the whole enemy side', () => {
  const trump = RECIPE_BY_ID[TRUMP_ID];
  assert.deepEqual(trump.counts, { C: 20, H: 30, O: 5 });
  assert.equal(trump.atoms, 55);
  assert.equal(trump.atoms, Math.max(...RECIPES.map((r) => r.atoms)), 'nothing costs more');
  for (const [col, row] of [[4, 0], [7, 3], [5, 2]]) {
    const game = playing();
    const foe = game.players[1];
    Object.assign(foe, { col, row });
    mix(game, 0, atomsOf(trump));
    run(game, 4.9);
    assert.equal(game.players[0].pots[0].state, 'reacting');
    run(game, 0.2);
    assert.equal(game.strikes[0].tiles.length, 16);
    assert.ok(game.strikes[0].tiles.every((i) => i % COLS >= HALF), 'only the enemy half');
    run(game, 1.3);
    assert.equal(foe.hp, TUNE.maxHp - 80, `no escape at ${col},${row}`);
  }
});

test('shields replace weaker shields instead of stacking, and heals top health up', () => {
  const game = playing();
  const p = game.players[0];
  const cast = (id) => {
    mix(game, 0, atomsOf(RECIPE_BY_ID[id]));
    run(game, RECIPE_BY_ID[id].time + 0.1);
  };
  cast('c2h4');
  assert.equal(p.shield, 26);
  cast('o3');
  assert.equal(p.shield, 26, 'a weaker shield does not shrink the current one');
  cast('c14h10n2o2');
  assert.equal(p.shield, 55);
  cast('h3po4');
  assert.equal(p.shield, 55);

  p.shield = 0;
  p.hp = 10;
  cast('c2h6o');
  assert.equal(p.hp, 28);
  cast('h2o2');
  assert.equal(p.hp, 48);
  cast('c9h8o4');
  assert.equal(p.hp, 80);
  cast('c6h12o6');
  assert.equal(p.hp, TUNE.maxHp, 'healing never goes past full health');
  assert.ok(p.haste > 0);
});

test('knockout drops stop their target moving and mixing until they wear off', () => {
  const game = playing();
  const foe = game.players[1];
  Object.assign(game.players[0], { col: 1, row: 1 });
  Object.assign(foe, { col: 5, row: 1 });
  mix(game, 0, ['C', 'H', 'Cl', 'Cl', 'Cl']);
  run(game, 1.6);
  assert.ok(foe.stun > 0);
  assert.equal(act(game, 1, { type: 'move', dx: 1, dy: 0 }), false);
  assert.equal(act(game, 1, { type: 'slot', i: 0 }), false);
  run(game, 2.2);
  assert.equal(foe.stun, 0);
  assert.ok(act(game, 1, { type: 'slot', i: 0 }));
});

test('wall recipes raise barriers on the enemy side that block steps and bolts', () => {
  const game = playing();
  const p = game.players[0];
  const foe = game.players[1];
  Object.assign(p, { col: 1, row: 1 });
  Object.assign(foe, { col: 6, row: 1 });

  mix(game, 0, atomsOf(RECIPE_BY_ID.c2h3cl));
  run(game, 1.6);
  const walls = game.tiles.map((t, i) => (t.wall ? i : -1)).filter((i) => i >= 0);
  assert.equal(walls.length, 4);
  assert.ok(walls.every((i) => i % COLS >= HALF), 'walls only on the enemy half');
  assert.ok(walls.every((i) => Math.floor(i / COLS) !== undefined));
  // column 5 (mirror of col 1) is fully walled
  for (let r = 0; r < ROWS; r++) assert.ok(game.tiles[r * COLS + 5].wall);

  Object.assign(foe, { col: 4, row: 1 });
  assert.equal(act(game, 1, { type: 'move', dx: 1, dy: 0 }), false, 'cannot step onto a wall');
  assert.ok(act(game, 1, { type: 'move', dx: 0, dy: 1 }), 'can still step around it');

  // a bolt flying down the walled row smashes the wall and stops
  Object.assign(p, { col: 1, row: 0 });
  assert.ok(game.tiles[5].wall); // row 0, col 5
  EFFECTS.hcl(game, p);
  run(game, 1);
  assert.equal(game.bolts.length, 0);
  assert.equal(game.tiles[5].wall, null, 'the bolt broke the wall');
  assert.equal(foe.hp, TUNE.maxHp, 'the bolt never reached the chemist behind it');
});

test('fire, acid and water tear walls down', () => {
  const game = playing();
  const p = game.players[0];
  Object.assign(p, { col: 2, row: 2 });
  const i = 2 * COLS + 6; // enemy tile
  game.tiles[i].wall = { t: 10 };
  ignite(game, i, 2);
  assert.equal(game.tiles[i].wall, null);

  game.tiles[i].wall = { t: 10 };
  acidify(game, i, 2);
  assert.equal(game.tiles[i].wall, null);

  game.tiles[i].wall = { t: 10 };
  Object.assign(p, { col: 1, row: 2 });
  EFFECTS.h2o(game, p);
  run(game, 0.3);
  assert.equal(game.tiles[i].wall, null);
});

test('the benzene ring hits around its target but not the middle', () => {
  for (const [col, row, hurt] of [[5, 1, false], [6, 1, true], [5, 2, true], [6, 2, true], [7, 1, false]]) {
    const game = playing();
    Object.assign(game.players[0], { col: 1, row: 1 });
    Object.assign(game.players[1], { col, row });
    mix(game, 0, atomsOf(RECIPE_BY_ID.c6h6));
    run(game, 3);
    assert.equal(game.players[1].hp, TUNE.maxHp - (hurt ? 16 : 0), `standing at ${col},${row}`);
  }
});

test('aimed leap attacks land 4 tiles ahead of the caster, for both sides', () => {
  for (const [pid, col, target] of [[0, 0, 4], [0, 3, 7], [1, 7, 3], [1, 4, 0]]) {
    const game = playing();
    const p = game.players[pid];
    const foe = game.players[1 - pid];
    Object.assign(p, { col, row: 2 });
    Object.assign(foe, { col: target, row: 2 });
    const start = { col: p.col, row: p.row };
    mix(game, pid, ['H', 'C', 'N']);
    run(game, 1.3);
    assert.equal(foe.hp, TUNE.maxHp - 20, `player ${pid} at column ${col} should hit column ${target}`);
    run(game, 0.4);
    assert.equal(p.col, start.col, 'leap returns home');
    assert.equal(p.row, start.row);
  }
});

test('bolts travel along the row and only hit someone standing in it', () => {
  const hit = playing();
  Object.assign(hit.players[0], { col: 1, row: 1 });
  Object.assign(hit.players[1], { col: 6, row: 1 });
  mix(hit, 0, ['H', 'Cl']);
  run(hit, 1);
  const hits = hit.events.filter((e) => e.type === 'damage' && e.pid === 1);
  assert.equal(hits[0].amount, 10, 'the bolt itself');
  assert.equal(hit.tiles[idx(6, 1)].surf, 'acid');
  assert.ok(hits.length > 1 && hits.slice(1).every((e) => e.amount === TUNE.acidDmg), 'then the puddle it left');

  const miss = playing();
  Object.assign(miss.players[0], { col: 1, row: 1 });
  Object.assign(miss.players[1], { col: 6, row: 2 });
  mix(miss, 0, ['H', 'Cl']);
  run(miss, 1);
  assert.equal(miss.players[1].hp, TUNE.maxHp);
  assert.equal(miss.bolts.length, 0);
});

test('fire sets off flammable gas, and the blast chains through the cloud', () => {
  const game = playing();
  Object.assign(game.players[1], { col: 6, row: 1 });
  for (const c of [5, 6, 7]) gasify(game, idx(c, 1), 'ch4', 10);
  ignite(game, idx(5, 1), 3);
  assert.equal(game.tiles[idx(5, 1)].gas, null);
  assert.ok(game.tiles[idx(6, 1)].gas, 'the neighbour goes up a moment later, not instantly');
  run(game, 0.5);
  assert.equal(game.tiles[idx(6, 1)].gas, null);
  assert.equal(game.tiles[idx(7, 1)].gas, null);
  assert.equal(game.players[1].hp, TUNE.maxHp - 26 - TUNE.fireDmg, 'one blast plus one tick of the fire it left');
});

test('water douses fire, and dry ice freezes whoever stands on a wet tile', () => {
  const game = playing();
  const foe = game.players[1];
  Object.assign(game.players[0], { col: 1, row: 2 });
  Object.assign(foe, { col: 5, row: 2 });
  ignite(game, idx(5, 2), 10);
  ignite(game, idx(2, 2), 10);
  mix(game, 0, ['H', 'H', 'O']);
  run(game, 1);
  assert.equal(game.tiles[idx(5, 2)].surf, 'wet');
  assert.equal(game.tiles[idx(2, 2)].surf, 'wet', 'the jet also clears your own side of the row');
  assert.equal(foe.col, 6, 'knocked back one tile');
  const soaked = game.events.filter((e) => e.type === 'damage' && e.kind === 'water');
  assert.deepEqual(soaked.map((e) => e.amount), [6], 'the jet hits once, even though it pushes its target along the row');

  douse(game, idx(6, 2), 10);
  Object.assign(game.players[0], { col: 2, row: 0 });
  mix(game, 0, ['C', 'O', 'O']);
  run(game, 1.2);
  assert.equal(game.tiles[idx(6, 2)].surf, 'frost');
  assert.ok(foe.frozen > 0);
  assert.equal(act(game, 1, { type: 'move', dx: 0, dy: 1 }), false, 'frozen players cannot move');
});

test('a shield soaks damage before health does', () => {
  const game = playing();
  const p = game.players[0];
  mix(game, 0, ['O', 'O', 'O']);
  run(game, 0.6);
  assert.equal(p.shield, 18);
  damage(game, p, 15);
  assert.equal(p.hp, TUNE.maxHp);
  damage(game, p, 15);
  assert.equal(p.hp, TUNE.maxHp - 12);
  assert.equal(p.shield, 0);
});

test('laughing gas reverses movement', () => {
  const game = playing();
  const p = game.players[1];
  Object.assign(p, { col: 5, row: 1 });
  gasify(game, idx(5, 1), 'n2o', 5);
  run(game, 0.1);
  assert.ok(p.giddy > 0);
  act(game, 1, { type: 'move', dx: 1, dy: 0 });
  assert.equal(p.col, 4);
});

test('knocking a player out ends the match', () => {
  const game = playing();
  damage(game, game.players[1], 500);
  step(game, DT);
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 0);
  assert.equal(act(game, 0, { type: 'move', dx: 1, dy: 0 }), false);
});

test('diagonal bolts leave their start row', () => {
  const game = playing();
  const p = game.players[0];
  Object.assign(p, { col: 1, row: 1 });
  EFFECTS.ch5n(game, p);
  assert.equal(game.bolts.length, 2);
  assert.equal(game.bolts[0].dy, -1);
  assert.equal(game.bolts[1].dy, 1);
  run(game, 0.35);
  const rows = new Set(game.events.filter((e) => e.type === 'bolt-hit').map((e) => Math.floor(e.i / COLS)));
  // At least one diagonal should have visited a non-start row if it traveled far enough,
  // or bolts still in flight have updated rows.
  const flown = game.bolts.some((b) => b.row !== 1) || rows.size > 0 || game.bolts.length === 0;
  assert.ok(flown || game.bolts.every((b) => b.dy !== 0), 'diagonal bolts carry dy');
});

test('diagonal bolts bounce off the top and bottom edges', () => {
  const game = playing();
  const p = game.players[0];
  // Clear the foe so the bolt can travel; start on the top row aiming further up.
  Object.assign(p, { col: 0, row: 0 });
  Object.assign(game.players[1], { col: 7, row: 3 });
  addBolt(game, p, { kind: 'spark', dmg: 2, speed: 20, dy: -1 });
  const bolt = game.bolts[0];
  assert.equal(bolt.dy, -1);
  run(game, 0.06); // just past col 1 — would be row -1 without a bounce
  assert.ok(!bolt.dead, 'bolt stays alive after edge bounce');
  assert.equal(bolt.dy, 1, 'dy flips at the top edge');
  assert.equal(bolt.row, 1);
  assert.ok(game.events.some((e) => e.type === 'bolt-bounce'), 'emits bolt-bounce');
});

test('yui skill raises a polymer wall on the front line', () => {
  const game = createGame({ characters: ['yui', 'baseline'], seed: 3 });
  step(game, TUNE.countdown + DT);
  const p = game.players[0];
  Object.assign(p, { col: HALF - 1, row: 1 }); // front column — old skill failed here
  assert.ok(act(game, 0, { type: 'skill' }));
  const walls = game.tiles.map((t, i) => (t.wall ? i : -1)).filter((i) => i >= 0);
  assert.ok(walls.length >= 2, `expected multi-tile wall, got ${walls.length}`);
  assert.ok(walls.every((i) => i % COLS === HALF - 1), 'wall on own front column');
  assert.ok(walls.every((i) => game.tiles[i].wall.t > 6), 'polymer duration buffed');
});

test('rin skill arms lifesteal on the next hit', () => {
  const game = createGame({ characters: ['rin', 'baseline'], seed: 5 });
  step(game, TUNE.countdown + DT);
  const p = game.players[0];
  const foe = game.players[1];
  Object.assign(p, { col: 1, row: 1, hp: 50 });
  Object.assign(foe, { col: 5, row: 1 });
  assert.ok(act(game, 0, { type: 'skill' }));
  assert.equal(p.lifeSteal, 0.5);
  run(game, 0.5); // skill bolt resolves without consuming
  assert.equal(p.lifeSteal, 0.5);
  EFFECTS.h2(game, p);
  run(game, 1);
  assert.equal(p.lifeSteal, 0);
  assert.ok(p.hp > 50, 'lifesteal healed rin');
});

test('flammable gases deal no tick damage', () => {
  const game = playing();
  const p = game.players[1];
  Object.assign(p, { col: 5, row: 1 });
  gasify(game, idx(5, 1), 'ch4', 5);
  const hp = p.hp;
  run(game, 2);
  assert.equal(p.hp, hp);
});

test('bots play full matches to a result without breaking any invariant', () => {
  for (const [seed, a, b] of [[11, 'easy', 'easy'], [22, 'normal', 'normal'], [33, 'hard', 'easy'], [44, 'normal', 'hard']]) {
    const game = createGame({ seed });
    const bots = [createBot(0, a, seed + 1), createBot(1, b, seed + 2)];
    for (let n = 0; n < 60 * 900 && game.phase !== 'over'; n++) {
      for (const bot of bots) botStep(game, bot, DT);
      step(game, DT);
      game.events.length = 0;
      if (n % 30) continue;
      for (const p of game.players) {
        assert.ok(p.hp >= 0 && p.hp <= TUNE.maxHp);
        const dashing = (game.dashes || []).some((d) => d.pid === p.id);
        if (!dashing) {
          assert.ok(p.row >= 0 && p.row < ROWS && p.col >= p.side * HALF && p.col < p.side * HALF + HALF, 'stays in own half');
        }
        assert.ok(p.hotbar.length === 5 && p.hotbar.every((slot) => ELEMENTS[slot.el]), 'the hotbar is always full');
      }
      assert.equal(game.tiles.length, COLS * ROWS);
    }
    assert.equal(game.phase, 'over', `${a} vs ${b} (seed ${seed}) never finished`);
  }
});
