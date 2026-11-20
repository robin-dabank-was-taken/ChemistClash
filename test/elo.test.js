import test from 'node:test';
import assert from 'node:assert/strict';
import { expectedScore, nextElo, applyEloPair, DEFAULT_ELO } from '../src/net/elo.js';
import { Matchmaker } from '../src/net/matchmaker.js';

test('equal ratings expect a coin flip', () => {
  assert.equal(expectedScore(1000, 1000), 0.5);
});

test('winning as underdog gains more Elo than a favorite', () => {
  const underdogGain = nextElo(900, 1100, 1) - 900;
  const favoriteGain = nextElo(1100, 900, 1) - 1100;
  assert.ok(underdogGain > favoriteGain);
});

test('applyEloPair draw moves little for equals', () => {
  const r = applyEloPair(1000, 1000, 'draw');
  assert.equal(r.a, 1000);
  assert.equal(r.b, 1000);
});

test('matchmaker pairs same pack and nearby Elo', async () => {
  const store = { 'elo:a': 1000, 'elo:b': 1020 };
  const codes = [];
  const mm = new Matchmaker({
    load: (k) => store[k],
    save: (k, v) => { store[k] = v; },
    createCode: () => {
      const c = 'TEST';
      codes.push(c);
      return c;
    },
  });

  const msgsA = [];
  const msgsB = [];
  const connA = { send: (raw) => msgsA.push(JSON.parse(raw)) };
  const connB = { send: (raw) => msgsB.push(JSON.parse(raw)) };

  await mm.enqueue(connA, { type: 'enqueue', playerId: 'a', name: 'A', packId: 'chemistry' });
  await mm.enqueue(connB, { type: 'enqueue', playerId: 'b', name: 'B', packId: 'chemistry' });

  const matchedA = msgsA.find((m) => m.type === 'matched');
  const matchedB = msgsB.find((m) => m.type === 'matched');
  assert.ok(matchedA, 'A matched');
  assert.ok(matchedB, 'B matched');
  assert.equal(matchedA.code, matchedB.code);
  assert.equal(matchedA.matchId, matchedB.matchId);

  const update = await mm.applyResult({
    matchId: matchedA.matchId,
    winnerPlayerId: 'a',
  });
  assert.ok(update);
  assert.equal(update.players[0].playerId, 'a');
  assert.ok(update.players[0].delta > 0);
  assert.ok(store['elo:a'] > DEFAULT_ELO - 50);
  mm.stop();
});

test('matchmaker does not pair different science packs', async () => {
  const mm = new Matchmaker({
    load: async () => DEFAULT_ELO,
    save: async () => {},
    createCode: () => 'PACK',
  });
  const msgs = [];
  const connA = { send: (raw) => msgs.push(JSON.parse(raw)) };
  const connB = { send: (raw) => msgs.push(JSON.parse(raw)) };
  await mm.enqueue(connA, { playerId: 'a', name: 'A', packId: 'chemistry' });
  await mm.enqueue(connB, { playerId: 'b', name: 'B', packId: 'physics' });
  assert.equal(msgs.filter((m) => m.type === 'matched').length, 0);
  assert.equal(mm.queue.length, 2);
  mm.stop();
});
