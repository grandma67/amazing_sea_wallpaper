import type { Biome, RGB } from './biome'
import type { CoastParams } from './params'
import type { Climate, Weights } from './places'
import type { Random } from './random'
import { hashCell, vnoise } from './cellNoise'

// What a beach is made of (PLAN_BIOMES phase 2): sand, or stones from pebbles
// to small boulders. Each place chooses its material like its ocean and
// climate; the biome (or a polar climate) gives the default chances and
// regions and places override them (places.ts). Shares and sources:
// knowledge/COASTS.md.

/** - sand: today's beach;
 * - mixed: sand, with a gravel and cobble band (2–15 cm) on the upper beach
 *   and storm ridge;
 * - shingle: pebbles (1–6 cm) over the whole beach, coarser at the crest;
 * - cobble: cobbles and small boulders (6–30 cm), gravel or sand at the
 *   waterline. */
export type BeachMaterial = 'sand' | 'mixed' | 'shingle' | 'cobble'
export const BEACH_MATERIALS: readonly BeachMaterial[] = ['sand', 'mixed', 'shingle', 'cobble']

/** Pebbles, cobbles or a mix: anything but sand. */
export const isStony = (material: BeachMaterial | undefined): material is Exclude<BeachMaterial, 'sand'> =>
  material != null && material !== 'sand'

/** Chances on beach days by biome. Glaciated and fjord coasts are stony,
 * coral coasts sandy. */
export const MATERIAL_CHANCES: Record<Biome['name'], Weights<BeachMaterial>> = {
  nordic: { sand: 35, mixed: 25, shingle: 20, cobble: 20 },
  mediterranean: { sand: 55, mixed: 15, shingle: 25, cobble: 5 },
  volcanic: { sand: 50, mixed: 15, shingle: 15, cobble: 20 },
  desert: { sand: 75, mixed: 15, shingle: 5, cobble: 5 },
  // Coral rubble and the odd basalt cobble; no shingle.
  tropical: { sand: 85, mixed: 10, cobble: 5 }
}

/** Polar coasts of any biome: frost-shattered gravel and cobbles. */
export const POLAR_MATERIAL: Weights<BeachMaterial> = { sand: 25, mixed: 25, shingle: 20, cobble: 30 }

/** The material chances of a place in a climate: the place's (or its
 * region's) own, else polar, else the biome's. */
export function materialChances(place: { biome: Biome['name']; material?: Weights<BeachMaterial> }, climate: Climate): Weights<BeachMaterial> {
  return place.material ?? (climate === 'polar' ? POLAR_MATERIAL : MATERIAL_CHANCES[place.biome])
}

/** Stone colours (linear albedo) by biome; places may override (Fundy's red
 * sandstone). Repeats weight a colour. */
export const STONE_COLORS: Record<Biome['name'], readonly RGB[]> = {
  // Grey granite and gneiss, dark greywacke, pinkish granite, white quartz.
  nordic: [
    [0.3, 0.29, 0.27],
    [0.3, 0.29, 0.27],
    [0.18, 0.18, 0.17],
    [0.36, 0.29, 0.25],
    [0.46, 0.44, 0.41]
  ],
  // White to cream limestone, some grey.
  mediterranean: [
    [0.56, 0.52, 0.45],
    [0.5, 0.47, 0.41],
    [0.42, 0.38, 0.32],
    [0.3, 0.29, 0.27]
  ],
  // Black basalt, a few red scoria.
  volcanic: [
    [0.05, 0.05, 0.055],
    [0.08, 0.075, 0.07],
    [0.11, 0.1, 0.095],
    [0.16, 0.075, 0.05]
  ],
  // Tan and red gravel.
  desert: [
    [0.42, 0.32, 0.22],
    [0.36, 0.2, 0.13],
    [0.5, 0.42, 0.32],
    [0.24, 0.19, 0.15]
  ],
  // Pale coral rubble, dark basalt.
  tropical: [
    [0.6, 0.57, 0.5],
    [0.5, 0.47, 0.41],
    [0.55, 0.5, 0.42],
    [0.1, 0.09, 0.09]
  ]
}

