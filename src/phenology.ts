// Phenology: what the plants look like on the day (knowledge/SEASONS.md §2,
// plans/SEASONS_PLAN.md). Deciduous leaves turn and fall, grass dries, by
// the day's climate and in its own hemisphere (seasons.ts seasonDay). Not
// random: no draws, so a tree's shape never changes with the season, only
// its leaves (props/trees.ts hashes each leaf).

import type { Climate, RGB, VegetationKind } from './biome'
import { seasonDay, type Day } from './seasons'

/** What phenology reads from a day (SceneParams has all of it). */
export interface PhenologyDay extends Day {
  place: { id: string; climate: Climate }
  overrides?: { phenology?: boolean }
}

export interface Phenology {
  /** Deciduous leaves: the share still on the tree, the share of those
   * turned to autumn colours, and spring's fresh green (each 0–1). */
  on: number
  turned: number
  fresh: number
  /** Grass and ground cover: 0 green … 1 straw. */
  dry: number
  climate: Climate
  /** The tropical almond's twice-yearly red (a different clock). */
  tropical: { on: number; turned: number }
  placeId: string
  south: boolean
}

/** What a plant builder needs: the leaves of a deciduous tree (`deciduous`
 * is the share of trees that are) and the grass's dryness. */
export interface PlantSeason {
  on: number
  turned: number
  fresh: number
  dry: number
  deciduous: number
  autumn: readonly RGB[]
}

/** Plants in full summer leaf: what every day looked like before. */
export const SUMMER: Omit<Phenology, 'climate' | 'placeId' | 'south'> = { on: 1, turned: 0, fresh: 0, dry: 0, tropical: { on: 1, turned: 0 } }

/**
 * A value that rises from 0 at day `a` to 1 at `b`, holds, and falls back to
 * 0 from `c` to `e` (days of the year, 1–365; the window may wrap the year).
 */
export function band(d: number, a: number, b: number, c: number, e: number): number {
  const off = (x: number): number => (((x - a) % 365) + 365) % 365
  const x = off(d)
  const [B, C, E] = [off(b), off(c), off(e)]
  if (x < B) return x / B
  if (x < C) return 1
  if (x < E) return 1 - (x - C) / (E - C)
  return 0
}

/** Deciduous leaves by climate (SEASONS.md §2.1): leaf-out and full leaf,
 * first tint, peak colour, bare (northern-hemisphere days). */
export const LEAF_DAYS: Partial<Record<Climate, { out: number; full: number; tint: number; peak: number; bare: number }>> = {
  // Tundra shrubs: green for two months, red in early September.
  polar: { out: 166, full: 182, tint: 227, peak: 248, bare: 268 },
  // Birch and aspen: yellow by the third week of September.
  boreal: { out: 140, full: 156, tint: 244, peak: 263, bare: 288 },
  // Oak and beech (Nature's Calendar): first tint ~2 Oct, full tint early
  // November, bare ~1 December.
  temperate: { out: 105, full: 130, tint: 268, peak: 300, bare: 335 }
}

/** Grass and ground cover dryness by climate (SEASONS.md §2.2): rise, hold,
 * fall (days), and how dry at most. */
export const DRY_DAYS: Partial<Record<Climate, { a: number; b: number; c: number; e: number; max: number }>> = {
  // Summer dormancy: golden June–October, green again after the autumn rains.
  mediterranean: { a: 145, b: 196, c: 288, e: 334, max: 0.85 },
  // Dull winter pasture and dead tops.
  temperate: { a: 305, b: 340, c: 50, e: 90, max: 0.3 },
  subtropical: { a: 330, b: 350, c: 40, e: 60, max: 0.15 },
  // Straw from the first frosts to after the snow.
  boreal: { a: 258, b: 288, c: 135, e: 165, max: 0.8 },
  polar: { a: 228, b: 250, c: 166, e: 190, max: 0.9 }
}

/** The day's phenology; the summer look when a spec switches it off. */
export function phenologyFor(day: PhenologyDay): Phenology {
  const climate = day.place.climate
  const base = { climate, placeId: day.place.id, south: day.latitudeDeg < 0 }
  if (day.overrides?.phenology === false) return { ...SUMMER, ...base }
  const d = seasonDay(day)
  const leaf = LEAF_DAYS[climate]
  let [on, turned, fresh] = [1, 0, 0]
  if (leaf != null) {
    on = 1 - band(d, leaf.peak, leaf.bare, leaf.out, leaf.full)
    turned = band(d, leaf.tint, (leaf.peak + leaf.bare) / 2, leaf.out - 1, leaf.out)
    fresh = band(d, leaf.out, leaf.out + 1, leaf.full, leaf.full + 21)
  }
  const dryDays = DRY_DAYS[climate]
  const dry = dryDays == null ? 0 : dryDays.max * band(d, dryDays.a, dryDays.b, dryDays.c, dryDays.e)
  // Tropical almond: red and shedding in January–February and July–August
  // (calendar months: two dry seasons a year).
  const doy = seasonDay({ date: day.date, latitudeDeg: 1 })
  const almond = Math.max(band(doy, 1, 25, 40, 60), band(doy, 182, 205, 222, 243))
  return { ...base, on, turned, fresh, dry, tropical: { on: 1 - 0.5 * almond, turned: almond } }
}

