// Full-screen layers: backdrop, main menu, how-to-play, recipe book, and the
// overlays shown during a match (countdown, pause, result).
import { ELEMENTS, ELEMENT_ORDER, RECIPES, TRUMP_ID } from '../data.js';
import { CHARACTERS } from '../characters.js';
import { drawPortrait } from './chemist.js';
import { W, H, FIELD_Y, FIELD_BOTTOM, PLAYER_COLORS } from './layout.js';
import { rr, circle, hash, alpha, text, font, wrap, formula, keycap } from './draw.js';

const INK = '#dbe6f7';
const DIM = '#7f8da6';
const AIM_LABEL = { row: 'YOUR ROW', mirror: '4 AHEAD', self: 'SELF', field: 'ENEMY SIDE' };
const TAG_COLOR = { attack: '#ff8f7a', zone: '#c9a5ff', wall: '#c4b49a', shield: '#7fdcff', heal: '#7dffa0', support: '#ffe169', nuke: '#ffd24a' };

let backdrop = null;

function paintBottle(b, x, y, w, h, liquid, cap) {
  b.fillStyle = 'rgba(190,210,225,0.35)';
  b.fillRect(x, y, w, h);
  b.fillStyle = liquid;
  b.fillRect(x + 1, y + Math.floor(h * 0.35), w - 2, Math.floor(h * 0.55));
  b.fillStyle = 'rgba(255,255,255,0.35)';
  b.fillRect(x + 1, y + 2, Math.max(1, Math.floor(w * 0.28)), h - 4);
  b.fillStyle = cap;
  b.fillRect(x + Math.floor(w * 0.2), y - 5, Math.max(2, Math.floor(w * 0.6)), 5);
  b.fillStyle = 'rgba(255,255,255,0.2)';
  b.fillRect(x + Math.floor(w * 0.25), y - 4, Math.max(1, Math.floor(w * 0.3)), 2);
}

