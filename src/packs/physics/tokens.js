// Physics building blocks (quanta). Counts ≈ one bag (~44).

export const TOKENS = {
  e: { name: 'Electron', z: 'e⁻', glyph: 'e', color: '#9ad0ff', ink: '#0a1a2a', text: '#9ad0ff', count: 14 },
  p: { name: 'Proton', z: 'p⁺', glyph: 'p', color: '#ff8178', ink: '#2a0a0a', text: '#ff8178', count: 10 },
  g: { name: 'Photon', z: 'γ', glyph: 'γ', color: '#ffe169', ink: '#2a2400', text: '#ffe169', count: 7 },
  q: { name: 'Quark', z: 'q', glyph: 'q', color: '#d49bff', ink: '#1a0a28', text: '#d49bff', count: 4 },
  n: { name: 'Neutron', z: 'n', glyph: 'n', color: '#c9d4e6', ink: '#121820', text: '#c9d4e6', count: 3 },
  B: { name: 'Baryon', z: 'B', glyph: 'B', color: '#86a8ff', ink: '#0a1428', text: '#86a8ff', count: 3 },
  h: { name: 'Quantum', z: 'ℏ', glyph: 'ℏ', color: '#f09be8', ink: '#240a20', text: '#f09be8', count: 2 },
  T: { name: 'Thermal', z: 'T', glyph: 'T', color: '#ff8a3c', ink: '#2a1200', text: '#ff8a3c', count: 1 },
};

export const TOKEN_ORDER = ['e', 'p', 'g', 'q', 'n', 'B', 'h', 'T'];

// Unstable glitches are fuel bombs (dmg 0) — they hurt when lit / detonated.
export const GLITCHES = {
  static: { name: 'Static', color: '#9ad0ff', alpha: 0.45, dmg: 5 },
  charge: { name: 'Charge', color: '#86a8ff', alpha: 0.4, dmg: 4 },
  blackbody: { name: 'Blackbody', color: '#ff8a3c', alpha: 0.42, dmg: 0, unstable: true, boom: 14 },
  probability: { name: 'Probability', color: '#d49bff', alpha: 0.4, dmg: 0, giddy: 2.5 },
  neutron: { name: 'Neutron', color: '#c9d4e6', alpha: 0.38, dmg: 0, unstable: true, boom: 26 },
};
