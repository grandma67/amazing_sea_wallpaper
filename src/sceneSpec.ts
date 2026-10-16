import type { EclipseType } from './celestial'
import type { Biome, SandStyle, VegetationKind } from './biome'
import { CLOUD_GENERA, MAX_LAYERS, type CloudGenus } from './cloudTypes'
import type { OceanName } from './oceans'
import type { ColonyKind, ColonySite, Composition, HaulOut, IslandKind, PinnipedKind, SceneParams, TimeOfDay, WeatherKind } from './params'
import type { DebrisSpec } from './props/debris'
import type { ShoreLife } from './props/shoreLife'
import type { Wildlife } from './props/wildlife'

// A scene described as JSON, for building and checking features without
// hunting for a date that happens to have them. Every field is optional:
// what's left out is drawn from the date as usual, so
//   { "date": "2024-07-12", "timeOfDay": "night" }
// is that day's scene (same biome, coast, lens…) at night.
//
// For features that can be absent, null or false removes it, true makes sure
// it's there (of a kind picked as usual), and a kind forces that kind.
// Anything without its own field can be set with `params`, a deep patch over
// the finished SceneParams (it can't change the title or anything derived).
//
// Use it with ?scene=<JSON> on the page, or a JSON file of one spec or a list
// of them: node scripts/snapshot.mjs --scene specs.json

/** Present, absent, or a given kind. */
export type Force<K extends string> = K | boolean | null

export type MarineSpecies = 'dolphin' | 'orca' | 'humpback' | 'swordfish'
export type MigratorySpecies = 'goose' | 'duck' | 'flamingo'
/** Red (prop roots) or grey (dwarf, breathing roots) mangrove. */
export type MangroveKind = 'rhizophora' | 'avicennia'

export type ShipKind =
  | 'sloop'
  | 'catamaran'
  | 'dhow'
  | 'motor-yacht'
  | 'trawler'
  | 'container-ship'
  | 'tanker'
  | 'dinghy'
  | 'expedition-ship'
  | 'icebreaker'

/** What the props decide for themselves (src/props/), forced. */
export interface PropOverrides {
  marine?: Force<MarineSpecies>
  /** Gulls. */
  birds?: boolean
  migratory?: Force<MigratorySpecies>
  /** true: some of every class of boat; a list: one of each kind named. */
  ships?: boolean | ShipKind[]
  rocks?: boolean
  seaStacks?: boolean
  /** Which plants grow (the biome's own list otherwise); [] for none. */
  vegetation?: VegetationKind[]
  /** null: nothing washed up; fields replace the drawn ones. */
  debris?: Partial<DebrisSpec> | null
  /** null: no crabs, shells or flowers; fields replace the drawn ones. */
  shoreLife?: Partial<ShoreLife> | null
  /** A stand of mangroves on a sheltered shore (props/mangroves.ts). */
  mangroves?: Force<MangroveKind>
  /** null: no turtles, monkeys or lizards; fields replace the drawn ones. */
  wildlife?: Partial<Omit<Wildlife, 'region'>> | null
}

export interface SceneSpec {
  /** Output name for scripts (ignored by the scene). */
  name?: string
  /** Free text, ignored. */
  note?: string
  /** The base day: its seed, moon phase and month (seasons). */
  date?: string
  /** Replaces the date's seed, for another random scene on the same day. */
  seed?: string

  timeOfDay?: TimeOfDay
  /** Evening rather than morning (titles: Sunset vs Sunrise). */
  evening?: boolean
  sunElevationDeg?: number
  /** Sun azimuth from the view direction (deg, clockwise): 0 = ahead. */
  sunAzimuthDeg?: number
  /** 0 = new, 90 = first quarter, 180 = full. */
  moonPhaseDeg?: number
  /** By day, the moon in the frame with the sun (needs > 15% lit). */
  dayMoon?: boolean
  /** At night, moon up (needs > 3% lit) or down. */
  nightSky?: 'moonlit' | 'starlit'
  /** null: none, even on a real eclipse day. */
  eclipse?: EclipseType | null

  biome?: Biome['name']
  ocean?: OceanName
  monsoon?: boolean
  ice?: Force<'pack' | 'bergs'>
  coast?: 'beach' | 'open-sea'
  /** Implies a beach. */
  composition?: Composition
  sand?: SandStyle['name']

