import { MoonPhase } from 'astronomy-engine'

import { eclipseOfType, eclipseOn, moonlight as phaseLight, REAL_SUN_LATITUDE, sunAzimuthDeg, sunLimits, type EclipseParams, type SunLimits } from './celestial'

import { beachName, isStony, materialChances, STONE_SIZES, STONY_RUNUP, stonyShape, type BeachMaterial, type Ridge } from './beach'
import { beachShape, beachStateFor, breakerHeight, grainIn, sedimentFor, wavePeriod, type Bar, type BeachState, type Cusps, type Rips } from './beachState'
import { SAND_STYLES, biomeNamed, type Biome, type RGB, type SandStyle, type WaterStyle } from './biome'
import type { CloudArrangement } from './cloudArrangement'
import { hasBeach, hasLand } from './coastKind'
import type { DebugParams } from './debug'
import { contrailsFor, type Contrail } from './contrails'
import { visibilityFor } from './seaHaze'
import { lenticularFor, rollCloudFor, shelfCloudFor, type LenticularParams, type RollCloudParams, type ShelfCloudParams } from './skyEvents'
import { nacreousFor, noctilucentFor, type NacreousParams, type NoctilucentParams } from './noctilucent'
import { nightGlowFor, type NightGlowParams } from './nightGlow'
import { meteorsFor, SHOWERS, type Meteor } from './meteors'
import { inSky } from './skyFrame'
import { planetsFor, planetsIn, type Planet } from './planets'
import { auroraFor, type AuroraParams } from './aurora'
import { waterspoutFor, type WaterspoutParams } from './props/waterspout'
import { CLOUD_GENERA, pickFormations, pickSpecies, type CloudGenus } from './cloudTypes'
import { dustFor, marineLayerFor, type DustKind } from './coastalWeather'
import { pickOcean, type IceParams, type OceanName } from './oceans'
import { choose, climateTitle, latitudeIn, pickPlace, placeBiome, plantsFor, sandChances, type Climate, type Place } from './places'
import { Random } from './random'
import { apply, ECLIPTIC_POLE, eclipticOffset, skyRotation } from './skyClock'
import { haulOutSeason } from './animalSeasons'
import { seasonalSnowLine } from './phenology'
import { ICE_RUNUP, ICE_WAVE_WIND, pickSeaIce, type SeaIceParams } from './seaIce'
import { pickSnow, type SnowParams } from './snow'
import { monthInSeason, season, seasonMonth } from './seasons'
import { reefFor, reefShelter, type Reef } from './reef'
import { flatGround, flatWaterline, tidalFlatFor, type SaltMarsh, type TidalFlat } from './tidalFlat'
import { ROCK_NAMES, rockGround, rockShoreFor, rockWaterline, wobbleAtCamera, type RockShore } from './rockShore'
import type { Shelter } from './shelter'
import { MICRO_TIDE, relativeTideRange, terraceFor, tideFor, tideModified, waterlineAt, type Terrace, type Tide } from './tides'
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
  /** Ask hasLand / hasBeach / hasSurfZone (coastKind.ts), not the type. */
  type: 'open-sea' | 'beach' | 'rock-shore' | 'tidal-flat'
  /** shoreline: at the water looking out; along-beach: the beach recedes into
   * the distance; framed: just inside the tree line looking out past plants;
   * overlook: high on the hillside above the bay. */
  composition: Composition
  /** Azimuth pointing from land out to sea, perpendicular to the shore. */
  seawardAzimuthDeg: number
  /** Horizontal distance from the camera to the land frame's s = 0 (m): the
   * foot of the high-tide beach (mean sea on micro-tidal beaches). The water
   * is `waterline` further on. */
  distanceToWater: number
  /** Where the water is today, seaward of s = 0 (m; negative: up the beach),
   * on the bare profile (tides.ts waterlineAt). */
  waterline: number
  /** The day's tide (tides.ts); the land sits `tide.level` lower. */
  tide: Tide
  /** Low-tide terrace below the high-tide beach (zero on micro-tidal beaches). */
  terrace: Terrace
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
  /** Wright & Short beach state, from the waves and the grain (beachState.ts). */
  state: BeachState
  /** Median sand grain (mm); on a mixed beach the sand's. */
  grainMm: number
  /** Submerged bars, inner first (0–3). */
  bars: Bar[]
  /** Rip channels through the inner bar, or null. */
  rips: Rips | null
  /** Beach cusps on the upper swash zone, or null. */
  cusps: Cusps | null
  /** Height wave run-up reaches on the beach (m); the wet-sand band. */
  runup: number
  surfAmplitude: number
  surfWavelength: number
  surfPhase: number
  sand: SandStyle
  /** What the beach is made of (beach.ts); 'sand' on the open sea. */
  material: BeachMaterial
  /** The place's stone colours (linear albedo), for stony beaches. */
  stoneColors: readonly RGB[]
  /** Storm ridges on stony beaches; empty on sand. */
  ridges: Ridge[]
  /** Median stone size (m) on stony beaches (beach.ts STONE_SIZES); 0 on sand. */
  stoneSize: number
  /** Calm water behind a reef or barrier, or in a lagoon (shelter.ts); null: none. */
  shelter: Shelter | null
  /** A fringing reef offshore (reef.ts); null: none. */
  reef: Reef | null
  /** The rocky shore's shape on rock-shore days (rockShore.ts); null otherwise. */
  rock: RockShore | null
  /** The tidal flat on tidal-flat days (tidalFlat.ts); null otherwise. */
  flat: TidalFlat | null
  /** A salt marsh behind a tidal flat or a beach (tidalFlat.ts); null: none. */
  marsh: SaltMarsh | null
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
  /** Height above which snow lies on this day (m; phenology.ts
   * `seasonalSnowLine`); Infinity for none. */
  snowLine: number
  plume: 'steam' | 'ash' | null
  /** Lava glowing at the crater and down the flank (dusk and dark only). */
  lava: boolean
  /** A white cumulus cap on the eruption plume (flammagenitus). */
  pyrocumulus: boolean
  /** Lens clouds standing over it in a strong wind (skyEvents.ts). */
  lenticular: LenticularParams | null
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
  /** The shelf cloud at the storm's leading edge (skyEvents.ts). */
  shelf: ShelfCloudParams | null
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
  /** Height of the layer (m): advection fog is dense up to about here and
   * clear within a few metres above (an inversion lid); sea smoke thins out
   * exponentially with this scale height (fogLayer.ts). */
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
  /** The character's period (s): one group to the next. */
  periodS: number
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
  /** A marine-layer morning: a low stratus or stratocumulus deck
   * (coastalWeather.ts). */
  marineLayer: boolean
  /** Desert dust in the air (harmattan): a short, ochre haze and a dim,
   * reddened sun (seaHaze.ts). */
  dust: DustKind | null
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

  /** Geodetic latitude, signed (south negative), drawn within the place's
   * range; anchors the atmosphere model (degrees). */
  latitudeDeg: number

  /** The stretch of coast this is (places.ts), drawn first. */
  place: {
    id: string
    region: string
    climate: Climate
    hemisphere: 'north' | 'south'
  }
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
  /** A waterspout under the cumulus line (props/waterspout.ts). */
  waterspout: WaterspoutParams | null
  /** Noctilucent clouds at twilight (noctilucent.ts). */
  noctilucent: NoctilucentParams | null
  /** Nacreous (mother-of-pearl) clouds in polar winter twilight. */
  nacreous: NacreousParams | null
  /** The night sky's own light: Milky Way, airglow, zodiacal light, light
   * pollution (nightGlow.ts); null with the sun up. */
  nightGlow: NightGlowParams | null
  /** Shooting stars in the session's best frame (meteors.ts). */
  meteors: Meteor[]
  /** The planets with the sun down (planets.ts). */
  planets: Planet[]
  /** Northern or southern lights tonight (aurora.ts). */
  aurora: AuroraParams | null
  /** How far one sees through the sea haze (km; seaHaze.ts). Fog is separate. */
  visibilityKm: number
  /** Aircraft trails high in the sky (contrails.ts). */
  contrails: Contrail[]
  /** The Morning Glory roll cloud (skyEvents.ts). */
  rollCloud: RollCloudParams | null
  /** A lighthouse on a point or a rock (props/lighthouse.ts, lighthouse.ts). */
  lighthouse: LighthouseParams | null
  /** Lying snow and the ice foot today (snow.ts); null: none. */
  snow: SnowParams | null
  /** The sea frozen today (seaIce.ts); null: open. */
  seaIce: SeaIceParams | null
  /** What a scene spec forces the props to show (sceneSpec.ts); absent on
   * ordinary days. */
  overrides?: PropOverrides
  /** Render-only switches and views for debugging, set by a spec's `params`
   * patch (`{"params": {"debug": {…}}}`); the generator never reads them, so
   * no draw changes (knowledge/tools/DEBUG.md). */
  debug?: DebugParams

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
    /** Ground height under the camera (m above the sea); from the terrain
     * when absent. diff.mjs --keep-camera pins it, so a terrain change
     * doesn't move the camera between the two renders. */
    groundM?: number
  }

  ocean: {
    /** The wind the waves feel (m/s): pack and sea ice calm it. */
    windSpeed: number
    /** The wind in the air (m/s): clouds, plants, what the ice doesn't touch. */
    airWindSpeed: number
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

const TIME_WEIGHTS: readonly (readonly [TimeOfDay, number])[] = [
  ['golden-hour', 30],
  ['sun-on-horizon', 12],
  ['blue-hour', 10],
  ['daylight', 23],
  ['midday', 15],
  ['night', 10]
]

/** The part of a time of day's elevation range the day's sun reaches, or
 * null when it never gets there (by less than 0.2°). */
function reachable(timeOfDay: TimeOfDay, sun: SunLimits): [number, number] | null {
  const [lo, hi] = SUN_ELEVATION[timeOfDay]
  const from = Math.max(lo, sun.min)
  const to = Math.min(hi, sun.max)
  return to - from >= 0.2 ? [from, to] : null
}

/** Time-of-day weights: the categories the real sun allows (impossible ones
 * get 0, the rest keep their weights), or all of them below 63° or if none
 * fits. One draw either way. */
export function timeWeights(sun: SunLimits | null): (readonly [TimeOfDay, number])[] {
  if (sun == null) return [...TIME_WEIGHTS]
  const weights = TIME_WEIGHTS.map(([t, w]) => [t, reachable(t, sun) == null ? 0 : w] as const)
  return weights.some(([, w]) => w > 0) ? weights : [...TIME_WEIGHTS]
}

/** The elevation range to draw the sun in: the category's, cut to what the
 * day's sun reaches (a forced impossible category keeps its own). */
export function sunRange(timeOfDay: TimeOfDay, sun: SunLimits | null): [number, number] {
  return (sun == null ? null : reachable(timeOfDay, sun)) ?? SUN_ELEVATION[timeOfDay]
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

/** Swell by climate (PLAN_BIOMES 11c): wave heights rise from the doldrums
 * to the westerlies (SEASAT and GEOSAT altimetry), so temperate and boreal
 * coasts, in the storm belts, see a big (1–2 m) swell twice as often. */
const BIG_SWELL: Partial<Record<Climate, number>> = { temperate: 2, boreal: 2 }

function swell(
  seed: string,
  windHeadingDeg: number,
  climate: Climate
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
      [() => rng.range(1.0, 2.0), BIG_SWELL[climate] ?? 1]
    ])()
  }
}

