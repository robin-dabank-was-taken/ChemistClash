// Static file server + WebSocket room host for local online play (`/net`).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Room } from './src/net/room.js';
import { makeRoomCode, normalizeCode, isValidCode } from './src/net/config.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT) || 5173;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const rooms = new Map();

function getRoom(code) {
  const c = normalizeCode(code);
  if (!isValidCode(c)) return null;
  let room = rooms.get(c);
  if (!room) {
    room = new Room(c, {
      onEmpty: () => { rooms.delete(c); },
    });
    rooms.set(c, room);
  }
  return room;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/net/create' && req.method === 'POST') {
      let code = makeRoomCode();
      while (rooms.has(code)) code = makeRoomCode();
      getRoom(code);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code }));
      return;
    }
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = normalize(join(ROOT, rel));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname !== '/net') {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

let nextId = 1;
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  let code = normalizeCode(url.searchParams.get('code') || '');
  if (!isValidCode(code)) {
    code = makeRoomCode();
    while (rooms.has(code)) code = makeRoomCode();
  }
  const room = getRoom(code);
  const conn = {
    id: String(nextId++),
    send: (data) => {
      if (ws.readyState === 1) ws.send(data);
    },
    close: () => ws.close(),
  };
  room.onConnect(conn);
  ws.on('message', (buf) => room.onMessage(conn, buf.toString()));
  ws.on('close', () => room.onClose(conn));
});

server.listen(PORT, () => {
  console.log(`Chemist Clash is running at http://localhost:${PORT}`);
  console.log(`Online rooms: ws://localhost:${PORT}/net?code=ABCD`);
});
