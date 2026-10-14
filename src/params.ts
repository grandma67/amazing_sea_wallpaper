import { MoonPhase } from 'astronomy-engine'

import { BIOMES, SAND_STYLES, type Biome, type SandStyle, type WaterStyle } from './biome'
import { CLOUD_GENERA, pickFormations, type CloudGenus } from './cloudTypes'
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

export type Composition = 'shoreline' | 'along-beach' | 'framed' | 'overlook'

export interface CoastParams {
  type: 'open-sea' | 'beach'
  /** shoreline: at the water looking out; along-beach: the beach recedes into
   * the distance; framed: just inside the tree line looking out past plants;
   * overlook: high on the hillside above the bay. */
  composition: Composition
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
  /** Height of the rolling hills inland (m). */
  hillHeight: number
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

export type WeatherKind = 'clear' | 'cirrus' | 'few' | 'scattered' | 'broken' | 'overcast'

export interface WeatherParams {
  kind: WeatherKind
  /** Cloud coverage, 0..1 (takram clouds' global coverage). */
  coverage: number
  /** Cloud genera in the sky, at most one per étage (low, middle, high). */
  formations: CloudGenus[]
  /** Fraction of direct sunlight reaching the scene through the clouds. */
  sunVisibility: number
  /** Seeded offsets so each day gets its own cloud pattern. */
  weatherOffset: [number, number]
  shapeOffset: [number, number, number]
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

  biome: Biome
  coast: CoastParams
  weather: WeatherParams

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
  attempt: number,
  headingDeg: number,
  biome: Biome,
  ocean: Pick<SceneParams['ocean'], 'swellHeight' | 'swellWavelength' | 'windSpeed'>
): { coast: CoastParams; eyeHeight: number | null } {
  // Retries (see composition.ts) re-roll only the coast and composition.
  const suffix = attempt > 0 ? `#${attempt}` : ''
  const rng = Random.derive(seed, `coast${suffix}`)
  // Beach or open sea is decided once per date; retries keep it.
  const type = Random.derive(seed, 'coast').chance(0.65) ? 'beach' : 'open-sea'
  rng.float() // keep attempt 0's stream identical to the original draw order

  // Look out to sea at an angle so the shoreline runs diagonally across the
  // frame; either side.
  const offset = rng.range(20, 70) * (rng.chance(0.5) ? 1 : -1)
  const surfAmplitude = Math.min(1.6, ocean.swellHeight * 0.45 + ocean.windSpeed * 0.02)
  const coast: CoastParams = {
    type,
    composition: 'shoreline',
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
    hillHeight: 0,
    sandbarDistance: rng.range(50, 140),
    sandbarHeight: 0,
    runup: 0.25 + surfAmplitude * rng.range(0.4, 0.8),
    surfAmplitude,
    surfWavelength: rng.range(18, 40),
    surfPhase: rng.range(0, Math.PI * 2),
    sand: SAND_STYLES[rng.pick(biome.sands)],
    noiseOffset: [rng.range(-5000, 5000), rng.range(-5000, 5000)]
  }

  // Keep sandbars submerged: at most ~60% of the water depth above them.
  if (rng.chance(0.6)) {
    const depthAtBar = coast.sandbarDistance * coast.nearshoreSlope
    coast.sandbarHeight = depthAtBar * rng.range(0.25, 0.6)
  }

  let eyeHeight =
    type === 'beach'
      ? rng.weighted<() => number>([
          [() => rng.range(1.4, 2.2), 6],
          [() => rng.range(4, 15), 3],
          [() => rng.range(25, 70), 1]
        ])()
      : null

  // Hills behind the beach: gentle most days, sometimes proper high ground.
  const hrng = Random.derive(seed, 'hills')
  coast.hillHeight = hrng.chance(0.4) ? coast.duneHeight * 1.5 : hrng.range(15, 45)

  // Composition: where the camera stands relative to the shore.
  const crng = Random.derive(seed, `composition${suffix}`)
  if (type === 'beach') {
    coast.composition = crng.weighted<Composition>([
      ['shoreline', 3],
      ['along-beach', 3],
      ['framed', 2],
      ['overlook', 2]
    ])
    const side = crng.chance(0.5) ? 1 : -1
    switch (coast.composition) {
      case 'along-beach':
        coast.seawardAzimuthDeg = headingDeg - side * crng.range(62, 84)
        coast.distanceToWater = crng.range(8, coast.beachWidth * 0.8)
        eyeHeight = crng.chance(0.75) ? crng.range(1.4, 2.2) : crng.range(5, 18)
        break
      case 'framed':
        coast.seawardAzimuthDeg = headingDeg - side * crng.range(10, 45)
        coast.distanceToWater = coast.beachWidth + crng.range(15, 60)
        eyeHeight = crng.range(1.5, 2.1)
        break
      case 'overlook':
        coast.seawardAzimuthDeg = headingDeg - side * crng.range(15, 55)
        coast.distanceToWater = coast.beachWidth + coast.duneWidth + crng.range(120, 450)
        eyeHeight = crng.range(15, 50)
        break
      case 'shoreline':
        break
    }
  }
  return { coast, eyeHeight }
}

function generateWeather(seed: string, timeOfDay: TimeOfDay): WeatherParams {
  const rng = Random.derive(seed, 'weather')
  const kind = rng.weighted<WeatherKind>([
    ['clear', 12],
    ['cirrus', 13],
    ['few', 20],
    ['scattered', 25],
    ['broken', 18],
    ['overcast', timeOfDay === 'night' || timeOfDay === 'blue-hour' ? 2 : 7]
  ])
  const coverage: Record<WeatherKind, [number, number]> = {
    clear: [0, 0],
    cirrus: [0.45, 0.6],
    few: [0.25, 0.34],
    scattered: [0.36, 0.46],
    broken: [0.48, 0.58],
    overcast: [0.68, 0.8]
  }
  return {
    kind,
    coverage: rng.range(...coverage[kind]),
    formations: [],
    sunVisibility: 1,
    weatherOffset: [rng.range(0, 1), rng.range(0, 1)],
    shapeOffset: [rng.range(0, 1), rng.range(0, 1), rng.range(0, 1)]
  }
}

/** Which clouds make up the sky; its own stream, and it depends on the coast. */
function addFormations(seed: string, weather: WeatherParams, biome: Biome): void {
  const frng = Random.derive(seed, 'formations')
  const { kind } = weather
  weather.formations = pickFormations(frng, kind, {
    cool: biome.name === 'nordic' || biome.name === 'volcanic',
    tropical: biome.name === 'tropical'
  })
  // Patchy cloud shade on sea and sand is per pixel (shadow.ts); this is only
  // the overall dimming on top. A mirror-sharp sun glint is ~1000× the sky,
  // so even a sliver of sun under overcast would show a glitter path.
  for (const genus of weather.formations) weather.sunVisibility *= frng.range(...CLOUD_GENERA[genus].sunVisibility)
  if (kind === 'overcast') weather.sunVisibility = Math.min(weather.sunVisibility, 0.002)
}

export function generateParams(date: string, attempt = 0): SceneParams {
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
  let headingDeg = rng.range(0, 360)
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
      // At night the moon is the subject: keep it low enough to share the
      // frame with the sea.
      const [lo, hi] = timeOfDay === 'night' ? [4, 18] : [4, 40]
      const score = (el > lo && el < hi ? 1 : -1) + facing + rng.range(0, 0.5)
      if (score > bestScore) {
        bestScore = score
        best = candidate
      }
    }
    moonDirection = best
    if (timeOfDay === 'night') {
      // Turn toward the moon so its glitter path runs across the water.
      const moonAzDeg = Math.atan2(moonDirection[0], -moonDirection[2]) / DEG
      headingDeg = moonAzDeg + Random.derive(seed, 'moon-framing').normal(0, 14)
    }
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