/** Bay of Fundy: red Triassic sandstone with grey basalt and greywacke. */
export const FUNDY_STONES: readonly RGB[] = [
  [0.33, 0.15, 0.1],
  [0.4, 0.22, 0.15],
  [0.28, 0.14, 0.1],
  [0.25, 0.24, 0.23]
]

/** A storm ridge (berm) of stones thrown up by the waves: a bump in the
 * beach profile along the shore. */
export interface Ridge {
  /** Crest distance inland of the waterline (m). */
  distance: number
  height: number
  /** Gaussian half-width (m). */
  width: number
}

/** How far inland (m from the waterline) the high-tide wrack line and the
 * storm line lie, from the beach profile in terrain.ts without its bumps.
 * On a stony beach the storm line is the storm ridge's crest. */
export function beachLines(coast: Pick<CoastParams, 'beachSlope' | 'beachWidth' | 'runup'> & { ridges?: readonly Ridge[] }): {
  highTide: number
  stormLine: number
} {
  const highTide = inlandAt(coast, coast.runup * 1.1)
  const stormLine = coast.ridges?.[0]?.distance ?? Math.max(inlandAt(coast, coast.runup * 2.2), highTide + 3)
  return { highTide, stormLine }
}

/** Distance inland where the bare beach profile reaches height `h`. */
function inlandAt(coast: Pick<CoastParams, 'beachSlope' | 'beachWidth'>, h: number): number {
  const maxHeight = coast.beachSlope * coast.beachWidth
  return -coast.beachWidth * Math.log(1 - Math.min(h / maxHeight, 0.9))
}

/** Swash sinks into gravel, so it runs less far up a shingle or cobble
 * beach than up sand. */
export const STONY_RUNUP = 0.6

/** The profile of a stony beach: steep, narrow, no sandbar, a low bank
 * behind and 1–3 storm ridges. The steep face carries on under water to the
 * step, so the waves break right on the beach (plunging or surging, a surf
 * zone metres wide; the breaker index follows the nearshore slope).
 * Temporary: phase 4 derives slopes from the beach state (stony beaches are
 * always reflective). `coast.runup` is already the stony one. */
export function stonyShape(
  coast: Pick<CoastParams, 'runup'>,
  material: Exclude<BeachMaterial, 'sand'>,
  rng: Random
): Pick<CoastParams, 'beachSlope' | 'beachWidth' | 'sandbarHeight' | 'duneHeight' | 'ridges' | 'nearshoreSlope' | 'stoneSize'> {
  const beachSlope = material === 'mixed' ? rng.range(0.08, 0.14) : rng.range(0.12, 0.25)
  const beachWidth = rng.range(12, 40)
  const duneHeight = rng.range(0.5, 2.5)
  const { highTide } = beachLines({ beachSlope, beachWidth, runup: coast.runup })
  // The storm ridge's crest stands where storm swash reaches, 1–2.5 m above
  // the sea (Chesil's is ~10 m; small ridges 1–3 m), well behind the daily
  // swash; one ridge: just it; two: a berm at the high-tide line too; three:
  // an older, grassed-over ridge behind.
  const stormHeight = Math.min(material === 'mixed' ? rng.range(1, 2) : rng.range(1.2, 2.5), 0.75 * beachSlope * beachWidth)
  const count = rng.weighted([
    [1, 3],
    [2, 4],
    [3, 2]
  ])
  const stormLine = Math.max(inlandAt({ beachSlope, beachWidth }, stormHeight), highTide + 6)
  const ridge = (distance: number, height: number, width: number): Ridge => ({ distance: Math.min(distance, beachWidth * 1.2), height, width })
  const ridges = [ridge(stormLine, rng.range(0.6, 1.2), rng.range(3, 6))]
  if (count >= 2) ridges.push(ridge(highTide, rng.range(0.3, 0.6), rng.range(1.5, 3)))
  if (count >= 3) ridges.push(ridge(stormLine + rng.range(6, 12), rng.range(0.5, 1.0), rng.range(3, 6)))
  // Mixed beaches keep a sand lower face, less steep.
  const nearshoreSlope = material === 'mixed' ? rng.range(0.035, 0.06) : rng.range(0.06, 0.12)
  const stoneSize = rng.range(...STONE_SIZES[material])
  return { beachSlope, beachWidth, sandbarHeight: 0, duneHeight, ridges, nearshoreSlope, stoneSize }
}

