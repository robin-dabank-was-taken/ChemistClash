import { TOKEN_ORDER } from './tokens.js';
import { FAMILY_OF, TRUMP_ID } from './families.js';

const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉';
const subscript = (n) => String(n).replace(/\d/g, (d) => SUBSCRIPTS[d]);
const LABEL = { e: 'e', p: 'p', g: 'γ', q: 'q', n: 'n', B: 'B', h: 'ℏ', T: 'T' };

export function countParts(partsList) {
  const counts = {};
  for (const a of partsList) counts[a] = (counts[a] || 0) + 1;
  return counts;
}

export function countsKey(counts) {
  return TOKEN_ORDER.filter((e) => counts[e]).map((e) => e + counts[e]).join('');
}

export function formulaLabel(parts) {
  return parts.map(([el, n]) => (LABEL[el] || el) + (n > 1 ? subscript(n) : '')).join('');
}

function recipe(id, parts, chem, name, time, aim, tag, desc) {
  const counts = {};
  let atoms = 0;
  for (const [el, n] of parts) {
    counts[el] = (counts[el] || 0) + n;
    atoms += n;
  }
  return {
    id, parts, counts, atoms, key: countsKey(counts),
    label: formulaLabel(parts), chem, name, time, aim, tag, desc,
    family: FAMILY_OF[id] || null,
  };
}

export { TRUMP_ID };
export const NUKE_ID = TRUMP_ID;

