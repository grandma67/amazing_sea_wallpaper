import type { Random } from './random'

// Cloud formations, after the WMO International Cloud Atlas: ten genera in
// three étages (low < 2 km, middle 2–7 km, high 5–13 km), plus towering
// cumulus as its own entry because it looks so different from fair-weather
// cumulus. Each genus becomes one of takram's cloud layers; a sky combines at
// most one genus per étage.
//
// What the sky over the sea tends to look like:
// - Trade-wind cumulus: rows of small, flat-based cumulus over warm tropical
//   water, bases ~600 m; congestus towers on unsettled afternoons.
// - Marine stratocumulus: the most common cloud over the world's oceans —
//   wide lumpy decks a few hundred metres thick over cool water (west
//   coasts, high latitudes), often with gaps of blue.
// - Stratus and sea fog: low grey sheets on cool coasts.
// - Altocumulus "mackerel" bands and altostratus veils ahead of fronts;
//   cirrus "mares' tails" and cirrocumulus ripples high above.
// - Nimbostratus: the thick, featureless grey of a rainy day.
// - Cumulonimbus: thunderstorms, tops reaching the tropopause (see storms).

export type CloudGenus =
  | 'cumulus'
  | 'cumulus-humilis'
  | 'cumulus-congestus'
  | 'cumulus-fractus'
  | 'cumulonimbus'
  | 'cumulonimbus-capillatus'
  | 'stratocumulus'
  | 'stratocumulus-castellanus'
  | 'stratus'
  | 'stratus-fractus'
  | 'nimbostratus'
  | 'altocumulus'
  | 'altocumulus-castellanus'
  | 'altocumulus-floccus'
  | 'altostratus'
  | 'altostratus-opacus'
  | 'cirrus'
  | 'cirrus-spissatus'
  | 'cirrocumulus'
  | 'cirrostratus'

export type Etage = 'low' | 'middle' | 'high'

/** The ten WMO genera. Each entry of CLOUD_GENERA is one of them, or a
 * species of one ('cumulus-congestus'), and its key starts with the genus. */
export type WmoGenus =
  | 'cumulus'
  | 'cumulonimbus'
  | 'stratocumulus'
  | 'stratus'
  | 'nimbostratus'
  | 'altocumulus'
  | 'altostratus'
  | 'cirrus'
  | 'cirrocumulus'
  | 'cirrostratus'

export interface CloudGenusSpec {
  /** The WMO genus this entry belongs to: code asking "is this a
   * thunderstorm cloud?" matches on it, not on the key. */
  genus: WmoGenus
  etage: Etage
  /** Base altitude and thickness (m). */
  altitude: number
  height: number
  densityScale: number
  /** How much the 3D shape noise erodes the layer (0 = flat sheet). */
  shapeAmount: number
  shapeDetailAmount: number
  /** < 1 spreads the layer over more of the sky, > 1 breaks it into cells. */
  weatherExponent: number
  /** Rounds tops: lower = rounder, cauliflower-like. */
  shapeAlteringBias: number
  /** Softness of cloud edges in the coverage map. */
  coverageFilterWidth: number
  /** Density with normalised height h: exp·e^(k·h) + linear·h + constant. */
  densityProfile: [number, number, number, number]
  /** Fraction of direct sun that gets through where this genus is present. */
  sunVisibility: [number, number]
  /** Scale of the cells when this is the sky's main cloud (1 = takram's
   * default); larger = smaller, more numerous cells. */
  cellScale?: number
  /** Short name for titles (only notable skies get one). */
  title?: string
  /** Weather-map channel to read when another layer of the same étage
   * already reads the étage's own (see layerChannels). */
  spareChannel?: WeatherChannel
}

export type WeatherChannel = 'r' | 'g' | 'b' | 'a'

