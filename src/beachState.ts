import type { BeachMaterial } from './beach'
import type { Biome, SandStyle } from './biome'
import type { Random } from './random'

// Beach shape from waves and grain (PLAN_BIOMES phase 4; Wright & Short 1984).
// A beach's state follows the dimensionless fall velocity Ω = Hb / (ws · T):
// coarse grains or small waves keep it steep and barless (reflective), fine
// sand under big swell flattens it into a wide surf zone over two or three
// bars (dissipative), with the intermediate states (terrace, bars cut by rip
// channels, crescentic and straight bars) between. Grain sizes, fall
// velocities, worked examples and slopes: knowledge/REGIONS.md §2.

/** Wright & Short's six states, steep to flat. */
export type BeachState =
  | 'reflective'
  | 'low-tide-terrace'
  | 'transverse-bar-rip'
  | 'rhythmic-bar'
  | 'longshore-bar'
  | 'dissipative'

export const BEACH_STATES: readonly BeachState[] = [
  'reflective',
  'low-tide-terrace',
  'transverse-bar-rip',
  'rhythmic-bar',
  'longshore-bar',
  'dissipative'
]

/** Ω at the upper end of each state but the last: reflective below 1.5,
 * dissipative above 5.5; the intermediate states split the range in between
 * (their modal Ω: terrace ~2, transverse bars ~3, rhythmic ~4, longshore ~5). */
export const OMEGA_LIMITS = [1.5, 2.5, 3.5, 4.5, 5.5] as const

/** A sediment: median grain range (mm), density relative to sea water, and
 * a shape factor on the settling speed (platy, porous carbonate grains sink
 * slower than quartz spheres; 0.75 is an assumption, REGIONS.md §2). */
export interface Sediment {
  mm: [number, number]
  density: number
  shape: number
}

const QUARTZ = { density: 2.65, shape: 1 }
const CARBONATE = { density: 2.71, shape: 0.75 }

/** Grain by sand colour; `coral` is white sand on tropical coasts (coral and
 * shell), white elsewhere is fine quartz (Whitehaven). */
export const GRAIN: Record<SandStyle['name'] | 'coral', Sediment> = {
  coral: { mm: [0.3, 1], ...CARBONATE },
  white: { mm: [0.15, 0.3], ...QUARTZ },
  golden: { mm: [0.2, 0.5], ...QUARTZ },
  grey: { mm: [0.2, 0.6], ...QUARTZ },
  black: { mm: [0.3, 2], density: 2.9, shape: 1 },
  pink: { mm: [0.5, 1], ...CARBONATE },
  red: { mm: [0.15, 0.3], ...QUARTZ }
}

export function sedimentFor(sand: SandStyle['name'], biome: Biome['name']): Sediment {
  return GRAIN[sand === 'white' && biome === 'tropical' ? 'coral' : sand]
}

/** A median grain in the sediment's range, from a uniform 0..1 draw
 * (geometric: grain classes are logarithmic). */
export function grainIn(sediment: Sediment, u: number): number {
  const [lo, hi] = sediment.mm
  return lo * (hi / lo) ** u
}

const G = 9.81
/** Kinematic viscosity of sea water at ~18 °C (m²/s). */
const NU = 1.05e-6

/** Settling speed (m/s) of a grain of `mm` (Soulsby 1997). */
export function fallVelocity(mm: number, sediment: Pick<Sediment, 'density' | 'shape'> = QUARTZ): number {
  const d = mm / 1000
  const dStar = d * (((sediment.density - 1) * G) / (NU * NU)) ** (1 / 3)
  return ((NU / d) * (Math.sqrt(10.36 ** 2 + 1.049 * dStar ** 3) - 10.36)) * sediment.shape
}

/** Breaker height (m) from the offshore wave height H0 (m) and period T (s)
 * (Komar & Gaynord 1975): Hb = 0.39 g^0.2 (T H0²)^0.4. */
export function breakerHeight(h0: number, period: number): number {
  return 0.39 * G ** 0.2 * (period * h0 * h0) ** 0.4
}

/** Deep-water period (s) of a wave of this length (m): L = g T² / 2π. */
export function wavePeriod(wavelength: number): number {
  return Math.sqrt((2 * Math.PI * wavelength) / G)
}

/** Dimensionless fall velocity Ω = Hb / (ws · T). */
export function omega(breaker: number, fall: number, period: number): number {
  return breaker / (fall * period)
}

