// Draws the board: tiles, surfaces, gas, incoming attacks, the two chemists,
// and the short-lived effects (particles, rings, floating numbers).
import { COLS, ROWS, HALF, GASES, RECIPE_BY_ID } from '../data.js';
import { TUNE, colOf, rowOf } from '../sim/world.js';
import { tileRect, tileCenter, PLAYER_COLORS, TILE_H, FIELD_Y, FIELD_BOTTOM } from './layout.js';
import { rr, circle, hash, alpha, text, font } from './draw.js';
import { drawChemist } from './chemist.js';

const SIDE_TILE = [
  { fill: '#1e5a7a', edge: '#0a2030', line: '#3aa8d4' },
  { fill: '#6a2a3c', edge: '#2a1018', line: '#e86888' },
];
const STRIKE_COLOR = {
  water: '#5db8ff', frost: '#c9eeff', acid: '#9be33c', fire: '#ff8a3c', cyanide: '#c77dff', blast: '#ffd24a',
  knockout: '#d9c2ff', solvent: '#ff9ecf', trump: '#fff0a8', wall: '#c4b49a',
};
const BOLT_COLOR = { acid: '#a9f04a', rocket: '#ffb23c' };
const DAMAGE_COLOR = { burn: '#ff9d4a', acid: '#b6f25a', gas: '#d6e86a', frost: '#bfe9ff', water: '#7cc6ff', poison: '#d49bff', blast: '#ffd24a' };
const STATUS_TEXT = { haste: 'HASTE', frozen: 'FROZEN!', chill: 'CHILLED', shield: 'SHIELD', stun: 'KNOCKED OUT!' };

const FEET = 16; // how far below the tile centre a chemist's feet sit

export class FieldView {
  constructor() {
    this.reset();
  }

  reset() {
    this.parts = [];
    this.rings = [];
    this.texts = [];
    this.shake = 0;
    this.pos = null; // smoothed on-screen position of each chemist
    // Per-player anim state: idle / walk / cast / hurt / death.
    this.anim = [
      { moving: false, phase: 1, face: 1, from: null, tCol: null, tRow: null, state: 'idle', castT: 0, deathT: 0 },
      { moving: false, phase: 1, face: -1, from: null, tCol: null, tRow: null, state: 'idle', castT: 0, deathT: 0 },
    ];
    this.hpLag = [TUNE.maxHp, TUNE.maxHp];
    this.potPulse = [[0, 0], [0, 0]];
  }

  // ---------------------------------------------------------------- effects

