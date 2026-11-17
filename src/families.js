// Chemistry families for recipes. Oleanolic acid is its own `nuke` family —
// never folded into organic or generic attack buffs.
import { RECIPE_BY_ID, TRUMP_ID } from './data.js';

export const FAMILIES = {
  acid: { name: 'Acid', color: '#9be33c' },
  base: { name: 'Base', color: '#86a8ff' },
  toxin: { name: 'Toxin', color: '#d49bff' },
  oxidizer: { name: 'Oxidizer', color: '#ff8a3c' },
  organic: { name: 'Organic', color: '#ffb23c' },
  aqueous: { name: 'Aqueous', color: '#5db8ff' },
  polymer: { name: 'Polymer', color: '#c4b49a' },
  heal: { name: 'Heal', color: '#7dffa0' },
  nuke: { name: 'Nuke', color: '#ffd24a' },
};

// Primary family of each recipe. Secondary tags (e.g. oxidizer+organic) live
// on the character traits, not here.
export const FAMILY_OF = {
  hcl: 'acid', so2: 'acid', hno3: 'acid', h2so4: 'acid', h3po4: 'acid',
  nh3: 'base', n2: 'base',
  hcn: 'toxin', chcl3: 'toxin', co: 'toxin', cl2: 'toxin', h2s: 'toxin', n2o: 'toxin', c6h6: 'toxin',
  o2: 'oxidizer', o3: 'oxidizer', h2o2: 'oxidizer', p4: 'oxidizer', n2h4: 'oxidizer',
  h2: 'organic', c2h2: 'organic', ph3: 'organic', c3h8: 'organic', c8h18: 'organic',
  ch4: 'organic', nh4no3: 'organic',
  h2o: 'aqueous', co2: 'aqueous',
  c2h3cl: 'polymer', p2o5: 'polymer', c10h8: 'polymer', c6h10o5: 'polymer',
  c2h4: 'polymer', c14h10n2o2: 'polymer',
  c2h6o: 'heal', c9h8o4: 'heal', c6h12o6: 'heal',
  [TRUMP_ID]: 'nuke',
};

export function familyOf(recipeOrId) {
  const id = typeof recipeOrId === 'string' ? recipeOrId : recipeOrId?.id;
  return (recipeOrId && recipeOrId.family) || FAMILY_OF[id] || null;
}

export function recipesInFamily(family) {
  return Object.keys(FAMILY_OF).filter((id) => FAMILY_OF[id] === family).map((id) => RECIPE_BY_ID[id]);
}

// Stamp family onto each recipe object once at load.
for (const [id, fam] of Object.entries(FAMILY_OF)) {
  if (RECIPE_BY_ID[id]) RECIPE_BY_ID[id].family = fam;
}