export function stateForOmega(value: number): BeachState {
  const i = OMEGA_LIMITS.findIndex(limit => value < limit)
  return BEACH_STATES[i < 0 ? BEACH_STATES.length - 1 : i]
}

/** The beach's state. Shingle and cobble are always reflective (Ω ≪ 1);
 * a mixed beach is a gravel upper beach over a sand low-tide terrace at
 * most. `rougher` (storm days, winter) moves it that many states toward
 * dissipative: the winter profile, bars moved offshore. */
export function beachStateFor(
  material: BeachMaterial,
  grainMm: number,
  breaker: number,
  period: number,
  sediment: Pick<Sediment, 'density' | 'shape'> = QUARTZ,
  rougher = 0
): BeachState {
  if (material === 'shingle' || material === 'cobble') return 'reflective'
  const i = Math.min(BEACH_STATES.length - 1, BEACH_STATES.indexOf(stateForOmega(omega(breaker, fallVelocity(grainMm, sediment), period))) + rougher)
  return material === 'mixed' ? BEACH_STATES[Math.min(i, 1)] : BEACH_STATES[i]
}

/** A submerged bar parallel to the shore. */
export interface Bar {
  /** Crest distance seaward of the waterline (m). */
  distance: number
  height: number
  /** Gaussian half-width (m). */
  width: number
}

/** Rip channels cut through the inner bar (transverse-bar-rip and rhythmic
 * states): one every `spacing` m along the shore; the bar swings toward the
 * shore between them by `amplitude` × its distance. */
export interface Rips {
  spacing: number
  amplitude: number
}

/** Beach cusps: horns and bays along the upper swash zone. */
export interface Cusps {
  spacing: number
  /** Horn-to-bay relief (m). */
  relief: number
}

export interface BeachShape {
  beachSlope: number
  nearshoreSlope: number
  beachWidth: number
  bars: Bar[]
  rips: Rips | null
  cusps: Cusps | null
}

/** Beach-face slope of sand by grain at moderate waves (REGIONS.md §2,
 * Bascom-type curve): [mm, slope], interpolated on log grain. */
const SAND_FACE: readonly [number, number][] = [
  [0.2, 0.03],
  [0.35, 0.065],
  [0.5, 0.1],
  [1, 0.14],
  [2, 0.16]
]

/** Face slope of gravel by stone size (m): shingle 1:8–1:4, cobble 1:5–1:3. */
const STONE_FACE: readonly [number, number][] = [
  [0.02, 0.12],
  [0.05, 0.2],
  [0.15, 0.28],
  [0.3, 0.33]
]

/** Flatter faces toward dissipative: the same sand lies steeper under small
 * waves than under big ones. */
const FACE_BY_STATE: Record<BeachState, number> = {
  reflective: 1.1,
  'low-tide-terrace': 1,
  'transverse-bar-rip': 0.85,
  'rhythmic-bar': 0.75,
  'longshore-bar': 0.65,
  dissipative: 0.55
}

/** Slope of the surf zone and shoreface (CEDD "typical natural beach
 * slopes": 0.2 mm 1:50–1:100, 0.3 mm 1:25–1:50, 0.5 mm 1:20–1:40; flatter
 * on exposed coasts). */
const NEARSHORE: Record<BeachState, [number, number]> = {
  reflective: [0.035, 0.06],
  'low-tide-terrace': [0.025, 0.04],
  'transverse-bar-rip': [0.02, 0.03],
  'rhythmic-bar': [0.015, 0.025],
  'longshore-bar': [0.012, 0.02],
  dissipative: [0.008, 0.014]
}

/** Dry beach width scale (m): narrow and steep to wide and flat. */
const WIDTH: Record<BeachState, [number, number]> = {
  reflective: [15, 40],
  'low-tide-terrace': [25, 55],
  'transverse-bar-rip': [30, 65],
  'rhythmic-bar': [35, 70],
  'longshore-bar': [40, 80],
  dissipative: [50, 95]
}

/** Bars by state: [distance range (m), crest height as a share of the
 * water depth there] per bar, inner first. Outer bars are lower, in deeper
 * water. The terrace is a shallow shelf at the foot of the face. */
