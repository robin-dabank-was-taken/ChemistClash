// Entry point: owns the canvas, the main loop, and which screen is showing.
import { createGame, step } from './sim/game.js';
import { createBot, botStep, BOT_LEVELS } from './sim/bot.js';
import { Input, getSoloKeys, KEYS_P1, KEYS_P2 } from './input.js';
import {
  SOLO_BIND_ROWS, getSoloBinds, rebindSolo, resetSoloBinds, loadSoloBinds,
} from './controls.js';
import { CHARACTERS, pickBotCharacter, getCharacter } from './characters.js';
import { Sfx } from './audio.js';
import { W, H } from './render/layout.js';
import { text } from './render/draw.js';
import { FieldView } from './render/field.js';
import { drawTopBar, drawThermometers, drawPanel } from './render/hud.js';
import { preloadPortraits } from './render/sprites.js';
import {
  MENU, BOOK_PAGES, drawBackdrop, drawMenu, drawHowTo, drawBook, drawSelect,
  drawCountdown, drawPause, drawResult, drawOnlineGate, drawOnlineJoin, drawOnlineLobby,
  drawControls,
} from './render/screens.js';
import {
  NetClient, makeRoomCode, applyNetFrame, isValidCode, normalizeCode,
  resolveNet, netSetupHint, describeNet,
} from './net/client.js';

const STEP = 1 / 60;
const RESULT_DELAY = 0.9;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = new Input();
const sfx = new Sfx();
const view = new FieldView();
const net = new NetClient();

preloadPortraits(CHARACTERS.map((c) => c.id));

export const app = {
  screen: 'menu', // menu | howto | select | online | join | lobby | controls | game
  menu: { index: 0, level: 0 },
  menuRects: [],
  book: false,
  bookPage: 0,
  mode: 'bot',
  select: null,
  picks: [null, null],
  online: null, // { step, index, role, code, seats, error, status, rects }
  controls: null, // { index, listening, binds, rects, flash }
  game: null,
  bot: null,
  humans: [],
  paused: false,
  overT: 0,
  time: 0,
  scale: 1,
};

loadSoloBinds();

function resize() {
  const fit = Math.min(window.innerWidth / W, window.innerHeight / H);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.style.width = `${Math.floor(W * fit)}px`;
  canvas.style.height = `${Math.floor(H * fit)}px`;
  canvas.width = Math.max(1, Math.round(W * fit * dpr));
  canvas.height = Math.max(1, Math.round(H * fit * dpr));
  app.scale = canvas.width / W;
}

function beginSelect(mode, extra = {}) {
  app.mode = mode;
  app.select = {
    mode,
    picking: 0,
    cursor: 0,
    picks: [null, null],
    rects: [],
    ...extra,
  };
  app.screen = 'select';
  app.book = false;
}

function mySeatReady() {
  const seats = app.online?.seats;
  if (!seats || net.pid == null) return !!app.online?.locked;
  return !!seats[net.pid]?.ready;
}

function openOnlineSelect() {
  beginSelect('online', {
    onlineRole: app.online?.role || (net.pid === 0 ? 'host' : 'join'),
    picking: net.pid || 0,
  });
}

function wireNetHandlers() {
  net.on('lobby', (msg) => {
    if (!app.online) return;
    app.online.seats = msg.seats;
    app.online.code = msg.code || app.online.code;
    app.online.error = null;
    // Never yank the player off character select when a lobby ping arrives.
    if (app.screen === 'select' || app.screen === 'game') return;
    if (app.online.locked || mySeatReady()) {
      app.screen = 'lobby';
      app.online.status = 'Locked in — waiting for opponent…';
    } else {
      // Still need a chemist — send them (back) to select.
      app.online.status = 'Pick your chemist…';
      openOnlineSelect();
    }
  });
  net.on('start', (msg) => {
    beginOnlineMatch(msg);
  });
  net.on('frame', (msg) => {
    if (app.screen !== 'game' || app.mode !== 'online') return;
    applyNetFrame(app, msg, view, sfx);
  });
  net.on('over', (msg) => {
    applyNetFrame(app, msg, view, sfx);
    app.overT = RESULT_DELAY;
  });
  net.on('peer_left', (msg) => {
    if (app.online) {
      app.online.error = msg.message || 'Opponent left.';
      app.online.status = 'Opponent left — pick again when ready.';
      app.online.locked = false;
    }
    app.game = null;
    input.dispatch = null;
    input.reset();
    openOnlineSelect();
  });
  net.on('error', (msg) => {
    if (app.online) app.online.error = msg.message || 'Network error';
  });
  net.on('close', () => {
    if (app.mode === 'online' && app.screen !== 'menu') {
      if (app.online) app.online.error = 'Disconnected from server.';
    }
  });
}
wireNetHandlers();

