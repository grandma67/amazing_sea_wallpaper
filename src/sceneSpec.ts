import { BEACH_MATERIALS, type BeachMaterial } from './beach'
import { BEACH_STATES, type BeachState } from './beachState'
import { SHOWERS } from './meteors'
import type { EclipseType } from './celestial'
import { SAND_STYLES, type Biome, type SandStyle, type VegetationKind } from './biome'
import { CLOUD_GENERA, MAX_LAYERS, type CloudGenus } from './cloudTypes'
import type { OceanName } from './oceans'
import { BLOOM_KINDS, HEATH_STAGES, type BloomKind, type HeathStage } from './phenology'
import { CLIMATES, PLACES, REGION_IDS, type Climate } from './places'
import { ROCK_KINDS, type RockKind } from './rockShore'
import type { SeaIceForce } from './seaIce'
import type { TideStage } from './tides'
import { DEBUG_MARKERS, DEBUG_PASSES, OCEAN_VIEWS, TERRAIN_VIEWS } from './debug'
import { TERRAIN_TERM_NAMES } from './terrainTerms'
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
  /** Salt-marsh tufts (props/saltMarsh.ts); false: none. */
  saltMarsh?: boolean
  seaStacks?: boolean
  /** false: stony beaches drawn by the terrain shader alone, no mesh stones. */
  stones?: boolean
  /** false: no beachrock ledges (the reef's beachrock stays in the params). */
  beachrock?: boolean
  /** false: no spray and foam along a rocky shore's edge (props/surf.ts edgeRocks). */
  rockEdge?: boolean
  /** Which plants grow (the biome's own list otherwise); [] for none. */
  vegetation?: VegetationKind[]
  /** false: plants and ground keep their summer look whatever the date
   * (phenology.ts: autumn leaves, bare trees, dry grass). */
  phenology?: boolean
  /** false: no sea-ice mesh on a sea-ice day, waves still calmed (props/seaIce.ts). */
  seaIce?: boolean
  /** false: no ice foot on a snow day; true: one on any snow day (props/iceFoot.ts). */
  iceFoot?: boolean
  /** false: no fallen leaves or litter colour under deciduous trees
   * (props/leafLitter.ts). */
  leafLitter?: boolean
  /** Bush blossom (phenology.ts BLOOM): true, every row that grows here in
   * full flower (none where none grows); a list, those rows in full flower
   * wherever the day is (to test a look); false: none. */
  bloom?: boolean | BloomKind[]
  /** Heath on the ground cover (phenology.ts heathFor): true, heath in
   * today's colour wherever the day is (near on a rocky shore, far on slopes
   * and islands); a stage, in that colour; false: none. */
  heath?: boolean | HeathStage
  /** false: moss on rock as before NATURE_PLAN phase 7 (the biome's amount,
   * always green, none on the rocky shore's terrain). */
  moss?: boolean
  /** false: no laver or sea lettuce on the rocky shore (the spray belt
   * stays: phenology.ts shoreWeed). */
  shoreWeed?: boolean
  /** false: no eucalypts drawn (still placed, so the other plants don't
   * move; props/vegetation.ts). */
  eucalyptus?: boolean
  /** null: nothing washed up; fields replace the drawn ones. */
  debris?: Partial<DebrisSpec> | null
  /** null: no crabs, shells or flowers; fields replace the drawn ones. */
  shoreLife?: Partial<ShoreLife> | null
  /** A stand of mangroves on a sheltered shore (props/mangroves.ts). */
  mangroves?: Force<MangroveKind>
  /** null: no turtles, monkeys, lizards, crocodiles or hippos; fields replace the drawn ones. */
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

  /** A place id or a region id (places.ts); the day draws among those. */
  place?: string
  /** These restrict the place draw to places that have them, and force them;
   * a combination no place has throws. */
  biome?: Biome['name']
  ocean?: OceanName
  climate?: Climate
  monsoon?: boolean
  ice?: Force<'pack' | 'bergs'>
  coast?: 'beach' | 'open-sea' | 'rock-shore' | 'tidal-flat'
  /** A rocky shore of this kind (rockShore.ts); implies a rock shore. */
  rockShore?: RockKind
  /** Implies a beach (on a rock shore: overlook is the cliff top). */
  composition?: Composition
  sand?: SandStyle['name']
  /** Sand or stones (beach.ts); a stony material implies a beach. */
  beachMaterial?: BeachMaterial
  /** Wright & Short beach state (beachState.ts): slopes, bars, rips, cusps. */
  beachState?: BeachState
  /** Lying snow (snow.ts): null/false none, true a typical cover, or the cover
   * (0–1). */
  snow?: boolean | number | null
  /** Sea ice (seaIce.ts): null/false none, true typical for the date, 'fast' or
   * 'drift' that kind to the camera, 'forming' or 'melting' those shoulders. */
  seaIce?: SeaIceForce
  /** The tide's stage today (tides.ts): low water, half tide, high water. */
  tide?: TideStage
  /** Today's tidal range (m), low to high water. */
  tidalRange?: number
  /** A fringing reef offshore (reef.ts): true on any beach (implies one), null: none. */
  reef?: boolean | null
  /** A salt marsh behind the beach (tidalFlat.ts): true on any beach
   * (implies one), false or null: none. */
  saltMarsh?: boolean | null
  /** Beachrock ledges along the waterline: true implies a reef; null: none. */
  beachrock?: boolean | null

  weather?: Exclude<WeatherKind, 'storm'>
  /** Cloud genera and species, one layer each (at most 4); usually one per
   * étage. A genus listed twice is a second, higher deck (duplicatus). */
  clouds?: CloudGenus[]
  /** Cloud streets along the wind or wave bands across it. */
  cloudArrangement?: Force<'streets' | 'bands'>
  /** A waterspout (tornadic ones belong with storms). */
  waterspout?: Force<'fair-weather' | 'tornadic'>
  /** A shelf cloud at the storm's leading edge (storm days only). */
  shelfCloud?: boolean | null
  /** The Morning Glory roll cloud. */
  rollCloud?: boolean | null
  /** Lens clouds over the mountains or volcano (needs a landform). */
  lenticular?: boolean | null
  /** Noctilucent clouds (they only show at twilight with the sun 6–16° down). */
  noctilucent?: boolean | null
  /** Nacreous clouds (lit with the sun 1–6° down). */
  nacreous?: boolean | null
  /** Aircraft trails: null/false none, true at least one, a number that many (≤ 5). */
  contrails?: boolean | number | null
  /** The night sky's glow (nightGlow.ts): false/null takes each away. */
  milkyWay?: boolean | null
  airglow?: boolean | null
  zodiacalLight?: boolean | null
  /** Bortle class 1–4 instead of the place's (light pollution). */
  skyDarkness?: 1 | 2 | 3 | 4
  /** Shooting stars (meteors.ts): null/false none, true at least one, a
   * shower id (`"perseids"`) one of it, a number that many (≤ 3). */
  meteors?: boolean | string | number | null
  /** Northern or southern lights: true a display (at night, on a coast the
   * oval can reach), "strong" a big storm, false/null none. */
  aurora?: boolean | 'strong' | null
  /** Planets: false/null none; "venus" frames Venus at blue hour when it's up. */
  planets?: false | null | 'venus'
  storm?: Force<'thunderstorm' | 'squall'>
  rainbow?: boolean
  fog?: Force<'advection' | 'bank' | 'sea-smoke'>
  /** A marine-layer morning (overcast stratus or stratocumulus deck);
   * true forces it on any place and time, null/false never. */
  marineLayer?: boolean | null
  /** Desert dust haze: "harmattan" (or true) forces it, null/false none. */
  dust?: Force<'harmattan'>
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
  /** Offshore swell height (m) and period (s; its wavelength is capped at
   * 320 m, ~14 s): the open sea, the surf and the beach state follow. */
  swellHeight?: number
  swellPeriod?: number
  /** How far one sees through the sea haze (km). */
  visibilityKm?: number

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
const oneOf = (...options: readonly (string | number | boolean | null)[]): Check => (value, path) => {
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
    // Debug switches are params, not spec fields: the commonest slip in an --off patch.
    const hint = key === 'debug' && path === 'spec' ? '; debug switches go under params: {"params":{"debug":{…}}}' : ''
    if (check == null) fail(`${path}.${key}`, `is not a known field${hint} (known: ${Object.keys(fields).join(', ')})`)
    check(v, `${path}.${key}`)
  }
}

