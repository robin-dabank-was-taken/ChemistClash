# Chemist Clash

A real-time grid duel where you mix chemical formulas instead of playing cards.

## Play locally

```bash
npm start
```

## Online multiplayer (room codes)

Uses an **authoritative** sim (`act` / `step` on the server). Clients send inputs and paint snapshots.

### Local (two browsers)

1. `npm start`
2. **Online · Room Code** → one **Host**, one **Join** with the 4-letter code.

### Public (GitHub Pages + Cloudflare PartyServer)

The old `*.partykit.dev` host is shut down. Rooms now run as a **Cloudflare Worker** (free plan) via [PartyServer](https://github.com/cloudflare/partykit/tree/main/packages/partyserver).

```bash
npm install
npx wrangler login          # browser login to Cloudflare
npm run party:deploy        # prints something like chemist-clash.<account>.workers.dev
```

1. Copy that host into [`src/net/config.js`](src/net/config.js) as `PARTYKIT_HOST` (no `https://`).
2. Commit and push so GitHub Pages picks up the config.
3. Hard-refresh https://robin-dabank-was-taken.github.io/ChemistClash/

Quick test without editing the file:

`?net=chemist-clash.YOURACCOUNT.workers.dev`

## Modes

| Mode | Notes |
|------|--------|
| Play vs Computer | Solo controls (arrows, Q/W pots, E, R) |
| 2 Players | One keyboard |
| Online | Host/join with a short room code |

## Tests

```bash
npm test
```


THANK YOU ONE STEP FROM EDEN FOR THE INSPIRATION
IF YOU WANT IT DOWN I CAN DO THAT