function beginOnlineMatch(msg) {
  app.mode = 'online';
  app.game = null;
  applyNetFrame(app, msg, view, sfx);
  app.bot = null;
  app.humans = [{ pid: net.pid, keys: getSoloKeys() }];
  input.configure(app.humans);
  input.dispatch = (_pid, action) => net.act(action);
  view.reset();
  app.screen = 'game';
  app.select = null;
  app.paused = false;
  app.book = false;
  app.overT = 0;
  sfx.play('count');
}

async function hostOnline() {
  app.online = {
    step: 'lobby', index: 0, role: 'host', code: makeRoomCode(),
    seats: [null, null], error: null, status: 'Connecting…', rects: [],
  };
  app.screen = 'lobby';
  try {
    await net.connect(app.online.code);
    app.online.status = 'Connected. Pick your chemist…';
    beginSelect('online', { onlineRole: 'host', picking: 0 });
  } catch (err) {
    app.online.error = err.message || String(err);
    app.online.status = null;
    app.screen = 'online';
  }
}

async function joinOnline(code) {
  const c = normalizeCode(code);
  if (!isValidCode(c)) {
    if (app.online) app.online.error = 'Need a 4-character code.';
    return;
  }
  app.online = {
    step: 'join', index: 0, role: 'join', code: c,
    seats: [null, null], error: null, status: 'Connecting…', rects: [],
  };
  app.screen = 'lobby';
  try {
    await net.connect(c);
    app.online.status = 'Connected. Pick your chemist…';
    beginSelect('online', { onlineRole: 'join', picking: net.pid || 0 });
  } catch (err) {
    app.online.error = err.message || String(err);
    app.online.status = null;
    app.screen = 'join';
  }
}

function lockSelect() {
  const s = app.select;
  if (!s) return;
  s.picks[s.picking] = CHARACTERS[s.cursor].id;
  sfx.play('select');

  if (s.mode === 'online') {
    const id = s.picks[s.picking];
    const name = getCharacter(id).name;
    app.picks[net.pid] = id;
    app.online = app.online || {
      step: 'lobby', role: s.onlineRole, code: net.code,
      seats: [null, null], error: null, status: '', rects: [],
    };
    app.online.locked = true;
    app.online.status = 'Locked in — waiting for opponent…';
    app.screen = 'lobby';
    app.select = null;
    net.ready(id, name);
    return;
  }

  if (s.picking === 0) {
    s.picking = 1;
    if (s.mode === 'bot') {
      const level = BOT_LEVELS[app.menu.level];
      const id = pickBotCharacter({ next: () => Math.random() }, level);
      s.picks[1] = id;
      s.cursor = Math.max(0, CHARACTERS.findIndex((c) => c.id === id));
      startMatch(s.mode, s.picks);
      return;
    }
    s.cursor = 0;
    return;
  }
  startMatch(s.mode, s.picks);
}

function startMatch(mode, characters) {
  const level = BOT_LEVELS[app.menu.level];
  const chars = characters || app.picks;
  app.picks = [...chars];
  app.mode = mode;
  const c0 = getCharacter(chars[0]);
  const c1 = getCharacter(chars[1]);
  app.game = createGame({
    names: mode === 'bot'
      ? [c0.name, `${c1.name} · ${level}`]
      : [c0.name, c1.name],
    characters: chars,
  });
  app.bot = mode === 'bot' ? createBot(1, level) : null;
  app.humans = mode === 'bot'
    ? [{ pid: 0, keys: getSoloKeys() }]
    : [{ pid: 0, keys: KEYS_P1 }, { pid: 1, keys: KEYS_P2 }];
  input.dispatch = null;
  input.configure(app.humans);
  view.reset();
  app.screen = 'game';
  app.select = null;
  app.paused = false;
  app.book = false;
  app.overT = 0;
  sfx.play('count');
}

function toMenu() {
  net.close();
  input.dispatch = null;
  app.screen = 'menu';
  app.game = null;
  app.bot = null;
  app.select = null;
  app.online = null;
  app.paused = false;
  input.reset();
}