const BARS: Record<BeachState, [[number, number], [number, number]][][]> = {
  reflective: [[]],
  'low-tide-terrace': [[[[15, 35], [0.5, 0.75]]]],
  'transverse-bar-rip': [[[[40, 90], [0.35, 0.6]]]],
  'rhythmic-bar': [[[[70, 140], [0.3, 0.55]]], [[[70, 140], [0.3, 0.55]], [[180, 260], [0.2, 0.4]]]],
  'longshore-bar': [[[[80, 150], [0.3, 0.5]]], [[[80, 150], [0.3, 0.5]], [[190, 280], [0.2, 0.4]]]],
  dissipative: [
    [[[70, 130], [0.25, 0.45]], [[160, 250], [0.2, 0.4]]],
    [[[70, 130], [0.25, 0.45]], [[160, 250], [0.2, 0.4]], [[270, 360], [0.15, 0.3]]]
  ]
}

/** Chance of cusps: common on reflective and terraced beaches, fewer on
 * transverse bars (megacusps there), none on the flat states. */
export const CUSP_CHANCE: Record<BeachState, number> = {
  reflective: 0.8,
  'low-tide-terrace': 0.6,
  'transverse-bar-rip': 0.4,
  'rhythmic-bar': 0,
  'longshore-bar': 0,
  dissipative: 0
}

/** Highest berm a beach builds above the sea (m): slope × width stays under this. */
const MAX_BERM = 5

function logLerp(table: readonly [number, number][], x: number): number {
  if (x <= table[0][0]) return table[0][1]
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i]
    if (x <= x1) {
      const [x0, y0] = table[i - 1]
      return y0 + ((y1 - y0) * Math.log(x / x0)) / Math.log(x1 / x0)
    }
  }
  return table[table.length - 1][1]
}

/** Cusp spacing (m) from subharmonic edge waves: λ = g T² tanβ / π,
 * 15–40 m on most steep beaches. */
export function cuspSpacing(period: number, slope: number): number {
  return Math.min(45, Math.max(12, (G * period * period * slope) / Math.PI))
}

/** The profile of a beach in a state: face and nearshore slopes, width,
 * bars, rip channels and cusps. `grain` is the sand's median grain (mm), or
 * on shingle and cobble the median stone size (m). `depthAt(d)` is the
 * water depth d m out on the bare nearshore, for the bars' heights. Every
 * state makes the same draws, so forcing one changes only the shape. */
export function beachShape(
  state: BeachState,
  material: BeachMaterial,
  grain: number,
  period: number,
  depthAt: (distance: number, nearshoreSlope: number) => number,
  rng: Random
): BeachShape {
  const stones = material === 'shingle' || material === 'cobble'
  const jitter = rng.range(0.85, 1.15)
  let beachSlope = stones ? logLerp(STONE_FACE, grain) * jitter : logLerp(SAND_FACE, grain) * FACE_BY_STATE[state] * jitter
  // A mixed beach: a gravel upper beach steepens the sand face.
  if (material === 'mixed') beachSlope = Math.min(0.14, Math.max(0.08, beachSlope))
  beachSlope = Math.min(stones ? 0.33 : 0.18, Math.max(stones ? 0.12 : 0.015, beachSlope))
  const near = stones ? [0.06, 0.12] : material === 'mixed' ? [0.035, 0.06] : NEARSHORE[state]
  const nearshoreSlope = rng.range(near[0], near[1])
  const width = material === 'sand' ? WIDTH[state] : [12, 40]
  const beachWidth = Math.max(12, Math.min(rng.range(width[0], width[1]), MAX_BERM / beachSlope))

  const options = BARS[state]
  const layout = options[Math.min(options.length - 1, Math.floor(rng.float() * options.length))]
  const bars: Bar[] = [0, 1, 2].map(i => {
    const distance = rng.range(...(layout[i]?.[0] ?? [0, 1]))
    const share = rng.range(...(layout[i]?.[1] ?? [0, 1]))
    const spread = rng.range(0.15, 0.25)
    return { distance, height: depthAt(distance, nearshoreSlope) * share, width: Math.max(10, distance * spread) }
  })
  bars.length = layout.length

  const ripped = state === 'transverse-bar-rip' || state === 'rhythmic-bar'
  const ripSpacing = rng.range(150, 400)
  const ripAmplitude = state === 'transverse-bar-rip' ? rng.range(0.3, 0.45) : rng.range(0.15, 0.25)
  const rips = ripped ? { spacing: ripSpacing, amplitude: ripAmplitude } : null

  const cusped = rng.chance(CUSP_CHANCE[state])
  const relief = rng.range(0.1, 0.4)
  const spacing = cuspSpacing(period, beachSlope) * rng.range(0.85, 1.15)
  const cusps = cusped ? { spacing, relief } : null
  return { beachSlope, nearshoreSlope, beachWidth, bars, rips, cusps }
}