export const CLOUD_GENERA: Record<CloudGenus, CloudGenusSpec> = {
  cumulus: {
    genus: 'cumulus',
    etage: 'low',
    altitude: 700,
    height: 900,
    densityScale: 0.2,
    shapeAmount: 1,
    shapeDetailAmount: 1,
    weatherExponent: 1,
    shapeAlteringBias: 0.35,
    coverageFilterWidth: 0.6,
    densityProfile: [0, 0, 0.75, 0.25],
    sunVisibility: [0.9, 1]
  },
  // Fair-weather cumulus, wider than tall: trade-wind mornings.
  'cumulus-humilis': {
    genus: 'cumulus',
    etage: 'low',
    altitude: 600,
    height: 450,
    densityScale: 0.2,
    shapeAmount: 1,
    shapeDetailAmount: 1,
    weatherExponent: 1.25,
    shapeAlteringBias: 0.55,
    coverageFilterWidth: 0.55,
    densityProfile: [0, 0, 0.6, 0.4],
    sunVisibility: [0.92, 1],
    cellScale: 1.5
  },
  // Ragged torn scraps on windy days and after showers.
  'cumulus-fractus': {
    genus: 'cumulus',
    etage: 'low',
    altitude: 550,
    height: 350,
    densityScale: 0.1,
    shapeAmount: 1,
    shapeDetailAmount: 1,
    weatherExponent: 1.5,
    shapeAlteringBias: 0.6,
    coverageFilterWidth: 0.4,
    densityProfile: [0, 0, 0.3, 0.7],
    sunVisibility: [0.85, 1],
    spareChannel: 'a'
  },
  'cumulus-congestus': {
    genus: 'cumulus',
    etage: 'low',
    altitude: 800,
    height: 3200,
    densityScale: 0.22,
    shapeAmount: 1,
    shapeDetailAmount: 1,
    weatherExponent: 1.4,
    shapeAlteringBias: 0.3,
    coverageFilterWidth: 0.5,
    densityProfile: [0, 0, 0.75, 0.25],
    sunVisibility: [0.75, 1],
    title: 'towering cumulus'
  },
  cumulonimbus: {
    genus: 'cumulonimbus',
    etage: 'low',
    altitude: 600,
    height: 9500,
    densityScale: 0.3,
    shapeAmount: 1,
    shapeDetailAmount: 1,
    weatherExponent: 1.6,
    shapeAlteringBias: 0.25,
    coverageFilterWidth: 0.45,
    densityProfile: [0, 0, 0.6, 0.4],
    sunVisibility: [0.15, 0.6],
    title: 'thunderstorm'
  },
  // Calvus: the smooth-topped storm cloud. Capillatus: its top glaciated
  // into fibrous cloud, flatter and spreading; the anvil itself is a
  // cirrus-spissatus layer at the tropopause (see stormFormations).
  'cumulonimbus-capillatus': {
    genus: 'cumulonimbus',
    etage: 'low',
    altitude: 600,
    height: 9500,
    densityScale: 0.3,
    shapeAmount: 1,
    shapeDetailAmount: 1,
    weatherExponent: 1.6,
    shapeAlteringBias: 0.45,
    coverageFilterWidth: 0.45,
    densityProfile: [0, 0, 0.4, 0.6],
    sunVisibility: [0.15, 0.6],
    title: 'thunderstorm'
  },
  stratocumulus: {
    genus: 'stratocumulus',
    etage: 'low',
    altitude: 650,
    height: 500,
    densityScale: 0.25,
    shapeAmount: 0.85,
    shapeDetailAmount: 0.8,
    weatherExponent: 0.55,
    shapeAlteringBias: 0.5,
    coverageFilterWidth: 0.6,
    densityProfile: [0, 0, 0.5, 0.5],
    sunVisibility: [0.6, 1]
  },
  // Turrets rising from the deck on unsettled cool days.
  'stratocumulus-castellanus': {
    genus: 'stratocumulus',
    etage: 'low',
    altitude: 650,
    height: 950,
    densityScale: 0.25,
    shapeAmount: 0.9,
    shapeDetailAmount: 0.8,
    weatherExponent: 0.65,
    shapeAlteringBias: 0.2,
    coverageFilterWidth: 0.55,
    densityProfile: [0, 0, 0.65, 0.35],
    sunVisibility: [0.6, 1],
    title: 'turreted clouds'
  },
  stratus: {
    genus: 'stratus',
    etage: 'low',
    altitude: 350,
    height: 450,
    densityScale: 0.12,
    shapeAmount: 0.3,
    shapeDetailAmount: 0.4,
    weatherExponent: 0.3,
    shapeAlteringBias: 0.6,
    coverageFilterWidth: 0.8,
    densityProfile: [0, 0, 0, 1],
    sunVisibility: [0, 0.05]
  },
  // Scud (pannus): dark scraps drifting under rain cloud.
  'stratus-fractus': {
    genus: 'stratus',
    etage: 'low',
    altitude: 300,
    height: 250,
    densityScale: 0.18,
    shapeAmount: 1,
    shapeDetailAmount: 1,
    weatherExponent: 1.2,
    shapeAlteringBias: 0.6,
    coverageFilterWidth: 0.45,
    densityProfile: [0, 0, 0.3, 0.7],
    sunVisibility: [0.5, 0.9],
    spareChannel: 'a'
  },
  nimbostratus: {
    genus: 'nimbostratus',
    etage: 'low',
    altitude: 600,
    height: 2600,
    densityScale: 0.25,
    shapeAmount: 0.35,
    shapeDetailAmount: 0.6,
    weatherExponent: 0.2,
    shapeAlteringBias: 0.6,
    coverageFilterWidth: 0.8,
    densityProfile: [0, 0, 0.3, 0.7],
    sunVisibility: [0, 0.002]
  },
  altocumulus: {
    genus: 'altocumulus',
    etage: 'middle',
    altitude: 3200,
    height: 350,
    densityScale: 0.08,
    shapeAmount: 1,
    shapeDetailAmount: 1,
    weatherExponent: 1.7,
    shapeAlteringBias: 0.4,
    coverageFilterWidth: 0.5,
    densityProfile: [0, 0, 0.5, 0.5],
    sunVisibility: [0.8, 1],
    title: 'mackerel sky'
  },
  // Turrets on a mid-level line, a sign of thunder later in the day.
  'altocumulus-castellanus': {
    genus: 'altocumulus',
    etage: 'middle',
    altitude: 3200,
    height: 800,
    densityScale: 0.09,
    shapeAmount: 1,
    shapeDetailAmount: 1,
    weatherExponent: 1.6,
    shapeAlteringBias: 0.25,
    coverageFilterWidth: 0.5,
    densityProfile: [0, 0, 0.7, 0.3],
    sunVisibility: [0.75, 1],
    title: 'turreted clouds'
  },
  // Small tufts with ragged, fraying bases.
  'altocumulus-floccus': {
    genus: 'altocumulus',
    etage: 'middle',
    altitude: 3400,
    height: 550,
    densityScale: 0.07,
    shapeAmount: 1,
    shapeDetailAmount: 1,
    weatherExponent: 1.9,
    shapeAlteringBias: 0.3,
    coverageFilterWidth: 0.65,
    densityProfile: [0, 0, 0.85, 0.15],
    sunVisibility: [0.8, 1]
  },
  // Translucidus: the sun as if through ground glass.
  altostratus: {
    genus: 'altostratus',
    etage: 'middle',
    altitude: 3800,
    height: 900,
    densityScale: 0.035,
    shapeAmount: 0.3,
    shapeDetailAmount: 0.3,
    weatherExponent: 0.3,
    shapeAlteringBias: 0.5,
    coverageFilterWidth: 0.9,
    densityProfile: [0, 0, 0, 1],
    sunVisibility: [0.3, 0.6]
  },
  // Opacus: thick enough to hide the sun; flat, even light.
  'altostratus-opacus': {
    genus: 'altostratus',
    etage: 'middle',
    altitude: 3500,
    height: 1500,
    densityScale: 0.08,
    shapeAmount: 0.3,
    shapeDetailAmount: 0.3,
    weatherExponent: 0.2,
    shapeAlteringBias: 0.5,
    coverageFilterWidth: 0.9,
    densityProfile: [0, 0, 0, 1],
    sunVisibility: [0.02, 0.1]
  },
  cirrus: {
    genus: 'cirrus',
    etage: 'high',
    altitude: 7500,
    height: 500,
    densityScale: 0.003,
    shapeAmount: 0.4,
    shapeDetailAmount: 0,
    weatherExponent: 1,
    shapeAlteringBias: 0.35,
    coverageFilterWidth: 0.5,
    densityProfile: [0, 0, 0.75, 0.25],
    sunVisibility: [0.95, 1]
  },
  // Dense high patches, greyish against the sun: often an old anvil.
  'cirrus-spissatus': {
    genus: 'cirrus',
    etage: 'high',
    altitude: 8800,
    height: 900,
    densityScale: 0.03,
    shapeAmount: 0.6,
    shapeDetailAmount: 0.2,
    weatherExponent: 1.2,
    shapeAlteringBias: 0.4,
    coverageFilterWidth: 0.5,
    densityProfile: [0, 0, 0.75, 0.25],
    sunVisibility: [0.4, 0.85],
    spareChannel: 'b'
  },
  cirrocumulus: {
    genus: 'cirrocumulus',
    etage: 'high',
    altitude: 7000,
    height: 300,
    densityScale: 0.012,
    shapeAmount: 1,
    shapeDetailAmount: 1,
    weatherExponent: 1,
    shapeAlteringBias: 0.4,
    coverageFilterWidth: 0.4,
    densityProfile: [0, 0, 0.5, 0.5],
    sunVisibility: [0.9, 1],
    cellScale: 3,
    title: 'cirrocumulus ripples'
  },
  cirrostratus: {
    genus: 'cirrostratus',
    etage: 'high',
    altitude: 8500,
    height: 700,
    densityScale: 0.0015,
    shapeAmount: 0.1,
    shapeDetailAmount: 0,
    weatherExponent: 0.3,
    shapeAlteringBias: 0.5,
    coverageFilterWidth: 0.9,
    densityProfile: [0, 0, 0, 1],
    sunVisibility: [0.85, 0.95]
  }
}

