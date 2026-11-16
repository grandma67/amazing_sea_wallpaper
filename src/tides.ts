import type { BeachMaterial } from './beach'
import type { BeachState } from './beachState'
import type { CoastParams } from './params'
import { lagoonSlope, type Reef } from './reef'
import type { Random } from './random'
import { TIDE_GAUGES, type Constituent } from './tideGauges'

// Tides (PLAN_BIOMES phase 5; harmonics 0.201). Each place has a mean range
// (places.ts, from knowledge/REGIONS.md §3) and a tide curve from its nearest
// gauge's constituents (tideGauges.ts, §3.3): the date and the scene's local
// solar time set when high water comes, how many a day, springs and neaps
// and tropic tides; the curve is scaled to the beach's mean range.
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
  /** Water level above mean sea (m): the tide (−range/2..range/2) plus
   * `surge`. */
  level: number
  /** The part of `level` the weather makes (m, `surgeFor`): wind setup,
   * air pressure and the season's mean sea level; 0 in `tideFor`. */
  surge: number
  /** Today's high water above mean sea (m, the tide alone): a mixed tide's
   * higher high water. */
  high: number
  /** The M2 term's phase (rad): 0 at its high water, π at its low. */
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
/** Low-tide terraces: ~1:65, and no wider than 400 m (wider ones are tidal
 * flats, phase 9). */
const TERRACE_SLOPE = 0.015
const TERRACE_MAX = 400

/** Where the scene stands in time: its local date and local apparent solar
 * hours (from the sun: `sunHourAngleDeg`; the scene has no longitude or
 * clock, the gauge's longitude gives universal time). */
export interface TideClock {
  date: string
  localHours: number
}

/** A place's tide in four constituents (tideGauges.ts, REGIONS.md §3.3). */
export interface Harmonics {
  lonEast: number
  M2: Constituent
  S2: Constituent
  K1: Constituent
  O1: Constituent
}

/** A gauge further than this (km) from the place's coast doesn't stand for
 * it (the Red Sea's nearest is 1146 km off): the place takes a shape by its
 * tide type instead. */
export const GAUGE_KM = 250
/** Shapes by tide type for places without a near gauge (amplitudes, M2 = 1
 * or K1 = 1; S2 two-fifths of M2 and 30° later, springs ~1.2 days after new
 * and full moon: typical; Bosboom & Stive's classes). */
const SHAPES = {
  semidiurnal: { M2: 1, S2: 0.38, K1: 0.08, O1: 0.06 },
  mixed: { M2: 1, S2: 0.3, K1: 0.6, O1: 0.4 }
} as const
/** Far places that aren't semidiurnal (REGIONS.md §3.1): the Sea of Japan's
 * mixed tide (its nearest gauge, 718 km off, has F 1.5). */
const FAR_MIXED = new Set(['russian-far-east'])

/** A place's constituents: its gauge's, or a typed shape with phases from a
 * hash of the id (an unnamed port: real phases change along any coast). */
export function harmonicsFor(placeId: string, lonEast = 0): Harmonics {
  const g = TIDE_GAUGES[placeId]
  if (g != null && g.km <= GAUGE_KM) return { lonEast: g.lon, M2: g.M2, S2: g.S2, K1: g.K1, O1: g.O1 }
  const shape = SHAPES[FAR_MIXED.has(placeId) ? 'mixed' : 'semidiurnal']
  const hash = (salt: number): number => {
    let h = 2166136261 ^ salt
    for (let i = 0; i < placeId.length; i++) h = Math.imul(h ^ placeId.charCodeAt(i), 16777619)
    return ((h >>> 0) % 3600) / 10
  }
  const m2 = hash(1)
  const k1 = hash(2)
  return { lonEast: g?.lon ?? lonEast, M2: [shape.M2, m2], S2: [shape.S2, m2 + 30], K1: [shape.K1, k1], O1: [shape.O1, k1 - 15] }
}

const J2000_MS = Date.UTC(2000, 0, 1, 12)