export function drawBackdrop(ctx) {
  if (!backdrop) {
    backdrop = document.createElement('canvas');
    backdrop.width = W;
    backdrop.height = H;
    const b = backdrop.getContext('2d');
    // Photoreal-leaning lab room painted once and cached.
    const ceil = b.createLinearGradient(0, 0, 0, 150);
    ceil.addColorStop(0, '#232830');
    ceil.addColorStop(0.55, '#343c46');
    ceil.addColorStop(1, '#3f4752');
    b.fillStyle = ceil;
    b.fillRect(0, 0, W, 150);

    // acoustic ceiling tiles
    b.strokeStyle = 'rgba(0,0,0,0.18)';
    b.lineWidth = 1;
    for (let row = 0; row < 4; row++) {
      const y = 18 + row * 28;
      b.beginPath();
      b.moveTo(0, y);
      b.lineTo(W, y);
      b.stroke();
      for (let col = 0; col < 12; col++) {
        b.strokeRect(col * 110 + 8, y, 104, 26);
      }
    }
    // conduit / pipes along the ceiling
    b.fillStyle = '#6a7380';
    b.fillRect(0, 8, W, 6);
    b.fillStyle = '#8a94a0';
    b.fillRect(0, 8, W, 2);
    b.fillStyle = '#4a5562';
    b.fillRect(220, 0, 14, 150);
    b.fillRect(920, 0, 10, 150);
    b.fillStyle = 'rgba(255,255,255,0.08)';
    b.fillRect(222, 0, 3, 150);

    // plaster back wall with warm daylight wash
    const wall = b.createLinearGradient(0, 140, 0, 420);
    wall.addColorStop(0, '#5a6572');
    wall.addColorStop(0.4, '#4a5563');
    wall.addColorStop(1, '#343c48');
    b.fillStyle = wall;
    b.fillRect(0, 140, W, 285);
    for (let i = 0; i < 3200; i++) {
      const x = Math.random() * W;
      const y = 145 + Math.random() * 275;
      b.fillStyle = `rgba(${200 + Math.random() * 40},${205 + Math.random() * 30},${210},${0.012 + Math.random() * 0.02})`;
      b.fillRect(x, y, 1 + Math.random() * 2.5, 1);
    }
    // painted wainscot band
    b.fillStyle = '#2f3742';
    b.fillRect(0, 360, W, 52);
    b.fillStyle = 'rgba(255,255,255,0.06)';
    b.fillRect(0, 360, W, 2);
    b.fillStyle = 'rgba(0,0,0,0.2)';
    b.fillRect(0, 410, W, 2);

    // fluorescent fixtures with soft pools of light
    for (const lx of [160, 430, 700, 980, 1180]) {
      b.fillStyle = '#1a2028';
      b.fillRect(lx - 78, 22, 156, 16);
      b.fillStyle = 'rgba(245,248,250,0.95)';
      b.fillRect(lx - 72, 26, 144, 8);
      const glow = b.createRadialGradient(lx, 55, 6, lx, 110, 160);
      glow.addColorStop(0, 'rgba(255,248,220,0.28)');
      glow.addColorStop(0.45, 'rgba(255,248,220,0.08)');
      glow.addColorStop(1, 'rgba(255,248,220,0)');
      b.fillStyle = glow;
      b.fillRect(lx - 170, 20, 340, 220);
    }

    // exterior windows with city-lab daylight and blinds
    for (const [wx, wy] of [[70, 168], [1000, 168]]) {
      b.fillStyle = '#161c24';
      b.fillRect(wx - 10, wy - 10, 230, 148);
      const sky = b.createLinearGradient(wx, wy, wx + 40, wy + 130);
      sky.addColorStop(0, '#6f9fc4');
      sky.addColorStop(0.35, '#a8c5da');
      sky.addColorStop(0.7, '#d5e2ec');
      sky.addColorStop(1, '#eef3f6');
      b.fillStyle = sky;
      b.fillRect(wx, wy, 210, 128);
      // distant building silhouettes
      b.fillStyle = 'rgba(40,60,80,0.22)';
      b.fillRect(wx + 20, wy + 70, 40, 58);
      b.fillRect(wx + 70, wy + 50, 28, 78);
      b.fillRect(wx + 130, wy + 62, 50, 66);
      for (let bx = 0; bx < 4; bx++) {
        for (let by = 0; by < 3; by++) {
          b.fillStyle = 'rgba(255,220,140,0.18)';
          b.fillRect(wx + 26 + bx * 9, wy + 78 + by * 12, 5, 7);
        }
      }
      // mullions + frame
      b.strokeStyle = '#2a3340';
      b.lineWidth = 4;
      b.strokeRect(wx, wy, 210, 128);
      b.beginPath();
      b.moveTo(wx + 105, wy);
      b.lineTo(wx + 105, wy + 128);
      b.moveTo(wx, wy + 64);
      b.lineTo(wx + 210, wy + 64);
      b.stroke();
      // blinds
      b.strokeStyle = 'rgba(30,40,50,0.18)';
      b.lineWidth = 1;
      for (let i = 0; i < 10; i++) {
        b.beginPath();
        b.moveTo(wx + 4, wy + 8 + i * 12);
        b.lineTo(wx + 206, wy + 8 + i * 12);
        b.stroke();
      }
      // glass sheen
      b.fillStyle = 'rgba(255,255,255,0.14)';
      b.beginPath();
      b.moveTo(wx + 6, wy + 6);
      b.lineTo(wx + 78, wy + 6);
      b.lineTo(wx + 34, wy + 120);
      b.lineTo(wx + 6, wy + 120);
      b.fill();
      // sill
      b.fillStyle = '#4a5562';
      b.fillRect(wx - 14, wy + 128, 238, 10);
      b.fillStyle = 'rgba(255,255,255,0.12)';
      b.fillRect(wx - 14, wy + 128, 238, 2);
    }

    // whiteboard with marker notes
    b.fillStyle = '#e4e9ef';
    b.fillRect(340, 170, 600, 118);
    b.strokeStyle = '#5a6572';
    b.lineWidth = 5;
    b.strokeRect(340, 170, 600, 118);
    b.fillStyle = 'rgba(50,60,70,0.4)';
    b.font = 'bold 18px sans-serif';
    b.fillText('LAB 2B  ·  SAFETY FIRST', 360, 200);
    b.fillStyle = 'rgba(50,70,90,0.28)';
    b.font = '14px sans-serif';
    b.fillText('H₂O  ·  gloves  ·  goggles  ·  no open flame', 360, 228);
    for (let line = 0; line < 3; line++) {
      b.fillStyle = 'rgba(40,50,60,0.18)';
      b.fillRect(360, 248 + line * 12, 240 + (line % 2) * 90, 3);
    }
    b.fillStyle = '#3a4450';
    b.fillRect(352, 280, 576, 10);
    for (const [mx, mc] of [[370, '#1a1a1a'], [400, '#2a6a9a'], [430, '#8a2a2a']]) {
      b.fillStyle = mc;
      b.fillRect(mx, 282, 18, 6);
    }

    // fume hood behind the duel stage
    b.fillStyle = '#2a323c';
    b.fillRect(455, 295, 370, 118);
    b.fillStyle = '#181e26';
    b.fillRect(470, 312, 340, 78);
    const sash = b.createLinearGradient(470, 312, 470, 390);
    sash.addColorStop(0, 'rgba(150,190,210,0.22)');
    sash.addColorStop(1, 'rgba(60,80,100,0.14)');
    b.fillStyle = sash;
    b.fillRect(470, 312, 340, 78);
    b.strokeStyle = 'rgba(210,220,230,0.22)';
    b.lineWidth = 2;
    b.strokeRect(470, 312, 340, 78);
    for (let v = 0; v < 6; v++) {
      b.fillStyle = 'rgba(0,0,0,0.4)';
      b.fillRect(488 + v * 52, 300, 34, 7);
    }
    // hood work lights
    b.fillStyle = 'rgba(255,240,180,0.35)';
    b.fillRect(490, 318, 40, 4);
    b.fillRect(750, 318, 40, 4);

    // wall clock + extinguisher + outlet for lived-in detail
    b.fillStyle = '#e8eef4';
    b.beginPath();
    b.arc(310, 210, 18, 0, Math.PI * 2);
    b.fill();
    b.strokeStyle = '#3a4450';
    b.lineWidth = 3;
    b.stroke();
    b.beginPath();
    b.moveTo(310, 210);
    b.lineTo(310, 198);
    b.moveTo(310, 210);
    b.lineTo(320, 214);
    b.stroke();
    b.fillStyle = '#b03028';
    b.fillRect(960, 300, 18, 52);
    b.fillStyle = '#d0d4d8';
    b.fillRect(964, 294, 10, 8);
    b.fillStyle = '#8a9098';
    b.fillRect(250, 340, 16, 22);
    b.fillStyle = '#1a2028';
    b.fillRect(253, 345, 4, 4);
    b.fillRect(259, 345, 4, 4);

    // side benches with shelves, glassware, sinks
    const liquids = ['rgba(60,160,120,0.7)', 'rgba(180,90,50,0.7)', 'rgba(70,120,190,0.7)', 'rgba(200,180,60,0.65)', 'rgba(140,70,160,0.65)'];
    for (const side of [0, 1]) {
      const x0 = side ? W - 92 : 0;
      const face = b.createLinearGradient(x0, 280, x0 + 92, 280);
      face.addColorStop(0, side ? '#1e252e' : '#2a323c');
      face.addColorStop(1, side ? '#2a323c' : '#1e252e');
      b.fillStyle = face;
      b.fillRect(x0, 280, 92, 260);
      // laminate countertop
      b.fillStyle = '#6a7582';
      b.fillRect(x0, 280, 92, 16);
      b.fillStyle = 'rgba(255,255,255,0.16)';
      b.fillRect(x0, 280, 92, 3);
      b.fillStyle = 'rgba(0,0,0,0.25)';
      b.fillRect(x0, 294, 92, 2);
      // sink
      b.fillStyle = '#3a4652';
      b.fillRect(x0 + 18, 286, 40, 8);
      b.fillStyle = '#8a98a6';
      b.fillRect(x0 + 22, 288, 32, 4);
      b.fillStyle = '#c0cad4';
      b.fillRect(x0 + 36, 282, 4, 8);
      for (let shelf = 0; shelf < 4; shelf++) {
        const sy = 330 + shelf * 46;
        b.fillStyle = '#141a22';
        b.fillRect(x0 + 10, sy, 72, 6);
        b.fillStyle = 'rgba(255,255,255,0.07)';
        b.fillRect(x0 + 10, sy, 72, 1);
        for (let n = 0; n < 4; n++) {
          const bx = x0 + 14 + n * 17;
          const tall = 12 + ((n + shelf) % 3) * 5;
          paintBottle(b, bx, sy - tall, 9 + (n % 2), tall, liquids[(n + shelf + side) % liquids.length], n % 2 ? '#d0d6dc' : '#3a3030');
        }
      }
      // lower cupboards
      b.fillStyle = '#222a34';
      b.fillRect(x0 + 8, 510, 36, 28);
      b.fillRect(x0 + 48, 510, 36, 28);
      b.strokeStyle = 'rgba(255,255,255,0.1)';
      b.strokeRect(x0 + 8, 510, 36, 28);
      b.strokeRect(x0 + 48, 510, 36, 28);
      b.fillStyle = 'rgba(210,215,220,0.35)';
      b.fillRect(x0 + 36, 520, 3, 8);
      b.fillRect(x0 + 76, 520, 3, 8);
    }

    // linoleum floor with perspective + specular wash
    const floorTop = 420;
    const floor = b.createLinearGradient(0, floorTop, 0, H);
    floor.addColorStop(0, '#4a5360');
    floor.addColorStop(0.35, '#343c48');
    floor.addColorStop(1, '#1a1f26');
    b.fillStyle = floor;
    b.fillRect(0, floorTop, W, H - floorTop);
    b.strokeStyle = 'rgba(0,0,0,0.22)';
    b.lineWidth = 1;
    for (let row = 0; row < 16; row++) {
      const t = row / 16;
      const y = floorTop + t * t * (H - floorTop);
      b.beginPath();
      b.moveTo(0, y);
      b.lineTo(W, y);
      b.stroke();
    }
    for (let col = -7; col <= 7; col++) {
      b.beginPath();
      b.moveTo(W / 2 + col * 26, floorTop);
      b.lineTo(W / 2 + col * 120, H);
      b.stroke();
    }
    // alternating tile tint for linoleum read
    for (let row = 0; row < 10; row++) {
      const t0 = row / 10;
      const t1 = (row + 1) / 10;
      const y0 = floorTop + t0 * t0 * (H - floorTop);
      const y1 = floorTop + t1 * t1 * (H - floorTop);
      if (row % 2 === 0) {
        b.fillStyle = 'rgba(255,255,255,0.03)';
        b.fillRect(0, y0, W, Math.max(1, y1 - y0));
      }
    }
    const sheen = b.createRadialGradient(W / 2, 540, 30, W / 2, 580, 460);
    sheen.addColorStop(0, 'rgba(255,255,255,0.09)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0.03)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    b.fillStyle = sheen;
    b.fillRect(0, floorTop, W, H - floorTop);

    // baseboard
    b.fillStyle = '#12161c';
    b.fillRect(0, 412, W, 10);
    b.fillStyle = 'rgba(255,255,255,0.08)';
    b.fillRect(0, 412, W, 2);

    // vignette keeps the board readable without crushing the room
    const vig = b.createRadialGradient(W / 2, H * 0.42, 200, W / 2, H * 0.46, W * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.38)');
    b.fillStyle = vig;
    b.fillRect(0, 0, W, H);
  }
  ctx.drawImage(backdrop, 0, 0);
}

function shade(ctx, a = 0.72) {
  ctx.fillStyle = `rgba(5,8,15,${a})`;
  ctx.fillRect(0, 0, W, H);
}

function titleTiles(ctx, word, y, time, offset) {
  const tw = 62;
  const th = 70;
  const gap = 8;
  let x = (W - (word.length * tw + (word.length - 1) * gap)) / 2;
  [...word].forEach((ch, k) => {
    const el = ELEMENTS[ELEMENT_ORDER[(k + offset) % ELEMENT_ORDER.length]];
    const bob = Math.sin(time * 2 + (k + offset) * 0.6) * 3;
    rr(ctx, x, y + bob + 4, tw, th, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();
    rr(ctx, x, y + bob, tw, th, 10);
    ctx.fillStyle = el.color;
    ctx.fill();
    text(ctx, String(k + offset + 1), x + 7, y + bob + 15, { size: 10, color: alpha(el.ink, 0.65) });
    text(ctx, ch, x + tw / 2, y + bob + th * 0.58, { size: 40, color: el.ink, align: 'center', baseline: 'middle' });
    x += tw + gap;
  });
}

export const MENU = ['bot', 'local', 'book', 'howto'];
const MENU_LABEL = { bot: 'PLAY VS COMPUTER', local: '2 PLAYERS, ONE KEYBOARD', book: 'RECIPE BOOK', howto: 'HOW TO PLAY' };

// Returns the clickable rectangle of every item so the mouse works too.
export function drawMenu(ctx, menu, levels, time) {
  // drifting atoms
  for (let k = 0; k < 16; k++) {
    const el = ELEMENTS[ELEMENT_ORDER[k % ELEMENT_ORDER.length]];
    const x = hash(k, 1) * W + Math.sin(time * 0.3 + k) * 30;
    const y = ((hash(k, 2) * H - time * (8 + hash(k, 3) * 14)) % (H + 80) + H + 80) % (H + 80) - 40;
    circle(ctx, x, y, 10 + hash(k, 4) * 16);
    ctx.fillStyle = alpha(el.color, 0.1);
    ctx.fill();
  }
  titleTiles(ctx, 'CHEMIST', 70, time, 0);
  titleTiles(ctx, 'CLASH', 156, time, 7);
  text(ctx, 'Mix real molecules. Win the lab.', W / 2, 272, { size: 17, color: DIM, align: 'center', weight: 400 });

  const rects = [];
  MENU.forEach((id, k) => {
    const w = 470;
    const h = 50;
    const x = (W - w) / 2;
    const y = 312 + k * 62;
    const on = menu.index === k;
    rr(ctx, x, y, w, h, 12);
    ctx.fillStyle = on ? alpha(PLAYER_COLORS[0], 0.2) : 'rgba(255,255,255,0.04)';
    ctx.fill();
    ctx.strokeStyle = on ? PLAYER_COLORS[0] : '#2a3650';
    ctx.lineWidth = on ? 2 : 1;
    ctx.stroke();
    text(ctx, MENU_LABEL[id], x + 22, y + h / 2 + 1, { size: 17, color: on ? '#ffffff' : INK, baseline: 'middle' });
    if (id === 'bot') {
      text(ctx, `◀  ${levels[menu.level].toUpperCase()}  ▶`, x + w - 22, y + h / 2 + 1, {
        size: 14, color: on ? PLAYER_COLORS[0] : DIM, align: 'right', baseline: 'middle',
      });
    }
    rects.push({ id, k, x, y, w, h });
  });
  text(ctx, 'W / S choose   ·   A / D difficulty   ·   ENTER select   ·   M mute', W / 2, 594, { size: 12, color: DIM, align: 'center' });
  return rects;
}

function keyRow(ctx, x, y, caps, label) {
  let cx = x;
  for (const cap of caps) {
    const w = Math.max(26, cap.length * 9 + 12);
    keycap(ctx, cap, cx, y, w, 24);
    cx += w + 5;
  }
  text(ctx, label, x + 150, y + 13, { size: 13, color: INK, weight: 400, baseline: 'middle' });
}

const TRUMP = RECIPES.find((r) => r.id === TRUMP_ID);
const RULES = [
  'Pick a chemist before each match. Each one buffs one chemistry family (acids, bases, toxins, …) and weakens another. Oleanolic acid is its own NUKE type.',
  'Versus the computer: arrows move, 1–5 throw atoms, Q and W select pot A or B, E confirms the reaction, R empties the active pot.',
  'Your hotbar always holds 5 atoms. The moment you throw one, a new one takes its place. Hydrogen and carbon turn up most.',
  'Throw atoms into the active pot to build a formula, then confirm to react. Pots hold as many atoms as you like.',
  'Some compounds raise walls on the enemy side. Walls block movement and stop bolts; fire, acid, water jets and blasts break them.',
  'Lab temperature matters. Burning tiles on your side speed reactions up; frost slows them down.',
  `The OA Nuke is ${TRUMP.chem} (${TRUMP.label}). It hits the whole enemy side, needs ${TRUMP.atoms} atoms, and is not buffed by organic or attack traits.`,
];

export function drawHowTo(ctx) {
  shade(ctx, 0.55);
  text(ctx, 'HOW TO PLAY', W / 2, 52, { size: 30, color: '#ffffff', align: 'center' });
  const cards = [
    {
      x: 70, title: 'VS COMPUTER', color: PLAYER_COLORS[0],
      rows: [
        [['↑', '←', '↓', '→'], 'Move one tile'],
        [['1', '…', '5'], 'Throw that hotbar atom into the active pot'],
        [['Q'], 'Select pot A'],
        [['W'], 'Select pot B'],
        [['E'], 'Confirm reaction'],
        [['R'], 'Empty the active pot'],
      ],
    },
    {
      x: 660, title: '2 PLAYERS (P2)', color: PLAYER_COLORS[1],
      rows: [
        [['I', 'J', 'K', 'L'], 'Move (arrows also work)'],
        [['6', '…', '0'], 'Throw that hotbar atom into the active pot'],
        [['U'], 'Switch pot'],
        [['O'], 'Confirm reaction'],
        [[','], 'Empty the active pot'],
      ],
      note: 'P1 on the same keyboard still uses WASD, Q toggle, E, X.',
    },
  ];
  for (const c of cards) {
    rr(ctx, c.x, 72, 550, 220, 14);
    ctx.fillStyle = 'rgba(13,20,36,0.94)';
    ctx.fill();
    ctx.strokeStyle = alpha(c.color, 0.5);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    text(ctx, c.title, c.x + 22, 100, { size: 16, color: c.color });
    c.rows.forEach((row, i) => keyRow(ctx, c.x + 22, 112 + i * 28, row[0], row[1]));
    if (c.note) text(ctx, c.note, c.x + 22, 280, { size: 11, color: DIM, weight: 400 });
  }
  let y = 328;
  for (const rule of RULES) {
    circle(ctx, 84, y - 5, 3.5);
    ctx.fillStyle = PLAYER_COLORS[0];
    ctx.fill();
    ctx.font = font(15, 400);
    for (const line of wrap(ctx, rule, 1090)) {
      text(ctx, line, 100, y, { size: 15, color: INK, weight: 400 });
      y += 22;
    }
    y += 12;
  }
  text(ctx, 'TAB opens the recipe book at any time   ·   ESC back', W / 2, 700, { size: 12, color: DIM, align: 'center' });
}

// The book is split so each page fits on screen at a readable size.
const PAGES = [
  { title: 'ATTACKS', recipes: RECIPES.filter((r) => r.tag === 'attack') },
  { title: 'CLOUDS, WALLS, SHIELDS, HEALS AND THE OA NUKE', recipes: RECIPES.filter((r) => r.tag !== 'attack') },
];
export const BOOK_PAGES = PAGES.length;

export function drawBook(ctx, pageIndex) {
  const page = PAGES[pageIndex];
  shade(ctx, 0.92);
  text(ctx, 'RECIPE BOOK', 45, 42, { size: 26, color: '#ffffff' });
  text(ctx, `${page.title}   ·   page ${pageIndex + 1} of ${PAGES.length}`, 45, 63, { size: 12, color: PLAYER_COLORS[0] });
  text(ctx, 'A / D or click: turn page   ·   TAB / ESC: close', W - 45, 42, { size: 12, color: DIM, align: 'right' });
  text(ctx, 'Times are at normal lab temperature', W - 45, 63, { size: 12, color: DIM, align: 'right', weight: 400 });
  const cw = 390;
  const ch = 96;
  page.recipes.forEach((r, n) => {
    const x = 45 + (n % 3) * (cw + 10);
    const y = 80 + Math.floor(n / 3) * (ch + 9);
    const nuke = r.tag === 'nuke';
    rr(ctx, x, y, cw, ch, 10);
    ctx.fillStyle = nuke ? 'rgba(52,42,14,0.96)' : 'rgba(19,29,50,0.96)';
    ctx.fill();
    ctx.strokeStyle = nuke ? TAG_COLOR.nuke : '#2a3650';
    ctx.lineWidth = nuke ? 2 : 1;
    ctx.stroke();
    formula(ctx, r.parts, x + 12, y + 32, r.parts.length > 3 ? 15 : 20);
    text(ctx, r.chem, x + 12, y + 52, { size: 11, color: DIM, weight: 400 });
    text(ctx, r.time ? `${r.time.toFixed(1)} s` : 'instant', x + 12, y + 72, { size: 12, color: r.time ? '#ffd27a' : '#9fe8ff' });
    text(ctx, `${r.atoms} atoms`, x + 12, y + 87, { size: 10, color: DIM, weight: 400 });
    text(ctx, r.name, x + 128, y + 26, { size: 15, color: '#ffffff' });
    text(ctx, `${r.tag.toUpperCase()} · ${AIM_LABEL[r.aim]}`, x + cw - 12, y + 25, { size: 10, color: TAG_COLOR[r.tag], align: 'right' });
    ctx.font = font(12.5, 400);
    wrap(ctx, r.desc, cw - 142).slice(0, 4).forEach((line, k) => {
      text(ctx, line, x + 128, y + 46 + k * 15, { size: 12.5, color: '#c5d2e6', weight: 400 });
    });
  });
}

export function drawCountdown(ctx, game) {
  const cy = (FIELD_Y + FIELD_BOTTOM) / 2;
  if (game.phase === 'countdown') {
    const n = Math.ceil(game.countdown);
    const k = game.countdown - Math.floor(game.countdown);
    ctx.globalAlpha = Math.min(1, k * 2.5);
    text(ctx, String(n), W / 2, cy, { size: 110 + k * 50, color: '#ffffff', align: 'center', baseline: 'middle' });
    ctx.globalAlpha = 1;
  } else if (game.phase === 'playing' && game.time < 0.7) {
    ctx.globalAlpha = 1 - game.time / 0.7;
    text(ctx, 'REACT!', W / 2, cy, { size: 96 + game.time * 60, color: '#ffe169', align: 'center', baseline: 'middle' });
    ctx.globalAlpha = 1;
  }
}

function dialog(ctx, title, color, lines) {
  shade(ctx, 0.6);
  const w = 520;
  const h = 130 + lines.length * 30;
  const x = (W - w) / 2;
  const y = (H - h) / 2 - 20;
  rr(ctx, x, y, w, h, 16);
  ctx.fillStyle = 'rgba(13,20,36,0.97)';
  ctx.fill();
  ctx.strokeStyle = alpha(color, 0.7);
  ctx.lineWidth = 2;
  ctx.stroke();
  text(ctx, title, W / 2, y + 64, { size: 38, color, align: 'center' });
  // Keycaps are right-aligned against one column so the labels line up.
  const capW = (cap) => Math.max(26, cap.length * 9 + 14);
  const colW = Math.max(...lines.map(([cap]) => capW(cap)));
  const left = W / 2 - (colW + 12 + 110) / 2;
  lines.forEach(([cap, label], k) => {
    const ly = y + 100 + k * 30;
    keycap(ctx, cap, left + colW - capW(cap), ly, capW(cap), 22);
    text(ctx, label, left + colW + 12, ly + 12, { size: 14, color: INK, weight: 400, baseline: 'middle' });
  });
}


export function drawSelect(ctx, select, time) {
  shade(ctx, 0.55);
  const who = select.picking;
  const color = PLAYER_COLORS[who];
  text(ctx, who === 0 ? 'CHOOSE YOUR CHEMIST' : (select.mode === 'bot' ? 'COMPUTER PICKS…' : 'PLAYER 2 — CHOOSE'), W / 2, 48, {
    size: 28, color: '#ffffff', align: 'center',
  });
  text(ctx, select.mode === 'bot' ? 'Play vs computer' : 'Local two players', W / 2, 78, { size: 13, color: DIM, align: 'center', weight: 400 });

  const c = CHARACTERS[select.cursor];
  drawPortrait(ctx, c, W / 2, 250, 220, time);
  text(ctx, c.name, W / 2, 390, { size: 36, color: c.accent, align: 'center' });
  text(ctx, c.title, W / 2, 422, { size: 16, color: INK, align: 'center', weight: 400 });
  text(ctx, c.blurb, W / 2, 450, { size: 15, color: DIM, align: 'center', weight: 400 });

  // roster strip
  const stripW = CHARACTERS.length * 92;
  let sx = (W - stripW) / 2;
  select.rects = [];
  CHARACTERS.forEach((ch, i) => {
    const on = i === select.cursor;
    const x = sx + i * 92;
    const y = 480;
    rr(ctx, x, y, 84, 84, 12);
    ctx.fillStyle = on ? alpha(ch.accent, 0.25) : 'rgba(255,255,255,0.04)';
    ctx.fill();
    ctx.strokeStyle = on ? ch.accent : '#2a3650';
    ctx.lineWidth = on ? 2.5 : 1;
    ctx.stroke();
    drawPortrait(ctx, ch, x + 42, y + 42, 70, time);
    text(ctx, ch.name, x + 42, y + 100, { size: 11, color: on ? '#ffffff' : DIM, align: 'center' });
    select.rects.push({ i, x, y, w: 84, h: 100 });
  });

  if (select.picks[0]) {
    text(ctx, `P1: ${CHARACTERS.find((x) => x.id === select.picks[0])?.name || ''}`, 40, 640, { size: 14, color: PLAYER_COLORS[0] });
  }
  if (select.picks[1]) {
    text(ctx, `P2: ${CHARACTERS.find((x) => x.id === select.picks[1])?.name || ''}`, W - 40, 640, { size: 14, color: PLAYER_COLORS[1], align: 'right' });
  }
  text(ctx, 'A / D browse   ·   ENTER lock in   ·   ESC back', W / 2, 690, { size: 12, color: DIM, align: 'center' });
}

export function drawPause(ctx) {
  dialog(ctx, 'PAUSED', '#ffffff', [['ESC', 'Resume'], ['TAB', 'Recipe book'], ['R', 'Restart match'], ['BACKSPACE', 'Quit to menu']]);
}

export function drawResult(ctx, game) {
  const draw = game.winner === -1;
  const title = draw ? 'DOUBLE KNOCKOUT' : `${game.players[game.winner].name.toUpperCase()} ${game.players[game.winner].name === 'You' ? 'WIN' : 'WINS'}!`;
  dialog(ctx, title, draw ? '#ffffff' : PLAYER_COLORS[game.winner], [['ENTER', 'Rematch'], ['ESC', 'Back to menu']]);
}