/** Base altitude (m) of the sky's first cloud of a genus, or of the genus
 * itself if the sky has none (storm effects hang from the Cb base). */
export function cloudBase(formations: readonly CloudGenus[], genus: WmoGenus): number {
  const key = formations.find(f => CLOUD_GENERA[f].genus === genus) ?? (genus as CloudGenus)
  return CLOUD_GENERA[key].altitude
}

type Weights = readonly (readonly [CloudGenus | null, number])[]

export type CloudAmount = 'clear' | 'cirrus' | 'few' | 'scattered' | 'broken' | 'overcast'

/** What the sky's clouds depend on besides their amount. */
export interface CloudContext {
  /** Cool coasts lean toward stratiform cloud. */
  cool: boolean
  /** Trade-wind seas lean toward cumulus. */
  tropical: boolean
  /** Mediterranean or tropical coast in its summer: warm, humid air aloft. */
  warmSummer: boolean
  /** Wind at the surface (m/s). */
  windSpeed: number
  /** Before noon, sun up. */
  morning: boolean
}

/** The most layers takram draws (one per weather-map channel). */
export const MAX_LAYERS = 4

/**
 * Pick the genera that make up a sky with the given cloud amount. Cool coasts
 * lean toward stratiform cloud, tropical ones toward cumulus.
 */
