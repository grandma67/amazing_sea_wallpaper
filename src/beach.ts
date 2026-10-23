import type { Biome, RGB } from './biome'
import type { CoastParams } from './params'
import type { Climate, Weights } from './places'
import type { Random } from './random'

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
 * storm line lie, from the beach profile in terrain.ts without its bumps. */
export function beachLines(coast: Pick<CoastParams, 'beachSlope' | 'beachWidth' | 'runup'>): { highTide: number; stormLine: number } {
  const maxHeight = coast.beachSlope * coast.beachWidth
  const inland = (h: number): number => -coast.beachWidth * Math.log(1 - Math.min(h / maxHeight, 0.9))
  const highTide = inland(coast.runup * 1.1)
  return { highTide, stormLine: Math.max(inland(coast.runup * 2.2), highTide + 3) }
}

/** The profile of a stony beach: steep, narrow, no sandbar, a low bank
 * behind and 1–3 storm ridges. Temporary: phase 4 derives slopes from the
 * beach state (stony beaches are always reflective). */
export function stonyShape(
  coast: Pick<CoastParams, 'runup'>,
  material: Exclude<BeachMaterial, 'sand'>,
  rng: Random
): Pick<CoastParams, 'beachSlope' | 'beachWidth' | 'sandbarHeight' | 'duneHeight' | 'ridges'> {
  const beachSlope = material === 'mixed' ? rng.range(0.08, 0.14) : rng.range(0.12, 0.25)
  const beachWidth = rng.range(12, 40)
  const duneHeight = rng.range(0.5, 2.5)
  const { highTide, stormLine } = beachLines({ beachSlope, beachWidth, runup: coast.runup })
  // One ridge: the storm ridge; two: a berm at the high-tide line too; three:
  // an older, grassed-over ridge behind.
  const count = rng.weighted([
    [1, 3],
    [2, 4],
    [3, 2]
  ])
  const ridge = (distance: number, height: number): Ridge => ({
    distance: Math.min(distance, beachWidth * 1.2),
    height,
    width: rng.range(2, 4.5)
  })
  const ridges = [ridge(stormLine, rng.range(0.6, 1.2))]
  if (count >= 2) ridges.push(ridge(highTide, rng.range(0.3, 0.6)))
  if (count >= 3) ridges.push(ridge(stormLine + rng.range(6, 12), rng.range(0.5, 1.0)))
  return { beachSlope, beachWidth, sandbarHeight: 0, duneHeight, ridges }
}

/** Title words: "cobble beach", "golden sand beach". */
export function beachName(material: BeachMaterial, sand: string): string {
  return material === 'sand' ? `${sand} sand beach` : material === 'mixed' ? 'sand and gravel beach' : `${material} beach`
}
