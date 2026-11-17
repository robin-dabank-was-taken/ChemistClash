// Static game data: the board, the elements you draw, the gases, and every recipe.

export const COLS = 8;
export const ROWS = 4;
export const HALF = 4;

// `count` is how many of that atom are in one bag. Atoms are dealt from a
// shuffled bag and a fresh bag is opened whenever one runs out, so the supply
// never ends but the mix stays predictable: hydrogen and carbon dominate.
export const ELEMENTS = {
  H: { name: 'Hydrogen', z: 1, color: '#e9f1ff', ink: '#13233a', text: '#e9f1ff', count: 16 },
  C: { name: 'Carbon', z: 6, color: '#56617a', ink: '#f4f7fb', text: '#b3bfd3', count: 10 },
  N: { name: 'Nitrogen', z: 7, color: '#4c7dff', ink: '#ffffff', text: '#86a8ff', count: 4 },
  O: { name: 'Oxygen', z: 8, color: '#ff5b50', ink: '#ffffff', text: '#ff8178', count: 7 },
  P: { name: 'Phosphorus', z: 15, color: '#ff9d2e', ink: '#2b1600', text: '#ffb45c', count: 2 },
  S: { name: 'Sulfur', z: 16, color: '#ffd93b', ink: '#2c2400', text: '#ffe169', count: 2 },
  Cl: { name: 'Chlorine', z: 17, color: '#46d37a', ink: '#04250f', text: '#73e59c', count: 3 },
};
export const ELEMENT_ORDER = ['H', 'C', 'N', 'O', 'P', 'S', 'Cl'];

// `dmg` is per hazard tick (every half second) while standing in the cloud.
export const GASES = {
  cl2: { name: 'Chlorine', color: '#b9e34b', alpha: 0.5, dmg: 5 },
  co: { name: 'Carbon monoxide', color: '#c9d4e6', alpha: 0.13, dmg: 4, flammable: true, boom: 10 },
  h2s: { name: 'Hydrogen sulfide', color: '#d8c64a', alpha: 0.42, dmg: 3, flammable: true, boom: 12 },
  ch4: { name: 'Methane', color: '#8fd0ff', alpha: 0.36, dmg: 0, flammable: true, boom: 22 },
  n2o: { name: 'Nitrous oxide', color: '#f09be8', alpha: 0.42, dmg: 0, giddy: 2.5 },
};

const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉';
const subscript = (n) => String(n).replace(/\d/g, (d) => SUBSCRIPTS[d]);

function parseFormula(str) {
  const parts = [];
  for (const m of str.matchAll(/(Cl|[HCNOPS])(\d*)/g)) parts.push([m[1], m[2] ? Number(m[2]) : 1]);
  return parts;
}

export function countAtoms(atoms) {
  const counts = {};
  for (const a of atoms) counts[a] = (counts[a] || 0) + 1;
  return counts;
}

export function countsKey(counts) {
  return ELEMENT_ORDER.filter((e) => counts[e]).map((e) => e + counts[e]).join('');
}

export function formulaLabel(parts) {
  return parts.map(([el, n]) => el + (n > 1 ? subscript(n) : '')).join('');
}

// Formula parts for an arbitrary pile of atoms, in Hill order (C, H, then A-Z).
export function hillParts(counts) {
  const els = Object.keys(counts).filter((e) => counts[e] > 0).sort();
  const order = counts.C ? ['C', ...(counts.H ? ['H'] : []), ...els.filter((e) => e !== 'C' && e !== 'H')] : els;
  return order.map((e) => [e, counts[e]]);
}

// aim:  row    = travels along the row you are standing in
//       mirror = lands on the tile 4 columns ahead of you
//       self   = affects you / your side
//       field  = affects the enemy side wherever you stand
// time: seconds the reaction takes at neutral lab temperature (0 = instant)
// tag:  attack | zone | wall | shield | heal | support | nuke (groups the recipe book)
// family is stamped on afterwards from families.js (acid, base, toxin, …, nuke).
function recipe(id, formula, chem, name, time, aim, tag, desc) {
  const parts = parseFormula(formula);
  const counts = {};
  let atoms = 0;
  for (const [el, n] of parts) {
    counts[el] = (counts[el] || 0) + n;
    atoms += n;
  }
  return { id, parts, counts, atoms, key: countsKey(counts), label: formulaLabel(parts), chem, name, time, aim, tag, desc, family: null };
}

export const TRUMP_ID = 'c30h48o3';
export const NUKE_ID = TRUMP_ID;

