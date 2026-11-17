// Playable chemists. Each buffs one chemistry family and debuffs another.
import { FAMILIES } from './families.js';

// Hidden identity used by tests / headless sims (no family mods).
export const BASELINE = {
  id: 'baseline',
  name: 'Baseline',
  title: 'Control',
  blurb: 'No family buffs or debuffs.',
  accent: '#9aa7bd',
  hair: '#56617a',
  skin: '#f3caa2',
  eyes: '#35d6c5',
  coat: '#eef3fa',
  buff: { families: [] },
  debuff: { families: [] },
};

export const CHARACTERS = [
  {
    id: 'akari',
    name: 'Akari',
    title: 'Acid Virtuoso',
    blurb: 'Acids +25% · Bases −20%',
    accent: '#9be33c',
    hair: '#f4f1ea',
    skin: '#f3caa2',
    eyes: '#6bcf3a',
    coat: '#eef6e8',
    buff: { families: ['acid'], damage: 1.25, duration: 1.25 },
    debuff: { families: ['base'], damage: 0.8, duration: 0.8, heal: 0.8, shield: 0.8 },
  },
  {
    id: 'sora',
    name: 'Sora',
    title: 'Alkali Adept',
    blurb: 'Bases +25% · Acids −20%',
    accent: '#86a8ff',
    hair: '#7ec8ff',
    skin: '#f0c8a8',
    eyes: '#4c7dff',
    coat: '#e8eefc',
    buff: { families: ['base'], damage: 1.25, duration: 1.25, heal: 1.15, shield: 1.15 },
    debuff: { families: ['acid'], damage: 0.8, duration: 0.8 },
  },
  {
    id: 'kuro',
    name: 'Kuro',
    title: 'Toxin Lead',
    blurb: 'Toxins +25% · Heals −25%',
    accent: '#d49bff',
    hair: '#2a2438',
    skin: '#e8b896',
    eyes: '#c77dff',
    coat: '#e8e0f4',
    buff: { families: ['toxin'], damage: 1.25, duration: 1.25 },
    debuff: { families: ['heal'], heal: 0.75 },
  },
  {
    id: 'rin',
    name: 'Rin',
    title: 'Oxidizer',
    blurb: 'Fire & oxidizers +20% · Water/frost −20%',
    accent: '#ff8a3c',
    hair: '#ff5b50',
    skin: '#f3caa2',
    eyes: '#ff9d2e',
    coat: '#fceee6',
    buff: { families: ['oxidizer', 'organic'], damage: 1.2, duration: 1.15 },
    debuff: { families: ['aqueous'], damage: 0.8, duration: 0.8 },
  },
  {
    id: 'yui',
    name: 'Yui',
    title: 'Polymerist',
    blurb: 'Walls & shields +30% · Toxins −20%',
    accent: '#c4b49a',
    hair: '#f2c6d6',
    skin: '#f6d5b8',
    eyes: '#a89070',
    coat: '#f4efe6',
    buff: { families: ['polymer'], duration: 1.3, shield: 1.3 },
    debuff: { families: ['toxin'], damage: 0.8, duration: 0.8 },
  },
  {
    id: 'hana',
    name: 'Hana',
    title: 'Field Medic',
    blurb: 'Heals +30% · Organics −15% · Nuke untouched',
    accent: '#7dffa0',
    hair: '#5d3a2e',
    skin: '#f3caa2',
    eyes: '#3d9a5f',
    coat: '#e8f8ee',
    buff: { families: ['heal'], heal: 1.3 },
    debuff: { families: ['organic'], damage: 0.85 },
  },
];

export const CHARACTER_BY_ID = Object.fromEntries(
  [BASELINE, ...CHARACTERS].map((c) => [c.id, c]),
);
export const DEFAULT_CHARACTER_ID = 'baseline';

export function getCharacter(id) {
  return CHARACTER_BY_ID[id] || BASELINE;
}

export function traitBlurb(c) {
  return c.blurb;
}

export function familyLabel(id) {
  return FAMILIES[id]?.name || id;
}

// Bot character pick: prefer a character whose buffed families match desire.
export function pickBotCharacter(rng, levelName = 'normal') {
  const bias = { easy: 0.5, normal: 1, hard: 1.4 }[levelName] || 1;
  let best = CHARACTERS[0];
  let bestScore = -Infinity;
  for (const c of CHARACTERS) {
    const score = (c.buff.damage || 1) + (c.buff.heal || 1) + (c.buff.shield || 1) + rng.next() * (1.2 / bias);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best.id;
}
