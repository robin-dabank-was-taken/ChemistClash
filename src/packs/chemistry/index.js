// Chemistry pack: thin wrapper over today's modules.
import {
  ELEMENTS, ELEMENT_ORDER, GASES, RECIPES, RECIPE_BY_ID, TRUMP_ID, NUKE_ID,
  findRecipe, missingFor, countsKey, countAtoms, formulaLabel, hillParts, buildBag,
} from '../../data.js';
import { FAMILIES, familyOf } from '../../families.js';
import { EFFECTS } from '../../sim/effects.js';
import { CHARACTERS } from '../../characters.js';

export const chemistryPack = {
  id: 'chemistry',
  name: 'Chemistry',
  noun: 'atom',
  tokens: ELEMENTS,
  tokenOrder: ELEMENT_ORDER,
  ELEMENTS,
  ELEMENT_ORDER,
  gases: GASES,
  glitches: {},
  recipes: RECIPES,
  RECIPE_BY_ID,
  trumpId: TRUMP_ID,
  NUKE_ID,
  TRUMP_ID,
  findRecipe,
  missingFor,
  countsKey,
  countAtoms,
  formulaLabel,
  hillParts,
  families: FAMILIES,
  familyOf,
  characters: CHARACTERS,
  effects: EFFECTS,
  buildBag,
};
