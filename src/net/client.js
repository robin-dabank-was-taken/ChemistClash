// Browser client for authoritative Chemist Clash rooms.
import {
  roomWsUrl, makeRoomCode, isValidCode, normalizeCode, resolveNet, netSetupHint, describeNet,
} from './config.js';
import { hydrateGame } from '../sim/serialize.js';

export { makeRoomCode, isValidCode, normalizeCode, resolveNet, netSetupHint, describeNet };

export class NetClient {
  constructor() {
    this.ws = null;
    this.pid = null;
    this.code = null;
    this.handlers = {};
    this.connected = false;
  }

  on(type, fn) {
    this.handlers[type] = fn;
  }

  emit(type, msg) {
    const fn = this.handlers[type];
    if (fn) fn(msg);
  }

  connect(code) {
    this.close();
    this.code = normalizeCode(code);
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
      const done = (fn) => (arg) => {
        clearTimeout(timer);
        fn(arg);
      };
      ws.addEventListener('open', () => {
        this.connected = true;
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
          done(fail)(msg.message || 'Connection error');
          return;
        }
        this.emit(msg.type, msg);
        this.emit('message', msg);
      });
      ws.addEventListener('close', () => {
        this.connected = false;
        if (!settled) done(fail)(new Error(`Could not reach the multiplayer server. ${netSetupHint()}`));
        this.emit('close', {});
      });
      ws.addEventListener('error', () => {
        if (!settled) done(fail)(new Error(`Could not reach the multiplayer server. ${netSetupHint()}`));
      });
    });
  }

  send(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  ready(characterId, name) {
    this.send({ type: 'ready', characterId, name });
  }

  act(action) {
    this.send({ type: 'act', action });
  }

  rematch() {
    this.send({ type: 'rematch' });
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch { /* */ }
      this.ws = null;
    }
    this.connected = false;
    this.pid = null;
  }
}

export function applyNetFrame(app, msg, view, sfx) {
  if (!msg.snapshot) return;
  app.game = hydrateGame(msg.snapshot, app.game);
  const events = msg.events || [];
  for (const ev of events) view.onEvent(app.game, ev, sfx);
}