const TIMES = ['golden-hour', 'sun-on-horizon', 'blue-hour', 'daylight', 'midday', 'night']
const BIOMES = ['tropical', 'mediterranean', 'nordic', 'volcanic', 'desert']
const OCEANS = ['pacific', 'atlantic', 'indian', 'southern', 'arctic']
const GENERA = Object.keys(CLOUD_GENERA)
const PLANTS = ['palm', 'pandanus', 'stone-pine', 'olive', 'cypress', 'broadleaf', 'conifer', 'birch', 'acacia', 'eucalyptus', 'bush', 'grass']
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
  place: oneOf(...PLACES.map(p => p.id), ...REGION_IDS.filter(r => !PLACES.some(p => p.id === r))),
  biome: oneOf(...BIOMES),
  ocean: oneOf(...OCEANS),
  climate: oneOf(...CLIMATES),
  monsoon: boolean,
  ice: force('pack', 'bergs'),
  snow: (value, path) => {
    if (value === true || value === false || value === null) return
    number(value, path)
    if ((value as number) < 0 || (value as number) > 1) throw new Error(`${path}: a share of the ground, 0–1`)
  },
  seaIce: oneOf(true, false, null, 'fast', 'drift', 'forming', 'melting'),
  coast: oneOf('beach', 'open-sea', 'rock-shore', 'tidal-flat'),
  rockShore: oneOf(...ROCK_KINDS),
  composition: oneOf('shoreline', 'along-beach', 'framed', 'overlook'),
  sand: oneOf(...Object.keys(SAND_STYLES)),
  beachMaterial: oneOf(...BEACH_MATERIALS),
  beachState: oneOf(...BEACH_STATES),
  tide: oneOf('low', 'mid', 'high'),
  tidalRange: number,
  reef: oneOf(true, false, null),
  saltMarsh: oneOf(true, false, null),
  beachrock: oneOf(true, false, null),
  weather: oneOf('clear', 'cirrus', 'few', 'scattered', 'broken', 'overcast'),
  clouds: (value, path) => {
    listOf(oneOf(...GENERA))(value, path)
    if ((value as unknown[]).length > MAX_LAYERS) fail(path, `has at most ${MAX_LAYERS} layers`)
  },
  cloudArrangement: force('streets', 'bands'),
  waterspout: force('fair-weather', 'tornadic'),
  shelfCloud: oneOf(true, false, null),
  rollCloud: oneOf(true, false, null),
  lenticular: oneOf(true, false, null),
  noctilucent: oneOf(true, false, null),
  nacreous: oneOf(true, false, null),
  contrails: (value, path) => (typeof value === 'number' ? number(value, path) : oneOf(true, false, null)(value, path)),
  milkyWay: oneOf(true, false, null),
  airglow: oneOf(true, false, null),
  zodiacalLight: oneOf(true, false, null),
  skyDarkness: oneOf(1, 2, 3, 4),
  planets: oneOf(false, null, 'venus'),
  aurora: oneOf(true, false, null, 'strong'),
  meteors: (value, path) => (typeof value === 'number' ? number(value, path) : oneOf(true, false, null, ...SHOWERS.map(s => s.id))(value, path)),
  storm: force('thunderstorm', 'squall'),
  rainbow: boolean,
  fog: force('advection', 'bank', 'sea-smoke'),
  marineLayer: oneOf(true, false, null),
  dust: force('harmattan'),
  lighthouse: force('point', 'rock'),
  landform: force('range', 'strato', 'shield'),
  islands: force('skerries', 'rocky', 'cay', 'karst', 'high'),
  colony: force('gannet', 'puffin', 'tropical', 'penguin'),
  pinnipeds: force('seal', 'sea-lion', 'fur-seal', 'elephant-seal'),
  colonySite: oneOf('island', 'mainland'),
  haulOut: oneOf('rock', 'beach'),
  wind: number,
  swellHeight: number,
  swellPeriod: number,
  visibilityKm: number,
  camera: object({ heightM: number, focalLengthMm: number, horizonFraction: number, rollDeg: number }),
  props: object({
    marine: force('dolphin', 'orca', 'humpback', 'swordfish'),
    mangroves: force('rhizophora', 'avicennia'),
    birds: boolean,
    migratory: force('goose', 'duck', 'flamingo'),
    ships: (value, path) =>
      typeof value === 'boolean' ? undefined : listOf(oneOf('sloop', 'catamaran', 'dhow', 'motor-yacht', 'trawler', 'container-ship', 'tanker', 'dinghy', 'expedition-ship', 'icebreaker'))(value, path),
    rocks: boolean,
    saltMarsh: boolean,
    seaStacks: boolean,
    stones: boolean,
    beachrock: boolean,
    rockEdge: boolean,
    vegetation: listOf(oneOf(...PLANTS)),
    phenology: boolean,
    leafLitter: boolean,
    bloom: (value, path) => (typeof value === 'boolean' ? undefined : listOf(oneOf(...BLOOM_KINDS))(value, path)),
    eucalyptus: boolean,
    moss: boolean,
    shoreWeed: boolean,
    heath: (value, path) => (typeof value === 'boolean' ? undefined : oneOf(...HEATH_STAGES)(value, path)),
    iceFoot: boolean,
    seaIce: boolean,
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
        lizards: number,
        crocodile: oneOf(null, 'saltwater', 'american', 'nile', 'west-african'),
        crocodiles: number,
        hippos: number
      },
      true
    )
  }),
  // Free-form; it's merged as it is.
  params: (value, path) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(path, 'must be an object')
    const debug = (value as { debug?: unknown }).debug
    if (debug !== undefined) checkDebug(debug, `${path}.debug`)
  }
})