  weather?: Exclude<WeatherKind, 'storm'>
  /** Cloud genera and species, one layer each (at most 4); usually one per
   * étage. A genus listed twice is a second, higher deck (duplicatus). */
  clouds?: CloudGenus[]
  /** Cloud streets along the wind or wave bands across it. */
  cloudArrangement?: Force<'streets' | 'bands'>
  /** A waterspout (tornadic ones belong with storms). */
  waterspout?: Force<'fair-weather' | 'tornadic'>
  /** Noctilucent clouds (they only show at twilight with the sun 6–16° down). */
  noctilucent?: boolean | null
  /** Nacreous clouds (lit with the sun 1–6° down). */
  nacreous?: boolean | null
  /** Aircraft trails: null/false none, true at least one, a number that many (≤ 5). */
  contrails?: boolean | number | null
  storm?: Force<'thunderstorm' | 'squall'>
  rainbow?: boolean
  fog?: Force<'advection' | 'bank' | 'sea-smoke'>
  lighthouse?: Force<'point' | 'rock'>
  landform?: Force<'range' | 'strato' | 'shield'>
  islands?: Force<IslandKind>
  colony?: Force<ColonyKind>
  pinnipeds?: Force<PinnipedKind>
  /** Where the colony is (on a beach coast; the open sea only has islands). */
  colonySite?: ColonySite
  /** Where the seals haul out (on a beach coast). */
  haulOut?: HaulOut
  /** Wind speed (m/s). */
  wind?: number

  camera?: {
    heightM?: number
    focalLengthMm?: number
    horizonFraction?: number
    rollDeg?: number
  }
  props?: PropOverrides
  /** Deep patch over the finished params; arrays and nulls replace. */
  params?: DeepPartial<SceneParams>
}

export type DeepPartial<T> = T extends readonly unknown[] ? T : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> | null } : T

/** Is a feature forced on (true or a kind), off (null/false), or left to
 * chance (undefined)? Returns the drawn presence when left to chance. */
export function forced(force: Force<string> | undefined, drawn: boolean): boolean {
  return force === undefined ? drawn : force !== null && force !== false
}

/** The kind a Force names, else the drawn kind. */
export function forcedKind<K extends string>(force: Force<K> | undefined, drawn: K): K {
  return typeof force === 'string' ? force : drawn
}

/** `target` with `patch` merged in: objects merge, everything else (arrays,
 * null, numbers…) replaces. */
export function deepPatch<T>(target: T, patch: unknown): T {
  if (patch === undefined) return target
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return patch as T
  if (target == null || typeof target !== 'object' || Array.isArray(target)) return structuredClone(patch) as T
  const out: Record<string, unknown> = { ...(target as Record<string, unknown>) }
  for (const [key, value] of Object.entries(patch)) out[key] = deepPatch(out[key], value)
  return out as T
}

// ---------------------------------------------------------------------------
// Validation: a typo should fail loudly, not quietly render a random day.

type Check = (value: unknown, path: string) => void

const fail = (path: string, message: string): never => {
  throw new Error(`scene spec: ${path} ${message}`)
}
const oneOf = (...options: readonly (string | boolean | null)[]): Check => (value, path) => {
  if (!options.includes(value as string)) fail(path, `must be one of ${options.map(o => JSON.stringify(o)).join(', ')}; got ${JSON.stringify(value)}`)
}
const force = (...kinds: string[]): Check => oneOf(true, false, null, ...kinds)
const number: Check = (value, path) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, `must be a number; got ${JSON.stringify(value)}`)
}
const string: Check = (value, path) => {
  if (typeof value !== 'string') fail(path, `must be a string; got ${JSON.stringify(value)}`)
}
const boolean: Check = oneOf(true, false)
const listOf = (item: Check): Check => (value, path) => {
  if (!Array.isArray(value)) fail(path, 'must be a list')
  ;(value as unknown[]).forEach((v, i) => item(v, `${path}[${i}]`))
}
const object = (fields: Record<string, Check>, nullable = false): Check => (value, path) => {
  if (value === null && nullable) return
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(path, `must be an object${nullable ? ' or null' : ''}`)
  for (const [key, v] of Object.entries(value as object)) {
    const check = fields[key]
    if (check == null) fail(`${path}.${key}`, `is not a known field (known: ${Object.keys(fields).join(', ')})`)
    check(v, `${path}.${key}`)
  }
}

const TIMES = ['golden-hour', 'sun-on-horizon', 'blue-hour', 'daylight', 'midday', 'night']
const BIOMES = ['tropical', 'mediterranean', 'nordic', 'volcanic', 'desert']
const OCEANS = ['pacific', 'atlantic', 'indian', 'southern', 'arctic']
const GENERA = Object.keys(CLOUD_GENERA)
const PLANTS = ['palm', 'pandanus', 'stone-pine', 'olive', 'cypress', 'broadleaf', 'conifer', 'birch', 'acacia', 'bush', 'grass']
const FLOWERS = ['morning-glory', 'bindweed', 'sea-holly', 'sea-daffodil', 'ice-plant', 'thrift', 'sea-rocket', 'oysterplant']

