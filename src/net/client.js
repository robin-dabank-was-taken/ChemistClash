// Browser client for authoritative Chemist Clash rooms + ranked queue.
import {
  roomWsUrl, queueWsUrl, makeRoomCode, isValidCode, normalizeCode,
  resolveNet, netSetupHint, describeNet,
} from './config.js';
import { hydrateGame } from '../sim/serialize.js';
import { getPlayerId, getPlayerName } from './identity.js';

export {
  makeRoomCode, isValidCode, normalizeCode, resolveNet, netSetupHint, describeNet, queueWsUrl,
};

export class NetClient {
  constructor() {
    this.ws = null;
    this.queueWs = null;
    this.pid = null;
    this.code = null;
    this.handlers = {};
    this.connected = false;
    this.queueConnected = false;
    this.matchMeta = null; // { matchId, ranked, elo, opponent, packId }
  }

  on(type, fn) {
    this.handlers[type] = fn;
  }

  emit(type, msg) {
    const fn = this.handlers[type];
    if (fn) fn(msg);
  }

  connect(code, { rankedMeta = null } = {}) {
    this.closeRoom();
    this.code = normalizeCode(code);
    this.matchMeta = rankedMeta;
    const net = resolveNet();
    if (net.kind === 'none') {
      return Promise.reject(new Error(netSetupHint()));
    }
    const url = roomWsUrl(this.code);
    if (!url) return Promise.reject(new Error(netSetupHint()));

    return new Promise((resolve, reject) => {
      let settled = false;
      let ws;
      try {
        ws = new WebSocket(url);
      } catch (err) {
        reject(new Error(`${err.message || err} — ${netSetupHint()}`));
        return;
      }
      this.ws = ws;
      const fail = (err) => {
        if (settled) return;
        settled = true;
        const base = err instanceof Error ? err.message : String(err);
        reject(new Error(`${base} (${describeNet()})`));
      };
      const timer = setTimeout(() => {
        fail(new Error(`Timed out connecting. ${netSetupHint()}`));
        try { ws.close(); } catch { /* */ }
      }, 8000);
      ws.addEventListener('open', () => {
        this.connected = true;
        this.sendHello();
      });
      ws.addEventListener('message', (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        if (msg.type === 'welcome') {
          this.pid = msg.pid;
          this.code = msg.code || this.code;
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(msg);
          }
        }
        if (msg.type === 'error' && !settled) {
          clearTimeout(timer);
          fail(new Error(msg.message || 'Connection error'));
          return;
        }
        this.emit(msg.type, msg);
        this.emit('message', msg);
      });
      ws.addEventListener('close', () => {
        this.connected = false;
        if (!settled) {
          clearTimeout(timer);
          fail(new Error(`Could not reach the multiplayer server. ${netSetupHint()}`));
        }
        this.emit('close', {});
      });
      ws.addEventListener('error', () => {
        if (!settled) {
          clearTimeout(timer);
          fail(new Error(`Could not reach the multiplayer server. ${netSetupHint()}`));
        }
      });
    });
  }

  sendHello() {
    const meta = this.matchMeta || {};
    this.send({
      type: 'hello',
      name: getPlayerName(),
      playerId: getPlayerId(),
      elo: meta.elo ?? null,
      ranked: !!meta.ranked,
      matchId: meta.matchId || null,
    });
  }

  /** Open ranked queue socket and enqueue. */
  queue({ packId = 'chemistry' } = {}) {
    this.closeQueue();
    const url = queueWsUrl();
    if (!url) return Promise.reject(new Error(netSetupHint()));

    return new Promise((resolve, reject) => {
      let settled = false;
      let ws;
      try {
        ws = new WebSocket(url);
      } catch (err) {
        reject(new Error(`${err.message || err}`));
        return;
      }
      this.queueWs = ws;
      const fail = (err) => {
        if (settled) return;
        settled = true;
        reject(err instanceof Error ? err : new Error(String(err)));
      };
      const timer = setTimeout(() => {
        fail(new Error(`Timed out reaching the matchmaking queue. ${netSetupHint()}`));
        try { ws.close(); } catch { /* */ }
      }, 8000);

      ws.addEventListener('open', () => {
        this.queueConnected = true;
        this.queueSend({
          type: 'enqueue',
          playerId: getPlayerId(),
          name: getPlayerName(),
          packId: packId === 'physics' ? 'physics' : 'chemistry',
        });
      });
      ws.addEventListener('message', (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        if (msg.type === 'queued' && !settled) {
          settled = true;
          clearTimeout(timer);
          resolve(msg);
        }
        if (msg.type === 'error' && !settled) {
          clearTimeout(timer);
          fail(new Error(msg.message || 'Queue error'));
          return;
        }
        if (msg.type === 'matched') {
          this.matchMeta = {
            matchId: msg.matchId,
            ranked: true,
            elo: msg.elo,
            opponent: msg.opponent,
            packId: msg.packId,
          };
        }
        this.emit(msg.type, msg);
        this.emit('queue_message', msg);
      });
      ws.addEventListener('close', () => {
        this.queueConnected = false;
        if (!settled) {
          clearTimeout(timer);
          fail(new Error(`Could not reach the matchmaking queue. ${netSetupHint()}`));
        }
        this.emit('queue_close', {});
      });
      ws.addEventListener('error', () => {
        if (!settled) {
          clearTimeout(timer);
          fail(new Error(`Could not reach the matchmaking queue. ${netSetupHint()}`));
        }
      });
    });
  }

  queueSend(msg) {
    if (this.queueWs && this.queueWs.readyState === WebSocket.OPEN) {
      this.queueWs.send(JSON.stringify(msg));
    }
  }

  dequeue() {
    this.queueSend({ type: 'dequeue' });
    this.closeQueue();
  }

  fetchElo() {
    const url = queueWsUrl();
    if (!url) return Promise.resolve(null);
    return new Promise((resolve) => {
      let settled = false;
      let ws;
      try { ws = new WebSocket(url); } catch { resolve(null); return; }
      const done = (v) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { ws.close(); } catch { /* */ }
        resolve(v);
      };
      const timer = setTimeout(() => done(null), 4000);
      ws.addEventListener('open', () => {
        ws.send(JSON.stringify({ type: 'elo_get', playerId: getPlayerId() }));
      });
      ws.addEventListener('message', (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        if (msg.type === 'elo') done(msg.elo);
      });
      ws.addEventListener('error', () => { if (!settled) done(null); });
      ws.addEventListener('close', () => { if (!settled) done(null); });
    });
  }

  send(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  ready(characterId, name) {
    this.send({ type: 'ready', characterId, name: name || getPlayerName() });
  }

  act(action) {
    this.send({ type: 'act', action });
  }

  rematch() {
    this.send({ type: 'rematch' });
  }

  closeQueue() {
    if (this.queueWs) {
      try { this.queueWs.close(); } catch { /* */ }
      this.queueWs = null;
    }
    this.queueConnected = false;
  }

  closeRoom() {
    if (this.ws) {
      try { this.ws.close(); } catch { /* */ }
      this.ws = null;
    }
    this.connected = false;
    this.pid = null;
  }

  close() {
    this.closeQueue();
    this.closeRoom();
    this.matchMeta = null;
  }
}

export function applyNetFrame(app, msg, view, sfx) {
  if (!msg.snapshot) return;
  app.game = hydrateGame(msg.snapshot, app.game);
  const events = msg.events || [];
  for (const ev of events) view.onEvent(app.game, ev, sfx);
  if (msg.elo) app.eloResult = msg.elo;
}