  // Wind: mostly calm-to-moderate seas, fresher under heavy cloud (fronts)
  // and lighter on clear days. The weather has its own random stream, so this
  // doesn't shift any other parameter of the day.
  const weather = generateWeather(seed, timeOfDay)
  const windByWeather: Record<WeatherKind, number> = {
    clear: 0.85,
    cirrus: 0.95,
    few: 0.95,
    scattered: 1,
    broken: 1.15,
    overcast: 1.3
  }
  const windSpeed =
    rng.weighted<() => number>([
      [() => rng.range(1.5, 4), 3],
      [() => rng.range(4, 8), 4],
      [() => rng.range(8, 14), 2]
    ])() * windByWeather[weather.kind]
  const windHeadingDeg = rng.range(0, 360)

  const biome = rng.weighted(BIOMES)
  addFormations(seed, weather, biome)
  const water = Random.derive(seed, 'water').pick(biome.water)
  const oceanState = { windSpeed, windHeadingDeg, ...swell(seed, windHeadingDeg) }
  const { coast, eyeHeight } = generateCoast(seed, attempt, headingDeg, biome, oceanState)

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
    coast.type === 'beach' ? `${biome.name} ${coast.sand.name} sand beach` : seaName(windSpeed)
  ]
  if (coast.type === 'beach' && windSpeed >= 10) titleParts.push('windy')
  const skyTitle = weather.formations.map(g => CLOUD_GENERA[g].title).find(t => t != null)
  if (skyTitle != null && timeOfDay !== 'night') titleParts.push(skyTitle)
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
    biome,
    coast,
    weather,
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
