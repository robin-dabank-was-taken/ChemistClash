// "What can I make from here?" - the recipes a pot's contents can still become,
// closest to finished first.
import { getPack, DEFAULT_PACK_ID } from './packs/index.js';

export function suggest(player, potIndex = player.activePot, limit = 6, packOrId = null) {
  const pack = typeof packOrId === 'string' || !packOrId
    ? getPack(packOrId || DEFAULT_PACK_ID)
    : packOrId;
  const have = pack.countAtoms(player.pots[potIndex].atoms);
  const handCounts = pack.countAtoms(player.hotbar.map((slot) => slot.el));
  const out = [];
  for (const recipe of pack.recipes) {
    const missing = pack.missingFor(recipe, have);
    if (!missing) continue;
    const needs = pack.tokenOrder.filter((el) => missing[el]).map((el) => ({
      el, n: missing[el], inHand: Math.min(missing[el], handCounts[el] || 0),
    }));
    if (!needs.length) continue;
    const total = needs.reduce((sum, need) => sum + need.n, 0);
    const lacking = needs.reduce((sum, need) => sum + need.n - need.inHand, 0);
    out.push({ recipe, needs, total, lacking });
  }
  out.sort((a, b) => a.lacking - b.lacking || a.total - b.total);
  const top = out.slice(0, limit);
  const trump = out.find((hint) => hint.recipe.id === pack.trumpId);
  if (trump && !top.includes(trump) && player.pots[potIndex].atoms.length) top[limit - 1] = trump;
  return top;
}

export function hasFuture(atoms, packOrId = null) {
  const pack = typeof packOrId === 'string' || !packOrId
    ? getPack(packOrId || DEFAULT_PACK_ID)
    : packOrId;
  const have = pack.countAtoms(atoms);
  return pack.recipes.some((recipe) => pack.missingFor(recipe, have));
}