export const RECIPES = [
  // ---- attacks
  recipe('sparkbolt', [['e', 2]], 'Pair annihilation', 'Spark Bolt', 0, 'row', 'attack',
    'Fast EM bolt down your row. 6 dmg.'),
  recipe('momentum', [['p', 2]], 'Momentum transfer', 'Momentum Kick', 0, 'mirror', 'attack',
    'Leaps to the tile 4 ahead, deals 12 dmg, then snaps back.'),
  recipe('photocannon', [['g', 2], ['e', 1]], 'Photon cannon', 'Photon Fan', 0.5, 'row', 'attack',
    'Three bolts (row + both diagonals): 8 dmg each, ignite on hit.'),
  recipe('coulomb', [['e', 2], ['p', 1]], 'Coulomb burst', 'Coulomb Spike', 0.5, 'mirror', 'attack',
    'Hits the tile 4 ahead: 14 dmg.'),
  recipe('tunnel', [['q', 1], ['e', 2]], 'Tunneling', 'Tunnel Leap', 0.6, 'mirror', 'attack',
    'Leaps to the tile 4 ahead: 18 dmg, then returns.'),
  recipe('impact', [['p', 2], ['n', 1]], 'Inelastic collision', 'Impact Quake', 1.0, 'mirror', 'attack',
    'Column shock 4 ahead: 12 dmg.'),
  recipe('lorentz', [['e', 3], ['B', 1]], 'Lorentz force', 'Lorentz Arc', 1.0, 'row', 'attack',
    'Twin diagonal EM bolts: 8 dmg each.'),
  recipe('plasma', [['T', 1], ['g', 2]], 'Plasma jet', 'Plasma Jet', 1.0, 'row', 'attack',
    'Thermal jet: 14 dmg down your row, sets the enemy row ablaze.'),
  recipe('fission', [['n', 2], ['B', 1]], 'Fission burst', 'Fission Leap', 1.5, 'mirror', 'attack',
    'Leaps to the tile 4 ahead, + shape blast 16 dmg + fire, then returns.'),
  recipe('cascade', [['p', 3], ['e', 2]], 'Cascade failure', 'Cascade', 2.0, 'mirror', 'attack',
    '3×3 kinetic splash: 22 dmg.'),
  recipe('entropy', [['T', 1], ['q', 2], ['e', 2]], 'Entropy dump', 'Entropy Wave', 2.5, 'field', 'attack',
    'Heats the whole enemy side: 8 dmg + fire 2.5 s.'),
  recipe('neutronjet', [['n', 3], ['p', 2]], 'Neutron jet', 'Neutron Jet', 3.0, 'row', 'attack',
    'Heavy jet down your row: 24 dmg.'),
  recipe('redshift', [['g', 3]], 'Redshift pulse', 'Redshift', 0.8, 'mirror', 'attack',
    'Chilling pulse on the tile 4 ahead: 10 dmg and chill. Freezes if the tile is wet.'),
  recipe('annihilation', [['e', 4], ['p', 4]], 'Matter annihilation', 'Annihilation', 3.0, 'mirror', 'attack',
    '3×3 annihilation burst 4 ahead: 36 dmg.'),
  recipe('synchrotron', [['e', 4], ['B', 1]], 'Synchrotron beam', 'Synchrotron', 2.0, 'row', 'attack',
    'Hard EM beam: 20 dmg down your row.'),
  recipe('decohere', [['q', 2], ['g', 1]], 'Decoherence', 'Decohere', 1.2, 'mirror', 'attack',
    'Hits the tile 4 ahead: 8 dmg + stun 1.5 s. +8 if that tile has a glitch (clears it).'),

  // ---- glitch zones
  recipe('staticfield', [['e', 2], ['g', 1]], 'Static field', 'Static Field', 0, 'mirror', 'zone',
    'Static DoT glitch, 3 tall, 4 ahead. Lingers 5 s.'),
  recipe('chargecorrupt', [['e', 3], ['p', 1]], 'Charge corrupt', 'Charge Corrupt', 0, 'mirror', 'zone',
    'Charge DoT glitch in a + shape, 4 ahead. Lingers 5 s.'),
  recipe('blackbodytear', [['T', 1], ['g', 1]], 'Blackbody tear', 'Blackbody Tear', 0.5, 'mirror', 'zone',
    'Unstable thermal glitch, 3 wide. Harmless until lit. Lingers 10 s.'),
  recipe('probglitch', [['q', 2], ['h', 1]], 'Probability glitch', 'Probability Glitch', 0.5, 'mirror', 'zone',
    'Giddy glitch in a + shape, 4 ahead.'),
  recipe('neutronscramble', [['n', 2], ['h', 1]], 'Neutron scramble', 'Neutron Scramble', 1.5, 'mirror', 'zone',
    'Big unstable neutron glitch. Harmless until it blows. Lingers 12 s.'),
  recipe('vacfluc', [['h', 1], ['g', 2]], 'Vacuum fluctuation', 'Vac Fluc', 1.0, 'field', 'zone',
    'Probability glitches on 4 random enemy tiles.'),

  // ---- walls
  recipe('fluxwall', [['B', 1], ['e', 2]], 'Flux wall', 'Flux Wall', 1.0, 'mirror', 'wall',
    'Field wall down the column 4 ahead. 8 s.'),
  recipe('lattice', [['B', 2], ['n', 1]], 'Lattice cage', 'Lattice Cage', 1.5, 'mirror', 'wall',
    'Barrier + shape, 4 ahead. 10 s.'),
  recipe('barrier', [['B', 1], ['q', 1], ['e', 2]], 'Barrier plate', 'Barrier Plate', 2.0, 'row', 'wall',
    'Barrier across the enemy half of your row. 9 s.'),
  recipe('magnetar', [['B', 2], ['e', 3]], 'Magnetar cage', 'Magnetar', 2.5, 'mirror', 'wall',
    'Heavy barrier column 4 ahead. 12 s.'),

  // ---- shields
  recipe('plasmeshield', [['g', 2], ['B', 1]], 'Plasma sheath', 'Plasma Sheath', 0.5, 'self', 'shield',
    'Shield: absorbs 18. Lasts 5 s.'),
  recipe('kevlarfield', [['B', 2], ['p', 2]], 'Hard field', 'Hard Field', 1.5, 'self', 'shield',
    'Shield: absorbs 34. Lasts 10 s.'),
  recipe('zeropoint', [['h', 1], ['B', 1], ['e', 1]], 'Zero-point shell', 'Zero-Point', 2.0, 'self', 'shield',
    'Shield: absorbs 26. Lasts 8 s.'),

  // ---- heals / support
  recipe('coherence', [['h', 1], ['e', 2]], 'Coherence', 'Coherence', 1.0, 'self', 'heal',
    'Heal 20.'),
  recipe('coolbath', [['g', 2], ['e', 2]], 'Cooling bath', 'Cooling Bath', 1.5, 'self', 'heal',
    'Heal 18.'),
  recipe('restore', [['h', 1], ['q', 1], ['e', 3]], 'State restore', 'State Restore', 2.5, 'self', 'heal',
    'Heal 32 and clear status.'),
  recipe('wavepulse', [['g', 1], ['e', 3]], 'Wave pulse', 'Wave Pulse', 0, 'field', 'support',
    'Heal 6. Fans enemy fires.'),
  recipe('standing', [['q', 1], ['g', 2], ['e', 1]], 'Standing wave', 'Standing Wave', 1.0, 'self', 'support',
    'Cleanse + haste 5 s.'),
  recipe('inertframe', [['n', 1], ['e', 2]], 'Inert frame', 'Inert Frame', 0, 'self', 'support',
    'Smothers fires and clears glitches on your side.'),
  recipe('phasealign', [['q', 1], ['h', 1], ['g', 1]], 'Phase align', 'Phase Align', 1.5, 'self', 'support',
    'Cleanse + haste 4 s + heal 10.'),

  // ---- nuke
  recipe(TRUMP_ID, [['e', 8], ['p', 6], ['n', 4], ['h', 2]], 'Hawking process', 'Hawking Collapse', 5.0, 'field', 'nuke',
    'Collapses the entire enemy side: 80 dmg. Huge build.'),
];

const BY_KEY = new Map(RECIPES.map((r) => [r.key, r]));
export const RECIPE_BY_ID = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

export function findRecipe(atoms) {
  return BY_KEY.get(countsKey(countParts(atoms))) || null;
}

export function missingFor(recipe, have) {
  const missing = {};
  for (const el of TOKEN_ORDER) {
    const diff = (recipe.counts[el] || 0) - (have[el] || 0);
    if (diff < 0) return null;
    if (diff > 0) missing[el] = diff;
  }
  return missing;
}

export function buildBag() {
  return [];
}
