import { MoonPhase } from 'astronomy-engine'

import { BIOMES, SAND_STYLES, type Biome, type SandStyle, type WaterStyle } from './biome'
import { CLOUD_GENERA, pickFormations, type CloudGenus } from './cloudTypes'
import { pickOcean, type IceParams, type OceanName } from './oceans'
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

export type WeatherKind = 'clear' | 'cirrus' | 'few' | 'scattered' | 'broken' | 'overcast' | 'storm'

/** Seabird colonies: gannets on white, guano-streaked rock; puffins and
 * guillemots on grassy-topped islands; boobies and frigatebirds on tropical
 * islets; penguin rookeries in the Southern Ocean. */
export type ColonyKind = 'gannet' | 'puffin' | 'tropical' | 'penguin'

/** Seals and sea lions hauled out on the rocks (props/pinnipeds.ts):
 * - seal: harbour and grey seals (true seals: no ear flaps, they lie on
 *   their bellies, often in a "banana" with head and tail up), on the
 *   skerries of the North Atlantic and North Pacific, and the Arctic;
 * - sea-lion: eared seals propped up on long fore flippers — California,
 *   Steller, Galápagos, South American and Australian sea lions;
 * - fur-seal: smaller, dark eared seals in dense, noisy colonies — Cape fur
 *   seals on the Namibian desert coast, Antarctic and South American ones;
 * - elephant-seal: huge, blubbery true seals of the Southern Ocean and
 *   California, bulls with a trunk-like nose. */
export type PinnipedKind = 'seal' | 'sea-lion' | 'fur-seal' | 'elephant-seal'

/**
 * Big landforms seen from the shore: a coastal range (fjord walls, Andes,
 * Big Sur) or a volcano — a steep, concave stratovolcano cone (Fuji, Mayon,
 * Etna) or a broad shield (Hawaii) — dormant and often snow-capped, or
 * active with a steam or ash plume and, after sunset, glowing lava.
 */
export interface LandformParams {
  kind: 'range' | 'strato' | 'shield'
  /** World azimuth and distance (m) of its centre. */
  azimuthDeg: number
  distance: number
  /** Peak height above the sea and width across the view (m). */
  height: number
  width: number
  /** Height above which snow lies (m); Infinity for none. */
  snowLine: number
  plume: 'steam' | 'ash' | null
  /** Lava glowing at the crater and down the flank (dusk and dark only). */
  lava: boolean
  seed: number
}

export interface RainbowParams {
  /** 0..1: how much of the bow's light the rain gives back. */
  strength: number
  /** Whether the fainter secondary bow (≈51°) shows. */
  secondary: boolean
  /** The shower's rain shafts, around the antisolar point. */
  showers: StormParams['curtains']
}

/** A thunderstorm or squall over the sea: a rare event (see generateStorm). */
export interface StormParams {
  /** Rain shafts hanging from the cloud base: azimuth (deg, world), distance
   * and width (m). */
  curtains: { azimuthDeg: number; distance: number; width: number }[]
  /** Lightning strikes caught in the frame. */
  bolts: { azimuthDeg: number; distance: number; seed: number }[]
  /** Rain falling at the camera, 0..1 (streaks over the image). */
  rain: number
}

/**
 * Fog over the sea. Fog forms when air cools to its dew point:
 * - advection (sea) fog: warm, moist air flowing over colder water — above
 *   all the cold upwelling currents of west coasts: California and Chile in
 *   summer, the Namib (Benguela) and Atacama coasts nearly all year — and
 *   the North Sea, Newfoundland and the Arctic in spring and summer. It
 *   needs a light breeze; stronger winds (≳ 5 m/s) mix it up into a low
 *   stratus deck. It often lies offshore as a bank and rolls in;
 * - steam fog, "Arctic sea smoke": very cold air over far warmer water
 *   (≳ 10 °C apart) in polar winters — thin, wispy columns rising off a calm
 *   sea under a clear sky.
 * Fog is likeliest at dawn and burns off as the sun climbs.
 */
export interface FogParams {
  kind: 'advection' | 'sea-smoke'
  /** Visibility in the fog at sea level (m): contrast falls to 2% there. */
  visibility: number
  /** Scale height of the fog layer (m): it thins out exponentially above. */
  height: number
  /** Horizontal distance where the fog starts (m): 0 = we're in it; else a
   * bank lying offshore. */
  start: number
  seed: number
}