/** The day's sand colour: the place's chances on its own stream, or the
 * forced one. The coast stream still makes the one draw the colour used to
 * take, so the draws after it (sandbars, eye height) stay where they were. */
function sandColour(coastRng: Random, seed: string, place: Place, climate: Climate, force?: SandStyle['name']): SandStyle {
  coastRng.float()
  return SAND_STYLES[choose(Random.derive(seed, 'sand-colour'), sandChances(place, climate), force)]
}

/** Makes a draw and drops it, so a stream's later draws stay where they
 * were when a field stops using it. */
function skipDraw(rng: Random): 0 {
  rng.float()
  return 0
}

function generateCoast(
  seed: string,
  attempt: number,
  headingDeg: number,
  place: Place,
  climate: Climate,
  ocean: Pick<SceneParams['ocean'], 'swellHeight' | 'swellWavelength' | 'windSpeed'>,
  /** Storm days and mid-latitude winters move the beach a state toward
   * dissipative (the winter profile). */
  beachWeather: { rough: boolean; frozen?: boolean },
  tide: Tide,
  spec: SceneSpec
): { coast: CoastParams; eyeHeight: number | null } {
  // Retries (see composition.ts) re-roll only the coast and composition.
  const suffix = attempt > 0 ? `#${attempt}` : ''
  const rng = Random.derive(seed, `coast${suffix}`)
  // Land or open sea is decided once per date; retries keep it. On land the
  // place's weights choose a beach or a rocky shore (own stream).
  const landKind = choose(Random.derive(seed, 'coast-kind'), place.coast)
  const drawnType = Random.derive(seed, 'coast').chance(0.65) ? landKind : 'open-sea'
  // A tidal flat shows only below mid tide; at or above mid the sea covers
  // it up to the marsh, and the day is a beach with a salt marsh behind.
  const flooded = drawnType === 'tidal-flat' && tide.level >= 0
  const type = or(
    flooded ? 'beach' : drawnType,
    spec.coast ??
      (spec.rockShore != null
        ? 'rock-shore'
        : spec.composition != null || isStony(spec.beachMaterial) || spec.reef === true || spec.beachrock === true || spec.saltMarsh === true
          ? 'beach'
          : undefined)
  )
  const saltMarsh = type === 'beach' && forced(spec.saltMarsh, landKind === 'tidal-flat' && tide.level >= 0)
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
    waterline: 0,
    tide,
    terrace: terraceFor(tide.springRange),
    curvature: rng.chance(0.5) ? rng.range(0.0002, 0.0012) : rng.range(-0.0002, 0.0003),
    wobble: rng.range(3, 25),
    beachSlope: rng.range(0.035, 0.11),
    nearshoreSlope: rng.range(0.012, 0.035),
    seabedDepth: rng.range(15, 45),
    beachWidth: rng.range(25, 80),
    duneHeight: rng.range(1.5, 9),
    duneWidth: rng.range(15, 50),
    hillHeight: 0,
    state: 'reflective',
    // The old sandbar distance's draw (see below).
    grainMm: skipDraw(rng),
    bars: [],
    rips: null,
    cusps: null,
    // No waves to run up a frozen shore; the draw stays.
    runup: Math.min(0.25 + surfAmplitude * rng.range(0.4, 0.8), beachWeather.frozen ? ICE_RUNUP : Infinity),
    surfAmplitude,
    surfWavelength: rng.range(18, 40),
    surfPhase: rng.range(0, Math.PI * 2),
    sand: sandColour(rng, seed, place, climate, spec.sand),
    material: 'sand',
    stoneColors: place.stones,
    ridges: [],
    stoneSize: 0,
    shelter: null,
    reef: null,
    rock: null,
    flat: null,
    marsh: null,
    noiseOffset: [rng.range(-5000, 5000), rng.range(-5000, 5000)]
  }

  // The beach state sets the slopes, width and bars now (below), but the
  // coast stream still makes the draws they used to take, so the draws
  // after them (surf, noise, eye height) stay where they were.
  if (rng.chance(0.6)) rng.float()

  // Beach material, grain and state, once per date on their own stream
  // (retries keep them): the waves and the grain set the slopes, bars and
  // cusps; a stony beach is steep, narrow and ridged.
  const mrng = Random.derive(seed, 'beach-material')
  const drawnMaterial = or(choose(mrng, materialChances(place, climate)), spec.beachMaterial)
  const material = hasBeach({ type }) ? drawnMaterial : 'sand'
  const sediment = sedimentFor(coast.sand.name, place.biome)
  const grainMm = grainIn(sediment, mrng.float())
  const stoneU = mrng.float()
  const stoneSize = isStony(material) ? STONE_SIZES[material][0] + stoneU * (STONE_SIZES[material][1] - STONE_SIZES[material][0]) : 0
  const period = wavePeriod(ocean.swellWavelength)
  // A fringing reef offshore (own stream): the beach behind it is shaped by
  // the waves that cross the reef, 10–30% of the offshore ones.
  const reef = reefFor(place.reef, hasBeach({ type }), tide.springRange, Random.derive(seed, 'reef'), spec)
  const crossing = reef != null ? 1 - reef.strength : 1
  // A big tide for the waves modifies the state (Masselink & Short 1993);
  // micro-tidal beaches stay wave-dominated (their RTR from a calm day's
  // waves would be large, but the census classes by modal waves).
  const breaker = breakerHeight(ocean.swellHeight * crossing, period)
  const waveState = beachStateFor(material, grainMm, breaker, period, sediment, beachWeather.rough ? 1 : 0)
  const state = or(
    tide.springRange < MICRO_TIDE ? waveState : tideModified(waveState, material, relativeTideRange(tide.springRange, breaker)),
    spec.beachState
  )
  const depthAt = (d: number, slope: number): number => coast.seabedDepth * (1 - Math.exp((-d * slope) / coast.seabedDepth))
  const shape = beachShape(state, material, material === 'shingle' || material === 'cobble' ? stoneSize : grainMm, period, depthAt, mrng)
  Object.assign(coast, shape, { state, grainMm })
  if (reef != null) {
    // A lagoon: no bars or rips; calm water and a lower run-up behind the reef.
    Object.assign(coast, { reef, bars: [], rips: null, shelter: reefShelter(reef, coast.terrace.width) })
    coast.runup = 0.25 + (coast.runup - 0.25) * crossing
  }
  if (isStony(material)) {
    if (material !== 'mixed') coast.runup *= STONY_RUNUP
    Object.assign(coast, { material, stoneSize }, stonyShape(coast, material, mrng))
  }
  // A salt marsh behind the beach (own stream, once per date): no dunes, a
  // narrow strip of sand, then the marsh where the dunes were; hills and
  // plants start behind it.
  if (saltMarsh) {
    const srng = Random.derive(seed, 'salt-marsh')
    const width = srng.range(80, 400)
    coast.beachWidth = Math.min(coast.beachWidth, srng.range(10, 30))
    coast.duneHeight = 0
    coast.duneWidth = width
    const land = tide.springRange / 2 + 0.4
    coast.marsh = { start: coast.beachWidth, width, height: land, back: land }
    // The flooded flats in front take most of the swell: wind chop and a
    // small run-up.
    coast.surfAmplitude *= 0.35
    coast.runup = 0.15 + Math.max(0, coast.runup - 0.25) * 0.35
  }
  // A rocky shore (own stream, once per date): no beach, so none of its
  // terrace, bars, rips, cusps, ridges or reef; plants start on top of the
  // back face.
  if (type === 'rock-shore') {
    const rrng = Random.derive(seed, 'rock-shore')
    const rock = rockShoreFor(tide.springRange, biomeNamed(place.biome).rockColors, rrng, { kind: spec.rockShore, overlook: spec.composition == null ? undefined : spec.composition === 'overlook' })
    Object.assign(coast, {
      rock,
      nearshoreSlope: rrng.range(0.03, 0.06),
      terrace: { height: 0, width: 0 },
      bars: [],
      rips: null,
      cusps: null,
      ridges: [],
      reef: null,
      shelter: null,
      beachWidth: rock.backWidth + 4,
      duneHeight: 0
    })
  }
  // A tidal flat (own stream, once per date): km of sand and mud to a far
  // line of sea, a salt marsh behind; the swell dies over the shallows, so
  // no beach state, bars or surf, and a small run-up.
  if (type === 'tidal-flat') {
    const frng = Random.derive(seed, 'tidal-flat')
    const { flat, marsh, nearshoreSlope } = tidalFlatFor(tide.springRange, place.mud, frng)
    Object.assign(coast, {
      flat,
      marsh,
      nearshoreSlope,
      terrace: { height: 0, width: 0 },
      bars: [],
      rips: null,
      cusps: null,
      ridges: [],
      reef: null,
      shelter: null,
      runup: Math.min(0.08 + 0.12 * frng.float(), beachWeather.frozen ? ICE_RUNUP : Infinity),
      beachWidth: marsh.width + 5,
      duneHeight: 0
    })
  }
  // The camera stands by today's water (shoreline, along the beach) or on
  // the land (framed, overlook): the drawn distances are from the water.
  if (hasLand({ type })) {
    coast.waterline =
      coast.rock != null
        ? rockWaterline(coast.rock, coast.nearshoreSlope, coast.seabedDepth, tide.level)
        : coast.flat != null
          ? flatWaterline(coast.flat, coast.marsh!, coast.nearshoreSlope, coast.seabedDepth, tide.level)
          : waterlineAt(coast, tide.level)
    coast.distanceToWater -= coast.waterline
  }

  let eyeHeight =
    hasLand({ type })
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
  if (coast.rock != null) {
    eyeHeight = rockCamera(coast, coast.rock, headingDeg, eyeHeight!, Random.derive(seed, `rock-camera${suffix}`), spec.composition)
  } else if (coast.flat != null) {
    eyeHeight = flatCamera(coast, headingDeg, Random.derive(seed, `flat-camera${suffix}`), spec.composition)
  } else if (hasLand({ type })) {
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
        coast.distanceToWater = crng.range(8, coast.beachWidth * 0.8) - coast.waterline
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

/** Where the camera stands on a rocky shore, and its eye height: on the
 * platform or boulders by today's water (shoreline, along the shore), on top
 * of the low back cliff among the plants (framed), or on the cliff top
 * (overlook, every cliff day). Never on the back face itself. */
function rockCamera(coast: CoastParams, rock: RockShore, headingDeg: number, eyeHeight: number, rng: Random, force?: Composition): number {
  const drawn = rng.weighted<Composition>([
    ['shoreline', 3],
    ['along-beach', 3],
    ['framed', 2]
  ])
  const side = rng.chance(0.5) ? 1 : -1
  const angle = rng.float()
  const near = rng.float()
  const eye = rng.range(1.5, 2.1)
  coast.composition = rock.kind === 'cliff' ? 'overlook' : force != null && force !== 'overlook' ? force : drawn
  switch (coast.composition) {
    case 'along-beach':
      coast.seawardAzimuthDeg = headingDeg - side * (62 + 22 * angle)
      coast.distanceToWater = 6 + 24 * near - coast.waterline
      eyeHeight = eye
      break
    case 'framed':
      coast.seawardAzimuthDeg = headingDeg - side * (10 + 35 * angle)
      coast.distanceToWater = rock.backWidth + 3 + 12 * near
      eyeHeight = eye
      break
    case 'overlook':
      // Near the edge, to see down the cliff; the plants start behind.
      coast.seawardAzimuthDeg = headingDeg - side * (15 + 40 * angle)
      coast.distanceToWater = rock.backWidth + 2 + 8 * near
      coast.beachWidth = coast.distanceToWater + 2
      eyeHeight = eye
      break
    case 'shoreline':
      break
  }
  // The distances above are in s; the wobble moves the shore at a = 0.
  const wobble = wobbleAtCamera(coast)
  coast.distanceToWater -= wobble
  // Off the back face: onto its top.
  const offFace = (): void => {
    const u = coast.distanceToWater + wobble
    if (u > -1 && u < rock.backWidth + 2) coast.distanceToWater = rock.backWidth + 2 - wobble
  }
  offFace()
  // Out of the gullies and the swash: step inland until dry.
  for (let i = 0; i < 60 && rockGround(coast) < coast.runup + 0.3; i++) {
    coast.distanceToWater += 3
    offFace()
  }
  return eyeHeight
}

/** Where the camera stands on a tidal flat: out on the flat looking to sea
 * (shoreline), on the marsh edge looking along it (along-beach), or in the
 * marsh behind it (framed; an overlook stands there too, there is no high
 * ground). Always above today's water. */
function flatCamera(coast: CoastParams, headingDeg: number, rng: Random, force?: Composition): number {
  const drawn = rng.weighted<Composition>([
    ['shoreline', 4],
    ['along-beach', 3],
    ['framed', 3]
  ])
  const side = rng.chance(0.5) ? 1 : -1
  const angle = rng.float()
  const near = rng.float()
  const eye = rng.range(1.5, 2.1)
  coast.composition = force === 'overlook' ? 'framed' : (force ?? drawn)
  switch (coast.composition) {
    case 'shoreline':
      // Out on the flat, but well short of today's water.
      coast.distanceToWater = -Math.min(15 + 135 * near, Math.max(0, coast.waterline - 40))
      break
    case 'along-beach':
      coast.seawardAzimuthDeg = headingDeg - side * (62 + 22 * angle)
      coast.distanceToWater = 2 + 6 * near
      break
    case 'framed':
      coast.seawardAzimuthDeg = headingDeg - side * (10 + 35 * angle)
      // Deep enough in the marsh that the lens (ground from ~5–15 m) sees it.
      coast.distanceToWater = Math.min(15 + 45 * near, Math.max(10, coast.marsh!.width - 10))
      break
  }
  // The distances above are in s; the wobble moves the shore at a = 0.
  const wobble = wobbleAtCamera(coast)
  coast.distanceToWater -= wobble
  // Out of the creeks and the water: step inland until dry.
  for (let i = 0; i < 80 && flatGround(coast, wobble) < coast.runup + 0.15; i++) coast.distanceToWater += 3
  return eye
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
    marineLayer: false,
    dust: null,
    weatherOffset: [rng.range(0, 1), rng.range(0, 1)],
    shapeOffset: [rng.range(0, 1), rng.range(0, 1), rng.range(0, 1)]
  }
}

