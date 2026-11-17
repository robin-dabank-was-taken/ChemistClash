// Apply a caster's character buffs/debuffs to damage, heals, shields, and durations.
import { familyOf } from '../families.js';
import { getCharacter } from '../characters.js';

const FAMILY_IDS = new Set(['acid', 'base', 'toxin', 'oxidizer', 'organic', 'aqueous', 'polymer', 'heal', 'nuke']);

function resolveFamily(familyOrRecipe) {
  if (typeof familyOrRecipe === 'string' && FAMILY_IDS.has(familyOrRecipe)) return familyOrRecipe;
  return familyOf(familyOrRecipe);
}

function sideFor(p, family) {
  const c = p.character || getCharacter(p.characterId);
  if (c.buff?.families?.includes(family)) return c.buff;
  if (c.debuff?.families?.includes(family)) return c.debuff;
  return null;
}

export function modDamage(caster, familyOrRecipe, amount) {
  if (!caster) return amount;
  const family = resolveFamily(familyOrRecipe);
  if (!family) return amount;
  const side = sideFor(caster, family);
  if (!side || side.damage == null) return amount;
  return Math.max(0, Math.round(amount * side.damage));
}

export function modHeal(caster, amount) {
  if (!caster) return amount;
  const side = sideFor(caster, 'heal');
  if (!side || side.heal == null) return amount;
  return Math.max(0, Math.round(amount * side.heal));
}

export function modShield(caster, amount, family = 'polymer') {
  if (!caster) return amount;
  const side = sideFor(caster, family);
  if (!side || side.shield == null) return amount;
  return Math.max(0, Math.round(amount * side.shield));
}

export function modDuration(caster, familyOrRecipe, duration) {
  if (!caster) return duration;
  const family = resolveFamily(familyOrRecipe);
  if (!family) return duration;
  const side = sideFor(caster, family);
  if (!side || side.duration == null) return duration;
  return Math.max(0.05, +(duration * side.duration).toFixed(3));
}

export function attachCharacter(p, characterId) {
  const c = getCharacter(characterId);
  p.characterId = c.id;
  p.character = c;
  return p;
}
