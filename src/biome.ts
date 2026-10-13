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
  name: 'white' | 'golden' | 'grey' | 'black'
  /** Dry sand albedo (linear). */
  albedo: RGB
}

export const SAND_STYLES: Record<SandStyle['name'], SandStyle> = {
  white: { name: 'white', albedo: [0.62, 0.58, 0.5] },
  golden: { name: 'golden', albedo: [0.46, 0.36, 0.23] },
  grey: { name: 'grey', albedo: [0.26, 0.24, 0.22] },
  black: { name: 'black', albedo: [0.06, 0.06, 0.065] }
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

export type VegetationKind = 'palm' | 'stone-pine' | 'cypress' | 'conifer' | 'bush' | 'grass'

export interface Biome {
  name: 'tropical' | 'mediterranean' | 'nordic' | 'volcanic' | 'desert'
  water: readonly WaterStyle[]
  sands: readonly SandStyle['name'][]
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
      sands: ['white', 'white', 'golden'],
      rockColors: [
        [0.28, 0.25, 0.22],
        [0.35, 0.3, 0.26]
      ],
      rockChance: 0.45,
      seaStackChance: 0.15,
      groundCover: [0.05, 0.12, 0.03],
      groundCoverAmount: 0.95,
      vegetation: [
        ['palm', 6],
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
      sands: ['golden', 'white', 'grey'],
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
        ['cypress', 2],
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
      sands: ['grey', 'golden'],
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
      sands: ['black', 'black', 'grey'],
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
        ['palm', 1]
      ],
      foliage: [0.05, 0.13, 0.04]
    },
    1.5
  ],
  [
    {
      name: 'desert',
      water: [WATER.mediterranean, WATER.tropical, WATER.deep],
      sands: ['golden', 'golden', 'white'],
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
        ['grass', 1]
      ],
      foliage: [0.12, 0.12, 0.06]
    },
    1
  ]
]