/** The tide's height above mean sea (m, in the gauge's units) `hours` after
 * the clock: Σ A cos(V − G) over M2, S2, K1, O1, with the equilibrium
 * arguments from the mean longitudes of the Moon (s) and the Sun (h) and the
 * mean sun's Greenwich hour angle (T): M2 2T − 2s + 2h, S2 2T, K1 T + h − 90°,
 * O1 T − 2s + h + 90° (Schureman; nodal factors left out, ≤ ±11%). Checked
 * against NOAA's predictions (test/tides.test.ts): Pensacola's diurnal tide
 * to 5 cm, San Francisco's mixed one to 14 cm. */
export function tideHeight(h: Harmonics, clock: TideClock, hours = 0): number {
  const [y, m, d] = clock.date.split('-').map(Number)
  const ut = clock.localHours + hours - h.lonEast / 15
  const days = (Date.UTC(y, m - 1, d) - J2000_MS) / 86400000 + ut / 24
  const s = 218.3165 + 13.17639648 * days
  const sun = 280.4661 + 0.98564736 * days
  const T = 180 + 15 * ut
  const term = ([a, g]: Constituent, v: number): number => a * Math.cos(((v - g) * Math.PI) / 180)
  return term(h.M2, 2 * T - 2 * s + 2 * sun) + term(h.S2, 2 * T) + term(h.K1, T + sun - 90) + term(h.O1, T - 2 * s + sun + 90)
}

/** Lowest and highest water within a lunar day centred on `hours` (step
 * 15 min). */
function dayExtremes(h: Harmonics, clock: TideClock, hours: number): [number, number] {
  let lo = Infinity
  let hi = -Infinity
  for (let t = -LUNAR_DAY / 2; t <= LUNAR_DAY / 2; t += 0.25) {
    const v = tideHeight(h, clock, hours + t)
    lo = Math.min(lo, v)
    hi = Math.max(hi, v)
  }
  return [lo, hi]
}
const LUNAR_DAY = 24.84

/** The gauge's mean and spring ranges around the date: the mean and the
 * 90th percentile of 30 lunar days' ranges (a semidiurnal day's bigger tide,
 * a diurnal day's one). */
function rangesAround(h: Harmonics, clock: TideClock): { mean: number; spring: number } {
  const ranges: number[] = []
  for (let k = -15; k < 15; k++) {
    let lo = Infinity
    let hi = -Infinity
    for (let t = 0; t < LUNAR_DAY; t += 0.5) {
      const v = tideHeight(h, clock, k * LUNAR_DAY + t)
      lo = Math.min(lo, v)
      hi = Math.max(hi, v)
    }
    ranges.push(hi - lo)
  }
  ranges.sort((a, b) => a - b)
  return { mean: ranges.reduce((s, r) => s + r, 0) / ranges.length, spring: ranges[Math.floor(ranges.length * 0.9)] }
}

/** The day's tide at a place of mean range `[lo, hi]` (m): the beach's mean
 * range is a draw in the span; the curve (when high water comes, one high a
 * day or two, springs and neaps, tropic tides) is the place's harmonics
 * (REGIONS.md §3.3) on the date and local time, scaled to that mean. Two
 * draws on the `'tide'` stream (the second, the old random phase, kept so
 * the stream stays put); the spec forces the stage and the range. */
export function tideFor(
  mean: readonly [number, number],
  harmonics: Harmonics,
  clock: TideClock,
  rng: Random,
  force: { tide?: TideStage; tidalRange?: number } = {}
): Tide {
  const meanRange = mean[0] + (mean[1] - mean[0]) * rng.float()
  rng.range(0, 2 * Math.PI)
  const [lo, hi] = dayExtremes(harmonics, clock, 0)
  const gauge = rangesAround(harmonics, clock)
  const scale = force.tidalRange != null ? force.tidalRange / Math.max(1e-6, hi - lo) : meanRange / Math.max(1e-6, gauge.mean)
  const now = tideHeight(harmonics, clock)
  const level = force.tide === 'high' ? hi : force.tide === 'low' ? lo : force.tide === 'mid' ? (hi + lo) / 2 : now
  const range = scale * (hi - lo)
  // The M2 term's phase now (0 at its high water), for reading the cycle.
  const [y, m, d] = clock.date.split('-').map(Number)
  const ut = clock.localHours - harmonics.lonEast / 15
  const days = (Date.UTC(y, m - 1, d) - J2000_MS) / 86400000 + ut / 24
  const v = 2 * (180 + 15 * ut) - 2 * (218.3165 + 13.17639648 * days) + 2 * (280.4661 + 0.98564736 * days)
  const phase = ((((v - harmonics.M2[1]) % 360) + 360) % 360) * (Math.PI / 180)
  return {
    mean: meanRange,
    springRange: Math.max(force.tidalRange != null ? 0 : scale * gauge.spring, range),
    range,
    level: scale * level,
    high: scale * hi,
    surge: 0,
    phase
  }
}

