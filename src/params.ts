import { MoonPhase } from 'astronomy-engine'

import { eclipseOfType, eclipseOn, moonlight as phaseLight, type EclipseParams } from './celestial'

import { BIOMES, SAND_STYLES, type Biome, type SandStyle, type WaterStyle } from './biome'
import type { CloudArrangement } from './cloudArrangement'
import { contrailsFor, type Contrail } from './contrails'
import { CLOUD_GENERA, pickFormations, pickSpecies, type CloudGenus } from './cloudTypes'
import { pickOcean, type IceParams, type OceanName } from './oceans'
import { Random } from './random'
import { deepPatch, forced, forcedKind, type Force, type PropOverrides, type SceneSpec } from './sceneSpec'

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

/** Where the colony is: an island offshore, or on the mainland — seabird
 * cliffs on a headland (Bempton, Muriwai, Látrabjarg), or for penguins a
 * rookery spread over the beach (South Georgia, Boulders Beach). */
export type ColonySite = 'island' | 'mainland'

export interface ColonyParams {
  kind: ColonyKind
  site: ColonySite
}

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

/** Where they haul out: a rock (a skerry, the colony's ledges) or the
 * mainland beach (elephant seals at Piedras Blancas, Cape fur seals at Cape
 * Cross, harbour seals on sandbanks). */
export type HaulOut = 'rock' | 'beach'

export interface PinnipedParams {
  kind: PinnipedKind
  site: HaulOut
}

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

/**
 * Islands offshore, a few kilometres out (props/islands.ts):
 * - skerries: low, ice-smoothed granite humps in groups, with dark pines on
 *   the bigger ones (the Stockholm and Finnish archipelagos, Norway); bare
 *   in the polar seas;
 * - rocky: steep islands with cliffs and a cap of scrub, hazy blue far out
 *   (the Aegean, Dalmatia), bare rock on desert coasts (the Red Sea, Baja);
 * - cay: low sand islets crowned with palms, a white beach round them
 *   (the Maldives, the Caribbean, Pacific atoll motu);
 * - karst: sheer limestone towers with jungle on top (Ha Long Bay, Phang
 *   Nga, Palawan);
 * - high: big volcanic islands, ridged and forested (Moorea, the Azores,
 *   the Canaries' greener ones), with snow in cold seas.
 */
export type IslandKind = 'skerries' | 'rocky' | 'cay' | 'karst' | 'high'

