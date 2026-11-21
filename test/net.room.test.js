import test from 'node:test';
import assert from 'node:assert/strict';
import { Room } from '../src/net/room.js';
import { Matchmaker } from '../src/net/matchmaker.js';
import { step } from '../src/sim/game.js';
import { TUNE } from '../src/sim/world.js';

function mockConn(id) {
  const messages = [];
  return {
    id,
    messages,
    send: (raw) => messages.push(typeof raw === 'string' ? JSON.parse(raw) : raw),
    close: () => {},
  };
}

function lastOfType(conn, type) {
  return [...conn.messages].reverse().find((m) => m.type === type);
}

test('room recipe effects apply the same as local play (acid bolt damages foe)', async () => {
  const room = new Room('TEST');
  const a = mockConn('a');
  const b = mockConn('b');
  room.onConnect(a);
  room.onConnect(b);

  room.onMessage(a, { type: 'ready', characterId: 'akari', name: 'A' });
  room.onMessage(b, { type: 'ready', characterId: 'sora', name: 'B' });
  assert.equal(room.phase, 'playing');
  assert.ok(room.game);
  room.stopLoop(); // drive the sim ourselves

  // Skip countdown.
  step(room.game, TUNE.countdown + 0.05);
  assert.equal(room.game.phase, 'playing');

  const p0 = room.game.players[0];
  const p1 = room.game.players[1];
  Object.assign(p0, { col: 1, row: 1 });
  Object.assign(p1, { col: 5, row: 1, hp: 100 });

  // Put HCl in pot A and run (instant acid bolt).
  p0.hotbar[0].el = 'H';
  p0.hotbar[1].el = 'Cl';
  assert.ok(room.onMessage(a, { type: 'act', action: { type: 'slot', i: 0 } }) !== false);
  room.onMessage(a, { type: 'act', action: { type: 'slot', i: 1 } });
  room.onMessage(a, { type: 'act', action: { type: 'run' } });
  assert.ok(room.game.bolts.length >= 1, 'acid bolt should spawn');

  // Drive bolts across the board.
  for (let i = 0; i < 90; i++) step(room.game, 1 / 60);

  assert.ok(p1.hp < 100, `foe should take acid damage, hp=${p1.hp}`);
});

test('matchmaker pairs two tabs that share a playerId', async () => {
  const store = {};
  const mm = new Matchmaker({
    load: (k) => store[k],
    save: (k, v) => { store[k] = v; },
    createCode: () => 'AB12',
  });
  const a = mockConn('tab1');
  const b = mockConn('tab2');
  mm.onConnect(a);
  mm.onConnect(b);
  await mm.enqueue(a, { playerId: 'same', name: 'A', packId: 'chemistry' });
  await mm.enqueue(b, { playerId: 'same', name: 'B', packId: 'chemistry' });
  assert.ok(lastOfType(a, 'matched'), 'tab1 matched');
  assert.ok(lastOfType(b, 'matched'), 'tab2 matched');
  assert.equal(lastOfType(a, 'matched').code, 'AB12');
  mm.stop();
});
