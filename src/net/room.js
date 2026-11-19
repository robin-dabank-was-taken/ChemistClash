// Authoritative match room. Used by the local Node WS server and PartyKit.
import { createGame, step, act } from '../sim/game.js';
import { snapshotGame } from '../sim/serialize.js';
import { getCharacter } from '../characters.js';
import { normalizeCode } from './config.js';

const TICK = 1 / 20;

export class Room {
  constructor(code, { broadcast, onEmpty } = {}) {
    this.code = normalizeCode(code);
    this.broadcast = broadcast || (() => {});
    this.onEmpty = onEmpty || (() => {});
    this.clients = new Map(); // connId -> { conn, pid, name, characterId, ready }
    this.game = null;
    this.loop = null;
    this.phase = 'lobby'; // lobby | playing | over
  }

  lobbyState() {
    const seats = [null, null];
    for (const c of this.clients.values()) {
      if (c.pid == null) continue;
      seats[c.pid] = {
        name: c.name,
        characterId: c.characterId,
        ready: !!c.ready,
      };
    }
    return { type: 'lobby', code: this.code, seats, phase: this.phase };
  }

  send(conn, msg) {
    try { conn.send(JSON.stringify(msg)); } catch { /* closed */ }
  }

  sendAll(msg) {
    const raw = JSON.stringify(msg);
    for (const c of this.clients.values()) {
      try { c.conn.send(raw); } catch { /* closed */ }
    }
  }

  assignPid() {
    const taken = new Set([...this.clients.values()].map((c) => c.pid).filter((p) => p != null));
    if (!taken.has(0)) return 0;
    if (!taken.has(1)) return 1;
    return null;
  }

  onConnect(conn) {
    const id = conn.id;
    const pid = this.assignPid();
    if (pid == null) {
      this.send(conn, { type: 'error', message: 'Room is full.' });
      try { conn.close(); } catch { /* */ }
      return;
    }
    const client = {
      conn, id, pid,
      name: `Player ${pid + 1}`,
      characterId: null,
      ready: false,
    };
    this.clients.set(id, client);
    this.send(conn, { type: 'welcome', pid, code: this.code });
    this.sendAll(this.lobbyState());
  }

  onMessage(conn, data) {
    const client = this.clients.get(conn.id);
    if (!client) return;
    let msg;
    try { msg = typeof data === 'string' ? JSON.parse(data) : data; } catch { return; }
    if (!msg || typeof msg !== 'object') return;

    switch (msg.type) {
      case 'hello':
        if (typeof msg.name === 'string' && msg.name.trim()) {
          client.name = msg.name.trim().slice(0, 18);
        }
        this.sendAll(this.lobbyState());
        break;

      case 'ready': {
        if (this.phase !== 'lobby') break;
        const id = typeof msg.characterId === 'string' ? msg.characterId : null;
        if (!id || !getCharacter(id)) {
          this.send(conn, { type: 'error', message: 'Pick a chemist first.' });
          break;
        }
        client.characterId = id;
        client.ready = true;
        if (typeof msg.name === 'string' && msg.name.trim()) {
          client.name = msg.name.trim().slice(0, 18);
        }
        this.sendAll(this.lobbyState());
        this.maybeStart();
        break;
      }

      case 'unready':
        if (this.phase !== 'lobby') break;
        client.ready = false;
        this.sendAll(this.lobbyState());
        break;

      case 'act':
        if (this.phase !== 'playing' || !this.game) break;
        if (!msg.action || typeof msg.action !== 'object') break;
        act(this.game, client.pid, msg.action);
        break;

      case 'rematch':
        if (this.phase !== 'over') break;
        client.ready = false;
        client.characterId = client.characterId; // keep last pick
        this.phase = 'lobby';
        this.stopLoop();
        this.game = null;
        // Both must ready again with a character (reuse last).
        for (const c of this.clients.values()) c.ready = false;
        this.sendAll(this.lobbyState());
        break;

      default:
        break;
    }
  }

  maybeStart() {
    if (this.phase !== 'lobby') return;
    if (this.clients.size < 2) return;
    const seats = [...this.clients.values()].sort((a, b) => a.pid - b.pid);
    if (seats.length < 2 || !seats.every((c) => c.ready && c.characterId)) return;

    const names = seats.map((c) => {
      const ch = getCharacter(c.characterId);
      return c.name || ch.name;
    });
    this.game = createGame({
      names,
      characters: seats.map((c) => c.characterId),
    });
    this.phase = 'playing';
    this.sendAll({ type: 'start', snapshot: snapshotGame(this.game) });
    this.startLoop();
  }

  startLoop() {
    this.stopLoop();
    let last = Date.now();
    this.loop = setInterval(() => {
      if (!this.game) return;
      const now = Date.now();
      let dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // Catch up in fixed steps so rate stays stable under load.
      while (dt > 0) {
        const stepDt = Math.min(TICK, dt);
        step(this.game, stepDt);
        dt -= stepDt;
      }
      const events = this.game.events.splice(0, this.game.events.length);
      this.sendAll({
        type: 'frame',
        snapshot: snapshotGame(this.game),
        events,
      });
      if (this.game.phase === 'over') {
        this.phase = 'over';
        this.stopLoop();
        this.sendAll({ type: 'over', snapshot: snapshotGame(this.game), events: [] });
      }
    }, TICK * 1000);
  }

  stopLoop() {
    if (this.loop) {
      clearInterval(this.loop);
      this.loop = null;
    }
  }

  onClose(conn) {
    const client = this.clients.get(conn.id);
    if (!client) return;
    this.clients.delete(conn.id);
    if (this.phase === 'playing' || this.phase === 'over') {
      this.stopLoop();
      this.phase = 'lobby';
      this.game = null;
      for (const c of this.clients.values()) c.ready = false;
      this.sendAll({ type: 'peer_left', message: 'Opponent disconnected.' });
      this.sendAll(this.lobbyState());
    } else {
      this.sendAll(this.lobbyState());
    }
    if (this.clients.size === 0) this.onEmpty();
  }
}