  burst(x, y, color, n, speed, { up = 0, size = 4, life = 0.5, gravity = 300 } = {}) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      this.parts.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - up,
        life: life * (0.6 + Math.random() * 0.6), max: life, size: size * (0.6 + Math.random() * 0.8), color, gravity,
      });
    }
  }

  ring(x, y, color, radius, life = 0.35) {
    this.rings.push({ x, y, color, radius, life, max: life });
  }

  float(x, y, str, color, size = 18) {
    this.texts.push({ x: x + (Math.random() - 0.5) * 16, y, str, color, size, life: 0.9, max: 0.9 });
  }

  feet(pid) {
    return this.pos ? this.pos[pid] : { x: 0, y: 0 };
  }

  tileBurst(i, color, n, speed, opts) {
    const c = tileCenter(colOf(i), rowOf(i));
    this.burst(c.x, c.y, color, n, speed, opts);
    return c;
  }

  onEvent(game, ev, sfx) {
    switch (ev.type) {
      case 'throw':
        this.potPulse[ev.pid][ev.pot] = 1;
        sfx.play('throw', ev.el);
        break;
      case 'toggle': sfx.play('toggle'); break;
      case 'deny': sfx.play('deny'); break;
      case 'react-start':
        // Short cast punch on confirm — not the whole brew duration.
        if (this.anim?.[ev.pid]) this.anim[ev.pid].castT = Math.max(this.anim[ev.pid].castT, 0.4);
        if (ev.recipe && RECIPE_BY_ID[ev.recipe].time > 0) sfx.play('start');
        break;
      case 'react-done': {
        const f = this.feet(ev.pid);
        const r = RECIPE_BY_ID[ev.recipe];
        this.float(f.x, f.y - 92, `${r.label}  ${r.name}`, PLAYER_COLORS[ev.pid], 15);
        this.potPulse[ev.pid][ev.pot] = 1;
        if (this.anim?.[ev.pid]) this.anim[ev.pid].castT = Math.max(this.anim[ev.pid].castT, 0.35);
        break;
      }
      case 'fizzle': {
        const f = this.feet(ev.pid);
        this.float(f.x, f.y - 92, 'fizzle…', '#9aa7bd', 14);
        this.burst(f.x, f.y - 50, '#8b97ad', 8, 60, { up: 40, gravity: -60, size: 6, life: 0.7 });
        sfx.play('fizzle');
        break;
      }
      case 'clear': {
        const f = this.feet(ev.pid);
        this.float(f.x, f.y - 92, 'emptied', '#9aa7bd', 13);
        sfx.play('fizzle');
        break;
      }
      case 'bolt': sfx.play('bolt'); break;
      case 'bolt-hit':
        this.tileBurst(ev.i, BOLT_COLOR[ev.kind] || '#e9f6ff', 12, 220);
        break;
      case 'telegraph': sfx.play('warn'); break;
      case 'strike': this.onStrike(ev, sfx); break;
      case 'explosion': {
        const c = this.tileBurst(ev.i, '#ffb23c', 18, 320, { size: 6 });
        this.burst(c.x, c.y, '#fff1b8', 8, 180, { size: 4 });
        this.ring(c.x, c.y, '#ffd24a', 70 + ev.power);
        this.shake = Math.max(this.shake, 6 + ev.power * 0.25);
        sfx.play('boom');
        break;
      }
      case 'steam':
        this.tileBurst(ev.i, '#e6eef8', 7, 50, { up: 70, gravity: -80, size: 7, life: 0.8 });
        break;
      case 'wall': {
        const c = this.tileBurst(ev.i, '#c4b49a', 10, 90, { up: 40, size: 5, life: 0.55 });
        this.ring(c.x, c.y, '#e8dcc8', 36, 0.3);
        sfx.play('shield');
        break;
      }
      case 'wall-break': {
        this.tileBurst(ev.i, '#d9cbb4', 14, 180, { up: 60, size: 5, life: 0.55 });
        sfx.play('fizzle');
        break;
      }
      case 'damage': {
        const f = this.feet(ev.pid);
        this.float(f.x, f.y - 70, `-${Math.round(ev.amount)}`, DAMAGE_COLOR[ev.kind] || '#ff6b6b', ev.amount >= 15 ? 26 : 19);
        this.burst(f.x, f.y - 36, '#ff6b6b', Math.min(14, 4 + ev.amount / 2), 160);
        this.shake = Math.max(this.shake, Math.min(12, 2 + ev.amount * 0.3));
        sfx.play(ev.kind === 'burn' || ev.kind === 'acid' || ev.kind === 'gas' ? 'burn' : 'hit');
        break;
      }
      case 'shield-hit': {
        const f = this.feet(ev.pid);
        this.float(f.x, f.y - 70, 'blocked', '#9fe8ff', 14);
        this.ring(f.x, f.y - 36, '#9fe8ff', 46, 0.25);
        break;
      }
      case 'heal': {
        const f = this.feet(ev.pid);
        if (ev.amount > 0) this.float(f.x, f.y - 70, `+${Math.round(ev.amount)}`, '#7dffa0', 20);
        this.burst(f.x, f.y - 30, '#7dffa0', 12, 70, { up: 90, gravity: -40, life: 0.8 });
        sfx.play('heal');
        break;
      }
      case 'status': {
        const f = this.feet(ev.pid);
        if (STATUS_TEXT[ev.status]) this.float(f.x, f.y - 108, STATUS_TEXT[ev.status], '#ffffff', 13);
        sfx.play(ev.status === 'frozen' || ev.status === 'chill' ? 'freeze' : ev.status === 'shield' ? 'shield' : 'buff');
        break;
      }
      case 'blanket':
      case 'fan': {
        for (let r = 0; r < ROWS; r++) {
          const c = tileCenter(ev.side * HALF + (r % 2 ? 1 : 2), r);
          this.burst(c.x, c.y, ev.type === 'fan' ? '#ffd9a0' : '#cfe0ff', 8, 260, { gravity: 0, size: 5, life: 0.6 });
        }
        sfx.play('gas');
        break;
      }
      case 'ko': {
        this.shake = 16;
        for (const p of game.players) {
          if (p.hp > 0) continue;
          const f = this.feet(p.id);
          this.burst(f.x, f.y - 36, PLAYER_COLORS[p.id], 40, 380, { size: 7, life: 1 });
          this.ring(f.x, f.y - 36, '#ffffff', 160, 0.6);
        }
        sfx.play('ko');
        break;
      }
      case 'go': sfx.play('go'); break;
      default:
    }
  }

  onStrike(ev, sfx) {
    const color = ev.kind === 'gas' ? GASES[ev.gas].color : STRIKE_COLOR[ev.kind];
    for (const i of ev.tiles) {
      if (ev.kind === 'gas') this.tileBurst(i, color, 4, 60, { gravity: -20, size: 9, life: 0.7 });
      else if (ev.kind === 'water') this.tileBurst(i, color, 7, 150, { up: 120 });
      else if (ev.kind === 'frost') this.tileBurst(i, color, 8, 120, { gravity: 60 });
      else if (ev.kind === 'cyanide') {
        const c = this.tileBurst(i, color, 16, 240);
        this.ring(c.x, c.y, color, 60);
      } else if (ev.kind === 'trump') {
        const c = this.tileBurst(i, color, 10, 340, { size: 6, life: 0.8 });
        this.ring(c.x, c.y, '#ffffff', 90, 0.5);
      } else if (ev.kind !== 'blast') this.tileBurst(i, color, 7, 160, { up: 80 });
    }
    if (ev.kind === 'trump') this.shake = 22;
    const sound = {
      gas: 'gas', water: 'splash', frost: 'freeze', acid: 'splash', fire: 'burn', cyanide: 'hit', knockout: 'hit', solvent: 'hit', trump: 'boom', wall: 'shield',
    }[ev.kind];
    if (sound) sfx.play(sound);
  }

  update(dt, game) {
    const ease = 1 - Math.exp(-dt * 16);
    if (!this.pos) this.pos = game.players.map((p) => this.target(p));
    if (!this.anim) {
      this.anim = game.players.map((p) => ({
        moving: false, phase: 0, face: p.side === 0 ? 1 : -1, from: null, tCol: null, tRow: null,
        state: 'idle', castT: 0, deathT: 0,
      }));
    }
    game.players.forEach((p, k) => {
      const t = this.target(p);
      const a = this.anim[k];
      a.castT = Math.max(0, (a.castT || 0) - dt);

      if (a.tCol !== p.col || a.tRow !== p.row) {
        a.from = { x: this.pos[k].x, y: this.pos[k].y };
        a.tCol = p.col;
        a.tRow = p.row;
      }
      const dx = t.x - this.pos[k].x;
      const dy = t.y - this.pos[k].y;
      const dist = Math.hypot(dx, dy);
      const span = a.from ? Math.hypot(t.x - a.from.x, t.y - a.from.y) : 0;
      const moving = dist > 1.0 && p.hp > 0 && p.frozen <= 0 && p.stun <= 0;
      a.moving = moving;
      // Always face the opponent; don't flicker with vertical steps.
      a.face = p.side === 0 ? 1 : -1;
      if (moving && span > 1) {
        a.phase = Math.max(0, Math.min(0.999, 1 - dist / span));
      } else {
        a.phase = 0;
      }

      // Priority: death > hurt > cast > walk > idle (no sticky cast during brew)
      if (p.hp <= 0) {
        a.state = 'death';
        a.deathT = (a.deathT || 0) + dt;
        a.moving = false;
      } else {
        a.deathT = 0;
        if (p.hurtT > 0) a.state = 'hurt';
        else if (a.castT > 0) a.state = 'cast';
        else if (moving) a.state = 'walk';
        else a.state = 'idle';
      }

      this.pos[k].x += dx * ease;
      this.pos[k].y += dy * ease;
      // The pale "recent damage" bar drains after the real one.
      if (this.hpLag[k] > p.hp) this.hpLag[k] = Math.max(p.hp, this.hpLag[k] - dt * 30);
      else this.hpLag[k] = p.hp;
      for (let j = 0; j < 2; j++) this.potPulse[k][j] = Math.max(0, this.potPulse[k][j] - dt * 5);
    });
    this.shake *= Math.exp(-dt * 12);
    for (const q of this.parts) {
      q.life -= dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += q.gravity * dt;
    }
    for (const q of this.rings) q.life -= dt;
    for (const q of this.texts) {
      q.life -= dt;
      q.y -= 34 * dt;
    }
    this.parts = this.parts.filter((q) => q.life > 0);
    this.rings = this.rings.filter((q) => q.life > 0);
    this.texts = this.texts.filter((q) => q.life > 0);
  }

  target(p) {
    const c = tileCenter(p.col, p.row);
    return { x: c.x, y: c.y + FEET };
  }

  // ---------------------------------------------------------------- drawing

  // humans: ids of the players sitting at this keyboard (they get aim markers).
  draw(ctx, game, time, humans) {
    ctx.save();
    if (this.shake > 0.3) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);

    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) drawTile(ctx, game, c, r, time);
    // Pixel stage divider between the two halves.
    {
      const left = tileRect(HALF - 1, 0);
      const right = tileRect(HALF, 0);
      const cx = Math.round((left.x + left.w + right.x) / 2);
      for (let y = FIELD_Y - 4; y < FIELD_BOTTOM + 4; y += 8) {
        const mid = Math.abs((y - (FIELD_Y + FIELD_BOTTOM) / 2) / ((FIELD_BOTTOM - FIELD_Y) / 2));
        ctx.fillStyle = `rgba(255,220,120,${0.85 - mid * 0.7})`;
        ctx.fillRect(cx - 1, y, 3, 5);
      }
    }
    for (const pid of humans) drawAim(ctx, game.players[pid], time);
    for (const s of game.strikes) drawTelegraph(ctx, s, time);

    // Back rows first so chemists and flames overlap the tiles behind them.
    for (let r = 0; r < ROWS; r++) {
      for (const p of game.players) {
        if (p.row === r && this.pos) drawChemist(ctx, p, this.pos[p.id], time, this.anim?.[p.id]);
      }
      for (let c = 0; c < COLS; c++) {
        const tile = game.tiles[r * COLS + c];
        const rect = tileRect(c, r);
        if (tile.surf === 'fire') drawFlames(ctx, rect, r * COLS + c, time, Math.min(1, tile.t / 0.4));
        if (tile.gas) drawGas(ctx, rect, r * COLS + c, tile.gas, time);
      }
    }
    for (const p of game.players) if (this.pos) drawBrewing(ctx, p, this.pos[p.id]);
    for (const b of game.bolts) drawBolt(ctx, b);

    for (const q of this.rings) {
      const k = 1 - q.life / q.max;
      const rw = Math.round(q.radius * k);
      const rh = Math.round(q.radius * k * 0.65);
      // Stepped pixel ring (3 nested square outlines).
      for (let layer = 0; layer < 3; layer++) {
        const inset = layer * 3;
        ctx.strokeStyle = alpha(q.color, (1 - k) * (1 - layer * 0.28));
        ctx.lineWidth = 2;
        ctx.strokeRect(
          Math.round(q.x - rw + inset),
          Math.round(q.y - rh + inset),
          Math.max(2, rw * 2 - inset * 2),
          Math.max(2, rh * 2 - inset * 2),
        );
      }
    }
    for (const q of this.parts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, q.life / (q.max * 0.5)));
      ctx.fillStyle = q.color;
      const s = Math.max(3, Math.round(q.size / 2) * 2); // even pixel sizes
      ctx.fillRect(Math.round(q.x - s / 2), Math.round(q.y - s / 2), s, s);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(q.x - s / 2) + 1, Math.round(q.y - s / 2) + 1, Math.max(1, s - 4), 1);
    }
    ctx.globalAlpha = 1;
    for (const q of this.texts) {
      ctx.globalAlpha = Math.min(1, q.life / (q.max * 0.4));
      ctx.font = font(q.size);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      // Hard pixel outline (4-dir) instead of soft stroke.
      ctx.fillStyle = 'rgba(6,10,19,0.95)';
      for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]]) {
        ctx.fillText(q.str, q.x + ox, q.y + oy);
      }
      ctx.fillStyle = q.color;
      ctx.fillText(q.str, q.x, q.y);
    }
    ctx.restore();
  }
}