export const RECIPES = [
  // ---- attacks
  recipe('h2', 'H2', 'Hydrogen', 'Squeaky Pop', 0, 'row', 'attack',
    'Fast bolt down your row. 6 dmg. Ignites any flammable gas it passes through.'),
  recipe('hcl', 'HCl', 'Hydrochloric acid', 'Acid Bolt', 0, 'row', 'attack',
    'Bolt down your row. 12 dmg and leaves an acid puddle where it hits.'),
  recipe('h2o', 'H2O', 'Water', 'Water Jet', 0.5, 'row', 'attack',
    'Sweeps your whole row: 6 dmg and knockback. Douses fire, washes acid, leaves tiles wet.'),
  recipe('co2', 'CO2', 'Carbon dioxide', 'Dry Ice Blast', 0.5, 'mirror', 'attack',
    'Frosts the whole column 4 ahead: 8 dmg and chill. Freezes solid anyone standing in water.'),
  recipe('so2', 'SO2', 'Sulfur dioxide', 'Acid Rain', 0.5, 'field', 'attack',
    "Acid rains on the enemy's tile and 4 random others: 8 dmg, puddles linger."),
  recipe('hcn', 'HCN', 'Hydrogen cyanide', 'Cyanide Dart', 0.6, 'mirror', 'attack',
    'Pinpoint strike on the single tile 4 ahead. 22 dmg.'),
  recipe('n2h4', 'N2H4', 'Hydrazine', 'Rocket Fuel', 1.0, 'row', 'attack',
    'Very fast rocket down your row: 20 dmg, sets its target alight and lights any gas on the way.'),
  recipe('hno3', 'HNO3', 'Nitric acid', 'Aqua Fortis', 1.0, 'mirror', 'attack',
    'Acid down the whole column 4 ahead: 12 dmg and puddles.'),
  recipe('chcl3', 'CHCl3', 'Chloroform', 'Knockout Drops', 1.0, 'mirror', 'attack',
    'Hits the single tile 4 ahead: 6 dmg and knocked out for 1.5 s (no moving, no mixing).'),
  recipe('c2h2', 'C2H2', 'Acetylene', 'Acetylene Torch', 1.0, 'row', 'attack',
    'Flame jet down your row: 16 dmg and sets the enemy row on fire.'),
  recipe('ph3', 'PH3', 'Phosphine', "Will-o'-Wisp", 1.0, 'mirror', 'attack',
    'Bursts into flame in a + shape, 4 ahead: 8 dmg, burns for 4 s.'),
  recipe('p4', 'P4', 'White phosphorus', 'White Phosphorus', 1.5, 'field', 'attack',
    'Sets the ENTIRE enemy side ablaze: 8 dmg, burns for 3 s.'),
  recipe('c3h8', 'C3H8', 'Propane', 'Propane Blast', 2.0, 'mirror', 'attack',
    'Explodes in a + shape, 4 ahead: 26 dmg and leaves fire.'),
  recipe('c6h6', 'C6H6', 'Benzene', 'Benzene Ring', 2.0, 'mirror', 'attack',
    'Strikes the ring of 8 tiles AROUND the tile 4 ahead: 20 dmg. The middle is safe.'),
  recipe('h2so4', 'H2SO4', 'Sulfuric acid', 'Oil of Vitriol', 2.5, 'mirror', 'attack',
    '3x3 acid splash, 4 ahead: 24 dmg (+10 on wet tiles) and deep puddles.'),
  recipe('c8h18', 'C8H18', 'Octane', 'Octane Wave', 3.0, 'row', 'attack',
    'Wave of flame down your row and the rows beside it: 24 dmg, burns for 3 s.'),
  recipe('nh4no3', 'NH4NO3', 'Ammonium nitrate', 'Big Bang', 3.5, 'mirror', 'attack',
    'Detonates a 3x3 area, 4 ahead: 45 dmg at the centre, 30 around it.'),

  // ---- gas clouds
  recipe('co', 'CO', 'Carbon monoxide', 'Silent Killer', 0, 'mirror', 'zone',
    'Nearly invisible toxic gas, 3 tiles tall, 4 tiles ahead. Flammable.'),
  recipe('cl2', 'Cl2', 'Chlorine', 'Chlorine Cloud', 0, 'mirror', 'zone',
    'Choking toxic cloud in a + shape, 4 tiles ahead. Lingers 5 s.'),
  recipe('h2s', 'H2S', 'Hydrogen sulfide', 'Rotten Egg', 0.5, 'mirror', 'zone',
    'Toxic, flammable stink cloud 3 tiles wide, 4 tiles ahead.'),
  recipe('n2o', 'N2O', 'Nitrous oxide', 'Laughing Gas', 0.5, 'mirror', 'zone',
    'Cloud in a + shape, 4 ahead. Anyone inside turns giddy: their movement is reversed.'),
  recipe('ch4', 'CH4', 'Methane', 'Methane Leak', 1.5, 'mirror', 'zone',
    'Big 3x3 flammable cloud, 4 ahead. Harmless until something lights it: 22 dmg.'),

  // ---- walls (solid barriers on the enemy side; fire, acid, bolts and blasts break them)
  recipe('c2h3cl', 'C2H3Cl', 'Vinyl chloride', 'PVC Wall', 1.0, 'mirror', 'wall',
    'Polymerises into a PVC wall down the whole column 4 ahead. Blocks movement for 8 s. Fire, acid and bolts break it.'),
  recipe('p2o5', 'P2O5', 'Phosphorus pentoxide', 'Oxide Crust', 1.5, 'mirror', 'wall',
    'Hard oxide crust in a + shape, 4 ahead. Blocks movement for 10 s.'),
  recipe('c10h8', 'C10H8', 'Naphthalene', 'Crystal Barrier', 2.5, 'mirror', 'wall',
    'Stacks into a 2x2 crystal block, 4 ahead. Blocks movement for 12 s.'),
  recipe('c6h10o5', 'C6H10O5', 'Cellulose', 'Fiber Barricade', 2.0, 'row', 'wall',
    "Weaves a fiber wall across the enemy's half of your row. Blocks movement for 9 s."),

  // ---- shields (a new shield replaces a weaker one; they do not add up)
  recipe('o3', 'O3', 'Ozone', 'Ozone Shield', 0.5, 'self', 'shield',
    'Shield: absorbs 20 damage. Lasts 6 s.'),
  recipe('c2h4', 'C2H4', 'Ethylene', 'Plastic Shield', 1.0, 'self', 'shield',
    'Polymerises into a polyethylene shield: absorbs 25 damage. Lasts 8 s.'),
  recipe('h3po4', 'H3PO4', 'Phosphoric acid', 'Phosphate Coat', 1.5, 'self', 'shield',
    'Protective phosphate coating: absorbs 35 damage. Lasts 10 s.'),
  recipe('c14h10n2o2', 'C14H10N2O2', 'Kevlar', 'Kevlar Vest', 3.0, 'self', 'shield',
    'Body armour: absorbs 60 damage. Lasts 15 s.'),

  // ---- heals
  recipe('h2o2', 'H2O2', 'Hydrogen peroxide', 'Antiseptic', 1.0, 'self', 'heal',
    'Heal 22.'),
  recipe('c2h6o', 'C2H6O', 'Ethanol', 'Rubbing Alcohol', 1.5, 'self', 'heal',
    'Heal 16. Made entirely from common atoms.'),
  recipe('c9h8o4', 'C9H8O4', 'Aspirin', 'Aspirin', 2.5, 'self', 'heal',
    'Heal 35 and clear giddy, chill, freeze and knockout.'),
  recipe('c6h12o6', 'C6H12O6', 'Glucose', 'Sugar Rush', 3.0, 'self', 'heal',
    'Heal 45, plus haste for 4 s.'),

  // ---- support
  recipe('o2', 'O2', 'Oxygen', 'Fresh Air', 0, 'field', 'support',
    'Heal 6. Fans every fire on the enemy side so it spreads to neighbouring tiles.'),
  recipe('n2', 'N2', 'Nitrogen', 'Inert Blanket', 0, 'self', 'support',
    'Smothers every fire and sweeps every gas cloud off your side.'),
  recipe('nh3', 'NH3', 'Ammonia', 'Smelling Salts', 1.0, 'self', 'support',
    'Clears giddy, chill, freeze and knockout. Haste for 5 s: quicker steps, faster reactions.'),

  // ---- OA nuke (own type — not an attack / organic)
  recipe(TRUMP_ID, 'C30H48O3', 'Oleanolic acid', 'OA Nuke', 5.0, 'field', 'nuke',
    'Strikes the ENTIRE enemy side, all 16 tiles: 80 dmg. Takes 81 atoms, so brew it in one pot while you fight with the other.'),
];

const BY_KEY = new Map(RECIPES.map((r) => [r.key, r]));
export const RECIPE_BY_ID = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

export function findRecipe(atoms) {
  return BY_KEY.get(countsKey(countAtoms(atoms))) || null;
}

// What `have` still needs to become `recipe`, or null if it already holds
// something the recipe does not use.
export function missingFor(recipe, have) {
  const missing = {};
  for (const el of ELEMENT_ORDER) {
    const diff = (recipe.counts[el] || 0) - (have[el] || 0);
    if (diff < 0) return null;
    if (diff > 0) missing[el] = diff;
  }
  return missing;
}

export function buildBag() {
  const bag = [];
  for (const el of ELEMENT_ORDER) for (let i = 0; i < ELEMENTS[el].count; i++) bag.push(el);
  return bag;
}