/** Title words: "cobble beach", "golden sand beach". */
export function beachName(material: BeachMaterial, sand: string): string {
  return material === 'sand' ? `${sand} sand beach` : material === 'mixed' ? 'sand and gravel beach' : `${material} beach`
}

/** The day's median stone size (m) by material; the beach grades from
 * ~0.6× on the lower beach to ~1.6× on the storm ridge crest
 * (STONE_LEVELS), so shingle runs ~1–8 cm, mixed ~2–13 cm and cobble
 * ~5–30 cm (Wentworth: pebbles 0.4–6.4 cm, cobbles 6.4–25.6 cm). */
export const STONE_SIZES: Record<Exclude<BeachMaterial, 'sand'>, [number, number]> = {
  mixed: [0.03, 0.08],
  shingle: [0.02, 0.05],
  cobble: [0.08, 0.18]
}

// --- Stones (PLAN_BIOMES 2c, 2d) -------------------------------------------
// The shader (terrain.ts STONE_GLSL) draws stones as Voronoi cells over shore
// coordinates (u = metres inland, a = along the shore); props/stones.ts puts a
// mesh stone on the same cells near the camera. These mirror the GLSL, so
// both agree on where each stone is, how big and what colour.

/** Cell size of each size class, × the day's stone size: fine on the lower
 * beach, coarse on the storm ridge crest. */
export const STONE_LEVELS = [0.6, 1, 1.6] as const

type StoneCoast = Pick<CoastParams, 'material' | 'stoneSize' | 'ridges' | 'noiseOffset' | 'stoneColors' | 'beachSlope' | 'beachWidth' | 'runup'>

/** How close to the storm ridge crest (1 on it, 0 away). */
function nearCrest(coast: Pick<CoastParams, 'ridges'>, u: number): number {
  const r = coast.ridges[0]
  if (r == null) return 0
  const k = (u - r.distance) / (1.5 * r.width)
  return Math.exp(-k * k)
}

/** The size class (index in STONE_LEVELS) at u (m inland), a: finer below
 * the high-tide line, coarsest on the storm ridge, in dithered patches
 * (beaches sort their stones into bands and patches). */
export function stoneLevel(coast: StoneCoast, u: number, a: number, highTide = beachLines(coast).highTide): number {
  const [ox, oz] = coast.noiseOffset
  const scale = 6 * coast.stoneSize
  let g = 1 + nearCrest(coast, u) - 0.8 * (1 - smooth(0, highTide, u))
  g += 0.9 * (vnoise(u / scale + 41 + ox, a / scale + 41 + oz) - 0.5)
  return Math.min(2, Math.max(0, Math.floor(g + 0.5)))
}

/** Share of the ground that is stones (0..1): all of it on shingle and
 * cobble; on a mixed beach a band from the high-tide line up and the
 * ridges, patchy, sand below. */
export function stoneCover(coast: StoneCoast, u: number, a: number, highTide = beachLines(coast).highTide): number {
  if (coast.material !== 'mixed') return 1
  const [ox, oz] = coast.noiseOffset
  const upper = Math.max(smooth(0.5, 1.3, u / Math.max(highTide, 0.5)), nearCrest(coast, u))
  return Math.min(1, upper * (0.55 + 0.6 * vnoise(u / 3 + 57 + ox, a / 3 + 57 + oz)))
}

