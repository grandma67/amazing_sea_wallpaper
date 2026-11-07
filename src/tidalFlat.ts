import { fbm, hillNoise, smoothstep, vnoise } from './cellNoise'
import type { RGB } from './biome'
import type { Random } from './random'
import { ROCK_MIN_FACE } from './rockShore'

// Tidal flats and salt marsh (PLAN_BIOMES 9; knowledge/plans/TIDAL_FLAT.md):
// where the tide is big and the waves small, kilometres of bare sand and mud
// that the sea leaves twice a day, a salt marsh at the back.
//
// The land frame's s = 0 is the foot of the marsh edge, at about mean high
// water; heights are above mean sea and the terrain sits `tide.level` lower,
// as on beaches. The bare profile, inland to seaward:
//   land behind | marsh, a near-level platform at about spring high water |
//   the marsh edge, a low cliff | the flat, straight from `top` (s = 0) to
//   `low` (s = width) | the subtidal bed toward −seabedDepth.
// Creeks are cut into it (flatCreeks). No imports from terrain.ts or
// tides.ts (they import each other's dependents).

export interface TidalFlat {
  /** Width of the flat, from the marsh edge to spring low water (m). */
  width: number
  /** Heights above mean sea at the marsh edge's foot (s = 0) and at the
   * flat's seaward end (m). */
  top: number
  low: number
  /** Main channels: spacing along the shore (m), width and depth where they
   * leave the flat (m); they narrow and shallow landward. */
  channelSpacing: number
  channelWidth: number
  channelDepth: number
  /** Small creeks: spacing along the shore (m). */
  creekSpacing: number
  /** The mud near the marsh (linear albedo); it grades to the sand seaward. */
  mud: RGB
}

/** A salt marsh behind a tidal flat or a beach. */
export interface SaltMarsh {
  /** Where it starts, inland of s = 0 (m): 0 on a flat (its edge is s = 0),
   * the back of the sand on a beach. */
  start: number
  /** Its width (m). */
  width: number
  /** Heights above mean sea at its seaward edge (low marsh) and at its back
   * (high marsh, above the highest tides) (m). */
  height: number
  back: number
}

/** The high marsh stands this far above the spring high water (m): only
 * surges reach it. */
const HIGH_MARSH = 0.5
/** Main channels are this wide and deep where they start in the marsh (m). */
const CHANNEL_HEAD_WIDTH = 3
const CHANNEL_HEAD_DEPTH = 0.4
/** Meanders: amplitude × spacing, wavelength (m). */
const MEANDER = 0.25
const MEANDER_LENGTH = 220
/** Small creeks: half width (m) and depth (m). */
const CREEK_HALF = 2
const CREEK_DEPTH = 0.18

/** The day's tidal flat and its marsh: every draw on `rng` (stream
 * 'tidal-flat'). `springRange`: the tide the shore is built for (tides.ts);
 * `mud`: the place's mud colour. */
export function tidalFlatFor(springRange: number, mud: RGB, rng: Random): { flat: TidalFlat; marsh: SaltMarsh; nearshoreSlope: number } {
  const u = Array.from({ length: 9 }, () => rng.float())
  const top = 0.42 * springRange
  const low = -0.5 * springRange - 0.3
  // Steeper for a bigger tide; the width changes less.
  const slope = (0.0005 + 0.0002 * springRange) * (0.7 + 0.6 * u[0])
  const width = Math.min(5000, Math.max(800, (top - low) / slope))
  const spring = springRange / 2
  const edge = 0.2 + 0.6 * u[1]
  return {
    flat: {
      width,
      top,
      low,
      channelSpacing: 250 + 450 * u[2],
      channelWidth: 15 + 30 * u[3],
      channelDepth: 0.8 + 1.2 * u[4],
      creekSpacing: 50 + 70 * u[5],
      mud
    },
    marsh: { start: 0, width: 80 + 320 * u[6], height: Math.min(top + edge, spring + 0.2), back: spring + HIGH_MARSH },
    nearshoreSlope: 0.002 + 0.004 * u[7]
  }
}

/** What the flat's height reads of the coast (CoastParams fields). */
export interface FlatCoast {
  flat: TidalFlat | null
  marsh: SaltMarsh | null
  noiseOffset: [number, number]
  nearshoreSlope: number
  seabedDepth: number
  hillHeight: number
  wobble: number
  tide: { level: number }
}