/**
 * A lighthouse. They stand where ships need a mark: on headlands and rocky
 * points, on reefs and rocks out at sea (Eddystone, Bell Rock, Fastnet),
 * and at harbour mouths; most on the rocky, foggy, busy coasts of northern
 * Europe, New England, Japan and the Mediterranean, fewer on the empty
 * tropical and desert shores and almost none in the polar seas.
 *
 * The light is a lamp inside a Fresnel lens of glass panels; each panel
 * gathers the light into a beam a few degrees wide, and the lens turns, so
 * each beam sweeps round and a ship sees a flash as it passes. The panels'
 * grouping and the turning speed give each light its own "character" on the
 * chart, e.g. "Fl(2) W 15s" (two white flashes every 15 s). On a point, the
 * landward side is screened off. The beams themselves only show where
 * there's something to scatter them: haze, sea spray, above all fog.
 */
export interface LighthouseParams {
  /** point: on a rocky point of the shore; rock: on a rock out at sea. */
  site: 'point' | 'rock'
  /** white; red (Norway, Sweden); red or black bands; bare granite
   * (wave-swept rock towers). */
  paint: 'white' | 'red' | 'red-bands' | 'black-bands' | 'granite'
  /** Tower height (m), base to lantern top. */
  height: number
  /** Chart character, e.g. "Fl(2) W 15s". */
  character: string
  /** Beams in a group (flashes per group) and groups round the lens. */
  flashes: number
  groups: number
  /** Where the lens has turned to: azimuth (deg, world) of the first beam. */
  beamAzimuthDeg: number
  /** Lit from sunset to sunrise, and in fog. */
  lit: boolean
  seed: number
}

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
  /** Which of Earth's oceans this is (oceans.ts). */
  sea: {
    ocean: OceanName
    label: string
    /** Indian Ocean south-west monsoon season. */
    monsoon: boolean
    ice: IceParams | null
  }
  coast: CoastParams
  weather: WeatherParams
  storm: StormParams | null
  /** An offshore island with a seabird colony (props/colony.ts). */
  colony: ColonyKind | null
  /** Seals or sea lions hauled out on an islet or the colony's rocks. */
  pinnipeds: PinnipedKind | null
  /** A passing shower opposite a low sun, and the rainbow in it. */
  rainbow: RainbowParams | null
  /** Mountains or a volcano on the horizon (props/landforms.ts). */
  landform: LandformParams | null
  /** Sea fog or sea smoke (fog.ts). */
  fog: FogParams | null
  /** A lighthouse on a point or a rock (props/lighthouse.ts, lighthouse.ts). */
  lighthouse: LighthouseParams | null

  camera: {
    /** Above sea level for open sea; above the ground on a beach. */
    heightM: number
    headingDeg: number
    /** Where the horizon sits, as a fraction of image height from the top.
     * The renderer solves the camera pitch from this. */
    horizonFraction: number
    rollDeg: number
    /** 35 mm-equivalent focal length, applied to the image's long side. */
    focalLengthMm: number
    /** Width / height of the image the scene is composed for. */
    aspect: number
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
    overcast: [0.68, 0.8],
    storm: [0.55, 0.68]
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
  // Storms bring their own cumulonimbus (generateStorm).
  if (kind === 'storm') return
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

/**
 * Storms: towering cumulonimbus with dark bases, a gale whipping up the sea,
 * grey rain shafts under the cells and, in most of them, lightning. Over the
 * open ocean thunderstorms are rarer than over land, but squall lines and
 * frontal storms pass through often enough to make them a chance event.
 * Not at night: the scene is moonlit and a storm would hide the moon.
 */
/** Half the horizontal field of view (degrees) of a lens on an image. */
export function horizontalHalfFovDeg(focalLengthMm: number, aspect: number): number {
  const longHalf = Math.atan(18 / focalLengthMm)
  return (aspect >= 1 ? longHalf : Math.atan(Math.tan(longHalf) * aspect)) / DEG
}

function generateStorm(seed: string, timeOfDay: TimeOfDay, headingDeg: number, halfFovDeg: number): StormParams | null {
  const rng = Random.derive(seed, 'storm')
  if (timeOfDay === 'night' || !rng.chance(0.07)) return null
  // Keep strikes and shafts inside the frame (a little narrower than the lens).
  const halfFov = Math.min(30, halfFovDeg * 0.8)
  const curtains = Array.from({ length: rng.int(1, 4) }, () => ({
    azimuthDeg: headingDeg + rng.range(-halfFov * 1.6, halfFov * 1.6),
    distance: rng.range(3000, 16000),
    width: rng.range(800, 4000)
  }))
  const lightning = rng.chance(0.75)
  const bolts = lightning
    ? Array.from({ length: rng.weighted([[1, 4], [2, 2], [3, 1]] as const) }, () => ({
        azimuthDeg: headingDeg + rng.range(-halfFov, halfFov),
        distance: rng.range(2500, 14000),
        seed: rng.int(0, 1_000_000)
      }))
    : []
  return { curtains, bolts, rain: rng.chance(0.4) ? rng.range(0.3, 1) : 0 }
}

/** Monthly fog season for a coast, as a chance multiplier (northern
 * hemisphere months; the Southern Ocean's seasons are flipped). */
function fogSeason(month: number, summer: boolean): number {
  const warm = month >= 5 && month <= 9
  return warm === summer ? 1 : 0.35
}

function pickFog(
  seed: string,
  biome: Biome,
  ocean: OceanName,
  month: number,
  timeOfDay: TimeOfDay,
  weather: WeatherParams,
  windSpeed: number
): FogParams | null {
  const rng = Random.derive(seed, 'fog')
  // Gales and showers clear it away.
  if (weather.kind === 'storm' || windSpeed > 11) return null
  const southern = ocean === 'southern'
  // Advection fog where warm air meets cold water.
  const advection: Partial<Record<Biome['name'], Partial<Record<OceanName, number>>>> = {
    mediterranean: { pacific: 0.3 * fogSeason(month, true), atlantic: 0.04 },
    desert: { atlantic: 0.3, pacific: 0.25 },
    nordic: { atlantic: 0.14 * fogSeason(month, true), pacific: 0.16 * fogSeason(month, true), arctic: 0.25 * fogSeason(month, true), southern: 0.12 },
    volcanic: { pacific: 0.08, atlantic: 0.1, southern: 0.12 }
  }
  // Sea smoke where bitter air meets open water in a polar winter.
  const winter = southern ? month >= 5 && month <= 9 : month <= 3 || month >= 11
  const smoke = winter && (ocean === 'arctic' || southern) ? 0.25 : winter && biome.name === 'nordic' ? 0.06 : 0
  // Fog peaks around dawn and burns off by midday.
  const hour: Record<TimeOfDay, number> = { 'golden-hour': 1.2, 'sun-on-horizon': 1.3, 'blue-hour': 1.3, night: 1.1, daylight: 0.8, midday: 0.4 }
  // The breeze that brings sea fog in must be light: stronger winds lift it.
  const breeze = windSpeed < 6 ? 1 : (11 - windSpeed) / 5
  const advectionChance = (advection[biome.name]?.[ocean] ?? (biome.name === 'tropical' ? 0.01 : 0.03)) * hour[timeOfDay] * breeze
  // Sea smoke needs a calm sea and a clear, cold sky.
  const smokeChance = smoke * (windSpeed < 5 ? 1 : 0) * (weather.kind === 'clear' || weather.kind === 'few' || weather.kind === 'cirrus' ? 1 : 0.3)
  const draw = rng.float()
  if (draw < smokeChance) {
    return { kind: 'sea-smoke', visibility: rng.range(400, 2500), height: rng.range(6, 25), start: 0, seed: rng.int(0, 100_000) }
  }
  if (draw < smokeChance + advectionChance) {
    // Half the time it's a bank offshore, rolling in.
    const bank = rng.chance(0.5)
    return {
      kind: 'advection',
      visibility: bank ? rng.range(80, 300) : rng.range(250, 1500),
      // A bank is a low wall a few tens of metres thick; inside the fog it
      // thins out over the marine layer's first hundred metres or so.
      height: bank ? rng.range(18, 50) : rng.range(30, 120),
      start: bank ? rng.range(400, 2500) : 0,
      seed: rng.int(0, 100_000)
    }
  }
  return null
}

function pickLandform(
  seed: string,
  biome: Biome,
  ocean: OceanName,
  timeOfDay: TimeOfDay,
  headingDeg: number,
  halfFovDeg: number
): LandformParams | null {
  const rng = Random.derive(seed, 'landform')
  const chance: Record<Biome['name'], number> = { volcanic: 0.55, nordic: 0.4, mediterranean: 0.25, tropical: 0.2, desert: 0.2 }
  if (!rng.chance(chance[biome.name])) return null
  const volcanoChance: Record<Biome['name'], number> = { volcanic: 0.85, nordic: 0.15, mediterranean: 0.3, tropical: 0.45, desert: 0.1 }
  const volcano = rng.chance(volcanoChance[biome.name])
  const kind = volcano ? (rng.chance(0.75) ? 'strato' : 'shield') : 'range'
  const height = kind === 'range' ? rng.range(900, 2600) : kind === 'strato' ? rng.range(1500, 3800) : rng.range(1200, 4000)
  const distance = rng.range(12_000, kind === 'shield' ? 70_000 : 45_000)
  const width = kind === 'range' ? rng.range(25_000, 70_000) : kind === 'strato' ? height * rng.range(6, 9) : height * rng.range(18, 28)
  // Snow on high peaks; always in polar and nordic seas, never in deserts.
  const polar = ocean === 'arctic' || ocean === 'southern'
  const snowLine = biome.name === 'desert' ? Infinity : polar ? height * rng.range(0.15, 0.4) : biome.name === 'nordic' ? height * rng.range(0.35, 0.6) : height > 2800 || rng.chance(0.3) ? height * rng.range(0.6, 0.85) : Infinity
  const active = volcano && rng.chance(0.4)
  const dark = timeOfDay === 'sun-on-horizon' || timeOfDay === 'blue-hour'
  return {
    kind,
    azimuthDeg: headingDeg + rng.range(-halfFovDeg, halfFovDeg) * 0.8,
    distance,
    height,
    width,
    snowLine,
    plume: active ? (rng.chance(0.65) ? 'steam' : 'ash') : null,
    lava: active && dark && kind === 'strato' && rng.chance(0.7),
    seed: rng.int(0, 1_000_000)
  }
}

function pickColony(seed: string, ocean: OceanName, biome: Biome): ColonyKind | null {
  const rng = Random.derive(seed, 'colony')
  if (!rng.chance(0.15)) return null
  if (ocean === 'southern') return 'penguin'
  if (biome.name === 'tropical' || biome.name === 'desert') return 'tropical'
  const northern = ocean === 'arctic' || biome.name === 'nordic' || biome.name === 'volcanic'
  return northern && rng.chance(0.5) ? 'puffin' : 'gannet'
}

/** Where each kind of seal lives, by coast and ocean (relative weights). */
const PINNIPEDS: Record<Biome['name'], Partial<Record<OceanName, readonly (readonly [PinnipedKind, number])[]>>> = {
  // Norway, Scotland, Iceland; Alaska and British Columbia (Steller sea
  // lions); Svalbard and Greenland; Tierra del Fuego.
  nordic: {
    atlantic: [['seal', 1]],
    pacific: [['seal', 2], ['sea-lion', 1]],
    arctic: [['seal', 1]],
    southern: [['fur-seal', 1], ['elephant-seal', 1]]
  },
  // California (sea lions, elephant seals and harbour seals share the
  // Channel Islands), south-west Australia (Australian sea lions). The
  // Mediterranean monk seal is nearly gone.
  mediterranean: {
    pacific: [['sea-lion', 3], ['seal', 1], ['elephant-seal', 1]],
    indian: [['sea-lion', 1]]
  },
  // Namibia's Skeleton Coast (Cape fur seals by the hundred thousand); the
  // Atacama and Peru (South American sea lions and fur seals).
  desert: {
    atlantic: [['fur-seal', 1]],
    pacific: [['sea-lion', 2], ['fur-seal', 1]]
  },
  // Galápagos sea lions; Iceland's and Japan's seals; Heard Island.
  volcanic: {
    pacific: [['sea-lion', 2], ['seal', 1]],
    atlantic: [['seal', 1]],
    southern: [['elephant-seal', 2], ['fur-seal', 2]]
  },
  // Only the Galápagos, right on the equator, has sea lions on tropical
  // shores (Hawaiian monk seals are too few).
  tropical: { pacific: [['sea-lion', 1]] }
}

function pickPinnipeds(seed: string, ocean: OceanName, biome: Biome): PinnipedKind | null {
  const rng = Random.derive(seed, 'pinnipeds')
  const table = PINNIPEDS[biome.name][ocean]
  // Tropical sea lions are confined to one archipelago: rarer.
  const chance = biome.name === 'tropical' ? 0.06 : 0.2
  if (table == null || !rng.chance(chance)) return null
  return rng.weighted(table)
}

/** How likely a lighthouse is on each coast. */
const LIGHTHOUSE_CHANCE: Record<Biome['name'], number> = { nordic: 0.16, mediterranean: 0.14, volcanic: 0.1, desert: 0.06, tropical: 0.06 }

function pickLighthouse(
  seed: string,
  biome: Biome,
  ocean: OceanName,
  coastType: CoastParams['type'],
  timeOfDay: TimeOfDay,
  fog: FogParams | null
): LighthouseParams | null {
  const rng = Random.derive(seed, 'lighthouse')
  // Polar seas: a handful of lights for thousands of kilometres of coast.
  const polar = ocean === 'arctic' || ocean === 'southern' ? 0.2 : 1
  if (!rng.chance(LIGHTHOUSE_CHANCE[biome.name] * polar)) return null
  const site = coastType === 'beach' && rng.chance(0.6) ? 'point' : 'rock'
  // Rock towers are squat granite or painted; Scandinavian lights are often
  // red cast iron; banded towers everywhere.
  const paints: [LighthouseParams['paint'], number][] =
    biome.name === 'nordic'
      ? [['white', 2], ['red', 3], ['red-bands', 2], ['black-bands', 1]]
      : biome.name === 'mediterranean'
        ? [['white', 5], ['black-bands', 1], ['red-bands', 1]]
        : [['white', 3], ['red-bands', 2], ['black-bands', 2]]
  if (site === 'rock') paints.push(['granite', 3])
  const paint = rng.weighted(paints)
  const height = site === 'rock' ? rng.range(22, 45) : rng.range(14, 32)
  // Group flashing (several panels close together) or single flashes.
  const flashes = rng.weighted<number>([[1, 3], [2, 2], [3, 1]])
  const groups = rng.weighted<number>([[1, 2], [2, 2], [3, 1], [4, 1]])
  const period = Math.round(rng.range(2, 6) * flashes * groups / 1.5) * 1.5
  const character = `${flashes > 1 ? `Fl(${flashes})` : 'Fl'} W ${Math.max(3, period)}s`
  const dark = timeOfDay === 'night' || timeOfDay === 'blue-hour' || timeOfDay === 'sun-on-horizon'
  return {
    site,
    paint,
    height,
    character,
    flashes,
    groups,
    beamAzimuthDeg: rng.range(0, 360),
    lit: dark || fog != null,
    seed: rng.int(0, 1_000_000)
  }
}

/**
 * Scene parameters for a date. `aspect` (width / height) only recomposes the
 * shot — portrait phones get the same day's scene, framed for a tall image —
 * and never changes what's in it.
 */
export function generateParams(date: string, attempt = 0, aspect = 16 / 9): SceneParams {
  // A tall frame is narrow: keep low suns and the moon well inside it.
  const framing = Math.min(1, aspect)
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
  // The weather has its own random stream, so drawing it here doesn't shift
  // any other parameter of the day.
  const weather = generateWeather(seed, timeOfDay)

  // Rainbows: a shower passing on a sunny, showery day while the sun is low
  // (the bow is a 42° circle around the point opposite the sun, so it's only
  // above the horizon when the sun is below 42°). On those days the camera
  // turns its back to the sun.
  const rainbowRng = Random.derive(seed, 'rainbow')
  const rainbowDay =
    (timeOfDay === 'golden-hour' || timeOfDay === 'daylight') &&
    (weather.kind === 'scattered' || weather.kind === 'broken') &&
    rainbowRng.chance(0.15)

  // Camera heading, then the sun relative to it. Low suns are usually framed
  // in or near the view for glitter paths; high suns can be anywhere.
  let headingDeg = rng.range(0, 360)
  const [elMin, elMax] = SUN_ELEVATION[timeOfDay]
  const sunElevationDeg = rng.range(elMin, elMax)
  const lowSun = timeOfDay !== 'midday' && timeOfDay !== 'daylight'
  const drawnSunAz = lowSun && rng.chance(0.7) ? rng.normal(0, 18 * framing) : rng.range(-180, 180)
  const relSunAz = rainbowDay ? 180 + rainbowRng.normal(0, 10 * framing) : drawnSunAz
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
      headingDeg = moonAzDeg + Random.derive(seed, 'moon-framing').normal(0, 14 * framing)
    }
  }
  const moonElevationDeg = elevationOf(moonDirection)

  const heightM = rng.weighted<() => number>([
    [() => rng.range(1.2, 4), 4],
    [() => rng.range(6, 25), 4],
    [() => rng.range(40, 160), 2]
  ])()
  const drawnFocalLength = rng.weighted<() => number>([
    [() => rng.range(18, 28), 3],
    [() => rng.range(28, 50), 4],
    [() => rng.range(50, 90), 2]
  ])()
  // A rainbow spans 84°: go wide to get most of the arc in.
  const focalLengthMm = rainbowDay ? Math.min(drawnFocalLength, rainbowRng.range(14, 22)) : drawnFocalLength

  // Wind: mostly calm-to-moderate seas, fresher under heavy cloud (fronts)
  // and lighter on clear days.
  const windByWeather: Record<WeatherKind, number> = {
    clear: 0.85,
    cirrus: 0.95,
    few: 0.95,
    scattered: 1,
    broken: 1.15,
    overcast: 1.3,
    storm: 1
  }
  let windSpeed =
    rng.weighted<() => number>([
      [() => rng.range(1.5, 4), 3],
      [() => rng.range(4, 8), 4],
      [() => rng.range(8, 14), 2]
    ])() * windByWeather[weather.kind]
  const windHeadingDeg = rng.range(0, 360)

  const storm = generateStorm(seed, timeOfDay, headingDeg, horizontalHalfFovDeg(focalLengthMm, aspect))
  if (storm != null) {
    const srng = Random.derive(seed, 'storm-weather')
    weather.kind = 'storm'
    weather.coverage = srng.range(0.55, 0.68)
    weather.formations = srng.chance(0.6) ? ['cumulonimbus', 'altostratus'] : ['cumulonimbus']
    // Gale-force gusts under the cells; the spectrum turns them into a high,
    // breaking sea.
    windSpeed = srng.range(14, 22)
    weather.sunVisibility = srng.chance(0.4) ? srng.range(0.15, 0.4) : srng.range(0, 0.05)
  }

  let biome = rng.weighted(BIOMES)
  addFormations(seed, weather, biome)
  const waterRng = Random.derive(seed, 'water')
  const orng = Random.derive(seed, 'ocean')
  const { basin, monsoon, ice } = pickOcean(orng, biome, Number(date.slice(5, 7)))
  const water = basin.water ?? waterRng.pick(biome.water)
  // Polar coasts: tundra grass and shrubs (and birch in the Arctic), no trees
  // from warmer climates.
  if (basin.water != null) {
    const hardy = basin.name === 'arctic' ? ['grass', 'bush', 'birch'] : ['grass', 'bush']
    const vegetation = biome.vegetation.filter(([kind]) => hardy.includes(kind))
    biome = { ...biome, vegetation: vegetation.length > 0 ? vegetation : [['grass', 1]] }
  }
  // The ocean shapes its sea: Southern gales, Pacific groundswell, monsoon
  // seas; pack ice smothers waves, leaving calm leads between the floes.
  const iceCalm = ice != null && ice.packIce > 0 ? 0.4 : 1
  windSpeed = Math.min(24, windSpeed * basin.wind * (monsoon ? 1.35 : 1))
  const fog = rainbowDay ? null : pickFog(seed, biome, basin.name, Number(date.slice(5, 7)), timeOfDay, weather, windSpeed)
  if (fog != null) {
    // Fog comes with light airs: the sea calms under it.
    windSpeed = Math.min(windSpeed, fog.kind === 'sea-smoke' ? 3 : 6)
    // Inside the fog the sun is dimmed by the layer between it and us.
    if (fog.start === 0) {
      const sinEl = Math.max(0.05, Math.sin(sunElevationDeg * DEG))
      weather.sunVisibility *= Math.exp(-((3.912 / fog.visibility) * fog.height) / sinEl)
    }
  }
  const oceanSwell = swell(seed, windHeadingDeg)
  oceanSwell.swellHeight *= basin.swellHeight * (monsoon ? 1.5 : 1) * iceCalm * iceCalm
  oceanSwell.swellWavelength = Math.min(320, oceanSwell.swellWavelength * basin.swellWavelength)
  const oceanState = { windSpeed: windSpeed * iceCalm, windHeadingDeg, ...oceanSwell }
  const { coast, eyeHeight } = generateCoast(seed, attempt, headingDeg, biome, oceanState)

  const timeLabel: Record<TimeOfDay, string> = {
    'golden-hour': isEvening ? 'Golden hour' : 'Morning gold',
    'sun-on-horizon': isEvening ? 'Sunset' : 'Sunrise',
    'blue-hour': isEvening ? 'Dusk' : 'Dawn',
    daylight: isEvening ? 'Afternoon' : 'Morning',
    midday: 'Midday',
    night: 'Moonlit night'
  }
  const colony = pickColony(seed, basin.name, biome)
  const pinnipeds = pickPinnipeds(seed, basin.name, biome)
  const lighthouse = pickLighthouse(seed, biome, basin.name, coast.type, timeOfDay, fog)
  const landform = pickLandform(seed, biome, basin.name, timeOfDay, headingDeg, horizontalHalfFovDeg(focalLengthMm, aspect))
  let rainbow: RainbowParams | null = null
  if (rainbowDay && storm == null) {
    const antisolarAz = headingDeg + relSunAz + 180
    rainbow = {
      strength: rainbowRng.range(0.5, 1),
      secondary: rainbowRng.chance(0.6),
      showers: Array.from({ length: rainbowRng.int(1, 3) }, () => ({
        azimuthDeg: antisolarAz + rainbowRng.range(-35, 35),
        distance: rainbowRng.range(2500, 9000),
        width: rainbowRng.range(1500, 5000)
      }))
    }
  }

  const titleParts = [
    timeLabel[timeOfDay],
    coast.type === 'beach' ? `${biome.name} ${coast.sand.name} sand beach` : seaName(oceanState.windSpeed),
    basin.label
  ]
  if (landform != null) {
    titleParts.push(
      landform.kind === 'range'
        ? 'mountains'
        : landform.lava
          ? 'erupting volcano'
          : landform.plume != null
            ? 'smoking volcano'
            : 'volcano'
    )
  }
  if (rainbow != null) titleParts.push('rainbow')
  if (colony != null) titleParts.push(colony === 'penguin' ? 'penguin colony' : 'seabird island')
  if (pinnipeds != null) {
    const names: Record<PinnipedKind, string> = {
      seal: 'seals',
      'sea-lion': 'sea lions',
      'fur-seal': 'fur seals',
      'elephant-seal': 'elephant seals'
    }
    titleParts.push(names[pinnipeds])
  }
  if (lighthouse != null) titleParts.push('lighthouse')
  if (ice != null) titleParts.push(ice.packIce > 0 ? 'pack ice' : 'icebergs')
  if (fog != null) titleParts.push(fog.kind === 'sea-smoke' ? 'sea smoke' : fog.start > 0 ? 'fog bank' : 'fog')
  if (storm != null) {
    titleParts.push(storm.bolts.length > 0 ? 'thunderstorm' : 'squall')
  } else {
    if (coast.type === 'beach' && windSpeed >= 10) titleParts.push('windy')
    const skyTitle = weather.formations.map(g => CLOUD_GENERA[g].title).find(t => t != null)
    if (skyTitle != null && timeOfDay !== 'night') titleParts.push(skyTitle)
  }
  if (moonElevationDeg > 1 && moonIllumination > 0.05) titleParts.push(moonPhaseName(moonPhaseDeg))

  const moonScale = rng.range(1.2, 2.4)
  rng.float() // was the latitude draw; keeps the rest of the main stream in place
  const [latMin, latMax] = biome.name === 'tropical' ? [5, 23] : basin.latitude
  const latitudeDeg = orng.range(latMin, latMax)

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
    moonScale,
    latitudeDeg,
    biome,
    sea: { ocean: basin.name, label: basin.label, monsoon, ice },
    coast,
    weather,
    storm,
    colony,
    pinnipeds,
    rainbow,
    landform,
    fog,
    lighthouse,
    camera: {
      heightM: eyeHeight ?? heightM,
      headingDeg,
      horizonFraction: rng.weighted<() => number>([
        [() => rng.range(0.55, 0.68), 3], // more sky
        [() => rng.range(0.32, 0.45), 2], // more sea
        [() => rng.range(0.45, 0.55), 1]
      ])(),
      rollDeg: rng.normal(0, 0.3),
      focalLengthMm,
      aspect
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
