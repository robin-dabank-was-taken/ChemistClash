// Board chemists: RPG Maker MZ–style sprites.
// Clean state machine: idle / walk / cast / hurt / death — minimal motion FX.
import { getCharacter } from '../characters.js';
import { playerColor, viewFacing } from './layout.js';
import { alpha, text } from './draw.js';
import { getPortrait, getWalkSheet, getPoseSheet, POSE } from './sprites.js';

// Native sheet frame height is 96px — draw 1:1 to avoid nearest-neighbor holes.
const DRAW_H = 96;
const WALK_FRAMES = 3;
const POSE_FRAMES = 4;
// Walk progress 0..1 → sheet frames (plant → step → plant → step)
const WALK_ORDER = [1, 0, 1, 2];

export function drawChemist(ctx, p, pos, time, anim = null) {
  const ch = p.character || getCharacter(p.characterId);
  const color = playerColor(p.id);
  const facing = viewFacing(anim?.face ?? (p.side === 0 ? 1 : -1));
  const state = anim?.state || (p.hp <= 0 ? 'death' : 'idle');
  const walkSheet = getWalkSheet(ch.id);
  const poseSheet = getPoseSheet(ch.id);

  // Tiny idle bob only; other states stay planted.
  const bob = state === 'idle' ? Math.sin(time * 2.2 + p.id) * 0.6 : 0;
  const hurtFlash = state === 'hurt' && Math.floor(time * 16) % 2 === 0;

  ctx.save();
  ctx.translate(Math.round(pos.x), Math.round(pos.y + bob));

  // Flat pixel shadow
  const sw = state === 'death' ? 22 : 14;
  ctx.fillStyle = `rgba(0,0,0,${state === 'death' ? 0.25 : 0.38})`;
  ctx.fillRect(Math.round(-sw / 2), 2, sw, 3);

  if (p.haste > 0 && state !== 'death') {
    ctx.fillStyle = alpha('#fff3a8', 0.8);
    for (let k = 0; k < 2; k++) {
      const off = Math.floor(((time * 3.5 + k / 2) % 1) * 8);
      ctx.fillRect(Math.round(-facing * (14 + off) - 3), -18 - k * 10, 6, 2);
    }
  }

  ctx.save();
  ctx.scale(facing, 1);
  if (hurtFlash) ctx.globalAlpha = 0.45;

  if (!drawStateSprite(ctx, state, anim, walkSheet, poseSheet)) {
    drawFallback(ctx, ch, color);
  }
  ctx.restore();

  // Cast: a few rising pixels near the hands — no orbit clutter.
  if (state === 'cast') {
    const accent = ch.accent || color;
    for (let k = 0; k < 3; k++) {
      const ph = (time * 1.8 + k * 0.33) % 1;
      ctx.globalAlpha = 1 - ph;
      ctx.fillStyle = accent;
      ctx.fillRect(Math.round(facing * (10 + k * 3)), Math.round(-78 - ph * 18), 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  if (state === 'hurt' && !hurtFlash) {
    ctx.fillStyle = 'rgba(255,70,70,0.22)';
    ctx.fillRect(-18, -DRAW_H + 10, 36, DRAW_H - 14);
  }

  if (state !== 'death') {
    drawStatusOverlay(ctx, p, time);
    ctx.fillStyle = alpha(color, 0.9);
    ctx.fillRect(-2, 6, 4, 2);
  }

  ctx.restore();
}

function drawStatusOverlay(ctx, p, time) {
  if (p.frozen > 0) {
    ctx.fillStyle = 'rgba(175,228,255,0.35)';
    ctx.fillRect(-22, -DRAW_H + 8, 44, DRAW_H - 10);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let k = 0; k < 3; k++) {
      const cx = -10 + k * 10;
      ctx.fillRect(cx, -66, 5, 2);
      ctx.fillRect(cx + 2, -68, 2, 5);
    }
  } else if (p.chill > 0) {
    ctx.fillStyle = 'rgba(150,215,255,0.14)';
    ctx.fillRect(-20, -DRAW_H + 10, 40, DRAW_H - 12);
  }
  if (p.shield > 0) {
    ctx.strokeStyle = Math.floor(time * 6) % 2 ? '#9fe8ff' : '#5db8ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(-22, -DRAW_H + 8, 44, DRAW_H - 10);
  }
  if (p.stun > 0) {
    for (let k = 0; k < 2; k++) {
      const ph = (time * 0.7 + k / 2) % 1;
      ctx.globalAlpha = 1 - ph;
      text(ctx, 'z', 10 + ph * 10, -DRAW_H + 12 - ph * 16, {
        size: 10 + ph * 4, color: '#d9c2ff', align: 'center', baseline: 'middle',
      });
    }
    ctx.globalAlpha = 1;
  }
  if (p.giddy > 0) {
    for (let k = 0; k < 3; k++) {
      const a = time * 4 + (k * Math.PI * 2) / 3;
      ctx.fillStyle = '#f6a5ef';
      ctx.fillRect(Math.round(Math.cos(a) * 14 - 1), Math.round(-DRAW_H + 10 + Math.sin(a) * 3), 3, 3);
    }
  }
}

function drawStateSprite(ctx, state, anim, walkSheet, poseSheet) {
  // Idle uses the dedicated standing pose — never a walk-cycle frame.
  if (state === 'idle' && poseSheet) {
    drawSheetFrame(ctx, poseSheet, POSE.idle, POSE_FRAMES, DRAW_H);
    return true;
  }
  if (state === 'walk' && walkSheet) {
    const i = Math.min(3, Math.floor((anim?.phase || 0) * 4));
    drawSheetFrame(ctx, walkSheet, WALK_ORDER[i], WALK_FRAMES, DRAW_H);
    return true;
  }
  if (poseSheet && (state === 'cast' || state === 'hurt' || state === 'death')) {
    const pose = state === 'cast' ? POSE.cast : state === 'hurt' ? POSE.hurt : POSE.death;
    drawSheetFrame(ctx, poseSheet, pose, POSE_FRAMES, DRAW_H);
    return true;
  }
  if (poseSheet) {
    drawSheetFrame(ctx, poseSheet, POSE.idle, POSE_FRAMES, DRAW_H);
    return true;
  }
  if (walkSheet) {
    drawSheetFrame(ctx, walkSheet, 1, WALK_FRAMES, DRAW_H);
    return true;
  }
  return false;
}

function drawSheetFrame(ctx, sheet, frame, frameCount, drawH) {
  const fw = Math.floor(sheet.naturalWidth / frameCount);
  const fh = sheet.naturalHeight;
  const drawW = Math.round(drawH * (fw / fh));
  const sx = Math.max(0, Math.min(frameCount - 1, frame | 0)) * fw;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheet, sx, 0, fw, fh, Math.round(-drawW / 2), Math.round(-drawH + 4), drawW, drawH);
}

function drawFallback(ctx, ch, color) {
  const skin = ch.skin || '#f3caa2';
  const hair = ch.hair || '#2a2438';
  const coat = ch.coat || '#eef3fa';
  const accent = ch.accent || color;
  ctx.fillStyle = '#2a3144';
  ctx.fillRect(-8, -10, 5, 10);
  ctx.fillRect(3, -10, 5, 10);
  ctx.fillStyle = coat;
  ctx.fillRect(-10, -28, 20, 20);
  ctx.fillStyle = accent;
  ctx.fillRect(-8, -30, 16, 4);
  ctx.fillStyle = skin;
  ctx.fillRect(-9, -48, 18, 18);
  ctx.fillStyle = hair;
  ctx.fillRect(-10, -52, 20, 8);
}

export function drawPortrait(ctx, character, x, y, size) {
  const img = getPortrait(character.id);
  const left = x - size / 2;
  const top = y - size / 2;
  if (img && img.complete && img.naturalWidth) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, size, size);
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, left, top, size, size);
    ctx.restore();
  } else {
    ctx.save();
    ctx.translate(x, y + size * 0.35);
    ctx.scale(size / 100, size / 100);
    drawChemist(ctx, {
      id: 0, side: 0, hp: 100, hurtT: 0, haste: 0, chill: 0, frozen: 0, shield: 0, stun: 0, giddy: 0,
      character, characterId: character.id,
    }, { x: 0, y: 0 }, 0, { moving: false, phase: 0, face: 1, state: 'idle', deathT: 0, castT: 0 });
    ctx.restore();
  }
  ctx.strokeStyle = character.accent;
  ctx.lineWidth = 3;
  ctx.strokeRect(left, top, size, size);
}
