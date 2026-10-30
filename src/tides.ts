import type { BeachMaterial } from './beach'
import type { BeachState } from './beachState'
import type { CoastParams } from './params'
import { lagoonSlope, type Reef } from './reef'
import type { Random } from './random'

// Tides (PLAN_BIOMES phase 5). Each place has a mean range (places.ts, from
// knowledge/REGIONS.md §3); the day's range follows the moon (springs at new
// and full moon, neaps at the quarters) and the level is a random point of
// the semidiurnal cycle (real high-water times depend on each port; a random
// phase is right for an unnamed beach).
//
// Tides lower the land instead of raising the sea (decision 6): sea level 0
// stays everywhere, and the terrain (terrain.ts) and everything standing on
// it sit `level` lower. The beach is built for its spring range: a micro-tidal
// beach face spans ±1 m; above that a low-tide terrace is set in between the
// high-tide beach and the sea (Brittany, Fundy), so the land frame's s = 0 is
// the foot of the high-tide beach, and mean sea lies on the terrace.

export type TideStage = 'low' | 'mid' | 'high'

export interface Tide {
  /** The place's mean range (m), between springs and neaps. */
  mean: number
  /** The range the beach is built for (m): mean springs, or today's if bigger. */
  springRange: number
  /** Today's range (m), low to high water. */
  range: number
  /** Water level above mean sea (m), −range/2..range/2. */
  level: number
  /** Semidiurnal phase (rad): 0 high water, π low water. */
  phase: number
}

/** A low-tide terrace between the high-tide beach (s = 0, height +height
 * above mean sea) and low water (s = width, −height). */
export interface Terrace {
  height: number
  width: number
}

/** Below this range (micro-tidal, m) the beach face alone spans the tide. */
export const MICRO_TIDE = 2
/** Spring and neap ranges × the mean: Incheon's spring/neap ≈ 1.46 (REGIONS.md §3). */
export const SPRING = 1.2
export const NEAP = 0.8
/** Springs come about a day and a half after new and full moon (the age of
 * the tide), ~12° of moon phase a day. */
const TIDE_AGE_DEG = 18
/** Low-tide terraces: ~1:65, and no wider than 400 m (wider ones are tidal
 * flats, phase 9). */
const TERRACE_SLOPE = 0.015
const TERRACE_MAX = 400

const STAGE_PHASE: Record<TideStage, number> = { high: 0, mid: Math.PI / 2, low: Math.PI }

/** Spring–neap factor on the mean range: × 1.2 at springs, × 0.8 at neaps. */
export function springFactor(moonPhaseDeg: number): number {
  const mid = (SPRING + NEAP) / 2
  const amp = (SPRING - NEAP) / 2
  return mid + amp * Math.cos((2 * (moonPhaseDeg - TIDE_AGE_DEG) * Math.PI) / 180)
}

/** The day's tide at a place of mean range `[lo, hi]` (m): two draws on the
 * `'tide'` stream (the beach's mean range, the phase), then the spec forces
 * the stage and the range. */
export function tideFor(
  mean: readonly [number, number],
  moonPhaseDeg: number,
  rng: Random,
  force: { tide?: TideStage; tidalRange?: number } = {}
): Tide {
  const meanRange = mean[0] + (mean[1] - mean[0]) * rng.float()
  const drawnPhase = rng.range(0, 2 * Math.PI)
  const range = force.tidalRange ?? meanRange * springFactor(moonPhaseDeg)
  const phase = force.tide != null ? STAGE_PHASE[force.tide] : drawnPhase
  return {
    mean: meanRange,
    springRange: Math.max(meanRange * SPRING, range),
    range,
    level: (range / 2) * Math.cos(phase),
    phase
  }
}

/** The terrace a beach of this spring range needs: none on micro-tidal
 * beaches, else ±(range − 2 m)/2 around mean sea at ~1:65, flattened to stay
 * within 400 m. */
export function terraceFor(springRange: number): Terrace {
  const height = Math.max(0, (springRange - MICRO_TIDE) / 2)
  if (height === 0) return { height: 0, width: 0 }
  const slope = Math.max(TERRACE_SLOPE, (2 * height) / TERRACE_MAX)
  return { height, width: (2 * height) / slope }
}