export function pickFormations(rng: Random, amount: CloudAmount, climate: Pick<CloudContext, 'cool' | 'tropical'>): CloudGenus[] {
  const k = (w: number, cond: boolean, factor: number): number => (cond ? w * factor : w)
  const tables: Record<typeof amount, { low: Weights; middle: Weights; high: Weights }> = {
    clear: { low: [[null, 1]], middle: [[null, 1]], high: [[null, 1]] },
    cirrus: {
      low: [[null, 1]],
      middle: [[null, 1]],
      high: [
        ['cirrus', 5],
        ['cirrocumulus', 2],
        ['cirrostratus', 2]
      ]
    },
    few: {
      low: [['cumulus', 1]],
      middle: [[null, 1]],
      high: [
        [null, 6],
        ['cirrus', 4]
      ]
    },
    scattered: {
      low: [
        ['cumulus', k(4, climate.tropical, 2)],
        ['stratocumulus', k(2, climate.cool, 2)],
        [null, 1]
      ],
      middle: [
        [null, 6],
        ['altocumulus', 4]
      ],
      high: [
        [null, 6],
        ['cirrus', 3],
        ['cirrocumulus', 1]
      ]
    },
    broken: {
      low: [
        ['stratocumulus', k(3, climate.cool, 2)],
        ['cumulus-congestus', k(2, climate.tropical, 2)],
        ['cumulus', 1]
      ],
      middle: [
        [null, 5],
        ['altocumulus', 3],
        ['altostratus', 2]
      ],
      high: [
        [null, 7],
        ['cirrus', 2],
        ['cirrostratus', 1]
      ]
    },
    overcast: {
      low: [
        ['stratocumulus', 3],
        ['stratus', k(2, climate.cool, 2)],
        ['nimbostratus', 1]
      ],
      middle: [
        [null, 1],
        ['altostratus', 1]
      ],
      high: [[null, 1]]
    }
  }
  const table = tables[amount]
  const picked = [rng.weighted(table.low), rng.weighted(table.middle), rng.weighted(table.high)]
  const genera = picked.filter((g): g is CloudGenus => g != null)
  // Nothing drawn in any étage: a cloudy day still needs some cloud.
  if (genera.length === 0 && amount !== 'clear') return [table.low[0][0] ?? 'cumulus']
  return genera
}

/**
 * Refine the genera from pickFormations into species, and add the extra
 * layers some skies have (on its own stream, so days whose sky stays the
 * same keep their draws):
 * - few: humilis on tropical (trade-wind) and morning skies;
 * - scattered and broken: ragged fractus under the cumulus when it's windy
 *   (torn by the wind, or left over from showers);
 * - Ac castellanus or floccus on warm summer mornings, Sc castellanus on
 *   unsettled cool days;
 * - overcast: altostratus thick enough to hide the sun (opacus), and scud
 *   (stratus fractus) under nimbostratus;
 * - broken: some cirrus thickened into spissatus;
 * - broken and overcast: sometimes a second deck of the same genus
 *   (duplicatus), 300–800 m higher (see duplicatusLiftM).
 */