/** The marsh edge's run (m): at least ROCK_MIN_FACE × the distance from the
 * camera, or it zig-zags across the terrain grid. */
function edgeRun(distance: number): number {
  return Math.max(0.6, ROCK_MIN_FACE * distance)
}

/** The bare profile at s (m above mean sea; no creeks, relief, hills or
 * tide). `distance` from the camera widens the marsh edge. Mirrors
 * TERRAIN_GLSL bareFlat. */
export function bareFlat(flat: TidalFlat, marsh: SaltMarsh, nearshoreSlope: number, seabedDepth: number, s: number, distance = 0): number {
  const run = edgeRun(distance)
  if (s <= -run) return marsh.height + (marsh.back - marsh.height) * smoothstep(0, 1, (-s - run) / marsh.width)
  if (s < 0) return flat.top + (marsh.height - flat.top) * smoothstep(0, 1, -s / run)
  if (s <= flat.width) return flat.top + ((flat.low - flat.top) * s) / flat.width
  const range = Math.max(1, seabedDepth + flat.low)
  return flat.low - range * (1 - Math.exp(Math.max((-(s - flat.width) * nearshoreSlope) / range, -10)))
}

/** t in 0..1 where t²(3 − 2t) = k. */
function invertSmoothstep(k: number): number {
  let lo = 0
  let hi = 1
  for (let i = 0; i < 40; i++) {
    const t = (lo + hi) / 2
    if (t * t * (3 - 2 * t) < k) lo = t
    else hi = t
  }
  return (lo + hi) / 2
}

/** Where the water is at `level` (m above mean sea) on the bare profile:
 * its seaward distance s (m). Inverts bareFlat (at the camera, distance 0). */
export function flatWaterline(flat: TidalFlat, marsh: SaltMarsh, nearshoreSlope: number, seabedDepth: number, level: number): number {
  if (level >= marsh.height) {
    // Invert the marsh's smoothstep rise.
    const k = Math.min(1, (level - marsh.height) / (marsh.back - marsh.height))
    return -edgeRun(0) - marsh.width * invertSmoothstep(k)
  }
  if (level >= flat.top) {
    return -invertSmoothstep((level - flat.top) / (marsh.height - flat.top)) * edgeRun(0)
  }
  if (level >= flat.low) return (flat.width * (flat.top - level)) / (flat.top - flat.low)
  const range = Math.max(1, seabedDepth + flat.low)
  const depth = Math.min(flat.low - level, 0.95 * range)
  return flat.width - (range / nearshoreSlope) * Math.log(1 - depth / range)
}

/** How deep a set of meandering channels cuts at (s, a), 0..1 (1 on a
 * channel's floor), and the channel's half width there. Mirrors
 * TERRAIN_GLSL flatChannel. */
function channel(coast: FlatCoast, s: number, a: number, spacing: number, half: number, key: number): number {
  const [ox, oz] = coast.noiseOffset
  const m = MEANDER * spacing * (vnoise(s / MEANDER_LENGTH + ox, a / (2 * spacing) + key + oz) * 2 - 1)
  const w = (a + m) / spacing + key
  const d = Math.abs(w - Math.floor(w) - 0.5) * spacing
  const k = Math.min(1, d / half)
  return 1 - k * k
}

/** The creeks' cut below the bare profile at (s, a) (m, ≥ 0): main channels
 * from inside the marsh to the flat's end, widening and deepening seaward,
 * and small creeks on the upper flat that come and go. `distance` from the
 * camera widens and shallows them alike (the same cross-section area), or
 * they zig-zag across the grid. Mirrors TERRAIN_GLSL flatCreeks. */