function drawTile(ctx, game, c, r, time) {
  const i = r * COLS + c;
  const tile = game.tiles[i];
  const { x, y, w, h } = tileRect(c, r);
  const pal = SIDE_TILE[c < HALF ? 0 : 1];
  // Chunky retro pads with a hard drop-shadow.
  ctx.fillStyle = pal.edge;
  ctx.fillRect(x + 2, y + 5, w, h);
  ctx.fillStyle = pal.fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = pal.line;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = alpha('#ffffff', 0.08);
  ctx.fillRect(x + 4, y + 4, w - 8, 6);
  if (tile.surf) {
  const fade = Math.min(1, tile.t / 0.5);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 2, y + 2, w - 4, h - 4);
  ctx.clip();
  if (tile.surf === 'fire') {
    ctx.fillStyle = `rgba(255,70,20,${0.35 * fade})`;
    ctx.fillRect(x, y, w, h);
    for (let k = 0; k < 12; k++) {
      const px = Math.round(x + 6 + (k % 4) * ((w - 12) / 3));
      const py = Math.round(y + h - 8 - Math.floor(k / 4) * 10 - (Math.floor(time * 8 + k) % 3) * 3);
      ctx.fillStyle = k % 3 === 0 ? `rgba(255,60,10,${0.9 * fade})` : k % 3 === 1 ? `rgba(255,160,30,${0.9 * fade})` : `rgba(255,230,90,${0.85 * fade})`;
      ctx.fillRect(px, py, 8, 8);
    }
  } else if (tile.surf === 'wet') {
    ctx.fillStyle = `rgba(70,160,255,${0.42 * fade})`;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = `rgba(210,235,255,${0.55 * fade})`;
    for (let k = 0; k < 4; k++) {
      const ph = (time * 0.7 + hash(i, k)) % 1;
      const s = Math.round(4 + ph * 14);
      ctx.globalAlpha = 1 - ph;
      ctx.fillRect(Math.round(x + w * hash(i, k + 3) - s / 2), Math.round(y + h * 0.45 - s / 4), s, Math.max(2, s / 3));
    }
  } else if (tile.surf === 'acid') {
    ctx.fillStyle = `rgba(120,200,30,${0.4 * fade})`;
    ctx.fillRect(x, y, w, h);
    // Chunky slime pool with stepped edge
    ctx.fillStyle = `rgba(165,235,60,${0.9 * fade})`;
    ctx.fillRect(x + 14, y + h * 0.5, w - 28, h * 0.32);
    ctx.fillRect(x + 22, y + h * 0.42, w - 44, 8);
    ctx.fillStyle = `rgba(235,255,170,${0.95 * fade})`;
    for (let k = 0; k < 7; k++) {
      const ph = (time * (0.9 + hash(i, k) * 0.5) + hash(i, k + 4)) % 1;
      const s = 3 + Math.floor(ph * 5);
      ctx.globalAlpha = 1 - ph;
      ctx.fillRect(Math.round(x + w * (0.18 + 0.64 * hash(i, k + 8))), Math.round(y + h * (0.72 - ph * 0.28)), s, s);
    }
  } else if (tile.surf === 'frost') {
    ctx.fillStyle = `rgba(200,235,255,${0.55 * fade})`;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = `rgba(255,255,255,${0.85 * fade})`;
    for (let k = 0; k < 10; k++) {
      const cx = Math.round(x + w * hash(i, k + 11));
      const cy = Math.round(y + h * hash(i, k + 17));
      // pixel snowflake: plus + diagonals
      ctx.fillRect(cx - 5, cy, 11, 2);
      ctx.fillRect(cx, cy - 5, 2, 11);
      ctx.fillRect(cx - 3, cy - 3, 2, 2);
      ctx.fillRect(cx + 2, cy - 3, 2, 2);
      ctx.fillRect(cx - 3, cy + 2, 2, 2);
      ctx.fillRect(cx + 2, cy + 2, 2, 2);
    }
  }
  ctx.restore();
  }
  if (tile.wall) drawWall(ctx, x, y, w, h, tile.wall.t, time, i);
}

