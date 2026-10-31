// Biomes tie a scene's materials together: the water, the sand, the rocks and
// what grows on the land all come from one coherent kind of coast.

export type RGB = [number, number, number]

export interface WaterStyle {
  name: string
  /** Albedo-like color of light scattered back out of deep water (linear). */
  deep: RGB
  /** Color of light transmitted through thin wave crests (linear). */
  scatter: RGB
  /** Absorption coefficients per metre (linear RGB); sets shallow-water tint. */
  absorption: RGB
}

export interface SandStyle {
  name: 'white' | 'golden' | 'grey' | 'black' | 'pink' | 'red'
  /** Dry sand albedo (linear). */
  albedo: RGB
}

export const SAND_STYLES: Record<SandStyle['name'], SandStyle> = {
  white: { name: 'white', albedo: [0.62, 0.58, 0.5] },
  golden: { name: 'golden', albedo: [0.46, 0.36, 0.23] },
  grey: { name: 'grey', albedo: [0.26, 0.24, 0.22] },
  black: { name: 'black', albedo: [0.06, 0.06, 0.065] },
  // Coral sand tinted by the red shells of the foraminifer Homotrema rubrum
  // (Bermuda, Harbour Island, Komodo's Pink Beach).
  pink: { name: 'pink', albedo: [0.68, 0.52, 0.48] },
  // Iron-stained sandstone and basalt sand (PEI, Fundy, Maui's Kaihalulu).
  red: { name: 'red', albedo: [0.42, 0.2, 0.12] }
}

const WATER: Record<string, WaterStyle> = {
  deep: {
    name: 'deep ocean',
    deep: [0.004, 0.016, 0.034],
    scatter: [0.0, 0.1, 0.13],
    absorption: [0.5, 0.12, 0.08]
  },
  tropical: {
    name: 'tropical',
    deep: [0.0, 0.035, 0.05],
    scatter: [0.02, 0.3, 0.26],
    absorption: [0.42, 0.065, 0.05]
  },
  northern: {
    name: 'northern',
    deep: [0.006, 0.02, 0.022],
    scatter: [0.03, 0.1, 0.075],
    absorption: [0.6, 0.2, 0.22]
  },
  mediterranean: {
    name: 'mediterranean',
    deep: [0.002, 0.02, 0.05],
    scatter: [0.0, 0.14, 0.2],
    absorption: [0.45, 0.08, 0.05]
  }
}

export type VegetationKind =
  | 'palm'
  | 'pandanus'
  | 'stone-pine'
  | 'olive'
  | 'cypress'
  | 'broadleaf'
  | 'conifer'
  | 'birch'
  | 'acacia'
  | 'bush'
  | 'grass'

export interface Biome {
  name: 'tropical' | 'mediterranean' | 'nordic' | 'volcanic' | 'desert'
  water: readonly WaterStyle[]
  /** Sand colour chances; a place may override them (places.ts). */
  sands: Partial<Record<SandStyle['name'], number>>
  /** Rock albedo choices (linear). */
  rockColors: readonly RGB[]
  /** Chance of rocks along the shore, and of dramatic sea stacks offshore. */
  rockChance: number
  seaStackChance: number
  /** Ground cover tint on vegetated land (linear albedo) and how much. */
  groundCover: RGB
  groundCoverAmount: number
  /** Plants and their relative abundance. */
  vegetation: readonly (readonly [VegetationKind, number])[]
  foliage: RGB
}