/** Places whose autumn is red, not yellow: eastern North America's maples,
 * East Asia's, Patagonia's lenga. Europe's is yellow (SEASONS.md §2.1). */
export const AUTUMN_RED = new Set(['maine', 'nova-scotia', 'pei', 'fundy', 'newfoundland', 'yellow-sea', 'south-japan', 'russian-far-east', 'tierra-del-fuego', 'patagonia-fjords'])

// Turned leaves (linear albedo, about twice a summer leaf's brightness).
const YELLOW: RGB = [0.3, 0.2, 0.025]
const GOLD: RGB = [0.25, 0.14, 0.025]
const ORANGE: RGB = [0.26, 0.09, 0.02]
const COPPER: RGB = [0.16, 0.065, 0.025]
const RED: RGB = [0.22, 0.035, 0.025]
const BROWN: RGB = [0.11, 0.065, 0.03]

/** The share of a kind's trees that are deciduous here (SEASONS.md §2.1). */
export function deciduousShare(kind: VegetationKind, phen: Phenology): number {
  const { climate, placeId, south } = phen
  const cool = climate === 'temperate' || climate === 'boreal' || climate === 'polar'
  if (kind === 'birch') return 1
  if (kind === 'broadleaf') {
    if (placeId === 'tierra-del-fuego') return 0.6
    if (placeId === 'patagonia-fjords') return 0.3
    if (climate === 'tropical') return 0.4
    return cool && !south ? 0.9 : 0
  }
  if (kind === 'bush' && !south) return climate === 'polar' ? 0.8 : climate === 'boreal' ? 0.6 : climate === 'temperate' ? 0.3 : 0
  return 0
}

/** The colours a kind's leaves turn here. */
export function autumnColors(kind: VegetationKind, phen: Phenology): readonly RGB[] {
  if (phen.climate === 'tropical') return [RED, RED, ORANGE, BROWN]
  if (kind === 'birch') return [YELLOW, YELLOW, GOLD]
  if (phen.climate === 'polar') return [RED, ORANGE, RED, GOLD]
  if (AUTUMN_RED.has(phen.placeId)) return [RED, ORANGE, GOLD, RED, YELLOW]
  if (phen.climate === 'boreal') return [YELLOW, GOLD, YELLOW, ORANGE]
  return [GOLD, ORANGE, COPPER, YELLOW, BROWN]
}

/** What a plant builder gets for `kind` today; undefined when it looks as
 * in summer (evergreen, or deciduous in full summer leaf with green grass). */
export function plantSeason(kind: VegetationKind, phen: Phenology): PlantSeason | undefined {
  const deciduous = deciduousShare(kind, phen)
  const leaves = phen.climate === 'tropical' ? { ...phen.tropical, fresh: 0 } : phen
  const leafy = deciduous > 0 && (leaves.on < 1 || leaves.turned > 0 || leaves.fresh > 0)
  if (!leafy && phen.dry === 0) return undefined
  return { on: leaves.on, turned: leaves.turned, fresh: leaves.fresh, dry: phen.dry, deciduous: leafy ? deciduous : 0, autumn: autumnColors(kind, phen) }
}

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const mean = (cs: readonly RGB[]): RGB => cs.reduce<RGB>((s, c) => [s[0] + c[0] / cs.length, s[1] + c[1] / cs.length, s[2] + c[2] / cs.length], [0, 0, 0])

/** Bare twigs and the ground between them, seen from afar. */
const BARE: RGB = [0.07, 0.06, 0.05]

/**
 * A distant wood's colour this season: `foliage` turned toward its autumn
 * colours and, as the leaves fall, toward bare grey-brown. `plants` is the
 * day's plant pool (the deciduous share of the trees in it decides how much).
 */
export function canopyTint(foliage: RGB, phen: Phenology, plants: readonly (readonly [VegetationKind, number])[]): RGB {
  const trees = plants.filter(([k]) => k !== 'grass')
  const total = trees.reduce((s, [, w]) => s + w, 0)
  if (total === 0) return foliage
  const share = trees.reduce((s, [k, w]) => s + w * deciduousShare(k, phen), 0) / total
  if (share === 0) return foliage
  const leaves = phen.climate === 'tropical' ? phen.tropical : phen
  // Far away the turned crowns are dimmer than a lit leaf (shade inside the crown).
  const turned = mix(foliage, mean(autumnColors('broadleaf', phen)).map(v => v * 0.6) as RGB, share * leaves.on * leaves.turned)
  return mix(turned, BARE, share * (1 - leaves.on))
}

/** Ground cover (terrain) with the grass dried toward straw. */
const STRAW: RGB = [0.2, 0.15, 0.075]
export function groundCoverTint(cover: RGB, phen: Phenology): RGB {
  return mix(cover, STRAW, phen.dry * 0.75)
}
