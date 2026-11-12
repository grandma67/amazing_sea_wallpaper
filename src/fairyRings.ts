// Fairy rings on the grass (NATURE_PLAN phase 10, NATURE.md §2): a ring of
// darker, taller grass at the fungus's advancing edge (the nitrogen it
// frees), on some rings a band of dead grass just inside it (RHS, UF/IFAS
// "Fairy rings": type II a dark green band only, type I with the dead zone).
// Fixed in the world: one ring at most per square cell, its centre, radius and
// look from the cell's integer hash, so the GPU (FAIRY_RING_GLSL, the terrain's
// ground cover) and the CPU (fairyRingAt: tests, phase 12's mushrooms on the
// band) agree to the bit. Only the season reads the day (phenology.ts).
// Imports only cellNoise: terrain.ts imports this.

import { hashCell, vnoise } from './cellNoise'

/** Cell size (m) and the chance a cell holds a ring: 0.1 per 625 m², 1.6 per
 * hectare (est., in the plan's 0–3). */
export const FAIRY_CELL = 25
export const FAIRY_CHANCE = 0.1
/** Ring radius (m): 1 + 11 u³, so diameters 2–10 m on ~3/4 of rings, up to
 * 24 m (RHS: "commonly 2–10 m, over 10 m sometimes"). Must stay under the
 * cell so a 3 × 3 cell search finds every ring over a point. */
export const FAIRY_RADIUS: readonly [number, number] = [1, 11]
/** The dark band's half-width (m): 0.2–0.3 (bands 0.4–0.6 m, the upper half
 * of the plan's 0.3–0.6 m est.: 0.3–0.45 read as a thread at 20 m). */
export const FAIRY_BAND: readonly [number, number] = [0.2, 0.1]
/** Share of rings with a dead band inside the green one, its width (m). */
export const FAIRY_DEAD_SHARE = 0.4
export const FAIRY_DEAD: readonly [number, number] = [0.2, 0.2]
/** Colour of the dark band against the ground cover, est.: greener and
 * ~0.7 of its luminance (the plan's `[0.04, 0.115, 0.02]` against `[0.08,
 * 0.13, 0.05]` is 0.79, and drew a bright-green thread, not a dark ring). */
export const FAIRY_DARK: readonly [number, number, number] = [0.5, 0.75, 0.4]
/** Dead grass in the inner band: the ground cover's straw (phenology.ts). */
export const FAIRY_DEAD_COLOR: readonly [number, number, number] = [0.2, 0.15, 0.075]

const U32 = 4294967295

/** The ring in cell (cx, cz), or null: centre (x, z, noise coordinates),
 * radius, band half-width, dead-band width (0: none) and a key for its
 * gaps and wobble. */
export function fairyRingCell(cx: number, cz: number): { x: number; z: number; r: number; band: number; dead: number; key: number } | null {
  if (hashCell(cx * 3 + 7001, cz * 5 - 3001) / U32 >= FAIRY_CHANCE) return null
  const h = (k: number): number => hashCell(cx * 7 + k, cz * 11 - k) / U32
  const u = h(1)
  return {
    x: (cx + h(2)) * FAIRY_CELL,
    z: (cz + h(3)) * FAIRY_CELL,
    r: FAIRY_RADIUS[0] + FAIRY_RADIUS[1] * u * u * u,
    band: FAIRY_BAND[0] + FAIRY_BAND[1] * h(4),
    dead: h(5) < FAIRY_DEAD_SHARE ? FAIRY_DEAD[0] + FAIRY_DEAD[1] * h(6) : 0,
    key: h(7) * 100
  }
}

/** How much of the ring's circumference shows at angle `t` (radians): rings
 * are often broken into arcs (est.: ~1/4 missing), the wobble ±6%. */
function ringShape(key: number, t: number, r: number): { gap: number; wobble: number } {
  // Round the ring, noise on a circle of circumference ~ r / 3 cells.
  const k = Math.max(2, r / 1.5)
  const [cx, cz] = [Math.cos(t) * k, Math.sin(t) * k]
  const gap = smooth(0.22, 0.34, vnoise(cx + key, cz + key * 1.3))
  const wobble = 1 + 0.12 * (vnoise(cx * 0.7 + key + 31, cz * 0.7 + key + 17) - 0.5)
  return { gap, wobble }
}

/** A point on a ring's band at angle `t` (noise coordinates) and how much of
 * the ring shows there (0 in a gap): phase 12's mushrooms on the band. */