export const BIOMES: readonly (readonly [Biome, number])[] = [
  [
    {
      name: 'tropical',
      water: [WATER.tropical, WATER.tropical, WATER.deep],
      sands: { white: 66, golden: 33, pink: 1 },
      rockColors: [
        [0.28, 0.25, 0.22],
        [0.35, 0.3, 0.26]
      ],
      rockChance: 0.45,
      seaStackChance: 0.15,
      groundCover: [0.045, 0.075, 0.03],
      groundCoverAmount: 0.85,
      vegetation: [
        ['palm', 6],
        ['pandanus', 2],
        ['broadleaf', 1.5],
        ['bush', 3],
        ['grass', 2]
      ],
      foliage: [0.06, 0.16, 0.04]
    },
    3
  ],
  [
    {
      name: 'mediterranean',
      water: [WATER.mediterranean, WATER.deep],
      sands: { golden: 1, white: 1, grey: 1 },
      rockColors: [
        [0.42, 0.38, 0.32],
        [0.5, 0.45, 0.38],
        [0.36, 0.3, 0.24]
      ],
      rockChance: 0.75,
      seaStackChance: 0.3,
      groundCover: [0.12, 0.13, 0.06],
      groundCoverAmount: 0.8,
      vegetation: [
        ['stone-pine', 4],
        ['olive', 3],
        ['cypress', 2],
        ['broadleaf', 1.5],
        ['bush', 4],
        ['grass', 1]
      ],
      foliage: [0.07, 0.1, 0.04]
    },
    3
  ],
  [
    {
      name: 'nordic',
      water: [WATER.northern, WATER.deep],
      sands: { grey: 1, golden: 1 },
      rockColors: [
        [0.2, 0.2, 0.2],
        [0.3, 0.27, 0.25],
        [0.24, 0.22, 0.23]
      ],
      rockChance: 0.85,
      seaStackChance: 0.2,
      groundCover: [0.1, 0.12, 0.06],
      groundCoverAmount: 0.85,
      vegetation: [
        ['grass', 6],
        ['conifer', 3],
        ['birch', 2],
        ['bush', 1]
      ],
      foliage: [0.04, 0.08, 0.04]
    },
    2
  ],
  [
    {
      name: 'volcanic',
      water: [WATER.deep, WATER.northern],
      sands: { black: 2, grey: 1 },
      rockColors: [
        [0.05, 0.05, 0.055],
        [0.08, 0.07, 0.07]
      ],
      rockChance: 0.95,
      seaStackChance: 0.45,
      groundCover: [0.06, 0.12, 0.04],
      groundCoverAmount: 0.7,
      vegetation: [
        ['grass', 4],
        ['bush', 3],
        ['palm', 1],
        ['broadleaf', 1]
      ],
      foliage: [0.05, 0.13, 0.04]
    },
    1.5
  ],
  [
    {
      name: 'desert',
      water: [WATER.mediterranean, WATER.tropical, WATER.deep],
      sands: { golden: 2, white: 1 },
      rockColors: [
        [0.45, 0.32, 0.22],
        [0.5, 0.38, 0.27]
      ],
      rockChance: 0.4,
      seaStackChance: 0.2,
      groundCover: [0.3, 0.24, 0.16],
      groundCoverAmount: 0.2,
      vegetation: [
        ['bush', 1],
        ['acacia', 1],
        ['grass', 1]
      ],
      foliage: [0.12, 0.12, 0.06]
    },
    1
  ]
]

/** The biome preset called `name`. */
export function biomeNamed(name: Biome['name']): Biome {
  return BIOMES.find(([b]) => b.name === name)![0]
}

/** A place's climate (places.ts); declared here so the looks below can be
 * keyed by it without an import cycle. */
export type Climate = 'polar' | 'boreal' | 'temperate' | 'mediterranean' | 'subtropical' | 'tropical' | 'arid'

