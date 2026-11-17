// "What can I make from here?" - the recipes a pot's contents can still become,
// closest to finished first.
import { RECIPES, ELEMENT_ORDER, TRUMP_ID, countAtoms, missingFor } from './data.js';

export function suggest(player, potIndex = player.activePot, limit = 6) {
  const have = countAtoms(player.pots[potIndex].atoms);
  const handCounts = countAtoms(player.hotbar.map((slot) => slot.el));
  const out = [];
  for (const recipe of RECIPES) {
    const missing = missingFor(recipe, have);
    if (!missing) continue;
    // One entry per element still needed: how many, and how many of those are
    // sitting in the hotbar right now.
    const needs = ELEMENT_ORDER.filter((el) => missing[el]).map((el) => ({
      el, n: missing[el], inHand: Math.min(missing[el], handCounts[el] || 0),
    }));
    if (!needs.length) continue; // already complete: the pot itself says so
    const total = needs.reduce((sum, need) => sum + need.n, 0);
    const lacking = needs.reduce((sum, need) => sum + need.n - need.inHand, 0);
    out.push({ recipe, needs, total, lacking });
  }
  out.sort((a, b) => a.lacking - b.lacking || a.total - b.total);
  // The trump card is always the furthest away, so it would never make the
  // list; once a pot is on the way to it, keep its progress in view.
  const top = out.slice(0, limit);
  const trump = out.find((hint) => hint.recipe.id === TRUMP_ID);
  if (trump && !top.includes(trump) && player.pots[potIndex].atoms.length) top[limit - 1] = trump;
  return top;
}

// Can these atoms still become any recipe at all?
export function hasFuture(atoms) {
  const have = countAtoms(atoms);
  return RECIPES.some((recipe) => missingFor(recipe, have));
}