export function flatCreeks(coast: FlatCoast, s: number, a: number, distance = 0): number {
  const flat = coast.flat!
  const marsh = coast.marsh!
  const [ox, oz] = coast.noiseOffset
  const minHalf = 0.02 * distance
  const t = smoothstep(-0.6 * marsh.width, flat.width, s)
  const inFlat = smoothstep(-0.7 * marsh.width, -0.4 * marsh.width, s)
  let cut = 0
  {
    const half = CHANNEL_HEAD_WIDTH / 2 + ((flat.channelWidth - CHANNEL_HEAD_WIDTH) / 2) * t
    const wide = Math.max(half, minHalf)
    const depth = (CHANNEL_HEAD_DEPTH + (flat.channelDepth - CHANNEL_HEAD_DEPTH) * t) * (half / wide)
    cut = Math.max(cut, depth * inFlat * channel(coast, s, a, flat.channelSpacing, wide, 0.37))
  }
  {
    const wide = Math.max(CREEK_HALF, minHalf)
    const reach = smoothstep(-0.8 * marsh.width, -0.5 * marsh.width, s) * (1 - smoothstep(0.4 * flat.width, 0.6 * flat.width, s))
    const comes = smoothstep(0.35, 0.55, vnoise(s / 90 + 3.1 + ox, a / flat.creekSpacing + 17.3 + oz))
    const depth = CREEK_DEPTH * (CREEK_HALF / wide)
    cut = Math.max(cut, depth * reach * comes * channel(coast, s, a, flat.creekSpacing, wide, 0.71))
  }
  return cut
}

/** A tidal flat's height at shore coords (s, a), world (x, z) (mirrors
 * TERRAIN_GLSL flatHeightAt; the camera is at the world origin). */
export function flatSurface(coast: FlatCoast, s: number, a: number, x: number, z: number): number {
  const flat = coast.flat!
  const marsh = coast.marsh!
  const [ox, oz] = coast.noiseOffset
  const u = -s
  const qx = x + ox
  const qz = z + oz
  const dist = Math.hypot(x, z)
  let h = bareFlat(flat, marsh, coast.nearshoreSlope, coast.seabedDepth, s, dist)
  const back = marsh.width
  h += hillNoise(coast.hillHeight, smoothstep(back + 30, back + 530, u), qx, qz)
  // Low hummocks in the marsh and land, a few centimetres on the flat.
  h += (fbm(qx / 30, qz / 30) - 0.5) * (0.06 + 0.14 * smoothstep(0, 4, u))
  h -= flatCreeks(coast, s, a, dist) * (1 - smoothstep(back - 10, back, u))
  return h - coast.tide.level
}

/** The ground under the camera (world origin) above today's sea (m). Its
 * shore coords: s = −distanceToWater less the coast's wobble at a = 0. */
export function flatGround(coast: FlatCoast & { distanceToWater: number }, wobble: number): number {
  return flatSurface(coast, -coast.distanceToWater - wobble, 0, 0, 0)
}

/** How the marsh looks in a month: the sward's colour, and an accent in
 * patches (linear albedo; `amount` 0–1 of the low marsh). */
export interface MarshLook {
  color: RGB
  accent: RGB
  amount: number
}

const PURPLE: RGB = [0.13, 0.07, 0.17]
const RED: RGB = [0.24, 0.045, 0.035]
const RUST: RGB = [0.15, 0.065, 0.04]

/** The marsh by northern-hemisphere month (seasons.ts seasonMonth): straw
 * brown in winter, green from April, sea lavender and sea aster purple in
 * July–August, Salicornia and Suaeda red on the low marsh in September and
 * October (Panjin's red beach), browning in November. */
export const MARSH_LOOK: readonly MarshLook[] = [
  { color: [0.13, 0.11, 0.07], accent: RUST, amount: 0 }, // Jan
  { color: [0.13, 0.11, 0.07], accent: RUST, amount: 0 },
  { color: [0.11, 0.105, 0.06], accent: RUST, amount: 0 },
  { color: [0.075, 0.1, 0.04], accent: RUST, amount: 0 },
  { color: [0.06, 0.1, 0.03], accent: RUST, amount: 0 },
  { color: [0.06, 0.1, 0.035], accent: PURPLE, amount: 0.1 }, // Jun
  { color: [0.065, 0.095, 0.035], accent: PURPLE, amount: 0.35 },
  { color: [0.07, 0.09, 0.035], accent: PURPLE, amount: 0.35 },
  { color: [0.08, 0.09, 0.04], accent: RED, amount: 0.45 }, // Sep
  { color: [0.1, 0.085, 0.045], accent: RED, amount: 0.5 },
  { color: [0.12, 0.1, 0.06], accent: RUST, amount: 0.3 },
  { color: [0.13, 0.11, 0.07], accent: RUST, amount: 0 } // Dec
]

/** The marsh's look in a northern-hemisphere month (1–12). */
export function marshLook(month: number): MarshLook {
  return MARSH_LOOK[(month - 1) % 12]
}
