// PartyServer (Cloudflare Durable Objects) — rooms + ranked matchmaker.
// Deploy: npx wrangler login && npx wrangler deploy
import { routePartykitRequest, Server } from 'partyserver';
import { Room } from '../src/net/room.js';
import { Matchmaker } from '../src/net/matchmaker.js';
import { makeRoomCode, normalizeCode } from '../src/net/config.js';

export class ChemistRoom extends Server {
  ensureMatch() {
    if (this.match) return this.match;
    const code = normalizeCode(this.name) || this.name;
    this.match = new Room(code, {
      onEmpty: () => {},
      reportRankedResult: (payload) => this.reportRanked(payload),
    });
    return this.match;
  }

  async reportRanked(payload) {
    try {
      const id = this.env.Matchmaker.idFromName('global');
      const stub = this.env.Matchmaker.get(id);
      const res = await stub.fetch('https://matchmaker/result', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  wrap(conn) {
    return {
      id: conn.id,
      send: (data) => conn.send(data),
      close: () => conn.close(),
    };
  }

  onConnect(conn) {
    this.ensureMatch().onConnect(this.wrap(conn));
  }

  onMessage(conn, message) {
    this.ensureMatch().onMessage(this.wrap(conn), message);
  }

  onClose(conn) {
    this.match?.onClose(this.wrap(conn));
  }
}

export class ChemistMatchmaker extends Server {
  ensure() {
    if (this.mm) return this.mm;
    this.mm = new Matchmaker({
      load: (key) => this.ctx.storage.get(key),
      save: (key, value) => this.ctx.storage.put(key, value),
      createCode: () => makeRoomCode(),
      schedule: (delayMs) => {
        void this.ctx.storage.setAlarm(Date.now() + delayMs);
      },
    });
    return this.mm;
  }

  wrap(conn) {
    return {
      id: conn.id,
      send: (data) => conn.send(data),
      close: () => conn.close(),
    };
  }

  onConnect(conn) {
    this.ensure().onConnect(this.wrap(conn));
  }

  onMessage(conn, message) {
    void this.ensure().onMessage(this.wrap(conn), message);
  }

  onClose(conn) {
    this.ensure().onClose(this.wrap(conn));
  }

  async alarm() {
    await this.ensure().tick();
  }

  async onRequest(request) {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname.endsWith('/result')) {
      const body = await request.json().catch(() => ({}));
      const update = await this.ensure().handleResultRequest(body);
      return Response.json(update || {});
    }
    return new Response('Chemist Clash matchmaker', { status: 200 });
  }
}

export default {
  async fetch(request, env) {
    return (
      (await routePartykitRequest(request, env))
      || new Response('Chemist Clash multiplayer worker', { status: 200 })
    );
  },
};
