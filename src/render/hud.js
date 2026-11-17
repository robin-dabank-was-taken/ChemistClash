// Everything around the board: health bars, lab thermometers, and each
// player's panel (two pots, recipe hints, hotbar). Retro-pixel HUD.
import { findRecipe, countAtoms, hillParts } from '../data.js';
import { TUNE, reactionRate } from '../sim/world.js';
import { suggest, hasFuture } from '../hints.js';
import { W, FIELD_X, FIELD_Y, FIELD_BOTTOM, PANEL_X, PANEL_Y, PANEL_W, PANEL_H, PLAYER_COLORS } from './layout.js';
import { pxPanel, alpha, text, font, formula, elementTile, atom, keycap } from './draw.js';

const BAR_W = 500;
const INK = '#dbe6f7';
const DIM = '#7f8da6';

export function drawTopBar(ctx, game, view) {
  for (const p of game.players) {
    const right = p.id === 1;
    const x = right ? W - 24 - BAR_W : 24;
    const color = PLAYER_COLORS[p.id];
    const title = p.character ? `${p.name} · ${p.character.name}` : p.name;
    text(ctx, title.toUpperCase(), right ? x + BAR_W : x, 30, { size: 13, color, align: right ? 'right' : 'left' });

    // Pixel HP tray
    pxPanel(ctx, x, 38, BAR_W, 26, { fill: '#0a1018', edge: '#1a2438', lit: alpha(color, 0.55) });
    const innerW = BAR_W - 8;
    const lagW = Math.max(0, Math.round(innerW * (view.hpLag[p.id] / TUNE.maxHp)));
    const hpW = Math.max(0, Math.round(innerW * (p.hp / TUNE.maxHp)));
    const barX = right ? x + BAR_W - 4 - lagW : x + 4;
    const hpX = right ? x + BAR_W - 4 - hpW : x + 4;
    if (lagW > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(barX, 44, lagW, 14);
    }
    if (hpW > 0) {
      ctx.fillStyle = p.hp <= 30 ? '#ff5468' : color;
      ctx.fillRect(hpX, 44, hpW, 14);
      // segment ticks
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let s = 1; s < 10; s++) {
        const tx = x + 4 + Math.round((innerW * s) / 10);
        ctx.fillRect(tx, 44, 2, 14);
      }
      ctx.fillStyle = alpha('#ffffff', 0.25);
      ctx.fillRect(hpX, 44, hpW, 3);
    }
    text(ctx, `${Math.ceil(p.hp)}/${TUNE.maxHp}`, right ? x + 10 : x + BAR_W - 10, 51, {
      size: 11, color: '#ffffff', align: right ? 'left' : 'right', baseline: 'middle',
    });

    const chips = [];
    if (p.shield > 0) chips.push([`SHIELD ${Math.ceil(p.shield)}`, '#7fdcff']);
    if (p.haste > 0) chips.push(['HASTE', '#ffe169']);
    if (p.stun > 0) chips.push(['K.O.', '#d9c2ff']);
    if (p.frozen > 0) chips.push(['FROZEN', '#ffffff']);
    else if (p.chill > 0) chips.push(['CHILL', '#a8dcff']);
    if (p.giddy > 0) chips.push(['GIDDY', '#f6a5ef']);
    let cx = right ? x + BAR_W : x;
    for (const [label, chipColor] of chips) {
      ctx.font = font(10);
      const cw = Math.ceil(ctx.measureText(label).width) + 14;
      const left = right ? cx - cw : cx;
      ctx.fillStyle = alpha(chipColor, 0.18);
      ctx.fillRect(left, 70, cw, 16);
      ctx.strokeStyle = alpha(chipColor, 0.85);
      ctx.lineWidth = 2;
      ctx.strokeRect(left + 1, 71, cw - 2, 14);
      text(ctx, label, left + cw / 2, 78.5, { size: 10, color: chipColor, align: 'center', baseline: 'middle' });
      cx += (right ? -1 : 1) * (cw + 4);
    }
  }

  const secs = Math.floor(game.time);
  // Pixel clock plate
  pxPanel(ctx, W / 2 - 54, 28, 108, 42, { fill: '#0c121c', edge: '#243044', lit: '#3a4a68' });
  text(ctx, `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, W / 2, 48, { size: 22, color: INK, align: 'center' });
  text(ctx, 'TAB · ESC', W / 2, 64, { size: 9, color: DIM, align: 'center' });
}

export function drawThermometers(ctx, game) {
  for (const p of game.players) {
    const cx = p.id === 0 ? FIELD_X / 2 : W - FIELD_X / 2;
    const top = FIELD_Y + 40;
    const bottom = FIELD_BOTTOM - 62;
    const mid = (top + bottom) / 2;
    const rate = reactionRate(game, p);
    const level = Math.max(-1, Math.min(1, Math.log2(rate)));
    const hot = rate > 1.001;
    const cold = rate < 0.999;
    const color = hot ? '#ff8a3c' : cold ? '#7cc6ff' : '#c5d2e6';

    text(ctx, 'LAB TEMP', cx, FIELD_Y + 12, { size: 10, color: DIM, align: 'center' });
    text(ctx, 'HOT', cx, top - 8, { size: 9, color: alpha('#ff8a3c', hot ? 1 : 0.45), align: 'center' });
    text(ctx, 'COLD', cx, bottom + 16, { size: 9, color: alpha('#7cc6ff', cold ? 1 : 0.45), align: 'center' });

    pxPanel(ctx, cx - 10, top, 20, bottom - top, { fill: '#0a1018', edge: '#1a2438', lit: '#2a3650' });
    if (level !== 0) {
      const y = mid - level * (mid - top - 4);
      const h = Math.abs(y - mid);
      ctx.fillStyle = color;
      ctx.fillRect(cx - 6, Math.min(y, mid), 12, Math.max(2, h));
      // pixel notches
      ctx.fillStyle = alpha('#ffffff', 0.25);
      for (let n = 0; n < h; n += 6) ctx.fillRect(cx - 6, Math.min(y, mid) + n, 12, 2);
    }
    ctx.fillStyle = '#c5d2e6';
    ctx.fillRect(cx - 12, mid - 1, 24, 2);

    text(ctx, 'RATE', cx, bottom + 38, { size: 9, color: DIM, align: 'center' });
    text(ctx, `x${rate.toFixed(2)}`, cx, bottom + 56, { size: 15, color, align: 'center' });
  }
}

export function drawPanel(ctx, p, keys, view, time) {
  const x = PANEL_X[p.id];
  const y = PANEL_Y;
  const color = PLAYER_COLORS[p.id];
  pxPanel(ctx, x, y, PANEL_W, PANEL_H, {
    fill: 'rgba(10,14,22,0.94)', edge: alpha(color, 0.55), lit: alpha(color, 0.35),
  });

  for (let k = 0; k < 2; k++) drawPot(ctx, p, k, x + 12 + k * 138, y + 10, keys, view.potPulse[p.id][k], time);
  drawHints(ctx, p, x + 294, y + 10, PANEL_W - 306);
  drawHotbar(ctx, p, x + 12, y + 160, keys);

  const lx = x + 396;
  if (keys) {
    const legend = keys.potA
      ? [[keys.potA, 'pot A'], [keys.potB, 'pot B'], [keys.run, 'confirm'], [keys.clear, 'empty']]
      : [[keys.toggle, 'switch'], [keys.run, 'confirm'], [keys.clear, 'empty']];
    legend.forEach(([cap, label], n) => {
      keycap(ctx, cap, lx, y + 152 + n * 20, 24, 16);
      text(ctx, label, lx + 30, y + 160 + n * 20, { size: 10, color: INK, baseline: 'middle' });
    });
    text(ctx, `${keys.move} move`, lx + 110, y + 160, { size: 10, color: DIM, baseline: 'middle' });
  } else {
    text(ctx, 'COMPUTER', lx, y + 176, { size: 12, color });
    text(ctx, 'Watch its pots', lx, y + 194, { size: 10, color: DIM, weight: 400 });
  }
}

const POT_W = 130;
const POT_H = 140;
const ATOM_SPOTS = [[-24, 84], [0, 84], [24, 84], [-24, 65], [0, 65], [24, 65], [-24, 46], [0, 46], [24, 46]];
const MAX_LOOSE = ATOM_SPOTS.length;

function drawPot(ctx, p, k, x, y, keys, pulse, time) {
  const pot = p.pots[k];
  const color = PLAYER_COLORS[p.id];
  const active = p.activePot === k;
  const reacting = pot.state === 'reacting';
  const ready = !reacting && pot.atoms.length ? findRecipe(pot.atoms) : null;
  const cx = x + POT_W / 2;

  pxPanel(ctx, x, y, POT_W, POT_H, {
    fill: active ? alpha(color, 0.12) : '#0c121c',
    edge: active ? color : '#243044',
    lit: active ? alpha(color, 0.5) : '#2a3650',
  });
  text(ctx, `POT ${'AB'[k]}`, x + 8, y + 16, { size: 10, color: active ? color : DIM });
  if (keys) {
    if (active) keycap(ctx, keys.run, x + POT_W - 28, y + 6, 20, 16, { lit: !!ready && Math.sin(time * 8) > -0.3 });
    else {
      const cap = keys.potA ? (k === 0 ? keys.potA : keys.potB) : keys.toggle;
      keycap(ctx, cap, x + POT_W - 28, y + 6, 20, 16);
    }
  }

  // Pixel beaker silhouette
  const bx = cx - 36;
  const by = y + 28;
  const bw = 72;
  const bh = 70;
  ctx.fillStyle = 'rgba(180,210,240,0.08)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = 'rgba(220,238,255,0.75)';
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, bw, bh);
  // rim
  ctx.fillStyle = 'rgba(220,238,255,0.35)';
  ctx.fillRect(bx - 4, by - 4, bw + 8, 4);

  if (pot.atoms.length) {
    const depth = pot.atoms.length <= MAX_LOOSE ? 14 + pot.atoms.length * 5 : 28 + Math.floor((new Set(pot.atoms).size - 1) / 2) * 14;
    const level = by + bh - depth - pulse * 3;
    ctx.fillStyle = reacting ? alpha(color, 0.5 + 0.15 * Math.sin(time * 12)) : ready ? alpha(color, 0.32) : 'rgba(110,160,255,0.2)';
    ctx.fillRect(bx + 2, level, bw - 4, by + bh - 2 - level);
    if (reacting) {
      for (let b = 0; b < 5; b++) {
        const ph = (time * 1.5 + b * 0.2) % 1;
        const s = 2 + (b % 2);
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillRect(bx + 8 + b * 12, Math.round(by + bh - 6 - ph * (depth + 8)), s, s);
      }
    }
  }

  const loose = pot.atoms.length <= MAX_LOOSE;
  const groups = loose ? [] : hillParts(countAtoms(pot.atoms));
  const wobble = (n) => (reacting ? Math.sin(time * 16 + n * 2) * 2 : 0);
  const last = pot.atoms.length - 1;
  if (loose) {
    pot.atoms.forEach((el, n) => {
      const [dx, dy] = ATOM_SPOTS[n];
      atom(ctx, el, cx + dx + wobble(n), y + dy - (n === last ? pulse * 5 : 0), 9);
    });
  } else {
    groups.forEach(([el, count], n) => {
      const ax = cx - 28 + (n % 2) * 37 + wobble(n);
      const ay = y + 85 - Math.floor(n / 2) * 16 - (el === pot.atoms[last] ? pulse * 4 : 0);
      atom(ctx, el, ax, ay, 7);
      text(ctx, String(count), ax + 10, ay + 0.5, { size: 10, color: '#ffffff', baseline: 'middle' });
    });
  }

  const recipe = reacting ? pot.recipe : ready;
  if (pot.atoms.length) {
    const parts = recipe ? recipe.parts : hillParts(countAtoms(pot.atoms));
    const chars = parts.reduce((n, [el, count]) => n + el.length + (count > 1 ? String(count).length : 0), 0);
    formula(ctx, parts, cx, y + 116, Math.max(8, Math.min(14, Math.floor(200 / chars))), { align: 'center' });
  }
  let label = 'empty';
  let labelColor = DIM;
  if (reacting) {
    label = pot.recipe ? pot.recipe.name : 'fizzle…';
    labelColor = pot.recipe ? color : '#9aa7bd';
    const frac = pot.total > 0 ? Math.min(1, pot.t / pot.total) : 1;
    ctx.fillStyle = '#060a13';
    ctx.fillRect(x + 10, y + POT_H - 8, POT_W - 20, 4);
    ctx.fillStyle = labelColor;
    ctx.fillRect(x + 10, y + POT_H - 8, Math.round((POT_W - 20) * frac), 4);
  } else if (ready) {
    label = ready.name;
    labelColor = '#ffffff';
  } else if (pot.atoms.length) {
    const alive = hasFuture(pot.atoms);
    label = alive ? 'mixing…' : 'will fizzle';
    labelColor = alive ? DIM : '#ff7b8a';
  }
  text(ctx, label, cx, y + 130, { size: 10, color: labelColor, align: 'center' });
}

function drawHints(ctx, p, x, y, w) {
  const pot = p.pots[p.activePot];
  text(ctx, `POT ${'AB'[p.activePot]} CAN BECOME`, x, y + 12, { size: 9, color: DIM });
  if (pot.state === 'reacting') {
    text(ctx, 'Reacting. Switch pots to keep mixing.', x, y + 34, { size: 10, color: DIM, weight: 400 });
    return;
  }
  const list = suggest(p);
  if (!list.length) {
    const done = pot.atoms.length && findRecipe(pot.atoms);
    text(ctx, done ? 'Complete. Confirm to react!' : 'Nothing. Empty the pot.', x, y + 34, { size: 10, color: DIM, weight: 400 });
    return;
  }
  list.forEach((hint, n) => {
    const ly = y + 34 + n * 20;
    const now = hint.lacking === 0;
    if (now) {
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fillRect(x - 4, ly - 12, w + 6, 16);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.strokeRect(x - 4, ly - 12, w + 6, 16);
    }
    ctx.globalAlpha = now ? 1 : 0.55;
    formula(ctx, hint.recipe.parts, x, ly, hint.recipe.parts.length > 3 ? 10 : 12);
    text(ctx, hint.recipe.name, x + 76, ly, { size: 10, color: now ? '#ffffff' : '#c5d2e6', weight: now ? 700 : 400 });
    ctx.globalAlpha = 1;
    let nx = x + w;
    for (let g = hint.needs.length - 1; g >= 0; g--) {
      const need = hint.needs[g];
      const have = need.inHand === need.n;
      if (need.n > 1) {
        text(ctx, String(need.n), nx, ly, { size: 9, color: have ? INK : DIM, align: 'right' });
        nx -= need.n > 9 ? 12 : 8;
      }
      atom(ctx, need.el, nx - 7, ly - 4, 6.5, { dim: !have });
      nx -= 18;
    }
  });
}

function drawHotbar(ctx, p, x, y, keys) {
  p.hotbar.forEach((slot, i) => {
    const sx = x + i * 74;
    elementTile(ctx, slot.el, sx, y, 66, 52);
    if (keys) keycap(ctx, keys.slots[i], sx + 22, y + 58, 22, 15);
  });
}
