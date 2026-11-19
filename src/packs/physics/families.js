export const FAMILIES = {
  kinetic: { name: 'Kinetic', color: '#ffb23c' },
  em: { name: 'EM', color: '#9ad0ff' },
  quantum: { name: 'Quantum', color: '#d49bff' },
  thermal: { name: 'Thermal', color: '#ff8a3c' },
  nuclear: { name: 'Nuclear', color: '#c9d4e6' },
  field: { name: 'Field', color: '#86a8ff' },
  wave: { name: 'Wave', color: '#7dffa0' },
  barrier: { name: 'Barrier', color: '#b8c8e8' },
  heal: { name: 'Heal', color: '#7dffa0' },
  nuke: { name: 'Nuke', color: '#ffd24a' },
};

export const TRUMP_ID = 'hawking';

/** recipeId → family */
export const FAMILY_OF = {
  sparkbolt: 'em', photocannon: 'em', coulomb: 'em', lorentz: 'em', synchrotron: 'em',
  momentum: 'kinetic', impact: 'kinetic', cascade: 'kinetic', annihilation: 'kinetic',
  tunnel: 'quantum', decohere: 'quantum',
  plasma: 'thermal', entropy: 'thermal', redshift: 'thermal',
  fission: 'nuclear', neutronjet: 'nuclear',
  fluxwall: 'field', magnetar: 'field',
  barrier: 'barrier', lattice: 'barrier', zeropoint: 'barrier',
  coherence: 'heal', coolbath: 'heal', restore: 'heal',
  wavepulse: 'wave', standing: 'wave', phasealign: 'wave',
  staticfield: 'em', chargecorrupt: 'em', blackbodytear: 'thermal',
  probglitch: 'quantum', neutronscramble: 'nuclear', vacfluc: 'quantum',
  kevlarfield: 'barrier', plasmeshield: 'barrier',
  inertframe: 'field',
  [TRUMP_ID]: 'nuke',
};