/** Cloud leanings by climate (PLAN_BIOMES 11c; CLOUDS.md): stratocumulus
 * and stratus twice as often in cool climates (polar, boreal, temperate);
 * cumulus and congestus twice as often in the tropics and in a subtropical
 * summer, when the humid air builds towers like the tropics'. */
export function cloudLeaning(climate: Climate, summer: boolean): { cool: boolean; tropical: boolean } {
  return {
    cool: climate === 'polar' || climate === 'boreal' || climate === 'temperate',
    tropical: climate === 'tropical' || (climate === 'subtropical' && summer)
  }
}

/** Which clouds make up the sky; its own streams, and it depends on the
 * coast, the season, the wind and the time of day. */
function addFormations(
  seed: string,
  weather: WeatherParams,
  climate: Climate,
  context: { summer: boolean; windSpeed: number; morning: boolean },
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
    const leaning = cloudLeaning(climate, context.summer)
    const genera = pickFormations(frng, kind, leaning)
    const species = pickSpecies(Random.derive(seed, 'cloud-species'), genera, kind, {
      ...leaning,
      warmSummer: context.summer && (climate === 'mediterranean' || climate === 'subtropical' || climate === 'tropical'),
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

/** Thunderstorm chance per day; a subtropical summer has twice the storms
 * (Florida's afternoon thunderstorms, the East Asian and Brazilian summer
 * monsoon fronts). */
export function stormChance(climate: Climate, summer: boolean): number {
  return climate === 'subtropical' && summer ? 0.14 : 0.07
}

/** Whether generateStorm will make a storm (its first draw), known before
 * the heading and lens it places the storm with. */
function stormComes(seed: string, chance: number, timeOfDay: TimeOfDay, force?: Force<'thunderstorm' | 'squall'>): boolean {
  return forced(force, timeOfDay !== 'night' && Random.derive(seed, 'storm').chance(chance))
}

function generateStorm(
  seed: string,
  chance: number,
  timeOfDay: TimeOfDay,
  headingDeg: number,
  halfFovDeg: number,
  force?: Force<'thunderstorm' | 'squall'>
): StormParams | null {
  const rng = Random.derive(seed, 'storm')
  // The same first draw as stormComes.
  if (!forced(force, timeOfDay !== 'night' && rng.chance(chance))) return null
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
        // Near enough that the dark storm base over the strike shows: past
        // ~10 km it sits 3° up and the haze has washed it pale.
        distance: rng.range(3000, 9000),
        seed: rng.int(0, 1_000_000)
      }))
    : []
  return { curtains, bolts, rain: rng.chance(0.4) ? rng.range(0.3, 1) : 0, shelf: null }
}