export interface IslandParams {
  kind: IslandKind
  islands: {
    /** Across the frame, −1…1 of the half field of view (a first guess:
     * the prop moves islands that land on the shore or out of frame). */
    offset: number
    /** Distance from the camera (m). */
    distance: number
    /** Width across and peak height above the sea (m). */
    width: number
    height: number
    seed: number
  }[]
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
  /** Cloud genera and species in the sky, one takram layer each (at most
   * four); usually one per étage (low, middle, high). */
  formations: CloudGenus[]
  /** Duplicatus: a genus listed twice is a second deck this much higher (m). */
  duplicatusLiftM: number | null
  /** Cloud streets along the wind or wave bands across it
   * (cloudArrangement.ts); the wind's azimuth (deg). */
  arrangement: { kind: CloudArrangement; headingDeg: number } | null
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
  /** The light is the evening's (sunset side), not the morning's. */
  evening: boolean
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
  /** Sun disc size relative to the real one (bigger on eclipse days, to
   * match the moon's). */
  sunScale: number
  /** Night only: lit by the moon, or by the stars alone (moon down or new). */
  nightSky: 'moonlit' | 'starlit' | null
  /** Moonlight on the scene relative to a full moon (phase law, eclipse);
   * 0 for a starlit night. */
  moonlight: number
  /** A real eclipse on this date (celestial.ts). */
  eclipse: EclipseParams | null

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
  /** A seabird or penguin colony, offshore or on the mainland (props/colony.ts). */
  colony: ColonyParams | null
  /** Seals or sea lions hauled out on a rock, the colony's ledges or the beach. */
  pinnipeds: PinnipedParams | null
  /** A passing shower opposite a low sun, and the rainbow in it. */
  rainbow: RainbowParams | null
  /** Mountains or a volcano on the horizon (props/landforms.ts). */
  landform: LandformParams | null
  /** Islands offshore (props/islands.ts). */
  islands: IslandParams | null
  /** Sea fog or sea smoke (fog.ts). */
  fog: FogParams | null
  /** Aircraft trails high in the sky (contrails.ts). */
  contrails: Contrail[]
  /** A lighthouse on a point or a rock (props/lighthouse.ts, lighthouse.ts). */
  lighthouse: LighthouseParams | null
  /** What a scene spec forces the props to show (sceneSpec.ts); absent on
   * ordinary days. */
  overrides?: PropOverrides

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

/** The drawn value unless a spec forces one. The draw is always made (it's
 * an argument), so forcing one choice doesn't shift the stream for others. */
function or<T>(drawn: T, force: T | undefined): T {
  return force === undefined ? drawn : force
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

/** The real sun's and moon's angular radii (radians; takram's defaults). */
export const SUN_ANGULAR_RADIUS = 0.004675
export const MOON_ANGULAR_RADIUS = 0.0045
/** On eclipse days the sun is drawn this much bigger, and the moon to
 * match, so the eclipse reads at wallpaper size. */
const ECLIPSE_SCALE = 3

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
  ocean: Pick<SceneParams['ocean'], 'swellHeight' | 'swellWavelength' | 'windSpeed'>,
  spec: SceneSpec
): { coast: CoastParams; eyeHeight: number | null } {
  // Retries (see composition.ts) re-roll only the coast and composition.
  const suffix = attempt > 0 ? `#${attempt}` : ''
  const rng = Random.derive(seed, `coast${suffix}`)
  // Beach or open sea is decided once per date; retries keep it.
  const drawnType = Random.derive(seed, 'coast').chance(0.65) ? 'beach' : 'open-sea'
  const type = or(drawnType, spec.coast ?? (spec.composition != null ? 'beach' : undefined))
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
    sand: SAND_STYLES[or(rng.pick(biome.sands), spec.sand)],
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
    coast.composition = or(
      crng.weighted<Composition>([
        ['shoreline', 3],
        ['along-beach', 3],
        ['framed', 2],
        ['overlook', 2]
      ]),
      spec.composition
    )
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

function generateWeather(seed: string, timeOfDay: TimeOfDay, force?: WeatherKind): WeatherParams {
  const rng = Random.derive(seed, 'weather')
  const drawn = rng.weighted<WeatherKind>([
    ['clear', 12],
    ['cirrus', 13],
    ['few', 20],
    ['scattered', 25],
    ['broken', 18],
    ['overcast', timeOfDay === 'night' || timeOfDay === 'blue-hour' ? 2 : 7]
  ])
  const kind = or(drawn, force)
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
    duplicatusLiftM: null,
    arrangement: null,
    sunVisibility: 1,
    weatherOffset: [rng.range(0, 1), rng.range(0, 1)],
    shapeOffset: [rng.range(0, 1), rng.range(0, 1), rng.range(0, 1)]
  }
}

/** Which clouds make up the sky; its own streams, and it depends on the
 * coast, the season, the wind and the time of day. */
function addFormations(
  seed: string,
  weather: WeatherParams,
  biome: Biome,
  context: { month: number; southern: boolean; windSpeed: number; morning: boolean },
  clouds?: CloudGenus[]
): void {
  const frng = Random.derive(seed, 'formations')
  const { kind } = weather
  // Storms bring their own cumulonimbus (stormFormations).
  if (kind === 'storm') {
    if (clouds != null) weather.formations = clouds
    return
  }
  if (clouds != null) weather.formations = clouds
  else {
    const climate = { cool: biome.name === 'nordic' || biome.name === 'volcanic', tropical: biome.name === 'tropical' }
    const genera = pickFormations(frng, kind, climate)
    const summer = context.southern ? context.month <= 3 || context.month === 12 : context.month >= 6 && context.month <= 9
    const species = pickSpecies(Random.derive(seed, 'cloud-species'), genera, kind, {
      ...climate,
      warmSummer: summer && (biome.name === 'mediterranean' || biome.name === 'tropical'),
      windSpeed: context.windSpeed,
      morning: context.morning
    })
    weather.formations = species.formations
    weather.duplicatusLiftM = species.duplicatusLiftM
  }
  // Patchy cloud shade on sea and sand is per pixel (shadow.ts); this is only
  // the overall dimming on top. A mirror-sharp sun glint is ~1000× the sky,
  // so even a sliver of sun under overcast would show a glitter path.
  for (const genus of weather.formations) weather.sunVisibility *= frng.range(...CLOUD_GENERA[genus].sunVisibility)
  if (kind === 'overcast') weather.sunVisibility = Math.min(weather.sunVisibility, 0.002)
}

/**
 * Cloud streets (radiatus) and wave bands (undulatus), own stream. Streets
 * form in cumulus and stratocumulus on fair, breezy days (≥ 5 m/s), most in
 * the trade winds; bands in a sky whose main cloud is altocumulus,
 * cirrocumulus or stratocumulus. Not in storms.
 */
function pickArrangement(
  seed: string,
  weather: WeatherParams,
  tropical: boolean,
  windSpeed: number,
  windHeadingDeg: number,
  force?: Force<CloudArrangement>
): WeatherParams['arrangement'] {
  const rng = Random.derive(seed, 'cloud-arrangement')
  const [r1, r2] = [rng.float(), rng.float()]
  const main = weather.formations.length > 0 ? CLOUD_GENERA[weather.formations[0]] : null
  let drawn: CloudArrangement | null = null
  if (main != null && weather.kind !== 'storm') {
    const cellular = (main.genus === 'cumulus' && weather.formations[0] !== 'cumulus-congestus') || main.genus === 'stratocumulus'
    if (cellular && (weather.kind === 'few' || weather.kind === 'scattered') && windSpeed >= 5 && r1 < (tropical ? 0.4 : 0.25))
      drawn = 'streets'
    else if ((main.genus === 'altocumulus' || main.genus === 'cirrocumulus' || main.genus === 'stratocumulus') && r2 < 0.3) drawn = 'bands'
  }
  const present = forced(force, drawn != null)
  if (!present || weather.formations.length === 0) return null
  return { kind: forcedKind(force, drawn ?? 'streets'), headingDeg: windHeadingDeg }
}

/**
 * A storm's sky: the cumulonimbus, smooth-topped (calvus) or with a fibrous
 * top spreading into an anvil (capillatus: a cirrus-spissatus deck at the
 * tropopause), often an altostratus sheet (thick, opacus, when the storm is
 * dark), and scud drifting under the base. Own streams, so the storm's other
 * draws stay put.
 */
function stormFormations(seed: string, altostratus: boolean, dark: boolean): CloudGenus[] {
  const capillatus = Random.derive(seed, 'storm-anvil').chance(0.5)
  const scud = Random.derive(seed, 'storm-scud').chance(0.6)
  const formations: CloudGenus[] = capillatus ? ['cumulonimbus-capillatus', 'cirrus-spissatus'] : ['cumulonimbus']
  if (altostratus) formations.push(dark ? 'altostratus-opacus' : 'altostratus')
  if (scud) formations.push('stratus-fractus')
  return formations
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

function generateStorm(
  seed: string,
  timeOfDay: TimeOfDay,
  headingDeg: number,
  halfFovDeg: number,
  force?: Force<'thunderstorm' | 'squall'>
): StormParams | null {
  const rng = Random.derive(seed, 'storm')
  if (!forced(force, timeOfDay !== 'night' && rng.chance(0.07))) return null
  // Keep strikes and shafts inside the frame (a little narrower than the lens).
  const halfFov = Math.min(30, halfFovDeg * 0.8)
  const curtains = Array.from({ length: rng.int(1, 4) }, () => ({
    azimuthDeg: headingDeg + rng.range(-halfFov * 1.6, halfFov * 1.6),
    distance: rng.range(3000, 16000),
    width: rng.range(800, 4000)
  }))
  const lightning = or(rng.chance(0.75), force === 'squall' ? false : force === 'thunderstorm' ? true : undefined)
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
  windSpeed: number,
  force?: Force<'advection' | 'bank' | 'sea-smoke'>
): FogParams | null {
  const rng = Random.derive(seed, 'fog')
  // Gales and showers clear it away.
  if (force === undefined && (weather.kind === 'storm' || windSpeed > 11)) return null
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
  const drawn = draw < smokeChance ? 'sea-smoke' : draw < smokeChance + advectionChance ? 'advection' : null
  const kind = !forced(force, drawn != null) ? null : force === 'sea-smoke' ? 'sea-smoke' : typeof force === 'string' ? 'advection' : (drawn ?? 'advection')
  if (kind === 'sea-smoke') {
    return { kind: 'sea-smoke', visibility: rng.range(400, 2500), height: rng.range(6, 25), start: 0, seed: rng.int(0, 100_000) }
  }
  if (kind === 'advection') {
    // Half the time it's a bank offshore, rolling in.
    const bank = or(rng.chance(0.5), force === 'bank' ? true : force === 'advection' ? false : undefined)
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
  halfFovDeg: number,
  force?: Force<LandformParams['kind']>
): LandformParams | null {
  const rng = Random.derive(seed, 'landform')
  const chance: Record<Biome['name'], number> = { volcanic: 0.55, nordic: 0.4, mediterranean: 0.25, tropical: 0.2, desert: 0.2 }
  if (!forced(force, rng.chance(chance[biome.name]))) return null
  const volcanoChance: Record<Biome['name'], number> = { volcanic: 0.85, nordic: 0.15, mediterranean: 0.3, tropical: 0.45, desert: 0.1 }
  const drawnVolcano = rng.chance(volcanoChance[biome.name])
  const kind = forcedKind(force, drawnVolcano ? (rng.chance(0.75) ? 'strato' : 'shield') : 'range')
  const volcano = kind !== 'range'
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

/** How often each coast has islands in view, and which kinds (weights). */
const ISLANDS: Record<Biome['name'], { chance: number; kinds: readonly (readonly [IslandKind, number])[] }> = {
  nordic: { chance: 0.35, kinds: [['skerries', 4], ['rocky', 1], ['high', 1]] },
  mediterranean: { chance: 0.35, kinds: [['rocky', 1]] },
  tropical: { chance: 0.35, kinds: [['cay', 5], ['high', 2], ['karst', 2]] },
  volcanic: { chance: 0.3, kinds: [['high', 3], ['rocky', 1]] },
  desert: { chance: 0.15, kinds: [['rocky', 1]] }
}

/** Size and distance of one island of a kind (m). Low islands sink behind
 * the horizon a few kilometres out, so they're near; high ones far. */
function islandSize(rng: Random, kind: IslandKind): { distance: number; width: number; height: number } {
  switch (kind) {
    case 'skerries': {
      const width = rng.range(60, 500)
      return { distance: rng.range(700, 3500), width, height: Math.min(30, width * rng.range(0.04, 0.09)) }
    }
    case 'cay':
      return { distance: rng.range(900, 4000), width: rng.range(120, 600), height: rng.range(1.5, 3) }
    case 'karst': {
      // Towers taller than they're wide, or blocks a little wider.
      const width = rng.range(100, 450)
      return { distance: rng.range(1200, 7000), width, height: Math.min(260, width * rng.range(0.6, 1.4)) }
    }
    case 'rocky': {
      const width = rng.range(400, 4000)
      return { distance: rng.range(2500, 16_000), width, height: width * rng.range(0.07, 0.15) }
    }
    case 'high': {
      const width = rng.range(3000, 14_000)
      return { distance: rng.range(8000, 30_000), width, height: Math.min(1400, width * rng.range(0.08, 0.14)) }
    }
  }
}

function pickIslands(seed: string, biome: Biome, force?: Force<IslandKind>): IslandParams | null {
  const rng = Random.derive(seed, 'islands')
  const table = ISLANDS[biome.name]
  if (!forced(force, rng.chance(table.chance))) return null
  const kind = forcedKind(force, rng.weighted(table.kinds))
  // Skerries come in groups round a centre; karst towers in a scatter;
  // the big ones alone or in pairs.
  const count = kind === 'skerries' ? rng.int(3, 8) : kind === 'karst' ? rng.int(2, 6) : kind === 'cay' ? rng.int(1, 3) : rng.int(1, 2)
  const centre = rng.range(-0.7, 0.7)
  const spread = kind === 'skerries' || kind === 'karst' ? 0.35 : 0.8
  const near = rng.range(0.8, 1.2)
  const islands = Array.from({ length: count }, () => {
    const size = islandSize(rng, kind)
    return {
      offset: Math.max(-0.95, Math.min(0.95, centre + rng.normal(0, spread))),
      distance: kind === 'skerries' || kind === 'karst' ? size.distance * near : size.distance,
      width: size.width,
      height: size.height,
      seed: rng.int(0, 1_000_000)
    }
  })
  return { kind, islands }
}

/** How often each colony is on the mainland rather than an island. Most
 * seabirds nest on islands, out of reach of foxes and rats; a few big
 * gannetries and auk cliffs are on mainland headlands; penguin rookeries
 * fill the beaches of the sub-Antarctic islands' coasts. */
const MAINLAND_COLONY: Record<ColonyKind, number> = { gannet: 0.3, puffin: 0.35, tropical: 0.15, penguin: 0.6 }

function pickColony(
  seed: string,
  ocean: OceanName,
  biome: Biome,
  coastType: CoastParams['type'],
  force?: Force<ColonyKind>,
  forceSite?: ColonySite
): ColonyParams | null {
  const rng = Random.derive(seed, 'colony')
  // Its own stream, so the kinds drawn before this existed don't change.
  const mainland = Random.derive(seed, 'colony/site').float()
  if (!forced(force, rng.chance(0.15))) return null
  let kind: ColonyKind
  if (typeof force === 'string') kind = force
  else if (ocean === 'southern') kind = 'penguin'
  else if (biome.name === 'tropical' || biome.name === 'desert') kind = 'tropical'
  else {
    const northern = ocean === 'arctic' || biome.name === 'nordic' || biome.name === 'volcanic'
    kind = northern && rng.chance(0.5) ? 'puffin' : 'gannet'
  }
  // The open sea has no mainland in view.
  const site = coastType !== 'beach' ? 'island' : or<ColonySite>(mainland < MAINLAND_COLONY[kind] ? 'mainland' : 'island', forceSite)
  return { kind, site }
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

/** How often each kind hauls out on the beach rather than on rocks. */
const BEACH_HAUL_OUT: Record<PinnipedKind, number> = { seal: 0.35, 'sea-lion': 0.5, 'fur-seal': 0.4, 'elephant-seal': 0.85 }

function pickPinnipeds(
  seed: string,
  ocean: OceanName,
  biome: Biome,
  coastType: CoastParams['type'],
  force?: Force<PinnipedKind>,
  forceSite?: HaulOut
): PinnipedParams | null {
  const rng = Random.derive(seed, 'pinnipeds')
  const beach = Random.derive(seed, 'pinnipeds/site').float()
  const site = (kind: PinnipedKind): PinnipedParams => ({
    kind,
    site: coastType !== 'beach' ? 'rock' : or<HaulOut>(beach < BEACH_HAUL_OUT[kind] ? 'beach' : 'rock', forceSite)
  })
  if (typeof force === 'string') return site(force)
  const table = PINNIPEDS[biome.name][ocean]
  // Tropical sea lions are confined to one archipelago: rarer.
  const chance = biome.name === 'tropical' ? 0.06 : 0.2
  // Forced onto a coast that has none: harbour seals.
  if (table == null) return force === true ? site('seal') : null
  if (!forced(force, rng.chance(chance))) return null
  return site(rng.weighted(table))
}

/** How likely a lighthouse is on each coast. */
const LIGHTHOUSE_CHANCE: Record<Biome['name'], number> = { nordic: 0.16, mediterranean: 0.14, volcanic: 0.1, desert: 0.06, tropical: 0.06 }

function pickLighthouse(
  seed: string,
  biome: Biome,
  ocean: OceanName,
  coastType: CoastParams['type'],
  timeOfDay: TimeOfDay,
  fog: FogParams | null,
  force?: Force<LighthouseParams['site']>
): LighthouseParams | null {
  const rng = Random.derive(seed, 'lighthouse')
  // Polar seas: a handful of lights for thousands of kilometres of coast.
  const polar = ocean === 'arctic' || ocean === 'southern' ? 0.2 : 1
  if (!forced(force, rng.chance(LIGHTHOUSE_CHANCE[biome.name] * polar))) return null
  const site = forcedKind(force, coastType === 'beach' && rng.chance(0.6) ? 'point' : 'rock')
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
 * and never changes what's in it. A `spec` (sceneSpec.ts) forces parts of
 * the scene; the rest is the date's (`spec.date`, when given, replaces it).
 */
export function generateParams(date: string, attempt = 0, aspect = 16 / 9, spec: SceneSpec = {}): SceneParams {
  const day = spec.date ?? date
  const plain = Object.keys(spec).every(k => k === 'date' || k === 'name' || k === 'note')
  if (plain) return buildParams(day, attempt, aspect, {}, null).params
  // Forcing the time of day changes how many draws the sky makes from the
  // main stream, which would shift everything drawn after it (biome, lens,
  // wind…): pin those to the unforced day's.
  const pins = buildParams(day, attempt, aspect, { seed: spec.seed }, null).draws
  const { params } = buildParams(day, attempt, aspect, spec, pins)
  return spec.params == null ? params : deepPatch(params, spec.params)
}

type Draws = Record<string, unknown>

function buildParams(
  date: string,
  attempt: number,
  aspect: number,
  spec: SceneSpec,
  pins: Draws | null
): { params: SceneParams; draws: Draws } {
  // A tall frame is narrow: keep low suns and the moon well inside it.
  const framing = Math.min(1, aspect)
  const seed = spec.seed ?? `amazing-sea:${date}`
  const rng = new Random(seed)
  const draws: Draws = {}
  /** A main-stream draw that comes after the sky's variable number of
   * draws, recorded, or replaced by the pinned value. */
  const keep = <T>(name: string, drawn: T): T => {
    const value = pins != null && name in pins ? (pins[name] as T) : drawn
    draws[name] = value
    return value
  }

  // Real eclipses on their dates, and the sky's own choices (daytime moon,
  // moon up or down at night), on their own streams.
  const erng = Random.derive(seed, 'eclipse')
  const eclipse =
    spec.eclipse === undefined
      ? eclipseOn(date, () => erng.float())
      : spec.eclipse === null
        ? null
        : eclipseOfType(spec.eclipse, () => erng.float())
  const solarEclipse = eclipse != null && eclipse.type.startsWith('solar')
  const lunarEclipse = eclipse != null && eclipse.type.startsWith('lunar')
  const skyRng = Random.derive(seed, 'moon-sky')

  // Real moon phase for the date (noon UTC); new for a forced solar eclipse,
  // full for a lunar one.
  const moonPhaseDeg =
    spec.moonPhaseDeg ??
    (spec.eclipse != null ? (solarEclipse ? 0 : 180) : MoonPhase(new Date(`${date}T12:00:00Z`)))
  const elongation = moonPhaseDeg <= 180 ? moonPhaseDeg : 360 - moonPhaseDeg
  const moonIllumination = (1 - Math.cos(elongation * DEG)) / 2

  let timeOfDay = or(
    rng.weighted<TimeOfDay>([
      ['golden-hour', 30],
      ['sun-on-horizon', 12],
      ['blue-hour', 10],
      ['daylight', 23],
      ['midday', 15],
      ['night', 10]
    ]),
    spec.timeOfDay
  )
  // An eclipse day shows the eclipse: by day with the sun in the frame, or
  // at night with the moon in it.
  if (solarEclipse) timeOfDay = timeOfDay === 'golden-hour' ? 'golden-hour' : 'daylight'
  if (lunarEclipse) timeOfDay = 'night'
  const isEvening = or(rng.chance(0.5), spec.evening)
  // The weather has its own random stream, so drawing it here doesn't shift
  // any other parameter of the day.
  const weather = generateWeather(seed, timeOfDay, spec.weather)
  // Eclipse days get a sky to see them in; totality under a clear one.
  if (eclipse != null && spec.weather == null) {
    if (eclipse.type === 'solar-total') {
      weather.kind = 'clear'
      weather.coverage = 0
    } else if (solarEclipse && weather.kind !== 'clear' && weather.kind !== 'cirrus') {
      // Only thin cirrus: a cumulus in front of the sun would hide it.
      weather.kind = 'cirrus'
      weather.coverage = 0.5
    } else if (weather.kind === 'overcast' || weather.kind === 'broken') {
      weather.kind = 'few'
      weather.coverage = 0.3
    }
  }

  // Rainbows: a shower passing on a sunny, showery day while the sun is low
  // (the bow is a 42° circle around the point opposite the sun, so it's only
  // above the horizon when the sun is below 42°). On those days the camera
  // turns its back to the sun.
  const rainbowRng = Random.derive(seed, 'rainbow')
  const rainbowDay =
    spec.rainbow ??
    (eclipse == null &&
      (timeOfDay === 'golden-hour' || timeOfDay === 'daylight') &&
      (weather.kind === 'scattered' || weather.kind === 'broken') &&
      rainbowRng.chance(0.15))

  // Camera heading, then the sun relative to it. Low suns are usually framed
  // in or near the view for glitter paths; high suns can be anywhere.
  let headingDeg = rng.range(0, 360)
  const [elMin, elMax] = SUN_ELEVATION[timeOfDay]
  let sunElevationDeg = rng.range(elMin, elMax)
  const lowSun = timeOfDay !== 'midday' && timeOfDay !== 'daylight'
  const drawnSunAz = lowSun && rng.chance(0.7) ? rng.normal(0, 18 * framing) : rng.range(-180, 180)
  let relSunAz = rainbowDay ? 180 + rainbowRng.normal(0, 10 * framing) : drawnSunAz
  if (solarEclipse) {
    // In the frame, and not so high the lens can't reach it.
    relSunAz = erng.normal(0, 10 * framing)
    sunElevationDeg = timeOfDay === 'golden-hour' ? erng.range(3, 8) : erng.range(6, 12)
  }
  relSunAz = or(relSunAz, spec.sunAzimuthDeg)
  sunElevationDeg = or(sunElevationDeg, spec.sunElevationDeg)
  let sunDirection = dirFromAzEl(headingDeg + relSunAz, sunElevationDeg)

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
  // The sun and the moon by day: a moon well clear of the sun, in the frame
  // with the sea.
  const dayMoon =
    eclipse == null &&
    (timeOfDay === 'golden-hour' || timeOfDay === 'daylight' || timeOfDay === 'midday' || timeOfDay === 'sun-on-horizon') &&
    moonIllumination > 0.15 &&
    (spec.dayMoon ?? skyRng.chance(0.35))
  if (dayMoon) {
    const view = dirFromAzEl(headingDeg, 0)
    let bestScore = -Infinity
    for (let i = 0; i < 48; i++) {
      const candidate = offsetDirection(sunDirection, elongation * DEG, skyRng.range(0, 2 * Math.PI))
      const el = elevationOf(candidate)
      const facing = candidate[0] * view[0] + candidate[2] * view[2]
      // Low enough for most lenses to take it in above the horizon.
      const score = (el > 4 && el < 14 ? 1 : -1) + 2 * facing + skyRng.range(0, 0.3)
      if (score > bestScore) {
        bestScore = score
        moonDirection = candidate
      }
    }
  }
  if (solarEclipse) {
    // The new moon over the sun, offset by the eclipse's geometry.
    const sunRadius = SUN_ANGULAR_RADIUS * ECLIPSE_SCALE
    moonDirection = offsetDirection(sunDirection, eclipse!.offset * sunRadius, eclipse!.angle)
  }
  if (lunarEclipse) {
    // The full moon in the earth's shadow, low over the sea ahead.
    moonDirection = dirFromAzEl(headingDeg + erng.normal(0, 8 * framing), erng.range(5, 12))
    sunDirection = [-moonDirection[0], -moonDirection[1], -moonDirection[2]]
    sunElevationDeg = elevationOf(sunDirection)
  }
  // Some nights the moon hasn't risen yet, or has set.
  if (timeOfDay === 'night' && !lunarEclipse && (spec.nightSky === undefined ? skyRng.chance(0.2) : spec.nightSky === 'starlit')) {
    moonDirection = [moonDirection[0], -Math.abs(moonDirection[1]) - 0.1, moonDirection[2]]
    moonDirection = normalize(moonDirection)
  }
  // A moonlit night forced: make sure the moon is up.
  if (spec.nightSky === 'moonlit' && elevationOf(moonDirection) <= 2) {
    moonDirection = dirFromAzEl(Math.atan2(moonDirection[0], -moonDirection[2]) / DEG, 8)
  }
  const moonElevationDeg = elevationOf(moonDirection)
  // At night the moon lights the scene if it's up; otherwise only the stars.
  const nightSky =
    timeOfDay !== 'night' ? null : lunarEclipse || (moonElevationDeg > 2 && moonIllumination > 0.03) ? 'moonlit' : 'starlit'
  let moonlight = nightSky === 'moonlit' ? phaseLight(elongation) : 0
  if (lunarEclipse) moonlight *= eclipse!.type === 'lunar-total' ? 0.0015 : 1 - 0.95 * eclipse!.obscuration

  const heightM = keep(
    'heightM',
    rng.weighted<() => number>([
      [() => rng.range(1.2, 4), 4],
      [() => rng.range(6, 25), 4],
      [() => rng.range(40, 160), 2]
    ])()
  )
  const drawnFocalLength = keep(
    'focalLength',
    rng.weighted<() => number>([
      [() => rng.range(18, 28), 3],
      [() => rng.range(28, 50), 4],
      [() => rng.range(50, 90), 2]
    ])()
  )
  // A rainbow spans 84°: go wide to get most of the arc in.
  // An eclipse needs a lens long enough to show it and wide enough to keep
  // it in the frame with the sea.
  const focalLengthMm = or(
    eclipse != null ? erng.range(24, 35) : rainbowDay ? Math.min(drawnFocalLength, rainbowRng.range(14, 22)) : drawnFocalLength,
    spec.camera?.focalLengthMm
  )

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
    keep(
      'wind',
      rng.weighted<() => number>([
        [() => rng.range(1.5, 4), 3],
        [() => rng.range(4, 8), 4],
        [() => rng.range(8, 14), 2]
      ])()
    ) * windByWeather[weather.kind]
  const windHeadingDeg = keep('windHeading', rng.range(0, 360))

  const storm =
    eclipse != null && spec.storm === undefined
      ? null
      : generateStorm(seed, timeOfDay, headingDeg, horizontalHalfFovDeg(focalLengthMm, aspect), spec.storm)
  if (storm != null) {
    const srng = Random.derive(seed, 'storm-weather')
    weather.kind = 'storm'
    weather.coverage = srng.range(0.55, 0.68)
    const altostratus = srng.chance(0.6)
    // Gale-force gusts under the cells; the spectrum turns them into a high,
    // breaking sea.
    windSpeed = srng.range(14, 22)
    const bright = srng.chance(0.4)
    weather.sunVisibility = bright ? srng.range(0.15, 0.4) : srng.range(0, 0.05)
    weather.formations = stormFormations(seed, altostratus, !bright)
  }

  let biome = keep('biome', rng.weighted(BIOMES))
  if (spec.biome != null) biome = BIOMES.find(([b]) => b.name === spec.biome)![0]
  const waterRng = Random.derive(seed, 'water')
  const orng = Random.derive(seed, 'ocean')
  const choice = pickOcean(orng, biome, Number(date.slice(5, 7)), spec.ocean)
  const { basin } = choice
  const monsoon = or(choice.monsoon, spec.monsoon)
  const ice = spec.ice === undefined ? choice.ice : forceIce(seed, spec.ice, basin.name, choice.ice)
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
  windSpeed = or(Math.min(24, windSpeed * basin.wind * (monsoon ? 1.35 : 1)), spec.wind)
  addFormations(
    seed,
    weather,
    biome,
    {
      month: Number(date.slice(5, 7)),
      southern: basin.name === 'southern',
      windSpeed,
      morning: !isEvening && (timeOfDay === 'golden-hour' || timeOfDay === 'daylight' || timeOfDay === 'sun-on-horizon')
    },
    spec.clouds
  )
  weather.arrangement = pickArrangement(seed, weather, biome.name === 'tropical', windSpeed, windHeadingDeg, spec.cloudArrangement)
  const fog =
    (rainbowDay || eclipse != null) && spec.fog === undefined
      ? null
      : pickFog(seed, biome, basin.name, Number(date.slice(5, 7)), timeOfDay, weather, windSpeed, spec.fog)
  if (fog != null) {
    // Fog comes with light airs: the sea calms under it.
    if (spec.wind == null) windSpeed = Math.min(windSpeed, fog.kind === 'sea-smoke' ? 3 : 6)
    // Inside the fog the sun is dimmed by the layer between it and us.
    if (fog.start === 0) {
      const sinEl = Math.max(0.05, Math.sin(sunElevationDeg * DEG))
      weather.sunVisibility *= Math.exp(-((3.912 / fog.visibility) * fog.height) / sinEl)
    }
  }
  const oceanSwell = swell(seed, windHeadingDeg)
  oceanSwell.swellHeight *= basin.swellHeight * (monsoon ? 1.5 : 1) * iceCalm * iceCalm
  oceanSwell.swellWavelength = Math.min(320, oceanSwell.swellWavelength * basin.swellWavelength)
  const oceanState = { windSpeed: spec.wind ?? windSpeed * iceCalm, windHeadingDeg, ...oceanSwell }
  const { coast, eyeHeight } = generateCoast(seed, attempt, headingDeg, biome, oceanState, spec)

  const timeLabel: Record<TimeOfDay, string> = {
    'golden-hour': isEvening ? 'Golden hour' : 'Morning gold',
    'sun-on-horizon': isEvening ? 'Sunset' : 'Sunrise',
    'blue-hour': isEvening ? 'Dusk' : 'Dawn',
    daylight: isEvening ? 'Afternoon' : 'Morning',
    midday: 'Midday',
    night: nightSky === 'starlit' ? 'Starry night' : 'Moonlit night'
  }
  const colony = pickColony(seed, basin.name, biome, coast.type, spec.colony, spec.colonySite)
  const pinnipeds = pickPinnipeds(seed, basin.name, biome, coast.type, spec.pinnipeds, spec.haulOut)
  const lighthouse = pickLighthouse(seed, biome, basin.name, coast.type, timeOfDay, fog, spec.lighthouse)
  const landform = pickLandform(seed, biome, basin.name, timeOfDay, headingDeg, horizontalHalfFovDeg(focalLengthMm, aspect), spec.landform)
  const islands = pickIslands(seed, biome, spec.islands)
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
  if (islands != null) {
    const names: Record<IslandKind, string> = { skerries: 'skerries', rocky: 'islands', cay: 'palm islets', karst: 'karst islands', high: 'islands' }
    titleParts.push(islands.islands.length === 1 && islands.kind !== 'skerries' ? names[islands.kind].replace(/s$/, '') : names[islands.kind])
  }
  if (rainbow != null) titleParts.push('rainbow')
  if (colony != null) titleParts.push(colony.kind === 'penguin' ? 'penguin colony' : colony.site === 'island' ? 'seabird island' : 'seabird cliffs')
  if (pinnipeds != null) {
    const names: Record<PinnipedKind, string> = {
      seal: 'seals',
      'sea-lion': 'sea lions',
      'fur-seal': 'fur seals',
      'elephant-seal': 'elephant seals'
    }
    titleParts.push(names[pinnipeds.kind])
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
  if (eclipse != null) {
    const names: Record<EclipseParams['type'], string> = {
      'solar-partial': 'partial solar eclipse',
      'solar-annular': 'annular solar eclipse',
      'solar-total': 'total solar eclipse',
      'lunar-partial': 'partial lunar eclipse',
      'lunar-total': 'total lunar eclipse'
    }
    titleParts.push(names[eclipse.type])
  } else if (moonElevationDeg > 1 && moonIllumination > 0.05) {
    titleParts.push(moonPhaseName(moonPhaseDeg))
  }

  let moonScale = keep('moonScale', rng.range(1.2, 2.4))
  const sunScale = solarEclipse ? ECLIPSE_SCALE : 1
  if (solarEclipse) moonScale = (SUN_ANGULAR_RADIUS * ECLIPSE_SCALE * eclipse!.ratio) / MOON_ANGULAR_RADIUS
  rng.float() // was the latitude draw; keeps the rest of the main stream in place
  const [latMin, latMax] = biome.name === 'tropical' ? [5, 23] : basin.latitude
  const latitudeDeg = orng.range(latMin, latMax)

  const params: SceneParams = {
    date,
    seed,
    title: titleParts.join(' · '),
    timeOfDay,
    evening: isEvening,
    sunDirection,
    sunElevationDeg,
    moonDirection,
    moonElevationDeg,
    moonPhaseDeg,
    moonIllumination,
    moonScale,
    sunScale,
    nightSky,
    moonlight,
    eclipse,
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
    islands,
    fog,
    contrails: [],
    lighthouse,
    ...(spec.props != null ? { overrides: spec.props } : {}),
    camera: {
      heightM: spec.camera?.heightM ?? eyeHeight ?? heightM,
      headingDeg,
      horizonFraction: or(
        ((drawn: number) => (eclipse != null ? erng.range(0.56, 0.66) : drawn))(
          keep(
            'horizon',
            rng.weighted<() => number>([
              [() => rng.range(0.55, 0.68), 3], // more sky
              [() => rng.range(0.32, 0.45), 2], // more sea
              [() => rng.range(0.45, 0.55), 1]
            ])()
          )
        ),
        spec.camera?.horizonFraction
      ),
      rollDeg: or(keep('roll', rng.normal(0, 0.3)), spec.camera?.rollDeg),
      focalLengthMm,
      aspect
    },
    ocean: {
      ...oceanState,
      time: keep('time', rng.range(0, 10_000)),
      choppiness: keep('choppiness', rng.range(0.6, 1.0)),
      water,
      waveSeed: `${seed}/waves`
    }
  }
  params.contrails = contrailsFor(params, Random.derive(seed, 'contrails'), spec.contrails)
  return { params, draws }
}

/** Ice forced by a scene spec: pack ice (with or without bergs) or bergs
 * alone, tabular in the south and glacier bergs in the north. */
function forceIce(seed: string, force: Force<'pack' | 'bergs'>, ocean: OceanName, drawn: IceParams | null): IceParams | null {
  if (force === null || force === false) return null
  const rng = Random.derive(seed, 'spec/ice')
  const bergKind = ocean === 'southern' ? 'tabular' : 'glacier'
  if (force === 'bergs') return { packIce: 0, bergs: rng.int(1, 3), bergKind }
  if (drawn != null && (force === true || drawn.packIce > 0)) return drawn
  return { packIce: rng.range(0.25, 0.75), bergs: rng.chance(0.6) ? rng.int(1, 3) : 0, bergKind }
}
