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

export const PLAYER_COLORS = ['#35d6c5', '#ff7d5c'];

export function tileRect(c, r) {
  return {
    x: FIELD_X + c * (TILE_W + GAP) + (c >= HALF ? MID_GAP - GAP : 0),
    y: FIELD_Y + r * (TILE_H + GAP),
    w: TILE_W,
    h: TILE_H,
  };
}

export function tileCenter(c, r) {
  const t = tileRect(c, r);
  return { x: t.x + t.w / 2, y: t.y + t.h / 2 };
}
