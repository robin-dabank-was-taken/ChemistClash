// Small canvas helpers shared by every screen. Pixel-forward for HUD/FX.
import { ELEMENTS } from '../data.js';

// Monospace reads closer to RPG Maker / retro UI than soft sans.
const FAMILY = '"Lucida Console", "Cascadia Mono", "Consolas", "Courier New", monospace';
export const font = (size, weight = 700) => `${weight} ${size}px ${FAMILY}`;

export function rr(ctx, x, y, w, h, r) {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

/** Sharp pixel panel with chunky border (no soft radius). */
export function pxPanel(ctx, x, y, w, h, { fill = '#121820', edge = '#2a3650', lit = '#4a5a78' } = {}) {
  ctx.fillStyle = edge;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  ctx.fillStyle = lit;
  ctx.fillRect(x + 2, y + 2, w - 4, 2);
  ctx.fillRect(x + 2, y + 2, 2, h - 4);
}

export function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

export function hash(a, b = 0) {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function alpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function text(ctx, str, x, y, { size = 14, weight = 700, color = '#fff', align = 'left', baseline = 'alphabetic' } = {}) {
  ctx.font = font(size, weight);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(str, x, y);
}

export function wrap(ctx, str, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of str.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function formula(ctx, parts, x, y, size, { align = 'left', color = null } = {}) {
  const big = font(size);
  const small = font(Math.round(size * 0.66));
  const segs = [];
  let width = 0;
  for (const [el, n] of parts) {
    ctx.font = big;
    const sw = ctx.measureText(el).width;
    let nw = 0;
    if (n > 1) {
      ctx.font = small;
      nw = ctx.measureText(String(n)).width + 1;
    }
    segs.push({ el, n, sw, nw });
    width += sw + nw;
  }
  let cx = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  for (const seg of segs) {
    ctx.fillStyle = color || ELEMENTS[seg.el].text;
    ctx.font = big;
    ctx.fillText(seg.el, cx, y);
    cx += seg.sw;
    if (seg.n > 1) {
      ctx.font = small;
      ctx.fillText(String(seg.n), cx + 0.5, y + size * 0.24);
      cx += seg.nw;
    }
  }
  return width;
}

export function elementTile(ctx, el, x, y, w, h, { dim = false } = {}) {
  const e = ELEMENTS[el];
  ctx.save();
  if (dim) ctx.globalAlpha *= 0.35;
  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(x + 2, y + 3, w, h);
  // Flat pixel tile
  ctx.fillStyle = e.color;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = alpha('#ffffff', 0.22);
  ctx.fillRect(x, y, w, 4);
  ctx.fillStyle = alpha('#000000', 0.22);
  ctx.fillRect(x, y + h - 4, w, 4);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  text(ctx, String(e.z), x + 5, y + 13, { size: 10, color: alpha(e.ink, 0.75) });
  text(ctx, el, x + w / 2, y + h * 0.58, { size: Math.round(h * 0.42), color: e.ink, align: 'center', baseline: 'middle' });
  ctx.restore();
}

export function atom(ctx, el, x, y, r, { dim = false } = {}) {
  const e = ELEMENTS[el];
  const s = Math.max(6, Math.round(r * 2));
  ctx.save();
  if (dim) ctx.globalAlpha *= 0.3;
  ctx.fillStyle = e.color;
  ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
  ctx.fillStyle = alpha('#ffffff', 0.3);
  ctx.fillRect(Math.round(x - s / 2) + 1, Math.round(y - s / 2) + 1, Math.max(1, s - 4), 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(x - s / 2) + 0.5, Math.round(y - s / 2) + 0.5, s - 1, s - 1);
  text(ctx, el, x, y + 0.5, { size: Math.round(r * (el.length > 1 ? 1.0 : 1.2)), color: e.ink, align: 'center', baseline: 'middle' });
  ctx.restore();
}

export function keycap(ctx, label, x, y, w = 24, h = 20, { lit = false } = {}) {
  ctx.fillStyle = '#060a13';
  ctx.fillRect(x, y + 2, w, h);
  ctx.fillStyle = lit ? '#f4f7fb' : '#243044';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = lit ? '#ffffff' : '#3a4a68';
  ctx.fillRect(x, y, w, 2);
  ctx.strokeStyle = lit ? '#ffffff' : '#5a6a8c';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  text(ctx, label, x + w / 2, y + h / 2 + 1, {
    size: Math.round(h * 0.55), color: lit ? '#0d1321' : '#dbe6f7', align: 'center', baseline: 'middle',
  });
}