// Climates (PLAN_BIOMES 11b). The biome is a constant of the place, the look
// preset; the climate, drawn per day from the place's weights, patches the
// fields that follow the weather rather than the rock. Per field:
// - water: keep (the basin's own water wins on polar seas anyway);
// - sands: subtropical pale quartz (Florida, the Gold Coast, south Brazil);
//   temperate nordic golden over grey; polar grey gravel; else keep;
// - rockColors, seaStackChance: keep (geology);
// - rockChance: subtropical barrier and sand coasts have fewer boulders;
// - groundCover, foliage: humid climates greener, tundra browner;
// - vegetation: what grows there (below); the polar tundra filter is
//   plantsFor's (places.ts), for the polar climate as for polar water.
// Places' own pools (places.ts PLACE_SAND, PLACE_PLANTS) override on top.
// Kinds stand in for species: `broadleaf` = oak, beech, live oak, pohutukawa;
// `bush` = gorse, saw palmetto, sea grape; `grass` = marram, sea oats;
// `palm` = cabbage (sabal) and Canary palms; `stone-pine` = maritime and
// slash pine. Florida's zones run sea oats on the foredune, a saw palmetto
// and cabbage palm strand behind, then live oak hammock (FNAI coastal strand).
const CLIMATE_LOOKS: Partial<Record<Biome['name'], Partial<Record<Climate, Partial<Biome>>>>> = {
  nordic: {
    // Marram dunes and machair in front of mixed oak, beech and pine.
    temperate: {
      sands: { golden: 2, grey: 1 },
      groundCover: [0.08, 0.13, 0.05],
      vegetation: [
        ['grass', 6],
        ['broadleaf', 3],
        ['conifer', 1.5],
        ['bush', 2]
      ],
      foliage: [0.05, 0.1, 0.04]
    },
    polar: {
      sands: { grey: 2, golden: 1 },
      groundCover: [0.1, 0.1, 0.06],
      groundCoverAmount: 0.7
    }
  },
  mediterranean: {
    subtropical: {
      sands: { white: 3, golden: 2 },
      rockChance: 0.45,
      groundCover: [0.07, 0.11, 0.04],
      groundCoverAmount: 0.85,
      vegetation: [
        ['grass', 4],
        ['bush', 4],
        ['palm', 3],
        ['broadleaf', 3],
        ['stone-pine', 1]
      ],
      foliage: [0.05, 0.11, 0.035]
    },
    // Atlantic Portugal's maritime pine and Korea's oak and pine.
    temperate: {
      groundCover: [0.09, 0.12, 0.05],
      vegetation: [
        ['grass', 4],
        ['bush', 3],
        ['stone-pine', 2],
        ['broadleaf', 3],
        ['conifer', 1]
      ],
      foliage: [0.05, 0.1, 0.04]
    }
  },
  // One preset from Hawaii to Kamchatka: the climate decides what grows.
  volcanic: {
    tropical: {
      groundCover: [0.045, 0.08, 0.03],
      groundCoverAmount: 0.85,
      vegetation: [
        ['palm', 5],
        ['broadleaf', 2],
        ['bush', 3],
        ['grass', 2],
        ['pandanus', 1]
      ],
      foliage: [0.06, 0.16, 0.04]
    },
    // Canaries, Azores, Madeira, northern New Zealand.
    subtropical: {
      vegetation: [
        ['bush', 3],
        ['grass', 3],
        ['broadleaf', 2],
        ['palm', 1]
      ]
    },
    // Japan, the New Zealand subantarctic's lower slopes.
    temperate: {
      vegetation: [
        ['grass', 4],
        ['broadleaf', 3],
        ['conifer', 2],
        ['bush', 2]
      ],
      foliage: [0.05, 0.11, 0.04]
    },
    // Iceland and Kamchatka: moss, grass, crowberry, stone birch.
    boreal: {
      vegetation: [
        ['grass', 6],
        ['bush', 3],
        ['birch', 1]
      ],
      foliage: [0.04, 0.08, 0.04]
    },
    polar: {
      vegetation: [
        ['grass', 4],
        ['bush', 2]
      ],
      groundCover: [0.1, 0.1, 0.06]
    }
  }
}

/** The biome as it looks in a climate: the fields the climate changes
 * patched in, the rest the biome's. */
export function climateBiome(biome: Biome, climate: Climate): Biome {
  const patch = CLIMATE_LOOKS[biome.name]?.[climate]
  return patch == null ? biome : { ...biome, ...patch }
}