/** params.debug is checked: a typo there would quietly do nothing. */
function checkDebug(value: unknown, path: string): void {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(path, 'must be an object')
  const d = value as Record<string, unknown>
  const checks: Record<string, Check> = {
    terrainGrid: (v, p) => {
      if (typeof v !== 'number' || v < 0.25 || v > 4) fail(p, 'must be a number in 0.25–4')
    },
    props: boolean,
    markers: (v, p) => {
      if (!Array.isArray(v)) fail(p, 'must be a list')
      for (const m of v as unknown[]) {
        if (typeof m !== 'string' || !((DEBUG_MARKERS as readonly string[]).includes(m) || m.startsWith('props:'))) fail(p, `has ${JSON.stringify(m)}: use ${DEBUG_MARKERS.join(', ')} or props:KIND`)
      }
    },
    passes: (v, p) => {
      if (v === null || typeof v !== 'object' || Array.isArray(v)) fail(p, 'must be an object')
      for (const [k, b] of Object.entries(v as object)) {
        if (!(DEBUG_PASSES as readonly string[]).includes(k)) fail(`${p}.${k}`, `is not a pass: ${DEBUG_PASSES.join(', ')}`)
        boolean(b, `${p}.${k}`)
      }
    },
    exposure: number,
    cloudShade: (v, p) => {
      if (typeof v !== 'number' || v < 0 || v > 1) fail(p, 'must be a number in 0–1')
    },
    shadeView: boolean,
    terrainView: oneOf(...TERRAIN_VIEWS),
    water: boolean,
    terrainProbe: (v, p) => {
      const o = v as Record<string, unknown>
      if (o === null || typeof o !== 'object' || Array.isArray(o)) fail(p, 'must be {terms, at?, every?}')
      for (const k of Object.keys(o)) if (!['terms', 'at', 'every'].includes(k)) fail(`${p}.${k}`, 'is not a field: terms, at, every')
      if (!Array.isArray(o.terms) || o.terms.length < 1 || o.terms.length > 12) fail(`${p}.terms`, 'must be a list of 1–12 terms')
      for (const t of o.terms as unknown[]) if (!(TERRAIN_TERM_NAMES as readonly unknown[]).includes(t)) fail(`${p}.terms`, `has ${JSON.stringify(t)}: use ${TERRAIN_TERM_NAMES.join(', ')}`)
      if (o.at === undefined && o.every === undefined) fail(p, 'needs at (points) or every (a grid), or both')
      if (o.every !== undefined && (typeof o.every !== 'number' || !Number.isInteger(o.every) || o.every < 1 || o.every > 64)) fail(`${p}.every`, 'must be a whole number of px, 1–64')
      if (o.at !== undefined) {
        if (!Array.isArray(o.at)) fail(`${p}.at`, 'must be a list of [x, y] fractions or {world: [x, y, z]}')
        ;(o.at as unknown[]).forEach((e, i) => {
          const ok = Array.isArray(e)
            ? e.length === 2 && e.every(x => typeof x === 'number' && x >= 0 && x <= 1)
            : e !== null && typeof e === 'object' && Object.keys(e).length === 1 && Array.isArray((e as { world?: unknown }).world) && ((e as { world: unknown[] }).world).length === 3 && ((e as { world: unknown[] }).world).every(x => typeof x === 'number' && Number.isFinite(x))
          if (!ok) fail(`${p}.at[${i}]`, 'must be [x, y] with each in 0–1, or {world: [x, y, z]} in metres')
        })
      }
    },
    oceanView: oneOf(...OCEAN_VIEWS),
    probe: (v, p) => {
      if (!Array.isArray(v)) fail(p, 'must be a list of [x, y] fractions or {az, el}')
      ;(v as unknown[]).forEach((e, i) => {
        const at = `${p}[${i}]`
        if (Array.isArray(e)) {
          if (e.length !== 2 || !e.every(x => typeof x === 'number' && x >= 0 && x <= 1)) fail(at, 'must be [x, y] with each in 0–1')
        } else if (e !== null && typeof e === 'object') {
          const o = e as Record<string, unknown>
          const point = o.world ?? o.mirror
          if (point !== undefined) {
            if (Object.keys(o).length !== 1 || !Array.isArray(point) || point.length !== 3 || !point.every(x => typeof x === 'number' && Number.isFinite(x)))
              fail(at, 'must be {world: [x, y, z]} or {mirror: [x, y, z]} in metres')
          } else if (typeof o.az !== 'number' || typeof o.el !== 'number' || Object.keys(o).length !== 2) fail(at, 'must be {az, el} in degrees')
        } else fail(at, 'must be [x, y], {az, el}, {world} or {mirror}')
      })
    },
    cubeProbe: (v, p) => {
      if (!Array.isArray(v)) fail(p, 'must be a list of {az, el}')
      ;(v as unknown[]).forEach((e, i) => {
        const o = e as Record<string, unknown>
        const keys = o === null || typeof o !== 'object' ? [] : Object.keys(o)
        if (typeof o?.az !== 'number' || typeof o?.el !== 'number' || keys.some(k => !['az', 'el', 'lod'].includes(k)) || (o.lod !== undefined && (typeof o.lod !== 'number' || o.lod < 0 || o.lod > 10)))
          fail(`${p}[${i}]`, 'must be {az, el} in degrees, with an optional lod 0–10')
      })
    },
    cubeProbeLod: (v, p) => {
      if (typeof v !== 'number' || v < 0 || v > 10) fail(p, 'must be a number 0–10')
    },
    probeHalf: (v, p) => {
      if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 20) fail(p, 'must be an integer 0–20')
    },
    probeLine: (v, path) => {
      const lines = Array.isArray(v) ? v : [v]
      if (lines.length === 0 || lines.length > 12) fail(path, 'must be a line or a list of 1–12')
      lines.forEach((l, i) => checkLine(l, Array.isArray(v) ? `${path}[${i}]` : path))
    }
  }
  function checkLine(v: unknown, p: string): void {
    if (v === null || typeof v !== 'object' || Array.isArray(v)) fail(p, 'must be {az, el, step?}')
    const o = v as Record<string, unknown>
    const range = (x: unknown): boolean => Array.isArray(x) && x.length === 2 && x.every(n => typeof n === 'number')
    for (const k of Object.keys(o)) if (!['az', 'el', 'step'].includes(k)) fail(`${p}.${k}`, 'is not a line field: az, el, step')
    for (const k of ['az', 'el']) if (typeof o[k] !== 'number' && !range(o[k])) fail(`${p}.${k}`, 'must be degrees or [from, to]')
    if (range(o.az) === range(o.el)) fail(p, 'needs exactly one of az, el as a [from, to] range')
    if (o.step !== undefined && (typeof o.step !== 'number' || o.step < 0.005 || o.step > 5)) fail(`${p}.step`, 'must be 0.005–5 degrees')
  }
  for (const [k, v] of Object.entries(d)) {
    if (checks[k] == null) fail(`${path}.${k}`, `is not a debug field: ${Object.keys(checks).join(', ')}`)
    checks[k](v, `${path}.${k}`)
  }
}

/** Check a parsed JSON value is a SceneSpec; throws naming the bad field. */
export function parseSceneSpec(value: unknown): SceneSpec {
  if (typeof value === 'string') value = JSON.parse(value)
  SPEC(value, 'spec')
  return value as SceneSpec
}