function chooseMenu(id) {
  sfx.play('select');
  if (id === 'bot' || id === 'local') beginSelect(id);
  else if (id === 'online') {
    const net = resolveNet();
    app.online = {
      step: 'gate', index: 0, role: null, code: '', seats: [null, null],
      error: null, status: null, rects: [],
      netOk: net.kind !== 'none',
      netLabel: describeNet(),
      hint: net.kind === 'none' ? netSetupHint() : (net.kind === 'ws'
        ? 'Tip: open a second browser tab on this same address to join.'
        : 'Share the room code with a friend on the same site.'),
    };
    app.screen = 'online';
  } else if (id === 'book') app.book = true;
  else if (id === 'controls') {
    app.controls = {
      index: 0,
      listening: null,
      binds: getSoloBinds(),
      rects: [],
      flash: null,
    };
    app.screen = 'controls';
  } else app.screen = 'howto';
}

const CONFIRM = ['Enter', 'NumpadEnter', 'Space'];

function onKey(code, repeat) {
  if (code === 'KeyM') {
    if (!repeat) sfx.muted = !sfx.muted;
    return true;
  }
  if (app.book) {
    if (repeat) return true;
    if (code === 'Tab' || code === 'Escape' || CONFIRM.includes(code)) app.book = false;
    else if (code === 'KeyA' || code === 'ArrowLeft') app.bookPage = (app.bookPage + BOOK_PAGES - 1) % BOOK_PAGES;
    else if (code === 'KeyD' || code === 'ArrowRight') app.bookPage = (app.bookPage + 1) % BOOK_PAGES;
    return true;
  }
  if (code === 'Tab' && app.screen === 'game') {
    if (!repeat) app.book = true;
    input.reset();
    return true;
  }

  if (app.screen === 'menu') {
    const m = app.menu;
    const move = (d) => {
      m.index = (m.index + d + MENU.length) % MENU.length;
      sfx.play('menu');
    };
    const level = (d) => {
      m.level = Math.max(0, Math.min(BOT_LEVELS.length - 1, m.level + d));
      sfx.play('menu');
    };
    if (code === 'KeyW' || code === 'ArrowUp') move(-1);
    else if (code === 'KeyS' || code === 'ArrowDown') move(1);
    else if (code === 'KeyA' || code === 'ArrowLeft') level(-1);
    else if (code === 'KeyD' || code === 'ArrowRight') level(1);
    else if (!repeat && (CONFIRM.includes(code) || code === 'KeyE')) chooseMenu(MENU[m.index]);
    else return false;
    return true;
  }

  if (app.screen === 'howto') {
    if (!repeat && (code === 'Escape' || code === 'Backspace' || CONFIRM.includes(code))) app.screen = 'menu';
    return true;
  }

  if (app.screen === 'controls') {
    const c = app.controls;
    if (!c) return true;
    if (c.listening) {
      if (repeat) return true;
      if (code === 'Escape') {
        c.listening = null;
        c.flash = 'Cancelled';
        return true;
      }
      const row = SOLO_BIND_ROWS[c.index];
      if (row && rebindSolo(row.id, code)) {
        c.binds = getSoloBinds();
        c.listening = null;
        c.flash = `Bound ${row.label}`;
        sfx.play('select');
      }
      return true;
    }
    if (repeat) return true;
    if (code === 'Escape' || code === 'Backspace') {
      app.controls = null;
      app.screen = 'menu';
      return true;
    }
    if (code === 'KeyR') {
      c.binds = resetSoloBinds();
      c.flash = 'Defaults restored';
      sfx.play('select');
      return true;
    }
    if (code === 'KeyW' || code === 'ArrowUp') {
      c.index = (c.index + SOLO_BIND_ROWS.length - 1) % SOLO_BIND_ROWS.length;
      sfx.play('menu');
    } else if (code === 'KeyS' || code === 'ArrowDown') {
      c.index = (c.index + 1) % SOLO_BIND_ROWS.length;
      sfx.play('menu');
    } else if (CONFIRM.includes(code) || code === 'KeyE') {
      c.listening = SOLO_BIND_ROWS[c.index].id;
      c.flash = 'Press any key…';
      sfx.play('menu');
    }
    return true;
  }

  if (app.screen === 'online') {
    if (repeat) return true;
    const o = app.online;
    if (code === 'Escape' || code === 'Backspace') { toMenu(); return true; }
    if (code === 'KeyW' || code === 'ArrowUp') { o.index = (o.index + 1) % 2; sfx.play('menu'); }
    else if (code === 'KeyS' || code === 'ArrowDown') { o.index = (o.index + 1) % 2; sfx.play('menu'); }
    else if (CONFIRM.includes(code) || code === 'KeyE') {
      sfx.play('select');
      if (o.index === 0) hostOnline();
      else {
        o.code = '';
        o.error = null;
        o.status = null;
        app.screen = 'join';
      }
    }
    return true;
  }

  if (app.screen === 'join') {
    const o = app.online;
    if (!o) return true;
    if (code === 'Escape') {
      app.screen = 'online';
      return true;
    }
    if (code === 'Backspace') {
      o.code = (o.code || '').slice(0, -1);
      return true;
    }
    if (CONFIRM.includes(code)) {
      if (!repeat) joinOnline(o.code);
      return true;
    }
    // Letter / digit from event.code
    const letter = /^Key([A-Z])$/.exec(code);
    const digit = /^Digit([0-9])$/.exec(code);
    const ch = letter ? letter[1] : digit ? digit[1] : null;
    if (ch && (o.code || '').length < 4) {
      o.code = normalizeCode((o.code || '') + ch);
      o.error = null;
    }
    return true;
  }

  if (app.screen === 'lobby') {
    if (repeat) return true;
    if (code === 'Escape' || code === 'Backspace') { toMenu(); return true; }
    if ((CONFIRM.includes(code) || code === 'KeyE') && !mySeatReady()) {
      openOnlineSelect();
    }
    return true;
  }

  if (app.screen === 'select') {
    if (repeat) return true;
    const s = app.select;
    if (code === 'Escape' || code === 'Backspace') {
      if (s.mode === 'online') {
        toMenu();
      } else if (s.picking === 1 && s.mode === 'local') {
        s.picking = 0;
        s.picks[0] = null;
        sfx.play('menu');
      } else toMenu();
      return true;
    }
    if (code === 'KeyA' || code === 'ArrowLeft') {
      s.cursor = (s.cursor + CHARACTERS.length - 1) % CHARACTERS.length;
      sfx.play('menu');
    } else if (code === 'KeyD' || code === 'ArrowRight') {
      s.cursor = (s.cursor + 1) % CHARACTERS.length;
      sfx.play('menu');
    } else if (CONFIRM.includes(code) || code === 'KeyE') lockSelect();
    return true;
  }

  const game = app.game;
  if (!game) return false;
  if (game.phase === 'over') {
    if (repeat || app.overT < RESULT_DELAY) return true;
    if (CONFIRM.includes(code)) {
      if (app.mode === 'online') {
        net.rematch();
        if (app.online) {
          app.online.locked = false;
          app.online.status = 'Rematch — lock your chemist again.';
        }
        openOnlineSelect();
      } else startMatch(app.mode, app.picks);
    } else if (code === 'Escape') toMenu();
    return true;
  }
  if (app.paused) {
    if (repeat) return true;
    if (code === 'Escape' || CONFIRM.includes(code)) app.paused = false;
    else if (code === 'KeyR' && app.mode !== 'online') startMatch(app.mode, app.picks);
    else if (code === 'Backspace') toMenu();
    return true;
  }
  if (code === 'Escape') {
    if (app.mode === 'online') {
      // Online: pause is local-only (server keeps running).
      app.paused = true;
    } else {
      app.paused = true;
    }
    input.reset();
    return true;
  }
  return input.keydown(code, repeat);
}

