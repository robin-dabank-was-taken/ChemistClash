import { chemistryPack } from './chemistry/index.js';
import { physicsPack } from './physics/index.js';

export const DEFAULT_PACK_ID = 'chemistry';

export const PACKS = {
  chemistry: chemistryPack,
  physics: physicsPack,
};

export function getPack(packId) {
  return PACKS[packId] || chemistryPack;
}