function drawWall(ctx, x, y, w, h, life, time, i) {
  const fade = Math.min(1, life / 0.6);
  ctx.save();
  const bx = x + 8;
  const by = y + 10;
  const bw = w - 16;
  const bh = h - 18;
  ctx.fillStyle = `rgba(55,42,32,${0.95 * fade})`;
  ctx.fillRect(bx, by, bw, bh);
  const rows = 4;
  const cols = 3;
  const brickH = Math.floor(bh / rows);
  const brickW = Math.floor(bw / cols);
  for (let row = 0; row < rows; row++) {
    const off = row % 2 ? Math.floor(brickW / 2) : 0;
    for (let col = -1; col <= cols; col++) {
      const rx = bx + off + col * brickW;
      const ry = by + row * brickH;
      if (rx + 2 >= bx + bw || rx < bx) continue;
      const shade = 140 + Math.floor(hash(i, row * 7 + col + 3) * 40);
      ctx.fillStyle = `rgba(${shade},${shade - 25},${shade - 45},${0.95 * fade})`;
      const ww = Math.min(brickW - 2, bx + bw - rx - 1);
      if (ww > 2) ctx.fillRect(rx + 1, ry + 1, ww, brickH - 2);
    }
  }
  ctx.strokeStyle = `rgba(30,20,12,${0.9 * fade})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.restore();
}

function drawFlames(ctx, { x, y, w, h }, i, time, fade) {
  const base = y + h - 4;
  // Retro 3-tone fire columns with stepped flicker (no soft gradients).
  for (let k = 0; k < 6; k++) {
    const fx = Math.round(x + w * (0.1 + 0.15 * k) + ((Math.floor(time * 12 + k) % 3) - 1) * 2);
    const fh = Math.round((16 + 16 * hash(i, k)) * (0.65 + 0.35 * ((Math.floor(time * 10 + k * 1.7) % 3) / 2)) * fade);
    const colors = ['#ff2a08', '#ff8c14', '#ffe45a'];
    for (let layer = 0; layer < 3; layer++) {
      const hw = 6 - layer;
      const hh = Math.round(fh * (1 - layer * 0.3));
      ctx.fillStyle = colors[layer];
      ctx.fillRect(fx - hw, base - hh, hw * 2, hh);
      // stepped tip
      ctx.fillRect(fx - Math.max(1, hw - 2), base - hh - 4, Math.max(2, (hw - 2) * 2), 4);
    }
  }
  // ember sparks
  for (let k = 0; k < 4; k++) {
    const ph = (time * 1.8 + hash(i, k + 40)) % 1;
    ctx.fillStyle = `rgba(255,220,80,${(1 - ph) * fade})`;
    ctx.fillRect(Math.round(x + w * hash(i, k + 50)), Math.round(base - ph * h * 0.9), 3, 3);
  }
}

function drawGas(ctx, { x, y, w, h }, i, gas, time) {
  const g = GASES[gas.kind];
  const fade = Math.min(1, gas.t / 0.6);
  for (let k = 0; k < 22; k++) {
    const px = Math.round(x + w * hash(i, k) + Math.sin(time * 1.2 + k) * 4);
    const py = Math.round(y + h * hash(i, k + 9) + Math.cos(time * 0.9 + k) * 3 - 8);
    const s = 4 + Math.floor(hash(i, k + 20) * 6);
    ctx.fillStyle = alpha(g.color, g.alpha * fade * (0.55 + 0.45 * hash(i, k + 3)));
    ctx.fillRect(px, py, s, s);
    ctx.fillStyle = alpha('#ffffff', 0.12 * fade);
    ctx.fillRect(px + 1, py + 1, Math.max(1, s - 3), Math.max(1, Math.floor(s / 3)));
  }
}

function drawTelegraph(ctx, s, time) {
  const color = s.kind === 'gas' ? GASES[s.gas].color : STRIKE_COLOR[s.kind];
  const k = Math.min(1, s.t / s.delay);
  const blink = Math.floor(time * 12) % 2;
  for (const i of s.tiles) {
    const { x, y, w, h } = tileRect(colOf(i), rowOf(i));
    ctx.fillStyle = alpha(color, 0.18 + 0.28 * k);
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.strokeStyle = alpha(color, blink ? 1 : 0.55);
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
    const inset = Math.round((1 - k) * Math.min(w, h) * 0.35);
    ctx.strokeStyle = alpha(color, 0.95);
    ctx.lineWidth = 2;
    ctx.strokeRect(x + inset, y + inset, w - inset * 2, h - inset * 2);
  }
}

// Marks the tile "4 ahead" of a human player: where their aimed recipes land.
function drawAim(ctx, p, time) {
  if (p.hp <= 0) return;
  const { x, y, w, h } = tileRect(p.col + (p.side === 0 ? HALF : -HALF), p.row);
  const color = PLAYER_COLORS[p.id];
  const cx = x + w / 2;
  const cy = y + h / 2;
  const grow = 2 * Math.sin(time * 4);
  ctx.strokeStyle = alpha(color, 0.85);
  ctx.lineWidth = 2;
  const rx = Math.round(20 + grow);
  const ry = Math.round(12 + grow * 0.5);
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * rx, cy + sy * (ry - 7));
    ctx.lineTo(cx + sx * rx, cy + sy * ry);
    ctx.lineTo(cx + sx * (rx - 8), cy + sy * ry);
    ctx.stroke();
  }
  ctx.fillStyle = alpha(color, 0.9);
  ctx.fillRect(Math.round(cx - 2), Math.round(cy - 2), 4, 4);
}

function drawBolt(ctx, b) {
  const row = tileCenter(0, b.row).y - 26;
  const whole = Math.max(0, Math.min(COLS - 1, Math.floor(b.x)));
  const next = Math.min(COLS - 1, whole + 1);
  const x0 = tileCenter(whole, b.row).x;
  const x = x0 + (tileCenter(next, b.row).x - x0) * Math.max(0, Math.min(1, b.x - whole));
  const color = BOLT_COLOR[b.kind] || '#e9f6ff';
  const ix = Math.round(x);
  const iy = Math.round(row);
  // Square trail + diamond tip reads as retro projectile.
  for (let t = 0; t < 7; t++) {
    const px = ix - b.dir * t * 8;
    const s = 8 - Math.floor(t / 2);
    ctx.fillStyle = alpha(color, 1 - t * 0.12);
    ctx.fillRect(px - s / 2, iy - s / 2, s, s);
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(ix - 4, iy - 2, 8, 4);
  ctx.fillRect(ix - 2, iy - 4, 4, 8);
  ctx.fillStyle = color;
  ctx.fillRect(ix - 2, iy - 2, 4, 4);
}

// A ring over a chemist's head for each pot that is mid-reaction, so both
// players can read what is coming and when.
function drawBrewing(ctx, p, pos) {
  if (p.hp <= 0) return;
  const brewing = p.pots.filter((pot) => pot.state === 'reacting' && pot.total > 0);
  brewing.forEach((pot, k) => {
    const x = Math.round(pos.x + (k - (brewing.length - 1) / 2) * 48);
    const y = Math.round(pos.y - TILE_H - 28);
    const frac = Math.min(1, pot.t / pot.total);
    // Pixel cast meter
    ctx.fillStyle = '#0a1018';
    ctx.fillRect(x - 24, y - 12, 48, 24);
    ctx.fillStyle = '#2a3650';
    ctx.fillRect(x - 24, y - 12, 48, 2);
    ctx.fillRect(x - 24, y - 12, 2, 24);
    ctx.strokeStyle = '#4a5a78';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 23.5, y - 11.5, 47, 23);
    ctx.fillStyle = '#060a13';
    ctx.fillRect(x - 20, y + 6, 40, 4);
    ctx.fillStyle = pot.recipe ? PLAYER_COLORS[p.id] : '#8b97ad';
    ctx.fillRect(x - 20, y + 6, Math.round(40 * frac), 4);
    // segment ticks on meter
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let s = 1; s < 4; s++) ctx.fillRect(x - 20 + s * 10, y + 6, 1, 4);
    const label = pot.recipe ? pot.recipe.label : '?';
    const long = label.length > 5;
    text(ctx, long ? `${Math.ceil(pot.total - pot.t)}` : label, x, y, {
      size: long ? 11 : label.length > 4 ? 8 : 10, color: '#ffffff', align: 'center', baseline: 'middle',
    });
    if (long) text(ctx, label, x, y - 20, { size: 9, color: '#ffffff', align: 'center', baseline: 'middle' });
  });
}