const SPEC = object({
  name: string,
  note: string,
  date: (value, path) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(path, `must be YYYY-MM-DD; got ${JSON.stringify(value)}`)
  },
  seed: string,
  timeOfDay: oneOf(...TIMES),
  evening: boolean,
  sunElevationDeg: number,
  sunAzimuthDeg: number,
  moonPhaseDeg: number,
  dayMoon: boolean,
  nightSky: oneOf('moonlit', 'starlit'),
  eclipse: oneOf(null, 'solar-partial', 'solar-annular', 'solar-total', 'lunar-partial', 'lunar-total'),
  biome: oneOf(...BIOMES),
  ocean: oneOf(...OCEANS),
  monsoon: boolean,
  ice: force('pack', 'bergs'),
  coast: oneOf('beach', 'open-sea'),
  composition: oneOf('shoreline', 'along-beach', 'framed', 'overlook'),
  sand: oneOf('white', 'golden', 'grey', 'black'),
  weather: oneOf('clear', 'cirrus', 'few', 'scattered', 'broken', 'overcast'),
  clouds: (value, path) => {
    listOf(oneOf(...GENERA))(value, path)
    if ((value as unknown[]).length > MAX_LAYERS) fail(path, `has at most ${MAX_LAYERS} layers`)
  },
  cloudArrangement: force('streets', 'bands'),
  waterspout: force('fair-weather', 'tornadic'),
  noctilucent: oneOf(true, false, null),
  nacreous: oneOf(true, false, null),
  contrails: (value, path) => (typeof value === 'number' ? number(value, path) : oneOf(true, false, null)(value, path)),
  storm: force('thunderstorm', 'squall'),
  rainbow: boolean,
  fog: force('advection', 'bank', 'sea-smoke'),
  lighthouse: force('point', 'rock'),
  landform: force('range', 'strato', 'shield'),
  islands: force('skerries', 'rocky', 'cay', 'karst', 'high'),
  colony: force('gannet', 'puffin', 'tropical', 'penguin'),
  pinnipeds: force('seal', 'sea-lion', 'fur-seal', 'elephant-seal'),
  colonySite: oneOf('island', 'mainland'),
  haulOut: oneOf('rock', 'beach'),
  wind: number,
  camera: object({ heightM: number, focalLengthMm: number, horizonFraction: number, rollDeg: number }),
  props: object({
    marine: force('dolphin', 'orca', 'humpback', 'swordfish'),
    mangroves: force('rhizophora', 'avicennia'),
    birds: boolean,
    migratory: force('goose', 'duck', 'flamingo'),
    ships: (value, path) =>
      typeof value === 'boolean' ? undefined : listOf(oneOf('sloop', 'catamaran', 'dhow', 'motor-yacht', 'trawler', 'container-ship', 'tanker', 'dinghy', 'expedition-ship', 'icebreaker'))(value, path),
    rocks: boolean,
    seaStacks: boolean,
    vegetation: listOf(oneOf(...PLANTS)),
    debris: object(
      { driftwood: number, rootWads: boolean, wrack: oneOf(null, 'kelp', 'seagrass', 'sargassum'), wrackAmount: number, coconuts: number },
      true
    ),
    shoreLife: object(
      {
        crab: oneOf(null, 'ghost', 'shore', 'hermit'),
        crabs: number,
        burrows: number,
        shells: listOf(oneOf('clam', 'cockle', 'scallop', 'mussel', 'razor', 'sand-dollar')),
        shellCount: number,
        starfish: number,
        flowers: listOf(oneOf(...FLOWERS)),
        flowerAmount: number
      },
      true
    ),
    wildlife: object(
      {
        turtle: oneOf(null, 'green', 'loggerhead', 'leatherback', 'hawksbill', 'olive-ridley'),
        nesting: boolean,
        tracks: number,
        hatchlings: number,
        basking: number,
        monkey: oneOf(null, 'macaque', 'capuchin', 'vervet'),
        monkeys: number,
        lizard: oneOf(null, 'marine-iguana', 'green-iguana', 'monitor', 'spiny-tailed'),
        lizards: number
      },
      true
    )
  }),
  // Free-form; it's merged as it is.
  params: (value, path) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(path, 'must be an object')
  }
})

/** Check a parsed JSON value is a SceneSpec; throws naming the bad field. */
export function parseSceneSpec(value: unknown): SceneSpec {
  if (typeof value === 'string') value = JSON.parse(value)
  SPEC(value, 'spec')
  return value as SceneSpec
}