window.addEventListener('keydown', (e) => {
  sfx.unlock();
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (onKey(e.code, e.repeat)) e.preventDefault();
});
window.addEventListener('keyup', (e) => input.keyup(e.code));
window.addEventListener('blur', () => {
  input.reset();
  if (app.screen === 'game' && app.game && app.game.phase !== 'over' && app.mode !== 'online') {
    app.paused = true;
  }
});
window.addEventListener('resize', resize);

function menuItemAt(e) {
  const box = canvas.getBoundingClientRect();
  const x = ((e.clientX - box.left) / box.width) * W;
  const y = ((e.clientY - box.top) / box.height) * H;
  return app.menuRects.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
}

function selectItemAt(e) {
  if (!app.select) return null;
  const box = canvas.getBoundingClientRect();
  const x = ((e.clientX - box.left) / box.width) * W;
  const y = ((e.clientY - box.top) / box.height) * H;
  return (app.select.rects || []).find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
}

function onlineItemAt(e) {
  if (!app.online?.rects) return null;
  const box = canvas.getBoundingClientRect();
  const x = ((e.clientX - box.left) / box.width) * W;
  const y = ((e.clientY - box.top) / box.height) * H;
  return app.online.rects.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
}

canvas.addEventListener('mousemove', (e) => {
  if (app.book) return;
  if (app.screen === 'menu') {
    const item = menuItemAt(e);
    if (item) app.menu.index = item.k;
  } else if (app.screen === 'select') {
    const item = selectItemAt(e);
    if (item) app.select.cursor = item.i;
  } else if (app.screen === 'online') {
    const item = onlineItemAt(e);
    if (item) app.online.index = item.k;
  }
});
canvas.addEventListener('click', (e) => {
  sfx.unlock();
  if (app.book) {
    app.bookPage = (app.bookPage + 1) % BOOK_PAGES;
    if (app.bookPage === 0) app.book = false;
  } else if (app.screen === 'howto') app.screen = 'menu';
  else if (app.screen === 'controls') {
    if (!app.controls) return;
    if (app.controls.listening) return;
    const box = canvas.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * W;
    const y = ((e.clientY - box.top) / box.height) * H;
    const hit = (app.controls.rects || []).find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
    if (hit) {
      app.controls.index = hit.i;
      app.controls.listening = hit.id;
      app.controls.flash = 'Press any key…';
      sfx.play('menu');
    }
  } else if (app.screen === 'menu') {
    const item = menuItemAt(e);
    if (item) chooseMenu(item.id);
  } else if (app.screen === 'online') {
    const item = onlineItemAt(e);
    if (item) {
      app.online.index = item.k;
      if (item.id === 'host') hostOnline();
      else {
        app.online.code = '';
        app.screen = 'join';
      }
    }
  } else if (app.screen === 'select') {
    const item = selectItemAt(e);
    if (item) {
      app.select.cursor = item.i;
      lockSelect();
    }
  }
});