export function fairyRingPoint(ring: NonNullable<ReturnType<typeof fairyRingCell>>, t: number): { x: number; z: number; gap: number } {
  const { gap, wobble } = ringShape(ring.key, t, ring.r)
  return { x: ring.x + Math.cos(t) * ring.r * wobble, z: ring.z + Math.sin(t) * ring.r * wobble, gap }
}

function smooth(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** At noise coordinates (qx, qz) = world + `coast.noiseOffset`: the dark
 * band's weight and the dead band's (0..1), sharp (no pixel footprint). */
export function fairyRingAt(qx: number, qz: number): { dark: number; dead: number } {
  const [cx, cz] = [Math.floor(qx / FAIRY_CELL), Math.floor(qz / FAIRY_CELL)]
  let dark = 0
  let dead = 0
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const ring = fairyRingCell(cx + i, cz + j)
      if (ring == null) continue
      const [dx, dz] = [qx - ring.x, qz - ring.z]
      const d = Math.hypot(dx, dz)
      if (d > ring.r * 1.1 + ring.band + 0.2) continue
      const { gap, wobble } = ringShape(ring.key, Math.atan2(dz, dx), ring.r)
      const off = d - ring.r * wobble
      dark = Math.max(dark, gap * (Math.abs(off) < ring.band ? 1 : 0))
      if (ring.dead > 0) dead = Math.max(dead, gap * (off < -ring.band && off > -ring.band - ring.dead ? 1 : 0))
    }
  }
  return { dark, dead }
}

const f = (v: number): string => v.toFixed(6)

/**
 * GLSL (needs `hashCell`, `vnoise` from TERRAIN_GLSL): `fairyRing(q, fp)` →
 * (dark, dead) at noise point q, each band widened to the pixel footprint
 * `fp` (m) and dimmed by the share of the pixel it covers, so far rings fade
 * to their mean instead of flickering.
 */
export const FAIRY_RING_GLSL = /* glsl */ `
float fairyCellValue(ivec2 c, int k) {
  return float(hashCell(ivec2(c.x * 7 + k, c.y * 11 - k))) / ${U32}.0;
}

// The fraction of a pixel of width fp that a band of half-width w at offset
// off covers (a box filter).
float fairyCover(float off, float w, float fp) {
  return clamp((min(off + 0.5 * fp, w) - max(off - 0.5 * fp, -w)) / fp, 0.0, 1.0);
}

vec2 fairyRing(vec2 q, float fp) {
  ivec2 c0 = ivec2(floor(q / ${f(FAIRY_CELL)}));
  vec2 res = vec2(0.0);
  fp = max(fp, 0.02);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      ivec2 c = c0 + ivec2(i, j);
      if (float(hashCell(ivec2(c.x * 3 + 7001, c.y * 5 - 3001))) / ${U32}.0 >= ${f(FAIRY_CHANCE)}) continue;
      float u = fairyCellValue(c, 1);
      vec2 centre = (vec2(c) + vec2(fairyCellValue(c, 2), fairyCellValue(c, 3))) * ${f(FAIRY_CELL)};
      float r = ${f(FAIRY_RADIUS[0])} + ${f(FAIRY_RADIUS[1])} * u * u * u;
      float band = ${f(FAIRY_BAND[0])} + ${f(FAIRY_BAND[1])} * fairyCellValue(c, 4);
      float dead = fairyCellValue(c, 5) < ${f(FAIRY_DEAD_SHARE)} ? ${f(FAIRY_DEAD[0])} + ${f(FAIRY_DEAD[1])} * fairyCellValue(c, 6) : 0.0;
      float key = fairyCellValue(c, 7) * 100.0;
      vec2 d2 = q - centre;
      float d = length(d2);
      if (d > r * 1.1 + band + 0.2 + fp) continue;
      float t = atan(d2.y, d2.x);
      float k = max(2.0, r / 1.5);
      vec2 cs = vec2(cos(t), sin(t)) * k;
      float gap = smoothstep(0.22, 0.34, vnoise(cs + vec2(key, key * 1.3)));
      float wobble = 1.0 + 0.12 * (vnoise(cs * 0.7 + vec2(key + 31.0, key + 17.0)) - 0.5);
      float off = d - r * wobble;
      res.x = max(res.x, gap * fairyCover(off, band, fp));
      if (dead > 0.0) res.y = max(res.y, gap * fairyCover(off + band + 0.5 * dead, 0.5 * dead, fp));
    }
  }
  return res;
}
`
