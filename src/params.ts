import { MoonPhase } from 'astronomy-engine'

import { Random } from './random'

// Everything random about a scene is decided here, from the date alone.
// Directions use the world frame: +Y up, azimuth 0 = -Z, increasing clockwise
// when seen from above (toward +X).

export const EARTH_RADIUS = 6_371_000
const DEG = Math.PI / 180

export type TimeOfDay =
  | 'golden-hour'
  | 'sun-on-horizon'
  | 'blue-hour'
  | 'daylight'
  | 'midday'
  | 'night'

export interface WaterStyle {
  name: string
  /** Albedo-like color of light scattered back out of deep water (linear). */
  deep: [number, number, number]
  /** Color of light transmitted through thin wave crests (linear). */
  scatter: [number, number, number]
  /** Absorption coefficients per metre (linear RGB); sets shallow-water tint. */
  absorption: [number, number, number]
  /** Sand palettes that suit this water, by name. */
  sands: readonly SandStyle['name'][]
}

export interface SandStyle {
  name: 'white' | 'golden' | 'grey' | 'black'
  /** Dry sand albedo (linear). */
  albedo: [number, number, number]
}

export const SAND_STYLES: Record<SandStyle['name'], SandStyle> = {
  white: { name: 'white', albedo: [0.62, 0.58, 0.5] },
  golden: { name: 'golden', albedo: [0.46, 0.36, 0.23] },
  grey: { name: 'grey', albedo: [0.26, 0.24, 0.22] },
  black: { name: 'black', albedo: [0.06, 0.06, 0.065] }
}

export interface CoastParams {
  type: 'open-sea' | 'beach'
  /** Azimuth pointing from land out to sea, perpendicular to the shore. */
  seawardAzimuthDeg: number
  /** Horizontal distance from the camera to the waterline (m). */
  distanceToWater: number
  /** Positive = bay (shore curves seaward on both sides). 1/m. */
  curvature: number
  /** Amplitude of along-shore wiggles in the coastline (m). */
  wobble: number
  beachSlope: number
  nearshoreSlope: number
  seabedDepth: number
  beachWidth: number
  duneHeight: number
  duneWidth: number
  sandbarDistance: number
  sandbarHeight: number
  /** Height wave run-up reaches on the beach (m); the wet-sand band. */
  runup: number
  surfAmplitude: number
  surfWavelength: number
  surfPhase: number
  sand: SandStyle
  noiseOffset: [number, number]
}

export interface SceneParams {
  date: string
  seed: string
  title: string

  timeOfDay: TimeOfDay
  /** Unit vector toward the sun, world frame. */
  sunDirection: [number, number, number]
  sunElevationDeg: number
  /** Unit vector toward the moon, world frame. */
  moonDirection: [number, number, number]
  moonElevationDeg: number
  /** 0 = new, 180 = full (degrees), from the real date. */
  moonPhaseDeg: number
  moonIllumination: number
  moonScale: number

  /** Geodetic latitude used to anchor the atmosphere model (degrees). */
  latitudeDeg: number

  coast: CoastParams

  camera: {
    /** Above sea level for open sea; above the ground on a beach. */
    heightM: number
    headingDeg: number
    /** Where the horizon sits, as a fraction of image height from the top.
     * The renderer solves the camera pitch from this. */
    horizonFraction: number
    rollDeg: number
    focalLengthMm: number
  }

  ocean: {
    windSpeed: number
    /** Azimuth the wind (and waves) travel toward. */
    windHeadingDeg: number
    /** Seconds; freezes the wave animation at a seeded moment. */
    time: number
    choppiness: number
    /** 0..1: how fully developed the wind sea is (fetch/duration limited). */
    seaDevelopment: number
    /** Scales directional spreading; < 1 = more chaotic, > 1 = more aligned. */
    spreadScale: number
    swellHeadingDeg: number
    swellWavelength: number
    /** Significant height of the swell (m). */
    swellHeight: number
    water: WaterStyle
    waveSeed: string
  }
}

export function dirFromAzEl(azDeg: number, elDeg: number): [number, number, number] {
  const az = azDeg * DEG
  const el = elDeg * DEG
  return [Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)]
}