/** How a coast's sea piles up under an onshore wind: the wind setup of a
 * steady stress over a shelf, η = C_d (ρ_air/ρ_sea) U² L / (g h) (Pugh &
 * Woodworth; REGIONS.md §3.2), with `SHELF` the fetch over depth L/h:
 * `shallow` (North Sea, Baltic, Yellow Sea, Adriatic, the big tidal bays,
 * NW Australia, the Gulf: 2·10⁴, so 30 m/s gives ~3 m, the 1953 North Sea
 * surge), `shelf` (most coasts, 6·10³, est.), `steep` (oceanic islands,
 * fjords, deep seas and the Pacific margins, 1.5·10³, est.). */
export type Shelf = 'shallow' | 'shelf' | 'steep'
export const SHELF: Record<Shelf, number> = { shallow: 20000, shelf: 6000, steep: 1500 }
/** C_d (1.3·10⁻³) × ρ_air/ρ_sea (1.25·10⁻³) / g. */
const SETUP_K = (1.3e-3 * 1.25e-3) / 9.81
/** An offshore wind draws the water down less than an onshore one piles it
 * up (the setdown spreads over open water; est.). */
const SETDOWN = 0.5
/** The sea under the day's sky: 1 cm higher per hPa below the mean (the
 * inverse barometer); pressure by the weather (est.: a storm's low ~25 hPa
 * down, a clear anticyclone ~8 up). */
export const PRESSURE_HPA: Record<'clear' | 'cirrus' | 'few' | 'scattered' | 'broken' | 'overcast' | 'storm', number> = {
  clear: 8,
  cirrus: 4,
  few: 2,
  scattered: 0,
  broken: -5,
  overcast: -10,
  storm: -25
}

/** A sea's yearly cycle of mean level (m): amplitude and the month of the
 * high (local calendar). Baltic 4–13 cm, high Nov–Jan, low Apr–May;
 * Mediterranean 3–10 cm, high Sep–Nov, low Mar–May (REGIONS.md §3.1). */
export interface SeaSeason {
  amplitude: number
  peakMonth: number
}

export interface SurgeDay {
  /** Wind at 10 m (m/s) and where it blows toward (deg). */
  windSpeed: number
  windHeadingDeg: number
  /** Where the coast faces (deg): onshore is toward seaward + 180. */
  seawardAzimuthDeg: number
  shelf: Shelf
  weather: keyof typeof PRESSURE_HPA
  season?: SeaSeason
  /** Local calendar month, 1–12. */
  month: number
}

/** The weather's part of today's water level (m): wind setup (onshore up,
 * offshore down by half), the inverse barometer, and the sea's season. */
export function surgeFor(day: SurgeDay): number {
  const onshore = Math.cos(((day.windHeadingDeg - day.seawardAzimuthDeg - 180) * Math.PI) / 180)
  const setup = SETUP_K * day.windSpeed ** 2 * SHELF[day.shelf] * onshore
  const wind = setup >= 0 ? setup : setup * SETDOWN
  const pressure = -0.01 * PRESSURE_HPA[day.weather]
  const season = day.season == null ? 0 : day.season.amplitude * Math.cos(((day.month - day.season.peakMonth) * Math.PI) / 6)
  return wind + pressure + season
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
  const { range, springRange, level, surge, high } = coast.tide
  // Today's high water carries today's surge; the spring line is where the
  // sea has reached lately (the wrack, the plants' edge), so it doesn't.
  return { high: (high ?? range / 2) + (surge ?? 0) - level, spring: springRange / 2 - level }
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
