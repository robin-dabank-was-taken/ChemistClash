// Where the authoritative room server lives.
//
// Local (recommended to test): `npm start` → WebSocket at same origin `/net`.
// Public (GitHub Pages): deploy PartyServer to Cloudflare (free Workers plan):
//   npx wrangler login && npm run party:deploy
// Then set PARTYKIT_HOST to the printed *.workers.dev host
//   (or ?net=chemist-clash.<account>.workers.dev).

// Cloudflare PartyServer host from `npm run party:deploy`
export const PARTYKIT_HOST = 'chemist-clash.chemistclash.workers.dev';
export const PARTY_NAME = 'main';

function isLocalHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

export function resolveNet() {
  const q = typeof location !== 'undefined'
    ? new URLSearchParams(location.search).get('net')
    : null;
  const stored = typeof localStorage !== 'undefined'
    ? localStorage.getItem('chemistNet')
    : null;
  const override = (q || stored || '').trim();
  if (override) {
    const host = override.replace(/^wss?:\/\//, '').replace(/\/$/, '');
    if (
      host.includes('partykit')
      || host.endsWith('.partykit.dev')
      || host.endsWith('.workers.dev')
      || host.includes('workers.dev')
    ) {
      return { kind: 'partykit', host, party: PARTY_NAME };
    }
    const proto = (typeof location !== 'undefined' && location.protocol === 'https:') ? 'wss' : 'ws';
    return { kind: 'ws', url: `${proto}://${host}/net` };
  }

  if (typeof location !== 'undefined' && isLocalHost(location.hostname)) {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return { kind: 'ws', url: `${proto}://${location.host}/net` };
  }

  if (PARTYKIT_HOST) {
    return { kind: 'partykit', host: PARTYKIT_HOST, party: PARTY_NAME };
  }

  return { kind: 'none', reason: 'no-server' };
}

export function describeNet() {
  const net = resolveNet();
  if (net.kind === 'ws') return `Local server · ${net.url}`;
  if (net.kind === 'partykit') return `PartyKit · ${net.host}`;
  return 'No multiplayer server configured';
}

export function netSetupHint() {
  if (typeof location !== 'undefined' && isLocalHost(location.hostname)) {
    return 'Run npm start in the project folder, then reload this page.';
  }
  return 'Deploy with Cloudflare: npx wrangler login && npm run party:deploy, set PARTYKIT_HOST to your *.workers.dev host, push, and reload — or open with ?net=chemist-clash.ACCOUNT.workers.dev';
}

export function roomWsUrl(code) {
  const net = resolveNet();
  if (net.kind === 'none') return null;
  if (net.kind === 'partykit') {
    return `wss://${net.host}/parties/${net.party}/${encodeURIComponent(code)}`;
  }
  const u = new URL(net.url);
  u.searchParams.set('code', code);
  return u.toString();
}

export function makeRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += alphabet[(Math.random() * alphabet.length) | 0];
  return s;
}

export function normalizeCode(code) {
  return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
}

export function isValidCode(code) {
  return /^[A-Z0-9]{4}$/.test(normalizeCode(code));
}