export interface Stone {
  level: number
  /** Cell index in that level's grid. */
  cell: [number, number]
  /** Centre in shore coordinates [s, a] (s < 0 is land). */
  s: number
  a: number
  /** Cell size (m): the stone's width. */
  size: number
  /** Albedo (linear), palette colour × the stone's own brightness. */
  color: RGB
  /** 0..1; the stone is there where this is under stoneCover. */
  presence: number
}

/** The stone of cell (i, j) in size class `level` (GLSL stoneAt). */
export function stoneAt(coast: StoneCoast, level: number, i: number, j: number): Stone {
  const size = coast.stoneSize * STONE_LEVELS[level]
  const h = hashCell(i, j + level * 7919)
  const px = 0.1 + 0.8 * ((h & 0xffff) / 65535)
  const py = 0.1 + 0.8 * (((h >>> 16) & 0xffff) / 65535)
  const h2 = (Math.imul(h, 747796405) + 2891336453) >>> 0
  const palette = coast.stoneColors
  const base = palette[h2 % palette.length]
  const bright = 0.7 + 0.6 * (((h2 >>> 8) & 255) / 255)
  const [ox, oz] = coast.noiseOffset
  const u = (i + px - ox) * size
  return {
    level,
    cell: [i, j],
    s: -u,
    a: (j + py - oz) * size,
    size,
    color: [base[0] * bright, base[1] * bright, base[2] * bright],
    presence: ((h2 >>> 16) & 0xffff) / 65535
  }
}

/** The grid cell holding (u, a) in size class `level`. */
export function stoneGridCell(coast: StoneCoast, level: number, u: number, a: number): [number, number] {
  const size = coast.stoneSize * STONE_LEVELS[level]
  const [ox, oz] = coast.noiseOffset
  return [Math.floor(u / size + ox), Math.floor(a / size + oz)]
}

/** The stone nearest (s, a) in the size class there: the shader's one 3×3
 * cell search (GLSL stoneCell), or null on sand days. */
export function stoneCell(coast: StoneCoast, s: number, a: number): Stone | null {
  if (!isStony(coast.material)) return null
  const u = -s
  const level = stoneLevel(coast, u, a)
  const [ci, cj] = stoneGridCell(coast, level, u, a)
  let best: Stone | null = null
  let d1 = Infinity
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const stone = stoneAt(coast, level, ci + i, cj + j)
      const d = (stone.s - s) ** 2 + (stone.a - a) ** 2
      if (d < d1) {
        d1 = d
        best = stone
      }
    }
  }
  return best
}

/** Mean stone albedo of a palette, as the shader averages it far away. */
export function stoneMean(colors: readonly RGB[]): RGB {
  const sum = colors.reduce<RGB>((m, c) => [m[0] + c[0], m[1] + c[1], m[2] + c[2]], [0, 0, 0])
  return [sum[0] / colors.length, sum[1] / colors.length, sum[2] / colors.length]
}

/** Colour of the shallow seabed seen through the water (ocean.ts
 * sandAlbedo): stones off shingle and cobble beaches, half and half off
 * mixed ones. */
export function seabedAlbedo(coast: Pick<CoastParams, 'material' | 'stoneColors' | 'sand'>): RGB {
  if (!isStony(coast.material)) return coast.sand.albedo
  const stones = stoneMean(coast.stoneColors)
  const t = coast.material === 'mixed' ? 0.5 : 1
  const sand = coast.sand.albedo
  return [sand[0] + (stones[0] - sand[0]) * t, sand[1] + (stones[1] - sand[1]) * t, sand[2] + (stones[2] - sand[2]) * t]
}

function smooth(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}
