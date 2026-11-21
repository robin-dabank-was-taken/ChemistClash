// Ranked quick-match queue: Elo lookup, expanding-range pairing, result apply.
import { DEFAULT_ELO, applyEloPair } from './elo.js';
import { makeRoomCode, normalizeCode, isValidCode } from './config.js';

const TICK_MS = 1000;
const BASE_RANGE = 100;
const RANGE_GROWTH = 50; // per second waited
const MAX_RANGE = 600;
const FORCE_ANY_MS = 45000;

function makeMatchId() {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export class Matchmaker {
  /**
   * @param {object} opts
   * @param {(key: string) => Promise<any>|any} [opts.load]
   * @param {(key: string, value: any) => Promise<void>|void} [opts.save]
   * @param {() => string} [opts.createCode] returns a fresh unused room code
   * @param {(delayMs: number) => void} [opts.schedule] platform timer (DO alarm); else setInterval
   */
  constructor({ load, save, createCode, schedule } = {}) {
    this.load = load || (async () => undefined);
    this.save = save || (async () => {});
    this.createCode = createCode || (() => makeRoomCode());
    this.schedule = schedule || null;
    this.queue = []; // { conn, playerId, name, packId, joinedAt, elo }
    this.pending = new Map(); // matchId -> { code, packId, players: [{playerId, elo, name}] }
    this.loop = null;
  }

  send(conn, msg) {
    try { conn.send(typeof msg === 'string' ? msg : JSON.stringify(msg)); } catch { /* */ }
  }

  async getElo(playerId) {
    const v = await this.load(`elo:${playerId}`);
    return typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : DEFAULT_ELO;
  }

  async setElo(playerId, elo) {
    await this.save(`elo:${playerId}`, Math.round(elo));
  }

  start() {
    if (this.schedule) {
      this.schedule(TICK_MS);
      return;
    }
    if (this.loop) return;
    this.loop = setInterval(() => { void this.tick(); }, TICK_MS);
  }

  stop() {
    if (this.loop) {
      clearInterval(this.loop);
      this.loop = null;
    }
  }

  requestTick() {
    if (this.schedule) this.schedule(TICK_MS);
    else this.start();
  }

  onConnect(conn) {
    if (conn.id == null) conn.id = `q_${Math.random().toString(36).slice(2, 9)}`;
    this.start();
    this.send(conn, { type: 'queue_hello' });
  }

  async onMessage(conn, data) {
    let msg;
    try { msg = typeof data === 'string' ? JSON.parse(data) : data; } catch { return; }
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'enqueue') {
      await this.enqueue(conn, msg);
      return;
    }
    if (msg.type === 'dequeue') {
      this.dequeue(conn);
      this.send(conn, { type: 'left_queue' });
      return;
    }
    if (msg.type === 'elo_get') {
      const playerId = String(msg.playerId || '');
      if (!playerId) return;
      const elo = await this.getElo(playerId);
      this.send(conn, { type: 'elo', playerId, elo });
      return;
    }
    if (msg.type === 'result') {
      const update = await this.applyResult(msg);
      if (update) this.send(conn, { type: 'elo_update', ...update });
    }
  }

  onClose(conn) {
    this.dequeue(conn);
    if (this.queue.length === 0 && this.pending.size === 0) this.stop();
  }

  dequeue(conn) {
    this.queue = this.queue.filter((e) => e.conn !== conn);
  }

  async enqueue(conn, msg) {
    const playerId = String(msg.playerId || '').slice(0, 64);
    if (!playerId) {
      this.send(conn, { type: 'error', message: 'Missing player id.' });
      return;
    }
    const name = String(msg.name || 'Challenger').trim().slice(0, 18) || 'Challenger';
    const packId = msg.packId === 'physics' ? 'physics' : 'chemistry';
    this.dequeue(conn);
    const elo = await this.getElo(playerId);
    this.queue.push({
      conn, playerId, name, packId, elo, joinedAt: Date.now(),
    });
    this.send(conn, {
      type: 'queued',
      elo,
      packId,
      waiting: this.queue.filter((e) => e.packId === packId).length,
    });
    this.requestTick();
    await this.tick();
  }

  rangeFor(entry, now = Date.now()) {
    const waited = Math.max(0, now - entry.joinedAt);
    if (waited >= FORCE_ANY_MS) return Infinity;
    return Math.min(MAX_RANGE, BASE_RANGE + (waited / 1000) * RANGE_GROWTH);
  }

  async tick() {
    const now = Date.now();
    // Snapshot so we can mutate queue while pairing.
    const waiting = this.queue.slice();
    const used = new Set();

    for (let i = 0; i < waiting.length; i++) {
      const a = waiting[i];
      if (used.has(a.conn.id)) continue;
      if (!this.queue.includes(a)) continue;

      let best = null;
      let bestDiff = Infinity;
      const range = this.rangeFor(a, now);

      for (let j = 0; j < waiting.length; j++) {
        if (i === j) continue;
        const b = waiting[j];
        // Pair by connection so two browser tabs (same localStorage playerId)
        // can still quick-match for local testing.
        if (used.has(b.conn.id) || a.conn === b.conn) continue;
        if (a.packId !== b.packId) continue;
        if (!this.queue.includes(b)) continue;
        const diff = Math.abs(a.elo - b.elo);
        const bRange = this.rangeFor(b, now);
        const allowed = Math.max(range, bRange);
        if (diff > allowed) continue;
        if (diff < bestDiff) {
          best = b;
          bestDiff = diff;
        }
      }

      if (!best) continue;
      used.add(a.conn.id);
      used.add(best.conn.id);
      await this.pair(a, best);
    }

    // Heartbeat status for anyone still waiting.
    for (const e of this.queue) {
      this.send(e.conn, {
        type: 'queue_status',
        elo: e.elo,
        packId: e.packId,
        waiting: this.queue.filter((x) => x.packId === e.packId).length,
        range: this.rangeFor(e) === Infinity ? null : Math.round(this.rangeFor(e)),
      });
    }
    if (this.queue.length > 0) this.requestTick();
    else this.stop();
  }

  async pair(a, b) {
    this.dequeue(a.conn);
    this.dequeue(b.conn);

    let code = normalizeCode(this.createCode());
    if (!isValidCode(code)) code = makeRoomCode();
    const matchId = makeMatchId();
    // Fresh Elo reads in case ratings moved (shouldn't while queued).
    a.elo = await this.getElo(a.playerId);
    b.elo = await this.getElo(b.playerId);

    this.pending.set(matchId, {
      code,
      packId: a.packId,
      createdAt: Date.now(),
      players: [
        { playerId: a.playerId, elo: a.elo, name: a.name },
        { playerId: b.playerId, elo: b.elo, name: b.name },
      ],
    });

    const payload = (self, foe) => ({
      type: 'matched',
      matchId,
      code,
      packId: a.packId,
      ranked: true,
      elo: self.elo,
      opponent: { name: foe.name, elo: foe.elo },
    });
    this.send(a.conn, payload(a, b));
    this.send(b.conn, payload(b, a));
  }

  /**
   * Apply ranked result. winnerPlayerId null/undefined = draw.
   * Returns public update payload or null.
   */
  async applyResult(msg) {
    const matchId = String(msg.matchId || '');
    const pending = this.pending.get(matchId);
    if (!pending) return null;

    const [p0, p1] = pending.players;
    if (!p0 || !p1) return null;

    let winner = 'draw';
    const w = msg.winnerPlayerId;
    if (w === p0.playerId) winner = 'a';
    else if (w === p1.playerId) winner = 'b';
    else if (msg.winnerPid === 0) winner = 'a';
    else if (msg.winnerPid === 1) winner = 'b';
    else if (msg.winnerPid === -1 || msg.draw) winner = 'draw';

    // Map seat order: room pid 0/1 must match the order clients were told…
    // We don't assign seats here; room assigns by connect order. Result should
    // use winnerPlayerId from room (preferred) based on hello playerIds.
    const ratings = applyEloPair(p0.elo, p1.elo, winner);
    await this.setElo(p0.playerId, ratings.a);
    await this.setElo(p1.playerId, ratings.b);
    this.pending.delete(matchId);

    return {
      matchId,
      players: [
        { playerId: p0.playerId, elo: ratings.a, delta: ratings.deltaA, before: p0.elo },
        { playerId: p1.playerId, elo: ratings.b, delta: ratings.deltaB, before: p1.elo },
      ],
    };
  }

  /** HTTP/RPC entry for rooms reporting a finished ranked match. */
  async handleResultRequest(body) {
    return this.applyResult(body || {});
  }
}