export function pickSpecies(
  rng: Random,
  genera: CloudGenus[],
  amount: CloudAmount,
  context: CloudContext
): { formations: CloudGenus[]; duplicatusLiftM: number | null } {
  const out = [...genera]
  const replace = (from: CloudGenus, to: CloudGenus): void => {
    const i = out.indexOf(from)
    if (i >= 0) out[i] = to
  }
  const add = (genus: CloudGenus): void => {
    if (out.length < MAX_LAYERS) out.push(genus)
  }
  const windy = context.windSpeed >= 8
  // Draw everything up front so each rule's odds don't depend on the others.
  const r = Array.from({ length: 8 }, () => rng.float())

  if (amount === 'few' && r[0] < (context.tropical || context.morning ? 0.75 : 0.1)) replace('cumulus', 'cumulus-humilis')
  const cumuliform = out.some(g => g === 'cumulus' || g === 'cumulus-congestus' || g === 'cumulus-humilis')
  if (windy && ((amount === 'scattered' && r[1] < 0.5) || (amount === 'broken' && cumuliform && r[1] < 0.35))) add('cumulus-fractus')

  if (context.warmSummer && context.morning && (amount === 'scattered' || amount === 'broken')) {
    const kind: CloudGenus = r[3] < 0.5 ? 'altocumulus-castellanus' : 'altocumulus-floccus'
    if (out.includes('altocumulus') && r[2] < 0.6) replace('altocumulus', kind)
    else if (!out.some(g => CLOUD_GENERA[g].etage === 'middle') && r[2] < 0.2) add(kind)
  }
  if (context.cool && context.windSpeed >= 6 && (amount === 'broken' || amount === 'overcast') && r[4] < 0.35)
    replace('stratocumulus', 'stratocumulus-castellanus')

  if (amount === 'overcast') replace('altostratus', 'altostratus-opacus')
  if (amount === 'overcast' && out.includes('nimbostratus') && r[5] < 0.6) add('stratus-fractus')
  if (amount === 'broken' && r[6] < 0.3) replace('cirrus', 'cirrus-spissatus')

  let duplicatusLiftM: number | null = null
  if ((amount === 'broken' || amount === 'overcast') && r[7] < 0.15 && out.length < MAX_LAYERS) {
    const weights: [CloudGenus, number][] = out
      .filter(g => DUPLICATUS.includes(CLOUD_GENERA[g].genus) && !out.slice(out.indexOf(g) + 1).includes(g))
      .map(g => [g, CLOUD_GENERA[g].genus === 'altocumulus' || CLOUD_GENERA[g].genus === 'stratocumulus' ? 3 : 1])
    if (weights.length > 0) {
      out.push(rng.weighted(weights))
      duplicatusLiftM = rng.range(300, 800)
    }
  }
  return { formations: out, duplicatusLiftM }
}

/** Genera the atlas allows in two decks (duplicatus). */
const DUPLICATUS: WmoGenus[] = ['cirrus', 'cirrostratus', 'altocumulus', 'altostratus', 'stratocumulus']

/**
 * The weather-map channel each layer reads. Each étage has its own (low r,
 * middle g, high b) so the layers don't line up; a second layer of an étage
 * (fractus under cumulus, scud, duplicatus) reads its spare channel, or the
 * first unused one, so it doesn't mirror the first layer's holes.
 */
export function layerChannels(formations: readonly CloudGenus[]): WeatherChannel[] {
  const own: Record<Etage, WeatherChannel> = { low: 'r', middle: 'g', high: 'b' }
  const used = new Set<WeatherChannel>()
  // The étages' own channels go first, so a spare never takes one an étage needs.
  const channels: (WeatherChannel | null)[] = formations.map(g => {
    const c = own[CLOUD_GENERA[g].etage]
    if (used.has(c)) return null
    used.add(c)
    return c
  })
  return channels.map((c, i) => {
    if (c != null) return c
    const spare = CLOUD_GENERA[formations[i]].spareChannel
    const free = [spare, 'a', 'g', 'r', 'b'].find((x): x is WeatherChannel => x != null && !used.has(x as WeatherChannel))
    if (free == null) throw new Error(`no weather channel left for ${formations[i]} in ${formations.join(', ')}`)
    used.add(free)
    return free
  })
}