function elevationOf(d: [number, number, number]): number {
  return Math.asin(Math.max(-1, Math.min(1, d[1]))) / DEG
}

const WATER_STYLES: readonly (readonly [WaterStyle, number])[] = [
  [
    {
      name: 'deep ocean',
      deep: [0.004, 0.016, 0.034],
      scatter: [0.0, 0.1, 0.13],
      absorption: [0.5, 0.12, 0.08],
      sands: ['golden', 'grey', 'white']
    },
    3
  ],
  [
    {
      name: 'tropical',
      deep: [0.0, 0.035, 0.05],
      scatter: [0.02, 0.3, 0.26],
      absorption: [0.42, 0.065, 0.05],
      sands: ['white', 'white', 'golden']
    },
    2
  ],
  [
    {
      name: 'northern',
      deep: [0.006, 0.02, 0.022],
      scatter: [0.03, 0.1, 0.075],
      absorption: [0.6, 0.2, 0.22],
      sands: ['grey', 'black', 'golden']
    },
    2
  ],
  [
    {
      name: 'mediterranean',
      deep: [0.002, 0.02, 0.05],
      scatter: [0.0, 0.14, 0.2],
      absorption: [0.45, 0.08, 0.05],
      sands: ['golden', 'white', 'grey']
    },
    2
  ]
]

const SUN_ELEVATION: Record<TimeOfDay, [number, number]> = {
  'golden-hour': [1.5, 9],
  'sun-on-horizon': [-0.6, 1.2],
  'blue-hour': [-7, -2.5],
  daylight: [10, 32],
  midday: [35, 70],
  night: [-30, -16]
}

function moonPhaseName(phase: number): string {
  const names = [
    'new moon',
    'waxing crescent',
    'first quarter',
    'waxing gibbous',
    'full moon',
    'waning gibbous',
    'last quarter',
    'waning crescent'
  ]
  return names[Math.round(phase / 45) % 8]
}

function seaName(wind: number): string {
  if (wind < 3) return 'glassy sea'
  if (wind < 6) return 'gentle swell'
  if (wind < 10) return 'breezy sea'
  return 'rough sea'
}

/**
 * Rotate `v` by `angle` around a unit axis perpendicular to it, where the axis
 * itself is chosen by `spin` (radians) around `v`.
 */
