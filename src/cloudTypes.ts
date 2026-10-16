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
  | 'cumulus-congestus'
  | 'cumulonimbus'
  | 'stratocumulus'
  | 'stratus'
  | 'nimbostratus'
  | 'altocumulus'
  | 'altostratus'
  | 'cirrus'
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
}

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

/**
 * Pick the genera that make up a sky with the given cloud amount. Cool coasts
 * lean toward stratiform cloud, tropical ones toward cumulus.
 */
export function pickFormations(
  rng: Random,
  amount: 'clear' | 'cirrus' | 'few' | 'scattered' | 'broken' | 'overcast',
  climate: { cool: boolean; tropical: boolean }
): CloudGenus[] {
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
