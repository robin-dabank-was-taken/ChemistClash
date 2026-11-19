import { TOKENS, TOKEN_ORDER, GLITCHES } from './tokens.js';
import {
  RECIPES, RECIPE_BY_ID, TRUMP_ID, NUKE_ID, findRecipe, missingFor, countsKey, countParts, formulaLabel,
} from './recipes.js';
import { FAMILIES, FAMILY_OF } from './families.js';
import { EFFECTS } from './effects.js';
import { PHYSICS_CHARACTERS } from './characters.js';

export function buildBag() {
  const bag = [];
  for (const el of TOKEN_ORDER) for (let i = 0; i < TOKENS[el].count; i++) bag.push(el);
  return bag;
}

export function familyOf(recipeOrId) {
  const id = typeof recipeOrId === 'string' ? recipeOrId : recipeOrId?.id;
  return (recipeOrId && recipeOrId.family) || FAMILY_OF[id] || null;
}

export const physicsPack = {
  id: 'physics',
  name: 'Physics',
  noun: 'quanta',
  tokens: TOKENS,
  tokenOrder: TOKEN_ORDER,
  // chemistry ELEMENTS alias used by some render helpers
  get ELEMENTS() { return TOKENS; },
  get ELEMENT_ORDER() { return TOKEN_ORDER; },
  gases: {},
  glitches: GLITCHES,
  recipes: RECIPES,
  RECIPE_BY_ID,
  trumpId: TRUMP_ID,
  NUKE_ID,
  TRUMP_ID,
  findRecipe,
  missingFor,
  countsKey,
  countAtoms: countParts,
  formulaLabel,
  hillParts(counts) {
    return TOKEN_ORDER.filter((e) => counts[e]).map((e) => [e, counts[e]]);
  },
  families: FAMILIES,
  familyOf,
  characters: PHYSICS_CHARACTERS,
  effects: EFFECTS,
  buildBag,
};
