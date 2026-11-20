// Where everything sits on the 1280x720 logical canvas.
import { COLS, ROWS, HALF } from '../data.js';

export const W = 1280;
export const H = 720;

export const TILE_W = 112;
export const TILE_H = 74;
export const GAP = 6;
export const MID_GAP = 22; // wider gutter between the two halves

const FIELD_W = COLS * TILE_W + (COLS - 2) * GAP + MID_GAP;
export const FIELD_X = Math.round((W - FIELD_W) / 2);
export const FIELD_Y = 136;
export const FIELD_BOTTOM = FIELD_Y + ROWS * TILE_H + (ROWS - 1) * GAP;

export const PANEL_Y = FIELD_BOTTOM + 14;
export const PANEL_H = H - PANEL_Y - 10;
export const PANEL_W = 610;
export const PANEL_X = [20, W - 20 - PANEL_W];

// Index 0 = blue (you / left), 1 = red (foe / right). Online remaps so each
// client always paints themselves blue and the opponent red.
export const PLAYER_COLORS = ['#3d8bfd', '#ff5c5c'];

// Per-frame view perspective for online: flip the board so the local player
// is always on the left, and color by local vs foe instead of absolute pid.
let _flip = false;
let _localPid = null;

export function beginView({ flip = false, localPid = null } = {}) {
  _flip = !!flip;
  _localPid = localPid == null ? null : localPid;
}

export function endView() {
  _flip = false;
  _localPid = null;
}

export function viewFlipped() {
  return _flip;
}

export function viewCol(c) {
  return _flip ? COLS - 1 - c : c;
}

export function viewX(x) {
  return _flip ? COLS - 1 - x : x;
}

export function viewDir(dir) {
  return _flip ? -dir : dir;
}

export function viewFacing(face) {
  return _flip ? -face : face;
}

/** Screen slot 0 = left, 1 = right. Online: local always left. */
export function viewSlot(pid) {
  if (_localPid == null) return pid;
  return pid === _localPid ? 0 : 1;
}

export function playerColor(pid) {
  return PLAYER_COLORS[viewSlot(pid)];
}

export function tileRect(c, r) {
  const vc = viewCol(c);
  return {
    x: FIELD_X + vc * (TILE_W + GAP) + (vc >= HALF ? MID_GAP - GAP : 0),
    y: FIELD_Y + r * (TILE_H + GAP),
    w: TILE_W,
    h: TILE_H,
  };
}

export function tileCenter(c, r) {
  const t = tileRect(c, r);
  return { x: t.x + t.w / 2, y: t.y + t.h / 2 };
}
