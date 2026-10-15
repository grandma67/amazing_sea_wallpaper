import type { Biome, WaterStyle } from './biome'
import type { Random } from './random'

// Earth's five oceans, and what sets them apart for a picture of the sea:
//
// - Pacific: the largest and deepest. Storms anywhere in it (and in the
//   Southern Ocean) send long-period groundswell across thousands of km, so
//   its coasts see long, regular, powerful lines of swell. Coral atolls with
//   turquoise lagoons in the tropics; the volcanic Ring of Fire around it.
// - Atlantic: saltier; the plankton-rich north is green-grey and stormy in
//   winter, the Caribbean and Canaries clear blue. The Mediterranean is one
//   of its marginal seas. Swell moderate, from mid-latitude storms.
// - Indian: the warmest ocean, mostly tropical, clear deep blue. Its seas are
//   ruled by the monsoon: rough from June to September (south-west monsoon),
//   calm in the north-east monsoon of winter.
// - Southern: circles Antarctica with no land to stop the westerlies — the
//   Roaring Forties and Furious Fifties have the strongest sustained winds and
//   the biggest waves on Earth. Cold, dark blue-grey water; flat-topped
//   tabular icebergs calved from the ice shelves drift far north.
// - Arctic: the smallest and shallowest, mostly covered by sea ice (most in
//   March, least in September). Pack-ice floes damp the waves, so open leads
//   are calm and glassy; glaciers of Greenland and Svalbard calve irregular,
//   peaked icebergs. Cold, dark green-grey water.

export type OceanName = 'pacific' | 'atlantic' | 'indian' | 'southern' | 'arctic'

export interface OceanBasin {
  name: OceanName
  label: string
  /** Latitude range for the scene (degrees, hemisphere ignored). */
  latitude: [number, number]
  /** Multipliers on the day's wind and swell. */
  wind: number
  swellHeight: number
  swellWavelength: number
  /** Replaces the biome's water where the ocean dictates it (polar seas). */
  water?: WaterStyle
}

const POLAR_WATER: WaterStyle = {
  name: 'polar',
  deep: [0.003, 0.013, 0.017],
  scatter: [0.02, 0.09, 0.085],
  absorption: [0.55, 0.15, 0.16]
}

export const OCEANS: Record<OceanName, OceanBasin> = {
  pacific: {
    name: 'pacific',
    label: 'Pacific',
    latitude: [5, 50],
    wind: 1,
    swellHeight: 1.25,
    swellWavelength: 1.35
  },
  atlantic: {
    name: 'atlantic',
    label: 'Atlantic',
    latitude: [10, 60],
    wind: 1,
    swellHeight: 1,
    swellWavelength: 1
  },
  indian: {
    name: 'indian',
    label: 'Indian Ocean',
    latitude: [5, 35],
    wind: 1,
    swellHeight: 1,
    swellWavelength: 1.1
  },
  southern: {
    name: 'southern',
    label: 'Southern Ocean',
    latitude: [48, 62],
    wind: 1.35,
    swellHeight: 1.7,
    swellWavelength: 1.45,
    water: POLAR_WATER
  },
  arctic: {
    name: 'arctic',
    label: 'Arctic',
    latitude: [66, 78],
    wind: 0.85,
    swellHeight: 0.35,
    swellWavelength: 0.8,
    water: POLAR_WATER
  }
}

/** Which oceans each kind of coast is found on (relative weights). */
const OCEANS_BY_BIOME: Record<Biome['name'], readonly (readonly [OceanName, number])[]> = {
  tropical: [
    ['pacific', 4],
    ['indian', 3],
    ['atlantic', 2]
  ],
  // The Mediterranean itself, California and Chile, south-west Australia.
  mediterranean: [
    ['atlantic', 5],
    ['pacific', 2],
    ['indian', 1]
  ],
  // Norway and Scotland, Svalbard and Greenland, Alaska, Tierra del Fuego.
  nordic: [
    ['atlantic', 4],
    ['arctic', 3],
    ['pacific', 2],
    ['southern', 1]
  ],
  // Hawaii and Japan, Iceland and the Canaries, Réunion, Heard Island.
  volcanic: [
    ['pacific', 4],
    ['atlantic', 3],
    ['indian', 1],
    ['southern', 1]
  ],
  // Arabia, Namibia and the Sahara coast, the Atacama.
  desert: [
    ['indian', 3],
    ['atlantic', 2],
    ['pacific', 2]
  ]
}

export interface IceParams {
  /** Pack-ice floes on the water (Arctic): fraction of the sea covered. */
  packIce: number
  /** Icebergs in view. */
  bergs: number
  bergKind: 'tabular' | 'glacier'
}

export interface OceanChoice {
  basin: OceanBasin
  /** Monsoon season on the Indian Ocean. */
  monsoon: boolean
  ice: IceParams | null
}

/** Pick the day's ocean for this coast; `month` is 1–12. `force` sets the
 * ocean (scene specs) without shifting the stream. */
export function pickOcean(rng: Random, biome: Biome, month: number, force?: OceanName): OceanChoice {
  const drawn = rng.weighted(OCEANS_BY_BIOME[biome.name])
  const basin = OCEANS[force ?? drawn]
  const monsoon = basin.name === 'indian' && month >= 6 && month <= 9
  let ice: IceParams | null = null
  if (basin.name === 'arctic') {
    // Sea ice peaks in March and is least in September.
    const winter = month <= 5 || month === 12
    const packIce = rng.chance(winter ? 0.8 : 0.45) ? rng.range(0.25, 0.75) : 0
    ice = { packIce, bergs: rng.chance(0.6) ? rng.int(1, 3) : 0, bergKind: 'glacier' }
  } else if (basin.name === 'southern' && rng.chance(0.55)) {
    ice = { packIce: 0, bergs: rng.int(1, 3), bergKind: 'tabular' }
  }
  if (ice != null && ice.packIce === 0 && ice.bergs === 0) ice = null
  return { basin, monsoon, ice }
}