/** Monthly fog season for a coast, as a chance multiplier; `month` is the
 * northern-hemisphere month with the day's season (seasons.ts). */
function fogSeason(month: number, summer: boolean): number {
  const warm = month >= 5 && month <= 9
  return warm === summer ? 1 : 0.35
}

/** Fog by climate (PLAN_BIOMES 11c), on top of the coast's table: haar on
 * temperate coasts (the North Sea, Scotland, Maine, Nova Scotia), less on
 * warm subtropical water (no cold current under the air). */
const CLIMATE_FOG: Partial<Record<Climate, number>> = { temperate: 1.4, subtropical: 0.4 }

function pickFog(
  seed: string,
  biome: Biome,
  climate: Climate,
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
  // Advection fog where warm air meets cold water.
  const advection: Partial<Record<Biome['name'], Partial<Record<OceanName, number>>>> = {
    mediterranean: { pacific: 0.3 * fogSeason(month, true), atlantic: 0.04 },
    desert: { atlantic: 0.3, pacific: 0.25 },
    nordic: { atlantic: 0.14 * fogSeason(month, true), pacific: 0.16 * fogSeason(month, true), arctic: 0.25 * fogSeason(month, true), southern: 0.12 },
    volcanic: { pacific: 0.08, atlantic: 0.1, southern: 0.12 }
  }
  // Sea smoke where bitter air meets open water in a polar winter.
  const winter = month <= 3 || month >= 11
  const smoke = winter && (ocean === 'arctic' || ocean === 'southern') ? 0.25 : winter && biome.name === 'nordic' ? 0.06 : 0
  // Fog peaks around dawn and burns off by midday.
  const hour: Record<TimeOfDay, number> = { 'golden-hour': 1.2, 'sun-on-horizon': 1.3, 'blue-hour': 1.3, night: 1.1, daylight: 0.8, midday: 0.4 }
  // The breeze that brings sea fog in must be light: stronger winds lift it.
  const breeze = windSpeed < 6 ? 1 : (11 - windSpeed) / 5
  const advectionChance = (advection[biome.name]?.[ocean] ?? (biome.name === 'tropical' ? 0.01 : 0.03)) * (CLIMATE_FOG[climate] ?? 1) * hour[timeOfDay] * breeze
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
  mountains: boolean,
  ocean: OceanName,
  timeOfDay: TimeOfDay,
  headingDeg: number,
  halfFovDeg: number,
  force?: Force<LandformParams['kind']>
): LandformParams | null {
  const rng = Random.derive(seed, 'landform')
  const chance: Record<Biome['name'], number> = { volcanic: 0.55, nordic: 0.4, mediterranean: 0.25, tropical: 0.2, desert: 0.2 }
  // Flat places (places.ts FLAT_LAND) have none.
  if (!forced(force, rng.chance(chance[biome.name]) && mountains)) return null
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
    // Own stream: about half of the active plumes grow a cap.
    pyrocumulus: active && Random.derive(seed, 'pyrocumulus').chance(0.5),
    lenticular: null,
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

function pickIslands(seed: string, biome: Biome, mountains: boolean, force?: Force<IslandKind>): IslandParams | null {
  const rng = Random.derive(seed, 'islands')
  const table = ISLANDS[biome.name]
  // Flat places (places.ts FLAT_LAND) have only low islands offshore: cays
  // and skerries (the Baltic's), no rocky or high ones (Florida).
  const kinds = mountains ? table.kinds : table.kinds.filter(([k]) => k === 'cay' || k === 'skerries')
  if (!forced(force, rng.chance(table.chance) && kinds.length > 0)) return null
  const kind = forcedKind(force, kinds.length > 0 ? rng.weighted(kinds) : rng.weighted(table.kinds))
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
  climate: Climate,
  south: boolean,
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
  // By climate (PLAN_BIOMES 11e): boobies and frigatebirds on tropical and
  // desert coasts (the Galápagos, Hawaii too); puffins only in the cool
  // north; gannets elsewhere (Australasian and Cape gannets in the south).
  else if (climate === 'tropical' || climate === 'arid') kind = 'tropical'
  else {
    const northern = !south && (ocean === 'arctic' || climate === 'polar' || climate === 'boreal' || climate === 'temperate')
    kind = northern && rng.chance(0.5) ? 'puffin' : 'gannet'
  }
  // The open sea has no mainland in view.
  const site = !hasLand({ type: coastType }) ? 'island' : or<ColonySite>(mainland < MAINLAND_COLONY[kind] ? 'mainland' : 'island', forceSite)
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

/** The seals of a coast in its climate (PLAN_BIOMES 11e), or none: the
 * biome × ocean table, except where the climate says otherwise. */
export function pinnipedTable(biome: Biome['name'], climate: Climate, ocean: OceanName, latitudeDeg: number): readonly (readonly [PinnipedKind, number])[] | undefined {
  // Galápagos sea lions on the equator, Hawaiian monk seals; no seals on
  // other tropical shores.
  if (climate === 'tropical') return biome === 'volcanic' && ocean === 'pacific' ? [[Math.abs(latitudeDeg) < 5 ? 'sea-lion' : 'seal', 1]] : undefined
  // Subtropical coasts: fur seals only in the south (NSW's Australian fur
  // seals, Uruguay's South American fur seals, northern New Zealand's), none
  // in Florida, south Japan, Taiwan, Natal or the Canaries.
  if (climate === 'subtropical') return latitudeDeg < 0 && ocean !== 'indian' ? [['fur-seal', 1]] : undefined
  // Spotted seals in the Yellow Sea; none on Atlantic Portugal.
  if (biome === 'mediterranean' && climate === 'temperate') return ocean === 'pacific' ? [['seal', 1]] : undefined
  return PINNIPEDS[biome][ocean]
}

function pickPinnipeds(
  seed: string,
  date: string,
  ocean: OceanName,
  biome: Biome,
  climate: Climate,
  latitudeDeg: number,
  coastType: CoastParams['type'],
  force?: Force<PinnipedKind>,
  forceSite?: HaulOut
): PinnipedParams | null {
  const rng = Random.derive(seed, 'pinnipeds')
  const beach = Random.derive(seed, 'pinnipeds/site').float()
  const site = (kind: PinnipedKind): PinnipedParams => ({
    kind,
    // Beach haul-outs need a beach; rocky shores and the open sea have rocks.
    site: !hasBeach({ type: coastType }) ? 'rock' : or<HaulOut>(beach < BEACH_HAUL_OUT[kind] ? 'beach' : 'rock', forceSite)
  })
  if (typeof force === 'string') return site(force)
  const table = pinnipedTable(biome.name, climate, ocean, latitudeDeg)
  // Tropical seals are confined to a few islands: rarer.
  const chance = climate === 'tropical' ? 0.06 : 0.2
  // Forced onto a coast that has none: harbour seals.
  if (table == null) return force === true ? site('seal') : null
  if (!forced(force, rng.chance(chance))) return null
  const kind = rng.weighted(table)
  // Out of season most are at sea (animalSeasons.ts), on their own stream.
  const ashore = Random.derive(seed, 'pinnipeds/season').float() < haulOutSeason(kind, { date, latitudeDeg })
  return ashore || force === true ? site(kind) : null
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
  const site = forcedKind(force, hasLand({ type: coastType }) && rng.chance(0.6) ? 'point' : 'rock')
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
  const periodS = Math.max(3, period)
  const character = `${flashes > 1 ? `Fl(${flashes})` : 'Fl'} W ${periodS}s`
  const dark = timeOfDay === 'night' || timeOfDay === 'blue-hour' || timeOfDay === 'sun-on-horizon'
  return {
    site,
    paint,
    height,
    character,
    periodS,
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
  const drawnEclipse =
    spec.eclipse === undefined
      ? eclipseOn(date, () => erng.float())
      : spec.eclipse === null
        ? null
        : eclipseOfType(spec.eclipse, () => erng.float())
  const skyRng = Random.derive(seed, 'moon-sky')

  // The place comes first, before the sky, so the sky can depend on it
  // (PLAN_BIOMES 1a). Biome, ocean, climate and latitude follow from it, on
  // their own streams.
  const place: Place = pickPlace(rng, spec)
  const month = Number(date.slice(5, 7))
  const orng = Random.derive(seed, 'ocean')
  const choice = pickOcean(orng, place.ocean, month, spec.ocean)
  const { basin } = choice
  const climate = choose(Random.derive(seed, 'climate'), place.climate, spec.climate)
  const latitudeDeg = latitudeIn(place, orng)
  // The real sun at the place (PLAN_BIOMES 12): from 63° the time of day
  // only offers what the sun does that day (polar night, white nights, the
  // midnight sun); below it every category stays (`realSun` null).
  const realSun: SunLimits | null = Math.abs(latitudeDeg) >= REAL_SUN_LATITUDE ? sunLimits(latitudeDeg, date) : null
  // A solar eclipse can't be seen where the sun never rises (polar night);
  // a lunar one can. A spec's eclipse still wins.
  const eclipse =
    drawnEclipse != null && spec.eclipse === undefined && drawnEclipse.type.startsWith('solar') && realSun != null && realSun.max < SUN_ELEVATION['sun-on-horizon'][0]
      ? null
      : drawnEclipse
  const solarEclipse = eclipse != null && eclipse.type.startsWith('solar')
  const lunarEclipse = eclipse != null && eclipse.type.startsWith('lunar')

  // Real moon phase for the date (noon UTC); new for a forced solar eclipse,
  // full for a lunar one.
  const moonPhaseDeg =
    spec.moonPhaseDeg ??
    (spec.eclipse != null ? (solarEclipse ? 0 : 180) : MoonPhase(new Date(`${date}T12:00:00Z`)))
  const elongation = moonPhaseDeg <= 180 ? moonPhaseDeg : 360 - moonPhaseDeg
  const moonIllumination = (1 - Math.cos(elongation * DEG)) / 2
  const polar = basin.water == null ? null : basin.name === 'arctic' ? 'arctic' : 'southern'
  // The biome in the day's climate (PLAN_BIOMES 11b): sands, plants and
  // greens follow the climate, the rest the biome.
  const biome: Biome = { ...placeBiome(place, climate), vegetation: plantsFor(place, climate, polar, latitudeDeg) }
  const monsoon = or(choice.monsoon, spec.monsoon)
  const ice = spec.ice === undefined ? choice.ice : forceIce(seed, spec.ice, basin.name, choice.ice)

  let timeOfDay = or(rng.weighted<TimeOfDay>(timeWeights(realSun)), spec.timeOfDay)
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

  // Marine-layer mornings (California, Peru and Chile), on their own stream;
  // not on eclipse days or under a forced sky.
  const marineDay = { place: place.id, month, timeOfDay, evening: isEvening }
  const marineLayer = marineLayerFor(marineDay, Random.derive(seed, 'marine-layer'), spec.marineLayer)
  // A stratus deck, sometimes stratocumulus (300–650 m up).
  let marineDeck: CloudGenus[] | undefined
  if (marineLayer && (spec.marineLayer === true || (eclipse == null && spec.weather == null && spec.clouds == null))) {
    const mrng = Random.derive(seed, 'marine-layer-deck')
    weather.kind = 'overcast'
    weather.coverage = mrng.range(0.75, 0.82)
    weather.marineLayer = true
    marineDeck = [mrng.chance(0.6) ? 'stratus' : 'stratocumulus']
  }

  // Harmattan dust (West Africa Dec–Feb), on its own stream: a dry wind, so
  // no showers or storms.
  weather.dust = dustFor(place.id, month, Random.derive(seed, 'dust'), spec.dust)

  // Rainbows: a shower passing on a sunny, showery day while the sun is low
  // (the bow is a 42° circle around the point opposite the sun, so it's only
  // above the horizon when the sun is below 42°). On those days the camera
  // turns its back to the sun. A storm hides the bow, so a stormy day is no
  // rainbow day (and keeps its own heading and lens); a forced rainbow keeps
  // the random storms away.
  // Jun–Sep north of the equator, Dec–Mar south of it.
  const summer = monthInSeason({ date, latitudeDeg }, 6, 9)
  const stormBarred = (eclipse != null || weather.marineLayer || weather.dust != null || spec.rainbow === true) && spec.storm === undefined
  const stormy = !stormBarred && stormComes(seed, stormChance(climate, summer), timeOfDay, spec.storm)
  const rainbowRng = Random.derive(seed, 'rainbow')
  const rainbowDay =
    (spec.rainbow ??
      (eclipse == null &&
        weather.dust == null &&
        (timeOfDay === 'golden-hour' || timeOfDay === 'daylight') &&
        (weather.kind === 'scattered' || weather.kind === 'broken') &&
        rainbowRng.chance(0.15))) &&
    !stormy

  // Camera heading, then the sun relative to it. Low suns are usually framed
  // in or near the view for glitter paths; high suns can be anywhere.
  let headingDeg = rng.range(0, 360)
  const [elMin, elMax] = sunRange(timeOfDay, realSun)
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
  // Blue hour: some days frame Venus, the evening or morning star (NIGHT_SKY
  // phase 5). Its bearing from the sun is the sky clock's, whatever the
  // compass, so the sun's bearing from the view moves to put Venus ahead.
  // Own stream.
  const planetRng = Random.derive(seed, 'planet-framing')
  const [venusChance, venusOffset, venusDusk] = [planetRng.float(), planetRng.normal(0, 5 * framing), planetRng.float()]
  let venusFramed = false
  const wantVenus = spec.planets === 'venus' || (spec.planets === undefined && venusChance < 0.4)
  const venusSky = ['clear', 'few', 'cirrus'].includes(weather.kind)
  if (timeOfDay === 'blue-hour' && wantVenus && venusSky && !solarEclipse && !rainbowDay && spec.sunAzimuthDeg === undefined) {
    // Photographed late in blue hour (sun 5.5–7° down): earlier, Venus is
    // lost in the glow round the sun (a 21 mm pixel at −4° barely shows it).
    const [lo, hi] = [Math.max(elMin, -7), Math.min(elMax, -5.5)]
    const venusSunEl = spec.sunElevationDeg ?? (lo < hi ? lo + (hi - lo) * venusDusk : sunElevationDeg)
    const sun = dirFromAzEl(headingDeg + relSunAz, venusSunEl)
    const venus = planetsIn({ date, latitudeDeg, sunDirection: sun, evening: isEvening }).find(p => p.id === 'venus')!
    const venusEl = elevationOf(venus.direction)
    // Only a Venus that shows: clear of the sun's glow and of the haze low
    // down (18° from the sun and 7° up it is lost in a −4° twilight).
    const fromSun = Math.acos(Math.max(-1, Math.min(1, venus.direction[0] * sun[0] + venus.direction[1] * sun[1] + venus.direction[2] * sun[2]))) / DEG
    if (venusEl > 8 && venusEl < 35 && fromSun > 25) {
      const az = (d: [number, number, number]) => Math.atan2(d[0], -d[2]) / DEG
      relSunAz = az(sun) - az(venus.direction) + venusOffset
      sunElevationDeg = venusSunEl
      venusFramed = true
    }
  }
  // Under the midnight sun the camera turns so the sun stands at its real
  // compass bearing (low in the north round midnight): the framing
  // (relSunAz) stays, the heading follows. Other days keep a random compass.
  if (realSun != null && realSun.min > SUN_ELEVATION['sun-on-horizon'][0]) {
    headingDeg = sunAzimuthDeg(latitudeDeg, date, sunElevationDeg, isEvening) - relSunAz
  }
  let sunDirection = dirFromAzEl(headingDeg + relSunAz, sunElevationDeg)

  // Place the moon at the physically correct angular distance from the sun
  // (its elongation), so the lit side and phase are consistent with the sky,
  // and within 5° of the ecliptic, which the sky clock turns into the scene
  // (NIGHT_SKY phase 1). Either side of the sun: the scene's clock is free.
  const eclipticPoleFor = (sun: [number, number, number]) =>
    apply(skyRotation({ date, latitudeDeg, sunDirection: sun, evening: isEvening }).matrix, ECLIPTIC_POLE)
  const eclipticPole = eclipticPoleFor(sunDirection)
  const moonAt = (spin: number, sun = sunDirection, pole = eclipticPole) =>
    eclipticOffset(sun, pole, elongation * DEG, spin / (2 * Math.PI))
  let moonDirection = moonAt(rng.range(0, 2 * Math.PI))
  if (timeOfDay === 'night' || (timeOfDay === 'blue-hour' && rng.chance(0.6))) {
    // Prefer a moon placement high enough to see and roughly in front of the
    // camera; try candidate spins and keep the best.
    const view = dirFromAzEl(headingDeg, 0)
    let best = moonDirection
    let bestScore = -Infinity
    // At night the hour is free too (a photographer waits for the moon to
    // sink): each candidate also tries a sun depth anywhere in the real
    // night, down to the midnight sun's (nothing reads the sun's depth
    // below −16° but the sky clock), so the sky turns with the moon on the
    // ecliptic. Own stream.
    const hourRng = Random.derive(seed, 'moon-hour')
    const deepest = Math.min(elMin, sunLimits(latitudeDeg, date).min)
    let bestSunEl = sunElevationDeg
    for (let i = 0; i < 48; i++) {
      const sunEl = timeOfDay === 'night' ? or(hourRng.range(deepest, elMax), spec.sunElevationDeg) : sunElevationDeg
      const sun = sunEl === sunElevationDeg ? sunDirection : dirFromAzEl(headingDeg + relSunAz, sunEl)
      const candidate = moonAt(rng.range(0, 2 * Math.PI), sun, sun === sunDirection ? eclipticPole : eclipticPoleFor(sun))
      const el = elevationOf(candidate)
      const facing = candidate[0] * view[0] + candidate[2] * view[2]
      // At night the moon is the subject: keep it low enough to share the
      // frame with the sea.
      const [lo, hi] = timeOfDay === 'night' ? [4, 18] : [4, 40]
      const score = (el > lo && el < hi ? 1 : -1) + facing + rng.range(0, 0.5)
      if (score > bestScore) {
        bestScore = score
        best = candidate
        bestSunEl = sunEl
      }
    }
    moonDirection = best
    if (bestSunEl !== sunElevationDeg) {
      sunElevationDeg = bestSunEl
      sunDirection = dirFromAzEl(headingDeg + relSunAz, sunElevationDeg)
    }
    if (timeOfDay === 'night') {
      // Turn toward the moon so its glitter path runs across the water.
      const moonAzDeg = Math.atan2(moonDirection[0], -moonDirection[2]) / DEG
      headingDeg = moonAzDeg + Random.derive(seed, 'moon-framing').normal(0, 14 * framing)
    }
  }
  // Aurora (NIGHT_SKY phase 6, own stream): the day's Kp against the
  // place's geomagnetic latitude. A low arc is framed by turning the sky
  // (sun and moon about the vertical) so it stands ahead: the camera stays.
  const northAzimuthDeg = (() => {
    const pole = apply(skyRotation({ date, latitudeDeg, sunDirection, evening: isEvening }).matrix, [0, 0, 1])
    return Math.atan2(pole[0], -pole[2]) / DEG
  })()
  let aurora = auroraFor(
    { date, placeId: place.id, latitudeDeg, night: timeOfDay === 'night' && !lunarEclipse, weatherKind: weather.kind, northAzimuthDeg, headingDeg },
    Random.derive(seed, 'aurora'),
    framing,
    spec.aurora
  )
  const turnSky = (deg: number) => {
    const turn = (d: [number, number, number]) => dirFromAzEl(Math.atan2(d[0], -d[2]) / DEG + deg, elevationOf(d))
    relSunAz += deg
    sunDirection = turn(sunDirection)
    moonDirection = turn(moonDirection)
  }
  if (aurora != null && aurora.frameTurnDeg !== 0) turnSky(aurora.frameTurnDeg)
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
      const candidate = moonAt(skyRng.range(0, 2 * Math.PI))
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
  // Aurora photographers shoot wide (14–24 mm) with plenty of sky (the
  // horizon 60–68% down): the display stands 8–40° up (own stream).
  const auroraFrame = Random.derive(seed, 'aurora-framing')
  const [auroraLens, auroraHorizon] = [auroraFrame.range(14, 24), auroraFrame.range(0.6, 0.68)]
  // The draws here; the lens itself once fog and storms have said whether
  // the aurora shows (lensFor).
  const eclipseLens = eclipse != null ? erng.range(24, 35) : drawnFocalLength
  const rainbowLens = eclipse == null && !(aurora != null) && rainbowDay ? rainbowRng.range(14, 22) : drawnFocalLength
  const lensFor = (auroraShown: boolean) =>
    or(
      eclipse != null
        ? eclipseLens
        : auroraShown
          ? Math.min(drawnFocalLength, auroraLens)
          : rainbowDay
            ? Math.min(drawnFocalLength, rainbowLens)
            : drawnFocalLength,
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

  // Placed with the lens of the day it makes: an unforced aurora doesn't
  // show through it.
  const storm = stormBarred
    ? null
    : generateStorm(seed, stormChance(climate, summer), timeOfDay, headingDeg, horizontalHalfFovDeg(lensFor(aurora != null && spec.aurora != null), aspect), spec.storm)
  if (storm != null) {
    const srng = Random.derive(seed, 'storm-weather')
    weather.kind = 'storm'
    weather.marineLayer = false
    weather.coverage = srng.range(0.55, 0.68)
    const altostratus = srng.chance(0.6)
    // Gale-force gusts under the cells; the spectrum turns them into a high,
    // breaking sea.
    windSpeed = srng.range(14, 22)
    const bright = srng.chance(0.4)
    weather.sunVisibility = bright ? srng.range(0.15, 0.4) : srng.range(0, 0.05)
    weather.formations = stormFormations(seed, altostratus, !bright)
  }

  const water = basin.water ?? Random.derive(seed, 'water').pick(biome.water)
  // The ocean shapes its sea: Southern gales, Pacific groundswell, monsoon
  // seas; pack ice smothers waves, leaving calm leads between the floes.
  const iceCalm = ice != null && ice.packIce > 0 ? 0.4 : 1
  windSpeed = or(Math.min(24, windSpeed * basin.wind * (monsoon ? 1.35 : 1)), spec.wind)
  // Under the inversion the breeze is light until the deck burns off.
  if (weather.marineLayer && spec.wind == null) windSpeed = Math.min(windSpeed, 6)
  addFormations(
    seed,
    weather,
    climate,
    {
      summer,
      windSpeed,
      morning: !isEvening && (timeOfDay === 'golden-hour' || timeOfDay === 'daylight' || timeOfDay === 'sun-on-horizon')
    },
    spec.clouds ?? (weather.marineLayer ? marineDeck : undefined)
  )
  const seaIce = pickSeaIce(seed, place.id, { date, latitudeDeg }, spec.seaIce, spec.props?.phenology)
  const drawnSpout = waterspoutFor(
    {
      biome: biome.name,
      ocean: basin.name,
      month: Number(date.slice(5, 7)),
      timeOfDay,
      weather: weather.kind,
      windSpeed,
      headingDeg,
      // By day, where no aurora changes the lens.
      halfFovDeg: horizontalHalfFovDeg(lensFor(aurora != null), aspect),
      fog: false
    },
    Random.derive(seed, 'waterspout'),
    spec.waterspout
  )
  // None over ice, unless a spec wants one.
  const waterspout = seaIce != null && spec.waterspout === undefined ? null : drawnSpout
  // A spout hangs from the flat base of building cumulus: make sure the sky
  // has it (unless the spec set the clouds).
  if (waterspout != null && weather.kind !== 'storm' && spec.clouds == null && !weather.formations.includes('cumulus-congestus')) {
    weather.formations = ['cumulus-congestus', ...weather.formations.filter(g => CLOUD_GENERA[g].etage !== 'low')]
  }
  weather.arrangement = pickArrangement(seed, weather, climate === 'tropical', windSpeed, windHeadingDeg, spec.cloudArrangement)
  const drawnFog =
    (rainbowDay || eclipse != null) && spec.fog === undefined
      ? null
      : pickFog(seed, biome, climate, basin.name, seasonMonth({ date, latitudeDeg }), timeOfDay, weather, windSpeed, spec.fog)
  // Sea smoke rises off open water; a frozen sea has none to give it.
  const fog = seaIce != null && spec.fog === undefined && drawnFog?.kind === 'sea-smoke' ? null : drawnFog
  if (fog != null) {
    // Fog comes with light airs: the sea calms under it.
    if (spec.wind == null) windSpeed = Math.min(windSpeed, fog.kind === 'sea-smoke' ? 3 : 6)
    // The sun's dimming by the layer above the eye is applied at render time
    // (scene.ts fogSunTransmittance), where the eye's height is known.
  }
  // Fog and storms are chosen after the aurora: they hide it, and then
  // nothing calls for its wide lens, high horizon or turned sky.
  if (aurora != null && spec.aurora == null && (fog != null || storm != null || weather.kind === 'overcast')) {
    if (aurora.frameTurnDeg !== 0) turnSky(-aurora.frameTurnDeg)
    aurora = null
  }
  const auroraNight = aurora != null && eclipse == null
  const focalLengthMm = lensFor(auroraNight)
  const oceanSwell = swell(seed, windHeadingDeg, climate)
  // A frozen sea stops the waves: crests stay under the ice (seaIce.ts).
  oceanSwell.swellHeight = or(seaIce != null ? 0 : oceanSwell.swellHeight * (basin.swellHeight * (monsoon ? 1.5 : 1) * iceCalm * iceCalm), spec.swellHeight)
  // Deep-water wavelength from a forced period: L = g T² / 2π.
  const forcedLength = spec.swellPeriod == null ? undefined : (9.81 * spec.swellPeriod ** 2) / (2 * Math.PI)
  oceanSwell.swellWavelength = Math.min(320, or(oceanSwell.swellWavelength * basin.swellWavelength, forcedLength))
  const oceanState = { airWindSpeed: windSpeed, windSpeed: spec.wind ?? (seaIce != null ? Math.min(ICE_WAVE_WIND, windSpeed * iceCalm) : windSpeed * iceCalm), windHeadingDeg, ...oceanSwell }
  const roughBeach = storm != null || (Math.abs(latitudeDeg) > 25 && season({ date, latitudeDeg }) === 'winter')
  const tide = tideFor(place.tide, moonPhaseDeg, Random.derive(seed, 'tide'), spec)
  const { coast, eyeHeight } = generateCoast(seed, attempt, headingDeg, place, climate, oceanState, { rough: roughBeach, frozen: seaIce != null }, tide, spec)

  const timeLabel: Record<TimeOfDay, string> = {
    'golden-hour': isEvening ? 'Golden hour' : 'Morning gold',
    'sun-on-horizon': isEvening ? 'Sunset' : 'Sunrise',
    'blue-hour': isEvening ? 'Dusk' : 'Dawn',
    daylight: isEvening ? 'Afternoon' : 'Morning',
    midday: 'Midday',
    night: nightSky === 'starlit' ? 'Starry night' : 'Moonlit night'
  }
  // The polar sun names itself (PLAN_BIOMES 12): noon twilight and night
  // in the polar night, the low sun of a midnight-sun day.
  const horizon = SUN_ELEVATION['sun-on-horizon'][0]
  if (realSun != null && realSun.max < horizon && sunElevationDeg <= realSun.max) {
    timeLabel['blue-hour'] = 'Polar night twilight'
    timeLabel.night = `Polar night${nightSky === 'starlit' ? ', starlit' : ''}`
  }
  if (realSun != null && realSun.min > horizon && sunElevationDeg < realSun.min + (realSun.max - realSun.min) / 4) {
    timeLabel[timeOfDay] = 'Midnight sun'
  }
  const colony = pickColony(seed, basin.name, climate, latitudeDeg < 0, coast.type, spec.colony, spec.colonySite)
  const pinnipeds = pickPinnipeds(seed, date, basin.name, biome, climate, latitudeDeg, coast.type, spec.pinnipeds, spec.haulOut)
  const lighthouse = pickLighthouse(seed, biome, basin.name, coast.type, timeOfDay, fog, spec.lighthouse)
  const landform = pickLandform(seed, biome, place.mountains, basin.name, timeOfDay, headingDeg, horizontalHalfFovDeg(focalLengthMm, aspect), spec.landform)
  // After the draws: the season moves the snow line, by date and climate.
  if (landform != null && spec.props?.phenology !== false) landform.snowLine = seasonalSnowLine(landform, climate, { date, latitudeDeg })
  const snow = pickSnow(seed, place.id, climate, { date, latitudeDeg }, spec.snow, spec.props?.iceFoot, spec.props?.phenology, seaIce != null)
  // Snow lying at the shore lies on the mountains behind it too.
  if (landform != null && snow != null) landform.snowLine = Math.min(landform.snowLine, landform.height * 0.35 * (1 - snow.cover))
  const islands = pickIslands(seed, biome, place.mountains, spec.islands)
  if (storm != null) storm.shelf = shelfCloudFor(storm, Random.derive(seed, 'shelf-cloud'), spec.shelfCloud)
  // The shelf is the storm's low cloud there: scud at the same height would
  // hide it.
  if (storm?.shelf != null && spec.clouds == null) weather.formations = weather.formations.filter(g => g !== 'stratus-fractus')
  if (landform != null) landform.lenticular = lenticularFor(landform, windSpeed, weather.kind, Random.derive(seed, 'lenticular'), spec.lenticular)
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

  const climateWord = climateTitle(biome.name, climate)
  const titleParts = [
    timeLabel[timeOfDay],
    hasBeach(coast)
      ? `${climateWord} ${beachName(coast.material, coast.sand.name)}`
      : coast.rock != null
        ? `${climateWord} ${ROCK_NAMES[coast.rock.kind]}`
        : coast.flat != null
          ? `${climateWord} tidal flats`
          : seaIce != null
            ? seaIce.cover < 0.6 ? 'ice-strewn sea' : 'frozen sea'
            : seaName(oceanState.windSpeed),
    basin.label
  ]
  if (coast.reef != null) titleParts.push('coral reef')
  if (coast.marsh != null && coast.flat == null) titleParts.push('salt marsh')
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
  if (weather.marineLayer) titleParts.push('marine layer')
  if (weather.dust != null) titleParts.push(weather.dust)
  if (rainbow != null) titleParts.push('rainbow')
  if (waterspout != null) titleParts.push('waterspout')
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
  // The sheet takes the pack's place on a frozen day; bergs stay, frozen in.
  if (ice != null && (seaIce == null || ice.bergs > 0)) titleParts.push(ice.packIce > 0 && seaIce == null ? 'pack ice' : 'icebergs')
  if (seaIce != null && hasLand(coast)) titleParts.push('sea ice')
  if (snow != null) titleParts.push(snow.iceFoot && hasLand(coast) ? 'snow and shore ice' : 'snow')
  if (fog != null) titleParts.push(fog.kind === 'sea-smoke' ? 'sea smoke' : fog.start > 0 ? 'fog bank' : 'fog')
  if (storm != null) {
    titleParts.push(storm.bolts.length > 0 ? 'thunderstorm' : 'squall')
  } else {
    if (hasLand(coast) && windSpeed >= 10) titleParts.push('windy')
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
    place: { id: place.id, region: place.region, climate, hemisphere: latitudeDeg < 0 ? 'south' : 'north' },
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
    waterspout,
    contrails: [],
    visibilityKm: 0,
    noctilucent: null,
    nacreous: null,
    nightGlow: null,
    meteors: [],
    planets: [],
    aurora: null,
    rollCloud: null,
    lighthouse,
    snow,
    seaIce,
    ...(spec.props != null ? { overrides: spec.props } : {}),
    camera: {
      heightM: spec.camera?.heightM ?? eyeHeight ?? heightM,
      headingDeg,
      horizonFraction: or(
        ((drawn: number) => (eclipse != null ? erng.range(0.56, 0.66) : auroraNight ? Math.max(drawn, auroraHorizon) : drawn))(
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
  params.noctilucent = noctilucentFor(params, Random.derive(seed, 'noctilucent'), spec.noctilucent)
  params.nacreous = nacreousFor(params, Random.derive(seed, 'nacreous'), spec.nacreous)
  params.rollCloud = rollCloudFor(
    {
      biome: biome.name,
      ocean: basin.name,
      month: Number(date.slice(5, 7)),
      latitudeDeg,
      timeOfDay,
      evening: isEvening,
      weather: weather.kind,
      headingDeg
    },
    Random.derive(seed, 'roll-cloud'),
    spec.rollCloud
  )
  if (params.rollCloud != null) params.title += ' · Morning Glory'
  params.contrails = contrailsFor(params, Random.derive(seed, 'contrails'), spec.contrails)
  params.visibilityKm = visibilityFor(params, Random.derive(seed, 'visibility'), spec.visibilityKm)
  params.nightGlow = nightGlowFor(params, Random.derive(seed, 'night-glow'), spec)
  params.aurora = aurora
  if (aurora != null) params.title += latitudeDeg < 0 ? ' · Southern lights' : ' · Northern lights'
  params.planets = planetsFor(params, spec.planets === false || spec.planets === null)
  const venus = params.planets.find(p => p.id === 'venus')
  if (venusFramed && venus != null && params.fog == null && inSky(params, venus.direction, 0.95, 2)) params.title += ' · Venus'
  params.meteors = meteorsFor(params, Random.derive(seed, 'meteors'), params.nightGlow?.bortle ?? place.bortle, spec.meteors)
  if (params.meteors.length > 0) {
    const shower = SHOWERS.find(s => s.id === params.meteors[0].shower)
    params.title += ` · ${shower != null ? shower.name : 'shooting star'}`
  }
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