function offsetDirection(
  v: [number, number, number],
  angle: number,
  spin: number
): [number, number, number] {
  // Build an orthonormal basis (v, a, b).
  const helper: [number, number, number] = Math.abs(v[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  const a = normalize(cross(v, helper))
  const b = cross(v, a)
  const axisDir: [number, number, number] = [
    a[0] * Math.cos(spin) + b[0] * Math.sin(spin),
    a[1] * Math.cos(spin) + b[1] * Math.sin(spin),
    a[2] * Math.cos(spin) + b[2] * Math.sin(spin)
  ]
  return normalize([
    v[0] * Math.cos(angle) + axisDir[0] * Math.sin(angle),
    v[1] * Math.cos(angle) + axisDir[1] * Math.sin(angle),
    v[2] * Math.cos(angle) + axisDir[2] * Math.sin(angle)
  ])
}

function cross(
  a: [number, number, number],
  b: [number, number, number]
): [number, number, number] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function normalize(v: [number, number, number]): [number, number, number] {
  const l = Math.hypot(v[0], v[1], v[2])
  return [v[0] / l, v[1] / l, v[2] / l]
}

function swell(
  seed: string,
  windHeadingDeg: number
): Pick<
  SceneParams['ocean'],
  'seaDevelopment' | 'spreadScale' | 'swellHeadingDeg' | 'swellWavelength' | 'swellHeight'
> {
  const rng = Random.derive(seed, 'swell')
  return {
    seaDevelopment: rng.range(0.35, 0.9),
    spreadScale: rng.range(0.6, 1.6),
    swellHeadingDeg: windHeadingDeg + rng.range(-70, 70),
    swellWavelength: rng.range(60, 200),
    swellHeight: rng.weighted<() => number>([
      [() => rng.range(0.1, 0.4), 3],
      [() => rng.range(0.4, 1.0), 3],
      [() => rng.range(1.0, 2.0), 1]
    ])()
  }
}

function generateCoast(
  seed: string,
  headingDeg: number,
  water: WaterStyle,
  ocean: Pick<SceneParams['ocean'], 'swellHeight' | 'swellWavelength' | 'windSpeed'>
): { coast: CoastParams; eyeHeight: number | null } {
  const rng = Random.derive(seed, 'coast')
  const type = rng.chance(0.65) ? 'beach' : 'open-sea'

  // Look out to sea at an angle so the shoreline runs diagonally across the
  // frame; either side.
  const offset = rng.range(20, 70) * (rng.chance(0.5) ? 1 : -1)
  const surfAmplitude = Math.min(1.6, ocean.swellHeight * 0.45 + ocean.windSpeed * 0.02)
  const coast: CoastParams = {
    type,
    seawardAzimuthDeg: headingDeg - offset,
    distanceToWater: rng.weighted<() => number>([
      [() => rng.range(4, 15), 3],
      [() => rng.range(15, 45), 3],
      [() => rng.range(45, 110), 1]
    ])(),
    curvature: rng.chance(0.5) ? rng.range(0.0002, 0.0012) : rng.range(-0.0002, 0.0003),
    wobble: rng.range(3, 25),
    beachSlope: rng.range(0.035, 0.11),
    nearshoreSlope: rng.range(0.012, 0.035),
    seabedDepth: rng.range(15, 45),
    beachWidth: rng.range(25, 80),
    duneHeight: rng.range(1.5, 9),
    duneWidth: rng.range(15, 50),
    sandbarDistance: rng.range(50, 140),
    sandbarHeight: 0,
    runup: 0.25 + surfAmplitude * rng.range(0.4, 0.8),
    surfAmplitude,
    surfWavelength: rng.range(18, 40),
    surfPhase: rng.range(0, Math.PI * 2),
    sand: SAND_STYLES[rng.pick(water.sands)],
    noiseOffset: [rng.range(-5000, 5000), rng.range(-5000, 5000)]
  }

  // Keep sandbars submerged: at most ~60% of the water depth above them.
  if (rng.chance(0.6)) {
    const depthAtBar = coast.sandbarDistance * coast.nearshoreSlope
    coast.sandbarHeight = depthAtBar * rng.range(0.25, 0.6)
  }

  const eyeHeight =
    type === 'beach'
      ? rng.weighted<() => number>([
          [() => rng.range(1.4, 2.2), 6],
          [() => rng.range(4, 15), 3],
          [() => rng.range(25, 70), 1]
        ])()
      : null
  return { coast, eyeHeight }
}

export function generateParams(date: string): SceneParams {
  const seed = `amazing-sea:${date}`
  const rng = new Random(seed)

  // Real moon phase for the date (noon UTC).
  const moonPhaseDeg = MoonPhase(new Date(`${date}T12:00:00Z`))
  const elongation = moonPhaseDeg <= 180 ? moonPhaseDeg : 360 - moonPhaseDeg
  const moonIllumination = (1 - Math.cos(elongation * DEG)) / 2

  let timeOfDay = rng.weighted<TimeOfDay>([
    ['golden-hour', 30],
    ['sun-on-horizon', 12],
    ['blue-hour', 10],
    ['daylight', 23],
    ['midday', 15],
    ['night', 10]
  ])
  // Night needs a reasonably bright moon to be worth looking at.
  if (timeOfDay === 'night' && moonIllumination < 0.35) timeOfDay = 'blue-hour'
  const isEvening = rng.chance(0.5)

  // Camera heading, then the sun relative to it. Low suns are usually framed
  // in or near the view for glitter paths; high suns can be anywhere.
  const headingDeg = rng.range(0, 360)
  const [elMin, elMax] = SUN_ELEVATION[timeOfDay]
  const sunElevationDeg = rng.range(elMin, elMax)
  const lowSun = timeOfDay !== 'midday' && timeOfDay !== 'daylight'
  const relSunAz =
    lowSun && rng.chance(0.7) ? rng.normal(0, 18) : rng.range(-180, 180)
  const sunDirection = dirFromAzEl(headingDeg + relSunAz, sunElevationDeg)

  // Place the moon at the physically correct angular distance from the sun
  // (its elongation), so the lit side and phase are consistent with the sky.
  let moonDirection = offsetDirection(sunDirection, elongation * DEG, rng.range(0, 2 * Math.PI))
  if (timeOfDay === 'night' || (timeOfDay === 'blue-hour' && rng.chance(0.6))) {
    // Prefer a moon placement high enough to see and roughly in front of the
    // camera; try candidate spins and keep the best.
    const view = dirFromAzEl(headingDeg, 0)
    let best = moonDirection
    let bestScore = -Infinity
    for (let i = 0; i < 48; i++) {
      const candidate = offsetDirection(sunDirection, elongation * DEG, rng.range(0, 2 * Math.PI))
      const el = elevationOf(candidate)
      const facing = candidate[0] * view[0] + candidate[2] * view[2]
      const score = (el > 4 && el < 40 ? 1 : -1) + facing + rng.range(0, 0.5)
      if (score > bestScore) {
        bestScore = score
        best = candidate
      }
    }
    moonDirection = best
  }
  const moonElevationDeg = elevationOf(moonDirection)

  const heightM = rng.weighted<() => number>([
    [() => rng.range(1.2, 4), 4],
    [() => rng.range(6, 25), 4],
    [() => rng.range(40, 160), 2]
  ])()
  const focalLengthMm = rng.weighted<() => number>([
    [() => rng.range(18, 28), 3],
    [() => rng.range(28, 50), 4],
    [() => rng.range(50, 90), 2]
  ])()

  // Wind: mostly calm-to-moderate seas.
  const windSpeed = rng.weighted<() => number>([
    [() => rng.range(1.5, 4), 3],
    [() => rng.range(4, 8), 4],
    [() => rng.range(8, 14), 2]
  ])()
  const windHeadingDeg = rng.range(0, 360)

  const water = rng.weighted(WATER_STYLES)
  const oceanState = { windSpeed, windHeadingDeg, ...swell(seed, windHeadingDeg) }
  const { coast, eyeHeight } = generateCoast(seed, headingDeg, water, oceanState)

  const timeLabel: Record<TimeOfDay, string> = {
    'golden-hour': isEvening ? 'Golden hour' : 'Morning gold',
    'sun-on-horizon': isEvening ? 'Sunset' : 'Sunrise',
    'blue-hour': isEvening ? 'Dusk' : 'Dawn',
    daylight: isEvening ? 'Afternoon' : 'Morning',
    midday: 'Midday',
    night: 'Moonlit night'
  }
  const titleParts = [
    timeLabel[timeOfDay],
    coast.type === 'beach' ? `${coast.sand.name} sand beach` : seaName(windSpeed)
  ]
  if (moonElevationDeg > 1 && moonIllumination > 0.05) titleParts.push(moonPhaseName(moonPhaseDeg))

  return {
    date,
    seed,
    title: titleParts.join(' · '),
    timeOfDay,
    sunDirection,
    sunElevationDeg,
    moonDirection,
    moonElevationDeg,
    moonPhaseDeg,
    moonIllumination,
    moonScale: rng.range(1.2, 2.4),
    latitudeDeg: rng.range(5, 50),
    coast,
    camera: {
      heightM: eyeHeight ?? heightM,
      headingDeg,
      horizonFraction: rng.weighted<() => number>([
        [() => rng.range(0.55, 0.68), 3], // more sky
        [() => rng.range(0.32, 0.45), 2], // more sea
        [() => rng.range(0.45, 0.55), 1]
      ])(),
      rollDeg: rng.normal(0, 0.3),
      focalLengthMm
    },
    ocean: {
      ...oceanState,
      time: rng.range(0, 10_000),
      choppiness: rng.range(0.6, 1.0),
      water,
      waveSeed: `${seed}/waves`
    }
  }
}