/** Height of the spring high water above the foot of the high-tide beach
 * (land frame, m): up to 1 m (MICRO_TIDE / 2). */
export function highWater(coast: { tide?: Pick<Tide, 'springRange'>; terrace?: Terrace }): number {
  return Math.max(0, (coast.tide?.springRange ?? 0) / 2 - (coast.terrace?.height ?? 0))
}

/** World heights (sea level 0) of today's high water and of the spring high
 * water, the highest the sea has reached lately (plants and wrack above it). */
export function tideMarks(coast: Pick<CoastParams, 'tide'>): { high: number; spring: number } {
  const { range, springRange, level } = coast.tide
  return { high: range / 2 - level, spring: springRange / 2 - level }
}

/** Relative tide range RTR = range / Hb (Masselink & Short 1993): below 3
 * the waves shape the beach; 3–10 tide-modified, above 10 tide-dominated. */
export function relativeTideRange(range: number, breaker: number): number {
  return range / Math.max(breaker, 0.05)
}

/** The wave-dominated state, modified by the tide (Masselink & Short 1993;
 * Short 2006): a sand beach with a big tide for its waves keeps a steep
 * high-tide beach over a low-tide terrace (reflective + terrace), or a
 * low-tide bar cut by rips, or goes ultradissipative; tide-dominated ones
 * are a terrace or ultradissipative, grading into tidal flats. Gravel stays
 * reflective. */
export function tideModified(state: BeachState, material: BeachMaterial, rtr: number): BeachState {
  if (rtr < 3 || material === 'shingle' || material === 'cobble') return state
  if (state === 'reflective' || state === 'low-tide-terrace') return 'low-tide-terrace'
  if (material === 'mixed') return 'low-tide-terrace'
  if (rtr >= 10 || state === 'dissipative') return 'dissipative'
  return 'transverse-bar-rip'
}

/** Where the water is at `level` (m above mean sea): its seaward distance s in
 * the land frame, on the bare profile (no bars, cusps or noise). */
export function waterlineAt(
  coast: Pick<CoastParams, 'beachSlope' | 'beachWidth' | 'nearshoreSlope' | 'seabedDepth' | 'terrace'> & {
    tide?: Pick<Tide, 'springRange'>
    reef?: Reef | null
  },
  level: number
): number {
  const { height, width } = coast.terrace
  if (level >= height) return -inlandAt(coast, level - height)
  if (level >= -height) return (width * (height - level)) / (2 * height)
  // Behind a reef the beach face runs down to the lagoon floor
  // (terrain.ts reefHeight).
  const floor = coast.reef != null ? Math.max(0.1, coast.reef.lagoonDepth - height) : coast.seabedDepth
  const slope = coast.reef != null ? lagoonSlope({ ...coast, reef: coast.reef }) : coast.nearshoreSlope
  const depth = Math.min(-(level + height), floor * 0.95)
  return width - (floor / slope) * Math.log(1 - depth / floor)
}

/** Height of the bare high-tide beach `u` m inland of its foot: the face
 * levelling off at the back, plus a berm as high as the spring high water
 * (the swash builds it) over the beach's width. Mirrors beachHeightAt's beach
 * and berm terms. */
export function bareBeach(coast: Pick<CoastParams, 'beachSlope' | 'beachWidth'> & { tide?: Pick<Tide, 'springRange'>; terrace?: Terrace }, u: number): number {
  const w = coast.beachWidth
  const t = Math.min(1, Math.max(0, u / w))
  return coast.beachSlope * w * (1 - Math.exp(-u / w)) + highWater(coast) * t * t * (3 - 2 * t)
}

/** Distance inland of the high-tide beach's foot where the bare beach reaches
 * height `h`; at most 2.3 × the beach's width (the old cap at 90% of its
 * height). */
export function inlandAt(coast: Pick<CoastParams, 'beachSlope' | 'beachWidth'> & { tide?: Pick<Tide, 'springRange'>; terrace?: Terrace }, h: number): number {
  if (h <= 0) return 0
  let lo = 0
  let hi = 2.3 * coast.beachWidth
  if (bareBeach(coast, hi) <= h) return hi
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (bareBeach(coast, mid) < h) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}