function render() {
  ctx.setTransform(app.scale, 0, 0, app.scale, 0, 0);
  drawBackdrop(ctx);
  if (app.screen === 'menu') {
    app.menuRects = drawMenu(ctx, app.menu, BOT_LEVELS, app.time);
  } else if (app.screen === 'howto') {
    drawHowTo(ctx);
  } else if (app.screen === 'controls') {
    drawControls(ctx, app.controls);
  } else if (app.screen === 'online') {
    drawOnlineGate(ctx, app.online);
  } else if (app.screen === 'join') {
    drawOnlineJoin(ctx, app.online);
  } else if (app.screen === 'lobby') {
    drawOnlineLobby(ctx, app.online);
  } else if (app.screen === 'select') {
    drawSelect(ctx, app.select, app.time);
  } else if (app.game) {
    const game = app.game;
    view.draw(ctx, game, app.time, app.humans.map((h) => h.pid));
    drawTopBar(ctx, game, view);
    drawThermometers(ctx, game);
    for (const p of game.players) {
      const human = app.humans.find((h) => h.pid === p.id);
      drawPanel(ctx, p, human ? human.keys.labels : null, view, app.time);
    }
    drawCountdown(ctx, game);
    if (game.phase === 'over' && app.overT >= RESULT_DELAY) drawResult(ctx, game);
    else if (app.paused && !app.book) drawPause(ctx);
  }
  if (app.book) drawBook(ctx, app.bookPage);
  if (sfx.muted) text(ctx, 'SOUND OFF (M)', W / 2, H - 4, { size: 10, color: '#7f8da6', align: 'center' });
}

let last = performance.now();
let acc = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  app.time += dt;
  const game = app.game;
  if (app.screen === 'game' && game && !app.paused && !app.book) {
    if (app.mode === 'online') {
      // Server is authoritative; client only sends inputs + paints frames.
      input.update(game, dt);
      view.update(dt, game);
      if (game.phase === 'over') app.overT += dt;
    } else {
      acc += dt;
      while (acc >= STEP) {
        acc -= STEP;
        input.update(game, STEP);
        if (app.bot) botStep(game, app.bot, STEP);
        const count = Math.ceil(game.countdown);
        step(game, STEP);
        if (game.phase === 'countdown' && Math.ceil(game.countdown) !== count) sfx.play('count');
        for (const ev of game.events) view.onEvent(game, ev, sfx);
        game.events.length = 0;
      }
      view.update(dt, game);
      if (game.phase === 'over') app.overT += dt;
    }
  }
  render();
  requestAnimationFrame(frame);
}

resize();
requestAnimationFrame(frame);
