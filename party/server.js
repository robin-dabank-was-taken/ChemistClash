// PartyServer (Cloudflare Durable Objects) — authoritative Chemist Clash rooms.
// Deploy: npx wrangler login && npx wrangler deploy
import { routePartykitRequest, Server } from 'partyserver';
import { Room } from '../src/net/room.js';
import { normalizeCode } from '../src/net/config.js';

export class ChemistRoom extends Server {
  ensureMatch() {
    if (this.match) return this.match;
    const code = normalizeCode(this.name) || this.name;
    this.match = new Room(code, { onEmpty: () => {} });
    return this.match;
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

  // PartyServer: (connection, message) — opposite of old PartyKit order.
  onMessage(conn, message) {
    this.ensureMatch().onMessage(this.wrap(conn), message);
  }

  onClose(conn) {
    this.match?.onClose(this.wrap(conn));
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
