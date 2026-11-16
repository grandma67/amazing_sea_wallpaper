// The Earth's size, on its own so any module can read it without importing
// params.ts (terrain.ts did, which kept params.ts from reading the terrain).

/** Mean Earth radius (m). */
export const EARTH_RADIUS = 6_371_000
